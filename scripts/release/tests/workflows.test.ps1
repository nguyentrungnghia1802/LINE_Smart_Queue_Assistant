Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$CiWorkflow = Get-Content -Raw (Join-Path $RepositoryRoot '.github/workflows/ci.yml')
$DeployWorkflow = Get-Content -Raw (Join-Path $RepositoryRoot '.github/workflows/deploy.yml')
$AllWorkflows = "$CiWorkflow`n$DeployWorkflow"
$ReleaseJob = [regex]::Match($DeployWorkflow, '(?ms)^  release:.*').Value
$MediaPersistenceJob = [regex]::Match(
  $CiWorkflow,
  '(?ms)^  media-persistence:.*?(?=^  release-tooling:)'
).Value
$RetiredLiffVariable = 'VITE_' + 'LIFF_ID'

function Assert-Matches {
  param(
    [Parameter(Mandatory)] [string] $Content,
    [Parameter(Mandatory)] [string] $Pattern,
    [Parameter(Mandatory)] [string] $Message
  )

  if ($Content -notmatch $Pattern) {
    throw $Message
  }
}

function Assert-DoesNotMatch {
  param(
    [Parameter(Mandatory)] [string] $Content,
    [Parameter(Mandatory)] [string] $Pattern,
    [Parameter(Mandatory)] [string] $Message
  )

  if ($Content -match $Pattern) {
    throw $Message
  }
}

function Assert-MatchCount {
  param(
    [Parameter(Mandatory)] [string] $Content,
    [Parameter(Mandatory)] [string] $Pattern,
    [Parameter(Mandatory)] [int] $Expected,
    [Parameter(Mandatory)] [string] $Message
  )

  if ([regex]::Matches($Content, $Pattern).Count -ne $Expected) {
    throw $Message
  }
}

Assert-Matches $CiWorkflow '(?ms)^on:\s+push:\s+branches: \[main\]\s+pull_request:\s+branches: \[main\]' `
  'CI must validate pushes to main and pull requests targeting main'
Assert-DoesNotMatch $CiWorkflow 'chore/dev|branches:\s*\[''" ]*\*\*' `
  'CI must not preserve the obsolete intermediate-branch or every-branch trigger'
Assert-Matches $CiWorkflow 'deploy/scripts/tests/build-push\.test\.ps1' `
  'CI must validate the canonical Windows manual image publisher'
Assert-DoesNotMatch $CiWorkflow 'publish-images(?:\.test)?\.ps1|build-push\.sh' `
  'CI must not reference a removed or superseded manual image publisher'
Assert-Matches $AllWorkflows 'actions/checkout@v7' `
  'Workflows must use the Node 24 checkout action'
Assert-Matches $CiWorkflow 'actions/setup-node@v7' `
  'CI must use the Node 24 setup-node action'
Assert-Matches $CiWorkflow 'gitleaks/gitleaks-action@v3' `
  'CI must use the Node 24 Gitleaks action'
Assert-Matches $DeployWorkflow 'docker/setup-buildx-action@v4' `
  'CD must use the Node 24 Buildx action'
Assert-Matches $DeployWorkflow 'docker/login-action@v4' `
  'CD must use the Node 24 Docker login action'
Assert-Matches $DeployWorkflow 'docker/build-push-action@v7' `
  'CD must use the Node 24 Docker build and push action'
Assert-DoesNotMatch $AllWorkflows '(?:actions/checkout|actions/setup-node)@v[1-6]\b|gitleaks/gitleaks-action@v[12]\b|docker/setup-buildx-action@v[1-3]\b|docker/login-action@v[1-3]\b|docker/build-push-action@v[1-6]\b' `
  'Workflows must not retain action majors that use a deprecated Node runtime'
Assert-Matches $MediaPersistenceJob 'max_attempts=3' `
  'The media persistence image build must bound transient registry retries'
Assert-Matches $MediaPersistenceJob 'unexpected status\.\*\(429\|500\|502\|503\|504\)' `
  'The media persistence image build must recognize transient registry HTTP failures'
Assert-Matches $MediaPersistenceJob 'Non-transient Docker build failure; not retrying\.' `
  'The media persistence image build must fail immediately for real build errors'
Assert-DoesNotMatch $MediaPersistenceJob 'continue-on-error' `
  'The media persistence gate must never hide an exhausted or permanent build failure'

Assert-Matches $DeployWorkflow '(?ms)^on:\s+workflow_run:\s+workflows: \[''CI Quality Gates''\]\s+types: \[completed\]\s+branches: \[main\]' `
  'CD must be triggered only after completion of the main CI workflow'
Assert-DoesNotMatch $DeployWorkflow '(?m)^  (workflow_dispatch|pull_request|push):' `
  'Production CD must not have a manual, pull-request, or direct-push trigger'
Assert-Matches $DeployWorkflow "workflow_run\.conclusion == 'success'" `
  'CD must require a successful upstream CI conclusion'
Assert-Matches $DeployWorkflow "workflow_run\.head_branch == 'main'" `
  'CD must require the validated main branch'
Assert-Matches $DeployWorkflow 'workflow_run\.head_repository\.full_name == github\.repository' `
  'CD must reject workflow runs from a different repository'
Assert-Matches $DeployWorkflow 'RELEASE_SHA: \$\{\{ github\.event\.workflow_run\.head_sha \}\}' `
  'CD must derive the release revision from the validated workflow run'
Assert-Matches $DeployWorkflow 'ref: \$\{\{ env\.RELEASE_SHA \}\}' `
  'CD must check out the exact validated revision'
Assert-Matches $DeployWorkflow 'tag="git-\$\{RELEASE_SHA\}"' `
  'CD must derive the immutable image tag from the validated full SHA'
Assert-Matches $DeployWorkflow 'LINE_LOGIN_LIFF_ID: \$\{\{ vars\.LINE_LOGIN_LIFF_ID \}\}' `
  'CD must read the canonical public LIFF ID repository variable'
Assert-Matches $DeployWorkflow 'LINE_LOGIN_LIFF_ID=\$\{\{ vars\.LINE_LOGIN_LIFF_ID \}\}' `
  'CD must pass the canonical public LIFF ID into the Web image build'
Assert-DoesNotMatch $DeployWorkflow ([regex]::Escape($RetiredLiffVariable)) `
  'CD must not use the retired ambiguous LIFF variable name'
Assert-Matches $ReleaseJob '(?ms)^  release:.*?environment:\s+name: production.*?docker/login-action@v4.*?Configure pinned SSH.*?deploy/backup/deploy-safe\.sh "\$IMAGE_TAG"' `
  'One protected production job must gate image publication and the subsequent VPS deployment'
Assert-Matches $ReleaseJob '(?ms)environment:\s+name: production\s+url:\s+https://smartqueue\.io\.vn/' `
  'The protected production environment must advertise the canonical production URL'
Assert-Matches $ReleaseJob '(?ms)if:\s+\$\{\{\s*success\(\)\s*\}\}.*?\[Open production\]\(https://smartqueue\.io\.vn/\).*?\$GITHUB_STEP_SUMMARY' `
  'A successful CD run must publish a clickable production URL in the job summary'
Assert-Matches $ReleaseJob 'DOCKERHUB_TOKEN: \$\{\{ secrets\.DOCKERHUB_TOKEN \}\}' `
  'The protected release job must read the production environment Docker Hub token'
Assert-Matches $ReleaseJob 'require_value DOCKERHUB_TOKEN "\$DOCKERHUB_TOKEN"' `
  'CD must validate all protected production configuration before publishing images'
Assert-DoesNotMatch $DeployWorkflow '(?m)^  (build-publish|deploy):|needs: build-publish' `
  'CD must not split production credentials across separately approved jobs'
Assert-Matches $ReleaseJob 'tar -tzf "\$RUNNER_TEMP/deploy-tooling\.tar\.gz" >/dev/null' `
  'CD must verify the deployment tooling archive before transfer'
Assert-MatchCount $ReleaseJob 'resolve_project_root\(\)' 2 `
  'Both remote phases must normalize the configured deployment path independently'
Assert-Matches $ReleaseJob '(?ms)-f "\$configured/deploy/\.env".*?"\$configured" == \*/deploy.*?-f "\$configured/\.env"' `
  'CD must accept either the project root or its deploy directory'
Assert-DoesNotMatch $ReleaseJob 'test -f "\$DEPLOY_PATH/deploy/\.env"|cd "\$DEPLOY_PATH"' `
  'CD must not append deploy to an already normalized production path'
Assert-Matches $DeployWorkflow '(?ms)concurrency:\s+group: production-deploy\s+cancel-in-progress: false' `
  'Production releases must be serialized without canceling an in-flight deployment'
Assert-Matches $DeployWorkflow 'deploy/backup/deploy-safe\.sh "\$IMAGE_TAG"' `
  'CD must pass only the resolved immutable tag to the safe deployment tool'
Assert-DoesNotMatch $DeployWorkflow 'deploy-safe\.sh\s+[^\r\n]*latest' `
  'Production deployment must never use latest as its release identity'

Write-Output 'Automatic validated-main release workflow validation passed'

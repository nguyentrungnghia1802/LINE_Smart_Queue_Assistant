Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$CiWorkflow = Get-Content -Raw (Join-Path $RepositoryRoot '.github/workflows/ci.yml')
$DeployWorkflow = Get-Content -Raw (Join-Path $RepositoryRoot '.github/workflows/deploy.yml')

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

Assert-Matches $CiWorkflow '(?ms)^on:\s+push:\s+branches: \[main\]\s+pull_request:\s+branches: \[main\]' `
  'CI must validate pushes to main and pull requests targeting main'
Assert-DoesNotMatch $CiWorkflow 'chore/dev|branches:\s*\[''" ]*\*\*' `
  'CI must not preserve the obsolete intermediate-branch or every-branch trigger'
Assert-Matches $CiWorkflow 'deploy/scripts/tests/build-push\.test\.ps1' `
  'CI must validate the canonical Windows manual image publisher'
Assert-DoesNotMatch $CiWorkflow 'publish-images(?:\.test)?\.ps1|build-push\.sh' `
  'CI must not reference a removed or superseded manual image publisher'

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
Assert-Matches $DeployWorkflow '(?ms)needs: build-publish.*environment:\s+name: production' `
  'Production approval must occur after immutable images are built and published'
Assert-Matches $DeployWorkflow '(?ms)concurrency:\s+group: production-deploy\s+cancel-in-progress: false' `
  'Production releases must be serialized without canceling an in-flight deployment'
Assert-Matches $DeployWorkflow 'deploy/backup/deploy-safe\.sh "\$IMAGE_TAG"' `
  'CD must pass only the resolved immutable tag to the safe deployment tool'
Assert-DoesNotMatch $DeployWorkflow 'deploy-safe\.sh\s+[^\r\n]*latest' `
  'Production deployment must never use latest as its release identity'

Write-Output 'Automatic validated-main release workflow validation passed'

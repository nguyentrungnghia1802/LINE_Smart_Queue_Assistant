Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Publisher = (Resolve-Path (Join-Path $PSScriptRoot '../build-push.ps1')).Path
$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$RetiredLiffVariable = 'VITE_' + 'LIFF_ID'

Push-Location $RepositoryRoot
try {
  $gitSha = (& git rev-parse HEAD | Out-String).Trim().ToLowerInvariant()
  if ($LASTEXITCODE -ne 0 -or $gitSha -notmatch '^[0-9a-f]{40}$') {
    throw 'Unable to resolve the test Git SHA'
  }

  $releaseTag = "git-$($gitSha.Substring(0, 12))"
  $output = & $Publisher `
    -ImageNamespace 'ghcr.io/example' `
    -LiffId 'test-liff-id' `
    -DryRun `
    -AllowDirty | Out-String

  $expectedFragments = @(
    "ghcr.io/example/line-smart-queue-api:$releaseTag",
    "ghcr.io/example/line-smart-queue-web:$releaseTag",
    "org.opencontainers.image.revision=$gitSha",
    'LINE_LOGIN_LIFF_ID=test-liff-id',
    "VITE_SENTRY_RELEASE=$gitSha",
    "DEPLOY_TAG=$releaseTag",
    "VPS_COMMAND=bash deploy/scripts/deploy.sh $releaseTag"
  )
  foreach ($fragment in $expectedFragments) {
    if (-not $output.Contains($fragment)) {
      throw "Publisher dry-run plan is missing: $fragment"
    }
  }

  $buildCount = ([regex]::Matches($output, '(?m)^docker build ')).Count
  $pushCount = ([regex]::Matches($output, '(?m)^docker push ')).Count
  if ($buildCount -ne 2 -or $pushCount -ne 2) {
    throw "Expected 2 builds and 2 pushes, found $buildCount builds and $pushCount pushes"
  }
  if ($output -match '(?i)(?:^|[:=\s])latest(?:$|\s)') {
    throw 'Manual publisher must not build or push a mutable latest tag'
  }
  if ($output.Contains("git-$gitSha")) {
    throw 'Manual publisher unexpectedly used the full-SHA tag instead of the canonical 12-character tag'
  }
  if ($output.Contains($RetiredLiffVariable)) {
    throw "Manual publisher still uses the retired $RetiredLiffVariable build argument"
  }

  $previousApiRepository = $env:API_IMAGE_REPOSITORY
  $previousWebRepository = $env:WEB_IMAGE_REPOSITORY
  $env:API_IMAGE_REPOSITORY = 'ghcr.io/nguyentrungnghia1802/line-smart-queue-api'
  $env:WEB_IMAGE_REPOSITORY = 'ghcr.io/nguyentrungnghia1802/line-smart-queue-web'
  try {
    $configuredOutput = & $Publisher -LiffId 'test-liff-id' -DryRun -AllowDirty | Out-String
  } finally {
    $env:API_IMAGE_REPOSITORY = $previousApiRepository
    $env:WEB_IMAGE_REPOSITORY = $previousWebRepository
  }
  foreach ($repository in @(
    'ghcr.io/nguyentrungnghia1802/line-smart-queue-api',
    'ghcr.io/nguyentrungnghia1802/line-smart-queue-web'
  )) {
    if (-not $configuredOutput.Contains("${repository}:$releaseTag")) {
      throw "Publisher did not resolve the configured deployment repository: $repository"
    }
  }

  try {
    & $Publisher $releaseTag -ImageNamespace ghcr.io/example -LiffId test -DryRun -AllowDirty *> $null
    throw 'Operator-supplied release tag was unexpectedly accepted'
  } catch {
    if ($_.Exception.Message -eq 'Operator-supplied release tag was unexpectedly accepted') {
      throw
    }
  }

  try {
    & $Publisher -ImageNamespace 'ghcr.io/invalid//namespace' -LiffId test -DryRun -AllowDirty *> $null
    throw 'Invalid image namespace was unexpectedly accepted'
  } catch {
    if ($_.Exception.Message -eq 'Invalid image namespace was unexpectedly accepted') {
      throw
    }
  }

  try {
    & $Publisher `
      -ApiImageRepository 'ghcr.io/example/team/api:mutable' `
      -WebImageRepository 'ghcr.io/example/team/web' `
      -LiffId test -DryRun -AllowDirty *> $null
    throw 'Tagged image repository was unexpectedly accepted'
  } catch {
    if ($_.Exception.Message -eq 'Tagged image repository was unexpectedly accepted') {
      throw
    }
  }

  try {
    & $Publisher -ImageNamespace ghcr.io/example -LiffId "invalid`nvalue" -DryRun -AllowDirty *> $null
    throw 'Unsafe LIFF ID was unexpectedly accepted'
  } catch {
    if ($_.Exception.Message -eq 'Unsafe LIFF ID was unexpectedly accepted') {
      throw
    }
  }

  Write-Output "Windows immutable image publisher validation passed for $releaseTag"
} finally {
  Pop-Location
}

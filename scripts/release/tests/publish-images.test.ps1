Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Publisher = (Resolve-Path (Join-Path $PSScriptRoot '../publish-images.ps1')).Path
$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path

Push-Location $RepositoryRoot
try {
  $gitSha = (& git rev-parse HEAD | Out-String).Trim().ToLowerInvariant()
  if ($LASTEXITCODE -ne 0 -or $gitSha -notmatch '^[0-9a-f]{40}$') {
    throw 'Unable to resolve the test Git SHA'
  }

  $output = & $Publisher `
    -RegistryNamespace 'example.invalid/line-queue' `
    -LiffId 'test-liff-id' `
    -DryRun `
    -AllowDirty | Out-String

  $releaseTag = "git-$gitSha"
  $expectedFragments = @(
    "example.invalid/line-queue/line-smart-queue-api:$releaseTag",
    "example.invalid/line-queue/line-smart-queue-web:$releaseTag",
    'example.invalid/line-queue/line-smart-queue-api:latest',
    'example.invalid/line-queue/line-smart-queue-web:latest',
    "org.opencontainers.image.revision=$gitSha",
    "VITE_SENTRY_RELEASE=$gitSha",
    "RELEASE_TAG=$releaseTag"
  )
  foreach ($fragment in $expectedFragments) {
    if (-not $output.Contains($fragment)) {
      throw "Publisher dry-run plan is missing: $fragment"
    }
  }

  $buildCount = ([regex]::Matches($output, '(?m)^docker build ')).Count
  $pushCount = ([regex]::Matches($output, '(?m)^docker push ')).Count
  if ($buildCount -ne 2 -or $pushCount -ne 4) {
    throw "Expected 2 builds and 4 pushes, found $buildCount builds and $pushCount pushes"
  }

  try {
    & $Publisher -RegistryNamespace 'invalid//namespace' -LiffId test -DryRun -AllowDirty *> $null
    throw 'Invalid registry namespace was unexpectedly accepted'
  } catch {
    if ($_.Exception.Message -eq 'Invalid registry namespace was unexpectedly accepted') {
      throw
    }
  }

  try {
    & $Publisher -RegistryNamespace 'registry.example/team:mutable' -LiffId test -DryRun -AllowDirty *> $null
    throw 'Tagged registry namespace was unexpectedly accepted'
  } catch {
    if ($_.Exception.Message -eq 'Tagged registry namespace was unexpectedly accepted') {
      throw
    }
  }

  try {
    & $Publisher -RegistryNamespace example/team -LiffId "invalid`nvalue" -DryRun -AllowDirty *> $null
    throw 'Unsafe LIFF ID was unexpectedly accepted'
  } catch {
    if ($_.Exception.Message -eq 'Unsafe LIFF ID was unexpectedly accepted') {
      throw
    }
  }

  Write-Output "Immutable image publisher validation passed for $releaseTag"
} finally {
  Pop-Location
}

[CmdletBinding()]
param(
  [string]$RegistryNamespace = '',
  [string]$LiffId = $env:VITE_LIFF_ID,
  [string]$Platform = 'linux/amd64',
  [switch]$DryRun,
  [switch]$AllowDirty
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path

function Invoke-GitCapture {
  param([Parameter(Mandatory)][string[]]$Arguments)

  $result = (& git @Arguments | Out-String).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
  return $result
}

function Format-Command {
  param(
    [Parameter(Mandatory)][string]$Executable,
    [Parameter(Mandatory)][string[]]$Arguments
  )

  $displayArguments = foreach ($argument in $Arguments) {
    if ($argument -match '[\s`"'']') {
      "'" + $argument.Replace("'", "''") + "'"
    } else {
      $argument
    }
  }
  return "$Executable $($displayArguments -join ' ')"
}

function Invoke-ReleaseCommand {
  param(
    [Parameter(Mandatory)][string]$Executable,
    [Parameter(Mandatory)][string[]]$Arguments
  )

  Write-Output (Format-Command -Executable $Executable -Arguments $Arguments)
  if ($DryRun) {
    return
  }

  & $Executable @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Executable failed with exit code $LASTEXITCODE"
  }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'git is required'
}

Push-Location $RepositoryRoot
try {
  $gitRoot = Invoke-GitCapture -Arguments @('rev-parse', '--show-toplevel')
  if ([IO.Path]::GetFullPath($gitRoot) -ne [IO.Path]::GetFullPath($RepositoryRoot)) {
    throw "Run this script from the LINE Smart Queue Assistant repository: $RepositoryRoot"
  }

  $gitSha = (Invoke-GitCapture -Arguments @('rev-parse', 'HEAD')).ToLowerInvariant()
  if ($gitSha -notmatch '^[0-9a-f]{40}$') {
    throw 'git rev-parse HEAD did not return a full 40-character SHA'
  }

  if (-not $AllowDirty) {
    $status = Invoke-GitCapture -Arguments @('status', '--porcelain', '--untracked-files=normal')
    if ($status) {
      throw 'Refusing to publish images from a dirty worktree. Commit the release or use -AllowDirty only for an explicit test.'
    }
  }

  if (-not $RegistryNamespace) {
    if ($env:DOCKERHUB_USERNAME) {
      $RegistryNamespace = "docker.io/$($env:DOCKERHUB_USERNAME)"
    } else {
      $RegistryNamespace = 'docker.io/trungnghia2703'
    }
  }
  $RegistryNamespace = $RegistryNamespace.TrimEnd('/')
  if ($RegistryNamespace -notmatch '^[A-Za-z0-9](?:[A-Za-z0-9._:/-]*[A-Za-z0-9])?$' -or
      $RegistryNamespace.Contains('//') -or $RegistryNamespace.Contains('..') -or
      $RegistryNamespace.Contains('@') -or
      $RegistryNamespace.Split('/')[-1].Contains(':')) {
    throw 'RegistryNamespace must be a registry/namespace without an image name, tag, or digest'
  }
  if (-not $LiffId) {
    throw 'LiffId is required because VITE_LIFF_ID is compiled into the immutable Web image'
  }
  if ($LiffId -notmatch '^[A-Za-z0-9._-]+$') {
    throw 'LiffId may contain only letters, numbers, dot, underscore, and hyphen'
  }
  if ($Platform -notmatch '^linux/[a-z0-9_/-]+$') {
    throw 'Platform must be a Linux Docker platform such as linux/amd64'
  }
  if (-not $DryRun -and -not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'docker is required unless -DryRun is used'
  }

  $releaseTag = "git-$gitSha"
  $apiRepository = "$RegistryNamespace/line-smart-queue-api"
  $webRepository = "$RegistryNamespace/line-smart-queue-web"
  $apiImage = "${apiRepository}:$releaseTag"
  $webImage = "${webRepository}:$releaseTag"
  $apiLatest = "${apiRepository}:latest"
  $webLatest = "${webRepository}:latest"

  Write-Output "Release tag: $releaseTag"
  Write-Output "API image: $apiImage"
  Write-Output "Web image: $webImage"
  if ($DryRun) {
    Write-Output 'Dry run: Docker commands are printed but not executed.'
  }

  Invoke-ReleaseCommand docker @(
    'build', '--platform', $Platform, '--target', 'runner',
    '--label', "org.opencontainers.image.revision=$gitSha",
    '--tag', $apiImage, '--tag', $apiLatest,
    '--file', 'docker/api/Dockerfile', '.'
  )
  Invoke-ReleaseCommand docker @(
    'build', '--platform', $Platform, '--target', 'runner',
    '--label', "org.opencontainers.image.revision=$gitSha",
    '--build-arg', 'VITE_API_URL=',
    '--build-arg', "VITE_LIFF_ID=$LiffId",
    '--build-arg', 'VITE_LIFF_ENDPOINT_PATH=/liff',
    '--build-arg', 'VITE_LIFF_MOCK=false',
    '--build-arg', 'VITE_PAYMENT_MODE=demo',
    '--build-arg', "VITE_SENTRY_RELEASE=$gitSha",
    '--tag', $webImage, '--tag', $webLatest,
    '--file', 'docker/web/Dockerfile', '.'
  )
  Invoke-ReleaseCommand docker @('push', $apiImage)
  Invoke-ReleaseCommand docker @('push', $webImage)
  Invoke-ReleaseCommand docker @('push', $apiLatest)
  Invoke-ReleaseCommand docker @('push', $webLatest)

  Write-Output "RELEASE_TAG=$releaseTag"
} finally {
  Pop-Location
}

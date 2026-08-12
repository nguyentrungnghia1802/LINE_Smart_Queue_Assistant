[CmdletBinding(PositionalBinding = $false)]
param(
  [string]$ImageNamespace = '',
  [string]$ApiImageRepository = '',
  [string]$WebImageRepository = '',
  [string]$LiffId = $env:VITE_LIFF_ID,
  [string]$Platform = '',
  [switch]$DryRun,
  [switch]$AllowDirty
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$DeployEnvFile = Join-Path $RepositoryRoot 'deploy/.env'
$DeployEnvExampleFile = Join-Path $RepositoryRoot 'deploy/.env.example'

function Invoke-GitCapture {
  param([Parameter(Mandatory)][string[]]$Arguments)

  $result = (& git -C $RepositoryRoot @Arguments | Out-String).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
  return $result
}

function Read-EnvironmentFileValue {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$Key
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return ''
  }

  $matchingLines = @(Get-Content -LiteralPath $Path | Where-Object {
    $_ -match "^$([regex]::Escape($Key))="
  })
  if ($matchingLines.Count -eq 0) {
    return ''
  }
  if ($matchingLines.Count -gt 1) {
    throw "Environment file contains duplicate $Key entries: $Path"
  }

  $value = ($matchingLines[0] -replace '^[^=]+=', '').Trim()
  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  return $value
}

function Resolve-ConfiguredRepository {
  param(
    [Parameter(Mandatory)][AllowEmptyString()][string]$ExplicitValue,
    [Parameter(Mandatory)][string]$EnvironmentKey,
    [Parameter(Mandatory)][string]$DeployKey,
    [Parameter(Mandatory)][string]$DefaultName,
    [Parameter(Mandatory)][AllowEmptyString()][string]$ResolvedNamespace
  )

  if ($ExplicitValue) {
    return $ExplicitValue
  }

  $environmentValue = [Environment]::GetEnvironmentVariable($EnvironmentKey)
  if ($environmentValue) {
    return $environmentValue
  }

  if ($ResolvedNamespace) {
    return "$ResolvedNamespace/$DefaultName"
  }

  foreach ($path in @($DeployEnvFile, $DeployEnvExampleFile)) {
    $configuredValue = Read-EnvironmentFileValue -Path $path -Key $DeployKey
    if ($configuredValue) {
      return $configuredValue
    }
  }

  throw "Unable to resolve $DeployKey. Configure it in deploy/.env or pass an image namespace/repository."
}

function Assert-ImageRepository {
  param(
    [Parameter(Mandatory)][string]$Repository,
    [Parameter(Mandatory)][string]$Label
  )

  if ($Repository -notmatch '^[A-Za-z0-9][A-Za-z0-9._:/-]*$' -or
      $Repository.Contains('//') -or $Repository.Contains('..') -or
      $Repository.Contains('@') -or $Repository.EndsWith('/') -or
      $Repository.Split('/')[-1].Contains(':')) {
    throw "$Label must be an untagged Docker image repository"
  }
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
    throw "The script must resolve the LINE Smart Queue Assistant repository: $RepositoryRoot"
  }

  $gitSha = (Invoke-GitCapture -Arguments @('rev-parse', 'HEAD')).ToLowerInvariant()
  if ($gitSha -notmatch '^[0-9a-f]{40}$') {
    throw 'Repository HEAD must resolve to a full lowercase Git SHA'
  }

  if (-not $AllowDirty) {
    $status = Invoke-GitCapture -Arguments @('status', '--porcelain', '--untracked-files=normal')
    if ($status) {
      throw 'Refusing to publish images from a dirty worktree. Commit the release first.'
    }
  }

  if (-not $ImageNamespace) {
    if ($env:IMAGE_NAMESPACE) {
      $ImageNamespace = $env:IMAGE_NAMESPACE
    } elseif ($env:DOCKERHUB_NAMESPACE) {
      $ImageNamespace = $env:DOCKERHUB_NAMESPACE
    } elseif ($env:DOCKERHUB_USERNAME) {
      $ImageNamespace = "docker.io/$($env:DOCKERHUB_USERNAME)"
    }
  }
  $ImageNamespace = $ImageNamespace.TrimEnd('/')

  $apiRepository = Resolve-ConfiguredRepository `
    -ExplicitValue $ApiImageRepository `
    -EnvironmentKey 'API_IMAGE_REPOSITORY' `
    -DeployKey 'LINE_QUEUE_API_REPOSITORY' `
    -DefaultName 'line-smart-queue-api' `
    -ResolvedNamespace $ImageNamespace
  $webRepository = Resolve-ConfiguredRepository `
    -ExplicitValue $WebImageRepository `
    -EnvironmentKey 'WEB_IMAGE_REPOSITORY' `
    -DeployKey 'LINE_QUEUE_WEB_REPOSITORY' `
    -DefaultName 'line-smart-queue-web' `
    -ResolvedNamespace $ImageNamespace
  Assert-ImageRepository -Repository $apiRepository -Label 'API image repository'
  Assert-ImageRepository -Repository $webRepository -Label 'Web image repository'

  if (-not $LiffId) {
    throw 'LiffId is required because VITE_LIFF_ID is compiled into the Web image'
  }
  if ($LiffId -notmatch '^[A-Za-z0-9._-]+$') {
    throw 'LiffId may contain only letters, numbers, dot, underscore, and hyphen'
  }

  if (-not $Platform) {
    $Platform = if ($env:DOCKER_PLATFORM) { $env:DOCKER_PLATFORM } else { 'linux/amd64' }
  }
  if ($Platform -notmatch '^linux/[a-z0-9_/-]+$') {
    throw 'Platform must be a Linux Docker platform such as linux/amd64'
  }
  if (-not $DryRun -and -not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'docker is required unless -DryRun is used'
  }

  $releaseTag = "git-$($gitSha.Substring(0, 12))"
  $apiImage = "${apiRepository}:$releaseTag"
  $webImage = "${webRepository}:$releaseTag"

  Write-Output "Release tag: $releaseTag"
  Write-Output "API image: $apiImage"
  Write-Output "Web image: $webImage"
  if ($DryRun) {
    Write-Output 'Dry run: Docker commands are printed but not executed.'
  }

  Invoke-ReleaseCommand docker @(
    'build', '--platform', $Platform, '--target', 'runner',
    '--label', "org.opencontainers.image.revision=$gitSha",
    '--tag', $apiImage,
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
    '--tag', $webImage,
    '--file', 'docker/web/Dockerfile', '.'
  )
  Invoke-ReleaseCommand docker @('push', $apiImage)
  Invoke-ReleaseCommand docker @('push', $webImage)

  Write-Output "DEPLOY_TAG=$releaseTag"
  Write-Output "API_IMAGE=$apiImage"
  Write-Output "WEB_IMAGE=$webImage"
  Write-Output "VPS_COMMAND=bash deploy/scripts/deploy.sh $releaseTag"
} finally {
  Pop-Location
}

[CmdletBinding(PositionalBinding = $false)]
param(
  [string]$ImageNamespace = '',
  [string]$ApiImageRepository = '',
  [string]$WebImageRepository = '',
  [string]$LiffId = '',
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
$CanonicalGhcrNamespace = 'ghcr.io/nguyentrungnghia1802'

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
    [Parameter(Mandatory)][AllowEmptyString()][string]$ResolvedNamespace,
    [Parameter(Mandatory)][bool]$PreferNamespace
  )

  if ($ExplicitValue) {
    return $ExplicitValue
  }

  $environmentValue = [Environment]::GetEnvironmentVariable($EnvironmentKey)
  if ($environmentValue) {
    return $environmentValue
  }

  if ($PreferNamespace -and $ResolvedNamespace) {
    return "$ResolvedNamespace/$DefaultName"
  }

  foreach ($path in @($DeployEnvFile, $DeployEnvExampleFile)) {
    $configuredValue = Read-EnvironmentFileValue -Path $path -Key $DeployKey
    if ($configuredValue) {
      return $configuredValue
    }
  }

  if ($ResolvedNamespace) {
    return "$ResolvedNamespace/$DefaultName"
  }

  throw "Unable to resolve $DeployKey. Configure it in deploy/.env or pass an image namespace/repository."
}

function Assert-ImageRepository {
  param(
    [Parameter(Mandatory)][string]$Repository,
    [Parameter(Mandatory)][string]$Label
  )

  if ($Repository -notmatch '^ghcr\.io/[a-z0-9][a-z0-9-]{0,38}/[a-z0-9][a-z0-9._-]{0,127}$') {
    throw "$Label must be an untagged lowercase GHCR repository (ghcr.io/<owner>/<name>)"
  }
}

function Resolve-DefaultGhcrNamespace {
  $remote = Invoke-GitCapture -Arguments @('remote', 'get-url', 'origin')
  $match = [regex]::Match($remote, '(?i)github\.com(?::|/)(?<owner>[A-Za-z0-9-]+)/')
  if ($match.Success) {
    return "ghcr.io/$($match.Groups['owner'].Value.ToLowerInvariant())"
  }
  return $CanonicalGhcrNamespace
}

function Assert-GhcrDockerAuthentication {
  if ($DryRun) {
    return
  }

  $dockerConfigDirectory = if ($env:DOCKER_CONFIG) {
    $env:DOCKER_CONFIG
  } else {
    Join-Path ([Environment]::GetFolderPath('UserProfile')) '.docker'
  }
  $dockerConfigFile = Join-Path $dockerConfigDirectory 'config.json'
  if (-not (Test-Path -LiteralPath $dockerConfigFile -PathType Leaf)) {
    throw 'Authenticate the Docker CLI to ghcr.io before publishing (docker login ghcr.io).'
  }

  try {
    $dockerConfig = Get-Content -LiteralPath $dockerConfigFile -Raw | ConvertFrom-Json
  } catch {
    throw 'The Docker CLI credential configuration is unreadable; run docker login ghcr.io again.'
  }
  if ($null -eq $dockerConfig) {
    throw 'The Docker CLI credential configuration is unreadable; run docker login ghcr.io again.'
  }

  $hasGhcrCredential = $false
  if ($dockerConfig.PSObject.Properties.Name -contains 'auths' -and $null -ne $dockerConfig.auths) {
    $hasGhcrCredential = @($dockerConfig.auths.PSObject.Properties.Name) -contains 'ghcr.io'
  }
  if (-not $hasGhcrCredential -and
      $dockerConfig.PSObject.Properties.Name -contains 'credHelpers' -and
      $null -ne $dockerConfig.credHelpers) {
    $hasGhcrCredential = @($dockerConfig.credHelpers.PSObject.Properties.Name) -contains 'ghcr.io'
  }
  if (-not $hasGhcrCredential -and
      $dockerConfig.PSObject.Properties.Name -contains 'credsStore' -and
      $dockerConfig.credsStore) {
    $hasGhcrCredential = $true
  }
  if (-not $hasGhcrCredential) {
    throw 'Authenticate the Docker CLI to ghcr.io before publishing (docker login ghcr.io).'
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

  $namespaceExplicit = [bool]$ImageNamespace
  if (-not $ImageNamespace -and $env:GHCR_NAMESPACE) {
    $ImageNamespace = $env:GHCR_NAMESPACE
    $namespaceExplicit = $true
  }
  if (-not $ImageNamespace) {
    $ImageNamespace = Resolve-DefaultGhcrNamespace
  }
  $ImageNamespace = $ImageNamespace.TrimEnd('/')

  $apiRepository = Resolve-ConfiguredRepository `
    -ExplicitValue $ApiImageRepository `
    -EnvironmentKey 'API_IMAGE_REPOSITORY' `
    -DeployKey 'LINE_QUEUE_API_REPOSITORY' `
    -DefaultName 'line-smart-queue-api' `
    -ResolvedNamespace $ImageNamespace `
    -PreferNamespace $namespaceExplicit
  $webRepository = Resolve-ConfiguredRepository `
    -ExplicitValue $WebImageRepository `
    -EnvironmentKey 'WEB_IMAGE_REPOSITORY' `
    -DeployKey 'LINE_QUEUE_WEB_REPOSITORY' `
    -DefaultName 'line-smart-queue-web' `
    -ResolvedNamespace $ImageNamespace `
    -PreferNamespace $namespaceExplicit
  Assert-ImageRepository -Repository $apiRepository -Label 'API image repository'
  Assert-ImageRepository -Repository $webRepository -Label 'Web image repository'

  if (-not $LiffId) {
    $LiffId = [Environment]::GetEnvironmentVariable('LINE_LOGIN_LIFF_ID')
  }
  if (-not $LiffId) {
    $LiffId = Read-EnvironmentFileValue -Path $DeployEnvFile -Key 'LINE_LOGIN_LIFF_ID'
  }
  if (-not $LiffId) {
    $LiffId = Read-EnvironmentFileValue -Path $DeployEnvExampleFile -Key 'LINE_LOGIN_LIFF_ID'
  }
  if (-not $LiffId -or $LiffId -like 'replace-with-*') {
    throw 'LIFF ID is required. Set LINE_LOGIN_LIFF_ID or configure it in deploy/.env.'
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
  Assert-GhcrDockerAuthentication

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
    '--label', "org.opencontainers.image.version=$releaseTag",
    '--label', 'org.opencontainers.image.source=https://github.com/nguyentrungnghia1802/LINE_Smart_Queue_Assistant',
    '--tag', $apiImage,
    '--file', 'docker/api/Dockerfile', '.'
  )
  Invoke-ReleaseCommand docker @(
    'build', '--platform', $Platform, '--target', 'runner',
    '--label', "org.opencontainers.image.revision=$gitSha",
    '--label', "org.opencontainers.image.version=$releaseTag",
    '--label', 'org.opencontainers.image.source=https://github.com/nguyentrungnghia1802/LINE_Smart_Queue_Assistant',
    '--build-arg', 'VITE_API_URL=',
    '--build-arg', "LINE_LOGIN_LIFF_ID=$LiffId",
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

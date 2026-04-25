param(
  [Parameter(Mandatory = $true)]
  [string]$DumpPath,

  [string]$EnvPath = ".env.cloud"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $scriptDir
. (Join-Path $scriptDir "db-env.ps1")

if (-not [System.IO.Path]::IsPathRooted($DumpPath)) {
  $DumpPath = Join-Path (Get-Location) $DumpPath
}

if (-not (Test-Path -LiteralPath $DumpPath)) {
  throw "Database dump file not found: $DumpPath"
}

if (-not [System.IO.Path]::IsPathRooted($EnvPath)) {
  $EnvPath = Join-Path $backendDir $EnvPath
}

$envValues = Read-EnvFile -Path $EnvPath
$defaults = New-MySqlClientDefaultsFile -Env $envValues

try {
  Write-Output "Importing database dump into target database..."
  Get-Content -LiteralPath $DumpPath -Raw | & mysql "--defaults-extra-file=$($defaults.Path)" $defaults.Database
  Write-Output "Database import completed."
} finally {
  Remove-TempDefaultsFile -Path $defaults.Path
}

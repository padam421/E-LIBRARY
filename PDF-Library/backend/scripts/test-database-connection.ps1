param(
  [string]$EnvPath = ".env.cloud"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $scriptDir
. (Join-Path $scriptDir "db-env.ps1")

if (-not [System.IO.Path]::IsPathRooted($EnvPath)) {
  $EnvPath = Join-Path $backendDir $EnvPath
}

$envValues = Read-EnvFile -Path $EnvPath
$defaults = New-MySqlClientDefaultsFile -Env $envValues

try {
  $query = "SELECT VERSION() AS mysql_version, DATABASE() AS database_name;"
  & mysql "--defaults-extra-file=$($defaults.Path)" $defaults.Database --batch --execute $query
  Write-Output "Database connection test completed."
} finally {
  Remove-TempDefaultsFile -Path $defaults.Path
}

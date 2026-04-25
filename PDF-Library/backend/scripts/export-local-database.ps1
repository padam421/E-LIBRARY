$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $scriptDir
$projectDir = Split-Path -Parent $backendDir
. (Join-Path $scriptDir "db-env.ps1")

$envPath = Join-Path $backendDir ".env"
$backupDir = Join-Path $projectDir "db-backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$envValues = Read-EnvFile -Path $envPath
$defaults = New-MySqlClientDefaultsFile -Env $envValues
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dumpPath = Join-Path $backupDir ("pdf-library-$timestamp.sql")

try {
  & mysqldump `
    "--defaults-extra-file=$($defaults.Path)" `
    --single-transaction `
    --quick `
    --routines `
    --triggers `
    --events `
    --default-character-set=utf8mb4 `
    $defaults.Database |
    Set-Content -LiteralPath $dumpPath -Encoding UTF8

  Write-Output "Database export completed."
  Write-Output "Backup file:"
  Write-Output $dumpPath
  Write-Output "Keep this file private. It may contain book records, user emails, Drive IDs, and admin activity."
} finally {
  Remove-TempDefaultsFile -Path $defaults.Path
}

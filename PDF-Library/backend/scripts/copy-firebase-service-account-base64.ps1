$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $scriptDir
$keyPath = Join-Path $backendDir "src\config\firebase-key.json"

if (-not (Test-Path -LiteralPath $keyPath)) {
  Write-Error "Firebase key file not found at: $keyPath"
}

$json = Get-Content -LiteralPath $keyPath -Raw
$base64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))

$base64 | Set-Clipboard

Write-Output "Firebase service account Base64 copied to clipboard."
Write-Output "Paste it only into your hosting provider environment variable named FIREBASE_SERVICE_ACCOUNT_BASE64."
Write-Output "Do not paste it into chat, GitHub, frontend files, or public code."

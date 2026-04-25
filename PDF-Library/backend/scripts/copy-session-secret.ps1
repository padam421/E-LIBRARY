$ErrorActionPreference = "Stop"

$bytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$secret = -join ($bytes | ForEach-Object { $_.ToString("x2") })

$secret | Set-Clipboard

Write-Output "A new production SESSION_TOKEN_SECRET was generated and copied to your clipboard."
Write-Output "Paste it only into your backend hosting environment variable named SESSION_TOKEN_SECRET."
Write-Output "Do not paste it into chat, GitHub, frontend files, screenshots, or public code."

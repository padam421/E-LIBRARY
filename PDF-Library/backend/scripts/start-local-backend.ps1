$ErrorActionPreference = "Stop"

$port = 3000
$healthUrl = "http://127.0.0.1:$port/api/health"

function Test-BackendHealth {
  try {
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

$listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

if ($listeners) {
  if (Test-BackendHealth) {
    Write-Host "Backend is already running on port $port. Do not start it again."
    Write-Host "Open the website normally; this is not an error."
    exit 0
  }

  Write-Host "Port $port is already in use, but the E-Library backend health check is not responding."
  Write-Host "Close the other app using port $port, or restart your computer, then run this command again."
  exit 1
}

Write-Host "Starting E-Library backend on port $port..."
node src/server.js

# bootstrap_v2.ps1 (PowerShell fixed)
$ErrorActionPreference = "Stop"

function Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Ok($m){ Write-Host "[OK]   $m" -ForegroundColor Green }

function FailIfLastExitCode($cmdName) {
  if ($LASTEXITCODE -ne 0) {
    throw "$cmdName failed with exit code: $LASTEXITCODE"
  }
}

function HasProjectLayout($path) {
  return (Test-Path (Join-Path $path "backend")) -and (Test-Path (Join-Path $path "frontend"))
}

# Resolve project root (handles nested)
$Here = Get-Location
if (HasProjectLayout $Here) { $ProjectRoot = $Here }
elseif (HasProjectLayout (Join-Path $Here "PDF-Library")) { $ProjectRoot = Join-Path $Here "PDF-Library" }
else { throw "Cannot find project root. Run from folder containing backend/ and frontend/." }

Info "Project root: $ProjectRoot"

# Ensure sql folder exists
$sqlDir = Join-Path $ProjectRoot "sql"
New-Item -ItemType Directory -Force -Path $sqlDir | Out-Null

# Ensure .env exists
$envPath = Join-Path $ProjectRoot ".env"
$envExamplePath = Join-Path $ProjectRoot ".env.example"
if (-not (Test-Path $envPath)) {
  if (Test-Path $envExamplePath) {
    Copy-Item $envExamplePath $envPath -Force
    Warn "Created .env from .env.example. Please edit DB_PASSWORD and JWT_SECRET."
  } else {
@"
NODE_ENV=development
PORT=8080
APP_BASE_URL=http://localhost:8080
JWT_SECRET=change_me_to_a_long_random_string
JWT_EXPIRES_IN=7d
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=pdf_library
REQUIRE_AUTH_FOR_PDF_ACCESS=true
"@ | Set-Content -Encoding UTF8 -Path $envPath -Force
    Warn "Created minimal .env. Please edit DB_PASSWORD and JWT_SECRET."
  }
} else {
  Ok ".env already exists."
}

# Parse DB_NAME safely (no Trim/Object[] issue)
$envText = Get-Content -Raw $envPath
$dbName = [regex]::Match($envText, '(?m)^\s*DB_NAME\s*=\s*(.+)\s*$').Groups[1].Value.Trim()
if (-not $dbName) { $dbName = "pdf_library" }
Info "DB_NAME: $dbName"

# Validate/Fix backend/package.json
$backendDir = Join-Path $ProjectRoot "backend"
$pkgJsonPath = Join-Path $backendDir "package.json"

if (-not (Test-Path $pkgJsonPath)) {
  throw "backend/package.json not found."
}

$pkgOk = $true
try {
  $raw = Get-Content -Raw $pkgJsonPath
  $null = $raw | ConvertFrom-Json
} catch {
  $pkgOk = $false
}

if (-not $pkgOk) {
  Warn "backend/package.json is invalid/empty. Auto-fixing it..."
@'
{
  "name": "pdf-library-backend",
  "version": "1.0.0",
  "private": true,
  "description": "PDF Library backend (Express + MySQL) serving a vanilla JS frontend.",
  "main": "src/server.js",
  "type": "commonjs",
  "scripts": {
    "dev": "nodemon",
    "start": "node src/server.js"
  },
  "dependencies": {
    "@google-cloud/storage": "^7.17.0",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "mysql2": "^3.11.5",
    "compression": "^1.7.4"
  },
  "devDependencies": {
    "nodemon": "^3.1.7"
  }
}
'@ | Set-Content -Encoding UTF8 -Path $pkgJsonPath -Force
  Ok "package.json fixed."
} else {
  Ok "package.json valid."
}

# Install backend deps
Info "Installing backend npm dependencies..."
Push-Location $backendDir
try {
  npm install
  FailIfLastExitCode "npm install"
  Ok "npm install done."
} finally {
  Pop-Location
}

# MySQL import (PowerShell-safe)
$mysqlCmd = Get-Command mysql -ErrorAction SilentlyContinue
$sqlSchema = Join-Path $sqlDir "001_schema.sql"
$sqlSeed = Join-Path $sqlDir "002_seed.sql"

if ($mysqlCmd -and (Test-Path $sqlSchema)) {
  Info "MySQL CLI found. Creating DB + importing schema..."
  & mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS $dbName CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
  FailIfLastExitCode "mysql create database"

  Get-Content -Raw $sqlSchema | & mysql -u root -p $dbName
  FailIfLastExitCode "mysql import schema"
  Ok "Schema imported."

  if (Test-Path $sqlSeed) {
    try {
      Get-Content -Raw $sqlSeed | & mysql -u root -p $dbName
      FailIfLastExitCode "mysql import seed"
      Ok "Seed imported."
    } catch {
      Warn "Seed skipped/failed (maybe duplicates)."
    }
  } else {
    Warn "Seed file not found: sql/002_seed.sql (skipping)."
  }
} else {
  Warn "mysql CLI not found OR sql/001_schema.sql missing. Skipping DB import."
  Warn "Make sure sql/001_schema.sql exists and has content."
}

# Start server only if backend/src/server.js exists and is non-empty
$serverJs = Join-Path $backendDir "src\server.js"
if (-not (Test-Path $serverJs)) {
  Warn "backend/src/server.js missing. Can't start server."
  exit 0
}

$serverRaw = Get-Content -Raw $serverJs -ErrorAction SilentlyContinue
if (-not $serverRaw -or $serverRaw.Trim().Length -lt 10) {
  Warn "backend/src/server.js is empty. Paste backend code first, then run: cd backend; npm run dev"
  exit 0
}

Info "Starting backend dev server (Ctrl+C to stop)..."
Push-Location $backendDir
try {
  npm run dev
} finally {
  Pop-Location
}

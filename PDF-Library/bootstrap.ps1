powershell -ExecutionPolicy Bypass -File .\bootstrap.ps1
# PDF Library - One-shot bootstrap (Windows PowerShell) - CORRECTED
# - Installs recommended VS Code extensions (if "code" CLI is available)
# - Creates .env if missing
# - Installs backend npm deps (+ compression)
# - Imports MySQL schema/seed using PowerShell-safe piping (NO '<' redirection)
# - Starts the dev server

$ErrorActionPreference = "Stop"

function Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Ok($m){ Write-Host "[OK]   $m" -ForegroundColor Green }

function HasProjectLayout($path) {
  return (Test-Path (Join-Path $path "backend")) -and (Test-Path (Join-Path $path "frontend"))
}

# 0) Resolve project root (handles nested PDF-Library\PDF-Library)
$Here = Get-Location
$ProjectRoot = $null

if (HasProjectLayout $Here) {
  $ProjectRoot = $Here
} elseif (HasProjectLayout (Join-Path $Here "PDF-Library")) {
  $ProjectRoot = Join-Path $Here "PDF-Library"
} else {
  throw "Cannot find project root. Run from folder containing backend/ and frontend/."
}

Info "Project root: $ProjectRoot"

# 1) (Optional) Install VS Code extensions (needs VS Code CLI 'code')
# 'code --install-extension <id>' installs extensions from CLI. [web:80]
$codeCmd = Get-Command code -ErrorAction SilentlyContinue
if ($codeCmd) {
  Info "Installing VS Code extensions (skip if already installed)..."
  $exts = @(
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "rangav.vscode-thunder-client",
    "cweijan.vscode-mysql-client2"
  )
  foreach ($e in $exts) {
    try { & code --install-extension $e --force | Out-Null; Ok "Extension: $e" }
    catch { Warn "Extension install skipped/failed: $e" }
  }
} else {
  Warn "VS Code 'code' CLI not found. Skipping extension installs."
}

# 2) Ensure .env exists at project root
$envPath = Join-Path $ProjectRoot ".env"
$envExamplePath = Join-Path $ProjectRoot ".env.example"

if (-not (Test-Path $envPath)) {
  if (Test-Path $envExamplePath) {
    Copy-Item $envExamplePath $envPath -Force
    Warn "Created .env from .env.example. Edit DB_PASSWORD and JWT_SECRET."
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
"@ | Set-Content -Path $envPath -Encoding UTF8 -Force
    Warn "Created minimal .env. Edit DB_PASSWORD and JWT_SECRET."
  }
} else {
  Ok ".env already exists (not overwritten)."
}

# 3) Install backend deps (+ compression)
$backendDir = Join-Path $ProjectRoot "backend"
$pkgJson = Join-Path $backendDir "package.json"
if (-not (Test-Path $pkgJson)) {
  throw "backend/package.json not found."
}

Info "Installing backend npm dependencies..."
Push-Location $backendDir
try {
  npm install | Out-Null
  npm install compression --save | Out-Null
  Ok "npm install completed."
} finally {
  Pop-Location
}

# 4) MySQL automation (PowerShell-safe import)
# In PowerShell, '< file.sql' redirection triggers errors; use piping instead. [web:162][web:93]
$mysqlCmd = Get-Command mysql -ErrorAction SilentlyContinue
$sqlSchema = Join-Path $ProjectRoot "sql\001_schema.sql"
$sqlSeed   = Join-Path $ProjectRoot "sql\002_seed.sql"

if ($mysqlCmd -and (Test-Path $sqlSchema)) {
  Info "MySQL CLI found. Running DB setup..."

  $envText = Get-Content $envPath -Raw
  $dbNameLine = ($envText -split "`n" | Where-Object { $_ -match "^DB_NAME=" } | Select-Object -First 1)
  $dbName = ($dbNameLine -replace "^DB_NAME=", "").Trim()
  if (-not $dbName) { $dbName = "pdf_library" }

  Warn "MySQL password prompt will appear now."
  & mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS $dbName CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;" | Out-Null

  Get-Content -Raw $sqlSchema | & mysql -u root -p $dbName | Out-Null
  Ok "Schema applied: $dbName"

  if (Test-Path $sqlSeed) {
    try {
      Get-Content -Raw $sqlSeed | & mysql -u root -p $dbName | Out-Null
      Ok "Seed applied."
    } catch {
      Warn "Seed skipped/failed (maybe duplicate rows)."
    }
  } else {
    Warn "Seed file not found: sql\002_seed.sql (skipping)."
  }
} else {
  Warn "mysql CLI not found OR sql\001_schema.sql missing. Skipping DB import."
}

# 5) Start dev server
Info "Starting backend dev server (Ctrl+C to stop)..."
Push-Location $backendDir
try {
  npm run dev
} finally {
  Pop-Location
}

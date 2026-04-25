function Read-EnvFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Environment file not found: $Path"
  }

  $values = @{}
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) {
      return
    }

    $separator = $line.IndexOf("=")
    if ($separator -lt 1) {
      return
    }

    $key = $line.Substring(0, $separator).Trim()
    $value = $line.Substring($separator + 1).Trim()

    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $values[$key] = $value
  }

  return $values
}

function Require-EnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Env,
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $value = [string]$Env[$Name]
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required value $Name in environment file."
  }

  return $value
}

function New-MySqlClientDefaultsFile {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Env
  )

  $hostValue = Require-EnvValue -Env $Env -Name "DB_HOST"
  $userValue = Require-EnvValue -Env $Env -Name "DB_USER"
  $nameValue = Require-EnvValue -Env $Env -Name "DB_NAME"
  $portValue = "3306"
  if ($Env.ContainsKey("DB_PORT") -and -not [string]::IsNullOrWhiteSpace([string]$Env["DB_PORT"])) {
    $portValue = [string]$Env["DB_PORT"]
  }

  $passwordValue = ""
  if ($Env.ContainsKey("DB_PASSWORD")) {
    $passwordValue = [string]$Env["DB_PASSWORD"]
  }

  $sslValue = "false"
  if ($Env.ContainsKey("DB_SSL")) {
    $sslValue = [string]$Env["DB_SSL"]
  }
  $sslEnabled = $sslValue.Trim().ToLowerInvariant() -eq "true"
  $sslCaPath = ""
  if ($Env.ContainsKey("DB_SSL_CA_PATH")) {
    $sslCaPath = [string]$Env["DB_SSL_CA_PATH"]
  }

  $filePath = Join-Path ([System.IO.Path]::GetTempPath()) ("elibrary-mysql-" + [Guid]::NewGuid().ToString("N") + ".cnf")
  $lines = @(
    "[client]",
    "host=$hostValue",
    "port=$portValue",
    "user=$userValue",
    "password=$passwordValue",
    "default-character-set=utf8mb4"
  )

  if ($sslEnabled) {
    if (-not [string]::IsNullOrWhiteSpace($sslCaPath)) {
      $lines += "ssl-mode=VERIFY_CA"
      $lines += "ssl-ca=$sslCaPath"
    } else {
      $lines += "ssl-mode=REQUIRED"
    }
  }

  Set-Content -LiteralPath $filePath -Value ($lines -join [Environment]::NewLine) -Encoding ASCII

  return @{
    Path = $filePath
    Database = $nameValue
  }
}

function Remove-TempDefaultsFile {
  param([string]$Path)

  if ($Path -and (Test-Path -LiteralPath $Path)) {
    Remove-Item -LiteralPath $Path -Force
  }
}

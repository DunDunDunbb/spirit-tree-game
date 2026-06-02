$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$webRoot = Join-Path $projectRoot "web-dist"
$pidFile = Join-Path $projectRoot "tmp\lan-web.pid"
$python = "C:\Users\DunDunDun\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

if (-not (Test-Path -LiteralPath $python)) {
  throw "Python runtime not found: $python"
}

if (-not (Test-Path -LiteralPath (Join-Path $webRoot "index.html"))) {
  throw "Web build not found. Run the web build first."
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $pidFile) | Out-Null

if (Test-Path -LiteralPath $pidFile) {
  $oldPid = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue
  if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
    Write-Output "LAN web server is already running. PID: $oldPid"
    exit 0
  }
}

$server = Start-Process -FilePath $python `
  -ArgumentList "-m", "http.server", "4173", "--bind", "0.0.0.0", "--directory", $webRoot `
  -WindowStyle Hidden `
  -PassThru

$server.Id | Set-Content -LiteralPath $pidFile
Start-Sleep -Seconds 2

$ipconfig = ipconfig
$localIp = [regex]::Matches(($ipconfig -join "`n"), "192\.168\.\d+\.\d+") |
  Select-Object -First 1 -ExpandProperty Value

if (-not $localIp) {
  $localIp = "<your-local-ip>"
}

Write-Output "LAN web server started. PID: $($server.Id)"
Write-Output "Share this URL with friends on the same Wi-Fi:"
Write-Output "http://${localIp}:4173/"

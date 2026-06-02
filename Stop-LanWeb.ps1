$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $projectRoot "tmp\lan-web.pid"

if (-not (Test-Path -LiteralPath $pidFile)) {
  Write-Output "LAN web server is not running."
  exit 0
}

$serverPid = Get-Content -LiteralPath $pidFile
$process = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
if ($process) {
  Stop-Process -Id $serverPid
  Write-Output "LAN web server stopped. PID: $serverPid"
} else {
  Write-Output "LAN web server was already stopped."
}

Remove-Item -LiteralPath $pidFile -ErrorAction SilentlyContinue

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$tmpDir = Join-Path $projectRoot "tmp"
$pidFile = Join-Path $tmpDir "public-web.pid"
$urlFile = Join-Path $tmpDir "public-web.url"

if (-not (Test-Path -LiteralPath $pidFile)) {
  Write-Output "Public web tunnel is not running."
  exit 0
}

$tunnelPid = Get-Content -LiteralPath $pidFile
$process = Get-Process -Id $tunnelPid -ErrorAction SilentlyContinue
if ($process) {
  Stop-Process -Id $tunnelPid
  Write-Output "Public web tunnel stopped. PID: $tunnelPid"
} else {
  Write-Output "Public web tunnel was already stopped."
}

Remove-Item -LiteralPath $pidFile, $urlFile -ErrorAction SilentlyContinue

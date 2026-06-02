$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $projectRoot "tmp\dev-server.pid"
$outLog = Join-Path $projectRoot "tmp\dev-server.out.log"
$errLog = Join-Path $projectRoot "tmp\dev-server.err.log"
$python = "C:\Users\DunDunDun\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

if (-not (Test-Path -LiteralPath $python)) {
  throw "Python runtime not found: $python"
}

powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $projectRoot "tools\build-preview.ps1")

if (Test-Path -LiteralPath $pidFile) {
  $oldPid = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue
  if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
    Write-Output "Development server is already running. PID: $oldPid"
    Write-Output "Open http://127.0.0.1:4173/"
    exit 0
  }
}

Remove-Item -LiteralPath $outLog, $errLog -ErrorAction SilentlyContinue
$commandLine = "start """" /b """ + $python + """ """ + (Join-Path $projectRoot "server\app.py") + """ 4173 """ + (Join-Path $projectRoot "tmp\dev-preview") + """"
& $env:ComSpec /c $commandLine
Start-Sleep -Seconds 2

try {
  $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:4173/api/health" -TimeoutSec 5
  if ($response.StatusCode -ne 200) { throw "Unexpected health status: $($response.StatusCode)" }
} catch {
  $serverPid = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue
  if ($serverPid) { Stop-Process -Id $serverPid -ErrorAction SilentlyContinue }
  Remove-Item -LiteralPath $pidFile -ErrorAction SilentlyContinue
  throw "Development server did not start."
}

$serverPid = Get-Content -LiteralPath $pidFile
Write-Output "Development server started. PID: $serverPid"
Write-Output "Open http://127.0.0.1:4173/"

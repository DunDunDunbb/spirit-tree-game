$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$tmpDir = Join-Path $projectRoot "tmp"
$pidFile = Join-Path $tmpDir "public-web.pid"
$urlFile = Join-Path $tmpDir "public-web.url"
$outLog = Join-Path $tmpDir "public-web.out.log"
$errLog = Join-Path $tmpDir "public-web.err.log"
$cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"

if (-not (Test-Path -LiteralPath $cloudflared)) {
  throw "cloudflared not found: $cloudflared"
}

New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

if (Test-Path -LiteralPath $pidFile) {
  $oldPid = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue
  $oldProcess = $oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)
  if ($oldProcess -and (Test-Path -LiteralPath $urlFile)) {
    Write-Output "Public web tunnel is already running. PID: $oldPid"
    Write-Output (Get-Content -LiteralPath $urlFile)
    exit 0
  }
}

Remove-Item -LiteralPath $outLog, $errLog, $urlFile -ErrorAction SilentlyContinue

$tunnel = Start-Process -FilePath $cloudflared `
  -ArgumentList "tunnel", "--protocol", "http2", "--url", "http://127.0.0.1:4173" `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog `
  -WindowStyle Hidden `
  -PassThru

$tunnel.Id | Set-Content -LiteralPath $pidFile

$publicUrl = $null
for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
  Start-Sleep -Seconds 1
  $logs = @()
  if (Test-Path -LiteralPath $outLog) {
    $logs += Get-Content -LiteralPath $outLog -Raw
  }
  if (Test-Path -LiteralPath $errLog) {
    $logs += Get-Content -LiteralPath $errLog -Raw
  }
  $match = [regex]::Match(($logs -join "`n"), "https://[a-z0-9-]+\.trycloudflare\.com")
  if ($match.Success) {
    $publicUrl = $match.Value
    break
  }
}

if (-not $publicUrl) {
  Stop-Process -Id $tunnel.Id -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $pidFile -ErrorAction SilentlyContinue
  throw "Tunnel URL was not created. Check $errLog"
}

$publicUrl | Set-Content -LiteralPath $urlFile
Write-Output "Temporary public web tunnel started. PID: $($tunnel.Id)"
Write-Output "Share this URL:"
Write-Output $publicUrl

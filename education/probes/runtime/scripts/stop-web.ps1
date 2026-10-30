# T00 probe — stop the isolated web profile started by run-web.ps1 and confirm the port is closed.
# Usage: pwsh -File stop-web.ps1 -Out <evidence dir>
param([Parameter(Mandatory = $true)][string]$Out)
$ErrorActionPreference = 'Continue'
$metaPath = Join-Path $Out 'web-meta.json'
if (-not (Test-Path $metaPath)) { Write-Output '{"stopped":false,"reason":"no web-meta.json"}'; exit 0 }
$meta = Get-Content $metaPath -Raw | ConvertFrom-Json
$result = [ordered]@{ pid = $meta.pid; port = $meta.port; stopped = $false }

$process = Get-Process -Id $meta.pid -ErrorAction SilentlyContinue
if ($process) {
  # Kill the probe tree only: the exact PID plus descendants of that PID.
  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$($meta.pid)" -ErrorAction SilentlyContinue
  foreach ($child in $children) { Stop-Process -Id $child.ProcessId -Force -ErrorAction SilentlyContinue }
  Stop-Process -Id $meta.pid -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 800
  $result.stopped = -not (Get-Process -Id $meta.pid -ErrorAction SilentlyContinue)
}

$probe = $null
try {
  $client = [System.Net.Sockets.TcpClient]::new()
  $task = $client.ConnectAsync('127.0.0.1', $meta.port)
  $probe = $task.Wait(1500) -and $client.Connected
  $client.Close()
} catch { $probe = $false }
$result.portStillOpen = [bool]$probe
$result | ConvertTo-Json | Out-File -Encoding utf8 (Join-Path $Out 'web-stop.json')
$result | ConvertTo-Json

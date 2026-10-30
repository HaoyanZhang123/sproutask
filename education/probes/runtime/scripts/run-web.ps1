# T00 probe 鈥?start the isolated web profile, wait for the ready URL, print one JSON line.
# Usage: pwsh -File run-web.ps1 -Home <DSH_HOME> -Work <workdir> -Out <evidence dir> [-Port N] [-WaitSeconds 30]
param(
  [Parameter(Mandatory = $true)][string]$DshHome,
  [Parameter(Mandatory = $true)][string]$Work,
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$Port = 0,
  [int]$WaitSeconds = 30,
  [string]$ProfileName = 'edu-web',
  [string[]]$ExtraArgs = @()
)
$ErrorActionPreference = 'Stop'
$probe = Split-Path -Parent $PSScriptRoot
$dshBin = Join-Path $probe 'node_modules/@deepseek-ai/dsh/lib/bin.js'
New-Item -ItemType Directory -Force -Path $Out, $Work | Out-Null

if ($Port -eq 0) {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $listener.Start()
  $Port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
  $listener.Stop()
}

# Isolated environment: no repository .env (cwd is the isolated work dir), no inherited
# DeepSeek/DSH variables, probe-owned DSH_HOME only.
$env:DSH_HOME = (Resolve-Path $DshHome).Path
$env:EDU_PROBE_LOG = Join-Path $Out 'llm.jsonl'
Get-ChildItem Env: | Where-Object { $_.Name -match '^(DEEPSEEK_|DSH_|ANTHROPIC_|OPENAI_)' } | ForEach-Object {
  Remove-Item -LiteralPath ("Env:" + $_.Name) -ErrorAction SilentlyContinue
}
$env:DSH_HOME = (Resolve-Path $DshHome).Path
$env:EDU_PROBE_LOG = Join-Path $Out 'llm.jsonl'

$stdout = Join-Path $Out 'stdout.log'
$stderr = Join-Path $Out 'stderr.log'
Remove-Item -LiteralPath $stdout, $stderr -ErrorAction SilentlyContinue
$proc = Start-Process -FilePath (Get-Command node).Source `
  -ArgumentList (@($dshBin, '--profile', $ProfileName, '--no-open', '--port', "$Port") + $ExtraArgs) `
  -WorkingDirectory $Work -RedirectStandardOutput $stdout -RedirectStandardError $stderr `
  -PassThru -WindowStyle Hidden
$startedAt = (Get-Date).ToString('o')

$url = $null
$deadline = (Get-Date).AddSeconds($WaitSeconds)
while ((Get-Date) -lt $deadline) {
  if ($proc.HasExited) { break }
  if (Test-Path $stdout) {
    $line = Get-Content $stdout -ErrorAction SilentlyContinue | Where-Object { $_ -match '^dsh web:' } | Select-Object -First 1
    if ($line) { $url = ($line -replace '^dsh web:\s*', '').Trim(); break }
  }
  Start-Sleep -Milliseconds 250
}

$meta = [ordered]@{
  pid = $proc.Id
  port = $Port
  host = '127.0.0.1'
  url = $url
  startedAt = $startedAt
  exited = $proc.HasExited
  exitCode = if ($proc.HasExited) { $proc.ExitCode } else { $null }
  stdout = $stdout
  stderr = $stderr
}
$meta | ConvertTo-Json -Depth 3 | Out-File -Encoding utf8 (Join-Path $Out 'web-meta.json')
$meta | ConvertTo-Json -Depth 3




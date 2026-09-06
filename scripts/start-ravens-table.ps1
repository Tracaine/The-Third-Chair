[CmdletBinding()]
param(
  [ValidateRange(1, 65534)]
  [int]$Port = 8787
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$privateDir = Join-Path $repoRoot "private"
$sourcePackPath = Join-Path $privateDir "source-pack.sqlite"
$campaignPath = Join-Path $privateDir "campaigns.sqlite"
$widgetPath = Join-Path $repoRoot "apps\widget\dist\index.html"
$runtimeDir = Join-Path $repoRoot "tmp\ravens-table"
$toolsDir = Join-Path $repoRoot "tmp\tools"
$tunnelClientPath = Join-Path $toolsDir "tunnel-client-runtime.exe"
$serverOutLog = Join-Path $runtimeDir "server.out.log"
$serverErrorLog = Join-Path $runtimeDir "server.error.log"
$tunnelOutLog = Join-Path $runtimeDir "tunnel.out.log"
$tunnelErrorLog = Join-Path $runtimeDir "tunnel.error.log"
$healthPort = $Port + 1

$serverProcess = $null
$tunnelProcess = $null

function Stop-ChildProcess([System.Diagnostics.Process]$Process) {
  if ($null -ne $Process -and -not $Process.HasExited) {
    Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
  }
}

function Wait-ForHealth([string]$Url, [int]$Seconds) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-RestMethod -Uri $Url -TimeoutSec 5
      if ($response.status -eq "ok") {
        return $true
      }
    } catch {
    }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Wait-ForTunnelReady([string]$Url, [int]$Seconds) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -eq 200) {
        return $true
      }
    } catch {
    }
    Start-Sleep -Milliseconds 500
  }
  return $null
}

function Get-DotEnvValue([string]$Name, [string]$Path) {
  if (-not (Test-Path $Path)) { return $null }
  $pattern = '^' + [regex]::Escape($Name) + '=.+$'
  $line = Get-Content $Path | Where-Object { $_ -match $pattern } | Select-Object -First 1
  if ($null -eq $line) { return $null }
  return $line.Substring($line.IndexOf("=") + 1).Trim().Trim('"').Trim("'")
}

try {
  $node = Get-Command node.exe -ErrorAction Stop
  $npm = Get-Command npm.cmd -ErrorAction Stop
  $nodeMajor = [int]((& $node.Source --version).TrimStart("v").Split(".")[0])
  if ($nodeMajor -ne 24) {
    throw "Third Chair requires Node 24; found Node $nodeMajor."
  }
  if (-not (Test-Path $sourcePackPath)) {
    throw "Private source pack not found at $sourcePackPath"
  }

  $envFile = Join-Path $repoRoot ".env"
  if ([string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)) {
    $env:OPENAI_API_KEY = Get-DotEnvValue "OPENAI_API_KEY" $envFile
  }
  if ([string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)) {
    throw "OPENAI_API_KEY is not configured in this PowerShell session or $envFile"
  }

  if ([string]::IsNullOrWhiteSpace($env:CONTROL_PLANE_TUNNEL_ID)) {
    $env:CONTROL_PLANE_TUNNEL_ID = Get-DotEnvValue "CONTROL_PLANE_TUNNEL_ID" $envFile
  }
  if ([string]::IsNullOrWhiteSpace($env:CONTROL_PLANE_TUNNEL_ID)) {
    $env:CONTROL_PLANE_TUNNEL_ID = (Read-Host "Paste the tunnel_id from OpenAI Platform Tunnels").Trim()
  }
  if ($env:CONTROL_PLANE_TUNNEL_ID -notmatch '^tunnel_[0-9a-f]{32}$') {
    throw "The OpenAI tunnel_id is not valid."
  }

  if ([string]::IsNullOrWhiteSpace($env:CONTROL_PLANE_API_KEY)) {
    $env:CONTROL_PLANE_API_KEY = Get-DotEnvValue "CONTROL_PLANE_API_KEY" $envFile
  }
  if ([string]::IsNullOrWhiteSpace($env:CONTROL_PLANE_API_KEY)) {
    $env:CONTROL_PLANE_API_KEY = $env:OPENAI_API_KEY
    Write-Host "Using OPENAI_API_KEY for the Secure MCP Tunnel connection."
  }
  if ([string]::IsNullOrWhiteSpace($env:CONTROL_PLANE_API_KEY)) {
    $secureRuntimeKey = Read-Host "Paste the OpenAI tunnel runtime API key" -AsSecureString
    $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureRuntimeKey)
    try {
      $env:CONTROL_PLANE_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
    }
  }
  if ([string]::IsNullOrWhiteSpace($env:CONTROL_PLANE_API_KEY)) {
    throw "The OpenAI tunnel runtime API key is required."
  }

  New-Item -ItemType Directory -Force -Path $runtimeDir, $toolsDir, $privateDir | Out-Null
  foreach ($log in @($serverOutLog, $serverErrorLog, $tunnelOutLog, $tunnelErrorLog)) {
    Remove-Item $log -Force -ErrorAction SilentlyContinue
  }

  Write-Host "Building Raven's Table widget..."
  & $npm.Source run build --workspace '@third-chair/widget'
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $widgetPath)) {
    throw "The Raven's Table widget did not build."
  }

  $env:PORT = [string]$Port
  $env:THIRD_CHAIR_HOST = "127.0.0.1"
  $env:THIRD_CHAIR_FAKE_MODE = "0"
  $env:THIRD_CHAIR_DATABASE = $campaignPath
  $env:THIRD_CHAIR_SOURCE_PACK_DATABASE = $sourcePackPath

  $serverArgs = @("--import", "tsx", "apps/server/src/main.ts")

  Write-Host "Starting the live Third Chair server..."
  $serverProcess = Start-Process -FilePath $node.Source -ArgumentList $serverArgs -WorkingDirectory $repoRoot -NoNewWindow -PassThru -RedirectStandardOutput $serverOutLog -RedirectStandardError $serverErrorLog
  if (-not (Wait-ForHealth "http://127.0.0.1:$Port/health" 45)) {
    throw "The local Third Chair server did not become healthy. See $serverErrorLog"
  }

  if (-not (Test-Path $tunnelClientPath)) {
    Write-Host "Downloading OpenAI Secure MCP Tunnel..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/openai/tunnel-client/releases/latest" -Headers @{ "User-Agent" = "third-chair-launcher" }
    $architecture = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "amd64" }
    $assetName = "tunnel-client-runtime-$($release.tag_name)-windows-$architecture.zip"
    $asset = $release.assets | Where-Object { $_.name -eq $assetName } | Select-Object -First 1
    if ($null -eq $asset) {
      throw "The current OpenAI tunnel release does not include $assetName"
    }
    $archivePath = Join-Path $runtimeDir $assetName
    $extractPath = Join-Path $runtimeDir "tunnel-client-download"
    Remove-Item $extractPath -Recurse -Force -ErrorAction SilentlyContinue
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $archivePath -UseBasicParsing
    Expand-Archive -Path $archivePath -DestinationPath $extractPath -Force
    $downloadedClient = Get-ChildItem $extractPath -Recurse -Filter "tunnel-client-runtime.exe" | Select-Object -First 1
    if ($null -eq $downloadedClient) {
      throw "The OpenAI tunnel archive did not contain tunnel-client-runtime.exe"
    }
    Copy-Item $downloadedClient.FullName $tunnelClientPath -Force
  }

  $env:MCP_SERVER_URL = "http://127.0.0.1:$Port/mcp"
  $env:HEALTH_LISTEN_ADDR = "127.0.0.1:$healthPort"
  Write-Host "Connecting Raven's Table through OpenAI Secure MCP Tunnel..."
  $tunnelProcess = Start-Process -FilePath $tunnelClientPath -ArgumentList @("run", "--log.level=info", "--log.format=struct-text") -WorkingDirectory $repoRoot -NoNewWindow -PassThru -RedirectStandardOutput $tunnelOutLog -RedirectStandardError $tunnelErrorLog
  if (-not (Wait-ForTunnelReady "http://127.0.0.1:$healthPort/readyz" 60)) {
    throw "OpenAI Secure MCP Tunnel did not become ready. See $tunnelErrorLog"
  }

  if (Get-Command Set-Clipboard -ErrorAction SilentlyContinue) {
    Set-Clipboard $env:CONTROL_PLANE_TUNNEL_ID
  }

  Write-Host ""
  Write-Host "Raven's Table is ready." -ForegroundColor Green
  Write-Host "OpenAI tunnel_id (copied to clipboard):" -ForegroundColor Cyan
  Write-Host $env:CONTROL_PLANE_TUNNEL_ID -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Leave this window open while playing. Press Ctrl+C to stop the table connection."
  Wait-Process -Id $tunnelProcess.Id
} catch {
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  if (Test-Path $serverErrorLog) {
    Write-Host "Last server messages:"
    Get-Content $serverErrorLog -Tail 20
  }
  if (Test-Path $tunnelErrorLog) {
    Write-Host "Last tunnel messages:"
    Get-Content $tunnelErrorLog -Tail 20
  }
  exit 1
} finally {
  Stop-ChildProcess $tunnelProcess
  Stop-ChildProcess $serverProcess
}

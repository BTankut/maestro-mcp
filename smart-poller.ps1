# Smart Poller - Sadece mesaj varsa komut gönderir
# Server'ı kontrol eder, mesaj varsa Codex'e iletir

Write-Host "Smart Auto-Poller" -ForegroundColor Green
Write-Host "=================" -ForegroundColor Green
Write-Host ""

# Configuration
$serverUrl = "http://localhost:3000/mcp"
$clientId = "codex-default"
$checkInterval = 10  # 10 saniye

# Codex'i başlat
Write-Host "Starting Codex..." -ForegroundColor Yellow
$codexCmd = Start-Process cmd -ArgumentList "/k", "codex" -PassThru
$global:codexPID = $codexCmd.Id
$global:lockedHandle = $null
Write-Host "Codex PID: $($global:codexPID)" -ForegroundColor Cyan

# SendKeys yükle
Add-Type -AssemblyName System.Windows.Forms

# Win32 API
if (-not ([System.Management.Automation.PSTypeName]'W32Smart').Type) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public class W32Smart {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);
}
"@
}

# Server'da mesaj var mı kontrol et
function Test-ServerMessages {
    try {
        $body = @{
            jsonrpc = "2.0"
            id = [guid]::NewGuid().ToString()
            method = "tools/call"
            params = @{
                name = "check_messages"
                arguments = @{
                    clientId = $clientId
                }
            }
        } | ConvertTo-Json -Depth 10

        $response = Invoke-RestMethod -Uri $serverUrl -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop

        # Response'u parse et
        $responseText = $response.result.content[0].text

        # hasMessages: true var mı kontrol et
        if ($responseText -match '"hasMessages"\s*:\s*true') {
            return $true
        }

        return $false
    } catch {
        Write-Host "Error checking server: $_" -ForegroundColor Red
        return $false
    }
}

Write-Host "Waiting for Codex window..." -ForegroundColor Yellow

# Codex penceresini bul
$attempts = 0
while ($attempts -lt 20 -and -not $global:lockedHandle) {
    Start-Sleep -Seconds 1
    $attempts++

    $windows = Get-Process | Where-Object {
        $_.MainWindowHandle -ne 0 -and
        ($_.MainWindowTitle -like "*codex*" -or
         $_.MainWindowTitle -like "*node*")
    }

    foreach ($win in $windows) {
        if ($win.MainWindowTitle -like "*codex*" -or
            $win.MainWindowTitle -like "*node*codex.js*") {
            $global:lockedHandle = $win.MainWindowHandle
            $global:codexPID = $win.Id
            Write-Host "Locked to Codex! Handle: $($global:lockedHandle)" -ForegroundColor Green
            break
        }
    }
}

Write-Host ""
Write-Host "Smart polling active - checking server every $checkInterval seconds" -ForegroundColor Green
Write-Host "Will only send command when messages are available" -ForegroundColor Cyan
Write-Host ""

# Ana döngü
while ($true) {
    $time = Get-Date -Format "HH:mm:ss"

    # Önce server'da mesaj var mı kontrol et
    Write-Host "[$time] Checking server for messages..." -ForegroundColor Gray
    $hasMessages = Test-ServerMessages

    if ($hasMessages) {
        Write-Host "[$time] Messages found! Sending command to Codex..." -ForegroundColor Green

        # Handle yoksa bul
        if (-not $global:lockedHandle) {
            $codexWin = Get-Process | Where-Object {
                $_.MainWindowHandle -ne 0 -and
                ($_.MainWindowTitle -like "*codex*" -or
                 $_.MainWindowTitle -like "*node*codex.js*")
            } | Select-Object -First 1

            if ($codexWin) {
                $global:lockedHandle = $codexWin.MainWindowHandle
                $global:codexPID = $codexWin.Id
            }
        }

        # Handle varsa komut gönder
        if ($global:lockedHandle -and [W32Smart]::IsWindow($global:lockedHandle)) {
            [W32Smart]::SetForegroundWindow($global:lockedHandle)
            Start-Sleep -Milliseconds 500

            [System.Windows.Forms.SendKeys]::SendWait("check_messages{ENTER}")
            Write-Host "[$time] Command sent to Codex!" -ForegroundColor Green
        } else {
            Write-Host "[$time] Codex window not available!" -ForegroundColor Red
            $global:lockedHandle = $null
        }
    } else {
        Write-Host "[$time] No messages, waiting..." -ForegroundColor Gray
    }

    # Bekleme süresi
    Start-Sleep -Seconds $checkInterval
}
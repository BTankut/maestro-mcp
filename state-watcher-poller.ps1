# State Watcher Poller - Mesajları TÜKETMEDEN izler
# system.json dosyasını okuyarak mesaj varlığını kontrol eder

Write-Host "State Watcher Auto-Poller" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green
Write-Host ""

# Configuration
$stateFile = "C:\Users\BT\CascadeProjects\Maestro-MCP\shared\state\system.json"
$clientId = "codex-default"
$checkInterval = 10  # 10 saniye
$lastMessageCount = 0

# Codex'i başlat
Write-Host "Starting Codex..." -ForegroundColor Yellow
$codexCmd = Start-Process cmd -ArgumentList "/k", "codex" -PassThru
$global:codexPID = $codexCmd.Id
$global:lockedHandle = $null
Write-Host "Codex PID: $($global:codexPID)" -ForegroundColor Cyan

# SendKeys yükle
Add-Type -AssemblyName System.Windows.Forms

# Win32 API
if (-not ([System.Management.Automation.PSTypeName]'W32State').Type) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public class W32State {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);
}
"@
}

# State dosyasından mesaj kontrolü
function Test-MessagesInState {
    try {
        if (Test-Path $stateFile) {
            $state = Get-Content $stateFile -Raw | ConvertFrom-Json

            # messageQueue içinde codex-default için mesaj var mı?
            if ($state.messageQueue) {
                $codexMessages = $state.messageQueue | Where-Object { $_.to -eq $clientId }

                if ($codexMessages -and $codexMessages.Count -gt 0) {
                    Write-Host "  Found $($codexMessages.Count) messages in queue" -ForegroundColor Gray
                    return $true
                }
            }
        }
        return $false
    } catch {
        Write-Host "  Error reading state file: $_" -ForegroundColor Red
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
Write-Host "State watcher active - checking state file every $checkInterval seconds" -ForegroundColor Green
Write-Host "Will NOT consume messages, only watch for their presence" -ForegroundColor Cyan
Write-Host ""

# Ana döngü
while ($true) {
    $time = Get-Date -Format "HH:mm:ss"

    # State dosyasını kontrol et (MESAJLARI TÜKETMEDEN!)
    Write-Host "[$time] Checking state file..." -ForegroundColor Gray
    $hasMessages = Test-MessagesInState

    if ($hasMessages) {
        Write-Host "[$time] Messages detected! Triggering Codex..." -ForegroundColor Green

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
        if ($global:lockedHandle -and [W32State]::IsWindow($global:lockedHandle)) {
            [W32State]::SetForegroundWindow($global:lockedHandle)
            Start-Sleep -Milliseconds 500

            # Codex'e check_messages gönder - CODEX mesajları alacak
            [System.Windows.Forms.SendKeys]::SendWait("check_messages{ENTER}")
            Write-Host "[$time] Triggered Codex to check messages!" -ForegroundColor Green

            # Biraz bekle ki Codex mesajları alsın
            Start-Sleep -Seconds 2
        } else {
            Write-Host "[$time] Codex window not available!" -ForegroundColor Red
            $global:lockedHandle = $null
        }
    } else {
        Write-Host "[$time] No messages in queue" -ForegroundColor Gray
    }

    # Bekleme süresi
    Start-Sleep -Seconds $checkInterval
}
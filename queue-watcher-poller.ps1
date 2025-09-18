# Queue Watcher Poller - Queue klasörünü izler
# Mesajları TÜKETMEDEN varlığını kontrol eder

Write-Host "Queue Watcher Auto-Poller" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green
Write-Host ""

# Configuration
$queueDir = "C:\Users\BT\CascadeProjects\Maestro-MCP\shared\queue"
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
if (-not ([System.Management.Automation.PSTypeName]'W32Queue').Type) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public class W32Queue {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);
}
"@
}

# Queue klasöründe mesaj kontrolü
function Test-MessagesInQueue {
    try {
        if (Test-Path $queueDir) {
            # Queue dosyalarını oku
            $queueFiles = Get-ChildItem -Path $queueDir -Filter "*.json" 2>$null

            foreach ($file in $queueFiles) {
                try {
                    $msg = Get-Content $file.FullName -Raw | ConvertFrom-Json

                    # codex-default için ve okunmamış mesaj mı?
                    if ($msg.to -eq $clientId -and $msg.read -eq $false) {
                        Write-Host "  Found unread message: $($msg.id)" -ForegroundColor Gray
                        return $true
                    }
                } catch {
                    # JSON parse hatası, devam et
                }
            }
        }
        return $false
    } catch {
        Write-Host "  Error checking queue: $_" -ForegroundColor Red
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
Write-Host "Queue watcher active - checking queue every $checkInterval seconds" -ForegroundColor Green
Write-Host "Will NOT consume messages, only watch for unread ones" -ForegroundColor Cyan
Write-Host ""

# Ana döngü
while ($true) {
    $time = Get-Date -Format "HH:mm:ss"

    # Queue klasörünü kontrol et
    Write-Host "[$time] Checking queue folder..." -ForegroundColor Gray
    $hasMessages = Test-MessagesInQueue

    if ($hasMessages) {
        Write-Host "[$time] Unread messages found! Triggering Codex..." -ForegroundColor Green

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
        if ($global:lockedHandle -and [W32Queue]::IsWindow($global:lockedHandle)) {
            [W32Queue]::SetForegroundWindow($global:lockedHandle)
            Start-Sleep -Milliseconds 500

            # Codex'e check_messages gönder
            [System.Windows.Forms.SendKeys]::SendWait("check_messages{ENTER}")
            Write-Host "[$time] Sent check_messages to Codex!" -ForegroundColor Green

            # Codex'in mesajı alması için bekle
            Start-Sleep -Seconds 2
        } else {
            Write-Host "[$time] Codex window not available!" -ForegroundColor Red
            $global:lockedHandle = $null
        }
    } else {
        Write-Host "[$time] No unread messages" -ForegroundColor Gray
    }

    # Bekleme süresi
    Start-Sleep -Seconds $checkInterval
}
# Wait-Handle Poller - Handle hazır olana kadar bekler
# Daha güvenilir başlangıç

Write-Host "Wait-Handle Auto-Poller" -ForegroundColor Green
Write-Host "=======================" -ForegroundColor Green
Write-Host ""

# Codex'i başlat
Write-Host "Starting Codex..." -ForegroundColor Yellow
$codexProcess = Start-Process cmd -ArgumentList "/k", "codex" -PassThru
$global:codexPID = $codexProcess.Id
Write-Host "Codex PID: $($global:codexPID)" -ForegroundColor Cyan

# Handle hazır olana kadar bekle
Write-Host "Waiting for Codex window to be ready..." -ForegroundColor Yellow
$maxWait = 30  # 30 saniye max bekle
$waited = 0

while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 1
    $waited++

    try {
        $proc = Get-Process -Id $global:codexPID -ErrorAction Stop
        if ($proc.MainWindowHandle -ne 0) {
            Write-Host "Codex window ready! (took $waited seconds)" -ForegroundColor Green
            break
        }
    } catch {
        Write-Host "Process not found?" -ForegroundColor Red
        break
    }

    if ($waited % 5 -eq 0) {
        Write-Host "Still waiting... ($waited seconds)" -ForegroundColor Gray
    }
}

# SendKeys yükle
Add-Type -AssemblyName System.Windows.Forms

# Win32 API
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class W32 {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@ -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Starting auto-polling - every 30 seconds" -ForegroundColor Green
Write-Host ""

# Ana döngü
while ($true) {
    $time = Get-Date -Format 'HH:mm:ss'

    try {
        # Process'i kontrol et
        $proc = Get-Process -Id $global:codexPID -ErrorAction Stop

        if ($proc.MainWindowHandle -ne 0) {
            Write-Host "[$time] Sending to Codex (Handle: $($proc.MainWindowHandle))..." -ForegroundColor Green

            [W32]::SetForegroundWindow($proc.MainWindowHandle)
            Start-Sleep -Milliseconds 500

            [System.Windows.Forms.SendKeys]::SendWait("check_messages{ENTER}")
            Write-Host "[$time] Command sent!" -ForegroundColor Green
        } else {
            Write-Host "[$time] Handle lost, searching..." -ForegroundColor Yellow

            # Codex pencerelerini ara
            $codexWindows = Get-Process | Where-Object {
                $_.MainWindowHandle -ne 0 -and
                ($_.MainWindowTitle -like "*codex*" -or
                 $_.MainWindowTitle -like "*node*codex.js*")
            }

            if ($codexWindows) {
                $newCodex = $codexWindows | Select-Object -First 1
                $global:codexPID = $newCodex.Id
                Write-Host "[$time] Found Codex window (new PID: $($global:codexPID))" -ForegroundColor Cyan
            }
        }
    } catch {
        Write-Host "[$time] Codex closed! Restarting..." -ForegroundColor Red
        $codexProcess = Start-Process cmd -ArgumentList "/k", "codex" -PassThru
        $global:codexPID = $codexProcess.Id
        Write-Host "[$time] New Codex PID: $($global:codexPID)" -ForegroundColor Cyan

        # Yeni pencere için bekle
        $waited = 0
        while ($waited -lt 15) {
            Start-Sleep -Seconds 1
            $waited++
            try {
                $proc = Get-Process -Id $global:codexPID -ErrorAction Stop
                if ($proc.MainWindowHandle -ne 0) {
                    Write-Host "[$time] New Codex ready!" -ForegroundColor Green
                    break
                }
            } catch { break }
        }
    }

    # 30 saniye bekle
    Write-Host "[$time] Next check in 30 seconds..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
}
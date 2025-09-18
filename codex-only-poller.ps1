# Codex-Only Poller - Sadece Codex'e gönderir!
# Claude veya başka pencerelere karışmaz

Write-Host "Codex-Only Auto-Poller" -ForegroundColor Green
Write-Host "======================" -ForegroundColor Green
Write-Host ""

# Codex'i başlat ve ID'sini sakla
Write-Host "Starting Codex..." -ForegroundColor Yellow
$codexProcess = Start-Process cmd -ArgumentList "/k", "codex" -PassThru
$global:codexPID = $codexProcess.Id
Write-Host "Codex started with PID: $($global:codexPID)" -ForegroundColor Cyan
Start-Sleep -Seconds 5

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

Write-Host "Polling active - ONLY for Codex window" -ForegroundColor Green
Write-Host ""

# Ana döngü
while ($true) {
    $time = Get-Date -Format 'HH:mm:ss'

    try {
        # Process'i ID ile bul - başlattığımız Codex'in ID'si
        $proc = Get-Process -Id $global:codexPID -ErrorAction Stop

        # Title kontrolü - SADECE bizim başlattığımız Codex
        if ($proc.MainWindowHandle -ne 0) {
            # Title'ı kontrol et
            $title = $proc.MainWindowTitle
            Write-Host "[$time] Window title: $title" -ForegroundColor Gray

            # Sadece codex.js içeren pencere
            if ($title -like "*codex.js*" -or $title -like "*codex*bin*") {
                Write-Host "[$time] Sending to Codex..." -ForegroundColor Green

                [W32]::SetForegroundWindow($proc.MainWindowHandle)
                Start-Sleep -Milliseconds 500

                [System.Windows.Forms.SendKeys]::SendWait("check_messages{ENTER}")
                Write-Host "[$time] Sent to Codex!" -ForegroundColor Green
            } else {
                Write-Host "[$time] Window is not Codex, skipping" -ForegroundColor Yellow
            }
        } else {
            Write-Host "[$time] No window handle for PID $($global:codexPID)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[$time] Codex process not found, restarting..." -ForegroundColor Red
        $codexProcess = Start-Process cmd -ArgumentList "/k", "codex" -PassThru
        $global:codexPID = $codexProcess.Id
        Write-Host "[$time] New Codex PID: $($global:codexPID)" -ForegroundColor Cyan
        Start-Sleep -Seconds 5
    }

    # 30 saniye bekle
    Write-Host "[$time] Waiting 30 seconds..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
}
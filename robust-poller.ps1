# Robust Poller - Başlık değişse bile çalışır
# Process ID takibi ile güvenilir çalışma

Write-Host "Robust Auto-Poller" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green
Write-Host ""

# Codex'i başlat ve ID'sini sakla
Write-Host "Starting Codex..." -ForegroundColor Yellow
$codexProcess = Start-Process cmd -ArgumentList "/k", "codex" -PassThru
$global:codexPID = $codexProcess.Id
Write-Host "Codex PID: $($global:codexPID)" -ForegroundColor Cyan
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

Write-Host "Polling active - every 30 seconds" -ForegroundColor Green
Write-Host ""

# Ana döngü
while ($true) {
    $time = Get-Date -Format 'HH:mm:ss'

    try {
        # Process'i ID ile bul
        $proc = Get-Process -Id $global:codexPID -ErrorAction Stop

        if ($proc.MainWindowHandle -ne 0) {
            Write-Host "[$time] Sending to Codex (PID: $($global:codexPID))..." -ForegroundColor Green

            [W32]::SetForegroundWindow($proc.MainWindowHandle)
            Start-Sleep -Milliseconds 500

            [System.Windows.Forms.SendKeys]::SendWait("check_messages{ENTER}")
            Write-Host "[$time] Sent!" -ForegroundColor Green
        } else {
            Write-Host "[$time] Process exists but no window handle" -ForegroundColor Yellow

            # Handle yoksa title'dan tekrar bul
            $newProc = Get-Process | Where-Object {
                $_.MainWindowTitle -like "*codex*" -or
                $_.MainWindowTitle -like "*node*"
            } | Select-Object -First 1

            if ($newProc) {
                $global:codexPID = $newProc.Id
                Write-Host "[$time] Found new handle (PID: $($global:codexPID))" -ForegroundColor Cyan
            }
        }
    } catch {
        Write-Host "[$time] Codex closed, restarting..." -ForegroundColor Red
        $codexProcess = Start-Process cmd -ArgumentList "/k", "codex" -PassThru
        $global:codexPID = $codexProcess.Id
        Write-Host "[$time] New Codex PID: $($global:codexPID)" -ForegroundColor Cyan
        Start-Sleep -Seconds 5
    }

    # 30 saniye bekle
    Write-Host "[$time] Next check in 30 seconds..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
}
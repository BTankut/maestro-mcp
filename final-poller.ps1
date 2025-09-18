# Final Auto-Poller - Codex'in gerçek başlığını kullanıyor
# Artık çalışıyor!

Write-Host "Final Auto-Poller - WORKING VERSION" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green
Write-Host ""

# Codex'i başlat
Write-Host "Starting Codex..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k", "codex"

Write-Host "Waiting 5 seconds for initialization..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# SendKeys için assembly yükle
Add-Type -AssemblyName System.Windows.Forms

Write-Host "Polling started - sending check_messages every 30 seconds" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Red
Write-Host ""

# Ana döngü
while ($true) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Looking for Codex window..." -ForegroundColor Cyan

    # Codex penceresini bul - gerçek başlığı kullan
    $codexProcess = Get-Process | Where-Object {
        $_.MainWindowHandle -ne 0 -and
        ($_.MainWindowTitle -like "*codex*" -or
         $_.MainWindowTitle -like "*node*codex.js*")
    } | Select-Object -First 1

    if ($codexProcess) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Found Codex! (PID: $($codexProcess.Id))" -ForegroundColor Green

        # Pencereyi aktif yap
        Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@ -ErrorAction SilentlyContinue

        [Win]::SetForegroundWindow($codexProcess.MainWindowHandle)
        Start-Sleep -Milliseconds 500

        # check_messages komutunu gönder
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Sending check_messages..." -ForegroundColor Green
        [System.Windows.Forms.SendKeys]::SendWait("check_messages")
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")

        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Command sent successfully!" -ForegroundColor Green
    } else {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Codex not found, retrying..." -ForegroundColor Yellow
    }

    # 30 saniye bekle
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Waiting 30 seconds..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
}
# Simple Working Poller - En basit çalışan versiyon
# Minimum kod, maksimum güvenilirlik

Write-Host "Simple Working Poller" -ForegroundColor Green
Write-Host "====================" -ForegroundColor Green
Write-Host ""

# Codex'i başlat
Write-Host "Starting Codex..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k", "codex"
Start-Sleep -Seconds 5

# SendKeys yükle
Add-Type -AssemblyName System.Windows.Forms

# Basit Win32 API
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class W32 {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@ -ErrorAction SilentlyContinue

Write-Host "Polling started" -ForegroundColor Green
Write-Host ""

# Ana döngü
while ($true) {
    $time = Get-Date -Format 'HH:mm:ss'

    # Codex penceresini bul
    $proc = Get-Process | Where-Object {
        $_.MainWindowTitle -like "*node*" -and
        $_.MainWindowTitle -like "*codex*"
    } | Select-Object -First 1

    if ($proc) {
        Write-Host "[$time] Found Codex, sending command..." -ForegroundColor Green

        # Pencereyi aktif yap ve komut gönder
        [W32]::SetForegroundWindow($proc.MainWindowHandle)
        Start-Sleep -Milliseconds 500

        [System.Windows.Forms.SendKeys]::SendWait("check_messages{ENTER}")
        Write-Host "[$time] Sent!" -ForegroundColor Green
    } else {
        Write-Host "[$time] Codex not found" -ForegroundColor Yellow
    }

    # 30 saniye bekle
    Write-Host "[$time] Waiting 30 seconds..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
}
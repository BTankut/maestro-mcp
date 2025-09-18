# Working Auto-Poller - Based on simple-test.ps1 approach
# Launches Codex and sends check_messages every 30 seconds

Write-Host "Working Auto-Poller" -ForegroundColor Green
Write-Host "===================" -ForegroundColor Green
Write-Host ""

# First launch Codex like in the working script
Write-Host "Starting Codex in new window..." -ForegroundColor Yellow
$codexProcess = Start-Process cmd -ArgumentList "/k", "codex" -PassThru

Write-Host "Waiting 5 seconds for Codex to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "Process ID: $($codexProcess.Id)" -ForegroundColor Cyan
Write-Host "Now sending 'check_messages' every 30 seconds" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Red
Write-Host ""

# SendKeys için assembly yükle
Add-Type -AssemblyName System.Windows.Forms

# SetForegroundWindow için Win32 API
if (-not ([System.Management.Automation.PSTypeName]'Win32API').Type) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32API {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
}

# Ana döngü
while ($true) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Sending check_messages to Codex..." -ForegroundColor Cyan

    try {
        # Process'i ID ile bul
        $proc = Get-Process -Id $codexProcess.Id -ErrorAction Stop

        if ($proc.MainWindowHandle -ne 0) {
            # Pencereyi öne getir
            [Win32API]::SetForegroundWindow($proc.MainWindowHandle)
            Start-Sleep -Milliseconds 500

            # check_messages komutunu gönder
            [System.Windows.Forms.SendKeys]::SendWait("check_messages")
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")

            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Command sent!" -ForegroundColor Green
        } else {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Window handle not available, retrying..." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Codex process not found. It may have been closed." -ForegroundColor Red
        Write-Host "Restarting Codex..." -ForegroundColor Yellow
        $codexProcess = Start-Process cmd -ArgumentList "/k", "codex" -PassThru
        Start-Sleep -Seconds 5
    }

    # 30 saniye bekle
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Waiting 30 seconds..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
}
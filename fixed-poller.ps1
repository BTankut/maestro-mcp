# Fixed Auto-Poller - Pencereyi başlıktan bulma
# Codex'i başlatır ve 30 saniyede bir check_messages gönderir

Write-Host "Fixed Auto-Poller" -ForegroundColor Green
Write-Host "=================" -ForegroundColor Green
Write-Host ""

# Codex'i başlat
Write-Host "Starting Codex..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k", "codex"

Write-Host "Waiting 5 seconds for initialization..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# SendKeys için assembly yükle
Add-Type -AssemblyName System.Windows.Forms

# SetForegroundWindow için Win32 API
if (-not ([System.Management.Automation.PSTypeName]'Win32Utils').Type) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Utils {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
}

Write-Host "Polling started - sending check_messages every 30 seconds" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Red
Write-Host ""

# Ana döngü
while ($true) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Looking for Codex window..." -ForegroundColor Cyan

    # Tüm cmd pencerelerini bul
    $cmdProcesses = Get-Process | Where-Object {
        $_.ProcessName -eq "cmd" -and $_.MainWindowHandle -ne 0
    }

    if ($cmdProcesses) {
        # En son açılan cmd penceresini al (muhtemelen Codex)
        $targetProcess = $cmdProcesses | Sort-Object StartTime -Descending | Select-Object -First 1

        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Found cmd window: PID $($targetProcess.Id)" -ForegroundColor Yellow

        # Pencereyi aktif yap
        [Win32Utils]::ShowWindow($targetProcess.MainWindowHandle, 9) # SW_RESTORE
        [Win32Utils]::SetForegroundWindow($targetProcess.MainWindowHandle)
        Start-Sleep -Milliseconds 500

        # Komutu gönder
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Sending check_messages..." -ForegroundColor Green
        [System.Windows.Forms.SendKeys]::SendWait("check_messages")
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")

        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Command sent!" -ForegroundColor Green
    } else {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] No cmd windows found with handle!" -ForegroundColor Red

        # Debug için tüm cmd processleri listele
        $allCmd = Get-Process | Where-Object { $_.ProcessName -eq "cmd" }
        Write-Host "All cmd processes:" -ForegroundColor Gray
        foreach ($proc in $allCmd) {
            Write-Host "  PID: $($proc.Id), Handle: $($proc.MainWindowHandle), Title: $($proc.MainWindowTitle)" -ForegroundColor Gray
        }
    }

    # 30 saniye bekle
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Waiting 30 seconds..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
}
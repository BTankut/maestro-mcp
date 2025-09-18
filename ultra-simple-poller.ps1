# Ultra Basit Auto-Poller
# Sadece her 30 saniyede bir Codex'e check_messages gönderir

Write-Host "Ultra Simple Auto-Poller" -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green
Write-Host ""
Write-Host "Bu script her 30 saniyede bir Codex penceresine 'check_messages' yazacak." -ForegroundColor Yellow
Write-Host "Mesaj olup olmadığına bakmaz, sadece komutu gönderir." -ForegroundColor Yellow
Write-Host ""
Write-Host "Codex'in açık olduğundan emin olun!" -ForegroundColor Red
Write-Host "Ctrl+C ile durdurun" -ForegroundColor Red
Write-Host ""

# SendKeys için assembly yükle
Add-Type -AssemblyName System.Windows.Forms

# Ana döngü
while ($true) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Sending check_messages to Codex..." -ForegroundColor Cyan

    # Codex penceresini bul
    $codexProcess = Get-Process | Where-Object { $_.MainWindowTitle -like "*codex*" } | Select-Object -First 1

    if ($codexProcess) {
        # Pencereyi öne getir
        if (-not ([System.Management.Automation.PSTypeName]'Win').Type) {
            Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
        }

        [Win]::SetForegroundWindow($codexProcess.MainWindowHandle)
        Start-Sleep -Milliseconds 500

        # check_messages komutunu gönder
        [System.Windows.Forms.SendKeys]::SendWait("check_messages")
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")

        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Command sent!" -ForegroundColor Green
    } else {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Codex window not found!" -ForegroundColor Red
    }

    # 30 saniye bekle
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Waiting 30 seconds..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
}
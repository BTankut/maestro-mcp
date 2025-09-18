# Basit test script - Sadece Codex'i başlatır ve her 5 saniyede check_messages gönderir

Write-Host "Simple Auto-Polling Test" -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green
Write-Host ""

# Codex'i yeni pencerede başlat
Write-Host "Starting Codex in new window..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k", "codex"

Write-Host "Waiting 5 seconds for Codex to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "Now I will send 'check_messages' every 10 seconds" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Red
Write-Host ""

# Basit loop
while ($true) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Checking for messages..." -ForegroundColor Gray

    # Server'a sadece varlık kontrolü için basit HTTP request at
    try {
        # Basit bir health check veya status endpoint'i kullan
        # Ya da check_messages'ı sadece varlık kontrolü için kullan ama mesajları okuma

        # Geçici çözüm: Server'daki system.json'dan aktif mesajları kontrol et
        $stateFile = "C:\Users\BT\CascadeProjects\Maestro-MCP\shared\state\system.json"
        if (Test-Path $stateFile) {
            $state = Get-Content $stateFile -Raw | ConvertFrom-Json
            # Basit kontrol: Dosya boyutu veya son değişiklik zamanı
            # Ama şimdilik check_messages kullanmadan direkt sinyal gönder
        }

        # HER ZAMAN mesaj varmış gibi davran (test için)
        # Gerçek implementasyonda dosya değişikliğini kontrol edebiliriz
        $hasMessages = $false

        # Alternatif: Basit bir GET isteği ile kontrol
        try {
            $checkUrl = "http://localhost:3000/health"
            $healthCheck = Invoke-WebRequest -Uri $checkUrl -Method Get -UseBasicParsing
            # Burada gerçek mesaj kontrolü yapılabilir
            # Şimdilik her 30 saniyede bir check_messages göndereceğiz

            # Rastgele kontrol - her 3 denemeden birinde mesaj varmış gibi yap
            $random = Get-Random -Maximum 3
            if ($random -eq 0) {
                $hasMessages = $true
            }
        } catch {
            # Server erişilemezse
        }

        if ($hasMessages) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Messages found! Sending check_messages to Codex window" -ForegroundColor Green

            # Codex penceresini bul ve aktif yap
            $codexProcess = Get-Process | Where-Object { $_.MainWindowTitle -like "*codex*" } | Select-Object -First 1
            if ($codexProcess) {
                # Pencereyi öne getir
                Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
                [Win]::SetForegroundWindow($codexProcess.MainWindowHandle)
                Start-Sleep -Milliseconds 500

                # check_messages komutunu gönder
                Add-Type -AssemblyName System.Windows.Forms
                [System.Windows.Forms.SendKeys]::SendWait("check_messages")
                [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")

                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Command sent!" -ForegroundColor Green
            }
        } else {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] No messages" -ForegroundColor Gray
        }
    } catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Error checking server: $_" -ForegroundColor Red
    }

    # 10 saniye bekle
    Start-Sleep -Seconds 10
}
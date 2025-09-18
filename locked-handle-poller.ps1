# Locked-Handle Poller - İlk bulduğu Codex'te kalır
# Handle değişse bile aynı process'i takip eder

Write-Host "Locked-Handle Auto-Poller" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green
Write-Host ""

# Codex'i başlat
Write-Host "Starting Codex..." -ForegroundColor Yellow
$codexProcess = Start-Process cmd -ArgumentList "/k", "codex" -PassThru
$global:codexPID = $codexProcess.Id
$global:lockedHandle = $null  # Handle'ı kilitleyeceğiz
Write-Host "Codex PID: $($global:codexPID)" -ForegroundColor Cyan

# 5 saniye bekle (test için azaltıldı)
Write-Host "Waiting 5 seconds for initialization..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# İlk handle'ı bul ve kilitle
try {
    $proc = Get-Process -Id $global:codexPID -ErrorAction Stop
    if ($proc.MainWindowHandle -ne 0) {
        $global:lockedHandle = $proc.MainWindowHandle
        Write-Host "Locked to Codex handle: $($global:lockedHandle)" -ForegroundColor Green
    }
} catch {}

# SendKeys yükle
Add-Type -AssemblyName System.Windows.Forms

# Win32 API
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class W32 {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);
}
"@ -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Auto-polling active - every 10 seconds (test mode)" -ForegroundColor Green
Write-Host "Locked to handle: $($global:lockedHandle)" -ForegroundColor Cyan
Write-Host ""

# Ana döngü
while ($true) {
    $time = Get-Date -Format 'HH:mm:ss'

    try {
        # Process hala var mı kontrol et
        $proc = Get-Process -Id $global:codexPID -ErrorAction Stop

        # İlk handle hala geçerli mi?
        if ($global:lockedHandle -and [W32]::IsWindow($global:lockedHandle)) {
            Write-Host "[$time] Using locked handle: $($global:lockedHandle)" -ForegroundColor Gray

            # KİLİTLİ HANDLE'I KULLAN - BAŞKA HANDLE ARAMA!
            [W32]::SetForegroundWindow($global:lockedHandle)
            Start-Sleep -Milliseconds 500

            [System.Windows.Forms.SendKeys]::SendWait("check_messages{ENTER}")
            Write-Host "[$time] Sent to locked Codex window!" -ForegroundColor Green

        } elseif ($proc.MainWindowHandle -ne 0) {
            # Eski handle kayıpsa, yeni handle'ı kilitle
            $global:lockedHandle = $proc.MainWindowHandle
            Write-Host "[$time] Re-locked to new handle: $($global:lockedHandle)" -ForegroundColor Yellow

            [W32]::SetForegroundWindow($global:lockedHandle)
            Start-Sleep -Milliseconds 500

            [System.Windows.Forms.SendKeys]::SendWait("check_messages{ENTER}")
            Write-Host "[$time] Sent to re-locked window!" -ForegroundColor Green

        } else {
            Write-Host "[$time] No valid handle available" -ForegroundColor Red
        }

    } catch {
        Write-Host "[$time] Codex process lost! Restarting..." -ForegroundColor Red
        $codexProcess = Start-Process cmd -ArgumentList "/k", "codex" -PassThru
        $global:codexPID = $codexProcess.Id
        $global:lockedHandle = $null
        Write-Host "[$time] New Codex PID: $($global:codexPID)" -ForegroundColor Cyan

        # Yeni pencere için 5 saniye bekle
        Start-Sleep -Seconds 5

        # Yeni handle'ı kilitle
        try {
            $proc = Get-Process -Id $global:codexPID -ErrorAction Stop
            if ($proc.MainWindowHandle -ne 0) {
                $global:lockedHandle = $proc.MainWindowHandle
                Write-Host "[$time] Locked to new handle: $($global:lockedHandle)" -ForegroundColor Green
            }
        } catch {}
    }

    # 10 saniye bekle (test için azaltıldı)
    Write-Host "[$time] Next check in 10 seconds..." -ForegroundColor Gray
    Start-Sleep -Seconds 10
}
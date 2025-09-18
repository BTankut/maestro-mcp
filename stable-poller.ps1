# Stable Auto-Poller - Process ID takip ediyor
# Tutarlı çalışması için optimize edildi

Write-Host "Stable Auto-Poller" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green
Write-Host ""

# Codex'i başlat ve process ID'sini sakla
Write-Host "Starting Codex and tracking process..." -ForegroundColor Yellow
$global:codexPID = $null

# Önce mevcut Codex process'ini ara
$existingCodex = Get-Process | Where-Object {
    $_.MainWindowHandle -ne 0 -and
    $_.MainWindowTitle -like "*codex*"
} | Select-Object -First 1

if ($existingCodex) {
    $global:codexPID = $existingCodex.Id
    Write-Host "Found existing Codex process: PID $($global:codexPID)" -ForegroundColor Cyan
} else {
    # Yeni Codex başlat
    $newProcess = Start-Process cmd -ArgumentList "/k", "codex" -PassThru
    $global:codexPID = $newProcess.Id
    Write-Host "Started new Codex process: PID $($global:codexPID)" -ForegroundColor Cyan
    Start-Sleep -Seconds 5
}

# SendKeys ve Win32 API yükle
Add-Type -AssemblyName System.Windows.Forms

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
}
"@ -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Auto-polling active - sending check_messages every 30 seconds" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Red
Write-Host ""

$retryCount = 0
$maxRetries = 3

# Ana döngü
while ($true) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Checking Codex process..." -ForegroundColor Cyan

    try {
        # Process'i ID ile bul
        $codexProcess = Get-Process -Id $global:codexPID -ErrorAction Stop

        # Handle kontrolü
        if ($codexProcess.MainWindowHandle -eq 0) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Process exists but no window handle, searching..." -ForegroundColor Yellow

            # Tüm process'leri tekrar tara
            $allCodex = Get-Process | Where-Object {
                $_.MainWindowHandle -ne 0 -and
                ($_.MainWindowTitle -like "*codex*" -or
                 $_.MainWindowTitle -like "*node*" -or
                 $_.ProcessName -eq "cmd")
            }

            foreach ($proc in $allCodex) {
                Write-Host "  Checking: $($proc.MainWindowTitle) (PID: $($proc.Id))" -ForegroundColor Gray
                if ($proc.MainWindowTitle -like "*codex*" -or $proc.MainWindowTitle -like "*node*codex*") {
                    $codexProcess = $proc
                    $global:codexPID = $proc.Id
                    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Updated to new Codex window: PID $($global:codexPID)" -ForegroundColor Green
                    break
                }
            }
        }

        if ($codexProcess.MainWindowHandle -ne 0) {
            # Pencere görünür mü kontrol et
            $isVisible = [Win32]::IsWindowVisible($codexProcess.MainWindowHandle)
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Window found - Visible: $isVisible" -ForegroundColor Gray

            # Pencereyi aktif yap
            [Win32]::ShowWindow($codexProcess.MainWindowHandle, 3) # SW_MAXIMIZE
            [Win32]::SetForegroundWindow($codexProcess.MainWindowHandle)
            Start-Sleep -Milliseconds 300

            # Komutu gönder
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Sending check_messages..." -ForegroundColor Green
            [System.Windows.Forms.SendKeys]::SendWait("check_messages")
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")

            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ✓ Command sent successfully!" -ForegroundColor Green
            $retryCount = 0
        } else {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] No valid window handle found" -ForegroundColor Yellow
            $retryCount++
        }

    } catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Process not found (PID: $($global:codexPID))" -ForegroundColor Red
        $retryCount++

        if ($retryCount -ge $maxRetries) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Restarting Codex..." -ForegroundColor Yellow
            $newProcess = Start-Process cmd -ArgumentList "/k", "codex" -PassThru
            $global:codexPID = $newProcess.Id
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] New Codex started: PID $($global:codexPID)" -ForegroundColor Green
            Start-Sleep -Seconds 5
            $retryCount = 0
        }
    }

    # Bekleme süresi
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Waiting 30 seconds..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
}
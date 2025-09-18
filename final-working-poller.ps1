# Final Working Poller - Temiz ve çalışan versiyon
# Handle kilitleme ile sadece Codex'e gönderir

Write-Host "Final Working Auto-Poller" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green
Write-Host ""

# Codex'i başlat
Write-Host "Starting Codex..." -ForegroundColor Yellow
$codexCmd = Start-Process cmd -ArgumentList "/k", "codex" -PassThru
$global:codexPID = $codexCmd.Id
$global:lockedHandle = $null
Write-Host "Codex CMD PID: $($global:codexPID)" -ForegroundColor Cyan

# SendKeys yükle
Add-Type -AssemblyName System.Windows.Forms

# Win32 API
if (-not ([System.Management.Automation.PSTypeName]'W32Lock').Type) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public class W32Lock {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);
}
"@
}

Write-Host "Waiting for Codex window..." -ForegroundColor Yellow

# Codex penceresini bul (max 20 saniye)
$attempts = 0
while ($attempts -lt 20 -and -not $global:lockedHandle) {
    Start-Sleep -Seconds 1
    $attempts++

    # Pencereleri ara
    $windows = Get-Process | Where-Object {
        $_.MainWindowHandle -ne 0 -and
        ($_.MainWindowTitle -like "*codex*" -or
         $_.MainWindowTitle -like "*node*")
    }

    foreach ($win in $windows) {
        if ($win.MainWindowTitle -like "*codex*" -or
            $win.MainWindowTitle -like "*node*codex.js*") {
            $global:lockedHandle = $win.MainWindowHandle
            $global:codexPID = $win.Id
            Write-Host "LOCKED! Handle: $($global:lockedHandle)" -ForegroundColor Green
            break
        }
    }
}

Write-Host ""
Write-Host "Polling every 10 seconds" -ForegroundColor Green
Write-Host ""

# Ana döngü
while ($true) {
    $time = Get-Date -Format "HH:mm:ss"

    if (-not $global:lockedHandle) {
        Write-Host "[$time] Searching Codex..." -ForegroundColor Yellow

        $codexWin = Get-Process | Where-Object {
            $_.MainWindowHandle -ne 0 -and
            ($_.MainWindowTitle -like "*codex*" -or
             $_.MainWindowTitle -like "*node*codex.js*")
        } | Select-Object -First 1

        if ($codexWin) {
            $global:lockedHandle = $codexWin.MainWindowHandle
            $global:codexPID = $codexWin.Id
            Write-Host "[$time] Found! Handle: $($global:lockedHandle)" -ForegroundColor Green
        } else {
            Write-Host "[$time] Not found" -ForegroundColor Red
            Start-Sleep -Seconds 10
            continue
        }
    }

    # Handle kontrolü
    if ([W32Lock]::IsWindow($global:lockedHandle)) {
        Write-Host "[$time] Sending to: $($global:lockedHandle)" -ForegroundColor Gray

        [W32Lock]::SetForegroundWindow($global:lockedHandle)
        Start-Sleep -Milliseconds 500

        [System.Windows.Forms.SendKeys]::SendWait("check_messages{ENTER}")
        Write-Host "[$time] Sent!" -ForegroundColor Green
    } else {
        Write-Host "[$time] Handle lost" -ForegroundColor Yellow
        $global:lockedHandle = $null
    }

    # 10 saniye bekle
    Write-Host "[$time] Waiting..." -ForegroundColor Gray
    Start-Sleep -Seconds 10
}
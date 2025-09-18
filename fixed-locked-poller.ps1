# Fixed Locked-Handle Poller
# Handle bulma ve kilitleme düzeltildi

Write-Host "Fixed Locked-Handle Poller" -ForegroundColor Green
Write-Host "==========================" -ForegroundColor Green
Write-Host ""

# Codex'i başlat
Write-Host "Starting Codex..." -ForegroundColor Yellow
$codexCmd = Start-Process cmd -ArgumentList "/k", "codex" -PassThru
$global:codexPID = $codexCmd.Id
$global:lockedHandle = $null
Write-Host "Codex CMD PID: $($global:codexPID)" -ForegroundColor Cyan

# SendKeys yükle
Add-Type -AssemblyName System.Windows.Forms

# Win32 API - ErrorAction ile type kontrolü
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

Write-Host "Waiting for Codex window to appear..." -ForegroundColor Yellow

# Handle bulana kadar bekle (max 20 saniye)
$attempts = 0
while ($attempts -lt 20 -and -not $global:lockedHandle) {
    Start-Sleep -Seconds 1
    $attempts++

    # Tüm pencereleri kontrol et
    $windows = Get-Process | Where-Object {
        $_.MainWindowHandle -ne 0 -and
        ($_.MainWindowTitle -like "*codex*" -or
         $_.MainWindowTitle -like "*node*")
    }

    foreach ($win in $windows) {
        Write-Host "  Found window: '$($win.MainWindowTitle)' (PID: $($win.Id), Handle: $($win.MainWindowHandle))" -ForegroundColor Gray

        # Codex penceresi mi?
        if ($win.MainWindowTitle -like "*codex*" -or $win.MainWindowTitle -like "*node*codex.js*") {
            $global:lockedHandle = $win.MainWindowHandle
            $global:codexPID = $win.Id
            Write-Host "LOCKED to Codex! Handle: $($global:lockedHandle), PID: $($global:codexPID)" -ForegroundColor Green
            break
        }
    }

    if ($attempts % 5 -eq 0) {
        Write-Host "Still searching... ($attempts seconds)" -ForegroundColor Yellow
    }
}

if (-not $global:lockedHandle) {
    Write-Host "WARNING: Could not find Codex window after 20 seconds!" -ForegroundColor Red
    Write-Host "Will keep trying during polling..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Auto-polling active - every 10 seconds" -ForegroundColor Green
if ($global:lockedHandle) {
    Write-Host "Locked to handle: $($global:lockedHandle)" -ForegroundColor Cyan
}
Write-Host ""

# Ana döngü
while ($true) {
    $time = Get-Date -Format 'HH:mm:ss'

    # Handle yoksa tekrar ara
    if (-not $global:lockedHandle) {
        Write-Host "[$time] Searching for Codex window..." -ForegroundColor Yellow

        $codexWin = Get-Process | Where-Object {
            $_.MainWindowHandle -ne 0 -and
            ($_.MainWindowTitle -like "*codex*" -or
             $_.MainWindowTitle -like "*node*codex.js*")
        } | Select-Object -First 1

        if ($codexWin) {
            $global:lockedHandle = $codexWin.MainWindowHandle
            $global:codexPID = $codexWin.Id
            Write-Host "[$time] Found and locked! Handle: $($global:lockedHandle)" -ForegroundColor Green
        } else {
            Write-Host "[$time] Still no Codex window found" -ForegroundColor Red
            Start-Sleep -Seconds 10
            continue
        }
    }

    # Handle geçerli mi kontrol et
    if ([W32Lock]::IsWindow($global:lockedHandle)) {
        Write-Host "[$time] Sending to locked handle: $($global:lockedHandle)" -ForegroundColor Gray

        [W32Lock]::SetForegroundWindow($global:lockedHandle)
        Start-Sleep -Milliseconds 500

        [System.Windows.Forms.SendKeys]::SendWait("check_messages{ENTER}")
        Write-Host "[$time] ✓ Command sent to Codex!" -ForegroundColor Green

    } else {
        Write-Host "[$time] Handle invalid, searching for new window..." -ForegroundColor Yellow
        $global:lockedHandle = $null
    }

    # 10 saniye bekle
    Write-Host "[$time] Next check in 10 seconds..." -ForegroundColor Gray
    Start-Sleep -Seconds 10
}
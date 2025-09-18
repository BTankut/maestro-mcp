# Windows Terminal Auto-Poller
# Windows Terminal'de yeni tab açar ve check_messages gönderir

Write-Host "Windows Terminal Auto-Poller" -ForegroundColor Green
Write-Host "============================" -ForegroundColor Green
Write-Host ""

# Windows Terminal var mı kontrol et
$wtExists = Get-Command wt -ErrorAction SilentlyContinue

if ($wtExists) {
    Write-Host "Starting Codex in Windows Terminal..." -ForegroundColor Yellow
    # Windows Terminal'de yeni tab aç
    Start-Process wt -ArgumentList "new-tab", "--title", "Codex", "cmd", "/k", "codex"
} else {
    Write-Host "Windows Terminal not found, using regular console..." -ForegroundColor Yellow
    # Normal konsol penceresi aç
    Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "title Codex && codex"
}

Write-Host "Waiting 5 seconds for initialization..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# SendKeys için assembly yükle
Add-Type -AssemblyName System.Windows.Forms

# Win32 API
if (-not ([System.Management.Automation.PSTypeName]'Win32Window').Type) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class Win32Window {
    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern int GetWindowTextLength(IntPtr hWnd);

    delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

    public static IntPtr FindWindowByTitle(string title) {
        IntPtr foundWindow = IntPtr.Zero;

        EnumWindows(delegate(IntPtr wnd, IntPtr param) {
            int length = GetWindowTextLength(wnd);
            if (length > 0) {
                StringBuilder sb = new StringBuilder(length + 1);
                GetWindowText(wnd, sb, sb.Capacity);
                string windowTitle = sb.ToString();

                if (windowTitle.Contains(title)) {
                    foundWindow = wnd;
                    return false; // Stop enumeration
                }
            }
            return true; // Continue enumeration
        }, IntPtr.Zero);

        return foundWindow;
    }
}
"@
}

Write-Host "Polling started - sending check_messages every 30 seconds" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Red
Write-Host ""

# Ana döngü
while ($true) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Looking for Codex window..." -ForegroundColor Cyan

    # Önce Windows Terminal'i bul
    $wtWindow = [Win32Window]::FindWindowByTitle("Windows Terminal")

    if ($wtWindow -ne [IntPtr]::Zero) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Found Windows Terminal" -ForegroundColor Green

        # Windows Terminal'i aktif yap
        [Win32Window]::ShowWindow($wtWindow, 9) # SW_RESTORE
        [Win32Window]::SetForegroundWindow($wtWindow)
        Start-Sleep -Milliseconds 500

        # Codex tab'ına geçmek için Ctrl+Tab gönder (birkaç kez)
        # veya direkt komut gönder - aktif tab Codex olmalı

        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Sending check_messages..." -ForegroundColor Green
        [System.Windows.Forms.SendKeys]::SendWait("check_messages")
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")

        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Command sent!" -ForegroundColor Green
    } else {
        # Normal konsol penceresi ara
        $codexWindow = [Win32Window]::FindWindowByTitle("Codex")

        if ($codexWindow -ne [IntPtr]::Zero) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Found Codex console window" -ForegroundColor Green

            [Win32Window]::ShowWindow($codexWindow, 9)
            [Win32Window]::SetForegroundWindow($codexWindow)
            Start-Sleep -Milliseconds 500

            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Sending check_messages..." -ForegroundColor Green
            [System.Windows.Forms.SendKeys]::SendWait("check_messages")
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")

            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Command sent!" -ForegroundColor Green
        } else {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Window not found!" -ForegroundColor Red

            # Debug için tüm pencereleri listele
            Write-Host "Looking for windows with 'cmd' or 'Codex'..." -ForegroundColor Gray

            # Process'leri de kontrol et
            $windowedProcesses = Get-Process | Where-Object {
                $_.MainWindowHandle -ne 0 -and
                ($_.MainWindowTitle -like "*cmd*" -or
                 $_.MainWindowTitle -like "*Codex*" -or
                 $_.MainWindowTitle -like "*Terminal*")
            }

            foreach ($proc in $windowedProcesses) {
                Write-Host "  Found: $($proc.MainWindowTitle) (PID: $($proc.Id))" -ForegroundColor Gray
            }
        }
    }

    # 30 saniye bekle
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Waiting 30 seconds..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
}
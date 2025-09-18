# Windows PowerShell Orchestrator for Maestro MCP
# Uses Windows Terminal or ConEmu for terminal management

param(
    [Parameter(Position=0)]
    [string]$Command = "help",

    [Parameter(Position=1)]
    [string]$SessionName = ""
)

# Configuration
$script:Sessions = @{}
$script:PollingJobs = @{}
$script:ServerUrl = "http://localhost:3000/mcp"

# Check if Windows Terminal is available
function Test-WindowsTerminal {
    try {
        Get-Command wt -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Launch TUI in Windows Terminal tab
function Start-TUISession {
    param(
        [string]$Name,
        [string]$Command,
        [string]$Role,
        [int]$PollInterval = 5000
    )

    Write-Host "Launching $Name..." -ForegroundColor Green

    if (Test-WindowsTerminal) {
        # Launch in Windows Terminal new tab
        $wtCommand = "new-tab --title `"Maestro-$Name`" cmd /k $Command"
        Start-Process wt -ArgumentList $wtCommand
    } else {
        # Launch in new console window
        Start-Process cmd -ArgumentList "/k", $Command -PassThru
    }

    # Store session info
    $script:Sessions[$Name] = @{
        Name = $Name
        Command = $Command
        Role = $Role
        PollInterval = $PollInterval
        LastPoll = $null
    }

    # Wait for initialization
    Start-Sleep -Seconds 3

    Write-Host "$Name launched as $Role" -ForegroundColor Green
}

# Send keystrokes to a window
function Send-CommandToTUI {
    param(
        [string]$SessionName,
        [string]$Command
    )

    # Find the window - Add type definition first
    if (-not ([System.Management.Automation.PSTypeName]'Win32').Type) {
        Add-Type @"
using System;
using System.Runtime.InteropServices;

public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
    }

    # Try to find window by title
    $windowTitle = "Maestro-$SessionName"
    $hwnd = [Win32]::FindWindow($null, $windowTitle)

    if ($hwnd -ne [IntPtr]::Zero) {
        [Win32]::SetForegroundWindow($hwnd)
        Start-Sleep -Milliseconds 100

        # Send the command using SendKeys
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait($Command)
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")

        Write-Host "Sent to ${SessionName}: $Command" -ForegroundColor Cyan
    } else {
        # Alternative: Use Windows.Forms SendKeys
        Add-Type -AssemblyName System.Windows.Forms

        # Get all processes and find our TUI
        $processes = Get-Process | Where-Object {
            $_.MainWindowTitle -like "*$SessionName*" -or
            $_.MainWindowTitle -like "*claude*" -or
            $_.MainWindowTitle -like "*codex*"
        }

        if ($processes) {
            $proc = $processes[0]
            $proc.CloseMainWindow() | Out-Null
            Start-Sleep -Milliseconds 100

            # Activate window
            if (-not ([System.Management.Automation.PSTypeName]'SFW').Type) {
                Add-Type @"
using System;
using System.Runtime.InteropServices;
public class SFW {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
            }

            [SFW]::SetForegroundWindow($proc.MainWindowHandle)

            # Send keystrokes
            [System.Windows.Forms.SendKeys]::SendWait($Command)
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")

            Write-Host "Sent to ${SessionName}: $Command" -ForegroundColor Cyan
        } else {
            Write-Warning "Could not find window for $SessionName"
        }
    }
}

# Check server for messages
function Test-ServerMessages {
    param([string]$ClientId)

    $body = @{
        jsonrpc = "2.0"
        id = [datetime]::Now.Ticks
        method = "tools/call"
        params = @{
            name = "check_messages"
            arguments = @{
                clientId = $ClientId
            }
        }
    } | ConvertTo-Json -Depth 10

    try {
        $response = Invoke-RestMethod -Uri $script:ServerUrl -Method Post -Body $body -ContentType "application/json"
        $responseText = $response.result.content[0].text
        return $responseText -match '"hasMessages":true'
    } catch {
        return $false
    }
}

# Start auto-polling for a session
function Start-AutoPolling {
    param([string]$SessionName)

    if (-not $script:Sessions.ContainsKey($SessionName)) {
        Write-Warning "Session $SessionName not found"
        return
    }

    $session = $script:Sessions[$SessionName]
    Write-Host "Starting auto-polling for $SessionName every $($session.PollInterval)ms" -ForegroundColor Yellow

    # Create a background job for polling
    $job = Start-Job -ScriptBlock {
        param($Name, $Interval, $ServerUrl)

        while ($true) {
            Start-Sleep -Milliseconds $Interval

            # Check for messages
            $body = @{
                jsonrpc = "2.0"
                id = [datetime]::Now.Ticks
                method = "tools/call"
                params = @{
                    name = "check_messages"
                    arguments = @{
                        clientId = $Name
                    }
                }
            } | ConvertTo-Json -Depth 10

            try {
                $response = Invoke-RestMethod -Uri $ServerUrl -Method Post -Body $body -ContentType "application/json"
                $responseText = $response.result.content[0].text

                if ($responseText -match '"hasMessages":true') {
                    # Return signal to send command
                    Write-Output "CHECK_NEEDED"
                }
            } catch {
                # Silent fail
            }
        }
    } -ArgumentList $SessionName, $session.PollInterval, $script:ServerUrl

    $script:PollingJobs[$SessionName] = $job

    # Monitor job output
    Register-ObjectEvent -InputObject $job -EventName StateChanged -Action {
        $jobOutput = Receive-Job -Job $Event.SourceEventArgs.Job
        if ($jobOutput -eq "CHECK_NEEDED") {
            Send-CommandToTUI -SessionName $using:SessionName -Command "check_messages"
            Write-Host "Triggered message check for $using:SessionName" -ForegroundColor Magenta
        }
    }
}

# Stop auto-polling
function Stop-AutoPolling {
    param([string]$SessionName)

    if ($script:PollingJobs.ContainsKey($SessionName)) {
        $job = $script:PollingJobs[$SessionName]
        Stop-Job -Job $job
        Remove-Job -Job $job
        $script:PollingJobs.Remove($SessionName)
        Write-Host "Stopped auto-polling for $SessionName" -ForegroundColor Red
    }
}

# List all sessions
function Show-Sessions {
    Write-Host "`nActive TUI Sessions:" -ForegroundColor Cyan
    foreach ($name in $script:Sessions.Keys) {
        $session = $script:Sessions[$name]
        Write-Host "   - $($session.Name): $($session.Role)" -ForegroundColor White
        if ($session.LastPoll) {
            Write-Host "     Last poll: $($session.LastPoll)" -ForegroundColor Gray
        }
    }
}

# Cleanup all sessions
function Stop-AllSessions {
    Write-Host "Cleaning up..." -ForegroundColor Yellow

    # Stop all polling jobs
    foreach ($name in $script:PollingJobs.Keys) {
        Stop-AutoPolling -SessionName $name
    }

    # Clear sessions
    $script:Sessions.Clear()

    Write-Host "Cleanup complete" -ForegroundColor Green
}

# Main command handler
switch ($Command) {
    "launch-claude" {
        Start-TUISession -Name "claude" -Command "claude-code" -Role "planner" -PollInterval 5000
        Start-AutoPolling -SessionName "claude"
    }

    "launch-codex" {
        Start-TUISession -Name "codex" -Command "codex" -Role "executor" -PollInterval 3000
        Start-AutoPolling -SessionName "codex"
    }

    "launch-all" {
        Start-TUISession -Name "claude" -Command "claude-code" -Role "planner" -PollInterval 5000
        Start-TUISession -Name "codex" -Command "codex" -Role "executor" -PollInterval 3000
        Start-AutoPolling -SessionName "claude"
        Start-AutoPolling -SessionName "codex"
        Write-Host "`nAll TUIs launched with auto-polling!" -ForegroundColor Green
        Show-Sessions
    }

    "send" {
        if (-not $SessionName) {
            Write-Warning "Please specify session name: send <name> <command>"
            break
        }
        $cmd = $args -join " "
        Send-CommandToTUI -SessionName $SessionName -Command $cmd
    }

    "list" {
        Show-Sessions
    }

    "cleanup" {
        Stop-AllSessions
    }

    default {
        Write-Host @"

Maestro MCP Windows Orchestrator
================================

Usage:
  .\windows-orchestrator.ps1 <command> [options]

Commands:
  launch-claude    Launch Claude Code with auto-polling
  launch-codex     Launch Codex TUI with auto-polling
  launch-all       Launch both TUIs with auto-polling
  send <name>      Send command to a session
  list            List all active sessions
  cleanup         Stop all sessions and cleanup

Examples:
  .\windows-orchestrator.ps1 launch-all
  .\windows-orchestrator.ps1 send claude "check_messages"
  .\windows-orchestrator.ps1 cleanup

"@ -ForegroundColor Cyan
    }
}
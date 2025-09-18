# Auto-Polling Solutions for Maestro MCP

This branch contains multiple approaches to solve the auto-polling limitation in MCP protocol.

## The Problem

MCP (Model Context Protocol) is request-response based and doesn't support server-initiated messages. This means TUI clients (Claude Code, Codex) cannot receive real-time notifications and must manually poll for messages.

## Solutions Implemented

### 1. 🐧 tmux Orchestrator (Linux/macOS/WSL)

The most elegant solution using tmux's `send-keys` feature to inject commands into TUI sessions.

**Files:**
- `tmux-orchestrator.ts` - TypeScript orchestrator managing tmux sessions

**Usage:**
```bash
# Install tmux first
sudo apt install tmux  # Ubuntu/Debian
brew install tmux      # macOS

# Launch all TUIs with auto-polling
ts-node tmux-orchestrator.ts launch-all

# Attach to a session to see it live
ts-node tmux-orchestrator.ts attach claude

# Cleanup
ts-node tmux-orchestrator.ts cleanup
```

**How it works:**
1. Launches TUIs in detached tmux sessions
2. Periodically checks server for messages
3. Uses `tmux send-keys` to inject `check_messages` command
4. Completely transparent to the TUI

### 2. 💻 Windows PowerShell Orchestrator

Windows-specific solution using SendKeys API.

**Files:**
- `windows-orchestrator.ps1` - PowerShell script for Windows

**Usage:**
```powershell
# Launch all TUIs
.\windows-orchestrator.ps1 launch-all

# Send manual command
.\windows-orchestrator.ps1 send claude "check_messages"

# Cleanup
.\windows-orchestrator.ps1 cleanup
```

**How it works:**
1. Launches TUIs in Windows Terminal tabs or console windows
2. Uses Windows SendKeys API to inject commands
3. Background jobs monitor server for messages

### 3. 🎮 AutoHotkey Solution (Windows)

Lightweight solution with GUI control.

**Files:**
- `maestro-auto-poll.ahk` - AutoHotkey script

**Usage:**
1. Install AutoHotkey v1.1
2. Double-click `maestro-auto-poll.ahk`
3. Use GUI buttons or F9/F10 hotkeys to toggle polling

**Features:**
- Visual GUI for control
- System tray integration
- Hotkey support (F9 for Claude, F10 for Codex)

## Comparison

| Solution | OS | Pros | Cons |
|----------|-----|------|------|
| tmux | Linux/macOS/WSL | Most reliable, truly transparent | Requires tmux |
| PowerShell | Windows | Native Windows solution | May have focus issues |
| AutoHotkey | Windows | Simple GUI, lightweight | Requires AutoHotkey install |

## Architecture

```
┌─────────────┐     HTTP Request      ┌──────────────┐
│ Orchestrator│ ──────────────────►   │  MCP Server  │
│   (tmux/    │ ◄──────────────────   │              │
│  PowerShell)│     Check Messages     └──────────────┘
└─────────────┘
       │
       │ send-keys / SendKeys
       ▼
┌─────────────┐
│   TUI CLI   │
│ (Claude/    │
│   Codex)    │
└─────────────┘
```

## Why These Solutions?

1. **No TUI modification required** - Works with existing CLIs
2. **No protocol changes** - Uses standard MCP tools
3. **Transparent to user** - Auto-polling happens in background
4. **Cross-platform** - Solutions for both Linux/macOS and Windows
5. **Configurable intervals** - Adjust polling frequency per client

## Limitations

- Still technically polling, not true push notifications
- Requires terminal control (tmux/SendKeys)
- May interfere if user is actively typing
- Window focus may be required for SendKeys

## Future Improvements

1. **WebSocket Branch** - True bidirectional communication
2. **MCP Extension Proposal** - Add SSE/WebSocket to MCP spec
3. **Browser-based TUI** - Web interface with WebSocket support
4. **Hook System** - If TUIs add plugin/hook support

## Testing

```bash
# 1. Start the MCP server
cd server && npm run http-server

# 2. Choose your solution:

# For Linux/macOS:
ts-node tmux-orchestrator.ts launch-all

# For Windows:
.\windows-orchestrator.ps1 launch-all
# OR
# Run maestro-auto-poll.ahk

# 3. Send a test message from one client to another
# The recipient should automatically receive it!
```

## Notes

- These solutions work around MCP's request-response limitation
- The tmux solution is the most reliable and recommended
- Windows solutions may need "Run as Administrator" for SendKeys
- Polling intervals can be adjusted in the scripts
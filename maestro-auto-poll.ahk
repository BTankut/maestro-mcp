; Maestro MCP Auto-Polling Script for Windows
; AutoHotkey v2 script that sends check_messages periodically

#NoEnv
#SingleInstance Force
SendMode Input
SetWorkingDir %A_ScriptDir%

; Configuration
global ClaudePollInterval := 5000  ; 5 seconds
global CodexPollInterval := 3000   ; 3 seconds
global ServerURL := "http://localhost:3000/mcp"

; Window titles to look for
global ClaudeWindowPattern := "ahk_exe claude-code.exe"
global CodexWindowPattern := "ahk_exe codex-tui.exe"

; Polling state
global ClaudePolling := false
global CodexPolling := false

; GUI for control
Gui, Add, Text,, Maestro MCP Auto-Poller
Gui, Add, Button, x10 y30 w100 h30 vBtnClaude gToggleClaude, Start Claude
Gui, Add, Button, x120 y30 w100 h30 vBtnCodex gToggleCodex, Start Codex
Gui, Add, Text, x10 y70 w210 vStatus, Status: Idle
Gui, Show, w230 h100, Maestro Auto-Poll

; Function to check server for messages
CheckServerMessages(clientId) {
    try {
        ; Create HTTP request
        WinHTTP := ComObjCreate("WinHTTP.WinHTTPRequest.5.1")
        WinHTTP.Open("POST", ServerURL, false)
        WinHTTP.SetRequestHeader("Content-Type", "application/json")

        ; Build JSON payload
        payload := "{""jsonrpc"":""2.0"",""id"":" . A_TickCount . ",""method"":""tools/call"",""params"":{""name"":""check_messages"",""arguments"":{""clientId"":""" . clientId . """}}}"

        WinHTTP.Send(payload)
        response := WinHTTP.ResponseText

        ; Check if response contains hasMessages:true
        if (InStr(response, """hasMessages"":true"))
            return true
    } catch {
        ; Silent fail
    }
    return false
}

; Function to send command to window
SendCommandToWindow(windowPattern, command) {
    if WinExist(windowPattern) {
        WinActivate
        Sleep, 100
        SendRaw, %command%
        Send, {Enter}
        return true
    }
    return false
}

; Claude polling timer
ClaudeTimer:
    if (CheckServerMessages("claude")) {
        if (SendCommandToWindow(ClaudeWindowPattern, "check_messages")) {
            GuiControl,, Status, Status: Sent to Claude
        }
    }
return

; Codex polling timer
CodexTimer:
    if (CheckServerMessages("codex")) {
        if (SendCommandToWindow(CodexWindowPattern, "check_messages")) {
            GuiControl,, Status, Status: Sent to Codex
        }
    }
return

; Toggle Claude polling
ToggleClaude:
    ClaudePolling := !ClaudePolling
    if (ClaudePolling) {
        SetTimer, ClaudeTimer, %ClaudePollInterval%
        GuiControl,, BtnClaude, Stop Claude
        GuiControl,, Status, Status: Claude polling ON
    } else {
        SetTimer, ClaudeTimer, Off
        GuiControl,, BtnClaude, Start Claude
        GuiControl,, Status, Status: Claude polling OFF
    }
return

; Toggle Codex polling
ToggleCodex:
    CodexPolling := !CodexPolling
    if (CodexPolling) {
        SetTimer, CodexTimer, %CodexPollInterval%
        GuiControl,, BtnCodex, Stop Codex
        GuiControl,, Status, Status: Codex polling ON
    } else {
        SetTimer, CodexTimer, Off
        GuiControl,, BtnCodex, Start Codex
        GuiControl,, Status, Status: Codex polling OFF
    }
return

; Hotkeys for manual control
F9::Gosub, ToggleClaude   ; F9 to toggle Claude polling
F10::Gosub, ToggleCodex    ; F10 to toggle Codex polling

; Exit handler
GuiClose:
ExitApp

; Tray menu
Menu, Tray, NoStandard
Menu, Tray, Add, Show GUI, ShowGUI
Menu, Tray, Add, Exit, GuiClose
Menu, Tray, Default, Show GUI

ShowGUI:
    Gui, Show
return
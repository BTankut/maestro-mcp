# Maestro MCP Architecture

## System Overview

Maestro MCP is a multi-client orchestration system that bridges the gap between STDIO-based MCP clients and enables them to collaborate through a shared HTTP server with automatic message delivery.

## Core Architecture

### Component Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Claude Code    │     │     Codex CLI   │     │   Other Clients │
│   (Planner)     │     │   (Executor)     │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │ STDIO                 │ STDIO                 │ STDIO
         ↓                       ↓                       ↓
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  STDIO Proxy    │     │  STDIO Proxy    │     │  STDIO Proxy    │
│    (index.ts)   │     │    (index.ts)   │     │    (index.ts)   │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │ HTTP                  │ HTTP                  │ HTTP
         ↓                       ↓                       ↓
┌──────────────────────────────────────────────────────────────────┐
│                      HTTP Server (Port 3000)                     │
│                      (http-server.ts)                            │
├───────────────────────────────────────────────────────────────────┤
│                        Orchestrator                              │
│                      (orchestrator.ts)                           │
├───────────────────────────────────────────────────────────────────┤
│                      Message Queue System                        │
│                     (message-queue.ts)                           │
└──────────────────────────────────────────────────────────────────┘
         │                       │                       │
         ↓                       ↓                       ↓
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  State Manager  │     │  Message Queue  │     │   Auto-Poller   │
│ (system.json)   │     │ (shared/queue/) │     │  (OS-specific)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Key Components

### 1. STDIO Proxy (`index.ts`)
- Bridges STDIO communication to HTTP
- Handles MCP protocol translation
- Auto-registers clients based on ID patterns
- Manages bidirectional message flow

### 2. HTTP Server (`http-server.ts`)
- Central orchestration endpoint
- RESTful API for MCP operations
- Message routing and distribution
- State synchronization

### 3. Orchestrator (`orchestrator.ts`)
- Task management and assignment
- Plan creation and distribution
- Client role management (planner/executor)
- Report collection and aggregation

### 4. Message Queue System (`message-queue.ts`)
- WhatsApp-style messaging between agents
- Persistent message storage
- Priority-based delivery
- Read/unread status tracking

### 5. Auto-Polling Service
Platform-specific implementations for automatic message delivery:

#### Windows (`queue-watcher-poller.ps1`)
- PowerShell script monitoring queue folder
- SendKeys API for command injection
- Handle locking to specific windows
- Non-consuming message detection

#### macOS/Linux (`tmux-orchestrator.ts`)
- tmux session management
- Automated command injection
- Terminal multiplexing
- Background polling threads

## Data Flow

### 1. Client Registration Flow
```
Client Start → Auto-detect ID → Register with Role → Update State
```

### 2. Message Delivery Flow
```
Send Message → Queue Storage → Auto-Poller Detects → Trigger check_messages → Client Receives
```

### 3. Task Orchestration Flow
```
Create Task → Assign to Planner → Create Plan → Distribute to Executors → Collect Reports
```

## File Structure

```
maestro-mcp/
├── server/
│   ├── src/
│   │   ├── index.ts           # STDIO proxy server
│   │   ├── http-server.ts     # HTTP orchestration server
│   │   ├── orchestrator.ts    # Core orchestration logic
│   │   ├── message-queue.ts   # Message queue management
│   │   └── types/
│   │       └── index.ts       # TypeScript type definitions
│   ├── dist/                   # Compiled JavaScript
│   └── package.json
├── shared/
│   ├── state/
│   │   └── system.json        # System state
│   └── queue/                 # Message queue storage
│       └── *.json             # Individual message files
├── tmux-orchestrator.ts       # macOS/Linux auto-polling
├── queue-watcher-poller.ps1   # Windows auto-polling
└── README.md
```

## State Management

### System State (`shared/state/system.json`)
```json
{
  "activeClients": [
    {
      "id": "string",
      "name": "string",
      "role": "planner | executor",
      "status": "active | inactive",
      "registeredAt": "ISO 8601"
    }
  ],
  "activeTasks": [...],
  "activePlans": [...]
}
```

### Message Format (`shared/queue/*.json`)
```json
{
  "id": "uuid",
  "type": "message | task | plan | report",
  "from": "clientId",
  "to": "clientId",
  "content": "string",
  "timestamp": "ISO 8601",
  "read": false,
  "priority": "low | medium | high | urgent"
}
```

## Auto-Registration Logic

Clients are automatically registered based on their ID patterns:

```typescript
// Auto-detect and register
if (clientId.includes('claude')) {
  role = 'planner';
} else if (clientId.includes('codex')) {
  role = 'executor';
}
```

## Polling Mechanism

### Queue Monitoring (Non-consuming)
1. Check `shared/queue/` for `.json` files
2. Parse each file for `to` field and `read` status
3. If unread message exists for client, trigger delivery
4. DO NOT modify or delete message files

### Command Injection
- **Windows**: Uses SendKeys API to inject `check_messages` command
- **macOS**: Uses tmux send-keys to inject commands into sessions

## Security Considerations

1. **File System Access**: Limited to `shared/` directory
2. **Message Privacy**: Messages stored as separate files
3. **Client Isolation**: Each client only receives its messages
4. **No Direct Execution**: Commands are suggestions, not executed directly

## Performance Optimizations

1. **Lazy Loading**: Messages loaded on-demand
2. **File Watching**: Efficient OS-level file monitoring
3. **Batch Operations**: Multiple messages processed together
4. **Caching**: Frequently accessed data cached in memory

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Messages Not Delivered
- Check queue folder permissions
- Verify client ID matches exactly
- Ensure `read: false` status
- Check auto-poller is running

#### 2. Auto-Poller Can't Find Window
- Verify window title contains expected pattern
- Check process is running with window handle
- Try restarting the client application

#### 3. Registration Failures
- Check server is running on port 3000
- Verify STDIO proxy configuration
- Check client ID format

#### 4. State Synchronization Issues
- Verify `shared/state/system.json` exists
- Check file permissions
- Look for JSON parsing errors

## Future Enhancements

1. **WebSocket Support**: Real-time bidirectional communication
2. **Database Backend**: Replace file-based storage
3. **Web Dashboard**: Visual monitoring and control
4. **Plugin System**: Extensible tool framework
5. **Cloud Deployment**: Multi-instance support
6. **Enhanced Security**: Authentication and encryption
7. **Performance Metrics**: Detailed analytics and monitoring

## Platform-Specific Notes

### Windows
- Requires PowerShell 5.1+
- SendKeys API for automation
- Window handle management critical

### macOS
- Requires tmux installation
- Terminal.app or iTerm2 compatible
- Homebrew for dependencies

### Linux
- Similar to macOS setup
- Additional terminal emulator support
- systemd service integration possible

---

For implementation details, see the source code and inline documentation.
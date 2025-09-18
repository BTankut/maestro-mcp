# Maestro MCP Orchestration System - Architecture & Implementation Guide

## Overview

Maestro MCP is a multi-client orchestration system that enables multiple MCP (Model Context Protocol) clients to collaborate through planner-executor roles. This system successfully connects different MCP clients (Claude Code, Codex CLI) to a shared HTTP server, enabling real-world orchestration scenarios.

## Architecture

### System Components

```
┌─────────────────┐     ┌─────────────────┐
│  Claude Code    │     │   Codex CLI     │
│  (MCP Client)   │     │  (MCP Client)   │
└────────┬────────┘     └────────┬────────┘
         │ STDIO                  │ STDIO
         │                        │
┌────────▼────────────────────────▼────────┐
│          STDIO-HTTP Proxy                │
│        (server/dist/index.js)            │
└────────────────────┬─────────────────────┘
                     │ HTTP
                     │
         ┌───────────▼───────────┐
         │    HTTP Server        │
         │  (localhost:3000)     │
         │  ┌─────────────────┐ │
         │  │  Orchestrator    │ │
         │  └─────────────────┘ │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │  File-based State     │
         │  (shared/*.json)      │
         └───────────────────────┘
```

### Key Design Decisions

1. **HTTP Server with STDIO Proxy**: MCP clients (Claude Code, Codex CLI) only support STDIO transport natively. We created a proxy that translates STDIO to HTTP, allowing multiple clients to share the same server instance.

2. **File-based State Management**: State is persisted in JSON files under `shared/` directory with file watchers for real-time updates.

3. **Asynchronous HTTP Health Checks**: The proxy starts immediately and checks HTTP server availability in the background to prevent initialization timeouts.

## Implementation Details

### Directory Structure

```
maestro-mcp/
├── server/
│   ├── src/
│   │   ├── index.ts          # STDIO-HTTP proxy
│   │   ├── http-server.ts    # HTTP server
│   │   ├── orchestrator.ts   # Orchestration logic
│   │   └── types/
│   │       └── index.ts      # TypeScript types
│   ├── dist/                 # Compiled JS files
│   ├── package.json
│   └── tsconfig.json
├── shared/                   # Shared state files
│   ├── clients/
│   ├── tasks/
│   ├── plans/
│   └── reports/
└── test-client.js           # Test client
```

### Core Files

#### 1. HTTP Server (`server/src/http-server.ts`)

The HTTP server runs on port 3000 and provides:
- RESTful MCP endpoints at `/mcp`
- Health check at `/health`
- Session management via `X-Session-Id` headers
- CORS support for cross-origin requests

```typescript
// Key endpoints
POST /mcp - Main MCP endpoint for JSON-RPC requests
GET /health - Health check endpoint
```

#### 2. STDIO-HTTP Proxy (`server/src/index.ts`)

**Critical component** that bridges STDIO-based MCP clients to the HTTP server:

```typescript
// Key features:
// 1. Immediate STDIO initialization to prevent timeouts
// 2. Background HTTP server health check
// 3. Request forwarding to HTTP server
// 4. Protocol version: 2024-11-05

server.setRequestHandler(InitializeRequestSchema, async (request) => {
  // Respond immediately to prevent timeout
  return {
    protocolVersion: '2024-11-05',
    capabilities: { tools: {}, resources: {} },
    serverInfo: { name: 'maestro-mcp', version: '1.0.0' }
  };
});
```

#### 3. Orchestrator (`server/src/orchestrator.ts`)

Manages the orchestration logic:
- Client registration (planner/executor roles)
- Task creation and assignment
- Plan creation and distribution
- Report collection
- File watchers for real-time state synchronization

### MCP Tools

The system provides 11 MCP tools:

1. `register_client` - Register a client with planner/executor role
2. `create_task` - Create new orchestration task
3. `assign_task` - Assign task to planner
4. `create_plan` - Create execution plan
5. `distribute_plan` - Distribute plan to executors
6. `submit_report` - Submit execution report
7. `get_task_status` - Get task status
8. `get_executor_reports` - Get execution reports
9. `list_clients` - List all registered clients
10. `list_tasks` - List all tasks
11. `list_plans` - List all plans

## Setup Instructions

### Prerequisites

- Node.js v22+ (for native fetch support)
- Windows 10/11 (tested on Windows)
- Claude Code and/or Codex CLI installed

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd maestro-mcp
```

2. Install dependencies:
```bash
cd server
npm install
```

3. Build TypeScript files:
```bash
npm run build
```

4. Create shared directories:
```bash
mkdir shared\clients shared\tasks shared\plans shared\reports
```

### Configuration

#### Claude Code Configuration (`~/.claude.json`)

```json
{
  "mcpServers": {
    "maestro-mcp": {
      "command": "node",
      "args": ["C:\\path\\to\\maestro-mcp\\server\\dist\\index.js"]
    }
  }
}
```

#### Codex CLI Configuration (`~/.codex/config.toml`)

**⚠️ CRITICAL CONFIGURATION FOR CODEX (Windows)**

```toml
model = "gpt-5-codex"

[mcp_servers.maestro-mcp]
command = "C:\\Program Files\\nodejs\\node.exe"
args = ["C:\\path\\to\\maestro-mcp\\server\\dist\\index.js"]
startup_timeout_ms = 30000

[mcp_servers.maestro-mcp.env]
APPDATA = "C:\\Users\\YOUR_USERNAME\\AppData\\Roaming"
LOCALAPPDATA = "C:\\Users\\YOUR_USERNAME\\AppData\\Local"
ProgramFiles = "C:\\Program Files"
SystemRoot = "C:\\Windows"
NODE_ENV = "production"
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Codex "Request Timed Out" Error

**Problem**: Codex CLI shows "MCP client for maestro-mcp failed to start: request timed out"

**Root Causes**:
1. MCP protocol requires immediate initialization response
2. Windows path handling with spaces (e.g., "Program Files")
3. Missing environment variables
4. Default 10-second timeout too short

**Solutions Applied**:

a. **Add initialization handler** in proxy:
```typescript
server.setRequestHandler(InitializeRequestSchema, async (request) => {
  // Immediate response prevents timeout
  return { protocolVersion: '2024-11-05', ... };
});
```

b. **Set startup timeout** in Codex config:
```toml
startup_timeout_ms = 30000  # 30 seconds
```

c. **Add Windows environment variables**:
```toml
[mcp_servers.maestro-mcp.env]
APPDATA = "C:\\Users\\USERNAME\\AppData\\Roaming"
LOCALAPPDATA = "C:\\Users\\USERNAME\\AppData\\Local"
ProgramFiles = "C:\\Program Files"
SystemRoot = "C:\\Windows"
```

d. **Use full Node.exe path** to avoid PATH issues:
```toml
command = "C:\\Program Files\\nodejs\\node.exe"
```

#### 2. Multiple Server Instances Problem

**Problem**: Each MCP client spawns its own server instance with STDIO transport

**Solution**: HTTP server + STDIO proxy architecture allows shared state

#### 3. Path Issues on Windows

**Problem**: Backslash escaping and spaces in paths

**Solution**: Use double backslashes and full paths:
```toml
args = ["C:\\Users\\BT\\CascadeProjects\\Maestro-MCP\\server\\dist\\index.js"]
```

### Debugging Tips

1. **Check HTTP server health**:
```bash
curl http://localhost:3000/health
```

2. **Test proxy manually**:
```bash
cd server
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05"},"id":1}' | node dist/index.js
```

3. **Monitor logs**: The proxy writes debug messages to stderr

## Usage Examples

### 1. Starting the System

```bash
# Terminal 1: Start HTTP server
cd server
npm run http-server

# Terminal 2: Claude Code will auto-start proxy via MCP
# Terminal 3: Codex CLI will auto-start proxy via MCP
```

### 2. Orchestration Workflow

1. **Register Clients**:
```javascript
// Claude as Planner
register_client({ clientName: "Claude-Planner", role: "planner" })

// Codex as Executor
register_client({ clientName: "Codex-Executor", role: "executor" })
```

2. **Create and Assign Task**:
```javascript
// Create task
create_task({
  description: "Create a Python calculator",
  requirements: ["Add basic operations", "Include tests"]
})

// Assign to planner
assign_task({ taskId: "...", plannerId: "..." })
```

3. **Create and Distribute Plan**:
```javascript
// Planner creates plan
create_plan({
  taskId: "...",
  plannerId: "...",
  steps: [
    { description: "Create file" },
    { description: "Implement functions" }
  ]
})

// Distribute to executor
distribute_plan({
  planId: "...",
  assignments: { "executor-id": ["step-1", "step-2"] }
})
```

4. **Submit Reports**:
```javascript
submit_report({
  planId: "...",
  stepId: "...",
  executorId: "...",
  status: "success"
})
```

## Performance Considerations

1. **Startup Time**: Proxy initializes immediately, HTTP check is async
2. **File Watchers**: Chokidar monitors shared state files
3. **Keep-alive**: Heartbeat every 60 seconds prevents process termination
4. **Timeout Settings**: 30-second startup timeout for Windows compatibility

## Security Notes

- HTTP server has CORS enabled (`*`) for development
- No authentication implemented (add for production)
- File-based state is world-readable (secure in production)

## Future Improvements

1. **Native HTTP Transport**: When MCP SDK supports HTTP transport
2. **WebSocket Support**: For real-time bidirectional communication
3. **Authentication**: JWT or API key authentication
4. **Database Backend**: Replace file-based state with database
5. **Web Dashboard**: Visual orchestration monitoring

## Conclusion

This architecture successfully bridges the gap between STDIO-only MCP clients and a shared HTTP server, enabling true multi-client orchestration. The key innovations are:

1. STDIO-HTTP proxy pattern
2. Asynchronous initialization to prevent timeouts
3. Proper Windows environment configuration for Codex
4. File-based state sharing with real-time watchers

The system has been tested with Claude Code and Codex CLI on Windows, successfully demonstrating planner-executor orchestration patterns.

## References

- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [MCP Error 32001 Fix Guide](https://mcpcat.io/guides/fixing-mcp-error-32001-request-timeout/)
- [Codex CLI GitHub Issues](https://github.com/openai/codex/issues)

---

**Note**: This system was developed to solve the specific challenge of connecting multiple MCP clients that only support STDIO transport to a shared orchestration server. The STDIO-HTTP proxy pattern can be adapted for other similar use cases.
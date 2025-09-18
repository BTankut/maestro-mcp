# Maestro MCP - Multi-Client Orchestration System

A sophisticated orchestration system for the Model Context Protocol (MCP) that enables multiple MCP clients to collaborate through planner-executor patterns with automatic message delivery and shared state management.

## 🌟 Features

- **Multi-Client Orchestration**: Connect multiple MCP clients (Claude Code, Codex CLI) to a shared server
- **Automatic Message Polling**: Auto-delivery of messages to CLI tools without manual intervention
- **Planner-Executor Pattern**: Organize clients into planners and executors for complex task workflows
- **STDIO-HTTP Proxy**: Bridge STDIO-only MCP clients to a shared HTTP server
- **Real-time State Synchronization**: File-based state management with automatic watchers
- **Message Queue System**: Persistent message queue with automatic delivery
- **WhatsApp-style Messaging**: Send messages between agents with priority levels
- **Auto-Registration**: Clients automatically register based on their ID patterns
- **15+ Orchestration Tools**: Complete set of tools for task creation, planning, execution, and messaging

## 📋 Prerequisites

- Node.js v22+ (for native fetch support)
- Windows 10/11 (tested), macOS/Linux (compatible)
- Claude Code and/or Codex CLI
- PowerShell (Windows) or tmux (macOS/Linux) for auto-polling

## 🚀 Quick Start

### Windows Installation

1. **Clone the repository**:
```bash
git clone https://github.com/BTankut/maestro-mcp.git
cd maestro-mcp
```

2. **Install dependencies**:
```bash
cd server
npm install
```

3. **Build the TypeScript files**:
```bash
npm run build
```

4. **Create shared directories**:
```bash
mkdir -p shared/state shared/queue
echo {} > shared/state/system.json
```

5. **Start the HTTP server**:
```bash
npm run http-server
```

6. **Start auto-polling (Windows)**:
```powershell
# In a new PowerShell window
.\queue-watcher-poller.ps1
```

### macOS Installation

1. **Clone the repository**:
```bash
git clone https://github.com/BTankut/maestro-mcp.git
cd maestro-mcp
```

2. **Install dependencies**:
```bash
cd server
npm install
```

3. **Build the TypeScript files**:
```bash
npm run build
```

4. **Create shared directories**:
```bash
mkdir -p shared/state shared/queue
echo '{}' > shared/state/system.json
```

5. **Install tmux** (if not installed):
```bash
brew install tmux
```

6. **Start the orchestrator with tmux**:
```bash
# Start server
cd server && npm run http-server &

# Start tmux orchestrator (in another terminal)
npx tsx ../tmux-orchestrator.ts
```

## ⚙️ Configuration

### Claude Code (`~/.claude.json`)

```json
{
  "mcpServers": {
    "maestro-mcp": {
      "command": "node",
      "args": ["/path/to/maestro-mcp/server/dist/index.js"]
    }
  }
}
```

### Codex CLI (`~/.codex/config.toml`)

#### Windows
```toml
model = "gpt-4"

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

#### macOS
```toml
model = "gpt-4"

[mcp_servers.maestro-mcp]
command = "/usr/local/bin/node"
args = ["/path/to/maestro-mcp/server/dist/index.js"]
startup_timeout_ms = 30000

[mcp_servers.maestro-mcp.env]
HOME = "/Users/YOUR_USERNAME"
PATH = "/usr/local/bin:/usr/bin:/bin"
NODE_ENV = "production"
```

## 🏗️ Architecture

The system uses a unique STDIO-HTTP proxy architecture with automatic message delivery:

```
Claude Code → STDIO → Proxy → HTTP Server ← Proxy ← STDIO ← Codex CLI
                                    ↓
                            Message Queue System
                                    ↓
                            Auto-Polling Service
```

### Key Components:

1. **HTTP Server**: Central orchestration server (`http-server.ts`)
2. **Message Queue**: Persistent message storage in `shared/queue/`
3. **Auto-Poller**: Platform-specific polling service
   - Windows: PowerShell script (`queue-watcher-poller.ps1`)
   - macOS/Linux: tmux orchestrator (`tmux-orchestrator.ts`)
4. **State Management**: File-based state in `shared/state/system.json`

For detailed architecture information, see [ARCHITECTURE.md](ARCHITECTURE.md).

## 🛠️ Available Tools

### Core Orchestration Tools
1. `register_client` - Register a client with planner/executor role
2. `create_task` - Create new orchestration task
3. `assign_task` - Assign task to planner
4. `create_plan` - Create execution plan
5. `distribute_plan` - Distribute plan to executors
6. `submit_report` - Submit execution report
7. `get_task_status` - Get task status
8. `get_executor_reports` - Get execution reports

### Listing Tools
9. `list_clients` - List all registered clients
10. `list_tasks` - List all tasks
11. `list_plans` - List all plans

### Messaging Tools (WhatsApp-style)
12. `check_messages` - Check for new messages
13. `send_message` - Send message to another agent
14. `set_typing` - Set typing indicator
15. `start_auto_poll` - Enable automatic message checking

### Quick Registration Tools
16. `register_as_planner` - Quick registration as planner
17. `register_as_executor` - Quick registration as executor
18. `switch_role` - Switch between planner/executor roles
19. `whoami` - Get current registration info

## 🚀 Auto-Polling Setup

### Windows (PowerShell)

The auto-polling script monitors the message queue and automatically triggers message delivery:

```powershell
# Start auto-polling
.\queue-watcher-poller.ps1

# The script will:
# - Start Codex automatically
# - Check for messages every 10 seconds
# - Send check_messages command when new messages arrive
# - NOT consume messages (only trigger delivery)
```

### macOS/Linux (tmux)

The tmux orchestrator manages terminal sessions and auto-polling:

```bash
# Start tmux orchestrator
npx tsx tmux-orchestrator.ts

# Commands:
# launch-claude - Launch Claude Code with auto-polling
# launch-codex - Launch Codex with auto-polling
# send <session> <command> - Send command to session
# list - List all sessions
```

## 📖 Usage Example

1. **Start the system**:
   ```bash
   # Terminal 1: Start server
   cd server && npm run http-server

   # Terminal 2: Start auto-polling (Windows)
   .\queue-watcher-poller.ps1
   # OR for macOS:
   npx tsx tmux-orchestrator.ts
   ```

2. **Open TUIs** (Claude Code and Codex will auto-register)

3. **Send messages between agents**:
   ```javascript
   // From Claude
   send_message({ to: "codex-default", content: "Please execute this task" })

   // Messages are delivered automatically!
   ```

## 🐛 Troubleshooting

### Auto-Polling Issues

**Windows:**
- Ensure PowerShell execution policy allows scripts
- Check that Codex window title contains "codex" or "node"
- Verify queue directory exists at `shared/queue/`

**macOS:**
- Install tmux: `brew install tmux`
- Ensure Node.js has proper permissions
- Check tmux session with: `tmux ls`

### Message Delivery Issues

- Check queue folder for `.json` files
- Verify messages have `read: false` status
- Ensure client IDs match (e.g., "codex-default")
- Check server logs for registration confirmations

For detailed troubleshooting, see [ARCHITECTURE.md](ARCHITECTURE.md#troubleshooting-guide).

## 📚 Documentation

- [Architecture & Implementation Guide](ARCHITECTURE.md) - Detailed system architecture
- [Auto-Polling Solutions](AUTO-POLLING-SOLUTIONS.md) - Platform-specific polling implementations
- [Development Plan](DEVELOPMENT_PLAN.md) - Future enhancements and roadmap
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP specification

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on the [Model Context Protocol](https://modelcontextprotocol.io)
- Inspired by distributed orchestration patterns
- Special thanks to the MCP community

---

**Note**: This project demonstrates how to overcome MCP client limitations (STDIO-only transport) to enable true multi-client orchestration with automatic message delivery and shared state.
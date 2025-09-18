# Maestro MCP - Multi-Client Orchestration System

A sophisticated orchestration system for the Model Context Protocol (MCP) that enables multiple MCP clients to collaborate through planner-executor patterns with shared state management.

## 🌟 Features

- **Multi-Client Orchestration**: Connect multiple MCP clients (Claude Code, Codex CLI) to a shared server
- **Planner-Executor Pattern**: Organize clients into planners and executors for complex task workflows
- **STDIO-HTTP Proxy**: Bridge STDIO-only MCP clients to a shared HTTP server
- **Real-time State Synchronization**: File-based state management with automatic watchers
- **11 Orchestration Tools**: Complete set of tools for task creation, planning, and execution

## 📋 Prerequisites

- Node.js v22+ (for native fetch support)
- Windows 10/11 (tested), macOS/Linux (compatible)
- Claude Code and/or Codex CLI

## 🚀 Quick Start

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
mkdir -p shared/clients shared/tasks shared/plans shared/reports
```

5. **Start the HTTP server**:
```bash
npm run http-server
```

6. **Configure your MCP clients** (see Configuration section below)

## ⚙️ Configuration

### Claude Code (`~/.claude.json`)

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

### Codex CLI (`~/.codex/config.toml`)

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

## 🏗️ Architecture

The system uses a unique STDIO-HTTP proxy architecture to enable shared state between multiple MCP clients:

```
Claude Code → STDIO → Proxy → HTTP Server ← Proxy ← STDIO ← Codex CLI
                                    ↓
                            File-based State
```

For detailed architecture information, see [ARCHITECTURE.md](ARCHITECTURE.md).

## 🛠️ Available Tools

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

## 📖 Usage Example

1. **Register clients**:
   - Claude as Planner: `register_client({ clientName: "Claude-Planner", role: "planner" })`
   - Codex as Executor: `register_client({ clientName: "Codex-Executor", role: "executor" })`

2. **Create and orchestrate tasks**:
   - Create task with requirements
   - Planner creates execution plan
   - Distribute to executors
   - Collect execution reports

## 🐛 Troubleshooting

### Codex Timeout Issues

If Codex shows "request timed out", ensure:
1. Environment variables are set in config.toml
2. Full Node.exe path is specified
3. Startup timeout is increased to 30000ms

For detailed troubleshooting, see [ARCHITECTURE.md](ARCHITECTURE.md#troubleshooting-guide).

## 📚 Documentation

- [Architecture & Implementation Guide](ARCHITECTURE.md) - Detailed system architecture
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

**Note**: This project demonstrates how to overcome MCP client limitations (STDIO-only transport) to enable true multi-client orchestration with shared state.
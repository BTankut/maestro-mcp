#!/usr/bin/env ts-node

/**
 * tmux Orchestrator for Maestro MCP
 *
 * This module manages TUI sessions in tmux and provides automatic polling
 * by sending keystrokes to the terminal sessions.
 */

import { execSync, spawn } from 'child_process';
import * as http from 'http';

interface TUISession {
  name: string;
  command: string;
  role: 'planner' | 'executor';
  tmuxSession: string;
  pollInterval: number;
  lastPoll?: Date;
}

class TmuxOrchestrator {
  private sessions: Map<string, TUISession> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.checkTmuxAvailable();
  }

  private checkTmuxAvailable(): void {
    try {
      execSync('tmux -V', { stdio: 'pipe' });
      console.log('✅ tmux is available');
    } catch (error) {
      console.error('❌ tmux is not installed. Please install tmux first.');
      console.log('   Ubuntu/Debian: sudo apt install tmux');
      console.log('   macOS: brew install tmux');
      console.log('   Windows: Use WSL or install tmux in Git Bash');
      process.exit(1);
    }
  }

  /**
   * Launch a TUI in a tmux session
   */
  async launchTUI(config: Omit<TUISession, 'tmuxSession' | 'lastPoll'>): Promise<void> {
    const sessionName = `maestro-${config.name}`;

    try {
      // Kill existing session if it exists
      try {
        execSync(`tmux kill-session -t ${sessionName}`, { stdio: 'pipe' });
      } catch (e) {
        // Session doesn't exist, that's fine
      }

      // Create new tmux session
      console.log(`🚀 Launching ${config.name} in tmux...`);
      execSync(`tmux new-session -d -s ${sessionName} '${config.command}'`);

      // Store session info
      const session: TUISession = {
        ...config,
        tmuxSession: sessionName
      };
      this.sessions.set(config.name, session);

      // Wait for TUI to initialize
      await this.sleep(3000);

      // Send initial registration if needed
      if (config.role === 'planner') {
        await this.sendCommand(config.name, 'register_as_planner Claude');
      } else {
        await this.sendCommand(config.name, `register_as_executor ${config.name}`);
      }

      console.log(`✅ ${config.name} launched and registered as ${config.role}`);

    } catch (error) {
      console.error(`❌ Failed to launch ${config.name}:`, error);
    }
  }

  /**
   * Send a command to a TUI session
   */
  async sendCommand(sessionName: string, command: string): Promise<void> {
    const session = this.sessions.get(sessionName);
    if (!session) {
      throw new Error(`Session ${sessionName} not found`);
    }

    try {
      // Send the command using tmux send-keys
      execSync(`tmux send-keys -t ${session.tmuxSession} "${command}" Enter`);
      console.log(`📤 Sent to ${sessionName}: ${command}`);
    } catch (error) {
      console.error(`❌ Failed to send command to ${sessionName}:`, error);
    }
  }

  /**
   * Start automatic polling for a session
   */
  startAutoPolling(sessionName: string): void {
    const session = this.sessions.get(sessionName);
    if (!session) {
      throw new Error(`Session ${sessionName} not found`);
    }

    // Clear existing interval if any
    this.stopAutoPolling(sessionName);

    console.log(`🔄 Starting auto-polling for ${sessionName} every ${session.pollInterval}ms`);

    const interval = setInterval(async () => {
      // Check if there are messages from the server
      const hasMessages = await this.checkServerForMessages(session.name);

      if (hasMessages) {
        // Send check_messages command to the TUI
        await this.sendCommand(sessionName, 'check_messages');
        session.lastPoll = new Date();
        console.log(`📬 Triggered message check for ${sessionName}`);
      }
    }, session.pollInterval);

    this.pollingIntervals.set(sessionName, interval);
  }

  /**
   * Stop automatic polling for a session
   */
  stopAutoPolling(sessionName: string): void {
    const interval = this.pollingIntervals.get(sessionName);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(sessionName);
      console.log(`⏹️ Stopped auto-polling for ${sessionName}`);
    }
  }

  /**
   * Check the MCP server for pending messages
   */
  private async checkServerForMessages(clientId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const data = JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'check_messages',
          arguments: { clientId }
        }
      });

      const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/mcp',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            const hasMessages = result.result?.content?.[0]?.text?.includes('"hasMessages":true');
            resolve(hasMessages || false);
          } catch (e) {
            resolve(false);
          }
        });
      });

      req.on('error', () => resolve(false));
      req.write(data);
      req.end();
    });
  }

  /**
   * Attach to a tmux session (for debugging)
   */
  attachToSession(sessionName: string): void {
    const session = this.sessions.get(sessionName);
    if (!session) {
      throw new Error(`Session ${sessionName} not found`);
    }

    console.log(`📺 Attaching to ${sessionName}...`);
    console.log(`   Run: tmux attach-session -t ${session.tmuxSession}`);

    // Spawn in attached mode
    spawn('tmux', ['attach-session', '-t', session.tmuxSession], {
      stdio: 'inherit'
    });
  }

  /**
   * List all active sessions
   */
  listSessions(): void {
    console.log('\n📋 Active TUI Sessions:');
    this.sessions.forEach((session, name) => {
      console.log(`   - ${name}: ${session.role} (tmux: ${session.tmuxSession})`);
      if (session.lastPoll) {
        console.log(`     Last poll: ${session.lastPoll.toLocaleTimeString()}`);
      }
    });

    // Also show actual tmux sessions
    console.log('\n📺 tmux sessions:');
    try {
      const output = execSync('tmux list-sessions', { stdio: 'pipe' }).toString();
      console.log(output);
    } catch (e) {
      console.log('   No active tmux sessions');
    }
  }

  /**
   * Kill all sessions and cleanup
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up...');

    // Stop all polling
    this.pollingIntervals.forEach((_, name) => {
      this.stopAutoPolling(name);
    });

    // Kill all tmux sessions
    this.sessions.forEach((session) => {
      try {
        execSync(`tmux kill-session -t ${session.tmuxSession}`, { stdio: 'pipe' });
        console.log(`   Killed ${session.tmuxSession}`);
      } catch (e) {
        // Session might already be dead
      }
    });

    this.sessions.clear();
    console.log('✅ Cleanup complete');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  const orchestrator = new TmuxOrchestrator();

  // Handle cleanup on exit
  process.on('SIGINT', async () => {
    console.log('\n⚠️ Received SIGINT, cleaning up...');
    await orchestrator.cleanup();
    process.exit(0);
  });

  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'launch-claude':
      await orchestrator.launchTUI({
        name: 'claude',
        command: 'claude-code',
        role: 'planner',
        pollInterval: 5000 // Check every 5 seconds
      });
      orchestrator.startAutoPolling('claude');
      break;

    case 'launch-codex':
      await orchestrator.launchTUI({
        name: 'codex',
        command: 'codex-tui',
        role: 'executor',
        pollInterval: 3000 // Check every 3 seconds
      });
      orchestrator.startAutoPolling('codex');
      break;

    case 'launch-all':
      // Launch both TUIs
      await orchestrator.launchTUI({
        name: 'claude',
        command: 'claude-code',
        role: 'planner',
        pollInterval: 5000
      });

      await orchestrator.launchTUI({
        name: 'codex',
        command: 'codex-tui',
        role: 'executor',
        pollInterval: 3000
      });

      // Start auto-polling for both
      orchestrator.startAutoPolling('claude');
      orchestrator.startAutoPolling('codex');

      console.log('\n✨ All TUIs launched with auto-polling!');
      orchestrator.listSessions();
      break;

    case 'attach':
      const sessionToAttach = args[1];
      if (!sessionToAttach) {
        console.error('Please specify session name: attach claude|codex');
        break;
      }
      orchestrator.attachToSession(sessionToAttach);
      break;

    case 'list':
      orchestrator.listSessions();
      break;

    case 'cleanup':
      await orchestrator.cleanup();
      break;

    default:
      console.log(`
Maestro MCP tmux Orchestrator
============================

Usage:
  ts-node tmux-orchestrator.ts <command> [options]

Commands:
  launch-claude    Launch Claude Code in tmux with auto-polling
  launch-codex     Launch Codex TUI in tmux with auto-polling
  launch-all       Launch both TUIs with auto-polling
  attach <name>    Attach to a running session (claude|codex)
  list            List all active sessions
  cleanup         Kill all sessions and cleanup

Examples:
  ts-node tmux-orchestrator.ts launch-all
  ts-node tmux-orchestrator.ts attach claude
  ts-node tmux-orchestrator.ts cleanup
      `);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { TmuxOrchestrator };
#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  InitializeRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

// Create MCP server
const server = new Server(
  {
    name: 'maestro-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    },
  }
);

// HTTP Client to forward requests to HTTP server
async function forwardToHttpServer(method: string, params?: any) {
  try {
    console.error(`[PROXY] Forwarding ${method} to HTTP server...`);
    const response = await fetch('http://localhost:3000/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json() as any;
    console.error(`[PROXY] Response received for ${method}`);

    if (result.error) {
      console.error(`[PROXY] Error from HTTP server:`, result.error);
      throw new Error(result.error.message);
    }
    return result.result;
  } catch (error: any) {
    console.error(`[PROXY] Failed to forward ${method}:`, error.message);
    throw error;
  }
}

// Handle initialization - MCP requires this
server.setRequestHandler(InitializeRequestSchema, async (request) => {
  console.error('[PROXY] Handling initialize request');
  // Respond immediately to prevent timeout
  const response = {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
      resources: {}
    },
    serverInfo: {
      name: 'maestro-mcp',
      version: '1.0.0'
    }
  };
  console.error('[PROXY] Sending initialize response');
  return response;
});

// Proxy tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error('[PROXY] Handling tools/list request');
  try {
    const result = await forwardToHttpServer('tools/list');
    console.error(`[PROXY] Returning ${result.tools?.length || 0} tools`);
    return result;
  } catch (error) {
    console.error('[PROXY] Failed to list tools:', error);
    return { tools: [] };
  }
});

// Proxy tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.error('[PROXY] Handling tools/call request:', request.params.name);
  try {
    return await forwardToHttpServer('tools/call', request.params);
  } catch (error: any) {
    console.error('[PROXY] Failed to call tool:', error);
    return {
      content: [{
        type: 'text',
        text: `Error: ${error?.message || 'Unknown error'}`
      }]
    };
  }
});

// Proxy resource list handler
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  console.error('[PROXY] Handling resources/list request');
  try {
    return await forwardToHttpServer('resources/list');
  } catch (error) {
    console.error('[PROXY] Failed to list resources:', error);
    return { resources: [] };
  }
});

// Proxy resource read handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  console.error('[PROXY] Handling resources/read request');
  try {
    return await forwardToHttpServer('resources/read', request.params);
  } catch (error) {
    console.error('[PROXY] Failed to read resource:', error);
    return {
      contents: [{
        uri: request.params.uri,
        mimeType: 'text/plain',
        text: `Error: ${error}`
      }]
    };
  }
});

async function main() {
  // Write to stderr immediately to show we're alive
  process.stderr.write('[PROXY] Starting STDIO-HTTP proxy server...\n');
  process.stderr.write(`[PROXY] Process started with PID: ${process.pid}\n`);
  process.stderr.write(`[PROXY] Working directory: ${process.cwd()}\n`);
  process.stderr.write('[PROXY] Node version: ' + process.version + '\n');

  // Start STDIO server immediately, check HTTP server in background
  const transport = new StdioServerTransport();
  console.error('[PROXY] Connecting STDIO transport...');

  try {
    await server.connect(transport);
    console.error('[PROXY] 🔄 STDIO-HTTP proxy server started successfully');
    console.error('[PROXY] Waiting for MCP client connections...');

    // Check HTTP server in background (non-blocking)
    fetch('http://localhost:3000/health')
      .then(async (response) => {
        const health = await response.json() as any;
        console.error(`[PROXY] ✅ Connected to HTTP server (${health.clients} clients connected)`);
      })
      .catch((error: any) => {
        console.error('[PROXY] ⚠️ HTTP server is not running on http://localhost:3000');
        console.error('[PROXY] Starting without HTTP backend - tools will not work');
        console.error('[PROXY] Please start the HTTP server: npm run http-server');
      });
  } catch (error) {
    console.error('[PROXY] Failed to start STDIO server:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.error('[PROXY] Shutting down...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('[PROXY] Uncaught exception:', error);
  // Don't exit on uncaught exceptions to keep proxy running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[PROXY] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Keep process alive
setInterval(() => {
  // Heartbeat to keep process alive
}, 60000);

main().catch((error) => {
  console.error('[PROXY] Fatal error:', error);
  process.exit(1);
});
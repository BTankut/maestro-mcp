// Quick test to see if maestro-mcp is responding
import { spawn } from 'child_process';

console.log('Testing maestro-mcp connection...\n');

const serverProcess = spawn('node', [
  'C:\\Users\\BT\\CascadeProjects\\Maestro-MCP\\server\\dist\\index.js'
], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Send initialization
const initRequest = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'claude-test', version: '1.0.0' }
  }
}) + '\n';

serverProcess.stdin.write(initRequest);

// Wait for response
let response = '';
serverProcess.stdout.on('data', (data) => {
  response += data.toString();
  console.log('Response:', response);

  if (response.includes('result')) {
    console.log('\n✅ Server is responding correctly!');

    // Now test listing tools
    const listToolsRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    }) + '\n';

    serverProcess.stdin.write(listToolsRequest);

    setTimeout(() => {
      serverProcess.kill();
      process.exit(0);
    }, 2000);
  }
});

serverProcess.stderr.on('data', (data) => {
  console.error('Error:', data.toString());
});

setTimeout(() => {
  if (!response) {
    console.log('❌ No response from server');
    serverProcess.kill();
    process.exit(1);
  }
}, 5000);
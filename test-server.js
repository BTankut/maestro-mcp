// Simple test to verify server starts correctly
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Testing MCP Server startup...\n');

const serverPath = join(__dirname, 'server', 'dist', 'index.js');
console.log(`Server path: ${serverPath}`);

// Start the server
const serverProcess = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
});

let output = '';
let errorOutput = '';

// Capture stdout
serverProcess.stdout.on('data', (data) => {
  output += data.toString();
  console.log('STDOUT:', data.toString());
});

// Capture stderr
serverProcess.stderr.on('data', (data) => {
  errorOutput += data.toString();
  console.log('STDERR:', data.toString());
});

// Handle server exit
serverProcess.on('exit', (code) => {
  console.log(`\nServer exited with code: ${code}`);

  if (code === 0) {
    console.log('✅ Server started and exited cleanly');
  } else {
    console.log('❌ Server exited with error');
    if (errorOutput) {
      console.log('Error output:', errorOutput);
    }
  }
});

// Send test input after 1 second
setTimeout(() => {
  console.log('\n📡 Sending initialization request...');

  const initRequest = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  }) + '\n';

  serverProcess.stdin.write(initRequest);

  // Wait for response
  setTimeout(() => {
    console.log('\n📋 Checking server response...');

    if (output.includes('"method":"initialize"') || output.includes('"result"')) {
      console.log('✅ Server is responding to JSON-RPC requests!');
      console.log('\n🎉 SERVER TEST PASSED! The server is working correctly.');
    } else if (output.length > 0) {
      console.log('⚠️ Server produced output but not the expected response');
      console.log('Output received:', output.substring(0, 200));
    } else {
      console.log('❌ No response from server');
    }

    // Clean shutdown
    console.log('\n🛑 Shutting down server...');
    serverProcess.kill('SIGTERM');

    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }, 2000);
}, 1000);

// Handle errors
serverProcess.on('error', (err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

console.log('⏳ Waiting for server to start...');
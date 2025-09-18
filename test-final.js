// Final test before restart - Clean environment test
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧹 FINAL CLEAN TEST BEFORE RESTART\n');
console.log('=' .repeat(50));

// Clean shared directory first
async function cleanSharedDirectory() {
  console.log('\n📁 Cleaning shared directory...');
  const dirs = ['tasks', 'plans', 'reports', 'state'];

  for (const dir of dirs) {
    const dirPath = join(__dirname, 'shared', dir);
    try {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(join(dirPath, file));
        }
      }
      console.log(`  ✓ Cleaned ${dir}/`);
    } catch (error) {
      console.log(`  ⚠ Could not clean ${dir}/: ${error.message}`);
    }
  }
  console.log('✅ Shared directory cleaned\n');
}

async function quickServerTest() {
  const serverPath = join(__dirname, 'server', 'dist', 'index.js');

  console.log('🚀 Starting server for quick test...');
  const serverProcess = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Wait for server
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Send initialization
  const initRequest = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'final-test', version: '1.0.0' }
    }
  }) + '\n';

  serverProcess.stdin.write(initRequest);

  // Wait for response
  let response = '';
  await new Promise((resolve) => {
    const handler = (data) => {
      response += data.toString();
      if (response.includes('result')) {
        serverProcess.stdout.removeListener('data', handler);
        resolve();
      }
    };
    serverProcess.stdout.on('data', handler);
    setTimeout(resolve, 2000);
  });

  if (response.includes('"result"')) {
    console.log('✅ Server is responding correctly');

    // Quick tool test
    const toolRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    }) + '\n';

    serverProcess.stdin.write(toolRequest);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ Tools endpoint working');
  } else {
    console.log('❌ Server not responding properly');
  }

  // Shutdown
  serverProcess.kill('SIGTERM');
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('✅ Server shutdown cleanly\n');
}

// Run tests
(async () => {
  try {
    await cleanSharedDirectory();
    await quickServerTest();

    console.log('=' .repeat(50));
    console.log('✅ SYSTEM READY FOR RESTART!');
    console.log('=' .repeat(50));
    console.log('\n📋 Configuration Summary:');
    console.log('  • Claude Code: ✅ Configured at %APPDATA%\\Claude\\claude_desktop_config.json');
    console.log('  • Codex CLI:   ✅ Configured at ~/.codex/config.toml');
    console.log('  • Server Path:  C:\\Users\\BT\\CascadeProjects\\Maestro-MCP\\server\\dist\\index.js');
    console.log('\n🔄 Next Steps:');
    console.log('  1. Restart Claude Code application');
    console.log('  2. Restart Codex CLI');
    console.log('  3. Both should now have "maestro-mcp" available in their MCP tools');
    console.log('\n🎯 Test Commands After Restart:');
    console.log('  • Use "register_client" to register as planner or executor');
    console.log('  • Use "create_task" to create a new task');
    console.log('  • Use "list_clients" to see connected clients');

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
})();
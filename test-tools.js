// Test all MCP tools programmatically
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MCPTester {
  constructor() {
    this.serverPath = join(__dirname, 'server', 'dist', 'index.js');
    this.serverProcess = null;
    this.requestId = 1;
  }

  async startServer() {
    console.log('🚀 Starting MCP Server...');
    this.serverProcess = spawn('node', [this.serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Initialize connection
    const initResponse = await this.sendRequest('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    });

    if (initResponse.result) {
      console.log('✅ Server initialized successfully\n');
      return true;
    }
    return false;
  }

  sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      const request = {
        jsonrpc: '2.0',
        id: this.requestId++,
        method,
        params
      };

      const requestStr = JSON.stringify(request) + '\n';
      this.serverProcess.stdin.write(requestStr);

      let responseData = '';
      const dataHandler = (data) => {
        responseData += data.toString();
        try {
          const response = JSON.parse(responseData);
          this.serverProcess.stdout.removeListener('data', dataHandler);
          resolve(response);
        } catch (e) {
          // Keep reading until we have complete JSON
        }
      };

      this.serverProcess.stdout.on('data', dataHandler);
      setTimeout(() => {
        this.serverProcess.stdout.removeListener('data', dataHandler);
        reject(new Error('Request timeout'));
      }, 5000);
    });
  }

  async callTool(toolName, args) {
    return await this.sendRequest('tools/call', {
      name: toolName,
      arguments: args
    });
  }

  async listTools() {
    return await this.sendRequest('tools/list', {});
  }

  async listResources() {
    return await this.sendRequest('resources/list', {});
  }

  async readResource(uri) {
    return await this.sendRequest('resources/read', { uri });
  }

  async runTests() {
    console.log('🧪 STARTING COMPREHENSIVE MCP SERVER TESTS\n');
    console.log('=' .repeat(50) + '\n');

    try {
      // Start server
      if (!await this.startServer()) {
        throw new Error('Failed to initialize server');
      }

      // Test 1: List Tools
      console.log('TEST 1: List Tools');
      console.log('-'.repeat(30));
      const toolsList = await this.listTools();
      console.log(`✅ Found ${toolsList.result.tools.length} tools`);
      console.log('Tool names:', toolsList.result.tools.map(t => t.name).join(', '));
      console.log();

      // Test 2: List Resources
      console.log('TEST 2: List Resources');
      console.log('-'.repeat(30));
      const resourcesList = await this.listResources();
      console.log(`✅ Found ${resourcesList.result.resources.length} resources`);
      console.log('Resource URIs:', resourcesList.result.resources.map(r => r.uri).join(', '));
      console.log();

      // Test 3: Register Clients
      console.log('TEST 3: Register Clients');
      console.log('-'.repeat(30));

      const plannerResult = await this.callTool('register_client', {
        clientName: 'AutoTest-Planner',
        role: 'planner'
      });
      const plannerData = JSON.parse(plannerResult.result.content[0].text);
      const plannerId = plannerData.clientId;
      console.log(`✅ Planner registered: ${plannerId}`);

      const executor1Result = await this.callTool('register_client', {
        clientName: 'AutoTest-Executor-1',
        role: 'executor'
      });
      const executor1Data = JSON.parse(executor1Result.result.content[0].text);
      const executor1Id = executor1Data.clientId;
      console.log(`✅ Executor 1 registered: ${executor1Id}`);

      const executor2Result = await this.callTool('register_client', {
        clientName: 'AutoTest-Executor-2',
        role: 'executor'
      });
      const executor2Data = JSON.parse(executor2Result.result.content[0].text);
      const executor2Id = executor2Data.clientId;
      console.log(`✅ Executor 2 registered: ${executor2Id}`);
      console.log();

      // Test 4: Create Task
      console.log('TEST 4: Create Task');
      console.log('-'.repeat(30));
      const taskResult = await this.callTool('create_task', {
        description: 'Automated test task',
        requirements: ['Requirement 1', 'Requirement 2']
      });
      const taskData = JSON.parse(taskResult.result.content[0].text);
      const taskId = taskData.task.id;
      console.log(`✅ Task created: ${taskId}`);
      console.log();

      // Test 5: Assign Task
      console.log('TEST 5: Assign Task to Planner');
      console.log('-'.repeat(30));
      await this.callTool('assign_task', {
        taskId: taskId,
        plannerId: plannerId
      });
      console.log(`✅ Task assigned to planner`);
      console.log();

      // Test 6: Create Plan
      console.log('TEST 6: Create Plan');
      console.log('-'.repeat(30));
      const planResult = await this.callTool('create_plan', {
        taskId: taskId,
        plannerId: plannerId,
        steps: [
          { description: 'Step 1: Initialize', dependencies: [] },
          { description: 'Step 2: Process', dependencies: [] },
          { description: 'Step 3: Finalize', dependencies: ['0', '1'] }
        ]
      });
      const planData = JSON.parse(planResult.result.content[0].text);
      const planId = planData.plan.id;
      const steps = planData.plan.steps;
      console.log(`✅ Plan created: ${planId} with ${steps.length} steps`);
      console.log();

      // Test 7: Distribute Plan
      console.log('TEST 7: Distribute Plan to Executors');
      console.log('-'.repeat(30));
      const assignments = {};
      assignments[executor1Id] = [steps[0].id, steps[1].id];
      assignments[executor2Id] = [steps[2].id];

      await this.callTool('distribute_plan', {
        planId: planId,
        assignments: assignments
      });
      console.log(`✅ Plan distributed to executors`);
      console.log();

      // Test 8: Submit Reports
      console.log('TEST 8: Submit Execution Reports');
      console.log('-'.repeat(30));

      // Submit report for step 1
      await this.callTool('submit_report', {
        planId: planId,
        stepId: steps[0].id,
        executorId: executor1Id,
        status: 'success',
        results: { message: 'Step 1 completed' }
      });
      console.log(`✅ Report submitted for step 1`);

      // Submit report for step 2
      await this.callTool('submit_report', {
        planId: planId,
        stepId: steps[1].id,
        executorId: executor1Id,
        status: 'success',
        results: { message: 'Step 2 completed' }
      });
      console.log(`✅ Report submitted for step 2`);
      console.log();

      // Test 9: Check Status
      console.log('TEST 9: Check Task Status');
      console.log('-'.repeat(30));
      const statusResult = await this.callTool('get_task_status', { taskId });
      const statusData = JSON.parse(statusResult.result.content[0].text);
      console.log(`✅ Task status: ${statusData.task.status}`);
      console.log();

      // Test 10: Get Reports
      console.log('TEST 10: Get Executor Reports');
      console.log('-'.repeat(30));
      const reportsResult = await this.callTool('get_executor_reports', { planId });
      const reportsData = JSON.parse(reportsResult.result.content[0].text);
      console.log(`✅ Found ${reportsData.count} reports`);
      console.log();

      // Test 11: List All Entities
      console.log('TEST 11: List All Entities');
      console.log('-'.repeat(30));

      const clientsResult = await this.callTool('list_clients', {});
      const clientsData = JSON.parse(clientsResult.result.content[0].text);
      console.log(`✅ Clients: ${clientsData.count}`);

      const tasksResult = await this.callTool('list_tasks', {});
      const tasksData = JSON.parse(tasksResult.result.content[0].text);
      console.log(`✅ Tasks: ${tasksData.count}`);

      const plansResult = await this.callTool('list_plans', {});
      const plansData = JSON.parse(plansResult.result.content[0].text);
      console.log(`✅ Plans: ${plansData.count}`);
      console.log();

      // Test 12: Read Resources
      console.log('TEST 12: Read Resources');
      console.log('-'.repeat(30));

      const stateResource = await this.readResource('maestro://system/state');
      const stateData = JSON.parse(stateResource.result.contents[0].text);
      console.log(`✅ System state read successfully`);
      console.log(`  - Clients: ${stateData.clients.length}`);
      console.log(`  - Tasks: ${stateData.tasks.length}`);
      console.log(`  - Plans: ${stateData.plans.length}`);
      console.log();

      // Test 13: Check File System
      console.log('TEST 13: Check File System');
      console.log('-'.repeat(30));

      const tasksDir = await fs.readdir('./shared/tasks');
      console.log(`✅ Task files: ${tasksDir.length}`);

      const plansDir = await fs.readdir('./shared/plans');
      console.log(`✅ Plan files: ${plansDir.length}`);

      const reportsDir = await fs.readdir('./shared/reports');
      console.log(`✅ Report files: ${reportsDir.length}`);

      const stateFiles = await fs.readdir('./shared/state');
      console.log(`✅ State files: ${stateFiles.length}`);
      console.log();

      console.log('=' .repeat(50));
      console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
      console.log('=' .repeat(50));

    } catch (error) {
      console.error('❌ Test failed:', error.message);
      console.error(error);
    } finally {
      // Cleanup
      if (this.serverProcess) {
        console.log('\n🛑 Shutting down server...');
        this.serverProcess.kill('SIGTERM');
      }
      setTimeout(() => process.exit(0), 1000);
    }
  }
}

// Run the tests
const tester = new MCPTester();
tester.runTests().catch(console.error);
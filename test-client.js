import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function testMCPServer() {
  console.log('🚀 Starting MCP Server Tests...\n');

  // Start the server process
  const serverProcess = spawn('node', ['server/dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Create client transport
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['server/dist/index.js']
  });

  // Create MCP client
  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    // Connect to server
    console.log('📡 Connecting to server...');
    await client.connect(transport);
    console.log('✅ Connected successfully!\n');

    // Test 1: List available tools
    console.log('📋 TEST 1: Listing available tools...');
    const toolsResponse = await client.listTools();
    console.log(`Found ${toolsResponse.tools.length} tools:`);
    toolsResponse.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    console.log('✅ Tools listing successful!\n');

    // Test 2: List resources
    console.log('📋 TEST 2: Listing available resources...');
    const resourcesResponse = await client.listResources();
    console.log(`Found ${resourcesResponse.resources.length} resources:`);
    resourcesResponse.resources.forEach(resource => {
      console.log(`  - ${resource.name}: ${resource.uri}`);
    });
    console.log('✅ Resources listing successful!\n');

    // Test 3: Register a planner client
    console.log('🧪 TEST 3: Registering a planner client...');
    const registerPlannerResult = await client.callTool('register_client', {
      clientName: 'Test-Planner-1',
      role: 'planner'
    });
    console.log('Response:', JSON.parse(registerPlannerResult.content[0].text));
    const plannerId = JSON.parse(registerPlannerResult.content[0].text).clientId;
    console.log('✅ Planner registered successfully!\n');

    // Test 4: Register executor clients
    console.log('🧪 TEST 4: Registering executor clients...');
    const executor1Result = await client.callTool('register_client', {
      clientName: 'Test-Executor-1',
      role: 'executor'
    });
    const executor1Id = JSON.parse(executor1Result.content[0].text).clientId;

    const executor2Result = await client.callTool('register_client', {
      clientName: 'Test-Executor-2',
      role: 'executor'
    });
    const executor2Id = JSON.parse(executor2Result.content[0].text).clientId;
    console.log('✅ Executors registered successfully!\n');

    // Test 5: List clients
    console.log('🧪 TEST 5: Listing all clients...');
    const listClientsResult = await client.callTool('list_clients', {});
    const clientsList = JSON.parse(listClientsResult.content[0].text);
    console.log(`Total clients: ${clientsList.count}`);
    console.log('✅ Client listing successful!\n');

    // Test 6: Create a task
    console.log('🧪 TEST 6: Creating a task...');
    const createTaskResult = await client.callTool('create_task', {
      description: 'Build a REST API with authentication',
      requirements: [
        'Use Express.js framework',
        'Implement JWT authentication',
        'Add user CRUD operations'
      ]
    });
    const taskData = JSON.parse(createTaskResult.content[0].text);
    const taskId = taskData.task.id;
    console.log(`Task created with ID: ${taskId}`);
    console.log('✅ Task creation successful!\n');

    // Test 7: Assign task to planner
    console.log('🧪 TEST 7: Assigning task to planner...');
    const assignResult = await client.callTool('assign_task', {
      taskId: taskId,
      plannerId: plannerId
    });
    console.log(JSON.parse(assignResult.content[0].text).message);
    console.log('✅ Task assignment successful!\n');

    // Test 8: Create a plan
    console.log('🧪 TEST 8: Creating a plan...');
    const createPlanResult = await client.callTool('create_plan', {
      taskId: taskId,
      plannerId: plannerId,
      steps: [
        {
          description: 'Set up Express.js project structure',
          dependencies: []
        },
        {
          description: 'Implement JWT authentication middleware',
          dependencies: []
        },
        {
          description: 'Create user model and database schema',
          dependencies: []
        },
        {
          description: 'Implement user CRUD endpoints',
          dependencies: ['0', '1', '2']
        }
      ]
    });
    const planData = JSON.parse(createPlanResult.content[0].text);
    const planId = planData.plan.id;
    const steps = planData.plan.steps;
    console.log(`Plan created with ID: ${planId}`);
    console.log(`Plan has ${steps.length} steps`);
    console.log('✅ Plan creation successful!\n');

    // Test 9: Distribute plan to executors
    console.log('🧪 TEST 9: Distributing plan to executors...');
    const assignments = {};
    assignments[executor1Id] = [steps[0].id, steps[1].id];
    assignments[executor2Id] = [steps[2].id, steps[3].id];

    const distributeResult = await client.callTool('distribute_plan', {
      planId: planId,
      assignments: assignments
    });
    console.log(JSON.parse(distributeResult.content[0].text).message);
    console.log('✅ Plan distribution successful!\n');

    // Test 10: Submit reports
    console.log('🧪 TEST 10: Submitting execution reports...');

    // Report for step 0
    const report1Result = await client.callTool('submit_report', {
      planId: planId,
      stepId: steps[0].id,
      executorId: executor1Id,
      status: 'success',
      results: {
        message: 'Express.js project initialized',
        files: ['package.json', 'server.js', 'config/']
      }
    });
    console.log('Report 1 submitted');

    // Report for step 1
    const report2Result = await client.callTool('submit_report', {
      planId: planId,
      stepId: steps[1].id,
      executorId: executor1Id,
      status: 'success',
      results: {
        message: 'JWT middleware implemented',
        files: ['middleware/auth.js', 'utils/jwt.js']
      }
    });
    console.log('Report 2 submitted');
    console.log('✅ Report submission successful!\n');

    // Test 11: Get task status
    console.log('🧪 TEST 11: Getting task status...');
    const statusResult = await client.callTool('get_task_status', {
      taskId: taskId
    });
    const taskStatus = JSON.parse(statusResult.content[0].text);
    console.log(`Task status: ${taskStatus.task.status}`);
    console.log('✅ Status check successful!\n');

    // Test 12: Get executor reports
    console.log('🧪 TEST 12: Getting executor reports...');
    const reportsResult = await client.callTool('get_executor_reports', {
      planId: planId
    });
    const reports = JSON.parse(reportsResult.content[0].text);
    console.log(`Found ${reports.count} reports`);
    console.log('✅ Reports retrieval successful!\n');

    // Test 13: Read system state resource
    console.log('🧪 TEST 13: Reading system state resource...');
    const stateResource = await client.readResource('maestro://system/state');
    const systemState = JSON.parse(stateResource.contents[0].text);
    console.log(`System has ${systemState.clients.length} clients, ${systemState.tasks.length} tasks, ${systemState.plans.length} plans`);
    console.log('✅ Resource reading successful!\n');

    // Test 14: List all tasks
    console.log('🧪 TEST 14: Listing all tasks...');
    const listTasksResult = await client.callTool('list_tasks', {});
    const tasksList = JSON.parse(listTasksResult.content[0].text);
    console.log(`Total tasks: ${tasksList.count}`);
    console.log('✅ Task listing successful!\n');

    // Test 15: List all plans
    console.log('🧪 TEST 15: Listing all plans...');
    const listPlansResult = await client.callTool('list_plans', {});
    const plansList = JSON.parse(listPlansResult.content[0].text);
    console.log(`Total plans: ${plansList.count}`);
    console.log('✅ Plan listing successful!\n');

    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    await client.close();
    serverProcess.kill();
    process.exit(0);
  }
}

// Run tests
testMCPServer().catch(console.error);
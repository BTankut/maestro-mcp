import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { Orchestrator } from './orchestrator.js';

const orchestrator = new Orchestrator();
const sessions = new Map<string, any>();

// Tool list handler
const handleListTools = async () => {
  return {
    tools: [
      {
        name: 'register_client',
        description: 'Register a client with a specific role (planner or executor)',
        inputSchema: {
          type: 'object',
          properties: {
            clientName: {
              type: 'string',
              description: 'Name of the client'
            },
            role: {
              type: 'string',
              enum: ['planner', 'executor'],
              description: 'Role of the client'
            }
          },
          required: ['clientName', 'role']
        }
      },
      {
        name: 'create_task',
        description: 'Create a new task (user to planner)',
        inputSchema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Task description'
            },
            requirements: {
              type: 'array',
              items: { type: 'string' },
              description: 'Task requirements'
            }
          },
          required: ['description']
        }
      },
      {
        name: 'assign_task',
        description: 'Assign a task to a planner',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Task ID'
            },
            plannerId: {
              type: 'string',
              description: 'Planner client ID'
            }
          },
          required: ['taskId', 'plannerId']
        }
      },
      {
        name: 'create_plan',
        description: 'Create a plan for a task (planner)',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Task ID'
            },
            plannerId: {
              type: 'string',
              description: 'Planner ID creating the plan'
            },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  description: { type: 'string' },
                  dependencies: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                },
                required: ['description']
              },
              description: 'Plan steps'
            }
          },
          required: ['taskId', 'plannerId', 'steps']
        }
      },
      {
        name: 'distribute_plan',
        description: 'Distribute plan to executors',
        inputSchema: {
          type: 'object',
          properties: {
            planId: {
              type: 'string',
              description: 'Plan ID'
            },
            assignments: {
              type: 'object',
              description: 'Map of executor IDs to step IDs'
            }
          },
          required: ['planId', 'assignments']
        }
      },
      {
        name: 'submit_report',
        description: 'Submit execution report (executor)',
        inputSchema: {
          type: 'object',
          properties: {
            planId: {
              type: 'string',
              description: 'Plan ID'
            },
            stepId: {
              type: 'string',
              description: 'Step ID'
            },
            executorId: {
              type: 'string',
              description: 'Executor ID'
            },
            results: {
              type: 'object',
              description: 'Execution results'
            },
            status: {
              type: 'string',
              enum: ['success', 'failed', 'partial'],
              description: 'Execution status'
            },
            errors: {
              type: 'array',
              items: { type: 'string' },
              description: 'Any errors encountered'
            }
          },
          required: ['planId', 'stepId', 'executorId', 'status']
        }
      },
      {
        name: 'get_task_status',
        description: 'Get current status of a task',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Task ID'
            }
          },
          required: ['taskId']
        }
      },
      {
        name: 'get_executor_reports',
        description: 'Get all reports for a plan',
        inputSchema: {
          type: 'object',
          properties: {
            planId: {
              type: 'string',
              description: 'Plan ID'
            }
          },
          required: ['planId']
        }
      },
      {
        name: 'list_clients',
        description: 'List all registered clients',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'list_tasks',
        description: 'List all tasks',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'list_plans',
        description: 'List all plans',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ],
  };
};

// Tool call handler
const handleCallTool = async (request: any) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: false, error: 'Missing arguments' }, null, 2)
      }]
    };
  }

  try {
    switch (name) {
      case 'register_client': {
        const clientId = uuidv4();
        const clientInfo = {
          id: clientId,
          role: args.role as any,
          name: args.clientName as string,
          connectedAt: new Date(),
          capabilities: []
        };

        orchestrator.registerClient(clientInfo);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              clientId,
              role: args.role,
              message: `Client registered as ${args.role} with ID: ${clientId}`
            }, null, 2)
          }]
        };
      }

      case 'create_task': {
        const task = await orchestrator.createTask(
          args.description as string,
          (args.requirements as string[]) || [],
          'user'
        );

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              task,
              message: `Task created with ID: ${task.id}`
            }, null, 2)
          }]
        };
      }

      case 'assign_task': {
        await orchestrator.assignTaskToPlanner(args.taskId as string, args.plannerId as string);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Task ${args.taskId} assigned to planner ${args.plannerId}`
            }, null, 2)
          }]
        };
      }

      case 'create_plan': {
        const plan = await orchestrator.createPlan(
          args.taskId as string,
          args.plannerId as string,
          args.steps as any[]
        );

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              plan,
              message: `Plan created with ID: ${plan.id}`
            }, null, 2)
          }]
        };
      }

      case 'distribute_plan': {
        await orchestrator.distributePlanToExecutors(
          args.planId as string,
          args.assignments as Record<string, string[]>
        );

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Plan ${args.planId} distributed to executors`
            }, null, 2)
          }]
        };
      }

      case 'submit_report': {
        const report = {
          id: uuidv4(),
          planId: args.planId as string,
          stepId: args.stepId as string,
          executorId: args.executorId as string,
          results: args.results || {},
          errors: args.errors as string[] | undefined,
          status: args.status as 'success' | 'failed' | 'partial',
          timestamp: new Date()
        };

        const fs = await import('fs/promises');
        const path = await import('path');
        await fs.writeFile(
          path.join('./shared/reports', `${report.id}.json`),
          JSON.stringify(report, null, 2)
        );

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              report,
              message: `Report submitted with ID: ${report.id}`
            }, null, 2)
          }]
        };
      }

      case 'get_task_status': {
        const task = await orchestrator.getTaskStatus(args.taskId as string);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              task,
              message: task ? `Task status: ${task.status}` : 'Task not found'
            }, null, 2)
          }]
        };
      }

      case 'get_executor_reports': {
        const reports = await orchestrator.getExecutorReports(args.planId as string);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              reports,
              count: reports.length,
              message: `Found ${reports.length} reports for plan ${args.planId}`
            }, null, 2)
          }]
        };
      }

      case 'list_clients': {
        const clients = orchestrator.getClients();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              clients,
              count: clients.length,
              message: `${clients.length} clients connected`
            }, null, 2)
          }]
        };
      }

      case 'list_tasks': {
        const tasks = orchestrator.getTasks();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              tasks,
              count: tasks.length,
              message: `${tasks.length} tasks in system`
            }, null, 2)
          }]
        };
      }

      case 'list_plans': {
        const plans = orchestrator.getPlans();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              plans,
              count: plans.length,
              message: `${plans.length} plans in system`
            }, null, 2)
          }]
        };
      }

      default:
        return {
          content: [{
            type: 'text',
            text: `Unknown tool: ${name}`
          }]
        };
    }
  } catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error.message
        }, null, 2)
      }]
    };
  }
};

// Resource list handler
const handleListResources = async () => {
  return {
    resources: [
      {
        uri: 'maestro://system/state',
        name: 'System State',
        description: 'Current system state including clients, tasks, and plans',
        mimeType: 'application/json'
      },
      {
        uri: 'maestro://tasks/active',
        name: 'Active Tasks',
        description: 'List of active tasks',
        mimeType: 'application/json'
      },
      {
        uri: 'maestro://plans/active',
        name: 'Active Plans',
        description: 'List of active plans',
        mimeType: 'application/json'
      }
    ]
  };
};

// Resource read handler
const handleReadResource = async (request: any) => {
  const { uri } = request.params;

  switch (uri) {
    case 'maestro://system/state': {
      const state = {
        clients: orchestrator.getClients(),
        tasks: orchestrator.getTasks(),
        plans: orchestrator.getPlans(),
        timestamp: new Date()
      };

      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(state, null, 2)
        }]
      };
    }

    case 'maestro://tasks/active': {
      const tasks = orchestrator.getTasks().filter(t =>
        t.status !== 'completed' && t.status !== 'failed'
      );

      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(tasks, null, 2)
        }]
      };
    }

    case 'maestro://plans/active': {
      const plans = orchestrator.getPlans().filter(p =>
        p.status === 'in_progress' || p.status === 'draft' || p.status === 'approved'
      );

      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(plans, null, 2)
        }]
      };
    }

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
};

// Create HTTP server
const httpServer = createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/mcp' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const request = JSON.parse(body);

        // Get or create session
        let sessionId = req.headers['x-session-id'] as string;
        if (!sessionId) {
          sessionId = uuidv4();
        }

        // Handle the request based on method
        let response;
        if (request.method === 'tools/list') {
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: await handleListTools()
          };
        } else if (request.method === 'tools/call') {
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: await handleCallTool(request)
          };
        } else if (request.method === 'resources/list') {
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: await handleListResources()
          };
        } else if (request.method === 'resources/read') {
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: await handleReadResource(request)
          };
        } else {
          response = {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: 'Method not found'
            }
          };
        }

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId
        });
        res.end(JSON.stringify(response));
      } catch (error: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32700,
            message: 'Parse error',
            data: error.message
          }
        }));
      }
    });
  } else if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', clients: orchestrator.getClients().length }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Start server
const PORT = process.env.PORT || 3000;

async function main() {
  await orchestrator.loadExistingData();

  httpServer.listen(PORT, () => {
    console.log(`🚀 Maestro MCP HTTP Server running on http://localhost:${PORT}`);
    console.log(`📡 MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`❤️ Health check: http://localhost:${PORT}/health`);
  });

  process.on('SIGINT', () => {
    orchestrator.cleanup();
    httpServer.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
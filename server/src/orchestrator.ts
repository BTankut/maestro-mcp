import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import chokidar from 'chokidar';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  ClientInfo,
  Task,
  Plan,
  ExecutionReport,
  SystemState,
  Step
} from './types/index.js';
import { MessageQueue, QueueMessage } from './message-queue.js';
import { AutoPoller } from './auto-poller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class Orchestrator {
  private clients: Map<string, ClientInfo> = new Map();
  private tasks: Map<string, Task> = new Map();
  private plans: Map<string, Plan> = new Map();
  private reports: Map<string, ExecutionReport> = new Map();
  private sharedPath: string;
  private watcher?: any;
  private messageQueue: MessageQueue;
  private roleAssignments: Map<string, 'planner' | 'executor'> = new Map();
  private autoPoller: AutoPoller;
  private autoPollClients: Set<string> = new Set();

  constructor() {
    this.sharedPath = path.join(__dirname, '../../shared');
    this.messageQueue = new MessageQueue(this.sharedPath);
    this.autoPoller = new AutoPoller();
    this.initializeDirectories();
    this.startFileWatcher();
    this.setupAutoPolling();
  }

  private async initializeDirectories() {
    const dirs = [
      path.join(this.sharedPath, 'tasks'),
      path.join(this.sharedPath, 'plans'),
      path.join(this.sharedPath, 'reports'),
      path.join(this.sharedPath, 'state')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private startFileWatcher() {
    this.watcher = chokidar.watch(this.sharedPath, {
      persistent: true,
      ignoreInitial: true
    });

    this.watcher.on('add', (filePath: string) => this.handleFileAdded(filePath));
    this.watcher.on('change', (filePath: string) => this.handleFileChanged(filePath));
  }

  private async handleFileAdded(filePath: string) {
    const relativePath = path.relative(this.sharedPath, filePath);
    const parts = relativePath.split(path.sep);

    if (parts[0] === 'reports' && filePath.endsWith('.json')) {
      await this.loadReport(filePath);
    }
  }

  private async handleFileChanged(filePath: string) {
    const relativePath = path.relative(this.sharedPath, filePath);
    const parts = relativePath.split(path.sep);

    if (parts[0] === 'plans' && filePath.endsWith('.json')) {
      await this.loadPlan(filePath);
    } else if (parts[0] === 'reports' && filePath.endsWith('.json')) {
      await this.loadReport(filePath);
    }
  }

  private async loadPlan(filePath: string) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const plan: Plan = JSON.parse(content);
      this.plans.set(plan.id, plan);
    } catch (error) {
      console.error(`Error loading plan from ${filePath}:`, error);
    }
  }

  private async loadReport(filePath: string) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const report: ExecutionReport = JSON.parse(content);
      this.reports.set(report.id, report);
      await this.validateTaskCompletion(report);
    } catch (error) {
      console.error(`Error loading report from ${filePath}:`, error);
    }
  }

  public registerClient(clientInfo: ClientInfo): void {
    this.clients.set(clientInfo.id, clientInfo);
    this.updateSystemState();
  }

  public registerAsPlanner(name: string, sessionId?: string): ClientInfo {
    const clientInfo: ClientInfo = {
      id: sessionId || uuidv4(),
      name,
      role: 'planner',
      status: 'active',
      registeredAt: new Date()
    };
    this.registerClient(clientInfo);
    return clientInfo;
  }

  public registerAsExecutor(name: string, sessionId?: string): ClientInfo {
    const clientInfo: ClientInfo = {
      id: sessionId || uuidv4(),
      name,
      role: 'executor',
      status: 'active',
      registeredAt: new Date()
    };
    this.registerClient(clientInfo);
    return clientInfo;
  }

  public switchRole(clientId: string): ClientInfo {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    // Toggle between planner and executor
    client.role = client.role === 'planner' ? 'executor' : 'planner';
    client.updatedAt = new Date();

    this.clients.set(clientId, client);
    this.updateSystemState();
    return client;
  }

  public whoami(clientId: string): ClientInfo | undefined {
    return this.clients.get(clientId);
  }

  public unregisterClient(clientId: string): void {
    this.clients.delete(clientId);
    this.updateSystemState();
  }

  public async createTask(description: string, requirements: string[], createdBy: string): Promise<Task> {
    const task: Task = {
      id: uuidv4(),
      description,
      requirements,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy
    };

    this.tasks.set(task.id, task);
    await this.saveTask(task);
    this.updateSystemState();
    return task;
  }

  public async assignTaskToPlanner(taskId: string, plannerId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    const planner = this.clients.get(plannerId);

    if (!task) throw new Error(`Task ${taskId} not found`);
    if (!planner || planner.role !== 'planner') {
      throw new Error(`Invalid planner ${plannerId}`);
    }

    task.assignedTo = plannerId;
    task.status = 'planning';
    task.updatedAt = new Date();

    await this.saveTask(task);
    this.updateSystemState();
  }

  public async createPlan(taskId: string, plannerId: string, steps: Partial<Step>[]): Promise<Plan> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const plan: Plan = {
      id: uuidv4(),
      taskId,
      plannerId,
      steps: steps.map((step, index) => ({
        id: uuidv4(),
        description: step.description || '',
        dependencies: step.dependencies || [],
        status: 'pending',
        order: index + 1
      })),
      executorAssignments: {},
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.plans.set(plan.id, plan);
    await this.savePlan(plan);

    task.status = 'executing';
    await this.saveTask(task);

    this.updateSystemState();
    return plan;
  }

  public async distributePlanToExecutors(planId: string, assignments: Record<string, string[]>): Promise<void> {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    plan.executorAssignments = assignments;
    plan.status = 'in_progress';
    plan.updatedAt = new Date();

    for (const [executorId, stepIds] of Object.entries(assignments)) {
      const executor = this.clients.get(executorId);
      if (!executor || executor.role !== 'executor') {
        throw new Error(`Invalid executor ${executorId}`);
      }

      for (const stepId of stepIds) {
        const step = plan.steps.find(s => s.id === stepId);
        if (step) {
          step.assignedExecutor = executorId;
          step.status = 'in_progress';
        }
      }
    }

    await this.savePlan(plan);
    this.updateSystemState();
  }

  public async getTaskStatus(taskId: string): Promise<Task | undefined> {
    return this.tasks.get(taskId);
  }

  public async getExecutorReports(planId: string): Promise<ExecutionReport[]> {
    return Array.from(this.reports.values()).filter(r => r.planId === planId);
  }

  private async validateTaskCompletion(report: ExecutionReport): Promise<void> {
    const plan = Array.from(this.plans.values()).find(p => p.id === report.planId);
    if (!plan) return;

    const step = plan.steps.find(s => s.id === report.stepId);
    if (step) {
      step.status = report.status === 'success' ? 'completed' : 'failed';
    }

    const allStepsCompleted = plan.steps.every(s => s.status === 'completed');
    const anyStepFailed = plan.steps.some(s => s.status === 'failed');

    if (allStepsCompleted) {
      plan.status = 'completed';
      const task = this.tasks.get(plan.taskId);
      if (task) {
        task.status = 'completed';
        task.updatedAt = new Date();
        await this.saveTask(task);
      }
    } else if (anyStepFailed) {
      plan.status = 'failed';
      const task = this.tasks.get(plan.taskId);
      if (task) {
        task.status = 'validating';
        task.updatedAt = new Date();
        await this.saveTask(task);
      }
    }

    await this.savePlan(plan);
    this.updateSystemState();
  }

  private async saveTask(task: Task): Promise<void> {
    const filePath = path.join(this.sharedPath, 'tasks', `${task.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(task, null, 2));
  }

  private async savePlan(plan: Plan): Promise<void> {
    const filePath = path.join(this.sharedPath, 'plans', `${plan.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(plan, null, 2));
  }

  private async updateSystemState(): Promise<void> {
    const state: SystemState = {
      activeClients: Array.from(this.clients.values()),
      activeTasks: Array.from(this.tasks.values()),
      activePlans: Array.from(this.plans.values()),
      reports: Array.from(this.reports.values()),
      lastUpdated: new Date()
    };

    const filePath = path.join(this.sharedPath, 'state', 'system.json');
    await fs.writeFile(filePath, JSON.stringify(state, null, 2));
  }

  public async loadExistingData(): Promise<void> {
    try {
      const tasksDir = path.join(this.sharedPath, 'tasks');
      const plansDir = path.join(this.sharedPath, 'plans');
      const reportsDir = path.join(this.sharedPath, 'reports');

      const taskFiles = await fs.readdir(tasksDir);
      for (const file of taskFiles) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(tasksDir, file), 'utf-8');
          const task: Task = JSON.parse(content);
          this.tasks.set(task.id, task);
        }
      }

      const planFiles = await fs.readdir(plansDir);
      for (const file of planFiles) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(plansDir, file), 'utf-8');
          const plan: Plan = JSON.parse(content);
          this.plans.set(plan.id, plan);
        }
      }

      const reportFiles = await fs.readdir(reportsDir);
      for (const file of reportFiles) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(reportsDir, file), 'utf-8');
          const report: ExecutionReport = JSON.parse(content);
          this.reports.set(report.id, report);
        }
      }
    } catch (error) {
      console.error('Error loading existing data:', error);
    }
  }

  public getClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  public getTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  public getPlans(): Plan[] {
    return Array.from(this.plans.values());
  }

  public cleanup(): void {
    if (this.watcher) {
      this.watcher.close();
    }
    this.autoPoller.cleanup();
  }

  private setupAutoPolling(): void {
    // Listen for poll events from AutoPoller
    this.autoPoller.on('poll', async (clientId: string) => {
      const result = await this.checkMessages(clientId);

      // Record activity if messages found
      if (result.hasMessages && result.messages.length > 0) {
        this.autoPoller.recordActivity(clientId, result.messages.length);

        // Auto-process messages for executors
        const client = this.clients.get(clientId);
        if (client?.role === 'executor') {
          for (const message of result.messages) {
            if (message.type === 'task') {
              console.log(`[AutoPoller] Auto-processing task for ${clientId}`);
              // Here you could trigger automatic task processing
            }
          }
        }
      }
    });
  }

  // ========== POLLING & MESSAGE QUEUE METHODS ==========

  public async checkMessages(clientId: string): Promise<any> {
    // Use the new auto-registration method
    this.autoRegisterClient(clientId);

    // Instant check - NO WAITING!
    const result = await this.messageQueue.checkMessages(clientId);

    // Add polling hint
    const hint = result.hasMessages
      ? 'Process messages and check again for more.'
      : 'No messages. Check again in a few seconds.';

    return { ...result, hint };
  }

  public async sendTaskToExecutor(task: Task, plannerId: string): Promise<void> {
    // Find available executors
    const executors = Array.from(this.clients.values()).filter(c => c.role === 'executor');

    if (executors.length === 0) {
      console.log('No executors available, queuing task...');
    }

    // Send to all executors (they will pick up via polling)
    for (const executor of executors) {
      await this.messageQueue.sendMessage(
        plannerId,
        executor.id,
        'task',
        {
          task,
          instruction: 'New task requires execution. Please process immediately.',
          suggestedTools: ['execute_step', 'submit_report']
        },
        'high'
      );
    }
  }

  public async sendPlanToExecutor(plan: Plan, plannerId: string): Promise<void> {
    // Send plan to assigned executors
    for (const [executorId, stepIds] of Object.entries(plan.executorAssignments)) {
      const steps = plan.steps.filter(s => stepIds.includes(s.id));

      await this.messageQueue.sendMessage(
        plannerId,
        executorId,
        'plan',
        {
          planId: plan.id,
          taskId: plan.taskId,
          assignedSteps: steps,
          instruction: 'You have been assigned steps in this plan. Execute them in order.',
          totalSteps: plan.steps.length
        },
        'high'
      );
    }
  }

  public async sendReportToPlanner(report: ExecutionReport, executorId: string): Promise<void> {
    const plan = this.plans.get(report.planId);
    if (!plan) return;

    await this.messageQueue.sendMessage(
      executorId,
      plan.plannerId,
      'report',
      {
        report,
        message: `Step ${report.stepId} execution ${report.status}`,
        needsReview: report.status === 'failed'
      },
      report.status === 'failed' ? 'urgent' : 'medium'
    );
  }

  public setTypingStatus(clientId: string, isTyping: boolean): void {
    this.messageQueue.setTyping(clientId, isTyping);
  }

  // ========== AUTO-POLL METHODS ==========

  public enableAutoPolling(clientId: string, enabled: boolean = true): void {
    if (enabled) {
      this.autoPollClients.add(clientId);
      console.log(`[AUTO-POLL] ✅ Enabled for ${clientId}`);
    } else {
      this.autoPollClients.delete(clientId);
      console.log(`[AUTO-POLL] ❌ Disabled for ${clientId}`);
    }
  }

  // Auto-detect and register clients when they first connect
  public autoRegisterClient(clientId: string): boolean {
    // Don't re-register existing clients
    if (this.clients.has(clientId)) {
      return false;
    }

    // Detect client type and role from ID patterns
    let clientName = clientId;
    let role: 'planner' | 'executor' = 'executor';

    // Check for known patterns
    if (clientId.toLowerCase().includes('claude')) {
      clientName = 'Claude';
      role = 'planner';
    } else if (clientId.toLowerCase().includes('codex')) {
      clientName = 'Codex';
      role = 'executor';
    } else if (clientId.toLowerCase().includes('planner')) {
      role = 'planner';
    } else if (clientId.toLowerCase().includes('executor')) {
      role = 'executor';
    }

    console.log(`[AUTO-REGISTER] New client detected: ${clientId} as ${clientName} (${role})`);

    // Create and register the client
    const clientInfo: ClientInfo = {
      id: clientId,
      name: clientName,
      role: role,
      status: 'active',
      registeredAt: new Date()
    };

    this.registerClient(clientInfo);

    // Enable auto-polling for this client
    this.enableAutoPolling(clientId, true);

    // Send welcome message
    this.messageQueue.sendMessage(
      'system',
      clientId,
      'message',
      {
        content: `Welcome ${clientName}! You've been auto-registered as ${role}. Auto-polling is enabled.`,
        timestamp: new Date()
      },
      'high'
    );

    return true;
  }

  public isAutoPollEnabled(clientId: string): boolean {
    return this.autoPollClients.has(clientId);
  }

  public async autoAssignRole(clientId: string, firstAction: string): Promise<'planner' | 'executor'> {
    // If first action is creating a task, they're a planner
    if (firstAction.includes('create_task') || firstAction.includes('create_plan')) {
      this.roleAssignments.set(clientId, 'planner');

      // Make others executors
      for (const [id, _] of this.clients) {
        if (id !== clientId && !this.roleAssignments.has(id)) {
          this.roleAssignments.set(id, 'executor');

          // Update their role
          const client = this.clients.get(id);
          if (client) {
            client.role = 'executor';
            this.clients.set(id, client);
          }
        }
      }

      return 'planner';
    }

    // Default to executor
    this.roleAssignments.set(clientId, 'executor');
    return 'executor';
  }
}
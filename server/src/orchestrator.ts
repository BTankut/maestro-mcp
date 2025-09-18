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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class Orchestrator {
  private clients: Map<string, ClientInfo> = new Map();
  private tasks: Map<string, Task> = new Map();
  private plans: Map<string, Plan> = new Map();
  private reports: Map<string, ExecutionReport> = new Map();
  private sharedPath: string;
  private watcher?: any;

  constructor() {
    this.sharedPath = path.join(__dirname, '../../shared');
    this.initializeDirectories();
    this.startFileWatcher();
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
  }
}
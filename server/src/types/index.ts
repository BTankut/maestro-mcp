export type ClientRole = 'planner' | 'executor';

export interface ClientInfo {
  id: string;
  role: ClientRole;
  name: string;
  connectedAt: Date;
  capabilities?: string[];
}

export interface Task {
  id: string;
  description: string;
  requirements: string[];
  assignedTo?: string;
  status: 'pending' | 'planning' | 'executing' | 'validating' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface Plan {
  id: string;
  taskId: string;
  plannerId: string;
  steps: Step[];
  executorAssignments: Record<string, string[]>;
  status: 'draft' | 'approved' | 'in_progress' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface Step {
  id: string;
  description: string;
  dependencies: string[];
  assignedExecutor?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  order: number;
}

export interface ExecutionReport {
  id: string;
  planId: string;
  stepId: string;
  executorId: string;
  results: any;
  errors?: string[];
  status: 'success' | 'failed' | 'partial';
  timestamp: Date;
}

export interface SystemState {
  activeClients: ClientInfo[];
  activeTasks: Task[];
  activePlans: Plan[];
  reports: ExecutionReport[];
  lastUpdated: Date;
}
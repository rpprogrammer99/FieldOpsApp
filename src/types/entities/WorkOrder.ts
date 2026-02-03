import {SyncableEntity} from './Base';

export type WorkOrderStatus =
  | 'pending'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'cancelled';

export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'critical';

export interface WorkOrder extends SyncableEntity {
  title: string;
  description: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  assigneeId: string | null;
  assetId: string | null;
  locationId: string | null;
  dueDate: string | null;
  completedAt: string | null;
  notes: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
}

export interface CreateWorkOrderInput {
  title: string;
  description: string;
  priority: WorkOrderPriority;
  assigneeId?: string;
  assetId?: string;
  locationId?: string;
  dueDate?: string;
  estimatedHours?: number;
}

export interface UpdateWorkOrderInput {
  title?: string;
  description?: string;
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  assigneeId?: string | null;
  assetId?: string | null;
  locationId?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
}

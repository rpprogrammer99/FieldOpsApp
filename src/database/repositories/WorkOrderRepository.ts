import {BaseRepository} from './BaseRepository';
import {TABLE_NAMES} from '../schema';
import type {
  WorkOrder,
  WorkOrderStatus,
  WorkOrderPriority,
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
  SyncStatus,
} from '../../types';

interface WorkOrderRow {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee_id: string | null;
  asset_id: string | null;
  location_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  tags: string | null;
  sync_status: string;
  local_version: number;
  server_version: number | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export class WorkOrderRepository extends BaseRepository<
  WorkOrder,
  CreateWorkOrderInput,
  UpdateWorkOrderInput
> {
  protected tableName = TABLE_NAMES.WORK_ORDERS;

  protected mapRowToEntity(row: Record<string, unknown>): WorkOrder {
    const r = row as WorkOrderRow;
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status as WorkOrderStatus,
      priority: r.priority as WorkOrderPriority,
      assigneeId: r.assignee_id,
      assetId: r.asset_id,
      locationId: r.location_id,
      dueDate: r.due_date,
      completedAt: r.completed_at,
      notes: r.notes,
      estimatedHours: r.estimated_hours,
      actualHours: r.actual_hours,
      syncStatus: r.sync_status as SyncStatus,
      localVersion: r.local_version,
      serverVersion: r.server_version,
      lastSyncedAt: r.last_synced_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  protected mapEntityToRow(entity: Partial<WorkOrder>): Record<string, unknown> {
    const row: Record<string, unknown> = {};

    if (entity.id !== undefined) row.id = entity.id;
    if (entity.title !== undefined) row.title = entity.title;
    if (entity.description !== undefined) row.description = entity.description;
    if (entity.status !== undefined) row.status = entity.status;
    if (entity.priority !== undefined) row.priority = entity.priority;
    if (entity.assigneeId !== undefined) row.assignee_id = entity.assigneeId;
    if (entity.assetId !== undefined) row.asset_id = entity.assetId;
    if (entity.locationId !== undefined) row.location_id = entity.locationId;
    if (entity.dueDate !== undefined) row.due_date = entity.dueDate;
    if (entity.completedAt !== undefined) row.completed_at = entity.completedAt;
    if (entity.notes !== undefined) row.notes = entity.notes;
    if (entity.estimatedHours !== undefined) row.estimated_hours = entity.estimatedHours;
    if (entity.actualHours !== undefined) row.actual_hours = entity.actualHours;
    if (entity.syncStatus !== undefined) row.sync_status = entity.syncStatus;
    if (entity.localVersion !== undefined) row.local_version = entity.localVersion;
    if (entity.serverVersion !== undefined) row.server_version = entity.serverVersion;
    if (entity.lastSyncedAt !== undefined) row.last_synced_at = entity.lastSyncedAt;
    if (entity.createdAt !== undefined) row.created_at = entity.createdAt;
    if (entity.updatedAt !== undefined) row.updated_at = entity.updatedAt;

    return row;
  }

  findByStatus(status: WorkOrderStatus): WorkOrder[] {
    return this.findAll({where: {status}, orderBy: 'createdAt', order: 'DESC'});
  }

  findByAssignee(assigneeId: string): WorkOrder[] {
    return this.findAll({where: {assigneeId}, orderBy: 'dueDate', order: 'ASC'});
  }

  findByAsset(assetId: string): WorkOrder[] {
    return this.findAll({where: {assetId}, orderBy: 'createdAt', order: 'DESC'});
  }

  findOverdue(): WorkOrder[] {
    const now = new Date().toISOString();
    const result = this.executeRaw(
      `SELECT * FROM ${this.tableName}
       WHERE due_date < ? AND status NOT IN ('completed', 'cancelled')
       ORDER BY due_date ASC;`,
      [now],
    );

    return result.rows._array.map(row =>
      this.mapRowToEntity(row as Record<string, unknown>),
    );
  }

  findUpcoming(days: number = 7): WorkOrder[] {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const result = this.executeRaw(
      `SELECT * FROM ${this.tableName}
       WHERE due_date BETWEEN ? AND ?
         AND status NOT IN ('completed', 'cancelled')
       ORDER BY due_date ASC;`,
      [now.toISOString(), future.toISOString()],
    );

    return result.rows._array.map(row =>
      this.mapRowToEntity(row as Record<string, unknown>),
    );
  }

  updateStatus(id: string, status: WorkOrderStatus): WorkOrder | null {
    const updates: UpdateWorkOrderInput = {status};

    if (status === 'completed') {
      updates.completedAt = new Date().toISOString();
    }

    return this.update(id, updates);
  }

  getStatistics(): {
    total: number;
    byStatus: Record<WorkOrderStatus, number>;
    overdue: number;
    pendingSync: number;
  } {
    const total = this.count();

    const statusResult = this.executeRaw(
      `SELECT status, COUNT(*) as count FROM ${this.tableName} GROUP BY status;`,
    );

    const byStatus: Record<WorkOrderStatus, number> = {
      pending: 0,
      in_progress: 0,
      on_hold: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const row of statusResult.rows._array) {
      const r = row as {status: WorkOrderStatus; count: number};
      byStatus[r.status] = r.count;
    }

    const overdueResult = this.executeRaw(
      `SELECT COUNT(*) as count FROM ${this.tableName}
       WHERE due_date < ? AND status NOT IN ('completed', 'cancelled');`,
      [new Date().toISOString()],
    );
    const overdue = (overdueResult.rows._array[0] as {count: number}).count;

    const pendingSync = this.count({syncStatus: 'pending'});

    return {total, byStatus, overdue, pendingSync};
  }
}

export const workOrderRepository = new WorkOrderRepository();

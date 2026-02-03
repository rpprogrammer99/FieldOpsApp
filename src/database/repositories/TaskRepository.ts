/**
 * TaskRepository - SQLite implementation
 *
 * Implements the ITaskRepository interface with:
 * - Full CRUD operations with sync tracking
 * - Optimistic updates with dirty field tracking
 * - Soft delete support
 * - Complex query building
 * - Transaction support for bulk operations
 */

import {databaseManager} from '../DatabaseManager';
import type {
  ITaskRepository,
  IPaginatedResult,
  IBulkResult,
  IQueryOptions,
  TaskStatistics,
} from './interfaces';
import {
  TABLE_NAME,
  type Task,
  type TaskRow,
  type CreateTaskInput,
  type UpdateTaskInput,
  type TaskFilters,
  type TaskStatus,
  type TaskPriority,
  type SyncStatus,
} from '../schema/TaskSchema';
import {generateUUID} from '../../shared/utils/uuid';

// ============================================================================
// ROW MAPPERS
// ============================================================================

/**
 * Convert database row (snake_case) to Task entity (camelCase)
 */
function mapRowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    assigneeId: row.assignee_id,
    projectId: row.project_id,
    parentTaskId: row.parent_task_id,
    dueDate: row.due_date,
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    completedAt: row.completed_at,
    tags: JSON.parse(row.tags || '[]'),
    metadata: JSON.parse(row.metadata || '{}'),
    estimatedMinutes: row.estimated_minutes,
    actualMinutes: row.actual_minutes,
    isDeleted: row.is_deleted === 1,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status as SyncStatus,
    localVersion: row.local_version,
    serverVersion: row.server_version,
    lastSyncedAt: row.last_synced_at,
    lastSyncError: row.last_sync_error,
    dirtyFields: JSON.parse(row.dirty_fields || '[]'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert Task entity fields to database row format
 */
function mapTaskToRow(task: Partial<Task>): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (task.id !== undefined) row.id = task.id;
  if (task.title !== undefined) row.title = task.title;
  if (task.description !== undefined) row.description = task.description;
  if (task.status !== undefined) row.status = task.status;
  if (task.priority !== undefined) row.priority = task.priority;
  if (task.assigneeId !== undefined) row.assignee_id = task.assigneeId;
  if (task.projectId !== undefined) row.project_id = task.projectId;
  if (task.parentTaskId !== undefined) row.parent_task_id = task.parentTaskId;
  if (task.dueDate !== undefined) row.due_date = task.dueDate;
  if (task.scheduledStart !== undefined) row.scheduled_start = task.scheduledStart;
  if (task.scheduledEnd !== undefined) row.scheduled_end = task.scheduledEnd;
  if (task.completedAt !== undefined) row.completed_at = task.completedAt;
  if (task.tags !== undefined) row.tags = JSON.stringify(task.tags);
  if (task.metadata !== undefined) row.metadata = JSON.stringify(task.metadata);
  if (task.estimatedMinutes !== undefined) row.estimated_minutes = task.estimatedMinutes;
  if (task.actualMinutes !== undefined) row.actual_minutes = task.actualMinutes;
  if (task.isDeleted !== undefined) row.is_deleted = task.isDeleted ? 1 : 0;
  if (task.deletedAt !== undefined) row.deleted_at = task.deletedAt;
  if (task.syncStatus !== undefined) row.sync_status = task.syncStatus;
  if (task.localVersion !== undefined) row.local_version = task.localVersion;
  if (task.serverVersion !== undefined) row.server_version = task.serverVersion;
  if (task.lastSyncedAt !== undefined) row.last_synced_at = task.lastSyncedAt;
  if (task.lastSyncError !== undefined) row.last_sync_error = task.lastSyncError;
  if (task.dirtyFields !== undefined) row.dirty_fields = JSON.stringify(task.dirtyFields);
  if (task.createdAt !== undefined) row.created_at = task.createdAt;
  if (task.updatedAt !== undefined) row.updated_at = task.updatedAt;

  return row;
}

// ============================================================================
// TASK REPOSITORY IMPLEMENTATION
// ============================================================================

export class TaskRepository implements ITaskRepository {
  // ==================== BASE READ OPERATIONS ====================

  findById(id: string): Task | null {
    const result = databaseManager.execute(
      `SELECT * FROM ${TABLE_NAME} WHERE id = ?;`,
      [id],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapRowToTask(result.rows._array[0] as TaskRow);
  }

  findAll(options?: IQueryOptions<Task>): Task[] {
    const {query, params} = this.buildSelectQuery(options);
    const result = databaseManager.execute(query, params);
    return result.rows._array.map(row => mapRowToTask(row as TaskRow));
  }

  findPaginated(
    page: number,
    pageSize: number,
    options?: IQueryOptions<Task>,
  ): IPaginatedResult<Task> {
    const total = this.count(options?.where);
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;

    const tasks = this.findAll({
      ...options,
      limit: pageSize,
      offset,
    });

    return {
      data: tasks,
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  count(where?: Partial<Record<keyof Task, unknown>>): number {
    let query = `SELECT COUNT(*) as count FROM ${TABLE_NAME} WHERE is_deleted = 0`;
    const params: unknown[] = [];

    if (where) {
      Object.entries(where).forEach(([key, value]) => {
        query += ` AND ${this.toSnakeCase(key)} = ?`;
        params.push(value);
      });
    }

    const result = databaseManager.execute(query, params);
    return (result.rows._array[0] as {count: number}).count;
  }

  exists(id: string): boolean {
    const result = databaseManager.execute(
      `SELECT 1 FROM ${TABLE_NAME} WHERE id = ? LIMIT 1;`,
      [id],
    );
    return result.rows.length > 0;
  }

  // ==================== BASE WRITE OPERATIONS ====================

  create(input: CreateTaskInput): Task {
    const now = new Date().toISOString();
    const id = generateUUID();

    const task: Partial<Task> = {
      id,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? 'pending',
      priority: input.priority ?? 'medium',
      assigneeId: input.assigneeId ?? null,
      projectId: input.projectId ?? null,
      parentTaskId: input.parentTaskId ?? null,
      dueDate: input.dueDate ?? null,
      scheduledStart: input.scheduledStart ?? null,
      scheduledEnd: input.scheduledEnd ?? null,
      completedAt: null,
      tags: input.tags ?? [],
      metadata: input.metadata ?? {},
      estimatedMinutes: input.estimatedMinutes ?? null,
      actualMinutes: null,
      isDeleted: false,
      deletedAt: null,
      // Sync metadata
      syncStatus: 'pending',
      localVersion: Date.now(),
      serverVersion: null,
      lastSyncedAt: null,
      lastSyncError: null,
      dirtyFields: [],
      // Timestamps
      createdAt: now,
      updatedAt: now,
    };

    const row = mapTaskToRow(task);
    const columns = Object.keys(row);
    const values = Object.values(row);
    const placeholders = columns.map(() => '?').join(', ');

    databaseManager.execute(
      `INSERT INTO ${TABLE_NAME} (${columns.join(', ')}) VALUES (${placeholders});`,
      values,
    );

    return this.findById(id)!;
  }

  update(id: string, input: UpdateTaskInput): Task | null {
    const existing = this.findById(id);
    if (!existing) {
      return null;
    }

    const now = new Date().toISOString();

    // Track which fields are being modified
    const dirtyFields = new Set(existing.dirtyFields);
    Object.keys(input).forEach(key => dirtyFields.add(key));

    const updates: Partial<Task> = {
      ...input,
      syncStatus: 'pending',
      localVersion: Date.now(),
      lastSyncError: null, // Clear any previous error
      dirtyFields: Array.from(dirtyFields),
      updatedAt: now,
    };

    // Handle status change to completed
    if (input.status === 'completed' && existing.status !== 'completed') {
      updates.completedAt = now;
    } else if (input.status && input.status !== 'completed') {
      updates.completedAt = null;
    }

    const row = mapTaskToRow(updates);
    const setClause = Object.keys(row)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = [...Object.values(row), id];

    databaseManager.execute(
      `UPDATE ${TABLE_NAME} SET ${setClause} WHERE id = ?;`,
      values,
    );

    return this.findById(id);
  }

  delete(id: string): boolean {
    const result = databaseManager.execute(
      `DELETE FROM ${TABLE_NAME} WHERE id = ?;`,
      [id],
    );
    return result.rowsAffected > 0;
  }

  softDelete(id: string): Task | null {
    const existing = this.findById(id);
    if (!existing) {
      return null;
    }

    const now = new Date().toISOString();

    databaseManager.execute(
      `UPDATE ${TABLE_NAME} SET
        is_deleted = 1,
        deleted_at = ?,
        sync_status = 'pending',
        local_version = ?,
        updated_at = ?
      WHERE id = ?;`,
      [now, Date.now(), now, id],
    );

    return this.findById(id);
  }

  restore(id: string): Task | null {
    const result = databaseManager.execute(
      `SELECT * FROM ${TABLE_NAME} WHERE id = ? AND is_deleted = 1;`,
      [id],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const now = new Date().toISOString();

    databaseManager.execute(
      `UPDATE ${TABLE_NAME} SET
        is_deleted = 0,
        deleted_at = NULL,
        sync_status = 'pending',
        local_version = ?,
        updated_at = ?
      WHERE id = ?;`,
      [Date.now(), now, id],
    );

    return this.findById(id);
  }

  // ==================== BULK OPERATIONS ====================

  bulkCreate(inputs: CreateTaskInput[]): IBulkResult {
    const errors: Array<{id: string; error: string}> = [];
    let successful = 0;

    databaseManager.transaction(() => {
      for (const input of inputs) {
        try {
          this.create(input);
          successful++;
        } catch (error) {
          errors.push({
            id: 'new',
            error: (error as Error).message,
          });
        }
      }
    });

    return {
      successful,
      failed: errors.length,
      errors,
    };
  }

  bulkUpdate(updates: Array<{id: string; input: UpdateTaskInput}>): IBulkResult {
    const errors: Array<{id: string; error: string}> = [];
    let successful = 0;

    databaseManager.transaction(() => {
      for (const {id, input} of updates) {
        try {
          const result = this.update(id, input);
          if (result) {
            successful++;
          } else {
            errors.push({id, error: 'Task not found'});
          }
        } catch (error) {
          errors.push({id, error: (error as Error).message});
        }
      }
    });

    return {
      successful,
      failed: errors.length,
      errors,
    };
  }

  bulkDelete(ids: string[]): IBulkResult {
    const errors: Array<{id: string; error: string}> = [];
    let successful = 0;

    databaseManager.transaction(() => {
      for (const id of ids) {
        try {
          if (this.delete(id)) {
            successful++;
          } else {
            errors.push({id, error: 'Task not found'});
          }
        } catch (error) {
          errors.push({id, error: (error as Error).message});
        }
      }
    });

    return {
      successful,
      failed: errors.length,
      errors,
    };
  }

  // ==================== SYNC OPERATIONS ====================

  findPendingSync(): Task[] {
    const result = databaseManager.execute(
      `SELECT * FROM ${TABLE_NAME}
       WHERE sync_status = 'pending'
       ORDER BY updated_at ASC;`,
    );
    return result.rows._array.map(row => mapRowToTask(row as TaskRow));
  }

  findFailedSync(): Task[] {
    const result = databaseManager.execute(
      `SELECT * FROM ${TABLE_NAME}
       WHERE sync_status = 'failed'
       ORDER BY updated_at DESC;`,
    );
    return result.rows._array.map(row => mapRowToTask(row as TaskRow));
  }

  findConflicts(): Task[] {
    const result = databaseManager.execute(
      `SELECT * FROM ${TABLE_NAME}
       WHERE sync_status = 'conflict'
       ORDER BY updated_at DESC;`,
    );
    return result.rows._array.map(row => mapRowToTask(row as TaskRow));
  }

  updateSyncStatus(id: string, status: SyncStatus, serverVersion?: number): void {
    const now = new Date().toISOString();
    const updates: string[] = ['sync_status = ?', 'updated_at = ?'];
    const params: unknown[] = [status, now];

    if (status === 'synced') {
      updates.push('last_synced_at = ?');
      params.push(now);

      updates.push('last_sync_error = NULL');
      updates.push('dirty_fields = ?');
      params.push('[]');

      if (serverVersion !== undefined) {
        updates.push('server_version = ?');
        params.push(serverVersion);
      }
    }

    params.push(id);

    databaseManager.execute(
      `UPDATE ${TABLE_NAME} SET ${updates.join(', ')} WHERE id = ?;`,
      params,
    );
  }

  updateFromServer(id: string, data: Partial<Task>, serverVersion: number): Task | null {
    const now = new Date().toISOString();

    const updates: Partial<Task> = {
      ...data,
      syncStatus: 'synced',
      serverVersion,
      lastSyncedAt: now,
      lastSyncError: null,
      dirtyFields: [],
      updatedAt: now,
    };

    const row = mapTaskToRow(updates);
    const setClause = Object.keys(row)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = [...Object.values(row), id];

    databaseManager.execute(
      `UPDATE ${TABLE_NAME} SET ${setClause} WHERE id = ?;`,
      values,
    );

    return this.findById(id);
  }

  markSyncFailed(id: string, error: string): void {
    const now = new Date().toISOString();

    databaseManager.execute(
      `UPDATE ${TABLE_NAME} SET
        sync_status = 'failed',
        last_sync_error = ?,
        updated_at = ?
      WHERE id = ?;`,
      [error, now, id],
    );
  }

  retrySyncFailed(id: string): void {
    const now = new Date().toISOString();

    databaseManager.execute(
      `UPDATE ${TABLE_NAME} SET
        sync_status = 'pending',
        last_sync_error = NULL,
        updated_at = ?
      WHERE id = ?;`,
      [now, id],
    );
  }

  getDirtyFields(id: string): string[] {
    const task = this.findById(id);
    return task?.dirtyFields ?? [];
  }

  // ==================== TASK-SPECIFIC QUERIES ====================

  findWithFilters(filters: TaskFilters): Task[] {
    const {query, params} = this.buildFilteredQuery(filters);
    const result = databaseManager.execute(query, params);
    return result.rows._array.map(row => mapRowToTask(row as TaskRow));
  }

  findByStatus(status: TaskStatus | TaskStatus[]): Task[] {
    const statuses = Array.isArray(status) ? status : [status];
    const placeholders = statuses.map(() => '?').join(', ');

    const result = databaseManager.execute(
      `SELECT * FROM ${TABLE_NAME}
       WHERE status IN (${placeholders}) AND is_deleted = 0
       ORDER BY updated_at DESC;`,
      statuses,
    );

    return result.rows._array.map(row => mapRowToTask(row as TaskRow));
  }

  findByAssignee(assigneeId: string): Task[] {
    const result = databaseManager.execute(
      `SELECT * FROM ${TABLE_NAME}
       WHERE assignee_id = ? AND is_deleted = 0
       ORDER BY due_date ASC, priority DESC;`,
      [assigneeId],
    );

    return result.rows._array.map(row => mapRowToTask(row as TaskRow));
  }

  findByProject(projectId: string): Task[] {
    const result = databaseManager.execute(
      `SELECT * FROM ${TABLE_NAME}
       WHERE project_id = ? AND is_deleted = 0
       ORDER BY status, due_date ASC;`,
      [projectId],
    );

    return result.rows._array.map(row => mapRowToTask(row as TaskRow));
  }

  findOverdue(): Task[] {
    const now = new Date().toISOString();

    const result = databaseManager.execute(
      `SELECT * FROM ${TABLE_NAME}
       WHERE due_date < ?
         AND status NOT IN ('completed', 'cancelled')
         AND is_deleted = 0
       ORDER BY due_date ASC;`,
      [now],
    );

    return result.rows._array.map(row => mapRowToTask(row as TaskRow));
  }

  findDueWithinDays(days: number): Task[] {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const result = databaseManager.execute(
      `SELECT * FROM ${TABLE_NAME}
       WHERE due_date BETWEEN ? AND ?
         AND status NOT IN ('completed', 'cancelled')
         AND is_deleted = 0
       ORDER BY due_date ASC;`,
      [now.toISOString(), future.toISOString()],
    );

    return result.rows._array.map(row => mapRowToTask(row as TaskRow));
  }

  findSubtasks(parentTaskId: string): Task[] {
    const result = databaseManager.execute(
      `SELECT * FROM ${TABLE_NAME}
       WHERE parent_task_id = ? AND is_deleted = 0
       ORDER BY created_at ASC;`,
      [parentTaskId],
    );

    return result.rows._array.map(row => mapRowToTask(row as TaskRow));
  }

  search(query: string, filters?: TaskFilters): Task[] {
    const searchTerm = `%${query}%`;
    let sql = `
      SELECT * FROM ${TABLE_NAME}
      WHERE (title LIKE ? OR description LIKE ?)
        AND is_deleted = 0
    `;
    const params: unknown[] = [searchTerm, searchTerm];

    if (filters) {
      const {filterSql, filterParams} = this.buildFilterClauses(filters);
      sql += filterSql;
      params.push(...filterParams);
    }

    sql += ' ORDER BY updated_at DESC LIMIT 50;';

    const result = databaseManager.execute(sql, params);
    return result.rows._array.map(row => mapRowToTask(row as TaskRow));
  }

  // ==================== TASK-SPECIFIC MUTATIONS ====================

  updateStatus(id: string, status: TaskStatus): Task | null {
    return this.update(id, {status});
  }

  assign(id: string, assigneeId: string | null): Task | null {
    return this.update(id, {assigneeId});
  }

  moveToProject(id: string, projectId: string | null): Task | null {
    return this.update(id, {projectId});
  }

  addTags(id: string, newTags: string[]): Task | null {
    const task = this.findById(id);
    if (!task) return null;

    const uniqueTags = [...new Set([...task.tags, ...newTags])];
    return this.update(id, {tags: uniqueTags});
  }

  removeTags(id: string, tagsToRemove: string[]): Task | null {
    const task = this.findById(id);
    if (!task) return null;

    const remaining = task.tags.filter(tag => !tagsToRemove.includes(tag));
    return this.update(id, {tags: remaining});
  }

  logTime(id: string, minutes: number): Task | null {
    const task = this.findById(id);
    if (!task) return null;

    const currentMinutes = task.actualMinutes ?? 0;
    return this.update(id, {actualMinutes: currentMinutes + minutes});
  }

  // ==================== STATISTICS ====================

  getStatistics(options?: {assigneeId?: string; projectId?: string}): TaskStatistics {
    let whereClause = 'WHERE is_deleted = 0';
    const params: unknown[] = [];

    if (options?.assigneeId) {
      whereClause += ' AND assignee_id = ?';
      params.push(options.assigneeId);
    }
    if (options?.projectId) {
      whereClause += ' AND project_id = ?';
      params.push(options.projectId);
    }

    // Total count
    const totalResult = databaseManager.execute(
      `SELECT COUNT(*) as count FROM ${TABLE_NAME} ${whereClause};`,
      params,
    );
    const total = (totalResult.rows._array[0] as {count: number}).count;

    // By status
    const statusResult = databaseManager.execute(
      `SELECT status, COUNT(*) as count FROM ${TABLE_NAME} ${whereClause} GROUP BY status;`,
      params,
    );
    const byStatus: Record<TaskStatus, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };
    statusResult.rows._array.forEach(row => {
      const r = row as {status: TaskStatus; count: number};
      byStatus[r.status] = r.count;
    });

    // By priority
    const priorityResult = databaseManager.execute(
      `SELECT priority, COUNT(*) as count FROM ${TABLE_NAME} ${whereClause} GROUP BY priority;`,
      params,
    );
    const byPriority: Record<TaskPriority, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    priorityResult.rows._array.forEach(row => {
      const r = row as {priority: TaskPriority; count: number};
      byPriority[r.priority] = r.count;
    });

    // Overdue
    const now = new Date().toISOString();
    const overdueResult = databaseManager.execute(
      `SELECT COUNT(*) as count FROM ${TABLE_NAME}
       ${whereClause}
       AND due_date < ?
       AND status NOT IN ('completed', 'cancelled');`,
      [...params, now],
    );
    const overdue = (overdueResult.rows._array[0] as {count: number}).count;

    // Completed this week
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const weekResult = databaseManager.execute(
      `SELECT COUNT(*) as count FROM ${TABLE_NAME}
       ${whereClause}
       AND status = 'completed'
       AND completed_at >= ?;`,
      [...params, weekAgo],
    );
    const completedThisWeek = (weekResult.rows._array[0] as {count: number}).count;

    // Average completion time
    const avgResult = databaseManager.execute(
      `SELECT AVG(actual_minutes) as avg FROM ${TABLE_NAME}
       ${whereClause}
       AND status = 'completed'
       AND actual_minutes IS NOT NULL;`,
      params,
    );
    const averageCompletionTime = (avgResult.rows._array[0] as {avg: number | null}).avg;

    // Pending sync
    const syncResult = databaseManager.execute(
      `SELECT COUNT(*) as count FROM ${TABLE_NAME}
       ${whereClause}
       AND sync_status = 'pending';`,
      params,
    );
    const pendingSync = (syncResult.rows._array[0] as {count: number}).count;

    return {
      total,
      byStatus,
      byPriority,
      overdue,
      completedThisWeek,
      averageCompletionTime,
      pendingSync,
    };
  }

  // ==================== PRIVATE HELPERS ====================

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  private buildSelectQuery(options?: IQueryOptions<Task>): {
    query: string;
    params: unknown[];
  } {
    let query = `SELECT * FROM ${TABLE_NAME} WHERE is_deleted = 0`;
    const params: unknown[] = [];

    if (options?.where) {
      Object.entries(options.where).forEach(([key, value]) => {
        query += ` AND ${this.toSnakeCase(key)} = ?`;
        params.push(value);
      });
    }

    if (options?.orderBy) {
      const order = options.order || 'ASC';
      query += ` ORDER BY ${this.toSnakeCase(options.orderBy as string)} ${order}`;
    }

    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    if (options?.offset) {
      query += ` OFFSET ${options.offset}`;
    }

    return {query: query + ';', params};
  }

  private buildFilteredQuery(filters: TaskFilters): {
    query: string;
    params: unknown[];
  } {
    let query = `SELECT * FROM ${TABLE_NAME} WHERE 1=1`;
    const params: unknown[] = [];

    const {filterSql, filterParams} = this.buildFilterClauses(filters);
    query += filterSql;
    params.push(...filterParams);

    query += ' ORDER BY due_date ASC, priority DESC;';

    return {query, params};
  }

  private buildFilterClauses(filters: TaskFilters): {
    filterSql: string;
    filterParams: unknown[];
  } {
    let filterSql = '';
    const filterParams: unknown[] = [];

    if (!filters.includeDeleted) {
      filterSql += ' AND is_deleted = 0';
    }

    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      const placeholders = statuses.map(() => '?').join(', ');
      filterSql += ` AND status IN (${placeholders})`;
      filterParams.push(...statuses);
    }

    if (filters.priority) {
      const priorities = Array.isArray(filters.priority)
        ? filters.priority
        : [filters.priority];
      const placeholders = priorities.map(() => '?').join(', ');
      filterSql += ` AND priority IN (${placeholders})`;
      filterParams.push(...priorities);
    }

    if (filters.assigneeId !== undefined) {
      if (filters.assigneeId === null) {
        filterSql += ' AND assignee_id IS NULL';
      } else {
        filterSql += ' AND assignee_id = ?';
        filterParams.push(filters.assigneeId);
      }
    }

    if (filters.projectId !== undefined) {
      if (filters.projectId === null) {
        filterSql += ' AND project_id IS NULL';
      } else {
        filterSql += ' AND project_id = ?';
        filterParams.push(filters.projectId);
      }
    }

    if (filters.dueBefore) {
      filterSql += ' AND due_date < ?';
      filterParams.push(filters.dueBefore);
    }

    if (filters.dueAfter) {
      filterSql += ' AND due_date > ?';
      filterParams.push(filters.dueAfter);
    }

    if (filters.syncStatus) {
      const statuses = Array.isArray(filters.syncStatus)
        ? filters.syncStatus
        : [filters.syncStatus];
      const placeholders = statuses.map(() => '?').join(', ');
      filterSql += ` AND sync_status IN (${placeholders})`;
      filterParams.push(...statuses);
    }

    return {filterSql, filterParams};
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const taskRepository = new TaskRepository();

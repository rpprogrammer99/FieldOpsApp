/**
 * Repository Pattern Interfaces
 *
 * These interfaces define the contract for data access layer operations.
 * Implementations handle SQLite specifics while consumers work with clean abstractions.
 */

import type {SyncStatus} from '../../schema/TaskSchema';

// ============================================================================
// BASE REPOSITORY INTERFACE
// ============================================================================

/**
 * Base interface for all syncable entities
 */
export interface ISyncableEntity {
  id: string;
  syncStatus: SyncStatus;
  localVersion: number;
  serverVersion: number | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Options for querying entities
 */
export interface IQueryOptions<T> {
  where?: Partial<Record<keyof T, unknown>>;
  orderBy?: keyof T;
  order?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

/**
 * Result of a paginated query
 */
export interface IPaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Bulk operation result
 */
export interface IBulkResult {
  successful: number;
  failed: number;
  errors: Array<{id: string; error: string}>;
}

/**
 * Base repository interface with CRUD operations
 */
export interface IBaseRepository<T extends ISyncableEntity, CreateInput, UpdateInput> {
  // ==================== READ OPERATIONS ====================

  /**
   * Find a single entity by ID
   */
  findById(id: string): T | null;

  /**
   * Find all entities matching optional criteria
   */
  findAll(options?: IQueryOptions<T>): T[];

  /**
   * Find entities with pagination
   */
  findPaginated(page: number, pageSize: number, options?: IQueryOptions<T>): IPaginatedResult<T>;

  /**
   * Count entities matching criteria
   */
  count(where?: Partial<Record<keyof T, unknown>>): number;

  /**
   * Check if an entity exists
   */
  exists(id: string): boolean;

  // ==================== WRITE OPERATIONS ====================

  /**
   * Create a new entity
   * - Generates client-side UUID
   * - Sets sync_status to 'pending'
   * - Sets local_version to current timestamp
   */
  create(input: CreateInput): T;

  /**
   * Update an existing entity
   * - Sets sync_status to 'pending'
   * - Updates local_version
   * - Tracks dirty fields for field-level sync
   */
  update(id: string, input: UpdateInput): T | null;

  /**
   * Delete an entity (hard delete)
   */
  delete(id: string): boolean;

  /**
   * Soft delete - marks for deletion and sync
   */
  softDelete(id: string): T | null;

  /**
   * Restore a soft-deleted entity
   */
  restore(id: string): T | null;

  // ==================== BULK OPERATIONS ====================

  /**
   * Create multiple entities in a transaction
   */
  bulkCreate(inputs: CreateInput[]): IBulkResult;

  /**
   * Update multiple entities
   */
  bulkUpdate(updates: Array<{id: string; input: UpdateInput}>): IBulkResult;

  /**
   * Delete multiple entities
   */
  bulkDelete(ids: string[]): IBulkResult;

  // ==================== SYNC OPERATIONS ====================

  /**
   * Find all entities pending sync
   */
  findPendingSync(): T[];

  /**
   * Find all entities with failed sync
   */
  findFailedSync(): T[];

  /**
   * Find entities with conflicts
   */
  findConflicts(): T[];

  /**
   * Update sync status after sync attempt
   */
  updateSyncStatus(id: string, status: SyncStatus, serverVersion?: number): void;

  /**
   * Update entity from server data (after successful sync or pull)
   */
  updateFromServer(id: string, data: Partial<T>, serverVersion: number): T | null;

  /**
   * Mark sync as failed with error message
   */
  markSyncFailed(id: string, error: string): void;

  /**
   * Clear sync error and retry
   */
  retrySyncFailed(id: string): void;

  /**
   * Get dirty fields for an entity (fields modified since last sync)
   */
  getDirtyFields(id: string): string[];
}

// ============================================================================
// TASK-SPECIFIC REPOSITORY INTERFACE
// ============================================================================

import type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
  TaskStatus,
  TaskPriority,
} from '../../schema/TaskSchema';

/**
 * Task-specific repository interface extending base with domain operations
 */
export interface ITaskRepository
  extends IBaseRepository<Task, CreateTaskInput, UpdateTaskInput> {
  // ==================== TASK-SPECIFIC QUERIES ====================

  /**
   * Find tasks with complex filters
   */
  findWithFilters(filters: TaskFilters): Task[];

  /**
   * Find tasks by status
   */
  findByStatus(status: TaskStatus | TaskStatus[]): Task[];

  /**
   * Find tasks by assignee
   */
  findByAssignee(assigneeId: string): Task[];

  /**
   * Find tasks by project
   */
  findByProject(projectId: string): Task[];

  /**
   * Find overdue tasks
   */
  findOverdue(): Task[];

  /**
   * Find tasks due within N days
   */
  findDueWithinDays(days: number): Task[];

  /**
   * Find subtasks of a parent task
   */
  findSubtasks(parentTaskId: string): Task[];

  /**
   * Search tasks by title/description
   */
  search(query: string, filters?: TaskFilters): Task[];

  // ==================== TASK-SPECIFIC MUTATIONS ====================

  /**
   * Update task status with automatic completedAt handling
   */
  updateStatus(id: string, status: TaskStatus): Task | null;

  /**
   * Assign task to user
   */
  assign(id: string, assigneeId: string | null): Task | null;

  /**
   * Move task to project
   */
  moveToProject(id: string, projectId: string | null): Task | null;

  /**
   * Add tags to task
   */
  addTags(id: string, tags: string[]): Task | null;

  /**
   * Remove tags from task
   */
  removeTags(id: string, tags: string[]): Task | null;

  /**
   * Log time spent on task
   */
  logTime(id: string, minutes: number): Task | null;

  // ==================== STATISTICS ====================

  /**
   * Get task statistics for a user or project
   */
  getStatistics(options?: {assigneeId?: string; projectId?: string}): TaskStatistics;
}

/**
 * Task statistics structure
 */
export interface TaskStatistics {
  total: number;
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  overdue: number;
  completedThisWeek: number;
  averageCompletionTime: number | null; // in minutes
  pendingSync: number;
}

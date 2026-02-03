/**
 * Task Schema Definition
 *
 * Designed for offline-first with comprehensive sync tracking:
 * - Client-generated UUIDs for immediate local storage
 * - Sync metadata (status, versions, timestamps) on every record
 * - Soft delete support for sync integrity
 * - Optimistic locking via version fields
 */

export const TABLE_NAME = 'tasks';

// ============================================================================
// SCHEMA DEFINITION
// ============================================================================

export const TASKS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
    -- Primary identifier (client-generated UUID)
    id TEXT PRIMARY KEY NOT NULL,

    -- Core task fields
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'medium'
      CHECK (priority IN ('low', 'medium', 'high', 'critical')),

    -- Assignment & relationships
    assignee_id TEXT,
    project_id TEXT,
    parent_task_id TEXT,

    -- Scheduling
    due_date TEXT,
    scheduled_start TEXT,
    scheduled_end TEXT,
    completed_at TEXT,

    -- Additional data
    tags TEXT DEFAULT '[]',           -- JSON array of tags
    metadata TEXT DEFAULT '{}',       -- JSON object for extensibility
    estimated_minutes INTEGER,
    actual_minutes INTEGER,

    -- Soft delete support
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,

    -- ========================================
    -- SYNC TRACKING FIELDS (Required for offline-first)
    -- ========================================

    -- Current sync state
    sync_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (sync_status IN ('synced', 'pending', 'failed', 'conflict')),

    -- Version tracking for conflict detection
    local_version INTEGER NOT NULL DEFAULT 0,  -- Timestamp of last local change
    server_version INTEGER,                     -- Version from server (null if never synced)

    -- Sync timestamps
    last_synced_at TEXT,                        -- When last successfully synced
    last_sync_error TEXT,                       -- Error message if sync_status = 'failed'

    -- Change tracking for field-level sync
    dirty_fields TEXT DEFAULT '[]',             -- JSON array of modified field names

    -- Audit timestamps
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    -- Foreign key constraints
    FOREIGN KEY (parent_task_id) REFERENCES ${TABLE_NAME}(id) ON DELETE SET NULL
  );
`;

// ============================================================================
// INDEXES FOR QUERY PERFORMANCE
// ============================================================================

export const TASKS_INDEXES = [
  // Primary query patterns
  `CREATE INDEX IF NOT EXISTS idx_tasks_status ON ${TABLE_NAME}(status) WHERE is_deleted = 0;`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_priority ON ${TABLE_NAME}(priority) WHERE is_deleted = 0;`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON ${TABLE_NAME}(assignee_id) WHERE is_deleted = 0;`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_project ON ${TABLE_NAME}(project_id) WHERE is_deleted = 0;`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON ${TABLE_NAME}(due_date) WHERE is_deleted = 0;`,

  // Sync-related indexes (critical for offline-first performance)
  `CREATE INDEX IF NOT EXISTS idx_tasks_sync_status ON ${TABLE_NAME}(sync_status);`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_pending_sync ON ${TABLE_NAME}(sync_status, updated_at)
    WHERE sync_status IN ('pending', 'failed');`,

  // Hierarchical queries
  `CREATE INDEX IF NOT EXISTS idx_tasks_parent ON ${TABLE_NAME}(parent_task_id) WHERE is_deleted = 0;`,

  // Soft delete queries
  `CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON ${TABLE_NAME}(is_deleted, deleted_at);`,

  // Combined index for common list queries
  `CREATE INDEX IF NOT EXISTS idx_tasks_list ON ${TABLE_NAME}(assignee_id, status, due_date)
    WHERE is_deleted = 0;`,
];

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type SyncStatus = 'synced' | 'pending' | 'failed' | 'conflict';

/**
 * Base sync metadata present on all syncable entities
 */
export interface SyncMetadata {
  syncStatus: SyncStatus;
  localVersion: number;
  serverVersion: number | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  dirtyFields: string[];
}

/**
 * Full Task entity as stored in SQLite and used in application
 */
export interface Task extends SyncMetadata {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  projectId: string | null;
  parentTaskId: string | null;
  dueDate: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  completedAt: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a new task
 */
export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  projectId?: string;
  parentTaskId?: string;
  dueDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  estimatedMinutes?: number;
}

/**
 * Input for updating an existing task
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  projectId?: string | null;
  parentTaskId?: string | null;
  dueDate?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  completedAt?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
}

/**
 * Raw database row structure (snake_case)
 */
export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  project_id: string | null;
  parent_task_id: string | null;
  due_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  completed_at: string | null;
  tags: string;
  metadata: string;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  is_deleted: number;
  deleted_at: string | null;
  sync_status: string;
  local_version: number;
  server_version: number | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
  dirty_fields: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// QUERY FILTERS
// ============================================================================

export interface TaskFilters {
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  assigneeId?: string | null;
  projectId?: string | null;
  dueBefore?: string;
  dueAfter?: string;
  syncStatus?: SyncStatus | SyncStatus[];
  includeDeleted?: boolean;
  search?: string;
}

export interface TaskQueryOptions {
  filters?: TaskFilters;
  orderBy?: keyof Task;
  order?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

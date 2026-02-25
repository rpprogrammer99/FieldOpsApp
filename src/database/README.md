# Local Database Layer - Offline-First Design

This document describes the local database layer implemented for the FieldOpsApp, an offline-first React Native application.

## Deliverables

| Deliverable | File | Status |
|---|---|---|
| Schema Definition | `schema/TaskSchema.ts` | Done |
| Repository Interfaces | `repositories/interfaces/IRepository.ts` | Done |
| Example Repository (TypeScript) | `repositories/TaskRepository.ts` | Done |
| Reusable Base Repository | `repositories/BaseRepository.ts` | Done |

---

## 1. Schema Definition (`schema/TaskSchema.ts`)

### SQLite Table

The `tasks` table contains 25+ columns organized into logical groups:

- **Core fields**: `id`, `title`, `description`, `status`, `priority`
- **Relationships**: `assignee_id`, `project_id`, `parent_task_id` (self-referencing FK)
- **Scheduling**: `due_date`, `scheduled_start`, `scheduled_end`, `completed_at`
- **Extensibility**: `tags` (JSON array), `metadata` (JSON object), `estimated_minutes`, `actual_minutes`
- **Soft delete**: `is_deleted`, `deleted_at`
- **Sync tracking**: `sync_status`, `local_version`, `server_version`, `last_synced_at`, `last_sync_error`, `dirty_fields`
- **Audit**: `created_at`, `updated_at`

### Constraints

- `status` is enforced via CHECK: `pending | in_progress | completed | cancelled`
- `priority` is enforced via CHECK: `low | medium | high | critical`
- `sync_status` is enforced via CHECK: `synced | pending | failed | conflict`
- Client-generated UUIDs as primary keys for immediate offline storage

### Indexes (10 total)

Partial indexes are used where applicable to exclude soft-deleted rows:

```
idx_tasks_status          - Filter by task status
idx_tasks_priority        - Filter by priority
idx_tasks_assignee        - Filter by assignee
idx_tasks_project         - Filter by project
idx_tasks_due_date        - Filter/sort by due date
idx_tasks_sync_status     - Find records by sync state
idx_tasks_pending_sync    - Composite: sync_status + updated_at (for sync queue)
idx_tasks_parent          - Hierarchical (subtask) queries
idx_tasks_deleted         - Soft delete queries
idx_tasks_list            - Composite: assignee + status + due_date (common list view)
```

### TypeScript Types

| Type | Purpose |
|---|---|
| `Task` | Full entity with all fields (camelCase) |
| `TaskRow` | Raw SQLite row (snake_case) |
| `CreateTaskInput` | Input for creating a task (only required fields mandatory) |
| `UpdateTaskInput` | Input for updating a task (all fields optional) |
| `TaskFilters` | Complex filter criteria (status, priority, assignee, date ranges, sync status) |
| `TaskQueryOptions` | Query options (filters, sorting, pagination) |
| `SyncMetadata` | Reusable sync fields interface |

---

## 2. Repository Interfaces (`repositories/interfaces/IRepository.ts`)

### `IBaseRepository<T, CreateInput, UpdateInput>`

Generic interface covering all syncable entities:

**Read Operations:**
- `findById(id)` - Single entity lookup
- `findAll(options?)` - Query with optional filters, sorting, pagination
- `findPaginated(page, pageSize, options?)` - Returns `IPaginatedResult<T>` with page metadata
- `count(where?)` - Count matching entities
- `exists(id)` - Existence check

**Write Operations:**
- `create(input)` - Creates with UUID, sets `sync_status = 'pending'`
- `update(id, input)` - Updates with dirty field tracking
- `delete(id)` - Hard delete
- `softDelete(id)` - Marks `is_deleted = 1`, sets sync to pending
- `restore(id)` - Restores soft-deleted record

**Bulk Operations:**
- `bulkCreate(inputs)` - Transactional batch insert
- `bulkUpdate(updates)` - Transactional batch update
- `bulkDelete(ids)` - Transactional batch delete
- All return `IBulkResult` with success/failure counts and per-record errors

**Sync Operations:**
- `findPendingSync()` - Records needing upload
- `findFailedSync()` - Records with sync errors
- `findConflicts()` - Records with version conflicts
- `updateSyncStatus(id, status, serverVersion?)` - Update after sync attempt
- `updateFromServer(id, data, serverVersion)` - Apply server data after pull
- `markSyncFailed(id, error)` - Record sync failure with error message
- `retrySyncFailed(id)` - Reset failed record to pending
- `getDirtyFields(id)` - Get list of locally modified fields

### `ITaskRepository`

Extends `IBaseRepository` with domain-specific operations:

- `findWithFilters(filters)` - Complex multi-criteria filtering
- `findByStatus(status)`, `findByAssignee(id)`, `findByProject(id)`
- `findOverdue()`, `findDueWithinDays(days)`, `findSubtasks(parentId)`
- `search(query, filters?)` - Full-text search on title/description
- `updateStatus(id, status)` - With automatic `completed_at` handling
- `assign(id, assigneeId)`, `moveToProject(id, projectId)`
- `addTags(id, tags)`, `removeTags(id, tags)`
- `logTime(id, minutes)` - Accumulate actual time spent
- `getStatistics(options?)` - Returns `TaskStatistics` (counts by status/priority, overdue, completion metrics, pending sync count)

---

## 3. Example Repository (`repositories/TaskRepository.ts`)

Full implementation of `ITaskRepository` (~900 lines):

### Key Implementation Details

- **Row mapping**: Bidirectional `mapRowToTask` / `mapTaskToRow` handles snake_case (SQLite) to camelCase (TypeScript) conversion, including JSON serialization for `tags`, `metadata`, and `dirty_fields`
- **Create**: Generates UUID via `generateUUID()`, sets `localVersion = Date.now()`, `syncStatus = 'pending'`
- **Update**: Accumulates dirty fields (union of existing + newly changed fields), clears previous sync errors, auto-sets `completedAt` when status changes to `completed`
- **Bulk operations**: Wrapped in `databaseManager.transaction()` for atomicity
- **Statistics**: Runs 7 aggregate queries (total, by status, by priority, overdue, completed this week, average completion time, pending sync)
- **Search**: LIKE-based search on `title` and `description` with optional filter overlays, limited to 50 results
- **Singleton export**: `taskRepository` instance ready for import

---

## 4. Reusable Base Repository (`repositories/BaseRepository.ts`)

Abstract class providing common CRUD + sync operations for all entities:

- Inherited by `WorkOrderRepository`, `InspectionRepository`, `AssetRepository`
- Subclasses implement: `tableName`, `mapRowToEntity()`, `mapEntityToRow()`
- Provides: `findById`, `findAll`, `findPending`, `findFailed`, `count`, `create`, `update`, `delete`, `softDelete`, `updateSyncStatus`, `updateFromServer`, `bulkInsert`
- `snakeCase()` / `camelCase()` utility methods for column name conversion

---

## 5. Sync Status Tracking Per Record

Every syncable record carries these fields:

| Field | Type | Purpose |
|---|---|---|
| `sync_status` | `synced \| pending \| failed \| conflict` | Current sync state |
| `local_version` | `INTEGER` (timestamp) | Incremented on every local change |
| `server_version` | `INTEGER \| null` | Last known server version (null = never synced) |
| `last_synced_at` | `TEXT \| null` | ISO timestamp of last successful sync |
| `last_sync_error` | `TEXT \| null` | Error message when `sync_status = 'failed'` |
| `dirty_fields` | `TEXT` (JSON array) | Which fields changed since last sync |

### Sync Lifecycle

```
[Create/Update locally]
    sync_status = 'pending'
    local_version = Date.now()
    dirty_fields = [...changed fields]
         │
         ▼
[Sync engine picks up pending records]
    findPendingSync() → sends to server
         │
    ┌────┴────┐
    ▼         ▼
[Success]  [Failure]
    │         │
    ▼         ▼
sync_status   sync_status
= 'synced'    = 'failed'
dirty_fields  last_sync_error
= []          = "error msg"
         │
         ▼
[Conflict detected (server_version mismatch)]
    sync_status = 'conflict'
    → Manual or automatic resolution
```

---

## 6. Database Manager (`DatabaseManager.ts`)

Singleton that manages the SQLite connection:

- **`initialize()`** - Opens database, enables foreign keys, creates tables, runs migrations
- **`execute(query, params?)`** - Parameterized query execution
- **`transaction(callback)`** - Wraps callback in `BEGIN/COMMIT/ROLLBACK`
- **`close()`** / **`reset()`** - Connection lifecycle management

---

## 7. Database Migrations (`migrations/index.ts`)

Version-ordered migration system:

| Version | Name | Changes |
|---|---|---|
| 1 | `initial_schema` | Base tables (created in `DatabaseManager.createTables()`) |
| 2 | `add_work_order_tags` | Adds `tags` column to work_orders |
| 3 | `add_inspection_templates` | Creates `inspection_templates` table, adds `template_id` to inspections |
| 4 | `add_sync_queue_idempotency` | Adds `idempotency_key`, `priority`, `updated_at` to sync_queue with indexes |

Migrations run inside individual transactions with automatic rollback on failure.

export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE';

export type SyncQueueStatus = 'pending' | 'processing' | 'failed' | 'completed';

export type EntityType = 'work_order' | 'inspection' | 'asset';

export interface SyncQueueItem {
  id: string;
  idempotencyKey: string;
  entityType: EntityType;
  entityId: string;
  operation: OperationType;
  payload: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
  retryCount: number;
  maxRetries: number;
  status: SyncQueueStatus;
  errorMessage: string | null;
  nextRetryAt: string | null;
}

export interface SyncResult {
  success: boolean;
  entityId: string;
  serverVersion?: number;
  error?: SyncError;
  resolvedData?: unknown;
}

export interface SyncError {
  code: SyncErrorCode;
  message: string;
  details?: unknown;
}

export type SyncErrorCode =
  | 'NETWORK_ERROR'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface ConflictData {
  entityType: EntityType;
  entityId: string;
  localData: unknown;
  serverData: unknown;
  localVersion: number;
  serverVersion: number;
}

export type ConflictResolutionStrategy =
  | 'LAST_WRITE_WINS'
  | 'SERVER_WINS'
  | 'CLIENT_WINS'
  | 'FIELD_LEVEL_MERGE'
  | 'MANUAL';

export interface ResolvedConflict {
  strategy: ConflictResolutionStrategy;
  resolvedData: unknown;
  resolvedVersion: number;
}

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingCount: number;
  failedCount: number;
  currentOperation: SyncQueueItem | null;
}

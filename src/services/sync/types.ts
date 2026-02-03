import type {EntityType, SyncQueueItem} from '../../types';

export interface SyncContext {
  entityType: EntityType;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  localData: unknown;
  localVersion: number;
}

export interface ServerResponse<T = unknown> {
  success: boolean;
  data?: T;
  serverVersion: number;
  conflict?: ConflictInfo<T>;
  error?: {
    code: string;
    message: string;
  };
}

export interface ConflictInfo<T = unknown> {
  serverData: T;
  serverVersion: number;
  conflictingFields?: string[];
}

export interface SyncEngineConfig {
  maxConcurrentSyncs: number;
  batchSize: number;
  retryDelayMs: number;
  maxRetries: number;
  conflictStrategy: ConflictStrategy;
}

export type ConflictStrategy =
  | 'last_write_wins'
  | 'server_wins'
  | 'client_wins'
  | 'field_level_merge'
  | 'manual';

export interface SyncEngineState {
  isRunning: boolean;
  isPaused: boolean;
  currentItem: SyncQueueItem | null;
  processedCount: number;
  errorCount: number;
  lastSyncTime: Date | null;
}

export interface SyncEventHandlers {
  onSyncStart?: () => void;
  onSyncComplete?: (results: SyncBatchResult) => void;
  onSyncError?: (error: Error) => void;
  onItemProcessed?: (item: SyncQueueItem, success: boolean) => void;
  onConflict?: (conflict: ConflictInfo) => void;
  onNetworkChange?: (isOnline: boolean) => void;
}

export interface SyncBatchResult {
  processed: number;
  succeeded: number;
  failed: number;
  conflicts: number;
  duration: number;
}

export interface MergeResult<T = unknown> {
  merged: T;
  strategy: ConflictStrategy;
  conflictResolved: boolean;
  manualResolutionRequired?: boolean;
}

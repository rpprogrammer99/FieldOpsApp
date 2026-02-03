export type SyncStatus = 'synced' | 'pending' | 'failed';

export interface SyncableEntity {
  id: string;
  syncStatus: SyncStatus;
  localVersion: number;
  serverVersion: number | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

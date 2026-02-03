import {syncQueueRepository} from '../../database';
import type {
  EntityType,
  OperationType,
  SyncQueueItem,
  SyncQueueStatus,
} from '../../types';

export interface QueuedOperation {
  entityType: EntityType;
  entityId: string;
  operation: OperationType;
  payload: unknown;
}

export class SyncQueue {
  private isProcessing = false;

  enqueue(operation: QueuedOperation): SyncQueueItem {
    // Check for existing pending operation for same entity
    const existing = syncQueueRepository.findByEntity(
      operation.entityType,
      operation.entityId,
    );

    const pendingExisting = existing.find(
      item => item.status === 'pending' || item.status === 'processing',
    );

    if (pendingExisting) {
      // If there's a pending CREATE and we're doing UPDATE, merge them
      if (pendingExisting.operation === 'CREATE' && operation.operation === 'UPDATE') {
        const mergedPayload = {
          ...JSON.parse(pendingExisting.payload),
          ...operation.payload,
        };

        syncQueueRepository.delete(pendingExisting.id);

        return syncQueueRepository.enqueue(
          operation.entityType,
          operation.entityId,
          'CREATE',
          mergedPayload,
        );
      }

      // If there's a pending operation and we're doing DELETE, remove pending and add DELETE
      if (operation.operation === 'DELETE') {
        syncQueueRepository.delete(pendingExisting.id);

        // If the pending was CREATE, we can skip the DELETE entirely
        if (pendingExisting.operation === 'CREATE') {
          // Entity was created and deleted offline, no sync needed
          return pendingExisting; // Return the old item (it's been deleted)
        }
      }

      // For UPDATE operations, merge with existing UPDATE
      if (
        pendingExisting.operation === 'UPDATE' &&
        operation.operation === 'UPDATE'
      ) {
        const mergedPayload = {
          ...JSON.parse(pendingExisting.payload),
          ...operation.payload,
        };

        syncQueueRepository.delete(pendingExisting.id);

        return syncQueueRepository.enqueue(
          operation.entityType,
          operation.entityId,
          'UPDATE',
          mergedPayload,
        );
      }
    }

    return syncQueueRepository.enqueue(
      operation.entityType,
      operation.entityId,
      operation.operation,
      operation.payload,
    );
  }

  dequeue(): SyncQueueItem | null {
    return syncQueueRepository.getNextOperation();
  }

  peek(): SyncQueueItem | null {
    const pending = syncQueueRepository.findPending();
    return pending[0] || null;
  }

  markProcessing(id: string): void {
    syncQueueRepository.markProcessing(id);
  }

  markCompleted(id: string): void {
    syncQueueRepository.markCompleted(id);
  }

  markFailed(id: string, error: string): void {
    syncQueueRepository.markFailed(id, error);
  }

  retry(id: string): void {
    syncQueueRepository.retryFailed(id);
  }

  retryAllFailed(): number {
    return syncQueueRepository.retryAllFailed();
  }

  remove(id: string): boolean {
    return syncQueueRepository.delete(id);
  }

  removeByEntity(entityType: EntityType, entityId: string): number {
    return syncQueueRepository.deleteByEntity(entityType, entityId);
  }

  clear(): void {
    syncQueueRepository.deleteCompleted();
  }

  getPending(): SyncQueueItem[] {
    return syncQueueRepository.findPending();
  }

  getFailed(): SyncQueueItem[] {
    return syncQueueRepository.findFailed();
  }

  getByEntity(entityType: EntityType, entityId: string): SyncQueueItem[] {
    return syncQueueRepository.findByEntity(entityType, entityId);
  }

  getStats(): {
    pending: number;
    processing: number;
    failed: number;
    completed: number;
  } {
    return syncQueueRepository.getQueueStats();
  }

  getPendingCount(): number {
    return syncQueueRepository.getPendingCount();
  }

  isEmpty(): boolean {
    return this.getPendingCount() === 0;
  }

  setProcessing(value: boolean): void {
    this.isProcessing = value;
  }

  getIsProcessing(): boolean {
    return this.isProcessing;
  }
}

export const syncQueue = new SyncQueue();

import {syncQueueRepository} from '../../database';
import type {
  EntityType,
  OperationType,
  SyncQueueItem,
} from '../../types';

export interface QueuedOperation {
  entityType: EntityType;
  entityId: string;
  operation: OperationType;
  payload: unknown;
  priority?: number;
}

export interface EnqueueResult {
  item: SyncQueueItem;
  isDuplicate: boolean;
  coalesced: boolean;
}

export class SyncQueue {
  private isProcessing = false;
  private processingIds = new Set<string>();

  /**
   * Initialize the queue - reset any stuck processing items
   */
  initialize(): void {
    const resetCount = syncQueueRepository.resetStuckProcessing();
    if (resetCount > 0) {
      console.log(`Reset ${resetCount} stuck processing items`);
    }
  }

  /**
   * Enqueue an operation with deduplication and coalescing
   */
  enqueue(operation: QueuedOperation): EnqueueResult {
    const {entityType, entityId, operation: opType, payload, priority = 5} = operation;

    // Generate idempotency key for duplicate detection
    const idempotencyKey = syncQueueRepository.generateIdempotencyKey(
      entityType,
      entityId,
      opType,
      payload,
    );

    // Check for exact duplicate (same idempotency key)
    const existingDuplicate = syncQueueRepository.findByIdempotencyKey(idempotencyKey);
    if (existingDuplicate) {
      return {
        item: existingDuplicate,
        isDuplicate: true,
        coalesced: false,
      };
    }

    // Check for existing pending operation for same entity (for coalescing)
    const existing = syncQueueRepository.findByEntity(entityType, entityId);
    const pendingExisting = existing.find(
      item =>
        (item.status === 'pending' || item.status === 'processing') &&
        !this.processingIds.has(item.id),
    );

    if (pendingExisting) {
      // If there's a pending CREATE and we're doing UPDATE, merge them
      if (pendingExisting.operation === 'CREATE' && opType === 'UPDATE') {
        const mergedPayload = {
          ...JSON.parse(pendingExisting.payload),
          ...(payload as object),
        };

        syncQueueRepository.delete(pendingExisting.id);

        const newItem = syncQueueRepository.enqueue(
          entityType,
          entityId,
          'CREATE',
          mergedPayload,
          Math.min(priority, pendingExisting.priority),
        );

        return {item: newItem, isDuplicate: false, coalesced: true};
      }

      // If there's a pending operation and we're doing DELETE
      if (opType === 'DELETE') {
        syncQueueRepository.delete(pendingExisting.id);

        // If the pending was CREATE, we can skip the DELETE entirely
        // Entity was created and deleted offline, no sync needed
        if (pendingExisting.operation === 'CREATE') {
          return {item: pendingExisting, isDuplicate: false, coalesced: true};
        }
      }

      // For UPDATE operations, merge with existing UPDATE
      if (pendingExisting.operation === 'UPDATE' && opType === 'UPDATE') {
        const mergedPayload = {
          ...JSON.parse(pendingExisting.payload),
          ...(payload as object),
        };

        syncQueueRepository.delete(pendingExisting.id);

        const newItem = syncQueueRepository.enqueue(
          entityType,
          entityId,
          'UPDATE',
          mergedPayload,
          Math.min(priority, pendingExisting.priority),
        );

        return {item: newItem, isDuplicate: false, coalesced: true};
      }
    }

    const item = syncQueueRepository.enqueue(
      entityType,
      entityId,
      opType,
      payload,
      priority,
    );

    return {item, isDuplicate: false, coalesced: false};
  }

  dequeue(): SyncQueueItem | null {
    return syncQueueRepository.getNextOperation();
  }

  peek(): SyncQueueItem | null {
    const pending = syncQueueRepository.findPending();
    return pending[0] || null;
  }

  getBatch(limit: number): SyncQueueItem[] {
    return syncQueueRepository.getBatch(limit);
  }

  markProcessing(id: string): void {
    this.processingIds.add(id);
    syncQueueRepository.markProcessing(id);
  }

  markCompleted(id: string): void {
    this.processingIds.delete(id);
    syncQueueRepository.markCompleted(id);
  }

  markFailed(id: string, error: string): void {
    this.processingIds.delete(id);
    syncQueueRepository.markFailed(id, error);
  }

  retry(id: string): void {
    syncQueueRepository.retryFailed(id);
  }

  retryAllFailed(): number {
    return syncQueueRepository.retryAllFailed();
  }

  remove(id: string): boolean {
    this.processingIds.delete(id);
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

  isItemProcessing(id: string): boolean {
    return this.processingIds.has(id);
  }

  getProcessingCount(): number {
    return this.processingIds.size;
  }
}

export const syncQueue = new SyncQueue();

import {useCallback} from 'react';
import {useAppDispatch} from './useAppDispatch';
import {syncQueue, syncEngine} from '../../services/sync';
import {updateQueueCounts} from '../../store';
import type {EntityType, OperationType} from '../../types';

export interface EnqueueOptions {
  priority?: number;
  triggerSync?: boolean;
}

export function useSyncQueue() {
  const dispatch = useAppDispatch();

  /**
   * Enqueue a sync operation with automatic deduplication
   */
  const enqueue = useCallback(
    async (
      entityType: EntityType,
      entityId: string,
      operation: OperationType,
      payload: Record<string, unknown>,
      options: EnqueueOptions = {},
    ) => {
      const {priority = 5, triggerSync = true} = options;

      const result = syncQueue.enqueue({
        entityType,
        entityId,
        operation,
        payload,
        priority,
      });

      // Update Redux state with new counts
      const stats = syncQueue.getStats();
      dispatch(
        updateQueueCounts({
          pending: stats.pending + stats.processing,
          failed: stats.failed,
        }),
      );

      // Optionally trigger sync immediately
      if (triggerSync && !syncEngine.isRunning()) {
        syncEngine.start();
      }

      return result;
    },
    [dispatch],
  );

  /**
   * Enqueue a CREATE operation
   */
  const enqueueCreate = useCallback(
    (
      entityType: EntityType,
      entityId: string,
      data: Record<string, unknown>,
      options?: EnqueueOptions,
    ) => enqueue(entityType, entityId, 'CREATE', data, options),
    [enqueue],
  );

  /**
   * Enqueue an UPDATE operation
   */
  const enqueueUpdate = useCallback(
    (
      entityType: EntityType,
      entityId: string,
      changes: Record<string, unknown>,
      options?: EnqueueOptions,
    ) => enqueue(entityType, entityId, 'UPDATE', changes, options),
    [enqueue],
  );

  /**
   * Enqueue a DELETE operation
   */
  const enqueueDelete = useCallback(
    (entityType: EntityType, entityId: string, options?: EnqueueOptions) =>
      enqueue(entityType, entityId, 'DELETE', {}, {...options, priority: 1}),
    [enqueue],
  );

  /**
   * Remove all pending operations for an entity
   */
  const cancelPending = useCallback(
    (entityType: EntityType, entityId: string) => {
      const removed = syncQueue.removeByEntity(entityType, entityId);

      if (removed > 0) {
        const stats = syncQueue.getStats();
        dispatch(
          updateQueueCounts({
            pending: stats.pending + stats.processing,
            failed: stats.failed,
          }),
        );
      }

      return removed;
    },
    [dispatch],
  );

  /**
   * Get pending operations for an entity
   */
  const getPendingForEntity = useCallback(
    (entityType: EntityType, entityId: string) =>
      syncQueue.getByEntity(entityType, entityId),
    [],
  );

  /**
   * Check if an entity has pending sync operations
   */
  const hasPendingSync = useCallback(
    (entityType: EntityType, entityId: string) => {
      const operations = syncQueue.getByEntity(entityType, entityId);
      return operations.some(
        op => op.status === 'pending' || op.status === 'processing',
      );
    },
    [],
  );

  return {
    enqueue,
    enqueueCreate,
    enqueueUpdate,
    enqueueDelete,
    cancelPending,
    getPendingForEntity,
    hasPendingSync,
  };
}

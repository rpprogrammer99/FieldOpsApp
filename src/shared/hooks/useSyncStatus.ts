import {useCallback} from 'react';
import {useAppDispatch, useAppSelector} from './useAppDispatch';
import {syncEngine, syncQueue} from '../../services/sync';
import {
  selectIsSyncing,
  selectPendingCount,
  selectFailedCount,
  selectLastSyncAt,
  selectHasConflicts,
  selectConflicts,
  syncStarted,
  syncCompleted,
  syncFailed,
  updateQueueCounts,
} from '../../store';

export function useSyncStatus() {
  const dispatch = useAppDispatch();
  const isSyncing = useAppSelector(selectIsSyncing);
  const pendingCount = useAppSelector(selectPendingCount);
  const failedCount = useAppSelector(selectFailedCount);
  const lastSyncAt = useAppSelector(selectLastSyncAt);
  const hasConflicts = useAppSelector(selectHasConflicts);
  const conflicts = useAppSelector(selectConflicts);

  const triggerSync = useCallback(async () => {
    if (isSyncing) return;

    dispatch(syncStarted());

    try {
      await syncEngine.syncNow();

      const stats = syncQueue.getStats();
      dispatch(
        syncCompleted({
          pendingCount: stats.pending + stats.processing,
          failedCount: stats.failed,
        }),
      );
    } catch (error) {
      dispatch(syncFailed((error as Error).message));
    }
  }, [dispatch, isSyncing]);

  const retryFailed = useCallback(() => {
    const retried = syncQueue.retryAllFailed();

    if (retried > 0) {
      const stats = syncQueue.getStats();
      dispatch(
        updateQueueCounts({
          pending: stats.pending + stats.processing,
          failed: stats.failed,
        }),
      );
      triggerSync();
    }
  }, [dispatch, triggerSync]);

  const refreshCounts = useCallback(() => {
    const stats = syncQueue.getStats();
    dispatch(
      updateQueueCounts({
        pending: stats.pending + stats.processing,
        failed: stats.failed,
      }),
    );
  }, [dispatch]);

  return {
    isSyncing,
    pendingCount,
    failedCount,
    lastSyncAt,
    hasConflicts,
    conflicts,
    hasPendingChanges: pendingCount > 0 || failedCount > 0,
    triggerSync,
    retryFailed,
    refreshCounts,
  };
}

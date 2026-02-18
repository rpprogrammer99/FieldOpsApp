import {Middleware, isAnyOf} from '@reduxjs/toolkit';
import {syncEngine, syncQueue} from '../../services/sync';
import {networkMonitor} from '../../services/network';
import {
  incrementPendingCount,
  updateQueueCounts,
  syncStarted,
  syncCompleted,
  syncFailed,
} from '../slices/syncSlice';
import {
  createWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
} from '../slices/workOrderSlice';

// Actions that should trigger sync count update
const syncTriggerActions = isAnyOf(
  createWorkOrder.fulfilled,
  updateWorkOrder.fulfilled,
  deleteWorkOrder.fulfilled,
);

export const syncMiddleware: Middleware = store => next => action => {
  const result = next(action);

  // Update sync queue counts after any mutation
  if (syncTriggerActions(action)) {
    store.dispatch(incrementPendingCount());

    // Trigger sync if online
    if (networkMonitor.isOnline() && !syncEngine.isRunning()) {
      triggerSync(store.dispatch as (action: unknown) => void);
    }
  }

  return result;
};

async function triggerSync(dispatch: (action: unknown) => void): Promise<void> {
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
}

// Network change handler - triggers sync when coming online
export function setupNetworkSyncTrigger(dispatch: (action: unknown) => void): () => void {
  return networkMonitor.subscribe(state => {
    if (state.status === 'online') {
      const pendingCount = syncQueue.getPendingCount();

      if (pendingCount > 0 && !syncEngine.isRunning()) {
        triggerSync(dispatch);
      }
    }

    // Update queue counts periodically
    const stats = syncQueue.getStats();
    dispatch(
      updateQueueCounts({
        pending: stats.pending + stats.processing,
        failed: stats.failed,
      }),
    );
  });
}

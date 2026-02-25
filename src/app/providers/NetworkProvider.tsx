import React, {useEffect, ReactNode} from 'react';
import {useAppDispatch} from '../../shared/hooks';
import {networkMonitor, backgroundSyncService} from '../../services/network';
import {syncEngine, syncQueue} from '../../services/sync';
import {setNetworkState, updateQueueCounts, loadWorkOrders} from '../../store';
import {setupNetworkSyncTrigger} from '../../store/middleware';

interface NetworkProviderProps {
  children: ReactNode;
}

export function NetworkProvider({children}: NetworkProviderProps) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function initializeNetwork() {
      // Initialize network monitor
      await networkMonitor.initialize();

      // Set initial state
      const state = networkMonitor.getState();
      dispatch(setNetworkState(state));

      // Initialize sync engine (resets stuck processing items)
      syncEngine.initialize();

      // Initialize background sync
      try {
        await backgroundSyncService.start();
      } catch (error) {
        console.warn('Background sync initialization failed:', error);
      }
    }

    initializeNetwork();

    // Setup sync trigger on network changes
    const unsubscribeNetwork = setupNetworkSyncTrigger(dispatch);

    // Subscribe to sync events to refresh data
    const unsubscribeSyncComplete = syncEngine.on('onSyncComplete', (result) => {
      // Refresh data when sync completes
      dispatch(loadWorkOrders());
      
      // Update queue counts
      const stats = syncQueue.getStats();
      dispatch(updateQueueCounts({
        pending: stats.pending + stats.processing,
        failed: stats.failed
      }));
    });

    const unsubscribeItemProcessed = syncEngine.on('onItemProcessed', () => {
      // Update queue counts as items are processed
      const stats = syncQueue.getStats();
      dispatch(updateQueueCounts({
        pending: stats.pending + stats.processing,
        failed: stats.failed
      }));
    });

    return () => {
      unsubscribeNetwork();
      unsubscribeSyncComplete();
      unsubscribeItemProcessed();
    };
  }, [dispatch]);

  return <>{children}</>;
}

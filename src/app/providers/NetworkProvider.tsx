import React, {useEffect, ReactNode} from 'react';
import {useAppDispatch} from '../../shared/hooks';
import {networkMonitor, backgroundSyncService} from '../../services/network';
import {setNetworkState} from '../../store';
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

      // Initialize background sync
      try {
        await backgroundSyncService.initialize();
      } catch (error) {
        console.warn('Background sync initialization failed:', error);
      }
    }

    initializeNetwork();

    // Setup sync trigger on network changes
    const unsubscribe = setupNetworkSyncTrigger(dispatch);

    return () => {
      unsubscribe();
    };
  }, [dispatch]);

  return <>{children}</>;
}

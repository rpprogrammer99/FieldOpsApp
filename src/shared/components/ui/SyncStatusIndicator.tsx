import React, {useEffect, useState, useCallback} from 'react';
import {View, Text, StyleSheet, Animated, TouchableOpacity} from 'react-native';
import {useAppSelector, useAppDispatch} from '../../../shared/hooks';
import {selectNetworkState} from '../../../store';
import {syncEngine, syncQueue} from '../../../services/sync';
import {syncStarted, syncCompleted, syncFailed} from '../../../store/slices/syncSlice';

export function SyncStatusIndicator() {
  const network = useAppSelector(selectNetworkState);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const spinValue = new Animated.Value(0);
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Initial counts
    setPendingCount(syncQueue.getPendingCount());

    const unsubscribeStart = syncEngine.on('onSyncStart', () => {
      setSyncState('syncing');
      dispatch(syncStarted());
      startSpin();
    });

    const unsubscribeComplete = syncEngine.on('onSyncComplete', (result) => {
      setSyncState('idle');
      dispatch(syncCompleted({
        pendingCount: syncQueue.getPendingCount(),
        failedCount: result.failed
      }));
      stopSpin();
      setPendingCount(syncQueue.getPendingCount());
    });

    const unsubscribeError = syncEngine.on('onSyncError', () => {
      setSyncState('error');
      // Dispatch generic error message if specific one isn't available
      dispatch(syncFailed("Sync process failed"));
      stopSpin();
    });

    const unsubscribeItem = syncEngine.on('onItemProcessed', () => {
      setPendingCount(syncQueue.getPendingCount());
    });
    
    // Listen for network changes to update pending count when coming online
    const unsubscribeNetwork = syncEngine.on('onNetworkChange', () => {
       setPendingCount(syncQueue.getPendingCount());
    });


    return () => {
      unsubscribeStart();
      unsubscribeComplete();
      unsubscribeError();
      unsubscribeItem();
      unsubscribeNetwork();
    };
  }, [dispatch]);

  const startSpin = () => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
  };

  const stopSpin = () => {
    spinValue.setValue(0);
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleManualSync = useCallback(async () => {
    if (syncState === 'syncing') return;
    
    // Optimistic UI update
    setSyncState('syncing');
    startSpin();
    
    try {
      await syncEngine.syncNow();
    } catch (e) {
      console.error("Manual sync failed", e);
      setSyncState('error');
      stopSpin();
    }
  }, [syncState]);

  if (!network.isConnected) {
    return (
      <View style={[styles.container, styles.offline]}>
        <Text style={styles.text}>Offline</Text>
        {pendingCount > 0 && (
          <Text style={styles.pendingText}>({pendingCount} pending)</Text>
        )}
      </View>
    );
  }

  if (syncState === 'syncing') {
    return (
      <View style={[styles.container, styles.syncing]}>
        <Animated.View style={{transform: [{rotate: spin}]}}>
          <View style={styles.spinner} />
        </Animated.View>
        <Text style={[styles.text, styles.syncingText]}>Syncing...</Text>
      </View>
    );
  }

  if (syncState === 'error') {
     return (
        <TouchableOpacity onPress={handleManualSync} style={[styles.container, styles.error]}>
            <Text style={styles.text}>Sync Failed (Tap to retry)</Text>
        </TouchableOpacity>
     );
  }

  return (
    <TouchableOpacity onPress={handleManualSync} style={[styles.container, styles.online]}>
      <Text style={[styles.text, styles.onlineText]}>
        {pendingCount > 0 ? `${pendingCount} Pending` : 'Synced'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  offline: {
    backgroundColor: '#8E8E93',
  },
  syncing: {
    backgroundColor: '#007AFF',
  },
  online: {
    backgroundColor: '#34C759',
  },
  error: {
      backgroundColor: '#FF3B30',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  syncingText: {
    marginLeft: 6,
  },
  onlineText: {
    color: '#FFFFFF',
  },
  pendingText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 4,
  },
  spinner: {
    width: 12,
    height: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderTopColor: 'transparent',
    borderRadius: 6,
  },
});

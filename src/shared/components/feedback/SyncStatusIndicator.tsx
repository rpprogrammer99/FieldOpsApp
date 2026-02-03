import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ActivityIndicator} from 'react-native';
import {useSyncStatus} from '../../hooks';
import {useNetworkStatus} from '../../hooks';

interface SyncStatusIndicatorProps {
  compact?: boolean;
}

export function SyncStatusIndicator({compact = false}: SyncStatusIndicatorProps) {
  const {isOnline} = useNetworkStatus();
  const {isSyncing, pendingCount, failedCount, triggerSync, retryFailed} = useSyncStatus();

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={[styles.dot, isOnline ? styles.dotOnline : styles.dotOffline]} />
        {pendingCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingCount}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <View style={[styles.dot, isOnline ? styles.dotOnline : styles.dotOffline]} />
        <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
      </View>

      {isSyncing && (
        <View style={styles.syncingRow}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.syncingText}>Syncing...</Text>
        </View>
      )}

      {!isSyncing && pendingCount > 0 && (
        <TouchableOpacity style={styles.pendingRow} onPress={triggerSync}>
          <Text style={styles.pendingText}>
            {pendingCount} pending {pendingCount === 1 ? 'change' : 'changes'}
          </Text>
          {isOnline && <Text style={styles.tapToSync}>Tap to sync</Text>}
        </TouchableOpacity>
      )}

      {!isSyncing && failedCount > 0 && (
        <TouchableOpacity style={styles.failedRow} onPress={retryFailed}>
          <Text style={styles.failedText}>
            {failedCount} failed - Tap to retry
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  dotOnline: {
    backgroundColor: '#34C759',
  },
  dotOffline: {
    backgroundColor: '#FF9500',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3C3C43',
  },
  syncingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  syncingText: {
    fontSize: 13,
    color: '#007AFF',
    marginLeft: 8,
  },
  pendingRow: {
    marginTop: 8,
  },
  pendingText: {
    fontSize: 13,
    color: '#FF9500',
  },
  tapToSync: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  failedRow: {
    marginTop: 8,
  },
  failedText: {
    fontSize: 13,
    color: '#FF3B30',
  },
  badge: {
    backgroundColor: '#FF9500',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

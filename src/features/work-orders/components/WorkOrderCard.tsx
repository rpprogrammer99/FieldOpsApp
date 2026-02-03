import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {Card, Badge} from '../../../shared/components';
import {formatRelativeTime, isOverdue} from '../../../shared/utils';
import type {WorkOrder} from '../../../types';

interface WorkOrderCardProps {
  workOrder: WorkOrder;
  onPress: () => void;
}

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  pending: 'default',
  in_progress: 'info',
  on_hold: 'warning',
  completed: 'success',
  cancelled: 'error',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#34C759',
  medium: '#FF9500',
  high: '#FF3B30',
  critical: '#AF52DE',
};

const SYNC_INDICATORS: Record<string, {color: string; label: string}> = {
  synced: {color: '#34C759', label: ''},
  pending: {color: '#FF9500', label: 'Pending sync'},
  failed: {color: '#FF3B30', label: 'Sync failed'},
};

export function WorkOrderCard({workOrder, onPress}: WorkOrderCardProps) {
  const dueDateOverdue = workOrder.dueDate && isOverdue(workOrder.dueDate);
  const syncInfo = SYNC_INDICATORS[workOrder.syncStatus];

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View
            style={[
              styles.priorityIndicator,
              {backgroundColor: PRIORITY_COLORS[workOrder.priority]},
            ]}
          />
          <Text style={styles.title} numberOfLines={1}>
            {workOrder.title}
          </Text>
        </View>
        <Badge
          label={workOrder.status.replace('_', ' ')}
          variant={STATUS_VARIANTS[workOrder.status]}
          size="small"
        />
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {workOrder.description}
      </Text>

      <View style={styles.footer}>
        <View style={styles.meta}>
          {workOrder.dueDate && (
            <Text style={[styles.dueDate, dueDateOverdue && styles.overdue]}>
              Due: {formatRelativeTime(workOrder.dueDate)}
            </Text>
          )}
        </View>

        <View style={styles.syncStatus}>
          {workOrder.syncStatus !== 'synced' && (
            <>
              <View style={[styles.syncDot, {backgroundColor: syncInfo.color}]} />
              <Text style={styles.syncText}>{syncInfo.label}</Text>
            </>
          )}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  priorityIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  description: {
    fontSize: 14,
    color: '#3C3C43',
    marginBottom: 12,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dueDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  overdue: {
    color: '#FF3B30',
    fontWeight: '500',
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  syncText: {
    fontSize: 11,
    color: '#8E8E93',
  },
});

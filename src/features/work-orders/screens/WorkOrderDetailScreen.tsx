import React, {useCallback} from 'react';
import {View, Text, StyleSheet, Alert, ScrollView} from 'react-native';
import {ScreenWrapper, Button, Badge, Card} from '../../../shared/components';
import {useWorkOrder, useWorkOrderMutations} from '../hooks';
import {formatDateTime, formatRelativeTime} from '../../../shared/utils';
import type {WorkOrderStackScreenProps, WorkOrderStatus} from '../../../types';

type Props = WorkOrderStackScreenProps<'WorkOrderDetail'>;

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  pending: 'default',
  in_progress: 'info',
  on_hold: 'warning',
  completed: 'success',
  cancelled: 'error',
};

const STATUS_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function WorkOrderDetailScreen({route, navigation}: Props) {
  const {id} = route.params;
  const workOrder = useWorkOrder(id);
  const {updateStatus, deleteWorkOrder} = useWorkOrderMutations();

  const handleStatusChange = useCallback(
    async (newStatus: WorkOrderStatus) => {
      try {
        await updateStatus(id, newStatus);
      } catch (error) {
        Alert.alert('Error', (error as Error).message);
      }
    },
    [id, updateStatus],
  );

  const handleEdit = useCallback(() => {
    navigation.navigate('WorkOrderEdit', {id});
  }, [id, navigation]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Work Order',
      'Are you sure you want to delete this work order?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWorkOrder(id);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', (error as Error).message);
            }
          },
        },
      ],
    );
  }, [id, deleteWorkOrder, navigation]);

  if (!workOrder) {
    return (
      <ScreenWrapper>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Work order not found</Text>
        </View>
      </ScreenWrapper>
    );
  }

  const availableTransitions = STATUS_TRANSITIONS[workOrder.status];

  return (
    <ScreenWrapper scrollable>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{workOrder.title}</Text>
          <Badge
            label={workOrder.status.replace('_', ' ')}
            variant={STATUS_VARIANTS[workOrder.status]}
          />
        </View>

        {workOrder.syncStatus !== 'synced' && (
          <Card variant="filled" style={styles.syncWarning}>
            <Text style={styles.syncWarningText}>
              {workOrder.syncStatus === 'pending'
                ? 'Changes pending sync'
                : 'Sync failed - will retry'}
            </Text>
          </Card>
        )}

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{workOrder.description}</Text>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Priority</Text>
            <Text style={styles.detailValue}>{workOrder.priority}</Text>
          </View>
          {workOrder.dueDate && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Due Date</Text>
              <Text style={styles.detailValue}>
                {formatRelativeTime(workOrder.dueDate)}
              </Text>
            </View>
          )}
          {workOrder.estimatedHours && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Estimated Hours</Text>
              <Text style={styles.detailValue}>{workOrder.estimatedHours}h</Text>
            </View>
          )}
          {workOrder.actualHours && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Actual Hours</Text>
              <Text style={styles.detailValue}>{workOrder.actualHours}h</Text>
            </View>
          )}
        </Card>

        {workOrder.notes && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{workOrder.notes}</Text>
          </Card>
        )}

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Created</Text>
            <Text style={styles.detailValue}>
              {formatDateTime(workOrder.createdAt)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Updated</Text>
            <Text style={styles.detailValue}>
              {formatDateTime(workOrder.updatedAt)}
            </Text>
          </View>
          {workOrder.completedAt && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Completed</Text>
              <Text style={styles.detailValue}>
                {formatDateTime(workOrder.completedAt)}
              </Text>
            </View>
          )}
        </Card>

        {availableTransitions.length > 0 && (
          <View style={styles.actions}>
            <Text style={styles.actionsTitle}>Update Status</Text>
            <View style={styles.statusButtons}>
              {availableTransitions.map(status => (
                <Button
                  key={status}
                  title={status.replace('_', ' ')}
                  variant={status === 'completed' ? 'primary' : 'outline'}
                  size="small"
                  onPress={() => handleStatusChange(status)}
                  style={styles.statusButton}
                />
              ))}
            </View>
          </View>
        )}

        <View style={styles.bottomActions}>
          <Button
            title="Edit"
            variant="outline"
            onPress={handleEdit}
            style={styles.bottomButton}
          />
          <Button
            title="Delete"
            variant="danger"
            onPress={handleDelete}
            style={styles.bottomButton}
          />
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
    marginRight: 12,
  },
  syncWarning: {
    marginBottom: 16,
  },
  syncWarningText: {
    fontSize: 14,
    color: '#FF9500',
    textAlign: 'center',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 16,
    color: '#3C3C43',
    lineHeight: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  detailLabel: {
    fontSize: 15,
    color: '#8E8E93',
  },
  detailValue: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '500',
  },
  notes: {
    fontSize: 15,
    color: '#3C3C43',
    lineHeight: 22,
  },
  actions: {
    marginBottom: 16,
  },
  actionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    marginRight: 8,
    marginBottom: 8,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 32,
  },
  bottomButton: {
    flex: 1,
  },
});

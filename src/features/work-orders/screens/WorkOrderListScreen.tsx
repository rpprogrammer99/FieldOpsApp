import React, {useCallback, useState} from 'react';
import {FlatList, StyleSheet, View, Text, RefreshControl} from 'react-native';
import {ScreenWrapper, Button, SyncStatusIndicator} from '../../../shared/components';
import {WorkOrderCard} from '../components';
import {useWorkOrders} from '../hooks';
import type {WorkOrderStackScreenProps} from '../../../types';
import type {WorkOrder} from '../../../types';

type Props = WorkOrderStackScreenProps<'WorkOrderList'>;

export function WorkOrderListScreen({navigation}: Props) {
  const {workOrders, isLoading, refresh} = useWorkOrders();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleWorkOrderPress = useCallback(
    (workOrder: WorkOrder) => {
      navigation.navigate('WorkOrderDetail', {id: workOrder.id});
    },
    [navigation],
  );

  const handleCreatePress = useCallback(() => {
    navigation.navigate('WorkOrderCreate');
  }, [navigation]);

  const renderItem = useCallback(
    ({item}: {item: WorkOrder}) => (
      <WorkOrderCard workOrder={item} onPress={() => handleWorkOrderPress(item)} />
    ),
    [handleWorkOrderPress],
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No work orders found</Text>
        <Text style={styles.emptySubtext}>
          Create a new work order to get started
        </Text>
      </View>
    );
  }, [isLoading]);

  const renderHeader = useCallback(
    () => (
      <View style={styles.header}>
        <SyncStatusIndicator />
      </View>
    ),
    [],
  );

  return (
    <ScreenWrapper edges={['bottom']}>
      <FlatList
        data={workOrders}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />
      <View style={styles.fab}>
        <Button title="+ New Work Order" onPress={handleCreatePress} />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3C3C43',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
});

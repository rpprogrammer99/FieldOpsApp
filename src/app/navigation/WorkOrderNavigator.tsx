import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {
  WorkOrderListScreen,
  WorkOrderDetailScreen,
  WorkOrderCreateScreen,
} from '../../features/work-orders';
import type {WorkOrderStackParamList} from '../../types';

const Stack = createNativeStackNavigator<WorkOrderStackParamList>();

export function WorkOrderNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerBackTitleVisible: false,
      }}>
      <Stack.Screen
        name="WorkOrderList"
        component={WorkOrderListScreen}
        options={{title: 'Work Orders'}}
      />
      <Stack.Screen
        name="WorkOrderDetail"
        component={WorkOrderDetailScreen}
        options={{title: 'Details'}}
      />
      <Stack.Screen
        name="WorkOrderCreate"
        component={WorkOrderCreateScreen}
        options={{
          title: 'New Work Order',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="WorkOrderEdit"
        component={WorkOrderCreateScreen}
        options={{
          title: 'Edit Work Order',
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>
  );
}

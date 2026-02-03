import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {MainNavigator} from './MainNavigator';
import type {RootStackParamList} from '../../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  // For now, we skip auth and go directly to main
  // In production, you'd check auth state and show auth flow if not logged in

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Main" component={MainNavigator} />
    </Stack.Navigator>
  );
}

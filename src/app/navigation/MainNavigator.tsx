import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {View, Text, StyleSheet} from 'react-native';
import {WorkOrderNavigator} from './WorkOrderNavigator';
import {SyncStatusIndicator} from '../../shared/components';
import type {MainTabParamList} from '../../types';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Placeholder screens for other tabs
function PlaceholderScreen({title}: {title: string}) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{title}</Text>
      <Text style={styles.placeholderSubtext}>Coming soon</Text>
    </View>
  );
}

function InspectionsPlaceholder() {
  return <PlaceholderScreen title="Inspections" />;
}

function AssetsPlaceholder() {
  return <PlaceholderScreen title="Assets" />;
}

function SettingsScreen() {
  return (
    <View style={styles.settings}>
      <Text style={styles.settingsTitle}>Settings</Text>
      <View style={styles.syncSection}>
        <Text style={styles.sectionLabel}>Sync Status</Text>
        <SyncStatusIndicator />
      </View>
    </View>
  );
}

export function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        headerShown: false,
      }}>
      <Tab.Screen
        name="WorkOrders"
        component={WorkOrderNavigator}
        options={{
          title: 'Work Orders',
          tabBarLabel: 'Work Orders',
        }}
      />
      <Tab.Screen
        name="Inspections"
        component={InspectionsPlaceholder}
        options={{
          title: 'Inspections',
          headerShown: true,
        }}
      />
      <Tab.Screen
        name="Assets"
        component={AssetsPlaceholder}
        options={{
          title: 'Assets',
          headerShown: true,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerShown: true,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#3C3C43',
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 16,
    color: '#8E8E93',
  },
  settings: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  settingsTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 24,
  },
  syncSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
});

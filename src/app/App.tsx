import React from 'react';
import {StatusBar} from 'react-native';
import {AppProviders} from './providers';
import {RootNavigator} from './navigation';

export default function App() {
  return (
    <AppProviders>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <RootNavigator />
    </AppProviders>
  );
}

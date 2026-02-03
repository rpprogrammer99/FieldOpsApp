import React, {ReactNode} from 'react';
import {Provider} from 'react-redux';
import {NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {store} from '../../store';
import {DatabaseProvider} from './DatabaseProvider';
import {NetworkProvider} from './NetworkProvider';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({children}: AppProvidersProps) {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <DatabaseProvider>
          <NetworkProvider>
            <NavigationContainer>{children}</NavigationContainer>
          </NetworkProvider>
        </DatabaseProvider>
      </Provider>
    </SafeAreaProvider>
  );
}

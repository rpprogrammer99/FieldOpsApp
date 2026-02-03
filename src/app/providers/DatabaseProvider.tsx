import React, {createContext, useContext, useEffect, useState, ReactNode} from 'react';
import {View, Text, StyleSheet, ActivityIndicator} from 'react-native';
import {databaseManager} from '../../database';

interface DatabaseContextValue {
  isReady: boolean;
  error: Error | null;
}

const DatabaseContext = createContext<DatabaseContextValue>({
  isReady: false,
  error: null,
});

export function useDatabaseReady() {
  return useContext(DatabaseContext);
}

interface DatabaseProviderProps {
  children: ReactNode;
}

export function DatabaseProvider({children}: DatabaseProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function initializeDatabase() {
      try {
        await databaseManager.initialize();
        setIsReady(true);
      } catch (err) {
        console.error('Database initialization failed:', err);
        setError(err as Error);
      }
    }

    initializeDatabase();
  }, []);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>Database Error</Text>
        <Text style={styles.errorMessage}>{error.message}</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Initializing...</Text>
      </View>
    );
  }

  return (
    <DatabaseContext.Provider value={{isReady, error}}>
      {children}
    </DatabaseContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#3C3C43',
    textAlign: 'center',
  },
});

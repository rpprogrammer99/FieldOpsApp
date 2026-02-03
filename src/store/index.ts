import {configureStore} from '@reduxjs/toolkit';
import {
  authReducer,
  networkReducer,
  syncReducer,
  workOrderReducer,
  uiReducer,
} from './slices';
import {syncMiddleware} from './middleware';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    network: networkReducer,
    sync: syncReducer,
    workOrders: workOrderReducer,
    ui: uiReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serializable check
        ignoredActions: ['sync/setCurrentOperation'],
        // Ignore these paths in the state
        ignoredPaths: ['sync.currentOperation'],
      },
    }).concat(syncMiddleware),
  devTools: __DEV__,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export * from './slices';
export * from './middleware';

import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {SyncQueueItem, ConflictData} from '../../types';

interface SyncSliceState {
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingCount: number;
  failedCount: number;
  currentOperation: SyncQueueItem | null;
  conflicts: ConflictData[];
  error: string | null;
}

const initialState: SyncSliceState = {
  isSyncing: false,
  lastSyncAt: null,
  pendingCount: 0,
  failedCount: 0,
  currentOperation: null,
  conflicts: [],
  error: null,
};

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    syncStarted(state) {
      state.isSyncing = true;
      state.error = null;
    },
    syncCompleted(state, action: PayloadAction<{pendingCount: number; failedCount: number}>) {
      state.isSyncing = false;
      state.lastSyncAt = new Date().toISOString();
      state.pendingCount = action.payload.pendingCount;
      state.failedCount = action.payload.failedCount;
      state.currentOperation = null;
    },
    syncFailed(state, action: PayloadAction<string>) {
      state.isSyncing = false;
      state.error = action.payload;
      state.currentOperation = null;
    },
    setCurrentOperation(state, action: PayloadAction<SyncQueueItem | null>) {
      state.currentOperation = action.payload;
    },
    updateQueueCounts(state, action: PayloadAction<{pending: number; failed: number}>) {
      state.pendingCount = action.payload.pending;
      state.failedCount = action.payload.failed;
    },
    incrementPendingCount(state) {
      state.pendingCount += 1;
    },
    decrementPendingCount(state) {
      state.pendingCount = Math.max(0, state.pendingCount - 1);
    },
    addConflict(state, action: PayloadAction<ConflictData>) {
      const existing = state.conflicts.findIndex(
        c => c.entityType === action.payload.entityType && c.entityId === action.payload.entityId,
      );
      if (existing >= 0) {
        state.conflicts[existing] = action.payload;
      } else {
        state.conflicts.push(action.payload);
      }
    },
    removeConflict(state, action: PayloadAction<{entityType: string; entityId: string}>) {
      state.conflicts = state.conflicts.filter(
        c => !(c.entityType === action.payload.entityType && c.entityId === action.payload.entityId),
      );
    },
    clearConflicts(state) {
      state.conflicts = [];
    },
    clearError(state) {
      state.error = null;
    },
  },
});

export const {
  syncStarted,
  syncCompleted,
  syncFailed,
  setCurrentOperation,
  updateQueueCounts,
  incrementPendingCount,
  decrementPendingCount,
  addConflict,
  removeConflict,
  clearConflicts,
  clearError,
} = syncSlice.actions;

export default syncSlice.reducer;

// Selectors
export const selectIsSyncing = (state: {sync: SyncSliceState}) => state.sync.isSyncing;
export const selectLastSyncAt = (state: {sync: SyncSliceState}) => state.sync.lastSyncAt;
export const selectPendingCount = (state: {sync: SyncSliceState}) => state.sync.pendingCount;
export const selectFailedCount = (state: {sync: SyncSliceState}) => state.sync.failedCount;
export const selectCurrentOperation = (state: {sync: SyncSliceState}) => state.sync.currentOperation;
export const selectConflicts = (state: {sync: SyncSliceState}) => state.sync.conflicts;
export const selectHasConflicts = (state: {sync: SyncSliceState}) => state.sync.conflicts.length > 0;
export const selectSyncError = (state: {sync: SyncSliceState}) => state.sync.error;
export const selectHasPendingSync = (state: {sync: SyncSliceState}) =>
  state.sync.pendingCount > 0 || state.sync.failedCount > 0;

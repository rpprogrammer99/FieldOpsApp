import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import type {WorkOrder, CreateWorkOrderInput, UpdateWorkOrderInput} from '../../types';
import {workOrderRepository} from '../../database';
import {syncQueue} from '../../services/sync';

interface WorkOrderState {
  items: WorkOrder[];
  selectedId: string | null;
  isLoading: boolean;
  error: string | null;
  filter: {
    status: string | null;
    assigneeId: string | null;
    search: string;
  };
}

const initialState: WorkOrderState = {
  items: [],
  selectedId: null,
  isLoading: false,
  error: null,
  filter: {
    status: null,
    assigneeId: null,
    search: '',
  },
};

// Async thunks
export const loadWorkOrders = createAsyncThunk(
  'workOrders/load',
  async (_, {rejectWithValue}) => {
    try {
      return workOrderRepository.findAll({orderBy: 'createdAt', order: 'DESC'});
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  },
);

export const createWorkOrder = createAsyncThunk(
  'workOrders/create',
  async (input: CreateWorkOrderInput, {rejectWithValue}) => {
    try {
      const workOrder = workOrderRepository.create(input);

      // Queue for sync
      syncQueue.enqueue({
        entityType: 'work_order',
        entityId: workOrder.id,
        operation: 'CREATE',
        payload: workOrder,
      });

      return workOrder;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  },
);

export const updateWorkOrder = createAsyncThunk(
  'workOrders/update',
  async ({id, input}: {id: string; input: UpdateWorkOrderInput}, {rejectWithValue}) => {
    try {
      const workOrder = workOrderRepository.update(id, input);

      if (!workOrder) {
        return rejectWithValue('Work order not found');
      }

      // Queue for sync
      syncQueue.enqueue({
        entityType: 'work_order',
        entityId: workOrder.id,
        operation: 'UPDATE',
        payload: input,
      });

      return workOrder;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  },
);

export const deleteWorkOrder = createAsyncThunk(
  'workOrders/delete',
  async (id: string, {rejectWithValue}) => {
    try {
      const workOrder = workOrderRepository.findById(id);

      if (!workOrder) {
        return rejectWithValue('Work order not found');
      }

      // If it was created offline and never synced, just delete locally
      if (workOrder.serverVersion === null) {
        workOrderRepository.delete(id);
        syncQueue.removeByEntity('work_order', id);
      } else {
        // Queue delete for sync
        syncQueue.enqueue({
          entityType: 'work_order',
          entityId: id,
          operation: 'DELETE',
          payload: {id},
        });
      }

      return id;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  },
);

const workOrderSlice = createSlice({
  name: 'workOrders',
  initialState,
  reducers: {
    setSelectedWorkOrder(state, action: PayloadAction<string | null>) {
      state.selectedId = action.payload;
    },
    setFilter(state, action: PayloadAction<Partial<WorkOrderState['filter']>>) {
      state.filter = {...state.filter, ...action.payload};
    },
    clearFilter(state) {
      state.filter = {status: null, assigneeId: null, search: ''};
    },
    updateWorkOrderLocally(state, action: PayloadAction<WorkOrder>) {
      const index = state.items.findIndex(item => item.id === action.payload.id);
      if (index >= 0) {
        state.items[index] = action.payload;
      } else {
        state.items.unshift(action.payload);
      }
    },
    removeWorkOrderLocally(state, action: PayloadAction<string>) {
      state.items = state.items.filter(item => item.id !== action.payload);
      if (state.selectedId === action.payload) {
        state.selectedId = null;
      }
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      // Load
      .addCase(loadWorkOrders.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadWorkOrders.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload;
      })
      .addCase(loadWorkOrders.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Create
      .addCase(createWorkOrder.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(createWorkOrder.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      // Update
      .addCase(updateWorkOrder.fulfilled, (state, action) => {
        const index = state.items.findIndex(item => item.id === action.payload.id);
        if (index >= 0) {
          state.items[index] = action.payload;
        }
      })
      .addCase(updateWorkOrder.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      // Delete
      .addCase(deleteWorkOrder.fulfilled, (state, action) => {
        state.items = state.items.filter(item => item.id !== action.payload);
        if (state.selectedId === action.payload) {
          state.selectedId = null;
        }
      })
      .addCase(deleteWorkOrder.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const {
  setSelectedWorkOrder,
  setFilter,
  clearFilter,
  updateWorkOrderLocally,
  removeWorkOrderLocally,
  clearError,
} = workOrderSlice.actions;

export default workOrderSlice.reducer;

// Selectors
export const selectAllWorkOrders = (state: {workOrders: WorkOrderState}) =>
  state.workOrders.items;

export const selectWorkOrderById = (id: string) => (state: {workOrders: WorkOrderState}) =>
  state.workOrders.items.find(item => item.id === id);

export const selectSelectedWorkOrder = (state: {workOrders: WorkOrderState}) =>
  state.workOrders.selectedId
    ? state.workOrders.items.find(item => item.id === state.workOrders.selectedId)
    : null;

export const selectFilteredWorkOrders = (state: {workOrders: WorkOrderState}) => {
  const {items, filter} = state.workOrders;

  return items.filter(item => {
    if (filter.status && item.status !== filter.status) return false;
    if (filter.assigneeId && item.assigneeId !== filter.assigneeId) return false;
    if (filter.search) {
      const search = filter.search.toLowerCase();
      return (
        item.title.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search)
      );
    }
    return true;
  });
};

export const selectWorkOrdersLoading = (state: {workOrders: WorkOrderState}) =>
  state.workOrders.isLoading;

export const selectWorkOrdersError = (state: {workOrders: WorkOrderState}) =>
  state.workOrders.error;

export const selectPendingWorkOrders = (state: {workOrders: WorkOrderState}) =>
  state.workOrders.items.filter(item => item.syncStatus === 'pending');

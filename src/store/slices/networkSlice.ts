import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {NetworkState} from '../../services/network';

interface NetworkSliceState {
  status: 'online' | 'offline' | 'unknown';
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: string;
  lastCheckedAt: string | null;
}

const initialState: NetworkSliceState = {
  status: 'unknown',
  isConnected: false,
  isInternetReachable: null,
  connectionType: 'unknown',
  lastCheckedAt: null,
};

const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    setNetworkState(state, action: PayloadAction<NetworkState>) {
      state.status = action.payload.status;
      state.isConnected = action.payload.isConnected;
      state.isInternetReachable = action.payload.isInternetReachable;
      state.connectionType = action.payload.type;
      state.lastCheckedAt = new Date().toISOString();
    },
    setOnline(state) {
      state.status = 'online';
      state.isConnected = true;
      state.lastCheckedAt = new Date().toISOString();
    },
    setOffline(state) {
      state.status = 'offline';
      state.isConnected = false;
      state.lastCheckedAt = new Date().toISOString();
    },
  },
});

export const {setNetworkState, setOnline, setOffline} = networkSlice.actions;
export default networkSlice.reducer;

// Selectors
export const selectIsOnline = (state: {network: NetworkSliceState}) =>
  state.network.status === 'online';

export const selectNetworkStatus = (state: {network: NetworkSliceState}) =>
  state.network.status;

export const selectConnectionType = (state: {network: NetworkSliceState}) =>
  state.network.connectionType;

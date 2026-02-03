import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {apiClient, setAuthTokens, clearAuthTokens} from '../../services/api';
import {ENDPOINTS} from '../../services/api/endpoints';
import type {User, AuthTokens, LoginRequest, LoginResponse} from '../../types';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: LoginRequest, {rejectWithValue}) => {
    try {
      const response = await apiClient.post<{data: LoginResponse}>(
        ENDPOINTS.AUTH.LOGIN,
        credentials,
      );

      const {user, tokens} = response.data.data;
      setAuthTokens(tokens);

      return {user, tokens};
    } catch (error) {
      return rejectWithValue((error as {message?: string}).message || 'Login failed');
    }
  },
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, {rejectWithValue}) => {
    try {
      await apiClient.post(ENDPOINTS.AUTH.LOGOUT);
      clearAuthTokens();
    } catch (error) {
      // Still clear tokens even if request fails
      clearAuthTokens();
      return rejectWithValue((error as {message?: string}).message || 'Logout failed');
    }
  },
);

export const refreshUser = createAsyncThunk(
  'auth/refreshUser',
  async (_, {rejectWithValue}) => {
    try {
      const response = await apiClient.get<{data: User}>(ENDPOINTS.AUTH.ME);
      return response.data.data;
    } catch (error) {
      return rejectWithValue((error as {message?: string}).message || 'Failed to refresh user');
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    setTokens(state, action: PayloadAction<AuthTokens>) {
      state.tokens = action.payload;
      setAuthTokens(action.payload);
    },
    clearAuth(state) {
      state.user = null;
      state.tokens = null;
      state.isAuthenticated = false;
      clearAuthTokens();
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      // Login
      .addCase(login.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.tokens = action.payload.tokens;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Logout
      .addCase(logout.pending, state => {
        state.isLoading = true;
      })
      .addCase(logout.fulfilled, state => {
        state.isLoading = false;
        state.user = null;
        state.tokens = null;
        state.isAuthenticated = false;
      })
      .addCase(logout.rejected, state => {
        state.isLoading = false;
        state.user = null;
        state.tokens = null;
        state.isAuthenticated = false;
      })
      // Refresh user
      .addCase(refreshUser.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const {setUser, setTokens, clearAuth, clearError} = authSlice.actions;
export default authSlice.reducer;

// Selectors
export const selectCurrentUser = (state: {auth: AuthState}) => state.auth.user;
export const selectIsAuthenticated = (state: {auth: AuthState}) => state.auth.isAuthenticated;
export const selectAuthLoading = (state: {auth: AuthState}) => state.auth.isLoading;
export const selectAuthError = (state: {auth: AuthState}) => state.auth.error;
export const selectUserRole = (state: {auth: AuthState}) => state.auth.user?.role;

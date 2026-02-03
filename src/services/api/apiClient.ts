import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import {API_CONFIG} from './endpoints';
import type {ApiError, AuthTokens} from '../../types';

let authTokens: AuthTokens | null = null;

export function setAuthTokens(tokens: AuthTokens | null): void {
  authTokens = tokens;
}

export function getAuthTokens(): AuthTokens | null {
  return authTokens;
}

export function clearAuthTokens(): void {
  authTokens = null;
}

const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor - adds auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (authTokens?.accessToken) {
      config.headers.Authorization = `Bearer ${authTokens.accessToken}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

// Response interceptor - handles errors and token refresh
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle 401 - attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newTokens = await refreshTokens();
        if (newTokens) {
          setAuthTokens(newTokens);
          originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Token refresh failed, clear tokens
        clearAuthTokens();
        // Emit event for auth failure
        authEventEmitter.emit('authFailure');
      }
    }

    // Transform error to standard format
    const apiError: ApiError = {
      code: error.response?.data?.code || 'UNKNOWN_ERROR',
      message: error.response?.data?.message || error.message || 'An error occurred',
      details: error.response?.data?.details,
      statusCode: error.response?.status || 500,
    };

    return Promise.reject(apiError);
  },
);

async function refreshTokens(): Promise<AuthTokens | null> {
  if (!authTokens?.refreshToken) {
    return null;
  }

  try {
    const response = await axios.post<{data: AuthTokens}>(
      `${API_CONFIG.BASE_URL}/auth/refresh`,
      {refreshToken: authTokens.refreshToken},
    );
    return response.data.data;
  } catch {
    return null;
  }
}

// Simple event emitter for auth events
type AuthEventHandler = () => void;
const authEventEmitter = {
  handlers: new Map<string, AuthEventHandler[]>(),
  emit(event: string) {
    const handlers = this.handlers.get(event) || [];
    handlers.forEach(handler => handler());
  },
  on(event: string, handler: AuthEventHandler) {
    const handlers = this.handlers.get(event) || [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
    return () => {
      const currentHandlers = this.handlers.get(event) || [];
      this.handlers.set(
        event,
        currentHandlers.filter(h => h !== handler),
      );
    };
  },
};

export {apiClient, authEventEmitter};

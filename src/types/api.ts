export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface SyncRequest<T> {
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entityId: string;
  data: T;
  localVersion: number;
}

export interface SyncResponse<T> {
  success: boolean;
  data?: T;
  serverVersion: number;
  conflict?: {
    serverData: T;
    serverVersion: number;
  };
}

export interface BulkSyncRequest {
  operations: Array<{
    entityType: string;
    entityId: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE';
    data: unknown;
    localVersion: number;
  }>;
}

export interface BulkSyncResponse {
  results: Array<{
    entityId: string;
    success: boolean;
    serverVersion?: number;
    error?: ApiError;
    conflict?: {
      serverData: unknown;
      serverVersion: number;
    };
  }>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'supervisor' | 'technician';
  avatarUrl?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

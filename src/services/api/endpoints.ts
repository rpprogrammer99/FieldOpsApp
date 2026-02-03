export const API_CONFIG = {
  BASE_URL: __DEV__
    ? 'http://localhost:3000/api/v1'
    : 'https://api.fieldops.example.com/v1',
  TIMEOUT: 30000,
};

export const ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
  },

  // Work Orders
  WORK_ORDERS: {
    LIST: '/work-orders',
    DETAIL: (id: string) => `/work-orders/${id}`,
    CREATE: '/work-orders',
    UPDATE: (id: string) => `/work-orders/${id}`,
    DELETE: (id: string) => `/work-orders/${id}`,
    SYNC: '/work-orders/sync',
  },

  // Inspections
  INSPECTIONS: {
    LIST: '/inspections',
    DETAIL: (id: string) => `/inspections/${id}`,
    CREATE: '/inspections',
    UPDATE: (id: string) => `/inspections/${id}`,
    DELETE: (id: string) => `/inspections/${id}`,
    SYNC: '/inspections/sync',
  },

  // Assets
  ASSETS: {
    LIST: '/assets',
    DETAIL: (id: string) => `/assets/${id}`,
    CREATE: '/assets',
    UPDATE: (id: string) => `/assets/${id}`,
    DELETE: (id: string) => `/assets/${id}`,
    SYNC: '/assets/sync',
  },

  // Sync
  SYNC: {
    BULK: '/sync/bulk',
    STATUS: '/sync/status',
    PULL: '/sync/pull',
  },
} as const;

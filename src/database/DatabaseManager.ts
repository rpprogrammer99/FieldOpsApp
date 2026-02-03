import {open, QuickSQLiteConnection} from 'react-native-quick-sqlite';
import {runMigrations} from './migrations';
import {
  WORK_ORDERS_SCHEMA,
  INSPECTIONS_SCHEMA,
  INSPECTION_ITEMS_SCHEMA,
  ASSETS_SCHEMA,
  SYNC_QUEUE_SCHEMA,
  MIGRATIONS_SCHEMA,
  KEY_VALUE_SCHEMA,
  INDEXES,
} from './schema';

const DATABASE_NAME = 'fieldops.db';

let db: QuickSQLiteConnection | null = null;

export interface DatabaseTransaction {
  execute: (query: string, params?: unknown[]) => QueryResult;
}

export interface QueryResult {
  rows: {
    _array: unknown[];
    length: number;
    item: (index: number) => unknown;
  };
  insertId?: number;
  rowsAffected: number;
}

export class DatabaseManager {
  private static instance: DatabaseManager;
  private connection: QuickSQLiteConnection | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.connection = open({name: DATABASE_NAME});
      db = this.connection;

      // Enable foreign keys
      this.connection.execute('PRAGMA foreign_keys = ON;');

      // Create initial schema
      await this.createTables();

      // Run migrations
      await runMigrations(this.connection);

      this.isInitialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.connection) {
      throw new Error('Database not initialized');
    }

    const schemas = [
      MIGRATIONS_SCHEMA,
      KEY_VALUE_SCHEMA,
      WORK_ORDERS_SCHEMA,
      INSPECTIONS_SCHEMA,
      INSPECTION_ITEMS_SCHEMA,
      ASSETS_SCHEMA,
      SYNC_QUEUE_SCHEMA,
    ];

    for (const schema of schemas) {
      this.connection.execute(schema);
    }

    for (const index of INDEXES) {
      this.connection.execute(index);
    }
  }

  getConnection(): QuickSQLiteConnection {
    if (!this.connection) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.connection;
  }

  execute(query: string, params?: unknown[]): QueryResult {
    const connection = this.getConnection();
    const result = connection.execute(query, params);

    return {
      rows: {
        _array: result.rows?._array ?? [],
        length: result.rows?.length ?? 0,
        item: (index: number) => result.rows?._array[index],
      },
      insertId: result.insertId,
      rowsAffected: result.rowsAffected,
    };
  }

  executeAsync(query: string, params?: unknown[]): Promise<QueryResult> {
    return new Promise((resolve, reject) => {
      try {
        const result = this.execute(query, params);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }

  transaction<T>(callback: (tx: DatabaseTransaction) => T): T {
    const connection = this.getConnection();

    connection.execute('BEGIN TRANSACTION;');

    try {
      const tx: DatabaseTransaction = {
        execute: (query: string, params?: unknown[]) => this.execute(query, params),
      };

      const result = callback(tx);

      connection.execute('COMMIT;');
      return result;
    } catch (error) {
      connection.execute('ROLLBACK;');
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
      db = null;
      this.isInitialized = false;
    }
  }

  async reset(): Promise<void> {
    await this.close();
    await this.initialize();
  }
}

export function getDatabase(): QuickSQLiteConnection {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export const databaseManager = DatabaseManager.getInstance();

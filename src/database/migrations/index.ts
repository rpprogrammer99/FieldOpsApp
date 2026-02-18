import type {QuickSQLiteConnection} from 'react-native-quick-sqlite';
import {TABLE_NAMES} from '../schema';

export interface Migration {
  version: number;
  name: string;
  up: (db: QuickSQLiteConnection) => void;
  down: (db: QuickSQLiteConnection) => void;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: (_db: QuickSQLiteConnection) => {
      // Initial schema is created in DatabaseManager.createTables()
      // This migration just marks the initial version
    },
    down: (db: QuickSQLiteConnection) => {
      db.execute(`DROP TABLE IF EXISTS ${TABLE_NAMES.SYNC_QUEUE};`);
      db.execute(`DROP TABLE IF EXISTS ${TABLE_NAMES.INSPECTION_ITEMS};`);
      db.execute(`DROP TABLE IF EXISTS ${TABLE_NAMES.INSPECTIONS};`);
      db.execute(`DROP TABLE IF EXISTS ${TABLE_NAMES.WORK_ORDERS};`);
      db.execute(`DROP TABLE IF EXISTS ${TABLE_NAMES.ASSETS};`);
      db.execute(`DROP TABLE IF EXISTS ${TABLE_NAMES.KEY_VALUE};`);
    },
  },
  {
    version: 4,
    name: 'add_sync_queue_idempotency',
    up: (db: QuickSQLiteConnection) => {
      // Add idempotency_key column
      db.execute(`
        ALTER TABLE ${TABLE_NAMES.SYNC_QUEUE}
        ADD COLUMN idempotency_key TEXT DEFAULT '';
      `);

      // Add priority column
      db.execute(`
        ALTER TABLE ${TABLE_NAMES.SYNC_QUEUE}
        ADD COLUMN priority INTEGER NOT NULL DEFAULT 5;
      `);

      // Add updated_at column
      db.execute(`
        ALTER TABLE ${TABLE_NAMES.SYNC_QUEUE}
        ADD COLUMN updated_at TEXT DEFAULT '';
      `);

      // Generate idempotency keys for existing records
      db.execute(`
        UPDATE ${TABLE_NAMES.SYNC_QUEUE}
        SET idempotency_key = entity_type || ':' || entity_id || ':' || operation || ':' || id,
            updated_at = created_at
        WHERE idempotency_key = '' OR idempotency_key IS NULL;
      `);

      // Add indexes
      db.execute(`
        CREATE INDEX IF NOT EXISTS idx_sync_queue_idempotency
        ON ${TABLE_NAMES.SYNC_QUEUE}(idempotency_key);
      `);
      db.execute(`
        CREATE INDEX IF NOT EXISTS idx_sync_queue_priority
        ON ${TABLE_NAMES.SYNC_QUEUE}(priority, created_at);
      `);
    },
    down: (db: QuickSQLiteConnection) => {
      db.execute('DROP INDEX IF EXISTS idx_sync_queue_idempotency;');
      db.execute('DROP INDEX IF EXISTS idx_sync_queue_priority;');
      // SQLite doesn't support DROP COLUMN in older versions
    },
  },
  {
    version: 2,
    name: 'add_work_order_tags',
    up: (db: QuickSQLiteConnection) => {
      db.execute(`
        ALTER TABLE ${TABLE_NAMES.WORK_ORDERS}
        ADD COLUMN tags TEXT DEFAULT '[]';
      `);
    },
    down: (db: QuickSQLiteConnection) => {
      // SQLite doesn't support DROP COLUMN directly in older versions
      // We'd need to recreate the table, but for simplicity we'll leave the column
      db.execute(`
        UPDATE ${TABLE_NAMES.WORK_ORDERS} SET tags = '[]';
      `);
    },
  },
  {
    version: 3,
    name: 'add_inspection_templates',
    up: (db: QuickSQLiteConnection) => {
      db.execute(`
        CREATE TABLE IF NOT EXISTS inspection_templates (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          items TEXT NOT NULL DEFAULT '[]',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      db.execute(`
        ALTER TABLE ${TABLE_NAMES.INSPECTIONS}
        ADD COLUMN template_id TEXT;
      `);
    },
    down: (db: QuickSQLiteConnection) => {
      db.execute('DROP TABLE IF EXISTS inspection_templates;');
    },
  },
];

export async function runMigrations(db: QuickSQLiteConnection): Promise<void> {
  const currentVersion = getCurrentVersion(db);
  const pendingMigrations = migrations
    .filter(m => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  if (pendingMigrations.length === 0) {
    console.log('No pending migrations');
    return;
  }

  console.log(`Running ${pendingMigrations.length} migrations...`);

  for (const migration of pendingMigrations) {
    try {
      console.log(`Running migration ${migration.version}: ${migration.name}`);

      db.execute('BEGIN TRANSACTION;');

      migration.up(db);

      db.execute(
        `INSERT INTO ${TABLE_NAMES.MIGRATIONS} (version, name, applied_at) VALUES (?, ?, ?);`,
        [migration.version, migration.name, new Date().toISOString()],
      );

      db.execute('COMMIT;');

      console.log(`Migration ${migration.version} completed`);
    } catch (error) {
      db.execute('ROLLBACK;');
      console.error(`Migration ${migration.version} failed:`, error);
      throw error;
    }
  }

  console.log('All migrations completed');
}

export function getCurrentVersion(db: QuickSQLiteConnection): number {
  try {
    const result = db.execute(
      `SELECT MAX(version) as version FROM ${TABLE_NAMES.MIGRATIONS};`,
    );

    const version = result.rows?._array[0]?.version;
    return typeof version === 'number' ? version : 0;
  } catch {
    return 0;
  }
}

export function rollbackMigration(db: QuickSQLiteConnection, toVersion: number): void {
  const currentVersion = getCurrentVersion(db);

  if (toVersion >= currentVersion) {
    console.log('Nothing to rollback');
    return;
  }

  const migrationsToRollback = migrations
    .filter(m => m.version > toVersion && m.version <= currentVersion)
    .reverse();

  for (const migration of migrationsToRollback) {
    try {
      console.log(`Rolling back migration ${migration.version}: ${migration.name}`);

      db.execute('BEGIN TRANSACTION;');

      migration.down(db);

      db.execute(`DELETE FROM ${TABLE_NAMES.MIGRATIONS} WHERE version = ?;`, [
        migration.version,
      ]);

      db.execute('COMMIT;');

      console.log(`Rollback ${migration.version} completed`);
    } catch (error) {
      db.execute('ROLLBACK;');
      console.error(`Rollback ${migration.version} failed:`, error);
      throw error;
    }
  }
}

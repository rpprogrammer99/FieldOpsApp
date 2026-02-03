import {databaseManager, QueryResult} from '../DatabaseManager';
import type {SyncableEntity, SyncStatus} from '../../types';
import {generateUUID} from '../../shared/utils/uuid';

export interface FindOptions {
  where?: Record<string, unknown>;
  orderBy?: string;
  order?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface SyncableRecord {
  sync_status: string;
  local_version: number;
  server_version: number | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export abstract class BaseRepository<T extends SyncableEntity, CreateInput, UpdateInput> {
  protected abstract tableName: string;
  protected abstract mapRowToEntity(row: Record<string, unknown>): T;
  protected abstract mapEntityToRow(entity: Partial<T>): Record<string, unknown>;

  protected snakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  protected camelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  findById(id: string): T | null {
    const result = databaseManager.execute(
      `SELECT * FROM ${this.tableName} WHERE id = ?;`,
      [id],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows._array[0] as Record<string, unknown>);
  }

  findAll(options?: FindOptions): T[] {
    let query = `SELECT * FROM ${this.tableName}`;
    const params: unknown[] = [];

    if (options?.where) {
      const conditions = Object.entries(options.where).map(([key, value]) => {
        params.push(value);
        return `${this.snakeCase(key)} = ?`;
      });
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    if (options?.orderBy) {
      query += ` ORDER BY ${this.snakeCase(options.orderBy)} ${options.order || 'ASC'}`;
    }

    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    if (options?.offset) {
      query += ` OFFSET ${options.offset}`;
    }

    const result = databaseManager.execute(query, params);

    return result.rows._array.map(row =>
      this.mapRowToEntity(row as Record<string, unknown>),
    );
  }

  findPending(): T[] {
    return this.findAll({where: {syncStatus: 'pending'}});
  }

  findFailed(): T[] {
    return this.findAll({where: {syncStatus: 'failed'}});
  }

  count(where?: Record<string, unknown>): number {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params: unknown[] = [];

    if (where) {
      const conditions = Object.entries(where).map(([key, value]) => {
        params.push(value);
        return `${this.snakeCase(key)} = ?`;
      });
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const result = databaseManager.execute(query, params);
    return (result.rows._array[0] as {count: number}).count;
  }

  create(input: CreateInput): T {
    const now = new Date().toISOString();
    const id = generateUUID();

    const entity: Partial<T> = {
      ...(input as object),
      id,
      syncStatus: 'pending' as SyncStatus,
      localVersion: Date.now(),
      serverVersion: null,
      lastSyncedAt: null,
      createdAt: now,
      updatedAt: now,
    } as Partial<T>;

    const row = this.mapEntityToRow(entity);
    const columns = Object.keys(row);
    const values = Object.values(row);
    const placeholders = columns.map(() => '?').join(', ');

    databaseManager.execute(
      `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders});`,
      values,
    );

    return this.findById(id)!;
  }

  update(id: string, input: UpdateInput): T | null {
    const existing = this.findById(id);
    if (!existing) {
      return null;
    }

    const now = new Date().toISOString();
    const updates: Partial<T> = {
      ...(input as object),
      syncStatus: 'pending' as SyncStatus,
      localVersion: Date.now(),
      updatedAt: now,
    } as Partial<T>;

    const row = this.mapEntityToRow(updates);
    const setClause = Object.keys(row)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = [...Object.values(row), id];

    databaseManager.execute(
      `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?;`,
      values,
    );

    return this.findById(id);
  }

  delete(id: string): boolean {
    const result = databaseManager.execute(
      `DELETE FROM ${this.tableName} WHERE id = ?;`,
      [id],
    );

    return result.rowsAffected > 0;
  }

  softDelete(id: string): T | null {
    // For syncable entities, we mark for deletion and sync
    // The actual deletion happens after successful server sync
    const existing = this.findById(id);
    if (!existing) {
      return null;
    }

    databaseManager.execute(
      `UPDATE ${this.tableName} SET
        sync_status = 'pending',
        local_version = ?,
        updated_at = ?
      WHERE id = ?;`,
      [Date.now(), new Date().toISOString(), id],
    );

    return this.findById(id);
  }

  updateSyncStatus(
    id: string,
    status: SyncStatus,
    serverVersion?: number,
  ): void {
    const updates: string[] = [
      'sync_status = ?',
      'updated_at = ?',
    ];
    const params: unknown[] = [status, new Date().toISOString()];

    if (status === 'synced') {
      updates.push('last_synced_at = ?');
      params.push(new Date().toISOString());

      if (serverVersion !== undefined) {
        updates.push('server_version = ?');
        params.push(serverVersion);
      }
    }

    params.push(id);

    databaseManager.execute(
      `UPDATE ${this.tableName} SET ${updates.join(', ')} WHERE id = ?;`,
      params,
    );
  }

  updateFromServer(id: string, data: Partial<T>, serverVersion: number): T | null {
    const row = this.mapEntityToRow({
      ...data,
      syncStatus: 'synced' as SyncStatus,
      serverVersion,
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Partial<T>);

    const setClause = Object.keys(row)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = [...Object.values(row), id];

    databaseManager.execute(
      `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?;`,
      values,
    );

    return this.findById(id);
  }

  bulkInsert(entities: CreateInput[]): T[] {
    return databaseManager.transaction(() => {
      return entities.map(entity => this.create(entity));
    });
  }

  protected executeRaw(query: string, params?: unknown[]): QueryResult {
    return databaseManager.execute(query, params);
  }
}

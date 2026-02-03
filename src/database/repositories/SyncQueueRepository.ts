import {databaseManager} from '../DatabaseManager';
import {TABLE_NAMES} from '../schema';
import type {
  SyncQueueItem,
  SyncQueueStatus,
  OperationType,
  EntityType,
} from '../../types';
import {generateUUID} from '../../shared/utils/uuid';

interface SyncQueueRow {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: string;
  payload: string;
  created_at: string;
  processed_at: string | null;
  retry_count: number;
  max_retries: number;
  status: string;
  error_message: string | null;
  next_retry_at: string | null;
}

export class SyncQueueRepository {
  private tableName = TABLE_NAMES.SYNC_QUEUE;

  private mapRowToEntity(row: SyncQueueRow): SyncQueueItem {
    return {
      id: row.id,
      entityType: row.entity_type as EntityType,
      entityId: row.entity_id,
      operation: row.operation as OperationType,
      payload: row.payload,
      createdAt: row.created_at,
      processedAt: row.processed_at,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      status: row.status as SyncQueueStatus,
      errorMessage: row.error_message,
      nextRetryAt: row.next_retry_at,
    };
  }

  enqueue(
    entityType: EntityType,
    entityId: string,
    operation: OperationType,
    payload: unknown,
  ): SyncQueueItem {
    const id = generateUUID();
    const now = new Date().toISOString();

    databaseManager.execute(
      `INSERT INTO ${this.tableName}
        (id, entity_type, entity_id, operation, payload, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [id, entityType, entityId, operation, JSON.stringify(payload), now, 'pending'],
    );

    return this.findById(id)!;
  }

  findById(id: string): SyncQueueItem | null {
    const result = databaseManager.execute(
      `SELECT * FROM ${this.tableName} WHERE id = ?;`,
      [id],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows._array[0] as SyncQueueRow);
  }

  findPending(): SyncQueueItem[] {
    const now = new Date().toISOString();

    const result = databaseManager.execute(
      `SELECT * FROM ${this.tableName}
       WHERE status = 'pending'
         AND (next_retry_at IS NULL OR next_retry_at <= ?)
       ORDER BY created_at ASC;`,
      [now],
    );

    return result.rows._array.map(row => this.mapRowToEntity(row as SyncQueueRow));
  }

  findByEntity(entityType: EntityType, entityId: string): SyncQueueItem[] {
    const result = databaseManager.execute(
      `SELECT * FROM ${this.tableName}
       WHERE entity_type = ? AND entity_id = ?
       ORDER BY created_at DESC;`,
      [entityType, entityId],
    );

    return result.rows._array.map(row => this.mapRowToEntity(row as SyncQueueRow));
  }

  findFailed(): SyncQueueItem[] {
    const result = databaseManager.execute(
      `SELECT * FROM ${this.tableName}
       WHERE status = 'failed'
       ORDER BY created_at DESC;`,
    );

    return result.rows._array.map(row => this.mapRowToEntity(row as SyncQueueRow));
  }

  markProcessing(id: string): void {
    databaseManager.execute(
      `UPDATE ${this.tableName}
       SET status = 'processing'
       WHERE id = ?;`,
      [id],
    );
  }

  markCompleted(id: string): void {
    const now = new Date().toISOString();

    databaseManager.execute(
      `UPDATE ${this.tableName}
       SET status = 'completed', processed_at = ?
       WHERE id = ?;`,
      [now, id],
    );
  }

  markFailed(id: string, errorMessage: string): void {
    const item = this.findById(id);
    if (!item) return;

    const newRetryCount = item.retryCount + 1;
    const isFinalFailure = newRetryCount >= item.maxRetries;

    if (isFinalFailure) {
      databaseManager.execute(
        `UPDATE ${this.tableName}
         SET status = 'failed', retry_count = ?, error_message = ?
         WHERE id = ?;`,
        [newRetryCount, errorMessage, id],
      );
    } else {
      // Exponential backoff: 2^retryCount seconds, max 5 minutes
      const delaySeconds = Math.min(Math.pow(2, newRetryCount), 300);
      const nextRetryAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

      databaseManager.execute(
        `UPDATE ${this.tableName}
         SET status = 'pending',
             retry_count = ?,
             error_message = ?,
             next_retry_at = ?
         WHERE id = ?;`,
        [newRetryCount, errorMessage, nextRetryAt, id],
      );
    }
  }

  delete(id: string): boolean {
    const result = databaseManager.execute(
      `DELETE FROM ${this.tableName} WHERE id = ?;`,
      [id],
    );

    return result.rowsAffected > 0;
  }

  deleteByEntity(entityType: EntityType, entityId: string): number {
    const result = databaseManager.execute(
      `DELETE FROM ${this.tableName}
       WHERE entity_type = ? AND entity_id = ?;`,
      [entityType, entityId],
    );

    return result.rowsAffected;
  }

  deleteCompleted(): number {
    const result = databaseManager.execute(
      `DELETE FROM ${this.tableName} WHERE status = 'completed';`,
    );

    return result.rowsAffected;
  }

  retryFailed(id: string): void {
    databaseManager.execute(
      `UPDATE ${this.tableName}
       SET status = 'pending',
           retry_count = 0,
           error_message = NULL,
           next_retry_at = NULL
       WHERE id = ?;`,
      [id],
    );
  }

  retryAllFailed(): number {
    const result = databaseManager.execute(
      `UPDATE ${this.tableName}
       SET status = 'pending',
           retry_count = 0,
           error_message = NULL,
           next_retry_at = NULL
       WHERE status = 'failed';`,
    );

    return result.rowsAffected;
  }

  getQueueStats(): {
    pending: number;
    processing: number;
    failed: number;
    completed: number;
  } {
    const result = databaseManager.execute(
      `SELECT status, COUNT(*) as count FROM ${this.tableName} GROUP BY status;`,
    );

    const stats = {pending: 0, processing: 0, failed: 0, completed: 0};

    for (const row of result.rows._array) {
      const r = row as {status: SyncQueueStatus; count: number};
      stats[r.status] = r.count;
    }

    return stats;
  }

  getPendingCount(): number {
    const result = databaseManager.execute(
      `SELECT COUNT(*) as count FROM ${this.tableName}
       WHERE status IN ('pending', 'processing');`,
    );

    return (result.rows._array[0] as {count: number}).count;
  }

  getNextOperation(): SyncQueueItem | null {
    const pending = this.findPending();
    return pending[0] || null;
  }
}

export const syncQueueRepository = new SyncQueueRepository();

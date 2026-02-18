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
  idempotency_key: string;
  entity_type: string;
  entity_id: string;
  operation: string;
  payload: string;
  priority: number;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  retry_count: number;
  max_retries: number;
  status: string;
  error_message: string | null;
  next_retry_at: string | null;
}

export interface SyncQueueConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_CONFIG: SyncQueueConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 300000, // 5 minutes
  backoffMultiplier: 2,
};

export class SyncQueueRepository {
  private tableName = TABLE_NAMES.SYNC_QUEUE;
  private config: SyncQueueConfig;

  constructor(config: Partial<SyncQueueConfig> = {}) {
    this.config = {...DEFAULT_CONFIG, ...config};
  }

  private mapRowToEntity(row: SyncQueueRow): SyncQueueItem {
    return {
      id: row.id,
      idempotencyKey: row.idempotency_key,
      entityType: row.entity_type as EntityType,
      entityId: row.entity_id,
      operation: row.operation as OperationType,
      payload: row.payload,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      processedAt: row.processed_at,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      status: row.status as SyncQueueStatus,
      errorMessage: row.error_message,
      nextRetryAt: row.next_retry_at,
    };
  }

  /**
   * Generate an idempotency key for deduplication
   */
  generateIdempotencyKey(
    entityType: EntityType,
    entityId: string,
    operation: OperationType,
    payload: unknown,
  ): string {
    const payloadHash = this.hashPayload(payload);
    return `${entityType}:${entityId}:${operation}:${payloadHash}`;
  }

  private hashPayload(payload: unknown): string {
    const str = JSON.stringify(payload, Object.keys(payload as object).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Calculate exponential backoff with jitter
   */
  calculateBackoff(retryCount: number): number {
    const delay = Math.min(
      this.config.baseDelayMs *
        Math.pow(this.config.backoffMultiplier, retryCount),
      this.config.maxDelayMs,
    );
    // Add jitter (+-20%)
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.floor(delay + jitter);
  }

  /**
   * Check if a duplicate pending operation exists
   */
  findByIdempotencyKey(idempotencyKey: string): SyncQueueItem | null {
    const result = databaseManager.execute(
      `SELECT * FROM ${this.tableName}
       WHERE idempotency_key = ?
         AND status IN ('pending', 'processing')
       LIMIT 1;`,
      [idempotencyKey],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows._array[0] as SyncQueueRow);
  }

  enqueue(
    entityType: EntityType,
    entityId: string,
    operation: OperationType,
    payload: unknown,
    priority = 5,
  ): SyncQueueItem {
    const id = generateUUID();
    const now = new Date().toISOString();
    const idempotencyKey = this.generateIdempotencyKey(
      entityType,
      entityId,
      operation,
      payload,
    );

    databaseManager.execute(
      `INSERT INTO ${this.tableName}
        (id, idempotency_key, entity_type, entity_id, operation, payload, priority, created_at, updated_at, status, max_retries)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        idempotencyKey,
        entityType,
        entityId,
        operation,
        JSON.stringify(payload),
        priority,
        now,
        now,
        'pending',
        this.config.maxRetries,
      ],
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
       ORDER BY priority ASC, created_at ASC;`,
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
    const now = new Date().toISOString();
    databaseManager.execute(
      `UPDATE ${this.tableName}
       SET status = 'processing', updated_at = ?
       WHERE id = ?;`,
      [now, id],
    );
  }

  markCompleted(id: string): void {
    const now = new Date().toISOString();

    databaseManager.execute(
      `UPDATE ${this.tableName}
       SET status = 'completed', processed_at = ?, updated_at = ?
       WHERE id = ?;`,
      [now, now, id],
    );
  }

  markFailed(id: string, errorMessage: string): void {
    const item = this.findById(id);
    if (!item) return;

    const now = new Date().toISOString();
    const newRetryCount = item.retryCount + 1;
    const isFinalFailure = newRetryCount >= item.maxRetries;

    if (isFinalFailure) {
      databaseManager.execute(
        `UPDATE ${this.tableName}
         SET status = 'failed', retry_count = ?, error_message = ?, updated_at = ?
         WHERE id = ?;`,
        [newRetryCount, errorMessage, now, id],
      );
    } else {
      // Exponential backoff with jitter
      const delayMs = this.calculateBackoff(newRetryCount);
      const nextRetryAt = new Date(Date.now() + delayMs).toISOString();

      databaseManager.execute(
        `UPDATE ${this.tableName}
         SET status = 'pending',
             retry_count = ?,
             error_message = ?,
             next_retry_at = ?,
             updated_at = ?
         WHERE id = ?;`,
        [newRetryCount, errorMessage, nextRetryAt, now, id],
      );
    }
  }

  updatePriority(id: string, priority: number): void {
    const now = new Date().toISOString();
    databaseManager.execute(
      `UPDATE ${this.tableName}
       SET priority = ?, updated_at = ?
       WHERE id = ?;`,
      [priority, now, id],
    );
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
    const now = new Date().toISOString();
    databaseManager.execute(
      `UPDATE ${this.tableName}
       SET status = 'pending',
           retry_count = 0,
           error_message = NULL,
           next_retry_at = NULL,
           updated_at = ?
       WHERE id = ?;`,
      [now, id],
    );
  }

  retryAllFailed(): number {
    const now = new Date().toISOString();
    const result = databaseManager.execute(
      `UPDATE ${this.tableName}
       SET status = 'pending',
           retry_count = 0,
           error_message = NULL,
           next_retry_at = NULL,
           updated_at = ?
       WHERE status = 'failed';`,
      [now],
    );

    return result.rowsAffected;
  }

  /**
   * Reset stuck processing items (e.g., after app restart)
   */
  resetStuckProcessing(): number {
    const now = new Date().toISOString();
    const result = databaseManager.execute(
      `UPDATE ${this.tableName}
       SET status = 'pending', updated_at = ?
       WHERE status = 'processing';`,
      [now],
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

  /**
   * Get operations ready for batch processing
   */
  getBatch(limit: number): SyncQueueItem[] {
    const now = new Date().toISOString();

    const result = databaseManager.execute(
      `SELECT * FROM ${this.tableName}
       WHERE status = 'pending'
         AND (next_retry_at IS NULL OR next_retry_at <= ?)
       ORDER BY priority ASC, created_at ASC
       LIMIT ?;`,
      [now, limit],
    );

    return result.rows._array.map(row => this.mapRowToEntity(row as SyncQueueRow));
  }
}

export const syncQueueRepository = new SyncQueueRepository();

import {apiClient} from '../api';
import {ENDPOINTS} from '../api/endpoints';
import {syncQueue} from './SyncQueue';
import {conflictResolver} from './ConflictResolver';
import {
  workOrderRepository,
  inspectionRepository,
  assetRepository,
} from '../../database';
import type {
  EntityType,
  SyncQueueItem,
  SyncResult,
  SyncErrorCode,
} from '../../types';
import type {
  SyncEngineConfig,
  SyncEngineState,
  SyncEventHandlers,
  SyncBatchResult,
  ServerResponse,
  ConflictInfo,
} from './types';

const DEFAULT_CONFIG: SyncEngineConfig = {
  maxConcurrentSyncs: 1,
  batchSize: 10,
  retryDelayMs: 1000,
  maxRetries: 5,
  conflictStrategy: 'field_level_merge',
};

type SyncEventType =
  | 'syncStart'
  | 'syncComplete'
  | 'syncError'
  | 'itemProcessed'
  | 'conflict'
  | 'networkChange';

export class SyncEngine {
  private config: SyncEngineConfig;
  private state: SyncEngineState;
  private eventHandlers: Map<SyncEventType, Function[]> = new Map();
  private syncPromise: Promise<void> | null = null;
  private abortController: AbortController | null = null;

  constructor(config: Partial<SyncEngineConfig> = {}) {
    this.config = {...DEFAULT_CONFIG, ...config};
    this.state = {
      isRunning: false,
      isPaused: false,
      currentItem: null,
      processedCount: 0,
      errorCount: 0,
      lastSyncTime: null,
    };
  }

  on<K extends keyof SyncEventHandlers>(
    event: K,
    handler: NonNullable<SyncEventHandlers[K]>,
  ): () => void {
    const eventKey = event.replace('on', '').toLowerCase() as SyncEventType;
    const handlers = this.eventHandlers.get(eventKey) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventKey, handlers);

    return () => {
      const currentHandlers = this.eventHandlers.get(eventKey) || [];
      this.eventHandlers.set(
        eventKey,
        currentHandlers.filter(h => h !== handler),
      );
    };
  }

  private emit(event: SyncEventType, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(...args));
  }

  async start(): Promise<void> {
    if (this.state.isRunning) {
      return;
    }

    this.state.isRunning = true;
    this.state.isPaused = false;
    this.abortController = new AbortController();

    this.emit('syncStart');

    this.syncPromise = this.runSyncLoop();

    try {
      await this.syncPromise;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        this.emit('syncError', error);
      }
    } finally {
      this.state.isRunning = false;
      this.syncPromise = null;
    }
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.state.isRunning = false;
  }

  pause(): void {
    this.state.isPaused = true;
  }

  resume(): void {
    this.state.isPaused = false;
  }

  private async runSyncLoop(): Promise<void> {
    const startTime = Date.now();
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let conflicts = 0;

    while (!this.abortController?.signal.aborted) {
      if (this.state.isPaused) {
        await this.delay(1000);
        continue;
      }

      const item = syncQueue.dequeue();

      if (!item) {
        break;
      }

      this.state.currentItem = item;
      syncQueue.markProcessing(item.id);

      try {
        const result = await this.processItem(item);
        processed++;

        if (result.success) {
          syncQueue.markCompleted(item.id);
          this.updateEntitySyncStatus(item, result);
          succeeded++;
        } else if (result.error?.code === 'CONFLICT') {
          conflicts++;
          // Conflict handling already done in processItem
        } else {
          syncQueue.markFailed(item.id, result.error?.message || 'Unknown error');
          failed++;
        }

        this.emit('itemProcessed', item, result.success);
      } catch (error) {
        failed++;
        syncQueue.markFailed(item.id, (error as Error).message);
        this.emit('itemProcessed', item, false);
      }

      this.state.currentItem = null;
      this.state.processedCount++;

      // Small delay between items
      await this.delay(100);
    }

    this.state.lastSyncTime = new Date();

    const batchResult: SyncBatchResult = {
      processed,
      succeeded,
      failed,
      conflicts,
      duration: Date.now() - startTime,
    };

    this.emit('syncComplete', batchResult);
  }

  private async processItem(item: SyncQueueItem): Promise<SyncResult> {
    const payload = JSON.parse(item.payload);

    try {
      const response = await this.sendToServer(item, payload);

      if (response.conflict) {
        return this.handleConflict(item, payload, response.conflict);
      }

      return {
        success: response.success,
        entityId: item.entityId,
        serverVersion: response.serverVersion,
      };
    } catch (error) {
      const errorCode = this.mapErrorCode(error);

      return {
        success: false,
        entityId: item.entityId,
        error: {
          code: errorCode,
          message: (error as Error).message,
        },
      };
    }
  }

  private async sendToServer(
    item: SyncQueueItem,
    payload: unknown,
  ): Promise<ServerResponse> {
    const endpoint = this.getEndpoint(item.entityType, item.operation, item.entityId);

    switch (item.operation) {
      case 'CREATE':
        return (await apiClient.post(endpoint, payload)).data;

      case 'UPDATE':
        return (await apiClient.put(endpoint, payload)).data;

      case 'DELETE':
        return (await apiClient.delete(endpoint)).data;

      default:
        throw new Error(`Unknown operation: ${item.operation}`);
    }
  }

  private getEndpoint(
    entityType: EntityType,
    operation: string,
    entityId: string,
  ): string {
    const endpoints = {
      work_order: ENDPOINTS.WORK_ORDERS,
      inspection: ENDPOINTS.INSPECTIONS,
      asset: ENDPOINTS.ASSETS,
    };

    const entityEndpoints = endpoints[entityType];

    if (operation === 'CREATE') {
      return entityEndpoints.CREATE;
    }

    return entityEndpoints.DETAIL(entityId);
  }

  private handleConflict(
    item: SyncQueueItem,
    localData: unknown,
    conflict: ConflictInfo,
  ): SyncResult {
    this.emit('conflict', conflict);

    const mergeResult = conflictResolver.resolve(
      item.entityType,
      item.entityId,
      localData,
      conflict,
    );

    if (mergeResult.manualResolutionRequired) {
      // Mark as failed for now, user needs to resolve
      syncQueue.markFailed(item.id, 'Manual conflict resolution required');

      return {
        success: false,
        entityId: item.entityId,
        error: {
          code: 'CONFLICT',
          message: 'Manual conflict resolution required',
        },
      };
    }

    // Auto-resolved - update local with merged data
    this.updateEntityWithMerged(item.entityType, item.entityId, mergeResult.merged);
    syncQueue.markCompleted(item.id);

    return {
      success: true,
      entityId: item.entityId,
      serverVersion: conflict.serverVersion,
      resolvedData: mergeResult.merged,
    };
  }

  private updateEntitySyncStatus(item: SyncQueueItem, result: SyncResult): void {
    const repository = this.getRepository(item.entityType);

    if (item.operation === 'DELETE') {
      repository.delete(item.entityId);
    } else {
      repository.updateSyncStatus(item.entityId, 'synced', result.serverVersion);
    }
  }

  private updateEntityWithMerged(
    entityType: EntityType,
    entityId: string,
    mergedData: unknown,
  ): void {
    const repository = this.getRepository(entityType);
    repository.updateFromServer(
      entityId,
      mergedData as Record<string, unknown>,
      Date.now(),
    );
  }

  private getRepository(entityType: EntityType) {
    switch (entityType) {
      case 'work_order':
        return workOrderRepository;
      case 'inspection':
        return inspectionRepository;
      case 'asset':
        return assetRepository;
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  private mapErrorCode(error: unknown): SyncErrorCode {
    const apiError = error as {statusCode?: number; code?: string};

    if (apiError.code === 'CONFLICT') return 'CONFLICT';
    if (apiError.statusCode === 401) return 'UNAUTHORIZED';
    if (apiError.statusCode === 404) return 'NOT_FOUND';
    if (apiError.statusCode === 422) return 'VALIDATION_ERROR';
    if (apiError.statusCode && apiError.statusCode >= 500) return 'SERVER_ERROR';

    if ((error as Error).message?.includes('Network')) return 'NETWORK_ERROR';

    return 'UNKNOWN';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Trigger immediate sync
  async syncNow(): Promise<SyncBatchResult | null> {
    if (this.state.isRunning) {
      return null;
    }

    await this.start();

    return {
      processed: this.state.processedCount,
      succeeded: this.state.processedCount - this.state.errorCount,
      failed: this.state.errorCount,
      conflicts: conflictResolver.getPendingConflicts().length,
      duration: 0,
    };
  }

  // Pull updates from server
  async pullUpdates(since?: Date): Promise<void> {
    try {
      const response = await apiClient.get(ENDPOINTS.SYNC.PULL, {
        params: {since: since?.toISOString()},
      });

      const {workOrders, inspections, assets} = response.data.data;

      // Update local database with server data
      for (const workOrder of workOrders || []) {
        const existing = workOrderRepository.findById(workOrder.id);
        if (!existing || existing.serverVersion! < workOrder.serverVersion) {
          workOrderRepository.updateFromServer(
            workOrder.id,
            workOrder,
            workOrder.serverVersion,
          );
        }
      }

      for (const inspection of inspections || []) {
        const existing = inspectionRepository.findById(inspection.id);
        if (!existing || existing.serverVersion! < inspection.serverVersion) {
          inspectionRepository.updateFromServer(
            inspection.id,
            inspection,
            inspection.serverVersion,
          );
        }
      }

      for (const asset of assets || []) {
        const existing = assetRepository.findById(asset.id);
        if (!existing || existing.serverVersion! < asset.serverVersion) {
          assetRepository.updateFromServer(asset.id, asset, asset.serverVersion);
        }
      }
    } catch (error) {
      console.error('Failed to pull updates:', error);
      throw error;
    }
  }

  getState(): SyncEngineState {
    return {...this.state};
  }

  isRunning(): boolean {
    return this.state.isRunning;
  }

  getPendingCount(): number {
    return syncQueue.getPendingCount();
  }

  getFailedCount(): number {
    return syncQueue.getFailed().length;
  }
}

export const syncEngine = new SyncEngine();

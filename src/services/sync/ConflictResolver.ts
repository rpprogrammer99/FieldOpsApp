import type {EntityType, ConflictData, ResolvedConflict, ConflictResolutionStrategy} from '../../types';
import type {ConflictInfo, MergeResult, ConflictStrategy} from './types';
import {lastWriteWins, serverWins, clientWins} from './strategies/LastWriteWins';
import {fieldLevelMerge} from './strategies/FieldLevelMerge';

export interface ConflictResolverConfig {
  defaultStrategy: ConflictStrategy;
  entityStrategies: Partial<Record<EntityType, ConflictStrategy>>;
}

const DEFAULT_CONFIG: ConflictResolverConfig = {
  defaultStrategy: 'field_level_merge',
  entityStrategies: {
    work_order: 'field_level_merge',
    inspection: 'field_level_merge',
    asset: 'last_write_wins',
  },
};

export class ConflictResolver {
  private config: ConflictResolverConfig;
  private pendingManualResolutions: Map<string, ConflictData> = new Map();

  constructor(config: Partial<ConflictResolverConfig> = {}) {
    this.config = {...DEFAULT_CONFIG, ...config};
  }

  resolve<T>(
    entityType: EntityType,
    entityId: string,
    localData: T,
    conflict: ConflictInfo<T>,
  ): MergeResult<T> {
    const strategy = this.getStrategy(entityType);

    switch (strategy) {
      case 'last_write_wins':
        return lastWriteWins(
          localData as T & {localVersion?: number},
          conflict as unknown as ConflictInfo<T & {localVersion?: number}>,
        ) as unknown as MergeResult<T>;

      case 'server_wins':
        return serverWins(localData, conflict);

      case 'client_wins':
        return clientWins(localData, conflict);

      case 'field_level_merge':
        return fieldLevelMerge(
          localData as T & {_fieldVersions?: Record<string, number>},
          conflict as unknown as ConflictInfo<T & {_fieldVersions?: Record<string, number>}>,
          entityType,
        ) as unknown as MergeResult<T>;

      case 'manual':
        return this.queueManualResolution(entityType, entityId, localData, conflict);

      default:
        return lastWriteWins(
          localData as T & {localVersion?: number},
          conflict as unknown as ConflictInfo<T & {localVersion?: number}>,
        ) as unknown as MergeResult<T>;
    }
  }

  private getStrategy(entityType: EntityType): ConflictStrategy {
    return this.config.entityStrategies[entityType] || this.config.defaultStrategy;
  }

  private queueManualResolution<T>(
    entityType: EntityType,
    entityId: string,
    localData: T,
    conflict: ConflictInfo<T>,
  ): MergeResult<T> {
    const conflictData: ConflictData = {
      entityType,
      entityId,
      localData,
      serverData: conflict.serverData,
      localVersion: (localData as {localVersion?: number}).localVersion || 0,
      serverVersion: conflict.serverVersion,
    };

    this.pendingManualResolutions.set(`${entityType}:${entityId}`, conflictData);

    // Return server data as temporary resolution
    return {
      merged: conflict.serverData,
      strategy: 'manual',
      conflictResolved: false,
      manualResolutionRequired: true,
    };
  }

  getPendingConflicts(): ConflictData[] {
    return Array.from(this.pendingManualResolutions.values());
  }

  getConflict(entityType: EntityType, entityId: string): ConflictData | null {
    return this.pendingManualResolutions.get(`${entityType}:${entityId}`) || null;
  }

  resolveManually<T>(
    entityType: EntityType,
    entityId: string,
    resolution: 'local' | 'server' | 'custom',
    customData?: T,
  ): ResolvedConflict | null {
    const key = `${entityType}:${entityId}`;
    const conflict = this.pendingManualResolutions.get(key);

    if (!conflict) {
      return null;
    }

    let resolvedData: unknown;
    let strategy: ConflictResolutionStrategy;

    switch (resolution) {
      case 'local':
        resolvedData = conflict.localData;
        strategy = 'CLIENT_WINS';
        break;

      case 'server':
        resolvedData = conflict.serverData;
        strategy = 'SERVER_WINS';
        break;

      case 'custom':
        if (!customData) {
          throw new Error('Custom data required for custom resolution');
        }
        resolvedData = customData;
        strategy = 'MANUAL';
        break;
    }

    this.pendingManualResolutions.delete(key);

    return {
      strategy,
      resolvedData,
      resolvedVersion: Math.max(conflict.localVersion, conflict.serverVersion) + 1,
    };
  }

  clearConflict(entityType: EntityType, entityId: string): void {
    this.pendingManualResolutions.delete(`${entityType}:${entityId}`);
  }

  clearAllConflicts(): void {
    this.pendingManualResolutions.clear();
  }

  hasPendingConflicts(): boolean {
    return this.pendingManualResolutions.size > 0;
  }

  setStrategy(entityType: EntityType, strategy: ConflictStrategy): void {
    this.config.entityStrategies[entityType] = strategy;
  }

  setDefaultStrategy(strategy: ConflictStrategy): void {
    this.config.defaultStrategy = strategy;
  }
}

export const conflictResolver = new ConflictResolver();

import type {MergeResult, ConflictInfo} from '../types';

interface FieldMetadata {
  value: unknown;
  updatedAt: number;
}

interface VersionedEntity {
  [key: string]: unknown;
  _fieldVersions?: Record<string, number>;
}

// Fields that require manual resolution (critical business fields)
const CRITICAL_FIELDS: Record<string, string[]> = {
  work_order: ['status', 'assigneeId'],
  inspection: ['status', 'overallResult'],
  asset: ['status'],
};

export function fieldLevelMerge<T extends VersionedEntity>(
  localData: T,
  conflict: ConflictInfo<T>,
  entityType: string,
): MergeResult<T> {
  const serverData = conflict.serverData;
  const criticalFields = CRITICAL_FIELDS[entityType] || [];

  const merged: T = {...serverData};
  const conflictingCriticalFields: string[] = [];

  const localFieldVersions = localData._fieldVersions || {};
  const serverFieldVersions = (serverData._fieldVersions || {}) as Record<string, number>;

  // Merge each field based on version
  for (const key of Object.keys(localData)) {
    if (key === '_fieldVersions' || key === 'id') continue;

    const localValue = localData[key];
    const serverValue = serverData[key];

    // Skip if values are the same
    if (JSON.stringify(localValue) === JSON.stringify(serverValue)) {
      continue;
    }

    const localFieldVersion = localFieldVersions[key] || 0;
    const serverFieldVersion = serverFieldVersions[key] || 0;

    // Check if this is a critical field with conflict
    if (criticalFields.includes(key)) {
      if (localFieldVersion > serverFieldVersion) {
        conflictingCriticalFields.push(key);
      }
      // For critical fields, default to server value unless explicitly resolved
      continue;
    }

    // For non-critical fields, use last-write-wins at field level
    if (localFieldVersion > serverFieldVersion) {
      (merged as Record<string, unknown>)[key] = localValue;
    }
  }

  // If there are conflicting critical fields, require manual resolution
  if (conflictingCriticalFields.length > 0) {
    return {
      merged,
      strategy: 'field_level_merge',
      conflictResolved: false,
      manualResolutionRequired: true,
    };
  }

  return {
    merged,
    strategy: 'field_level_merge',
    conflictResolved: true,
  };
}

// Helper to track field-level versions when updating
export function createFieldVersions<T extends object>(
  entity: T,
  updatedFields: (keyof T)[],
): Record<string, number> {
  const now = Date.now();
  const versions: Record<string, number> = {};

  for (const field of updatedFields) {
    versions[field as string] = now;
  }

  return versions;
}

// Simplified merge for entities without field-level tracking
export function simpleFieldMerge<T extends object>(
  localData: T,
  serverData: T,
  localTimestamp: number,
  serverTimestamp: number,
): T {
  // If local is newer, prefer local changes for all differing fields
  if (localTimestamp > serverTimestamp) {
    const merged = {...serverData};

    for (const key of Object.keys(localData) as (keyof T)[]) {
      const localValue = localData[key];
      const serverValue = serverData[key];

      if (JSON.stringify(localValue) !== JSON.stringify(serverValue)) {
        (merged as Record<string, unknown>)[key as string] = localValue;
      }
    }

    return merged;
  }

  // Server is newer, use server data but keep local-only changes
  return serverData;
}

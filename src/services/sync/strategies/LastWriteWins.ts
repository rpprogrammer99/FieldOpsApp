import type {MergeResult, ConflictInfo} from '../types';

export function lastWriteWins<T extends {localVersion?: number}>(
  localData: T,
  conflict: ConflictInfo<T>,
): MergeResult<T> {
  const localVersion = localData.localVersion || 0;
  const serverVersion = conflict.serverVersion;

  // Compare timestamps - higher version wins
  if (localVersion >= serverVersion) {
    return {
      merged: localData,
      strategy: 'last_write_wins',
      conflictResolved: true,
    };
  }

  return {
    merged: conflict.serverData,
    strategy: 'last_write_wins',
    conflictResolved: true,
  };
}

export function serverWins<T>(
  _localData: T,
  conflict: ConflictInfo<T>,
): MergeResult<T> {
  return {
    merged: conflict.serverData,
    strategy: 'server_wins',
    conflictResolved: true,
  };
}

export function clientWins<T>(
  localData: T,
  _conflict: ConflictInfo<T>,
): MergeResult<T> {
  return {
    merged: localData,
    strategy: 'client_wins',
    conflictResolved: true,
  };
}

# Sync Engine Edge Cases & Handling Strategies

This document outlines the edge cases handled by the FieldOpsApp sync engine and the strategies employed to ensure data integrity and user experience.

## 1. Network Connectivity

### Offline to Online Transitions
The sync engine automatically detects network changes using `NetworkMonitor`.
- **Strategy:** Sync pauses immediately when the device goes offline to save battery and resources. It resumes automatically when connectivity is restored.
- **Implementation:** `networkMonitor.subscribe()` in `SyncEngine.initialize()`.

### Flaky Connections
- **Strategy:** Operations are idempotent. Each sync request includes a unique `idempotencyKey` generated at creation time. If a request succeeds on the server but the response is lost due to network failure, a retry won't duplicate the operation.
- **Handling:** `SyncEngine` catches network errors and marks items as failed, which allows for retry logic (handled by `SyncQueue` or manual retry).

## 2. Concurrency & Race Conditions

### Concurrent Modifications
- **Scenario:** User modifies a record locally while a sync for that record is in progress.
- **Strategy:** Optimistic UI updates. Local changes increment the `local_version`.
- **Conflict Resolution:** 'Last-Write-Wins' is the default strategy. If the server has a newer version than the one being synced, a conflict is detecting.
  - The `ConflictResolver` checks timestamps/versions.
  - If `last_write_wins` is active, the more recent internal timestamp prevails.

### Batch Processing
- **Scenario:** Multiple items needing sync.
- **Strategy:** `maxConcurrentSyncs` limits the number of parallel requests to avoid overwhelming the network or server.
- **Partial Failures:** `Promise.allSettled` is used to process a batch. If one item fails (e.g., validation error), others in the same batch can still succeed.

## 3. Data Integrity

### Partial Syncs
- **Scenario:** Sync process interrupted (app kill, crash).
- **Strategy:** Determine state on restart. `SyncQueue` persists item state (`pending`, `processing`, `failed`). On app restart, `initialize()` resets the queue processing state if needed (implementation detail of `SyncQueue`), or the next `start()` picks up pending items.
- **Idempotency:** Crucial for recovering from interrupted syncs where the server might have processed the request but the client didn't get the ack.

## 4. Server-Side Constraints

### Validation Errors
- **Scenario:** Server rejects data (e.g., invalid status transition).
- **Handling:** The item is marked as `failed` with the specific error message from the server. This prevents the queue from getting stuck on a bad item.

### Rate Limiting
- **Scenario:** Too many requests.
- **Strategy:** `batchSize` and `maxConcurrentSyncs` provide client-side throttling. The `retryDelayMs` config allows for backoff strategies (though simple delay in current implementation).

## 5. Conflict Resolution Details

### Strategy: Last-Write-Wins (Default)
- **Logic:** compares `clientTimestamp` vs `serverTimestamp`.
- **Edge Case:** Clock skew. Server time is generally trusted, but client timestamps are used for relative ordering of local offline actions.
- **Fallback:** Manual resolution if auto-merge fails or is not configured.

### Strategy: Field-Level Merge
- **Logic:** Merges non-conflicting fields. If User A changed 'Status' and User B changed 'Description', both changes are kept.
- **Complex Conflicts:** If both changed 'Status', it falls back to Last-Write-Wins or Manual Resolution.

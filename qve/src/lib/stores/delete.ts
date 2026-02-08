/**
 * Delete Store - WIN-80 Soft Delete Feature
 *
 * Manages pending deletions with 10-second undo window.
 * Uses delayed API calls - deletion only sent when timer expires.
 */

import { writable, derived, get } from 'svelte/store';
import { api } from '$lib/api';
import { toasts } from './toast';
import {
  wines,
  removeWineFromList,
  drunkWines,
  filterOptions
} from './index';
import type { Wine, DrunkWine } from '$lib/api/types';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export type DeleteEntityType = 'wine' | 'bottle' | 'producer' | 'region';

export interface DeleteImpact {
  producers?: { count: number; names?: string[] };
  wines?: { count: number; names?: string[] };
  bottles?: { count: number; names?: string[] };
  ratings?: { count: number };
}

export interface DeleteImpactResponse {
  entity: {
    type: DeleteEntityType;
    id: number;
    name: string;
  };
  impact: DeleteImpact;
}

export interface PendingDelete {
  id: string;
  entityType: DeleteEntityType;
  entityId: number;
  entityName: string;
  createdAt: number;
  expiresAt: number;
  // Snapshot for undo restoration
  snapshot: {
    wine?: Wine;
    drunkWine?: DrunkWine;
    // For bottles, we need the parent wine context
    parentWineId?: number;
  };
  // Timer management
  timerId: ReturnType<typeof requestAnimationFrame> | null;
  isPaused: boolean;
  elapsedMs: number;
}

interface DeleteState {
  pending: Map<string, PendingDelete>;
  isLoading: boolean;
  error: string | null;
}

// ─────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────

export const UNDO_DURATION_MS = 5000; // 10 seconds

// ─────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────

const initialState: DeleteState = {
  pending: new Map(),
  isLoading: false,
  error: null
};

const { subscribe, update, set } = writable<DeleteState>(initialState);

// Generate unique ID for pending delete
const generateId = (type: DeleteEntityType, entityId: number) =>
  `${type}-${entityId}-${Date.now()}`;

/**
 * RAF-based timer that tracks elapsed time and can be paused
 */
function createPausableTimer(
  pendingId: string,
  durationMs: number,
  onComplete: () => void
): ReturnType<typeof requestAnimationFrame> {
  let startTime = performance.now();
  let elapsed = 0;

  function tick(currentTime: number) {
    const state = get({ subscribe });
    const pending = state.pending.get(pendingId);

    if (!pending) {
      // Deleted or undone, stop timer
      return;
    }

    if (pending.isPaused) {
      // Paused, just schedule next tick without advancing
      pending.timerId = requestAnimationFrame(tick);
      return;
    }

    // Calculate elapsed time
    const deltaTime = currentTime - startTime;
    elapsed += deltaTime;
    startTime = currentTime;

    // Update elapsed in store
    update((s) => {
      const p = s.pending.get(pendingId);
      if (p) {
        p.elapsedMs = elapsed;
      }
      return s;
    });

    if (elapsed >= durationMs) {
      // Timer complete
      onComplete();
    } else {
      // Continue timer
      const timerId = requestAnimationFrame(tick);
      update((s) => {
        const p = s.pending.get(pendingId);
        if (p) {
          p.timerId = timerId;
        }
        return s;
      });
    }
  }

  return requestAnimationFrame(tick);
}

/**
 * Execute the actual deletion API call
 */
async function executeDelete(pending: PendingDelete): Promise<void> {
  try {
    await api.deleteItem(pending.entityType, pending.entityId);
    console.log(`[Delete] Soft deleted ${pending.entityType} ${pending.entityId}`);
  } catch (error) {
    console.error(`[Delete] Failed to delete ${pending.entityType}:`, error);
    // On failure, restore the item
    restoreFromSnapshot(pending);
    toasts.error(`Failed to delete ${pending.entityName}. Item has been restored.`);
  } finally {
    // Remove from pending
    update((s) => {
      s.pending.delete(pending.id);
      return s;
    });
  }
}

/**
 * Restore an item from its snapshot (used for undo or API failure)
 */
function restoreFromSnapshot(pending: PendingDelete): void {
  const { snapshot, entityType, entityId } = pending;

  if (entityType === 'wine' && snapshot.wine) {
    // Restore wine to the wines store
    wines.update((list) => {
      // Check if already exists (shouldn't, but safety check)
      if (!list.find((w) => w.wineID === entityId)) {
        return [...list, snapshot.wine!];
      }
      return list;
    });
  } else if (entityType === 'bottle') {
    // Restore bottle - either to cellar (parentWineId) or history (drunkWine)
    if (snapshot.parentWineId) {
      // Restore bottle count on parent wine in cellar
      wines.update((list) =>
        list.map((w) => {
          if (w.wineID === snapshot.parentWineId) {
            return { ...w, bottleCount: w.bottleCount + 1 };
          }
          return w;
        })
      );
    }
    if (snapshot.drunkWine) {
      // Restore rating to history
      drunkWines.update((list) => {
        // Check if already exists (shouldn't, but safety check)
        if (!list.find((w) => w.bottleID === entityId)) {
          return [...list, snapshot.drunkWine!];
        }
        return list;
      });
    }
  }
  // Note: Producer/region restoration would require refreshing filter options
}

// ─────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────

/**
 * Get delete impact preview (what will be affected by deletion)
 */
async function getImpact(
  type: DeleteEntityType,
  id: number
): Promise<DeleteImpactResponse> {
  update((s) => ({ ...s, isLoading: true, error: null }));

  try {
    const result = await api.getDeleteImpact(type, id);
    update((s) => ({ ...s, isLoading: false }));
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get impact';
    update((s) => ({ ...s, isLoading: false, error: message }));
    throw error;
  }
}

/**
 * Start a pending deletion with undo window
 */
function startDelete(
  type: DeleteEntityType,
  entityId: number,
  entityName: string,
  snapshot: PendingDelete['snapshot']
): string {
  const id = generateId(type, entityId);
  const now = Date.now();

  const pending: PendingDelete = {
    id,
    entityType: type,
    entityId,
    entityName,
    createdAt: now,
    expiresAt: now + UNDO_DURATION_MS,
    snapshot,
    timerId: null,
    isPaused: false,
    elapsedMs: 0
  };

  // Add to pending and start timer
  update((s) => {
    s.pending.set(id, pending);
    return s;
  });

  // Start the deletion timer
  const timerId = createPausableTimer(id, UNDO_DURATION_MS, () => {
    const state = get({ subscribe });
    const p = state.pending.get(id);
    if (p) {
      executeDelete(p);
    }
  });

  update((s) => {
    const p = s.pending.get(id);
    if (p) {
      p.timerId = timerId;
    }
    return s;
  });

  // Remove from UI immediately (optimistic)
  applyOptimisticRemoval(type, entityId, snapshot);

  // Show undo toast
  toasts.add({
    type: 'undo',
    message: `${entityName} deleted`,
    duration: UNDO_DURATION_MS,
    action: {
      label: 'Undo',
      callback: () => undoDelete(id)
    }
  });

  return id;
}

/**
 * Apply optimistic removal from UI stores
 */
function applyOptimisticRemoval(
  type: DeleteEntityType,
  entityId: number,
  snapshot: PendingDelete['snapshot']
): void {
  if (type === 'wine') {
    removeWineFromList(entityId);
  } else if (type === 'bottle') {
    // Handle bottle deletion - either from cellar or from history
    if (snapshot.parentWineId) {
      // Decrement bottle count on parent wine in cellar
      wines.update((list) =>
        list.map((w) => {
          if (w.wineID === snapshot.parentWineId) {
            const newCount = Math.max(0, w.bottleCount - 1);
            return { ...w, bottleCount: newCount };
          }
          return w;
        })
      );
    }
    if (snapshot.drunkWine) {
      // Remove rating from history
      drunkWines.update((list) => list.filter((w) => w.bottleID !== entityId));
    }
  }
  // Producer/region deletion would affect filter options
}

/**
 * Undo a pending deletion
 */
function undoDelete(pendingId: string): boolean {
  const state = get({ subscribe });
  const pending = state.pending.get(pendingId);

  if (!pending) {
    console.warn(`[Delete] Cannot undo: pending delete ${pendingId} not found`);
    return false;
  }

  // Cancel the timer
  if (pending.timerId !== null) {
    cancelAnimationFrame(pending.timerId);
  }

  // Restore from snapshot
  restoreFromSnapshot(pending);

  // Remove from pending
  update((s) => {
    s.pending.delete(pendingId);
    return s;
  });

  toasts.success(`${pending.entityName} restored`);
  return true;
}

/**
 * Pause a pending deletion timer (e.g., on toast hover)
 */
function pauseDelete(pendingId: string): void {
  update((s) => {
    const p = s.pending.get(pendingId);
    if (p) {
      p.isPaused = true;
    }
    return s;
  });
}

/**
 * Resume a paused deletion timer
 */
function resumeDelete(pendingId: string): void {
  update((s) => {
    const p = s.pending.get(pendingId);
    if (p) {
      p.isPaused = false;
    }
    return s;
  });
}

/**
 * Cancel all pending deletions (e.g., on page unload)
 */
function cancelAllPending(): void {
  const state = get({ subscribe });

  for (const pending of state.pending.values()) {
    if (pending.timerId !== null) {
      cancelAnimationFrame(pending.timerId);
    }
    // Don't restore - just cancel the timers
  }

  update((s) => {
    s.pending.clear();
    return s;
  });
}

/**
 * Check if an entity has a pending deletion
 */
function isPending(type: DeleteEntityType, entityId: number): boolean {
  const state = get({ subscribe });
  for (const pending of state.pending.values()) {
    if (pending.entityType === type && pending.entityId === entityId) {
      return true;
    }
  }
  return false;
}

/**
 * Get pending delete for an entity (if exists)
 */
function getPending(type: DeleteEntityType, entityId: number): PendingDelete | null {
  const state = get({ subscribe });
  for (const pending of state.pending.values()) {
    if (pending.entityType === type && pending.entityId === entityId) {
      return pending;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────

export const deleteStore = {
  subscribe,
  getImpact,
  startDelete,
  undoDelete,
  pauseDelete,
  resumeDelete,
  cancelAllPending,
  isPending,
  getPending
};

// ─────────────────────────────────────────────────────────
// DERIVED STORES
// ─────────────────────────────────────────────────────────

/** Check if there are any pending deletions */
export const hasPendingDeletes = derived(
  { subscribe },
  ($state) => $state.pending.size > 0
);

/** Get count of pending deletions */
export const pendingDeleteCount = derived(
  { subscribe },
  ($state) => $state.pending.size
);

/** Check if delete operations are loading */
export const deleteLoading = derived(
  { subscribe },
  ($state) => $state.isLoading
);

/** Get current delete error */
export const deleteError = derived(
  { subscribe },
  ($state) => $state.error
);

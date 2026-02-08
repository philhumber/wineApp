/**
 * Toast Store
 * Manages toast notification queue with pausable timers
 *
 * WIN-80: Fixed timer sync with CSS progress bar using RAF-based timers
 */

import { writable, derived } from 'svelte/store';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'undo';

export interface ToastAction {
  label: string;
  callback: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number; // ms, 0 = no auto-dismiss
  action?: ToastAction;
  createdAt: number;
  // WIN-80: Pausable timer state
  isPaused: boolean;
  elapsedMs: number;
}

// Internal timer tracking (not part of Toast interface to keep it serializable)
const timerMap = new Map<string, number>();

// ─────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────

function createToastStore() {
  const { subscribe, update, set } = writable<Toast[]>([]);

  /**
   * Generate unique ID for toast
   */
  const generateId = () => `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  /**
   * Get current toasts (utility for timer callbacks)
   */
  const getToasts = (): Toast[] => {
    let current: Toast[] = [];
    const unsub = subscribe((t) => (current = t));
    unsub();
    return current;
  };

  /**
   * WIN-80: RAF-based timer that syncs with CSS animation pause
   * This ensures the toast dismisses exactly when the progress bar finishes
   */
  const startTimer = (id: string, duration: number): void => {
    let lastTime = performance.now();

    const tick = (currentTime: number) => {
      const toasts = getToasts();
      const toast = toasts.find((t) => t.id === id);

      if (!toast) {
        // Toast was removed, clean up timer
        timerMap.delete(id);
        return;
      }

      const delta = currentTime - lastTime;
      lastTime = currentTime;

      if (!toast.isPaused) {
        // Only advance elapsed time when not paused
        const newElapsed = toast.elapsedMs + delta;

        if (newElapsed >= duration) {
          // Timer complete - remove toast
          remove(id);
          return;
        }

        // Update elapsed time
        update((toasts) =>
          toasts.map((t) =>
            t.id === id ? { ...t, elapsedMs: newElapsed } : t
          )
        );
      }

      // Schedule next frame
      const rafId = requestAnimationFrame(tick);
      timerMap.set(id, rafId);
    };

    const rafId = requestAnimationFrame(tick);
    timerMap.set(id, rafId);
  };

  /**
   * Add a toast to the queue
   */
  const add = (options: {
    type: ToastType;
    message: string;
    duration?: number;
    action?: ToastAction;
  }): string => {
    const id = generateId();

    // Default durations by type
    const defaultDurations: Record<ToastType, number> = {
      success: 4000,
      error: 8000,
      info: 5000,
      warning: 6000,
      undo: 5000 // WIN-80: Undo toasts get 10 seconds
    };

    const toast: Toast = {
      id,
      type: options.type,
      message: options.message,
      duration: options.duration ?? defaultDurations[options.type],
      action: options.action,
      createdAt: Date.now(),
      isPaused: false,
      elapsedMs: 0
    };

    update((toasts) => [...toasts, toast]);

    // Start RAF-based timer (unless duration is 0)
    if (toast.duration > 0) {
      startTimer(id, toast.duration);
    }

    return id;
  };

  /**
   * Remove a toast by ID
   */
  const remove = (id: string): void => {
    // Cancel RAF timer if exists
    const rafId = timerMap.get(id);
    if (rafId !== undefined) {
      cancelAnimationFrame(rafId);
      timerMap.delete(id);
    }

    update((toasts) => toasts.filter((t) => t.id !== id));
  };

  /**
   * Remove all toasts
   */
  const clear = (): void => {
    // Cancel all RAF timers
    for (const rafId of timerMap.values()) {
      cancelAnimationFrame(rafId);
    }
    timerMap.clear();

    set([]);
  };

  /**
   * WIN-80: Pause a toast's timer (syncs with CSS animation-play-state)
   */
  const pause = (id: string): void => {
    update((toasts) =>
      toasts.map((t) => (t.id === id ? { ...t, isPaused: true } : t))
    );
  };

  /**
   * WIN-80: Resume a toast's timer
   */
  const resume = (id: string): void => {
    update((toasts) =>
      toasts.map((t) => (t.id === id ? { ...t, isPaused: false } : t))
    );
  };

  return {
    subscribe,
    add,
    remove,
    clear,
    pause,
    resume,

    // Convenience methods
    success: (message: string, action?: ToastAction) =>
      add({ type: 'success', message, action }),

    error: (message: string, action?: ToastAction) =>
      add({ type: 'error', message, action }),

    info: (message: string, action?: ToastAction) =>
      add({ type: 'info', message, action }),

    warning: (message: string, action?: ToastAction) =>
      add({ type: 'warning', message, action }),

    undo: (message: string, undoCallback: () => void, duration = 10000) =>
      add({
        type: 'undo',
        message,
        duration,
        action: { label: 'Undo', callback: undoCallback }
      })
  };
}

export const toasts = createToastStore();

// ─────────────────────────────────────────────────────────
// DERIVED
// ─────────────────────────────────────────────────────────

/** Check if there are any active toasts */
export const hasToasts = derived(toasts, ($toasts) => $toasts.length > 0);

/** Get the latest toast (for single-toast display) */
export const latestToast = derived(toasts, ($toasts) =>
  $toasts.length > 0 ? $toasts[$toasts.length - 1] : null
);

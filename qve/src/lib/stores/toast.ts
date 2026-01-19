/**
 * Toast Store
 * Manages toast notification queue
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
}

// ─────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  /**
   * Generate unique ID for toast
   */
  const generateId = () => `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

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
      undo: 5000
    };

    const toast: Toast = {
      id,
      type: options.type,
      message: options.message,
      duration: options.duration ?? defaultDurations[options.type],
      action: options.action,
      createdAt: Date.now()
    };

    update((toasts) => [...toasts, toast]);

    // Auto-remove after duration (unless duration is 0)
    if (toast.duration > 0) {
      setTimeout(() => {
        remove(id);
      }, toast.duration);
    }

    return id;
  };

  /**
   * Remove a toast by ID
   */
  const remove = (id: string): void => {
    update((toasts) => toasts.filter((t) => t.id !== id));
  };

  /**
   * Remove all toasts
   */
  const clear = (): void => {
    update(() => []);
  };

  return {
    subscribe,
    add,
    remove,
    clear,

    // Convenience methods
    success: (message: string, action?: ToastAction) =>
      add({ type: 'success', message, action }),

    error: (message: string, action?: ToastAction) =>
      add({ type: 'error', message, action }),

    info: (message: string, action?: ToastAction) =>
      add({ type: 'info', message, action }),

    warning: (message: string, action?: ToastAction) =>
      add({ type: 'warning', message, action }),

    undo: (message: string, undoCallback: () => void) =>
      add({
        type: 'undo',
        message,
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

/**
 * Modal Store
 * Manages modal/dialog state
 */

import { writable, derived, get } from 'svelte/store';
import type { Wine, DrunkWine } from '$lib/api/types';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export type ModalType =
  | 'drink'          // Drink & rate bottle
  | 'editRating'     // Edit existing rating
  | 'addBottle'      // Add bottle to existing wine
  | 'edit'           // Edit wine or bottle
  | 'confirm'        // Confirmation dialog
  | 'aiLoading'      // AI generation loading overlay
  | 'settings'       // Settings modal (theme, view density)
  | 'imageLightbox'  // Fullscreen image viewer
  | null;

/**
 * Result from a beforeClose hook
 * If dirty is false, modal closes immediately
 * If dirty is true, confirmation dialog is shown
 */
export interface BeforeCloseResult {
  /** Is the modal in a dirty state? */
  dirty: boolean;
  /** Confirmation config (only used if dirty is true) */
  confirmation?: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'default' | 'danger';
  };
  /** Callback to execute when user confirms discard (cleanup, reset stores) */
  onConfirm?: () => void;
}

/**
 * Hook function that checks if a modal should be allowed to close
 * Returns a result or promise for async dirty checks
 */
export type BeforeCloseHook = () => BeforeCloseResult | Promise<BeforeCloseResult>;

export interface ModalState {
  type: ModalType;
  data?: Record<string, unknown>;
  /** Whether a history entry was pushed for this modal (for back button support) */
  pushedHistory?: boolean;
  /** Hook to check before closing (set by modal components for dirty checking) */
  beforeCloseHook?: BeforeCloseHook;
  /** Confirmation overlay that stacks on top of the current modal (for dirty checks) */
  confirmOverlay?: ConfirmModalData | null;
}

export interface ConfirmModalData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: 'default' | 'danger';
}

// ─────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────

function createModalStore() {
  const { subscribe, set, update } = writable<ModalState>({ type: null });

  /**
   * Push history entry for modal (enables browser back to close)
   * Only push for user-initiated modals, not confirm dialogs or loading overlays
   */
  const pushHistoryForModal = (type: ModalType): boolean => {
    // Don't push history for confirm dialogs or loading overlays
    // These are either system-initiated or part of navigation flows
    if (type === 'confirm' || type === 'aiLoading' || type === null) {
      return false;
    }

    if (typeof window !== 'undefined') {
      window.history.pushState({ _modal: type }, '');
      return true;
    }
    return false;
  };

  // Store reference for internal use
  const store = {
    subscribe,

    /**
     * Open a modal with optional data
     */
    open: (type: ModalType, data?: Record<string, unknown>): void => {
      const pushed = pushHistoryForModal(type);
      set({ type, data, pushedHistory: pushed, beforeCloseHook: undefined });
    },

    /**
     * Close current modal immediately (internal method)
     *
     * IMPORTANT: Modal components should call requestClose() instead to enable dirty checking.
     * This method bypasses all hooks and closes unconditionally.
     *
     * If modal pushed history, navigates back to clean up the history entry.
     */
    close: (): void => {
      let currentState: ModalState = { type: null };
      subscribe((state) => (currentState = state))();

      if (currentState.pushedHistory && typeof window !== 'undefined') {
        // Let popstate handler close the modal via closeFromPopstate
        window.history.back();
      } else {
        set({ type: null, data: undefined, pushedHistory: false, beforeCloseHook: undefined, confirmOverlay: null });
      }
    },

    /**
     * Close modal triggered by browser back button
     * Does not manipulate history since popstate already handled it
     * NOTE: This bypasses dirty checking - confirmation is handled in +layout.svelte popstate handler
     */
    closeFromPopstate: (): void => {
      set({ type: null, data: undefined, pushedHistory: false, beforeCloseHook: undefined, confirmOverlay: null });
    },

    /**
     * Update modal data without changing type
     */
    updateData: (data: Record<string, unknown>): void => {
      update((current) => ({
        ...current,
        data: { ...current.data, ...data }
      }));
    },

    // ─────────────────────────────────────────────────────
    // DIRTY CHECK HOOK SYSTEM
    // ─────────────────────────────────────────────────────

    /**
     * Register a hook that will be called before the modal closes
     * Used by modals to implement dirty checking
     */
    registerBeforeCloseHook: (hook: BeforeCloseHook): void => {
      update((current) => ({
        ...current,
        beforeCloseHook: hook
      }));
    },

    /**
     * Clear the beforeClose hook (called on modal cleanup)
     */
    clearBeforeCloseHook: (): void => {
      update((current) => ({
        ...current,
        beforeCloseHook: undefined
      }));
    },

    /**
     * Request to close the modal (use this instead of close() from modal components)
     * Runs beforeClose hook if registered, shows stacked confirmation overlay if dirty
     */
    requestClose: async (): Promise<void> => {
      let currentState: ModalState = { type: null };
      subscribe((state) => (currentState = state))();

      const hook = currentState.beforeCloseHook;

      // No hook registered - close immediately
      if (!hook) {
        store.close();
        return;
      }

      // Run the hook to check dirty state
      const result = await Promise.resolve(hook());

      // Not dirty - close immediately
      if (!result.dirty) {
        store.close();
        return;
      }

      // Dirty - show stacked confirmation overlay (doesn't replace the underlying modal)
      const confirmation = result.confirmation || {
        title: 'Discard changes?',
        message: 'You have unsaved changes. Are you sure you want to close?',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        variant: 'danger' as const
      };

      store.showConfirmOverlay({
        title: confirmation.title,
        message: confirmation.message,
        confirmLabel: confirmation.confirmLabel || 'Discard',
        cancelLabel: confirmation.cancelLabel || 'Keep editing',
        variant: confirmation.variant || 'danger',
        onConfirm: () => {
          // Execute cleanup callback if provided
          if (result.onConfirm) {
            result.onConfirm();
          }
          // Close the modal (overlay is cleared automatically)
          store.close();
        },
        onCancel: () => {
          // Just hide the overlay - user stays on the modal
          store.hideConfirmOverlay();
        }
      });
    },

    /**
     * Show a stacked confirmation overlay on top of the current modal
     * Unlike confirm(), this doesn't replace the underlying modal
     */
    showConfirmOverlay: (options: ConfirmModalData): void => {
      update((current) => ({
        ...current,
        confirmOverlay: options
      }));
    },

    /**
     * Hide the stacked confirmation overlay
     */
    hideConfirmOverlay: (): void => {
      update((current) => ({
        ...current,
        confirmOverlay: null
      }));
    },

    // ─────────────────────────────────────────────────────
    // CONVENIENCE METHODS
    // ─────────────────────────────────────────────────────

    /**
     * Open drink/rate modal for a wine
     * Pass the full Wine object for complete display info
     */
    openDrink: (wine: Wine): void => {
      const pushed = pushHistoryForModal('drink');
      set({ type: 'drink', data: { wine }, pushedHistory: pushed, beforeCloseHook: undefined });
    },

    /**
     * Open edit rating modal for an existing rating
     * Pass the full DrunkWine object to pre-populate the form
     */
    openEditRating: (drunkWine: DrunkWine): void => {
      const pushed = pushHistoryForModal('editRating');
      set({ type: 'editRating', data: { drunkWine }, pushedHistory: pushed, beforeCloseHook: undefined });
    },

    /**
     * Open add bottle modal for a wine
     * Pass optional wine details for display (pictureURL, year, region)
     */
    openAddBottle: (
      wineID: number,
      wineName: string,
      pictureURL?: string | null,
      year?: string | null,
      regionName?: string,
      countryName?: string
    ): void => {
      const pushed = pushHistoryForModal('addBottle');
      set({
        type: 'addBottle',
        data: { wineID, wineName, pictureURL, year, regionName, countryName },
        pushedHistory: pushed,
        beforeCloseHook: undefined
      });
    },

    /**
     * Open edit modal for wine or bottle
     */
    openEdit: (wineID: number, bottleID?: number): void => {
      const pushed = pushHistoryForModal('edit');
      set({ type: 'edit', data: { wineID, bottleID }, pushedHistory: pushed, beforeCloseHook: undefined });
    },

    /**
     * Open confirmation dialog
     * Note: Does not push history - confirm dialogs are transient/system-initiated
     * Note: Preserves beforeCloseHook from underlying modal for stacking support
     */
    confirm: (options: ConfirmModalData): void => {
      update((current) => ({
        type: 'confirm',
        data: options as unknown as Record<string, unknown>,
        pushedHistory: false,
        beforeCloseHook: current.beforeCloseHook // Preserve hook for underlying modal
      }));
    },

    /**
     * Show AI loading overlay
     * Note: Does not push history - loading overlays are transient
     */
    showAILoading: (message?: string): void => {
      set({ type: 'aiLoading', data: { message: message || 'Generating...' }, pushedHistory: false, beforeCloseHook: undefined });
    },

    /**
     * Hide AI loading overlay
     */
    hideAILoading: (): void => {
      update((current) => {
        if (current.type === 'aiLoading') {
          return { type: null, data: undefined, pushedHistory: false, beforeCloseHook: undefined };
        }
        return current;
      });
    },

    /**
     * Open settings modal
     */
    openSettings: (): void => {
      set({ type: 'settings', data: {}, beforeCloseHook: undefined });
    },

    /**
     * Open image lightbox for fullscreen viewing
     */
    openImageLightbox: (src: string, alt?: string): void => {
      const pushed = pushHistoryForModal('imageLightbox');
      set({ type: 'imageLightbox', data: { src, alt: alt || 'Wine image' }, pushedHistory: pushed, beforeCloseHook: undefined });
    }
  };

  return store;
}

export const modal = createModalStore();

// ─────────────────────────────────────────────────────────
// DERIVED
// ─────────────────────────────────────────────────────────

/** Check if any modal is open */
export const isModalOpen = derived(modal, ($modal) => $modal.type !== null);

/** Check if a specific modal type is open */
export const isModalType = (type: ModalType) =>
  derived(modal, ($modal) => $modal.type === type);

/** Get current modal data typed */
export const modalData = derived(modal, ($modal) => $modal.data);

/** Get the stacked confirmation overlay data (for dirty checks) */
export const confirmOverlay = derived(modal, ($modal) => $modal.confirmOverlay ?? null);

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
  | 'addBottle'      // Add bottle to existing wine
  | 'edit'           // Edit wine or bottle
  | 'confirm'        // Confirmation dialog
  | 'aiLoading'      // AI generation loading overlay
  | 'settings'       // Settings modal (theme, view density)
  | 'imageLightbox'  // Fullscreen image viewer
  | null;

export interface ModalState {
  type: ModalType;
  data?: Record<string, unknown>;
  /** Whether a history entry was pushed for this modal (for back button support) */
  pushedHistory?: boolean;
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

  return {
    subscribe,

    /**
     * Open a modal with optional data
     */
    open: (type: ModalType, data?: Record<string, unknown>): void => {
      const pushed = pushHistoryForModal(type);
      set({ type, data, pushedHistory: pushed });
    },

    /**
     * Close current modal
     * If modal pushed history, navigates back to clean up the history entry
     */
    close: (): void => {
      let currentState: ModalState = { type: null };
      subscribe((state) => (currentState = state))();

      if (currentState.pushedHistory && typeof window !== 'undefined') {
        // Let popstate handler close the modal via closeFromPopstate
        window.history.back();
      } else {
        set({ type: null, data: undefined, pushedHistory: false });
      }
    },

    /**
     * Close modal triggered by browser back button
     * Does not manipulate history since popstate already handled it
     */
    closeFromPopstate: (): void => {
      set({ type: null, data: undefined, pushedHistory: false });
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
    // CONVENIENCE METHODS
    // ─────────────────────────────────────────────────────

    /**
     * Open drink/rate modal for a wine
     * Pass the full Wine object for complete display info
     */
    openDrink: (wine: Wine): void => {
      const pushed = pushHistoryForModal('drink');
      set({ type: 'drink', data: { wine }, pushedHistory: pushed });
    },

    /**
     * Open drink/rate modal in edit mode for an existing rating
     * Pass the full DrunkWine object with rating data
     */
    openEditRating: (drunkWine: DrunkWine): void => {
      const pushed = pushHistoryForModal('drink');
      set({ type: 'drink', data: { drunkWine, isEdit: true }, pushedHistory: pushed });
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
        pushedHistory: pushed
      });
    },

    /**
     * Open edit modal for wine or bottle
     */
    openEdit: (wineID: number, bottleID?: number): void => {
      const pushed = pushHistoryForModal('edit');
      set({ type: 'edit', data: { wineID, bottleID }, pushedHistory: pushed });
    },

    /**
     * Open confirmation dialog
     * Note: Does not push history - confirm dialogs are transient/system-initiated
     */
    confirm: (options: ConfirmModalData): void => {
      set({ type: 'confirm', data: options as unknown as Record<string, unknown>, pushedHistory: false });
    },

    /**
     * Show AI loading overlay
     * Note: Does not push history - loading overlays are transient
     */
    showAILoading: (message?: string): void => {
      set({ type: 'aiLoading', data: { message: message || 'Generating...' }, pushedHistory: false });
    },

    /**
     * Hide AI loading overlay
     */
    hideAILoading: (): void => {
      update((current) => {
        if (current.type === 'aiLoading') {
          return { type: null, data: undefined, pushedHistory: false };
        }
        return current;
      });
    },

    /**
     * Open settings modal
     */
    openSettings: (): void => {
      set({ type: 'settings', data: {} });
    },

    /**
     * Open image lightbox for fullscreen viewing
     */
    openImageLightbox: (src: string, alt?: string): void => {
      const pushed = pushHistoryForModal('imageLightbox');
      set({ type: 'imageLightbox', data: { src, alt: alt || 'Wine image' }, pushedHistory: pushed });
    }
  };
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

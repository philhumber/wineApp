/**
 * Modal Store
 * Manages modal/dialog state
 */

import { writable, derived } from 'svelte/store';
import type { Wine } from '$lib/api/types';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export type ModalType =
  | 'drink'        // Drink & rate bottle
  | 'addBottle'    // Add bottle to existing wine
  | 'edit'         // Edit wine or bottle
  | 'confirm'      // Confirmation dialog
  | 'aiLoading'    // AI generation loading overlay
  | null;

export interface ModalState {
  type: ModalType;
  data?: Record<string, unknown>;
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

  return {
    subscribe,

    /**
     * Open a modal with optional data
     */
    open: (type: ModalType, data?: Record<string, unknown>): void => {
      set({ type, data });
    },

    /**
     * Close current modal
     */
    close: (): void => {
      set({ type: null, data: undefined });
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
      set({ type: 'drink', data: { wine } });
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
      set({
        type: 'addBottle',
        data: { wineID, wineName, pictureURL, year, regionName, countryName }
      });
    },

    /**
     * Open edit modal for wine or bottle
     */
    openEdit: (wineID: number, bottleID?: number): void => {
      set({ type: 'edit', data: { wineID, bottleID } });
    },

    /**
     * Open confirmation dialog
     */
    confirm: (options: ConfirmModalData): void => {
      set({ type: 'confirm', data: options as unknown as Record<string, unknown> });
    },

    /**
     * Show AI loading overlay
     */
    showAILoading: (message?: string): void => {
      set({ type: 'aiLoading', data: { message: message || 'Generating...' } });
    },

    /**
     * Hide AI loading overlay
     */
    hideAILoading: (): void => {
      update((current) => {
        if (current.type === 'aiLoading') {
          return { type: null, data: undefined };
        }
        return current;
      });
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

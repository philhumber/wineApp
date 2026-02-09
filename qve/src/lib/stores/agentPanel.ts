/**
 * Agent Panel Store
 * Manages panel open/close state with localStorage persistence.
 * Extracted from legacy stores/agent.ts during WIN-213.
 */

import { writable, derived } from 'svelte/store';
import { loadPanelState, persistPanelState } from './agentPersistence';

// Internal writable
const panelOpen = writable(false);

// Hydrate from localStorage on client
if (typeof window !== 'undefined') {
	const { isOpen } = loadPanelState();
	panelOpen.set(isOpen);
}

/** Reactive read-only store for panel open state */
export const agentPanelOpen = derived(panelOpen, ($p) => $p);

/** Open the agent panel */
export function openPanel(): void {
	panelOpen.set(true);
	persistPanelState({ isOpen: true });
}

/** Close the agent panel */
export function closePanel(): void {
	panelOpen.set(false);
	persistPanelState({ isOpen: false });
}

/** Toggle the agent panel */
export function togglePanel(): void {
	panelOpen.update((isOpen) => {
		const newState = !isOpen;
		persistPanelState({ isOpen: newState });
		return newState;
	});
}

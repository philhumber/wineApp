/**
 * AppState - Simple state management for the wine app
 * Observable pattern for UI updates when state changes
 */
export class AppState {
	constructor() {
		// Form navigation state
		this.currentTab = 0;

		// Rating state
		this.currentOverall = 0;
		this.currentValue = 0;
		this.preview = 0;
		this.locked = false;

		// Edit cache for wine editing
		this.editCache = {};
		this.addORedit = '';

		// Long-press detection
		this.timer = false;
		this.duration = 700;

		// Wine list and filters
		this.wines = [];
		this.filters = {};

		// Current view/route
		this.currentView = 'wines';

		// View mode for filtering: 'ourWines' (bottles > 0) or 'allWines' (all wines)
		this.viewMode = 'ourWines';

		// Target wine to scroll to after refresh
		this.targetWineID = null;

		// Observers for state changes
		this.listeners = [];
	}

	/**
	 * Update state and notify listeners
	 * @param {object} updates - Object with state properties to update
	 */
	setState(updates) {
		Object.assign(this, updates);
		this.notify();
	}

	/**
	 * Subscribe to state changes
	 * @param {function} listener - Callback function to call on state change
	 */
	subscribe(listener) {
		this.listeners.push(listener);
		return () => {
			this.listeners = this.listeners.filter(l => l !== listener);
		};
	}

	/**
	 * Notify all listeners of state change
	 */
	notify() {
		this.listeners.forEach(listener => listener(this));
	}

	/**
	 * Reset form state
	 */
	resetFormState() {
		this.currentTab = 0;
		this.editCache = {};
		this.addORedit = '';
	}

	/**
	 * Reset rating state
	 */
	resetRatingState() {
		this.currentOverall = 0;
		this.currentValue = 0;
		this.preview = 0;
		this.locked = false;
	}

	/**
	 * Set filter and update wines
	 * @param {object} filterUpdates - Filter properties to update
	 */
	setFilters(filterUpdates) {
		this.filters = { ...this.filters, ...filterUpdates };
		this.notify();
	}

	/**
	 * Clear all filters
	 */
	clearFilters() {
		this.filters = {};
		this.notify();
	}

	/**
	 * Set wines list
	 * @param {array} wines - Array of wine objects
	 */
	setWines(wines) {
		this.wines = wines;
		this.notify();
	}

	/**
	 * Set view mode (Our Wines vs All Wines)
	 * @param {string} mode - 'ourWines' or 'allWines'
	 */
	setViewMode(mode) {
		const validModes = ['ourWines', 'allWines'];
		if (validModes.includes(mode)) {
			this.viewMode = mode;
			this.notify();
		} else {
			console.warn(`Invalid view mode: ${mode}`);
		}
	}

	/**
	 * Get the bottleCount filter value based on current view mode
	 * @returns {string} '1' for ourWines, '0' for allWines
	 */
	getBottleCountForView() {
		return this.viewMode === 'ourWines' ? '1' : '0';
	}
}

// Create global instance for backward compatibility
export const appState = new AppState();
window.appState = appState;

// Export global variables for backward compatibility
export let currentTab = 0;
export let timer = false;
export let duration = 700;
export let currentOverall = 0;
export let currentValue = 0;
export let preview = 0;
export let locked = false;
export let editCache = {};
export let addORedit = '';

// Setter functions to update both module and appState
export function setCurrentTab(value) {
	currentTab = value;
	window.appState.currentTab = value;
}

export function setTimer(value) {
	timer = value;
	window.appState.timer = value;
}

export function setCurrentOverall(value) {
	currentOverall = value;
	window.appState.currentOverall = value;
}

export function setCurrentValue(value) {
	currentValue = value;
	window.appState.currentValue = value;
}

export function setPreview(value) {
	preview = value;
	window.appState.preview = value;
}

export function setLocked(value) {
	locked = value;
	window.appState.locked = value;
}

export function setEditCache(value) {
	editCache = value;
	window.appState.editCache = value;
}

export function setAddORedit(value) {
	addORedit = value;
	window.appState.addORedit = value;
}

// Target wine ID for scroll-to functionality
export let targetWineID = null;

export function setTargetWine(value) {
	targetWineID = value;
	window.appState.targetWineID = value;
}

export function clearTargetWine() {
	targetWineID = null;
	window.appState.targetWineID = null;
}

export function getTargetWine() {
	return window.appState.targetWineID;
}

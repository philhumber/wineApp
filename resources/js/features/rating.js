/**
 * RatingManager - Wine rating system with star-based UI
 * Handles rating creation, rendering, selection, and submission
 */

import { appState, setCurrentOverall, setCurrentValue } from '../core/state.js';
import { wineAPI } from '../core/api.js';
import { navigationManager } from '../ui/navigation.js';
import { dropdownManager } from '../ui/dropdowns.js';
import { toast } from '../ui/toast.js';

/**
 * RatingManager class for wine rating functionality
 */
export class RatingManager {
	constructor() {
		// Rating state
		this.currentOverall = 0;  // Overall rating (0-10)
		this.currentValue = 0;    // Value rating (0-10)
		this.preview = 0;         // Hover/preview value
		this.locked = false;      // Whether rating is locked

		// DOM element references (lazy loaded)
		this.starOverlay = null;
		this.lockBtn = null;
		this.wineToRate = null;
	}

	/**
	 * Initialize rating UI elements
	 */
	initializeElements() {
		this.starOverlay = document.getElementById('starOverlay');
		this.lockBtn = document.getElementById('lockBtn');
		this.wineToRate = document.getElementById('wineToRate');
	}

	/**
	 * Create a rating button with event handlers
	 * @param {number} index - Button value (1-10)
	 * @param {string} icon - Icon type ('Overall' or 'Value')
	 * @returns {HTMLButtonElement} Rating button
	 */
	createRating(index, icon) {
		const btn = document.createElement('button');
		btn.className = 'star-btn';
		btn.type = 'button';
		btn.setAttribute('role', 'radio');
		btn.setAttribute('aria-checked', 'false');
		btn.setAttribute('aria-label', index + ' star' + (index === 1 ? '' : 's'));
		btn.dataset.value = String(index);

		// Add icon based on type
		switch (icon) {
			case "Overall":
				btn.innerHTML = `<p>&#129346;</p>`; // Wine glass emoji
				break;
			case "Value":
				btn.innerHTML = `<p>&#128184;</p>`; // Money bag emoji
				break;
		}

		// Event handlers
		btn.addEventListener('click', (event) => {
			if (this.locked) return;
			this.select(index, event.target.closest('.rating-row'));
			btn.focus();
		});

		btn.addEventListener('mouseenter', (event) => {
			if (this.locked) return;
			this.preview = index;
			this.render(event.target.closest('.rating-row'));
		});

		btn.addEventListener('mouseleave', (event) => {
			if (this.locked) return;
			this.preview = 0;
			this.render(event.target.closest('.rating-row'));
		});

		btn.addEventListener('focus', (event) => {
			if (this.locked) return;
			this.preview = index;
			this.render(event.target.closest('.rating-row'));
		});

		btn.addEventListener('blur', (event) => {
			if (this.locked) return;
			this.preview = 0;
			this.render(event.target.closest('.rating-row'));
		});

		return btn;
	}

	/**
	 * Render rating row according to current/preview/locked state
	 * @param {HTMLElement} ratingRow - Rating row element
	 */
	render(ratingRow) {
		if (!ratingRow) return;

		// Determine which rating row this is
		const currentRow = ratingRow.id.replace("ratingRow", "");

		// Use the appropriate rating value for this row
		let currentRating = 0;
		if (currentRow === "Overall") {
			currentRating = this.currentOverall;
		} else if (currentRow === "Value") {
			currentRating = this.currentValue;
		}

		const children = Array.from(ratingRow.children);
		children.forEach((child, idx) => {
			const value = idx + 1;
			child.classList.remove('star-filled', 'star-preview');

			// Determine which value to use for rendering
			const activeValue = this.preview || currentRating;

			if (activeValue >= value) {
				child.classList.add('star-filled');
				child.setAttribute('aria-checked', 'true');
			} else {
				child.setAttribute('aria-checked', 'false');
			}

			// Add preview highlight when hovering but not committed
			if (!this.locked && this.preview && this.preview >= value) {
				child.classList.add('star-preview');
			}
		});

		// Enable lock button only if both ratings are selected and not locked
		if (this.lockBtn) {
			this.lockBtn.disabled = this.locked || this.currentOverall === 0 || this.currentValue === 0;
		}
	}

	/**
	 * Commit rating selection
	 * @param {number} value - Selected rating value (1-10)
	 * @param {HTMLElement} ratingRow - Rating row element
	 */
	select(value, ratingRow) {
		if (!ratingRow) return;

		const currentRow = ratingRow.id.replace("ratingRow", "");

		switch (currentRow) {
			case "Overall":
				this.currentOverall = value;
				setCurrentOverall(value); // Update global state
				break;
			case "Value":
				this.currentValue = value;
				setCurrentValue(value); // Update global state
				break;
		}

		this.preview = 0;
		this.render(ratingRow);
	}

	/**
	 * Lock the rating and submit to backend
	 */
	async lockRating() {
		// Ensure both ratings are selected
		if (this.currentOverall === 0 || this.currentValue === 0) {
			console.warn('Both overall and value ratings must be selected');
			return;
		}

		// Lock the rating
		this.locked = true;

		// Get all rating rows and disable them
		const ratingRows = document.querySelectorAll('.rating-row');
		ratingRows.forEach(row => {
			this.render(row);
			row.querySelectorAll('.star-btn').forEach(btn => {
				btn.disabled = true;
				btn.tabIndex = -1;
			});
		});

		// Disable lock button
		if (this.lockBtn) {
			this.lockBtn.disabled = true;
		}

		// Prepare rating data
		const wineRating = {
			wineID: document.getElementById('wineToRate')?.innerHTML || '',
			bottleID: document.getElementById('specificBottleDrunk')?.value || '',
			overallRating: this.currentOverall,
			valueRating: this.currentValue,
			drinkDate: document.getElementById('drinkDate')?.value || '',
			buyAgain: document.getElementById('buyAgain')?.value || '0',
			notes: document.getElementById('ratingNotes')?.value || ''
		};

		console.log('Submitting rating:', wineRating);

		try {
			// Submit rating to backend
			const response = await wineAPI.fetchJSON('./resources/php/drinkBottle.php', wineRating);

			if (response.success) {
				console.log('Rating submitted successfully:', response);

				// Show success toast with contextual message
				const ratingMsg = this.currentOverall >= 8 ? 'Cheers! Great wine!' :
				                  this.currentOverall >= 5 ? 'Rating saved!' :
				                  'Rating saved. Maybe try a different wine next time!';
				toast.success(ratingMsg);

				// Close modal and refresh (preserves scroll position)
				await this.closeModal();
			} else {
				console.error('Failed to submit rating:', response.error || response.message);
				toast.error('Failed to submit rating: ' + (response.error || response.message || 'Unknown error'));

				// Unlock rating on error
				this.locked = false;
				ratingRows.forEach(row => {
					row.querySelectorAll('.star-btn').forEach(btn => {
						btn.disabled = false;
						btn.tabIndex = 0;
					});
					this.render(row);
				});
			}
		} catch (error) {
			console.error('Failed to submit rating:', error);
			toast.error('Failed to submit rating: ' + error.message);

			// Unlock rating on error
			this.locked = false;
			ratingRows.forEach(row => {
				row.querySelectorAll('.star-btn').forEach(btn => {
					btn.disabled = false;
					btn.tabIndex = 0;
				});
				// Re-render the row to update visual state
				this.render(row);
			});
		}
	}

	/**
	 * Cancel rating and close modal
	 */
	cancelDrink() {
		this.closeModal();
	}

	/**
	 * Close rating modal and reset state
	 */
	async closeModal() {
		// Save scroll position for restoration after refresh
		const scrollY = window.scrollY;

		// Hide overlay
		if (this.starOverlay) {
			this.starOverlay.style.display = 'none';
		}

		// Reset state
		this.currentOverall = 0;
		this.currentValue = 0;
		this.preview = 0;
		this.locked = false;

		// Update global state
		setCurrentOverall(0);
		setCurrentValue(0);

		// Clear wine to rate
		if (this.wineToRate) {
			this.wineToRate.style.display = 'none';
			this.wineToRate.textContent = '';
		}

		// Reset lock button
		if (this.lockBtn) {
			this.lockBtn.disabled = true;
		}

		// Reset all rating buttons
		const ratingRows = document.querySelectorAll('.rating-row');
		ratingRows.forEach(row => {
			row.querySelectorAll('.star-btn').forEach(btn => {
				btn.disabled = false;
				btn.tabIndex = 0;
				btn.setAttribute('aria-checked', 'false');
			});
			this.render(row);
		});

		// Refresh dropdowns to reflect bottle changes
		await dropdownManager.refreshAll();

		// Refresh wine list
		if (navigationManager.clearContentArea) {
			navigationManager.clearContentArea();
		}

		if (window.getWineData) {
			await window.getWineData('./resources/php/getWines.php', null);
		}

		// Restore scroll position (approximately same area)
		window.scrollTo(0, scrollY);
	}

	/**
	 * Focus on a specific star button
	 * @param {number} value - Star value to focus (1-10)
	 */
	focusStar(value) {
		const ratingRows = document.querySelectorAll('.rating-row');
		ratingRows.forEach(ratingRow => {
			const btn = ratingRow.querySelector(`.star-btn[data-value="${value}"]`);
			if (btn) btn.focus();
		});
	}

	/**
	 * Initialize rating rows with buttons
	 * @param {string} ratingType - 'Overall' or 'Value'
	 * @param {string} containerId - Container element ID
	 * @param {number} maxRating - Maximum rating value (default 10)
	 */
	initializeRatingRow(ratingType, containerId, maxRating = 10) {
		const container = document.getElementById(containerId);
		if (!container) {
			console.warn(`Rating container #${containerId} not found`);
			return;
		}

		// Clear existing content
		container.innerHTML = '';

		// Create rating buttons
		for (let i = 1; i <= maxRating; i++) {
			const btn = this.createRating(i, ratingType);
			container.appendChild(btn);
		}
	}

	/**
	 * Get current ratings
	 * @returns {object} Current overall and value ratings
	 */
	getCurrentRatings() {
		return {
			overall: this.currentOverall,
			value: this.currentValue
		};
	}

	/**
	 * Reset rating state without closing modal
	 */
	reset() {
		this.currentOverall = 0;
		this.currentValue = 0;
		this.preview = 0;
		this.locked = false;

		setCurrentOverall(0);
		setCurrentValue(0);

		// Reset UI
		const ratingRows = document.querySelectorAll('.rating-row');
		ratingRows.forEach(row => {
			row.querySelectorAll('.star-btn').forEach(btn => {
				btn.disabled = false;
				btn.tabIndex = 0;
				btn.setAttribute('aria-checked', 'false');
			});
			this.render(row);
		});

		if (this.lockBtn) {
			this.lockBtn.disabled = true;
		}
	}
}

// Create global instance
export const ratingManager = new RatingManager();
window.ratingManager = ratingManager;

/**
 * Legacy function for backward compatibility
 * Create rating button
 */
export function createRating(index, icon) {
	return window.ratingManager.createRating(index, icon);
}

/**
 * Legacy function for backward compatibility
 * Render rating row
 */
export function render(ratingRow) {
	window.ratingManager.render(ratingRow);
}

/**
 * Legacy function for backward compatibility
 * Select rating value
 */
export function select(value, ratingRow) {
	window.ratingManager.select(value, ratingRow);
}

/**
 * Legacy function for backward compatibility
 * Lock and submit rating
 */
export async function lockRating() {
	await window.ratingManager.lockRating();
}

/**
 * Legacy function for backward compatibility
 * Cancel drink/rating
 */
export function cancelDrink() {
	window.ratingManager.cancelDrink();
}

/**
 * Legacy function for backward compatibility
 * Close rating modal
 */
export async function closeModal() {
	await window.ratingManager.closeModal();
}

/**
 * Legacy function for backward compatibility
 * Focus on specific star
 */
export function focusStar(value) {
	window.ratingManager.focusStar(value);
}

// Export for backward compatibility
window.createRating = createRating;
window.render = render;
window.select = select;
window.lockRating = lockRating;
window.cancelDrink = cancelDrink;
window.closeModal = closeModal;
window.focusStar = focusStar;

// Export rating state variables for backward compatibility
Object.defineProperty(window, 'currentOverall', {
	get: () => window.ratingManager.currentOverall,
	set: (value) => {
		window.ratingManager.currentOverall = value;
		setCurrentOverall(value);
	}
});

Object.defineProperty(window, 'currentValue', {
	get: () => window.ratingManager.currentValue,
	set: (value) => {
		window.ratingManager.currentValue = value;
		setCurrentValue(value);
	}
});

Object.defineProperty(window, 'preview', {
	get: () => window.ratingManager.preview,
	set: (value) => { window.ratingManager.preview = value; }
});

Object.defineProperty(window, 'locked', {
	get: () => window.ratingManager.locked,
	set: (value) => { window.ratingManager.locked = value; }
});

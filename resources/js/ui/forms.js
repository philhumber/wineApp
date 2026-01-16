/**
 * FormManager - Multi-step form navigation and validation
 * Handles tab navigation, validation, and form submission
 */

import { appState, setCurrentTab } from '../core/state.js';

/**
 * FormManager class for multi-step form handling
 */
export class FormManager {
	constructor() {
		this.currentTab = 0;
		this.addORedit = ''; // 'add' or 'edit' mode
	}

	/**
	 * Display specified tab of multi-step form
	 * @param {number} n - Tab index to show
	 */
	showTab(n) {
		const tabs = document.getElementsByClassName('tab');
		if (!tabs || tabs.length === 0) return;

		// Show current tab
		tabs[n].style.display = 'grid';

		// Update navigation buttons
		const prevBtn = document.getElementById('prevBtn');
		const nextBtn = document.getElementById('nextBtn');

		if (prevBtn) {
			prevBtn.style.display = n === 0 ? 'none' : 'inline';
		}

		if (nextBtn) {
			nextBtn.innerHTML = n === (tabs.length - 1) ? 'Submit' : 'Next';
		}

		// Update step indicator
		this.fixStepIndicator(n);

		// Update state
		this.currentTab = n;
		setCurrentTab(n);
	}

	/**
	 * Navigate to next or previous tab
	 * @param {number} n - Direction: 1 for next, -1 for previous
	 * @returns {boolean} Success status
	 */
	nextPrev(n) {
		// Allow going back without validation, or validate if going forward
		if (n === -1 || this.validateForm()) {
			const tabs = document.getElementsByClassName('tab');
			if (!tabs || tabs.length === 0) return false;

			// Move to next/previous tab
			this.currentTab = this.currentTab + n;

			// Check if reached end of form
			if (this.currentTab >= tabs.length) {
				// Form submission
				return this.handleFormSubmit(n, tabs);
			} else {
				// Navigate between tabs
				return this.navigateTabs(n, tabs);
			}
		}

		return false;
	}

	/**
	 * Handle form submission at end
	 * @param {number} n - Navigation direction
	 * @param {HTMLCollection} tabs - Form tabs
	 * @returns {boolean}
	 */
	handleFormSubmit(n, tabs) {
		if (this.addORedit === 'add') {
			if (!confirm('Are you sure you want to add this wine?')) {
				this.currentTab = this.currentTab - n;
				return false;
			}
			// Call global addWine function (will be in wine-management module)
			if (window.addWine) {
				window.addWine();
			} else {
				console.error('addWine function not found');
			}
		} else if (this.addORedit === 'edit') {
			if (!confirm('Are you sure you want to edit this wine?')) {
				this.currentTab = this.currentTab - n;
				return false;
			}
			// Call global editWine function
			if (window.editWine) {
				window.editWine();
			} else {
				console.error('editWine function not found');
			}
		} else {
			console.error(`Unknown form mode: '${this.addORedit}' (expected 'add' or 'edit')`);
		}

		// Stay on last tab
		this.currentTab = tabs.length - 1;
		return false;
	}

	/**
	 * Navigate between form tabs
	 * @param {number} n - Direction
	 * @param {HTMLCollection} tabs - Form tabs
	 * @returns {boolean}
	 */
	navigateTabs(n, tabs) {
		// Hide the previous tab
		if (n === -1) {
			tabs[this.currentTab + 1].style.display = 'none';
		} else {
			tabs[this.currentTab - 1].style.display = 'none';
		}

		// Show the new current tab
		this.showTab(this.currentTab);

		// Auto-grow textareas if function exists
		if (window.autoGrowAllTextareas) {
			window.autoGrowAllTextareas();
		}

		return true;
	}

	/**
	 * Update step indicator to show active tab
	 * @param {number} n - Active tab index
	 */
	fixStepIndicator(n) {
		const steps = document.getElementsByClassName('step');
		if (!steps || steps.length === 0) return;

		// Remove active class from all steps
		for (let i = 0; i < steps.length; i++) {
			steps[i].className = steps[i].className.replace(' active', '');
		}

		// Add active class to current step
		if (steps[n]) {
			steps[n].className += ' active';
		}
	}

	/**
	 * Validate current form tab
	 * @returns {boolean} True if valid, false otherwise
	 */
	validateForm() {
		const tabs = document.getElementsByClassName('tab');
		if (!tabs || tabs.length === 0) return true;

		const currentTabEl = tabs[this.currentTab];
		if (!currentTabEl) return true;

		const formInputs = currentTabEl.querySelectorAll('input, TextArea');
		let valid = true;

		for (let i = 0; i < formInputs.length; i++) {
			const input = formInputs[i];

			// Skip inputs that are already marked as "selected"
			if (input.getAttribute('valid') === 'selected') {
				break;
			}

			// Reset validation state
			input.setAttribute('valid', '');

			// Validate based on type
			const validateType = input.dataset.validatetype;

			if (validateType === 'text') {
				if (input.value === '') {
					input.setAttribute('valid', 'invalid');
					valid = false;
				}
			} else if (validateType === 'year') {
				if (input.value === '') {
					// Year is optional, skip validation
				} else if (isNaN(input.value) || isNaN(parseFloat(input.value))) {
					input.setAttribute('valid', 'invalid');
					valid = false;
				} else if (input.value < 1000 || input.value > 2100) {
					input.setAttribute('valid', 'invalid');
					valid = false;
				}
			} else if (validateType === 'number') {
				// Number validation - optional but must be valid if provided
				if (input.value !== '' && (isNaN(input.value) || isNaN(parseFloat(input.value)))) {
					input.setAttribute('valid', 'invalid');
					valid = false;
				}
			} else if (validateType === 'date') {
				// Date validation can be added here if needed
			}
		}

		return valid;
	}

	/**
	 * Set form mode (add or edit)
	 * @param {string} mode - 'add' or 'edit'
	 */
	setMode(mode) {
		this.addORedit = mode;
		// Also update global variable for backward compatibility
		if (typeof window.addORedit !== 'undefined') {
			window.addORedit = mode;
		}
	}

	/**
	 * Reset form to first tab
	 */
	reset() {
		this.currentTab = 0;
		this.addORedit = '';
		setCurrentTab(0);
		this.showTab(0);
	}

	/**
	 * Get current tab index
	 * @returns {number}
	 */
	getCurrentTab() {
		return this.currentTab;
	}
}

// Create global instance
export const formManager = new FormManager();
window.formManager = formManager;

/**
 * Legacy function for backward compatibility
 * Show specified tab
 */
export function showTab(n) {
	window.formManager.showTab(n);
}

/**
 * Legacy function for backward compatibility
 * Navigate next/previous
 */
export function nextPrev(n) {
	return window.formManager.nextPrev(n);
}

/**
 * Legacy function for backward compatibility
 * Fix step indicator
 */
export function fixStepIndicator(n) {
	window.formManager.fixStepIndicator(n);
}

/**
 * Legacy function for backward compatibility
 * Validate form
 */
export function validateForm() {
	return window.formManager.validateForm();
}

// Export for backward compatibility
window.showTab = showTab;
window.nextPrev = nextPrev;
window.fixStepIndicator = fixStepIndicator;
window.validateForm = validateForm;

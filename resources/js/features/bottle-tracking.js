/**
 * BottleTrackingManager - Bottle management and tracking
 * Handles drinking bottles, adding bottles, and editing bottle information
 */

import { wineAPI } from '../core/api.js';
import { appState, setEditCache } from '../core/state.js';
import { navigationManager } from '../ui/navigation.js';
import { hideOverlay } from '../ui/modals.js';
import { ratingManager } from './rating.js';

/**
 * BottleTrackingManager class for bottle operations
 */
export class BottleTrackingManager {
	constructor() {
		this.editCache = {};
	}

	/**
	 * Drink a bottle - show rating modal
	 * @param {string|number} wineID - Wine ID
	 */
	async drinkBottle(wineID) {
		try {
			// Load rating HTML
			await navigationManager.loadHTMLContent("./rating.html", "contentArea", true);

			// Get bottles for this wine
			const response = await wineAPI.fetchJSON('./resources/php/getBottles.php', { wineID: wineID });

			// Populate bottle dropdown
			if (response.data && response.data.bottleList) {
				const htmlResponse = response.data.bottleList.map(bottle =>
					`<option value="${bottle.bottleID}">${bottle.bottleSize} - ${bottle.source} (${bottle.dateAdded})</option>`
				).join('');

				const bottleDropdown = document.getElementById('specificBottleDrunk');
				if (bottleDropdown) {
					bottleDropdown.innerHTML = htmlResponse;
				}
			} else {
				console.error("Failed to load bottle list:", response);
			}

			// Hide pop-ups
			if (window.hidePopUps) window.hidePopUps();

			// Initialize date picker
			const elem = document.querySelector('input[name="drinkDate"]');
			if (elem) {
				elem.value = new Date(Date.now()).toLocaleDateString('en-GB');

				// Initialize Datepicker if available
				if (typeof Datepicker !== 'undefined') {
					new Datepicker(elem, {
						format: 'dd/mm/yyyy',
						todayButton: true,
						maxView: 2,
						todayButtonMode: 1,
						todayHighlight: true,
					});
				}
			}

			// Show star overlay
			const starOverlay = document.getElementById('starOverlay');
			if (starOverlay) {
				starOverlay.style.display = 'flex';
			}

			// Set wine ID to rate
			const wineToRate = document.getElementById('wineToRate');
			if (wineToRate) {
				wineToRate.innerHTML = wineID;
			}

			hideOverlay();

			// Initialize rating manager elements
			ratingManager.initializeElements();

			// Build rating stars (10-star system)
			const ratingRows = document.querySelectorAll('.rating-row');
			ratingRows.forEach(row => {
				const icon = row.id.replace("ratingRow", "");
				for (let i = 1; i <= 10; i++) {
					const star = ratingManager.createRating(i, icon);
					row.appendChild(star);
				}
			});

			// Focus on first star
			setTimeout(() => {
				if (ratingManager.focusStar) {
					ratingManager.focusStar(1);
				}
			}, 40);

		} catch (error) {
			console.error("Failed to open drink bottle modal:", error);
			alert("Failed to load drink bottle form. Please try again.");
		}
	}

	/**
	 * Add a bottle to an existing wine
	 * @param {string|number} wineID - Wine ID
	 */
	async addBottle(wineID) {
		try {
			// Load add bottle HTML
			await navigationManager.loadHTMLContent("./addBottle.html", "contentArea", true);

			// Hide pop-ups
			if (window.hidePopUps) window.hidePopUps();

			// Show star overlay
			const starOverlay = document.getElementById('starOverlay');
			if (starOverlay) {
				starOverlay.style.display = 'flex';
			}

			// Set wine ID
			const wineToAdd = document.getElementById('wineToAdd');
			if (wineToAdd) {
				wineToAdd.innerHTML = wineID;
			}

			hideOverlay();

		} catch (error) {
			console.error("Failed to open add bottle modal:", error);
			alert("Failed to load add bottle form. Please try again.");
		}
	}

	/**
	 * Edit bottle information for a wine
	 * @param {string|number} wineID - Wine ID
	 */
	async editBottle(wineID) {
		try {
			// Set form mode to edit
			if (window.formManager) {
				window.formManager.setMode('edit');
			}

			// Hide pop-ups
			if (window.hidePopUps) window.hidePopUps();

			// Clear content and load edit form
			await navigationManager.clearContentArea('./editWine.html');

			hideOverlay();

			// Set wine ID to edit
			const wineToEdit = document.getElementById('wineToEdit');
			if (wineToEdit) {
				wineToEdit.innerHTML = wineID;
			}

			// Get bottle data
			const bottleData = await wineAPI.fetchJSON('./resources/php/getBottles.php', { wineID: wineID });

			// Cache edit data
			this.editCache = bottleData;
			setEditCache(bottleData);
			console.log('Edit cache:', this.editCache);

			// Populate bottle dropdown
			if (bottleData.data && bottleData.data.bottleList) {
				let htmlResponse = bottleData.data.bottleList.map(bottle =>
					`<option value="${bottle.bottleID}">${bottle.bottleSize} - ${bottle.source} (${bottle.dateAdded})</option>`
				).join('');

				htmlResponse = `<option value="1">Choose A Bottle</option>` + htmlResponse;

				const bottleDropdown = document.getElementById('bottleID');
				if (bottleDropdown) {
					bottleDropdown.innerHTML = htmlResponse;
				}
			} else {
				console.error("Failed to load bottle list:", bottleData);
			}

			// Get wine data
			const wineData = await wineAPI.fetchJSON('./resources/php/getWines.php', { wineID: wineID });
			console.log('Wine data:', wineData);

			// Populate wine information
			if (wineData.data && wineData.data.wineList) {
				const wine = wineData.data.wineList.find(w => w.wineID == wineID);
				if (wine) {
					const { wineName, year, wineType, description, tastingNotes, pairing, pictureURL } = wine;

					const wineNameEl = document.getElementById('wineName');
					const wineYearEl = document.getElementById('wineYear');
					const wineTypeEl = document.getElementById('wineTypeDropDown');
					const descriptionEl = document.getElementById('wineDescription');
					const tastingEl = document.getElementById('wineTasting');
					const pairingEl = document.getElementById('winePairing');
					const pictureEl = document.getElementById('winePicture');

					if (wineNameEl) wineNameEl.value = wineName || '';
					if (wineYearEl) wineYearEl.value = year || '';
					if (wineTypeEl) wineTypeEl.value = wineType || '';
					if (descriptionEl) descriptionEl.value = description || '';
					if (tastingEl) tastingEl.value = tastingNotes || '';
					if (pairingEl) pairingEl.value = pairing || '';
					if (pictureEl) pictureEl.value = pictureURL || '';
				}
			}

		} catch (error) {
			console.error("Failed to load edit bottle form:", error);
			alert("Failed to load edit bottle form. Please try again.");
		}
	}

	/**
	 * Get bottles for a specific wine
	 * @param {string|number} wineID - Wine ID
	 * @returns {Promise<Array>} Array of bottles
	 */
	async getBottles(wineID) {
		try {
			const response = await wineAPI.fetchJSON('./resources/php/getBottles.php', { wineID: wineID });
			return response.data?.bottleList || [];
		} catch (error) {
			console.error("Failed to get bottles:", error);
			return [];
		}
	}

	/**
	 * Submit bottle addition
	 * @param {object} bottleData - Bottle data to add
	 * @returns {Promise<object>} Response from API
	 */
	async submitAddBottle(bottleData) {
		try {
			const response = await wineAPI.pushData('./resources/php/addBottle.php', bottleData);
			return response;
		} catch (error) {
			console.error("Failed to add bottle:", error);
			throw error;
		}
	}

	/**
	 * Update bottle information
	 * @param {object} bottleData - Bottle data to update
	 * @returns {Promise<object>} Response from API
	 */
	async updateBottle(bottleData) {
		try {
			const response = await wineAPI.pushData('./resources/php/updateBottle.php', bottleData);
			return response;
		} catch (error) {
			console.error("Failed to update bottle:", error);
			throw error;
		}
	}

	/**
	 * Delete a bottle
	 * @param {string|number} bottleID - Bottle ID to delete
	 * @returns {Promise<object>} Response from API
	 */
	async deleteBottle(bottleID) {
		try {
			const response = await wineAPI.pushData('./resources/php/deleteBottle.php', { bottleID });
			return response;
		} catch (error) {
			console.error("Failed to delete bottle:", error);
			throw error;
		}
	}
}

// Create global instance
export const bottleTrackingManager = new BottleTrackingManager();
window.bottleTrackingManager = bottleTrackingManager;

/**
 * Legacy function for backward compatibility
 * Drink bottle - checks if bottles are available first
 */
export async function drinkBottle(wineID) {
	// Check if wine has bottles available
	const card = document.querySelector(`[data-wine-id="${wineID}"]`);
	const bottleIcons = card?.querySelectorAll('.bottleIcon, .bottleIconBig, .bottleIconSmall');

	if (!bottleIcons || bottleIcons.length === 0) {
		// Close context menu and overlay
		if (window.hidePopUps) window.hidePopUps();
		hideOverlay();
		// Show helpful toast
		if (window.toast) {
			window.toast.info("No bottles to drink! Add one first?");
		}
		return;
	}

	await window.bottleTrackingManager.drinkBottle(wineID);
}

/**
 * Legacy function for backward compatibility
 * Add bottle
 */
export async function addBottle(wineID) {
	await window.bottleTrackingManager.addBottle(wineID);
}

/**
 * Legacy function for backward compatibility
 * Edit bottle
 */
export async function editBottle(wineID) {
	await window.bottleTrackingManager.editBottle(wineID);
}

// Export for backward compatibility
window.drinkBottle = drinkBottle;
window.addBottle = addBottle;
window.editBottle = editBottle;

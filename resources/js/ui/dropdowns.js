/**
 * DropdownManager - Filter dropdown population and management
 * Handles loading and displaying filter dropdowns for countries, regions, types, etc.
 */

import { wineAPI } from '../core/api.js';

/**
 * DropdownManager class for managing filter dropdowns
 */
export class DropdownManager {
	constructor(api) {
		this.api = api || window.wineAPI;
	}

	/**
	 * Load and populate a single dropdown
	 * @param {string} endpoint - API endpoint
	 * @param {string} elementId - Dropdown element ID
	 * @param {object} filterData - Optional filter data
	 */
	async loadDropdown(endpoint, elementId, filterData = null) {
		try {
			const response = await this.api.fetchJSON(endpoint, filterData);

			if (response.success && response.data && response.data.wineList) {
				const htmlResponse = this.buildDropdownHTML(response.data.wineList, elementId);
				const element = document.getElementById(elementId);

				if (element) {
					element.innerHTML = htmlResponse;
				} else {
					console.warn(`Dropdown element #${elementId} not found`);
				}
			}
		} catch (error) {
			console.error(`Failed to load dropdown from: ${endpoint} - into element: ${elementId}`, error);
		}
	}

	/**
	 * Apply a filter while respecting current view mode
	 * Called from dropdown onclick handlers
	 * @param {string} filterKey - The filter parameter name (e.g., 'countryDropdown')
	 * @param {string} filterValue - The filter value (e.g., 'France')
	 */
	applyFilter(filterKey, filterValue) {
		// Get the bottleCount based on current view mode (Our Wines vs All Wines)
		const bottleCount = window.appState.getBottleCountForView();

		// Merge with existing filters to support filter stacking
		const currentFilters = window.appState.filters || {};
		const newFilters = {
			...currentFilters,
			[filterKey]: filterValue,
			bottleCount: bottleCount
		};

		// Apply the filter and fetch wines
		window.getWineData('./resources/php/getWines.php', newFilters);
	}

	/**
	 * Build HTML for dropdown items
	 * @param {Array} dataList - List of data items
	 * @param {string} elementId - Dropdown element ID
	 * @returns {string} HTML string
	 */
	buildDropdownHTML(dataList, elementId) {
		let htmlResponse = '';

		dataList.forEach(dataRow => {
			const values = Object.values(dataRow);

			// Common styles for all dropdown items
			const linkStyle = 'display: block; padding: 12px 16px; color: black; text-decoration: none; border-bottom: 1px solid #ddd; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
			const hoverStyle = 'onmouseover="this.style.backgroundColor=\'#f1f1f1\'" onmouseout="this.style.backgroundColor=\'\'"';

			// Special handling for country dropdown (includes flag)
			if (elementId === 'countryDropdown') {
				const name = values[0];
				const count = values[1];
				const code = values[2];

				// Use applyFilter to respect current view mode instead of hardcoding bottleCount
				htmlResponse += `<a href="#" style="${linkStyle}" ${hoverStyle} onclick="dropdownManager.applyFilter('${elementId}', '${name}'); return false;">(${count}) <img src="images/flags/${code}.svg" alt="${name}" width="15" height="15"> ${name}</a>`;
			} else {
				const name = values[0];
				const count = values[1];

				// Use applyFilter to respect current view mode instead of hardcoding bottleCount
				htmlResponse += `<a href="#" style="${linkStyle}" ${hoverStyle} onclick="dropdownManager.applyFilter('${elementId}', '${name}'); return false;">(${count}) ${name}</a>`;
			}
		});

		return htmlResponse;
	}

	/**
	 * Refresh all filter dropdowns
	 * @param {object} filterData - Optional filter data to apply
	 */
	async refreshAll(filterData = null) {
		await Promise.all([
			this.loadDropdown('./resources/php/getCountries.php', 'countryDropdown', filterData),
			this.loadDropdown('./resources/php/getTypes.php', 'typesDropdown', filterData),
			this.loadDropdown('./resources/php/getRegions.php', 'regionDropdown', filterData),
			this.loadDropdown('./resources/php/getProducers.php', 'producerDropdown', filterData),
			this.loadDropdown('./resources/php/getYears.php', 'yearDropdown', filterData)
		]);
	}

	/**
	 * Load specific dropdown by type
	 * @param {string} type - Dropdown type (country, type, region, producer, year)
	 * @param {object} filterData - Optional filter data
	 */
	async loadByType(type, filterData = null) {
		const dropdownMap = {
			country: { endpoint: './resources/php/getCountries.php', elementId: 'countryDropdown' },
			type: { endpoint: './resources/php/getTypes.php', elementId: 'typesDropdown' },
			region: { endpoint: './resources/php/getRegions.php', elementId: 'regionDropdown' },
			producer: { endpoint: './resources/php/getProducers.php', elementId: 'producerDropdown' },
			year: { endpoint: './resources/php/getYears.php', elementId: 'yearDropdown' }
		};

		const config = dropdownMap[type];
		if (config) {
			await this.loadDropdown(config.endpoint, config.elementId, filterData);
		} else {
			console.warn(`Unknown dropdown type: ${type}`);
		}
	}

	/**
	 * Clear dropdown content
	 * @param {string} elementId - Dropdown element ID
	 */
	clearDropdown(elementId) {
		const element = document.getElementById(elementId);
		if (element) {
			element.innerHTML = '';
		}
	}

	/**
	 * Clear all filter dropdowns
	 */
	clearAll() {
		this.clearDropdown('countryDropdown');
		this.clearDropdown('typesDropdown');
		this.clearDropdown('regionDropdown');
		this.clearDropdown('producerDropdown');
		this.clearDropdown('yearDropdown');
	}
}

// Create global instance
export const dropdownManager = new DropdownManager();
window.dropdownManager = dropdownManager;

/**
 * Legacy function for backward compatibility
 * Load a single dropdown
 */
export async function loadDropdown(endpoint, elementId, filterData = null) {
	await window.dropdownManager.loadDropdown(endpoint, elementId, filterData);
}

/**
 * Legacy function for backward compatibility
 * Refresh all dropdowns
 */
export async function refreshDropDowns(filterData = null) {
	await window.dropdownManager.refreshAll(filterData);
}

// Export for backward compatibility
window.loadDropdown = loadDropdown;
window.refreshDropDowns = refreshDropDowns;

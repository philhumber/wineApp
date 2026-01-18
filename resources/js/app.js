/**
 * Main Application Entry Point
 * Initializes all modules and sets up the wine collection app
 */

// Import all modules
import { wineAPI } from './core/api.js';
import { appState, setTargetWine } from './core/state.js';
import { router } from './core/router.js';
import { modalManager, showOverlay, hideOverlay, disableScroll, enableScroll } from './ui/modals.js';
import { wineCardRenderer } from './ui/cards.js';
import { formManager } from './ui/forms.js';
import { dropdownManager } from './ui/dropdowns.js';
import { navigationManager } from './ui/navigation.js';
import { toast } from './ui/toast.js';
import { ratingManager } from './features/rating.js';
import { wineManagementManager } from './features/wine-management.js';
import { bottleTrackingManager } from './features/bottle-tracking.js';
import { aiIntegrationManager } from './features/ai-integration.js';
import * as domHelpers from './utils/dom-helpers.js';
import * as validation from './utils/validation.js';
import * as helpers from './utils/helpers.js';

/**
 * Main Application class
 */
class WineApp {
	constructor() {
		this.initialized = false;
		this.modules = {
			api: wineAPI,
			state: appState,
			router: router,
			modalManager: modalManager,
			cardRenderer: wineCardRenderer,
			formManager: formManager,
			dropdownManager: dropdownManager,
			navigationManager: navigationManager,
			ratingManager: ratingManager,
			wineManager: wineManagementManager,
			bottleManager: bottleTrackingManager,
			aiManager: aiIntegrationManager
		};
	}

	/**
	 * Initialize the application
	 */
	async init() {
		if (this.initialized) {
			console.warn('Application already initialized');
			return;
		}

		console.log('🍷 Initializing Wine Collection App...');

		try {
			// Wait for DOM to be ready
			if (document.readyState === 'loading') {
				await new Promise(resolve => {
					document.addEventListener('DOMContentLoaded', resolve);
				});
			}

			// Initialize modules in order
			await this.loadPageElements();
			this.setupEventListeners();
			this.setupDropdowns(); // Create dropdown elements FIRST
			await this.loadInitialData(); // Then populate them

			this.initialized = true;
			console.log('✅ Wine Collection App initialized successfully');
		} catch (error) {
			console.error('❌ Failed to initialize application:', error);
			throw error;
		}
	}

	/**
	 * Load sidebar and header HTML content
	 */
	async loadPageElements() {
		console.log('Loading page elements...');
		await navigationManager.loadHTMLContent('./resources/sidebar.html', 'sidebarContent');
		await navigationManager.loadHTMLContent('./resources/header.html', 'headerContent');
	}

	/**
	 * Set up event listeners
	 */
	setupEventListeners() {
		console.log('Setting up event listeners...');

		// The secret cellar
		this.setupSecretCellar();

		// Content area event delegation
		const contentArea = document.getElementById('contentArea');
		if (contentArea) {
			contentArea.addEventListener('click', async (event) => {
				await this.handleContentClick(event);
			});
		}

		// Close all dropdowns when clicking outside
		document.addEventListener('click', () => {
			document.querySelectorAll('.filter-dropdown-content').forEach(d => {
				d.style.display = 'none';
			});
		});

		// Close dropdowns on vertical scroll
		let scrollTimeout;
		window.addEventListener('scroll', () => {
			// Close dropdowns on vertical scroll for better UX
			clearTimeout(scrollTimeout);
			scrollTimeout = setTimeout(() => {
				document.querySelectorAll('.filter-dropdown-content').forEach(d => {
					d.style.display = 'none';
				});
			}, 100);
		});

		// Reposition dropdowns on horizontal scroll of filter container
		const scrollContainer = document.querySelector('.ui-bottombar');
		if (scrollContainer) {
			scrollContainer.addEventListener('scroll', () => {
				// Reposition any visible dropdowns when container scrolls
				document.querySelectorAll('.filter-dropdown-content').forEach(content => {
					if (content.style.display === 'block') {
						// Find the button associated with this dropdown
						const buttons = document.querySelectorAll('.filter-dropdown button');
						buttons.forEach(button => {
							if (button._dropdownContent === content) {
								this.positionDropdown(button, content);
							}
						});
					}
				});
			});
		}

		window.addEventListener('resize', () => {
			// Close dropdowns on resize
			document.querySelectorAll('.filter-dropdown-content').forEach(d => {
				d.style.display = 'none';
			});
		});

		// Overlay click to hide pop-ups
		const overlay = document.getElementById('myOverlay');
		if (overlay) {
			overlay.addEventListener('click', () => {
				domHelpers.hidePopUps();
				hideOverlay();
			});
		}
	}

	/**
	 * You found the secret cellar!
	 */
	setupSecretCellar() {
		let clicks = 0;
		let timeout = null;
		const title = document.getElementById('appTitle');
		if (!title) return;

		title.style.cursor = 'default';
		title.addEventListener('click', () => {
			clicks++;
			clearTimeout(timeout);
			timeout = setTimeout(() => clicks = 0, 2000);

			if (clicks === 7) {
				clicks = 0;
				title.style.transition = 'transform 0.1s ease-in-out';
				title.style.display = 'inline-block';
				let wobbles = 0;
				const wobble = setInterval(() => {
					title.style.transform = wobbles % 2 ? 'rotate(-2deg)' : 'rotate(2deg)';
					wobbles++;
					if (wobbles > 6) {
						clearInterval(wobble);
						title.style.transform = 'rotate(0deg)';
					}
				}, 100);
				toast.info('You found the secret cellar! Cheers, wine detective.', { duration: 5000 });
			}
		});
	}

	/**
	 * Handle clicks within content area (event delegation)
	 */
	async handleContentClick(event) {
		const target = event.target;

		// Lock rating button
		if (target.matches('#lockBtn') || target.closest('#lockBtn')) {
			await ratingManager.lockRating();
			return;
		}

		// Cancel drink button
		if (target.matches('#cancelBtn') || target.closest('#cancelBtn')) {
			ratingManager.cancelDrink();
			return;
		}

		// Add bottle button
		if (target.matches('#addBtn') || target.closest('#addBtn')) {
			await this.handleAddBottle();
			return;
		}

		// Generate wine data button
		if (target.matches('#genWineData') || target.closest('#genWineData')) {
			await aiIntegrationManager.genWineData();
			return;
		}

		// Generate producer data button
		if (target.matches('#genProducerData') || target.closest('#genProducerData')) {
			await aiIntegrationManager.genProducerData();
			return;
		}

		// Generate region data button
		if (target.matches('#genRegionData') || target.closest('#genRegionData')) {
			await aiIntegrationManager.genRegionData();
			return;
		}

		// Upload image button
		if (target.matches('#submit') || target.closest('#submit')) {
			event.preventDefault();
			await wineManagementManager.uploadImage();
			return;
		}
	}

	/**
	 * Handle add bottle form submission
	 */
	async handleAddBottle() {
		const bottleForm = document.getElementById('addBottleForm');
		if (!bottleForm) {
			console.error('Add bottle form not found');
			return;
		}

		const formData = new FormData(bottleForm);
		const wineToAdd = document.getElementById('wineToAdd');
		const wineID = wineToAdd ? wineToAdd.innerHTML : '';
		const data = { wineID };

		formData.forEach((value, key) => {
			data[key] = value;
		});

		try {
			const result = await wineAPI.pushData('./resources/php/addBottle.php', data);

			if (result.success) {
				console.log('Bottle added:', result);

				// Show success toast
				toast.success('Bottle added!');

				// Set target wine for scroll after refresh
				if (wineID) {
					setTargetWine(wineID);
				}

				// Close modal and refresh (will scroll to wine)
				await ratingManager.closeModal();
			} else {
				console.error('Failed to add bottle:', result.error || result.message);
				toast.error('Failed to add bottle: ' + (result.error || result.message || 'Unknown error'));
				// Form data preserved - user can retry
			}
		} catch (error) {
			console.error('Failed to add bottle:', error);
			toast.error('Failed to add bottle: ' + error.message);
			// Form data preserved - user can retry
		}
	}

	/**
	 * Load initial wine data
	 */
	async loadInitialData() {
		console.log('Loading initial data...');

		// Load wine list (default: Our Wines with bottles > 0)
		if (window.getWineData) {
			await window.getWineData('./resources/php/getWines.php', { bottleCount: '1' });
		}

		// Load filter dropdowns (wineCount: '1' ensures only options with wines appear)
		await dropdownManager.refreshAll({ bottleCount: '1', wineCount: '1' });
	}

	/**
	 * Setup dropdown functionality - completely rebuilt from scratch
	 */
	setupDropdowns() {
		console.log('Building filter dropdowns...');

		const container = document.getElementById('filterContainer');
		if (!container) {
			console.error('Filter container not found!');
			return;
		}

		// Create OURS button - toggles to Our Wines view, preserves filters
		const oursBtn = this.createFilterButton('OURS', () => {
			window.appState.setViewMode('ourWines');

			// Preserve existing filters, just update bottleCount
			const currentFilters = { ...window.appState.filters };
			currentFilters.bottleCount = '1';

			window.getWineData('./resources/php/getWines.php', currentFilters);
			window.refreshDropDowns({ bottleCount: '1', wineCount: '1' });
		});
		oursBtn.id = 'oursBtn';
		container.appendChild(oursBtn);

		// Create ALL button - toggles to All Wines view, preserves filters
		const allBtn = this.createFilterButton('ALL', () => {
			window.appState.setViewMode('allWines');

			// Preserve existing filters, just update bottleCount
			const currentFilters = { ...window.appState.filters };
			currentFilters.bottleCount = '0';

			window.getWineData('./resources/php/getWines.php', currentFilters);
			window.refreshDropDowns({ bottleCount: '0', wineCount: '1' });
		});
		allBtn.id = 'allBtn';
		container.appendChild(allBtn);

		// Create CLEAR button - clears all filters, keeps current view mode
		const clearBtn = this.createFilterButton('CLEAR', () => {
			const bottleCount = window.appState.getBottleCountForView();
			window.appState.clearFilters();
			window.getWineData('./resources/php/getWines.php', { bottleCount });
			window.refreshDropDowns({ bottleCount, wineCount: '1' });
		});
		clearBtn.id = 'clearBtn';
		container.appendChild(clearBtn);

		// Create filter dropdowns
		const filters = [
			{ id: 'typesDropdown', label: 'TYPES' },
			{ id: 'countryDropdown', label: 'COUNTRIES' },
			{ id: 'regionDropdown', label: 'REGIONS' },
			{ id: 'producerDropdown', label: 'PRODUCERS' },
			{ id: 'yearDropdown', label: 'YEAR' }
		];

		filters.forEach(filter => {
			const dropdown = this.createDropdown(filter.id, filter.label);
			container.appendChild(dropdown);
		});

		// Subscribe to state changes to update view mode indicator and filter indicators
		window.appState.subscribe(() => {
			this.updateViewModeIndicator();
			this.updateFilterIndicators();
		});

		console.log('Filter dropdowns created successfully');
	}

	/**
	 * Update the view mode indicator badge in the header
	 */
	updateViewModeIndicator() {
		const indicator = document.getElementById('viewModeIndicator');
		if (!indicator) return;

		const mode = window.appState.viewMode;
		indicator.textContent = mode === 'ourWines' ? 'Our Wines' : 'All Wines';
		indicator.classList.toggle('all-wines', mode === 'allWines');
	}

	/**
	 * Update dropdown buttons to show which filters are active
	 */
	updateFilterIndicators() {
		const filters = window.appState.filters || {};

		const filterMap = {
			'typesDropdown': 'TYPES',
			'countryDropdown': 'COUNTRIES',
			'regionDropdown': 'REGIONS',
			'producerDropdown': 'PRODUCERS',
			'yearDropdown': 'YEAR'
		};

		// Find all dropdown buttons and update their state
		document.querySelectorAll('.filter-dropdown button').forEach(btn => {
			const label = btn.textContent.trim();
			const dropdownId = Object.keys(filterMap).find(k => filterMap[k] === label);

			if (dropdownId && filters[dropdownId]) {
				btn.classList.add('has-filter');
			} else {
				btn.classList.remove('has-filter');
			}
		});
	}

	/**
	 * Create a simple filter button
	 */
	createFilterButton(label, onClick) {
		const btn = document.createElement('button');
		btn.className = 'ui-button ui-white';
		btn.innerHTML = `<b>${label}</b>`;
		btn.addEventListener('click', onClick);
		return btn;
	}

	/**
	 * Create a dropdown with button and content area using fixed positioning
	 */
	createDropdown(contentId, label) {
		const wrapper = document.createElement('div');
		wrapper.className = 'filter-dropdown';
		// Ensure wrapper is visible with explicit inline styles
		wrapper.style.display = 'inline-block';
		wrapper.style.position = 'relative';

		const button = document.createElement('button');
		button.className = 'ui-button ui-white';
		button.textContent = label;
		// Ensure button is visible
		button.style.display = 'inline-block';

		// Create dropdown content with fixed positioning (appended to body)
		const content = document.createElement('div');
		content.id = contentId;
		content.className = 'filter-dropdown-content';
		content.style.display = 'none';

		// Toggle dropdown on button click
		button.addEventListener('click', async (e) => {
			e.stopPropagation();

			// Close all other dropdowns
			document.querySelectorAll('.filter-dropdown-content').forEach(d => {
				if (d !== content) d.style.display = 'none';
			});

			// Toggle this dropdown
			const isVisible = content.style.display === 'block';

			if (isVisible) {
				content.style.display = 'none';
			} else {
				// Check if dropdown has content before showing
				if (content.children.length === 0 && content.innerHTML.trim() === '') {
					// Dropdown is empty - try to load content on demand
					if (window.dropdownManager) {
						const typeMap = {
							'typesDropdown': 'type',
							'countryDropdown': 'country',
							'regionDropdown': 'region',
							'producerDropdown': 'producer',
							'yearDropdown': 'year'
						};
						const dropdownType = typeMap[contentId];
						if (dropdownType) {
							// Use current view mode's bottleCount, always include wineCount: '1'
							const bottleCount = window.appState.getBottleCountForView();
							await window.dropdownManager.loadByType(dropdownType, { bottleCount, wineCount: '1' });
						}
					}
				}

				// Show and position the dropdown if it has content
				if (content.children.length > 0 || content.innerHTML.trim() !== '') {
					content.style.display = 'block';
					// Position dropdown relative to button
					setTimeout(() => {
						this.positionDropdown(button, content);
					}, 10);
				}
			}
		});

		wrapper.appendChild(button);

		// Append content to body for proper fixed positioning
		document.body.appendChild(content);

		// Store reference for cleanup
		button._dropdownContent = content;

		return wrapper;
	}

	/**
	 * Position dropdown content relative to button using fixed positioning
	 */
	positionDropdown(button, content) {
		const rect = button.getBoundingClientRect();
		const contentHeight = content.offsetHeight || 400; // fallback to max height
		const contentWidth = content.offsetWidth || 160; // fallback to min width
		const viewportHeight = window.innerHeight;
		const viewportWidth = window.innerWidth;

		// Vertical positioning - check if there's space below
		let top;
		const spaceBelow = viewportHeight - rect.bottom;
		const spaceAbove = rect.top;

		if (spaceBelow >= Math.min(contentHeight, 400) || spaceBelow >= spaceAbove) {
			// Position below button
			top = rect.bottom + 2;
		} else {
			// Position above button
			top = Math.max(10, rect.top - Math.min(contentHeight, 400) - 2);
		}

		// Horizontal positioning - align with button left edge
		let left = rect.left;

		// Check if dropdown goes off right edge
		if (left + contentWidth > viewportWidth) {
			left = Math.max(10, viewportWidth - contentWidth - 10);
		}

		// Check if dropdown goes off left edge
		if (left < 10) {
			left = 10;
		}

		content.style.position = 'fixed';
		content.style.top = top + 'px';
		content.style.left = left + 'px';
		content.style.backgroundColor = '#f9f9f9';
		content.style.minWidth = '160px';
		content.style.maxWidth = '200px';
		content.style.boxShadow = '0px 8px 16px 0px rgba(0,0,0,0.2)';
		content.style.zIndex = '999999';
		content.style.maxHeight = '400px';
		content.style.overflowY = 'auto';
		content.style.borderRadius = '4px';
	}

	/**
	 * Get module by name
	 */
	getModule(name) {
		return this.modules[name];
	}

	/**
	 * Reload application (useful for testing)
	 */
	async reload() {
		console.log('Reloading application...');
		await this.loadInitialData();
	}
}

// Create and export global app instance
const app = new WineApp();

// Auto-initialize when script loads
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => {
		app.init().catch(error => {
			console.error('Failed to initialize app:', error);
		});
	});
} else {
	// DOM already loaded
	app.init().catch(error => {
		console.error('Failed to initialize app:', error);
	});
}

// Export app instance
export default app;

// Make app globally accessible for debugging
window.wineApp = app;

// ===== GLOBAL EXPORTS FOR BACKWARD COMPATIBILITY =====
// These functions are called from HTML inline handlers and need to be globally available

/**
 * Get wine data and render cards
 * @param {string} endpoint - API endpoint
 * @param {object|null} filterData - Filter data (null = use saved filters)
 * @param {string} drunk - 'drunk' for drunk wines, null for regular wines
 */
window.getWineData = async function(endpoint, filterData = null, drunk = null) {
	try {
		// Use provided filters, or fall back to saved filters
		const filters = filterData !== null ? filterData : (window.appState.filters || {});

		// Save filters to state when explicitly provided
		if (filterData !== null) {
			window.appState.setFilters(filterData);
		}

		const response = await window.wineAPI.fetchJSON(endpoint, filters);
		if (response.success && response.data && response.data.wineList) {
			const isDrunkList = drunk === 'drunk';

			// Update app state with wine data
			window.appState.setWines(response.data.wineList);

			// Render wine cards
			await window.wineCardRenderer.render(
				'contentArea',
				response.data.wineList,
				isDrunkList
			);
		}
	} catch (error) {
		console.error('Failed to load wine data from:', endpoint, error);
		document.getElementById('contentArea').innerHTML = '<p>Failed to load wines. Please try again.</p>';
	}
};

/**
 * Refresh all filter dropdowns
 * @param {object} filterData - Filter data
 */
window.refreshDropDowns = async function(filterData = null) {
	await window.dropdownManager.refreshAll(filterData);
};

console.log('🍷 Wine App module loaded');

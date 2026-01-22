/**
 * NavigationManager - Sidebar and header navigation functions
 * Handles opening/closing sidebar and content area management
 */

import { showOverlay, hideOverlay } from './modals.js';

/**
 * NavigationManager class for managing sidebar and navigation
 */
export class NavigationManager {
	constructor() {
		this.sidebarId = 'mySidebar';
		this.contentAreaId = 'contentArea';
	}

	/**
	 * Open sidebar navigation
	 */
	open() {
		const sidebar = document.getElementById(this.sidebarId);
		if (!sidebar) {
			console.warn('Sidebar element not found');
			return;
		}

		// Apply sidebar animations and show it
		sidebar.classList.add('ui-animate-left');
		sidebar.classList.remove('ui-animate-right');
		sidebar.style.display = 'block';

		// Show overlay
		showOverlay();
	}

	/**
	 * Close sidebar navigation
	 */
	close() {
		const sidebar = document.getElementById(this.sidebarId);
		if (!sidebar) {
			console.warn('Sidebar element not found');
			return;
		}

		// Reverse sidebar animation
		sidebar.classList.add('ui-animate-right');
		sidebar.classList.remove('ui-animate-left');

		// Hide overlay
		hideOverlay();

		// Hide sidebar after animation finishes (sync with CSS duration)
		setTimeout(() => {
			sidebar.style.display = 'none';
		}, 300);
	}

	/**
	 * Toggle sidebar open/close
	 */
	toggle() {
		const sidebar = document.getElementById(this.sidebarId);
		if (!sidebar) return;

		const isOpen = sidebar.style.display === 'block';
		if (isOpen) {
			this.close();
		} else {
			this.open();
		}
	}

	/**
	 * Clear content area and optionally load new content
	 * @param {string} newContent - Optional HTML file to load
	 */
	async clearContentArea(newContent = null) {
		const contentArea = document.getElementById(this.contentAreaId);
		if (!contentArea) {
			console.warn('Content area element not found');
			return;
		}

		contentArea.innerHTML = '';

		if (newContent) {
			await this.loadHTMLContent(newContent, this.contentAreaId);
		}
	}

	/**
	 * Load HTML content into element
	 * @param {string} endpoint - HTML file path
	 * @param {string} elementId - Target element ID
	 * @param {boolean} append - Whether to append (true) or replace (false)
	 */
	async loadHTMLContent(endpoint, elementId, append = false) {
		try {
			const response = await fetch(endpoint);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

			const html = await response.text();
			const element = document.getElementById(elementId);

			if (element) {
				if (append) {
					element.innerHTML += html;
				} else {
					element.innerHTML = html;
				}
			} else {
				console.error(`Element #${elementId} not found`);
			}
		} catch (error) {
			console.error(`Failed to load HTML from: ${endpoint} - into element: ${elementId}`, error);
		}
	}

	/**
	 * Navigate to specific view/page
	 * @param {string} view - View name (wines, add-wine, drunk-wines, etc.)
	 */
	navigateTo(view) {
		this.close(); // Close sidebar when navigating

		switch (view) {
			case 'wines':
				// Load wine list
				if (window.getWineData) {
					window.getWineData('./resources/php/getWines.php', { bottleCount: '1' });
				}
				break;

			case 'all-wines':
				// Load all wines (including empties)
				if (window.getWineData) {
					window.getWineData('./resources/php/getWines.php', { bottleCount: '0' });
				}
				break;

			case 'drunk-wines':
				// Load drunk wines
				if (window.getWineData) {
					window.getWineData('./resources/php/getDrunkWines.php', {}, 'drunk');
				}
				break;

			case 'add-wine':
				// Load add wine page
				this.clearContentArea('./addwine.html').then(() => {
					if (window.loadAddWinePage) {
						window.loadAddWinePage();
					}
				});
				break;

			default:
				console.warn(`Unknown view: ${view}`);
		}
	}
}

// Create global instance
export const navigationManager = new NavigationManager();
window.navigationManager = navigationManager;

/**
 * Legacy function for backward compatibility
 * Open sidebar
 */
export function nav_open() {
	window.navigationManager.open();
}

/**
 * Legacy function for backward compatibility
 * Close sidebar
 */
export function nav_close() {
	window.navigationManager.close();
}

/**
 * Legacy function for backward compatibility
 * Clear content area
 */
export async function clearContentArea(newContent = null) {
	await window.navigationManager.clearContentArea(newContent);
}

/**
 * Legacy function for backward compatibility
 * Load HTML content
 */
export async function loadHTMLContent(endpoint, elementId, append = false) {
	await window.navigationManager.loadHTMLContent(endpoint, elementId, append);
}

// Export for backward compatibility
window.nav_open = nav_open;
window.nav_close = nav_close;
window.clearContentArea = clearContentArea;
window.loadHTMLContent = loadHTMLContent;

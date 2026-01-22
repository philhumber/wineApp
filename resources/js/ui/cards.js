/**
 * WineCardRenderer - Wine card template rendering and display
 * Handles loading, cloning, and populating wine card templates
 */

import { getTargetWine, clearTargetWine } from '../core/state.js';
import { wineCardPopUp } from '../utils/dom-helpers.js';

/**
 * Smooth scroll with controlled duration to match collapse animation
 * @param {number} targetY - Target scroll position
 * @param {number} duration - Animation duration in ms (default 200ms to match CSS)
 */
function smoothScrollTo(targetY, duration = 200) {
	const startY = window.pageYOffset;
	const diff = targetY - startY;
	const startTime = performance.now();

	function step(currentTime) {
		const elapsed = currentTime - startTime;
		const progress = Math.min(elapsed / duration, 1);
		// Ease-out quad to match CSS ease-out
		const easeProgress = 1 - (1 - progress) * (1 - progress);
		window.scrollTo(0, startY + diff * easeProgress);

		if (progress < 1) {
			requestAnimationFrame(step);
		}
	}

	requestAnimationFrame(step);
}

/**
 * WineCardRenderer class for rendering wine cards from template
 */
export class WineCardRenderer {
	constructor() {
		this.templateCache = {
			wineCard: null,
			drunkList: null
		};
	}

	/**
	 * Load and cache template HTML
	 * @param {string} templateType - 'wineCard' or 'drunkList'
	 * @returns {Promise<HTMLTemplateElement>}
	 */
	async loadTemplate(templateType = 'wineCard') {
		if (this.templateCache[templateType]) {
			return this.templateCache[templateType];
		}

		const templateFile = templateType === 'drunkList' ? './drunkList.html' : './wineCard.html';
		const response = await fetch(templateFile);
		if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

		const templateHTML = await response.text();
		const temp = document.createElement('div');
		temp.innerHTML = templateHTML;
		const template = temp.querySelector('template');

		this.templateCache[templateType] = template;
		return template;
	}

	/**
	 * Render wine list into container
	 * @param {string} elementId - Container element ID
	 * @param {Array} wineData - Array of wine objects
	 * @param {boolean} isDrunkList - Whether this is the drunk wines list
	 */
	async render(elementId, wineData, isDrunkList = false) {
		console.log('Rendering wines:', wineData);

		try {
			const template = await this.loadTemplate(isDrunkList ? 'drunkList' : 'wineCard');
			const container = document.getElementById(elementId);

			if (!container) {
				console.error(`Container element #${elementId} not found`);
				return;
			}

			container.innerHTML = ''; // Clear existing cards

			if (!wineData || wineData.length === 0) {
				container.innerHTML = '<h3>Start adding wines to see them here....</h3>';
				return;
			}

			// Render each wine card
			for (const wineItem of wineData) {
				const card = this.createWineCard(template, wineItem, isDrunkList);
				container.appendChild(card);
			}

			// Initialize toggles after all cards are rendered
			this.initializeCardToggles();

			// Check if we need to scroll to a target wine
			const targetWineID = getTargetWine();
			if (targetWineID) {
				// Small delay to ensure DOM is fully updated
				setTimeout(() => {
					this.scrollToCard(targetWineID);
					clearTargetWine();
				}, 100);
			}

		} catch (error) {
			console.error('Error loading wine cards:', error);
			const container = document.getElementById(elementId);
			if (container) {
				container.innerHTML = '<p>Failed to load wines. Please try again.</p>';
			}
		}
	}

	/**
	 * Create a single wine card from template
	 * @param {HTMLTemplateElement} template - Card template
	 * @param {object} wineItem - Wine data object
	 * @param {boolean} isDrunkList - Whether this is drunk list
	 * @returns {DocumentFragment}
	 */
	createWineCard(template, wineItem, isDrunkList) {
		const clone = template.content.cloneNode(true);
		const card = clone.querySelector('.wineCard');

		// Set card ID and data attribute for reliable selection
		card.id = wineItem.wineName;
		card.setAttribute('data-wine-id', wineItem.wineID);

		// Basic wine info
		card.querySelector('.wineName').textContent = wineItem.wineName;
		card.querySelector('.winePicture').src = wineItem.pictureURL;
		card.querySelector('.regionProducer').textContent = `${wineItem.regionName} - ${wineItem.producerName}`;
		card.querySelector('.wineYear').textContent = wineItem.year;
		card.querySelector('.wineDescription').textContent = wineItem.description;
		card.querySelector('.wineTasting').textContent = wineItem.tastingNotes;
		card.querySelector('.winePairing').textContent = wineItem.pairing;

		// Drunk list specific fields
		if (isDrunkList) {
			const ratingEl = card.querySelector('.wineRating');
			const notesEl = card.querySelector('.wineNotes');
			if (ratingEl) ratingEl.textContent = wineItem.avgRating;
			if (notesEl) notesEl.textContent = wineItem.Notes;
		}

		// Bottle count and rating
		this.renderBottleCount(card, wineItem);

		// Price scale indicator
		this.renderPriceScale(card, wineItem);

		// Actual price in expanded view
		this.renderActualPrice(card, wineItem);

		// Country and flag
		this.renderCountryFlag(card, wineItem);

		// Action buttons (Drink/Add/Edit)
		this.attachActionHandlers(clone, wineItem.wineID, wineItem.bottleCount);

		return clone;
	}

	/**
	 * Render bottle count with icons
	 * @param {Element} card - Wine card element
	 * @param {object} wineItem - Wine data
	 */
	renderBottleCount(card, wineItem) {
		const bottleCountEl = card.querySelector('.bottleCount');
		if (!bottleCountEl) return;

		const rating = wineItem.avgRating ?? 0;
		const bottlesDrunk = wineItem.bottlesDrunk ?? 0;

		// Show rating if bottles have been drunk
		if (bottlesDrunk > 0) {
			const ratingText = document.createElement('span');
			ratingText.textContent = `${rating.toFixed(1)}/5`;
			bottleCountEl.appendChild(ratingText);
		}

		// Add bottle icons
		const addBottleIcons = (count, className) => {
			const fragment = document.createDocumentFragment();
			for (let i = 0; i < count; i++) {
				const icon = document.createElement('img');
				icon.src = './images/ui/bottleIcon.png';
				icon.className = className;
				fragment.appendChild(icon);
			}
			bottleCountEl.appendChild(fragment);
		};

		addBottleIcons(wineItem.standardBottles || 0, 'bottleIcon');
		addBottleIcons(wineItem.largeBottles || 0, 'bottleIconBig');
		addBottleIcons(wineItem.smallBottles || 0, 'bottleIconSmall');
	}

	/**
	 * Render price scale indicator ($ to $$$$$) on collapsed card
	 * Compares wine's price to same wine type average (currency-normalized)
	 * @param {Element} card - Wine card element
	 * @param {object} wineItem - Wine data with avgPriceEUR and typeAvgPriceEUR
	 */
	renderPriceScale(card, wineItem) {
		const el = card.querySelector('.priceScale');
		if (!el) return;

		// Use price per liter (EUR) for fair comparison across currencies and bottle sizes
		const { avgPricePerLiterEUR, typeAvgPricePerLiterEUR } = wineItem;
		if (!avgPricePerLiterEUR || !typeAvgPricePerLiterEUR || typeAvgPricePerLiterEUR === 0) {
			// Show placeholder for consistent UI
			el.textContent = '—';
			el.className = 'priceScale priceScale-none';
			el.title = 'No price data';
			return;
		}

		const ratio = avgPricePerLiterEUR / typeAvgPricePerLiterEUR;
		let scale;
		if (ratio < 0.5) scale = 1;       // $ - Budget
		else if (ratio < 0.8) scale = 2;  // $$ - Value
		else if (ratio < 1.2) scale = 3;  // $$$ - Average
		else if (ratio < 1.8) scale = 4;  // $$$$ - Premium
		else scale = 5;                    // $$$$$ - Luxury

		const labels = ['', 'Budget', 'Value', 'Average', 'Premium', 'Luxury'];
		el.textContent = '$'.repeat(scale);
		el.className = `priceScale priceScale-${scale}`;
		el.title = labels[scale];
	}

	/**
	 * Render actual price in expanded view, grouped by bottle size
	 * @param {Element} card - Wine card element
	 * @param {object} wineItem - Wine data with prices by size and currency
	 */
	renderActualPrice(card, wineItem) {
		const el = card.querySelector('.winePrice');
		if (!el) return;

		const { standardPrice, magnumPrice, demiPrice, smallPrice, currency } = wineItem;
		const curr = currency || 'GBP';

		// Build price display by size
		const prices = [];
		if (standardPrice) prices.push(`Standard: ${formatPrice(standardPrice, curr)}`);
		if (magnumPrice) prices.push(`Magnum: ${formatPrice(magnumPrice, curr)}`);
		if (demiPrice) prices.push(`Half: ${formatPrice(demiPrice, curr)}`);
		if (smallPrice) prices.push(`Small: ${formatPrice(smallPrice, curr)}`);

		if (prices.length === 0) {
			el.textContent = 'No price data';
			return;
		}

		// If only one size, show just the price without label
		if (prices.length === 1) {
			const singlePrice = standardPrice || magnumPrice || demiPrice || smallPrice;
			el.textContent = formatPrice(singlePrice, curr);
		} else {
			el.textContent = prices.join(' • ');
		}
	}

	/**
	 * Render country name and flag
	 * @param {Element} card - Wine card element
	 * @param {object} wineItem - Wine data
	 */
	renderCountryFlag(card, wineItem) {
		const wineCountryEl = card.querySelector('.wineCountry');
		if (!wineCountryEl) return;

		wineCountryEl.textContent = wineItem.countryName + ' ';

		const flag = document.createElement('img');
		flag.src = `./images/flags/${wineItem.code.toLowerCase()}.svg`;
		flag.className = 'flagIcon';
		flag.alt = wineItem.countryName;

		wineCountryEl.appendChild(flag);
	}

	/**
	 * Attach action button handlers
	 * @param {DocumentFragment} clone - Card clone
	 * @param {number} wineID - Wine ID
	 * @param {number} bottleCount - Number of bottles (used to hide Edit Bottle when 0)
	 */
	attachActionHandlers(clone, wineID, bottleCount = 0) {
		clone.querySelectorAll('.action-item').forEach(item => {
			const action = item.dataset.action;

			// Hide "Edit Bottle" when wine has 0 bottles
			if (action === 'editBottle' && bottleCount === 0) {
				item.style.display = 'none';
			}

			// Hide "Drink Bottle" when wine has 0 bottles
			if (action === 'drink' && bottleCount === 0) {
				item.style.display = 'none';
			}

			item.onmousedown = () => {
				// Map actions to global functions (will be in features modules)
				const actions = {
					drink: window.drinkBottle,
					add: window.addBottle,
					editBottle: window.editBottle,
					editWine: window.editWineOnly
				};

				if (actions[action]) {
					actions[action](wineID);
				} else {
					console.warn(`Action "${action}" not implemented`);
				}
			};
		});
	}

	/**
	 * Initialize wine card expand/collapse toggles
	 */
	initializeCardToggles() {
		const cards = document.getElementsByClassName('wineCard');

		for (const card of cards) {
			// Remove existing listeners if any
			card.removeEventListener('click', card._toggleHandler);
			card.removeEventListener('contextmenu', card._contextMenuHandler);

			// Add right-click handler to show custom context menu (prevents browser menu)
			card._contextMenuHandler = (event) => {
				event.preventDefault();
				// Simulate touch event structure for wineCardPopUp
				const fakeEvent = {
					touches: [{ clientX: event.clientX, clientY: event.clientY }]
				};
				wineCardPopUp(card.id, fakeEvent);
				return false;
			};
			card.addEventListener('contextmenu', card._contextMenuHandler);

			// Create and store click handler
			card._toggleHandler = function(event) {
				// Prevent default action to avoid scroll jump from href="#"
				if (event) {
					event.preventDefault();
				}

				const scrollTop = window.pageYOffset;
				const scrollLeft = window.pageXOffset;

				const content = this.querySelector('.content');
				const contentCell = this.querySelector('.contentCell');

				if (!content || !contentCell) return;

				// Show the content so scrollHeight can be measured
				contentCell.style.display = '';

				// Handle expand/collapse logic
				const isCollapsed = !content.style.height || content.style.height === '0px';

				if (isCollapsed) {
					// EXPANDING: Simple case - just restore scroll position
					const newHeight = content.scrollHeight + 100;
					content.style.height = newHeight + 'px';
					content.style.maxHeight = content.scrollHeight + 'px';

					this.classList.toggle('active');

					requestAnimationFrame(() => {
						window.scrollTo(scrollLeft, scrollTop);
					});
				} else {
					// COLLAPSING: Check if card top is above viewport
					const cardRect = this.getBoundingClientRect();
					const cardTopAboveViewport = cardRect.top < 0;

					// Only apply scroll compensation if card is above viewport
					if (cardTopAboveViewport) {
						// Track next sibling card's position
						// Cards are wrapped: <div class="ui-container"><a class="wineCard">...</a></div>
						// So we need to go up to parent container, then find next container's card
						const parentContainer = this.parentElement;
						const nextContainer = parentContainer ? parentContainer.nextElementSibling : null;
						const nextCard = nextContainer ? nextContainer.querySelector('.wineCard') : null;
						let referenceTopBefore = null;

						if (nextCard) {
							// Record the next card's current position on screen
							referenceTopBefore = nextCard.getBoundingClientRect().top;
						}

						// Collapse the card
						this.classList.toggle('active');
						content.style.height = '0px';
						content.style.maxHeight = '0px';
						setTimeout(() => {
							contentCell.style.display = 'none';
						}, 40);

						// After DOM updates, adjust scroll to maintain next card's position
						if (referenceTopBefore !== null) {
							requestAnimationFrame(() => {
								const referenceTopAfter = nextCard.getBoundingClientRect().top;
								const diff = referenceTopAfter - referenceTopBefore;
								const topPadding = 100;
								const viewportHeight = window.innerHeight;

								// Determine if we should show collapsed card vs preserve next card position
								const collapsedCardHeight = 150;
								const headerWasOffScreen = cardRect.top < -collapsedCardHeight;
								const nextCardWasBelowViewport = referenceTopBefore > viewportHeight;
								// If card extended past middle of viewport, it was taking up a lot of space
								const cardFilledMostOfViewport = cardRect.bottom > viewportHeight * 0.5;

								let newScrollTop;
								if (headerWasOffScreen || nextCardWasBelowViewport || cardFilledMostOfViewport) {
									// Show collapsed card at top when:
									// - Header was off-screen, OR
									// - Next card was below viewport, OR
									// - Card filled most of the viewport
									newScrollTop = scrollTop + cardRect.top - topPadding;
								} else {
									// Header visible, next card in view, card didn't fill viewport:
									// preserve next card position
									newScrollTop = scrollTop + diff;
									const scrollToPlaceCardAtTop = scrollTop + referenceTopAfter - topPadding;
									newScrollTop = Math.min(newScrollTop, scrollToPlaceCardAtTop);
								}

								// Can't scroll to negative values
								newScrollTop = Math.max(0, newScrollTop);

								smoothScrollTo(newScrollTop);
							});
						} else {
							// No next card, just restore scroll
							requestAnimationFrame(() => {
								smoothScrollTo(scrollTop);
							});
						}
					} else {
						// Card is in viewport - just collapse normally
						this.classList.toggle('active');
						content.style.height = '0px';
						content.style.maxHeight = '0px';
						setTimeout(() => {
							contentCell.style.display = 'none';
						}, 40);

						requestAnimationFrame(() => {
							window.scrollTo(scrollLeft, scrollTop);
						});
					}
				}
			};

			card.addEventListener('click', card._toggleHandler);
		}
	}

	/**
	 * Scroll to a specific wine card and optionally highlight it
	 * @param {string|number} wineID - Wine ID to scroll to
	 * @param {object} options - Options: { expand: false, highlight: true }
	 * @returns {boolean} True if card was found and scrolled to
	 */
	scrollToCard(wineID, options = {}) {
		const { expand = false, highlight = true } = options;

		const card = document.querySelector(`[data-wine-id="${wineID}"]`);
		if (!card) {
			console.warn(`Wine card not found for wineID: ${wineID}`);
			return false;
		}

		// Scroll card into view (centered)
		card.scrollIntoView({ behavior: 'smooth', block: 'center' });

		// Optionally highlight the card
		if (highlight) {
			card.classList.add('highlight');
			setTimeout(() => card.classList.remove('highlight'), 2000);
		}

		// Optionally expand the card
		if (expand && !card.classList.contains('active')) {
			// Small delay to let scroll complete first
			setTimeout(() => card.click(), 500);
		}

		return true;
	}

	/**
	 * Clear cached templates
	 */
	clearCache() {
		this.templateCache = {
			wineCard: null,
			drunkList: null
		};
	}
}

// Create global instance
export const wineCardRenderer = new WineCardRenderer();
window.wineCardRenderer = wineCardRenderer;

/**
 * Legacy function for backward compatibility
 * Renders wine list using the global renderer
 */
export async function loadWineCardTemplate(elementId, wineData, drunk = null) {
	const isDrunkList = drunk !== null;
	await window.wineCardRenderer.render(elementId, wineData, isDrunkList);
}

/**
 * Legacy function for backward compatibility
 * Initialize wine card toggles
 */
export function initializeWineCardToggles() {
	window.wineCardRenderer.initializeCardToggles();
}

// Export for backward compatibility
window.loadWineCardTemplate = loadWineCardTemplate;
window.initializeWineCardToggles = initializeWineCardToggles;

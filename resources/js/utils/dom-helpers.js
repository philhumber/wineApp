/**
 * DOM Helpers - Common DOM manipulation utilities
 * Provides helper functions for list management, pop-ups, and DOM operations
 */

/**
 * Hide a list element by collapsing its height
 * @param {string} elementID - Element ID of the list
 */
export function hideList(elementID) {
	const ul = document.getElementById(elementID);
	if (!ul || !ul.parentElement) return;

	const li = ul.getElementsByTagName("li");
	const searchBoxEle = ul.parentElement;

	for (let i = 0; i < li.length; i++) {
		li[i].style.display = "none";
	}

	searchBoxEle.style.height = "0px";
}

/**
 * Show a list element by expanding its height
 * @param {string} elementID - Element ID of the list
 */
export function showList(elementID) {
	const ul = document.getElementById(elementID);
	if (!ul) return;

	const li = Array.from(ul.getElementsByTagName("li"));
	li.pop(); // Remove last item based on original logic

	const searchBoxEle = ul.parentElement;

	// Show all the items except the last one
	li.forEach(item => item.style.display = "");

	searchBoxEle.style.height = `${49 * li.length}px`;
}

/**
 * Filter list items based on search input
 * @param {string} searchBoxID - Search input element ID
 * @param {string} listElementID - List element ID
 */
export function filterList(searchBoxID, listElementID) {
	const input = document.getElementById(searchBoxID);
	if (!input) return;

	const filter = input.value.toUpperCase();
	const ul = document.getElementById(listElementID);
	if (!ul) return;

	const li = Array.from(ul.getElementsByTagName("li"));
	const searchBoxEle = input.parentElement.nextElementSibling;

	// Filter the list items based on the input
	const visibleItems = li.filter(item => {
		const txtValue = item.textContent || item.innerText;
		if (txtValue.toUpperCase().includes(filter) || item.className === "none_found") {
			item.style.display = "";
			return true;
		} else {
			item.style.display = "none";
			return false;
		}
	});

	// Update the height based on the number of visible items or show none found
	if (visibleItems.length > 0) {
		searchBoxEle.style.height = `${49 * visibleItems.length}px`;
	} else {
		li[li.length - 1].style.display = "";
		searchBoxEle.style.height = `49px`;
	}
}

/**
 * Select an item from a list
 * @param {string} selectedItem - Selected item value
 * @param {string} searchBoxID - Search input element ID
 * @param {string} listElementID - List element ID
 */
export function selectList(selectedItem, searchBoxID, listElementID) {
	const input = document.getElementById(searchBoxID);
	if (!input) return;

	if (selectedItem !== 'none_found') {
		input.value = selectedItem;
	}
	input.setAttribute("valid", "selected");

	// Hide form fields for current tab
	const formFields = document.getElementsByClassName("formFields");
	const currentTab = window.appState?.currentTab || window.currentTab || 0;
	if (formFields[currentTab]) {
		formFields[currentTab].style.display = "none";
	}

	// Populate next list in cascade
	if (window.populateAddWineList) {
		window.populateAddWineList(listElementID, selectedItem);
	}

	hideList(listElementID);
}

/**
 * Unselect an item from a list (currently unused)
 * @param {string} searchBoxID - Search input element ID
 * @param {string} listElementID - List element ID
 */
export function unselectList(searchBoxID, listElementID) {
	// Currently not implemented in original code
	// Preserved for potential future use
}

/**
 * Hide all pop-up/context menus
 */
export function hidePopUps() {
	const popUps = document.querySelectorAll(".context-menu");
	popUps.forEach(popup => {
		popup.style.display = 'none';
	});
}

/**
 * Show a wine card context menu popup at touch position
 * @param {string} elementID - Element ID
 * @param {TouchEvent} e - Touch event
 */
export function wineCardPopUp(elementID, e) {
	// Show overlay
	if (window.showOverlay) window.showOverlay();

	const element = document.getElementById(elementID);
	if (!element) return;

	const popup = element.nextElementSibling;
	if (!popup) return;

	let top = e.touches[0].clientY;
	let left = e.touches[0].clientX;

	popup.style.opacity = "0";
	popup.style.display = 'block';

	// Ensure popup stays within viewport
	const maxTop = window.innerHeight - popup.clientHeight - 10;
	const maxLeft = window.innerWidth - popup.clientWidth - 10;

	top = Math.min(top, maxTop);
	left = Math.min(left, maxLeft);

	popup.style.top = `${top + window.scrollY}px`;
	popup.style.left = `${left + window.scrollX}px`;
	popup.style.opacity = "1";
}

/**
 * Disable right-click context menu on specified elements
 * @param {string} elementID - Element selector
 */
export function disableRightClick(elementID) {
	const elements = document.querySelectorAll(elementID);
	const overlay = document.getElementById("myOverlay");

	if (!overlay) return;

	overlay.addEventListener('mousedown', () => {
		for (let i = 0; i < elements.length; i++) {
			for (const child of elements[i].children) {
				child.addEventListener('contextmenu', (e) => {
					e.preventDefault();
				});
			}

			elements[i].parentElement.addEventListener('contextmenu', (e) => {
				e.preventDefault();
			});
			elements[i].nextElementSibling.style.display = 'none';
		}
	});
}

/**
 * Touch start handler for long press
 * @param {TouchEvent} e - Touch event
 */
export function touchStart(e) {
	if (window.timer) return;

	let parentCard = e.target;
	while (parentCard && parentCard.tagName.toLowerCase() !== 'a') {
		parentCard = parentCard.parentElement;
	}

	if (!parentCard) return;

	window.timer = setTimeout(() => {
		wineCardPopUp(parentCard.id, e);
	}, 500);
}

/**
 * Touch move handler for long press (cancels long press)
 */
export function touchMove() {
	if (window.timer) {
		clearTimeout(window.timer);
		window.timer = null;

		const fadingElement = document.querySelector(".fade-to-dark");
		if (fadingElement) {
			fadingElement.classList.remove("fade-to-dark");
		}
	}
}

/**
 * Touch end handler for long press
 */
export function touchEnd() {
	if (window.timer) {
		clearTimeout(window.timer);
		window.timer = null;
	}
}

/**
 * Auto-grow all textareas to fit content
 */
export function autoGrowAllTextareas() {
	document.querySelectorAll('textarea').forEach(textarea => {
		textarea.style.height = 'auto';
		textarea.style.height = textarea.scrollHeight + 'px';
	});
}

/**
 * Close all open dropdowns
 */
export function closeDropdowns() {
	const dropdowns = document.querySelectorAll('.dropdown');
	dropdowns.forEach(d => d.classList.remove('active'));
}

/**
 * Initialize wine card toggle functionality
 */
export function initializeWineCardToggles() {
	const cards = document.getElementsByClassName("wineCard");

	for (const card of cards) {
		card.addEventListener("click", function () {
			const scrollTop = window.pageYOffset;
			const scrollLeft = window.pageXOffset;

			this.classList.toggle("active");

			const content = this.querySelector('.content');
			const contentCell = this.querySelector('.contentCell');

			// Show the content so scrollHeight can be measured
			if (contentCell) {
				contentCell.style.display = "";
			}

			// Handle expand/collapse logic
			if (this.classList.contains("active")) {
				if (content) {
					content.style.maxHeight = content.scrollHeight + "px";
				}
			} else {
				if (content) {
					content.style.maxHeight = null;
				}
			}

			// Restore scroll position
			window.scrollTo(scrollLeft, scrollTop);
		});
	}
}

// Export for backward compatibility
window.hideList = hideList;
window.showList = showList;
window.filterList = filterList;
window.selectList = selectList;
window.unselectList = unselectList;
window.hidePopUps = hidePopUps;
window.wineCardPopUp = wineCardPopUp;
window.disableRightClick = disableRightClick;
window.touchStart = touchStart;
window.touchMove = touchMove;
window.touchEnd = touchEnd;
window.autoGrowAllTextareas = autoGrowAllTextareas;
window.closeDropdowns = closeDropdowns;
window.initializeWineCardToggles = initializeWineCardToggles;

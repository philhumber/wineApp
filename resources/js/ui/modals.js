/**
 * ModalManager - Manages overlay and modal display
 * Handles showing/hiding overlays and preventing scroll
 */

// Scroll prevention setup
const keys = {37: 1, 38: 1, 39: 1, 40: 1};

function preventDefault(e) {
	e.preventDefault();
}

function preventDefaultForScrollKeys(e) {
	if (keys[e.keyCode]) {
		preventDefault(e);
		return false;
	}
}

// Modern Chrome requires { passive: false } when adding event
let supportsPassive = false;
try {
	window.addEventListener("test", null, Object.defineProperty({}, 'passive', {
		get: function () { supportsPassive = true; }
	}));
} catch(e) {}

const wheelOpt = supportsPassive ? { passive: false } : false;
const wheelEvent = 'onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel';

/**
 * Disable page scrolling (for modals)
 */
export function disableScroll() {
	window.addEventListener('DOMMouseScroll', preventDefault, false); // older FF
	window.addEventListener(wheelEvent, preventDefault, wheelOpt); // modern desktop
	window.addEventListener('touchmove', preventDefault, wheelOpt); // mobile
	window.addEventListener('keydown', preventDefaultForScrollKeys, false);
}

/**
 * Enable page scrolling
 */
export function enableScroll() {
	window.removeEventListener('DOMMouseScroll', preventDefault, false);
	window.removeEventListener(wheelEvent, preventDefault, wheelOpt);
	window.removeEventListener('touchmove', preventDefault, wheelOpt);
	window.removeEventListener('keydown', preventDefaultForScrollKeys, false);
}

/**
 * Show overlay (dim background)
 */
export function showOverlay() {
	const overlay = document.getElementById("myOverlay");
	if (!overlay) return;

	overlay.classList.add("ui-animate-opacity");
	overlay.classList.remove("ui-animate-opacity-rev");
	overlay.style.display = "block";
	disableScroll();
}

/**
 * Hide overlay
 */
export function hideOverlay() {
	enableScroll();

	const overlay = document.getElementById("myOverlay");
	if (!overlay) return;

	overlay.classList.add("ui-animate-opacity-rev");
	overlay.classList.remove("ui-opacity", "ui-animate-opacity");

	// Hide after animation completes
	setTimeout(() => {
		overlay.style.display = "none";
	}, 300);
}

/**
 * ModalManager class for more advanced modal handling
 */
export class ModalManager {
	constructor() {
		this.activeModals = [];
	}

	/**
	 * Show a modal element
	 * @param {string|HTMLElement} modal - Modal element ID or element itself
	 * @param {boolean} showOverlayBg - Whether to show overlay background
	 */
	show(modal, showOverlayBg = true) {
		const modalEl = typeof modal === 'string' ? document.getElementById(modal) : modal;
		if (!modalEl) {
			console.error('Modal element not found:', modal);
			return;
		}

		if (showOverlayBg) {
			showOverlay();
		}

		modalEl.style.display = 'flex';
		this.activeModals.push(modalEl);
	}

	/**
	 * Hide a modal element
	 * @param {string|HTMLElement} modal - Modal element ID or element itself
	 * @param {boolean} hideOverlayBg - Whether to hide overlay background
	 */
	hide(modal, hideOverlayBg = true) {
		const modalEl = typeof modal === 'string' ? document.getElementById(modal) : modal;
		if (!modalEl) return;

		modalEl.style.display = 'none';
		this.activeModals = this.activeModals.filter(m => m !== modalEl);

		if (hideOverlayBg && this.activeModals.length === 0) {
			hideOverlay();
		}
	}

	/**
	 * Hide all modals
	 */
	hideAll() {
		this.activeModals.forEach(modal => {
			modal.style.display = 'none';
		});
		this.activeModals = [];
		hideOverlay();
	}

	/**
	 * Check if any modals are active
	 * @returns {boolean}
	 */
	hasActiveModals() {
		return this.activeModals.length > 0;
	}
}

// Create global instance
export const modalManager = new ModalManager();
window.modalManager = modalManager;

// Make functions globally available for backward compatibility
window.showOverlay = showOverlay;
window.hideOverlay = hideOverlay;
window.disableScroll = disableScroll;
window.enableScroll = enableScroll;

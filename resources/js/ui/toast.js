/**
 * ToastManager - Lightweight toast notification system
 * Displays temporary messages for success, error, warning, and info states
 */

/**
 * ToastManager class for managing toast notifications
 */
export class ToastManager {
	constructor() {
		this.container = null;
		this.toasts = [];
		this.defaultDuration = {
			success: 3000,
			error: 5000,
			warning: 4000,
			info: 3000
		};
	}

	/**
	 * Initialize toast container (lazy creation)
	 */
	initContainer() {
		if (this.container) return;

		this.container = document.createElement('div');
		this.container.id = 'toast-container';
		this.container.className = 'toast-container';
		document.body.appendChild(this.container);
	}

	/**
	 * Show a toast notification
	 * @param {string} message - Message to display
	 * @param {string} type - Toast type: 'success', 'error', 'warning', 'info'
	 * @param {object} options - Optional settings
	 * @returns {HTMLElement} The toast element
	 */
	show(message, type = 'info', options = {}) {
		this.initContainer();

		const duration = options.duration || this.defaultDuration[type] || 3000;
		const dismissable = options.dismissable !== false;

		// Create toast element
		const toast = document.createElement('div');
		toast.className = `toast toast-${type}`;
		toast.setAttribute('role', 'alert');
		toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

		// Icon based on type
		const icons = {
			success: '\u2713', // Checkmark
			error: '\u2717',   // X mark
			warning: '\u26A0', // Warning triangle
			info: '\u2139'     // Info circle
		};

		toast.innerHTML = `
			<span class="toast-icon">${icons[type] || icons.info}</span>
			<span class="toast-message">${this.escapeHtml(message)}</span>
			${dismissable ? '<button class="toast-close" aria-label="Close">\u00D7</button>' : ''}
		`;

		// Add click handler for dismiss button
		if (dismissable) {
			const closeBtn = toast.querySelector('.toast-close');
			closeBtn.addEventListener('click', () => this.dismiss(toast));
		}

		// Add to container
		this.container.appendChild(toast);
		this.toasts.push(toast);

		// Trigger animation (allow DOM to update first)
		requestAnimationFrame(() => {
			toast.classList.add('toast-visible');
		});

		// Auto-dismiss after duration
		if (duration > 0) {
			setTimeout(() => this.dismiss(toast), duration);
		}

		return toast;
	}

	/**
	 * Dismiss a toast notification
	 * @param {HTMLElement} toast - Toast element to dismiss
	 */
	dismiss(toast) {
		if (!toast || !toast.parentNode) return;

		toast.classList.remove('toast-visible');
		toast.classList.add('toast-hiding');

		// Remove after animation completes
		setTimeout(() => {
			if (toast.parentNode) {
				toast.parentNode.removeChild(toast);
			}
			this.toasts = this.toasts.filter(t => t !== toast);
		}, 300);
	}

	/**
	 * Dismiss all toasts
	 */
	dismissAll() {
		[...this.toasts].forEach(toast => this.dismiss(toast));
	}

	/**
	 * Show success toast
	 * @param {string} message - Success message
	 * @param {object} options - Optional settings
	 */
	success(message, options = {}) {
		return this.show(message, 'success', options);
	}

	/**
	 * Show error toast
	 * @param {string} message - Error message
	 * @param {object} options - Optional settings
	 */
	error(message, options = {}) {
		return this.show(message, 'error', options);
	}

	/**
	 * Show warning toast
	 * @param {string} message - Warning message
	 * @param {object} options - Optional settings
	 */
	warning(message, options = {}) {
		return this.show(message, 'warning', options);
	}

	/**
	 * Show info toast
	 * @param {string} message - Info message
	 * @param {object} options - Optional settings
	 */
	info(message, options = {}) {
		return this.show(message, 'info', options);
	}

	/**
	 * Escape HTML to prevent XSS
	 * @param {string} text - Text to escape
	 * @returns {string} Escaped text
	 */
	escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}
}

// Create global instance
export const toast = new ToastManager();
window.toast = toast;

// Legacy function exports for backward compatibility
export function showToast(message, type = 'info', options = {}) {
	return window.toast.show(message, type, options);
}

export function showSuccess(message, options = {}) {
	return window.toast.success(message, options);
}

export function showError(message, options = {}) {
	return window.toast.error(message, options);
}

export function showWarning(message, options = {}) {
	return window.toast.warning(message, options);
}

export function showInfo(message, options = {}) {
	return window.toast.info(message, options);
}

// Export for backward compatibility
window.showToast = showToast;
window.showSuccess = showSuccess;
window.showError = showError;
window.showWarning = showWarning;
window.showInfo = showInfo;

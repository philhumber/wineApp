/**
 * Helpers - General utility functions
 * Provides date formatting, text utilities, and other helper functions
 */

/**
 * Format date to localized string
 * @param {Date|string|number} date - Date to format
 * @param {string} locale - Locale string (default: 'en-GB')
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDate(date, locale = 'en-GB', options = {}) {
	try {
		const dateObj = date instanceof Date ? date : new Date(date);
		if (isNaN(dateObj.getTime())) {
			return '';
		}

		const defaultOptions = {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		};

		return dateObj.toLocaleDateString(locale, { ...defaultOptions, ...options });
	} catch (error) {
		console.error('Error formatting date:', error);
		return '';
	}
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 * @param {Date|string|number} date - Date to format
 * @returns {string} ISO date string
 */
export function formatDateISO(date) {
	try {
		const dateObj = date instanceof Date ? date : new Date(date);
		if (isNaN(dateObj.getTime())) {
			return '';
		}

		return dateObj.toISOString().split('T')[0];
	} catch (error) {
		console.error('Error formatting date to ISO:', error);
		return '';
	}
}

/**
 * Format date to dd/mm/yyyy format
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDateDDMMYYYY(date) {
	try {
		const dateObj = date instanceof Date ? date : new Date(date);
		if (isNaN(dateObj.getTime())) {
			return '';
		}

		const day = String(dateObj.getDate()).padStart(2, '0');
		const month = String(dateObj.getMonth() + 1).padStart(2, '0');
		const year = dateObj.getFullYear();

		return `${day}/${month}/${year}`;
	} catch (error) {
		console.error('Error formatting date:', error);
		return '';
	}
}

/**
 * Get current date as dd/mm/yyyy string
 * @returns {string} Current date formatted as dd/mm/yyyy
 */
export function getCurrentDateDDMMYYYY() {
	return formatDateDDMMYYYY(new Date());
}

/**
 * Parse dd/mm/yyyy date string to Date object
 * @param {string} dateString - Date string in dd/mm/yyyy format
 * @returns {Date|null} Date object or null if invalid
 */
export function parseDateDDMMYYYY(dateString) {
	try {
		const parts = dateString.split('/');
		if (parts.length !== 3) return null;

		const day = parseInt(parts[0], 10);
		const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
		const year = parseInt(parts[2], 10);

		const date = new Date(year, month, day);
		if (isNaN(date.getTime())) return null;

		return date;
	} catch (error) {
		console.error('Error parsing date:', error);
		return null;
	}
}

/**
 * Truncate text to specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to append (default: '...')
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength, suffix = '...') {
	if (!text || text.length <= maxLength) return text;
	return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitalize first letter of string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function capitalizeFirst(str) {
	if (!str) return '';
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Capitalize first letter of each word
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function capitalizeWords(str) {
	if (!str) return '';
	return str.split(' ').map(word => capitalizeFirst(word)).join(' ');
}

/**
 * Convert string to slug (URL-friendly)
 * @param {string} str - String to convert
 * @returns {string} Slug string
 */
export function slugify(str) {
	if (!str) return '';
	return str
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '') // Remove non-word chars
		.replace(/[\s_-]+/g, '-')  // Replace spaces/underscores with hyphens
		.replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
}

/**
 * Format price with currency symbol
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: 'GBP')
 * @param {string} locale - Locale string (default: 'en-GB')
 * @returns {string} Formatted price string
 */
export function formatPrice(amount, currency = 'GBP', locale = 'en-GB') {
	try {
		return new Intl.NumberFormat(locale, {
			style: 'currency',
			currency: currency
		}).format(amount);
	} catch (error) {
		console.error('Error formatting price:', error);
		return `${currency} ${amount}`;
	}
}

/**
 * Debounce function to limit execution rate
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

/**
 * Throttle function to limit execution rate
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
	let inThrottle;
	return function executedFunction(...args) {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => inThrottle = false, limit);
		}
	};
}

/**
 * Deep clone an object
 * @param {object} obj - Object to clone
 * @returns {object} Cloned object
 */
export function deepClone(obj) {
	if (obj === null || typeof obj !== 'object') return obj;

	// Handle Date
	if (obj instanceof Date) {
		return new Date(obj.getTime());
	}

	// Handle Array
	if (Array.isArray(obj)) {
		return obj.map(item => deepClone(item));
	}

	// Handle Object
	const clonedObj = {};
	for (const key in obj) {
		if (obj.hasOwnProperty(key)) {
			clonedObj[key] = deepClone(obj[key]);
		}
	}
	return clonedObj;
}

/**
 * Check if two objects are deeply equal
 * @param {any} obj1 - First object
 * @param {any} obj2 - Second object
 * @returns {boolean} True if equal
 */
export function deepEqual(obj1, obj2) {
	if (obj1 === obj2) return true;

	if (obj1 == null || obj2 == null) return false;
	if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;

	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);

	if (keys1.length !== keys2.length) return false;

	for (const key of keys1) {
		if (!keys2.includes(key)) return false;
		if (!deepEqual(obj1[key], obj2[key])) return false;
	}

	return true;
}

/**
 * Generate a random ID
 * @param {number} length - Length of ID (default: 8)
 * @returns {string} Random ID
 */
export function generateID(length = 8) {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

/**
 * Sleep/delay function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
export function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 * @param {any} value - Value to check
 * @returns {boolean} True if empty
 */
export function isEmpty(value) {
	if (value == null) return true;
	if (typeof value === 'string' && value.trim() === '') return true;
	if (Array.isArray(value) && value.length === 0) return true;
	if (typeof value === 'object' && Object.keys(value).length === 0) return true;
	return false;
}

/**
 * Format number with thousand separators
 * @param {number} num - Number to format
 * @param {string} locale - Locale string (default: 'en-GB')
 * @returns {string} Formatted number
 */
export function formatNumber(num, locale = 'en-GB') {
	try {
		return new Intl.NumberFormat(locale).format(num);
	} catch (error) {
		console.error('Error formatting number:', error);
		return String(num);
	}
}

/**
 * Get query parameter from URL
 * @param {string} param - Parameter name
 * @returns {string|null} Parameter value or null
 */
export function getQueryParam(param) {
	const urlParams = new URLSearchParams(window.location.search);
	return urlParams.get(param);
}

/**
 * Set query parameter in URL (without reload)
 * @param {string} param - Parameter name
 * @param {string} value - Parameter value
 */
export function setQueryParam(param, value) {
	const url = new URL(window.location);
	url.searchParams.set(param, value);
	window.history.pushState({}, '', url);
}

// Export for backward compatibility
window.formatDate = formatDate;
window.formatDateISO = formatDateISO;
window.formatDateDDMMYYYY = formatDateDDMMYYYY;
window.getCurrentDateDDMMYYYY = getCurrentDateDDMMYYYY;
window.parseDateDDMMYYYY = parseDateDDMMYYYY;
window.truncateText = truncateText;
window.capitalizeFirst = capitalizeFirst;
window.capitalizeWords = capitalizeWords;
window.slugify = slugify;
window.formatPrice = formatPrice;
window.debounce = debounce;
window.throttle = throttle;
window.deepClone = deepClone;
window.deepEqual = deepEqual;
window.generateID = generateID;
window.sleep = sleep;
window.isEmpty = isEmpty;
window.formatNumber = formatNumber;
window.getQueryParam = getQueryParam;
window.setQueryParam = setQueryParam;

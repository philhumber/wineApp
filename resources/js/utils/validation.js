/**
 * Validation - Form validation utilities
 * Provides validation functions for form inputs
 */

/**
 * Validation rules and functions
 */
export const ValidationRules = {
	/**
	 * Validate text field (non-empty)
	 * @param {string} value - Value to validate
	 * @returns {boolean} True if valid
	 */
	text: (value) => {
		return value !== null && value !== undefined && value.trim() !== '';
	},

	/**
	 * Validate year (1000-2100 range)
	 * @param {string|number} value - Value to validate
	 * @returns {boolean} True if valid
	 */
	year: (value) => {
		// Year is optional, so empty is valid
		if (value === '' || value === null || value === undefined) {
			return true;
		}

		// Must be a number
		if (isNaN(value) || isNaN(parseFloat(value))) {
			return false;
		}

		// Must be in valid range
		const yearNum = parseInt(value);
		return yearNum >= 1000 && yearNum <= 2100;
	},

	/**
	 * Validate date (basic validation)
	 * @param {string} value - Value to validate
	 * @returns {boolean} True if valid
	 */
	date: (value) => {
		// Empty date is valid (optional)
		if (value === '' || value === null || value === undefined) {
			return true;
		}

		// Try to parse as date
		const date = new Date(value);
		return !isNaN(date.getTime());
	},

	/**
	 * Validate email address
	 * @param {string} value - Value to validate
	 * @returns {boolean} True if valid
	 */
	email: (value) => {
		if (value === '' || value === null || value === undefined) {
			return false;
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(value);
	},

	/**
	 * Validate number (positive or negative)
	 * @param {string|number} value - Value to validate
	 * @returns {boolean} True if valid
	 */
	number: (value) => {
		if (value === '' || value === null || value === undefined) {
			return true; // Optional
		}

		return !isNaN(value) && !isNaN(parseFloat(value));
	},

	/**
	 * Validate positive number (> 0)
	 * @param {string|number} value - Value to validate
	 * @returns {boolean} True if valid
	 */
	positiveNumber: (value) => {
		if (value === '' || value === null || value === undefined) {
			return true; // Optional
		}

		const num = parseFloat(value);
		return !isNaN(num) && num > 0;
	},

	/**
	 * Validate URL
	 * @param {string} value - Value to validate
	 * @returns {boolean} True if valid
	 */
	url: (value) => {
		if (value === '' || value === null || value === undefined) {
			return true; // Optional
		}

		try {
			new URL(value);
			return true;
		} catch (e) {
			return false;
		}
	}
};

/**
 * Validate a single input field
 * @param {HTMLInputElement|HTMLTextAreaElement} input - Input element
 * @param {string} validationType - Validation type (text, year, date, etc.)
 * @returns {boolean} True if valid
 */
export function validateInput(input, validationType) {
	if (!input) return true;

	// Get validation function
	const validator = ValidationRules[validationType];
	if (!validator) {
		console.warn(`Unknown validation type: ${validationType}`);
		return true;
	}

	// Validate
	const isValid = validator(input.value);

	// Update visual state
	if (isValid) {
		input.setAttribute('valid', '');
		input.classList.remove('invalid');
	} else {
		input.setAttribute('valid', 'invalid');
		input.classList.add('invalid');
	}

	return isValid;
}

/**
 * Validate all inputs in a form or container
 * @param {HTMLElement} container - Container element
 * @returns {boolean} True if all inputs are valid
 */
export function validateForm(container) {
	if (!container) return true;

	const inputs = container.querySelectorAll('input[data-validatetype], textarea[data-validatetype]');
	let allValid = true;

	inputs.forEach(input => {
		// Skip inputs that are already marked as "selected"
		if (input.getAttribute('valid') === 'selected') {
			return;
		}

		const validateType = input.dataset.validatetype;
		if (validateType) {
			const isValid = validateInput(input, validateType);
			if (!isValid) {
				allValid = false;
			}
		}
	});

	return allValid;
}

/**
 * Validate a specific form tab
 * @param {number} tabIndex - Tab index
 * @returns {boolean} True if tab is valid
 */
export function validateTab(tabIndex) {
	const tabs = document.getElementsByClassName('tab');
	if (!tabs || !tabs[tabIndex]) return true;

	return validateForm(tabs[tabIndex]);
}

/**
 * Clear validation state for all inputs in a container
 * @param {HTMLElement} container - Container element
 */
export function clearValidation(container) {
	if (!container) return;

	const inputs = container.querySelectorAll('input, textarea');
	inputs.forEach(input => {
		input.setAttribute('valid', '');
		input.classList.remove('invalid');
	});
}

/**
 * Mark a field as required
 * @param {HTMLInputElement|HTMLTextAreaElement} input - Input element
 */
export function markRequired(input) {
	if (!input) return;
	input.setAttribute('required', 'true');
	input.setAttribute('data-validatetype', input.getAttribute('data-validatetype') || 'text');
}

/**
 * Mark a field as optional
 * @param {HTMLInputElement|HTMLTextAreaElement} input - Input element
 */
export function markOptional(input) {
	if (!input) return;
	input.removeAttribute('required');
}

/**
 * Check if a field is required
 * @param {HTMLInputElement|HTMLTextAreaElement} input - Input element
 * @returns {boolean} True if required
 */
export function isRequired(input) {
	if (!input) return false;
	return input.hasAttribute('required') || input.getAttribute('data-validatetype') === 'text';
}

/**
 * Sanitize input to prevent XSS
 * @param {string} input - Input string
 * @returns {string} Sanitized string
 */
export function sanitizeInput(input) {
	if (typeof input !== 'string') return input;

	// Create a temporary div to use browser's HTML parser
	const temp = document.createElement('div');
	temp.textContent = input;
	return temp.innerHTML;
}

/**
 * Sanitize object (sanitize all string values)
 * @param {object} obj - Object to sanitize
 * @returns {object} Sanitized object
 */
export function sanitizeObject(obj) {
	if (!obj || typeof obj !== 'object') return obj;

	const sanitized = {};
	for (const key in obj) {
		if (typeof obj[key] === 'string') {
			sanitized[key] = sanitizeInput(obj[key]);
		} else if (typeof obj[key] === 'object') {
			sanitized[key] = sanitizeObject(obj[key]);
		} else {
			sanitized[key] = obj[key];
		}
	}
	return sanitized;
}

// Export for backward compatibility
window.validateInput = validateInput;
window.validateForm = validateForm;
window.validateTab = validateTab;
window.clearValidation = clearValidation;
window.sanitizeInput = sanitizeInput;
window.sanitizeObject = sanitizeObject;
window.ValidationRules = ValidationRules;

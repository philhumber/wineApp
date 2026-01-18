/**
 * WineManagementManager - Add, edit, and manage wine workflows
 * Handles wine form submission, page loading, and wine CRUD operations
 */

import { wineAPI } from '../core/api.js';
import { appState, setEditCache, setTargetWine } from '../core/state.js';
import { formManager } from '../ui/forms.js';
import { navigationManager } from '../ui/navigation.js';
import { modalManager, hideOverlay } from '../ui/modals.js';
import { dropdownManager } from '../ui/dropdowns.js';
import { toast } from '../ui/toast.js';

/**
 * WineManagementManager class for wine CRUD operations
 */
export class WineManagementManager {
	constructor() {
		this.wineForm = null;
		this.editCache = {};
	}

	/**
	 * Initialize drop zone functionality for drag & drop uploads
	 */
	initDropzone() {
		const dropzone = document.getElementById('uploadDropzone');
		const fileInput = document.getElementById('fileToUpload');
		if (!dropzone || !fileInput) return;

		// Prevent default drag behaviors on document
		['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
			document.body.addEventListener(eventName, (e) => {
				e.preventDefault();
				e.stopPropagation();
			}, false);
		});

		// Highlight drop zone when dragging over
		['dragenter', 'dragover'].forEach(eventName => {
			dropzone.addEventListener(eventName, () => {
				dropzone.classList.add('is-dragging');
			}, false);
		});

		// Remove highlight when leaving or dropping
		['dragleave', 'drop'].forEach(eventName => {
			dropzone.addEventListener(eventName, () => {
				dropzone.classList.remove('is-dragging');
			}, false);
		});

		// Handle dropped files
		dropzone.addEventListener('drop', (e) => {
			const files = e.dataTransfer.files;
			if (files.length > 0) {
				const dataTransfer = new DataTransfer();
				dataTransfer.items.add(files[0]);
				fileInput.files = dataTransfer.files;
				this.uploadImage();
			}
		}, false);

		// Handle file input change (click to browse)
		fileInput.addEventListener('change', () => {
			if (fileInput.files.length > 0) {
				this.uploadImage();
			}
		});

		// Replace image button
		const replaceBtn = document.getElementById('replaceImageBtn');
		if (replaceBtn) {
			replaceBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.resetDropzone();
				fileInput.click();
			});
		}
	}

	/**
	 * Show loading state in dropzone
	 */
	showDropzoneLoading() {
		const content = document.getElementById('dropzoneContent');
		const preview = document.getElementById('dropzonePreview');
		const loading = document.getElementById('dropzoneLoading');
		const fileInput = document.getElementById('fileToUpload');

		if (content) content.style.display = 'none';
		if (preview) preview.style.display = 'none';
		if (loading) loading.style.display = 'flex';
		if (fileInput) fileInput.style.display = 'none';
	}

	/**
	 * Show preview state in dropzone with uploaded image
	 * @param {string} imagePath - Path to the uploaded image
	 */
	showDropzonePreview(imagePath) {
		const content = document.getElementById('dropzoneContent');
		const preview = document.getElementById('dropzonePreview');
		const loading = document.getElementById('dropzoneLoading');
		const thumbnail = document.getElementById('dropzoneThumbnail');
		const fileInput = document.getElementById('fileToUpload');
		const dropzone = document.getElementById('uploadDropzone');

		if (content) content.style.display = 'none';
		if (loading) loading.style.display = 'none';
		if (preview) preview.style.display = 'flex';
		if (thumbnail) {
			const timestamp = new Date().getTime();
			thumbnail.src = `./${imagePath}?t=${timestamp}`;
		}
		if (fileInput) fileInput.style.display = 'none';
		if (dropzone) dropzone.classList.remove('is-error');
	}

	/**
	 * Show error state in dropzone
	 * @param {string} message - Error message to display
	 */
	showDropzoneError(message) {
		const content = document.getElementById('dropzoneContent');
		const preview = document.getElementById('dropzonePreview');
		const loading = document.getElementById('dropzoneLoading');
		const dropzone = document.getElementById('uploadDropzone');
		const status = document.getElementById('uploadStatus');
		const fileInput = document.getElementById('fileToUpload');

		if (content) content.style.display = 'flex';
		if (preview) preview.style.display = 'none';
		if (loading) loading.style.display = 'none';
		if (dropzone) dropzone.classList.add('is-error');
		if (status) status.innerHTML = `<span style="color:red">${message}</span>`;
		if (fileInput) fileInput.style.display = 'block';
	}

	/**
	 * Reset dropzone to default state
	 */
	resetDropzone() {
		const content = document.getElementById('dropzoneContent');
		const preview = document.getElementById('dropzonePreview');
		const loading = document.getElementById('dropzoneLoading');
		const dropzone = document.getElementById('uploadDropzone');
		const status = document.getElementById('uploadStatus');
		const fileInput = document.getElementById('fileToUpload');

		if (content) content.style.display = 'flex';
		if (preview) preview.style.display = 'none';
		if (loading) loading.style.display = 'none';
		if (dropzone) dropzone.classList.remove('is-error', 'is-dragging');
		if (status) status.innerHTML = '';
		if (fileInput) {
			fileInput.value = '';
			fileInput.style.display = 'block';
		}
	}

	/**
	 * Load the add wine page with initial data
	 */
	async loadAddWinePage() {
		try {
			// Remove load tag if present
			document.getElementById("loadTag")?.remove();

			// Initialize empty lists with "not found" messages
			['producer', 'wine'].forEach(type => {
				const listId = `${type}List`;
				const listEl = document.getElementById(listId);
				if (listEl) {
					listEl.innerHTML = this.createNotFoundItem(type);
					if (window.hideList) window.hideList(listId);
				}
			});

			// Load all regions
			const allRegions = await wineAPI.fetchJSON('./resources/php/getRegions.php');
			if (allRegions) {
				this.populateListHTML(allRegions, "regionList", "findRegion");
			}

			// Hide region list initially
			if (window.hideList) window.hideList("regionList");

			// Reset to first tab
			formManager.reset();

			// Set mode AFTER reset (reset clears the mode)
			formManager.setMode('add');

			// Initialize dropzone functionality
			this.initDropzone();

		} catch (error) {
			console.error("Failed to load data for Add Wine page:", error);
			const contentArea = document.getElementById('contentArea');
			if (contentArea) {
				contentArea.innerHTML = "<p>Failed to load Add Wine content. Please try again.</p>";
			}
		}
	}

	/**
	 * Load the edit wine page
	 */
	async loadEditWinePage() {
		try {
			// Remove load tag if present
			document.getElementById("loadTag")?.remove();

			// Initialize dropzone functionality
			this.initDropzone();

		} catch (error) {
			console.error("Failed to load data for edit Wine page:", error);
			const contentArea = document.getElementById('contentArea');
			if (contentArea) {
				contentArea.innerHTML = "<p>Failed to load edit Wine content. Please try again.</p>";
			}
		}
	}

	/**
	 * Populate cascading add wine list (region -> producer -> wine)
	 * @param {string} listToUpdate - List ID to update ('regionList' or 'producerList')
	 * @param {string} filterData - Filter value
	 */
	async populateAddWineList(listToUpdate, filterData) {
		const config = {
			regionList: {
				endpoint: './resources/php/getProducers.php',
				filterKey: 'regionName',
				targetList: 'producerList',
				targetInput: 'findProducer',
				useStandardPopulate: true
			},
			producerList: {
				endpoint: './resources/php/getWines.php',
				filterKey: 'producerDropdown',
				targetList: 'wineList',
				targetInput: 'findWine',
				useStandardPopulate: false
			}
		};

		const settings = config[listToUpdate];
		if (!settings) return;

		const response = await wineAPI.fetchJSON(settings.endpoint, {
			[settings.filterKey]: filterData,
			bottleCount: '0'
		});

		if (settings.useStandardPopulate) {
			this.populateListHTML(response, settings.targetList, settings.targetInput);
		} else {
			// Custom wine list with year display
			const wineHTML = this.createNotFoundItem('wine') + response.data.wineList.map(wine => {
				const yearDisplay = wine.year ? ` - ${wine.year}` : '';
				return `<li tabindex="0" onmousedown="selectList('${wine.wineName}', '${settings.targetInput}', '${settings.targetList}')" class="listitem">${wine.wineName}${yearDisplay} (${wine.bottleCount})</li>`;
			}).join('');

			const targetList = document.getElementById(settings.targetList);
			if (targetList) {
				targetList.innerHTML = wineHTML;
			}
		}
	}

	/**
	 * Populate list HTML from API response
	 * @param {object} dataArray - API response data
	 * @param {string} elementId - Target element ID
	 * @param {string} inputId - Associated input field ID
	 * @param {number} labelIndex - Index of label value (default 0)
	 * @param {number} countIndex - Index of count value (default 1)
	 */
	populateListHTML(dataArray, elementId, inputId, labelIndex = 0, countIndex = 1) {
		const items = dataArray.data?.wineList || dataArray;
		const listName = elementId.replace('List', '');

		const html = this.createNotFoundItem(listName) + items.map(item => {
			const values = Object.values(item);
			return `<li tabindex="0" onmousedown="selectList('${values[labelIndex]}', '${inputId}', '${elementId}')" class="listitem">${values[labelIndex]} (${values[countIndex]})</li>`;
		}).join('');

		const element = document.getElementById(elementId);
		if (element) {
			element.innerHTML = html;
		}
	}

	/**
	 * Create "not found" list item
	 * @param {string} type - Type of item (region, producer, wine)
	 * @returns {string} HTML string
	 */
	createNotFoundItem(type) {
		const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
		return `<li tabindex="0" onmousedown="selectList('none_found','find${capitalizedType}','${type}List');showAddDetails('${type}');" style="display: none; font-size: 0.7em;" class="none_found"><a href="#">Tap here to add a new ${type}.</a></li>`;
	}

	/**
	 * Show additional details form for adding new region/producer/wine
	 * @param {string} listName - Type to add (region, producer, wine)
	 */
	showAddDetails(listName) {
		const addDetails = document.getElementById('new' + listName);
		if (!addDetails) return;

		// Populate input with search value
		switch (listName) {
			case 'region':
				const regionInput = document.getElementById('findRegion');
				if (regionInput) {
					document.getElementById('regionName').value = regionInput.value;
					regionInput.value = '';
				}
				break;
			case 'producer':
				const producerInput = document.getElementById('findProducer');
				if (producerInput) {
					document.getElementById('producerName').value = producerInput.value;
					producerInput.value = '';
				}
				break;
			case 'wine':
				const wineInput = document.getElementById('findWine');
				if (wineInput) {
					document.getElementById('wineName').value = wineInput.value;
					wineInput.value = '';
				}
				break;
		}

		// Show form with animation
		addDetails.classList.add("ui-animate-opacity");
		addDetails.classList.remove("ui-animate-opacity-rev");
		addDetails.style.display = "";
	}

	/**
	 * Add a new wine to the collection
	 */
	async addWine() {
		this.wineForm = document.getElementById("addWineForm");
		if (!this.wineForm) {
			console.error('Add wine form not found');
			return;
		}

		const formData = new FormData(this.wineForm);
		const data = {};

		// Build data object from form
		formData.forEach((value, key) => {
			if (value === "") {
				switch (key) {
					case "winePicture":
						value = "images/wines/placeBottle.png";
						break;
				}
			}
			data[key] = value;
		});

		try {
			const result = await wineAPI.pushData('./resources/php/addWine.php', data);

			if (result.success) {
				// Check for error in response data (legacy format)
				if (result.data && typeof result.data === 'string' && result.data.startsWith("\"Error")) {
					console.error("Failed to add wine:", result.data);
					toast.error("Upload failed: " + result.data);
					return; // Keep form data for retry
				}

				console.log("Wine added:", result.data);

				// Extract the new wine ID
				const newWineID = result.data?.wineID;

				// Refresh dropdowns to reflect new wine data
				await dropdownManager.refreshAll();

				// Show success toast
				toast.success('Wine added successfully!');

				// Set target wine for scroll after refresh
				if (newWineID) {
					setTargetWine(newWineID);
				}

				// Hide any open pop-ups
				if (window.hidePopUps) window.hidePopUps();
				hideOverlay();

				// Navigate to wine list (will trigger scroll to new wine)
				if (window.getWineData) {
					await window.getWineData('./resources/php/getWines.php', null);
				}
			} else {
				console.error("Failed to add wine:", result.error || result.message);
				toast.error("Failed to add wine: " + (result.error || result.message || 'Unknown error'));
				// Form data preserved - user can retry
			}
		} catch (error) {
			console.error("Failed to add wine:", error);
			toast.error("Failed to add wine: " + error.message);
			// Form data preserved - user can retry
		}
	}

	/**
	 * Edit an existing wine
	 */
	async editWine() {
		this.wineForm = document.getElementById("editWineForm");
		if (!this.wineForm) {
			console.error('Edit wine form not found');
			return;
		}

		const formData = new FormData(this.wineForm);
		const data = {};

		// Build data object from form
		formData.forEach((value, key) => {
			if (value === "") {
				switch (key) {
					case "winePicture":
						value = "images/wines/placeBottle.png";
						break;
				}
			}
			data[key] = value;
		});

		// Add wine ID
		const wineToEdit = document.getElementById('wineToEdit');
		if (wineToEdit) {
			data.wineID = wineToEdit.innerHTML;
		}

		console.log('Editing wine:', data);

		try {
			// Check form mode to determine which updates to perform
			const formMode = window.formManager?.addORedit;
			const isWineOnlyMode = formMode === 'editWineOnly';
			const isBottleOnlyMode = formMode === 'editBottleOnly';

			let bottleSuccess = true; // Default to true when skipping
			let wineSuccess = true; // Default to true when skipping

			if (isWineOnlyMode) {
				// Only update wine data
				console.log('Edit wine only mode - skipping bottle update');
				wineSuccess = false;
				const wineResult = await wineAPI.pushData('./resources/php/updateWine.php', data);

				if (wineResult.success) {
					console.log('Wine updated:', wineResult.data);
					wineSuccess = true;
				} else {
					console.error('Wine update failed:', wineResult);
				}
			} else if (isBottleOnlyMode) {
				// Only update bottle data
				console.log('Edit bottle only mode - skipping wine update');
				bottleSuccess = false;
				const bottleResult = await wineAPI.pushData('./resources/php/updateBottle.php', data);

				if (bottleResult.success) {
					console.log('Bottle updated:', bottleResult.data);
					bottleSuccess = true;
				} else {
					console.error('Bottle update failed:', bottleResult);
				}
			} else {
				// Update both bottle and wine in parallel (legacy 'edit' mode)
				bottleSuccess = false;
				wineSuccess = false;
				const [bottleResult, wineResult] = await Promise.allSettled([
					wineAPI.pushData('./resources/php/updateBottle.php', data),
					wineAPI.pushData('./resources/php/updateWine.php', data)
				]);

				if (bottleResult.status === 'fulfilled' && bottleResult.value.success) {
					console.log('Bottle updated:', bottleResult.value.data);
					bottleSuccess = true;
				} else {
					console.error('Bottle update failed:', bottleResult.reason || bottleResult.value);
				}

				if (wineResult.status === 'fulfilled' && wineResult.value.success) {
					console.log('Wine updated:', wineResult.value.data);
					wineSuccess = true;
				} else {
					console.error('Wine update failed:', wineResult.reason || wineResult.value);
				}
			}

			// Show success if updates succeeded
			if (bottleSuccess && wineSuccess) {
				// Refresh dropdowns to reflect updated wine data
				await dropdownManager.refreshAll();

				// Show success toast
				toast.success('Wine updated successfully!');

				// Set target wine for scroll after refresh
				if (data.wineID) {
					setTargetWine(data.wineID);
				}

				// Hide any open pop-ups
				if (window.hidePopUps) window.hidePopUps();
				hideOverlay();

				// Navigate to wine list (will trigger scroll to edited wine)
				if (window.getWineData) {
					await window.getWineData('./resources/php/getWines.php', null);
				}
			} else {
				toast.error("Wine edit partially failed. Check console for details.");
				// Form data preserved - user can retry
			}
		} catch (error) {
			console.error("Failed to edit wine:", error);
			toast.error("Wine edit failed: " + error.message);
			// Form data preserved - user can retry
		}
	}

	/**
	 * Upload wine image with dropzone integration
	 */
	async uploadImage() {
		const fileInput = document.getElementById('fileToUpload');
		const uploadStatus = document.getElementById("uploadStatus");
		const winePictureField = document.getElementById("winePicture");

		if (uploadStatus) {
			uploadStatus.innerHTML = '';
		}

		if (!fileInput || !fileInput.files[0]) {
			this.showDropzoneError('Please select a file first.');
			return;
		}

		// Client-side validation
		const file = fileInput.files[0];
		const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
		if (!allowedTypes.includes(file.type)) {
			this.showDropzoneError('Only JPG, PNG, GIF, and WebP images are allowed.');
			return;
		}

		// Validate file size (10MB max)
		const maxSize = 10 * 1024 * 1024;
		if (file.size > maxSize) {
			this.showDropzoneError('File is too large. Maximum size is 10MB.');
			return;
		}

		// Show loading state
		this.showDropzoneLoading();

		try {
			const result = await wineAPI.pushData('./resources/php/upload.php', "winePictureUpload");

			if (result.success) {
				const isError = /^.?Error/.test(result.data);

				if (isError) {
					this.showDropzoneError(result.data);
				} else {
					// Success - extract filename and show preview
					const filename = result.data.replace('Filename: ', '');

					// Update hidden field
					if (winePictureField) {
						winePictureField.value = filename;
					}

					// Show success status
					if (uploadStatus) {
						uploadStatus.innerHTML = '<span style="color:green">Image uploaded!</span>';
					}

					// Show preview in dropzone
					this.showDropzonePreview(filename);
				}
			}
		} catch (error) {
			console.error("Failed to upload image:", error);
			this.showDropzoneError('Upload failed: ' + error.message);
		}
	}

	/**
	 * Show thumbnail preview of uploaded image (legacy support)
	 * @param {string} filename - Image path (e.g., "images/wines/GUID.jpg")
	 */
	showUploadThumbnail(filename) {
		// Use the new dropzone preview if available
		const dropzone = document.getElementById('uploadDropzone');
		if (dropzone) {
			this.showDropzonePreview(filename);
			return;
		}

		// Legacy fallback for non-dropzone contexts
		const uploadStatus = document.getElementById('uploadStatus');
		if (!uploadStatus) return;

		let previewContainer = document.getElementById('uploadPreviewContainer');

		if (!previewContainer) {
			previewContainer = document.createElement('div');
			previewContainer.id = 'uploadPreviewContainer';
			previewContainer.className = 'upload-preview-container';
			uploadStatus.parentNode.insertBefore(previewContainer, uploadStatus.nextSibling);
		}

		// Add timestamp to prevent caching
		const timestamp = new Date().getTime();
		previewContainer.innerHTML = `
			<div class="upload-preview">
				<img src="./${filename}?t=${timestamp}" alt="Wine image preview" class="upload-thumbnail" />
			</div>
		`;
	}

	/**
	 * Populate edit bottle form with existing data
	 * @param {string|number} bottleID - Bottle ID
	 */
	async populateEditBottle(bottleID) {
		// Get bottle data from edit cache
		const editCache = appState.editCache || this.editCache;
		const bottle = editCache.data?.bottleList?.find(b => b.bottleID == bottleID);

		if (!bottle) {
			console.warn('Bottle not found in edit cache:', bottleID);
			return;
		}

		const { bottleSize, location, source, price, currency } = bottle;

		// Populate form fields
		const bottleSizeEl = document.getElementById('bottleSizeDropdown');
		const locationEl = document.getElementById('storageLocationDropDown');
		const sourceEl = document.getElementById('bottleSource');
		const priceEl = document.getElementById('bottlePrice');
		const currencyEl = document.getElementById('currencyDropdown');

		if (bottleSizeEl) bottleSizeEl.value = bottleSize || '';
		if (locationEl) locationEl.value = location || '';
		if (sourceEl) sourceEl.value = source || '';
		if (priceEl) priceEl.value = price || '';
		if (currencyEl) currencyEl.value = currency || '';

		// Show extra details section
		const extraDetails = document.getElementById('bottleExtraDetails');
		if (extraDetails) {
			extraDetails.classList.add("ui-animate-opacity");
			extraDetails.classList.remove("ui-animate-opacity-rev");
			extraDetails.style.display = "";
		}
	}

	/**
	 * Execute function by name (legacy support)
	 * @param {string} functionName - Function name to execute
	 * @param {object} context - Execution context
	 */
	executeFunctionByName(functionName, context /*, args */) {
		const args = Array.prototype.slice.call(arguments, 2);
		const tagEl = document.getElementById(args[1]);
		if (tagEl) tagEl.remove();
		args.pop();

		const namespaces = functionName.split(".");
		const func = namespaces.pop();

		for (let i = 0; i < namespaces.length; i++) {
			context = context[namespaces[i]];
		}

		return context[func].apply(context, args);
	}
}

// Create global instance
export const wineManagementManager = new WineManagementManager();
window.wineManagementManager = wineManagementManager;

/**
 * Legacy function for backward compatibility
 * Load add wine page
 */
export async function loadAddWinePage() {
	await window.wineManagementManager.loadAddWinePage();
}

/**
 * Legacy function for backward compatibility
 * Load edit wine page
 */
export async function loadEditWinePage() {
	await window.wineManagementManager.loadEditWinePage();
}

/**
 * Legacy function for backward compatibility
 * Populate add wine list
 */
export async function populateAddWineList(listToUpdate, filterData) {
	await window.wineManagementManager.populateAddWineList(listToUpdate, filterData);
}

/**
 * Legacy function for backward compatibility
 * Populate list HTML
 */
export function populateListHTML(dataArray, elementId, inputId, labelIndex = 0, countIndex = 1) {
	window.wineManagementManager.populateListHTML(dataArray, elementId, inputId, labelIndex, countIndex);
}

/**
 * Legacy function for backward compatibility
 * Create not found item
 */
export function createNotFoundItem(type) {
	return window.wineManagementManager.createNotFoundItem(type);
}

/**
 * Legacy function for backward compatibility
 * Show add details
 */
export function showAddDetails(listName) {
	window.wineManagementManager.showAddDetails(listName);
}

/**
 * Legacy function for backward compatibility
 * Add wine
 */
export async function addWine() {
	await window.wineManagementManager.addWine();
}

/**
 * Legacy function for backward compatibility
 * Edit wine
 */
export async function editWine() {
	await window.wineManagementManager.editWine();
}

/**
 * Legacy function for backward compatibility
 * Upload image
 */
export async function uploadImage() {
	await window.wineManagementManager.uploadImage();
}

/**
 * Legacy function for backward compatibility
 * Populate edit bottle
 */
export async function populateEditBottle(bottleID) {
	await window.wineManagementManager.populateEditBottle(bottleID);
}

/**
 * Legacy function for backward compatibility
 * Execute function by name
 */
export function executeFunctionByName(functionName, context) {
	const args = Array.prototype.slice.call(arguments);
	return window.wineManagementManager.executeFunctionByName.apply(window.wineManagementManager, args);
}

// Export for backward compatibility
window.loadAddWinePage = loadAddWinePage;
window.loadEditWinePage = loadEditWinePage;
window.populateAddWineList = populateAddWineList;
window.populateListHTML = populateListHTML;
window.createNotFoundItem = createNotFoundItem;
window.showAddDetails = showAddDetails;
window.addWine = addWine;
window.editWine = editWine;
window.uploadImage = uploadImage;
window.populateEditBottle = populateEditBottle;
window.executeFunctionByName = executeFunctionByName;

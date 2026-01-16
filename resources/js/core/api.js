/**
 * WineAPI - Centralized API communication layer
 * Handles all backend interactions with PHP endpoints
 */
export class WineAPI {
	constructor(baseURL = './resources/php/') {
		this.baseURL = baseURL;
	}

	/**
	 * Generic JSON fetch method
	 * @param {string} endpoint - API endpoint path
	 * @param {object|null} filterData - Optional filter/query data
	 * @returns {Promise<object>} Response object with success, message, data
	 */
	async fetchJSON(endpoint, filterData = null) {
		const options = filterData ? {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(filterData)
		} : {
			method: 'GET'
		};

		const rawResponse = await fetch(endpoint, options);
		if (!rawResponse.ok) throw new Error(`HTTP error! status: ${rawResponse.status}`);

		const response = await rawResponse.json();
		if (response.success == true) {
			console.log(response.message);
		} else {
			console.error(response.message);
		}

		return response;
	}

	/**
	 * Generic POST method for sending data
	 * @param {string} endpoint - API endpoint path
	 * @param {object|string} data - Data to send (object for JSON, "winePictureUpload" for file upload)
	 * @returns {Promise<object>} Response object with success, message, data
	 */
	async pushData(endpoint, data) {
		let bodyData;

		if (data == "winePictureUpload") {
			const fileInput = document.getElementById('fileToUpload');
			const file = fileInput.files[0];
			if (!file) {
				return Promise.reject("Error: No file selected.");
			}
			bodyData = new FormData();
			bodyData.append("fileToUpload", file);
		} else {
			bodyData = JSON.stringify(data);
		}

		return fetch(endpoint, {
			method: 'POST',
			headers: bodyData instanceof FormData ? undefined : {
				'Content-Type': 'application/json'
			},
			body: bodyData
		})
		.then(response => {
			if (!response.ok) {
				throw new Error(`Server returned ${response.status}`);
			}
			return response.text();
		})
		.then(result => {
			// Parse JSON string to object
			let parsedResult = result;
			try {
				parsedResult = JSON.parse(result);
			} catch (e) {
				// Not JSON, keep as string (legacy compatibility for image upload)
			}

			if (data == "winePictureUpload") {
				// Handle file upload response (plain text)
				if (result.startsWith("Filename: ")) {
					document.getElementById("winePicture").value = result.replace("Filename: ", "");
					return { success: true, data: result };
				} else {
					document.getElementById("winePicture").value = "";
					return { success: false, data: result };
				}
			} else {
				// Return parsed object directly (no extra wrapping)
				return parsedResult;
			}
		})
		.catch(error => {
			return { success: false, message: error.message || error };
		});
	}

	/**
	 * Get wines with optional filtering
	 * @param {object} filterData - Filter criteria (type, country, region, producer, year, bottleCount)
	 * @returns {Promise<object>} Wine list response
	 */
	async getWines(filterData = {}) {
		return this.fetchJSON(`${this.baseURL}getWines.php`, filterData);
	}

	/**
	 * Get list of countries
	 * @param {object} filterData - Optional filter data
	 * @returns {Promise<object>} Country list response
	 */
	async getCountries(filterData = null) {
		return this.fetchJSON(`${this.baseURL}getCountries.php`, filterData);
	}

	/**
	 * Get list of wine types
	 * @param {object} filterData - Optional filter data
	 * @returns {Promise<object>} Wine type list response
	 */
	async getTypes(filterData = null) {
		return this.fetchJSON(`${this.baseURL}getTypes.php`, filterData);
	}

	/**
	 * Get list of regions
	 * @param {object} filterData - Optional filter data
	 * @returns {Promise<object>} Region list response
	 */
	async getRegions(filterData = null) {
		return this.fetchJSON(`${this.baseURL}getRegions.php`, filterData);
	}

	/**
	 * Get list of producers
	 * @param {object} filterData - Optional filter data
	 * @returns {Promise<object>} Producer list response
	 */
	async getProducers(filterData = null) {
		return this.fetchJSON(`${this.baseURL}getProducers.php`, filterData);
	}

	/**
	 * Get list of years
	 * @param {object} filterData - Optional filter data
	 * @returns {Promise<object>} Year list response
	 */
	async getYears(filterData = null) {
		return this.fetchJSON(`${this.baseURL}getYears.php`, filterData);
	}

	/**
	 * Get drunk wines (bottles that have been consumed)
	 * @param {object} filterData - Optional filter data
	 * @returns {Promise<object>} Drunk wines response
	 */
	async getDrunkWines(filterData = null) {
		return this.fetchJSON(`${this.baseURL}getDrunkWines.php`, filterData);
	}

	/**
	 * Get bottles for a specific wine
	 * @param {object} data - Data containing wineID
	 * @returns {Promise<object>} Bottles response
	 */
	async getBottles(data) {
		return this.fetchJSON(`${this.baseURL}getBottles.php`, data);
	}

	/**
	 * Add a new wine
	 * @param {object} wineData - Wine data to add
	 * @returns {Promise<object>} Add wine response
	 */
	async addWine(wineData) {
		return this.pushData(`${this.baseURL}addWine.php`, wineData);
	}

	/**
	 * Update wine details
	 * @param {object} wineData - Wine data to update
	 * @returns {Promise<object>} Update response
	 */
	async updateWine(wineData) {
		return this.pushData(`${this.baseURL}updateWine.php`, wineData);
	}

	/**
	 * Update bottle details
	 * @param {object} bottleData - Bottle data to update
	 * @returns {Promise<object>} Update response
	 */
	async updateBottle(bottleData) {
		return this.pushData(`${this.baseURL}updateBottle.php`, bottleData);
	}

	/**
	 * Record drinking a bottle with rating
	 * @param {object} ratingData - Rating and bottle data
	 * @returns {Promise<object>} Drink bottle response
	 */
	async drinkBottle(ratingData) {
		return this.pushData(`${this.baseURL}drinkBottle.php`, ratingData);
	}

	/**
	 * Upload wine picture
	 * @returns {Promise<object>} Upload response
	 */
	async uploadImage() {
		return this.pushData(`${this.baseURL}upload.php`, "winePictureUpload");
	}

	/**
	 * Call Google Gemini AI for data generation
	 * @param {string} type - Type of data to generate (region, producer, wine)
	 * @param {string} prompt - Prompt for AI
	 * @returns {Promise<object>} AI response
	 */
	async callGeminiAI(type, prompt) {
		const data = { type, prompt };
		return this.fetchJSON('./resources/php/geminiAPI.php', data);
	}
}

// Create a global instance for backward compatibility
export const wineAPI = new WineAPI();
window.wineAPI = wineAPI;

// Export individual functions for backward compatibility
export async function fetchJSON(endpoint, filterData = null) {
	return window.wineAPI.fetchJSON(endpoint, filterData);
}

export async function pushData(endpoint, data) {
	return window.wineAPI.pushData(endpoint, data);
}

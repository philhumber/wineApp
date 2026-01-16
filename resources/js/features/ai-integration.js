/**
 * AIIntegrationManager - Gemini AI data generation
 * Handles AI-powered data generation for wines, producers, and regions
 */

import { modalManager, showOverlay, hideOverlay } from '../ui/modals.js';

/**
 * AIIntegrationManager class for Gemini AI operations
 */
export class AIIntegrationManager {
	constructor() {
		this.apiKey = window.WINE_APP_CONFIG?.geminiApiKey || "";
		this.model = "gemini-2.5-pro";

		if (!this.apiKey) {
			console.warn('Gemini API key not configured. See config.local.php.example for setup.');
		}
	}

	/**
	 * Get AI-generated data from Gemini
	 * @param {string} requestType - Type of request (wine, producer, region)
	 * @param {string} requestData - Data to send to AI
	 * @returns {Promise<object>} AI-generated data
	 */
	async getAIData(requestType, requestData) {
		let generationConfig;
		let systemInstruction;

		// Configure based on request type
		if (requestType === "wine") {
			generationConfig = {
				temperature: 0.25,
				thinkingConfig: {
					thinkingBudget: -1,
				},
			};
			systemInstruction = {
				role: "system",
				parts: [{
					text: `You are a helpful expert wine sommelier. When given the input of a specific drink and the producer, gather comprehensive information about that drink and provide information back to the user. Use reputable sources to verify data about the producer. Each text response should be around 100 words. Write for an intermediate-level wine student. Keep the tone professional yet vivid, using sensory language where appropriate. Only provide information that you are sure about. Include information about the ingredients in the drink (e.g. 75% Pinot Noir, 25% Chardonnay). Do not offer to provide additional help to the user. Do not include sources or references in the response. Keep all information about sources separate to the structured output. Do not ask the user to provide additional information or clarifying information. If you cannot find the information or don't know the answer, then only respond using the same data structure and mention that the wine cannot be found. Output should use the following JSON structure. Do not include the schema or the structure in the output. JSON Structure: {format:{type: "json_schema",name: "wine",strict: true,schema: {type: "object",properties: {"description": {"type": "string","description": "A detailed description of the wine including any awards or highlights as well as serving recommendations."},"tasting": {"type": "string", "description": "A description of the nose and the palate of the wine"},"pairing": {"type": "string","description": "A description of the types of foods that the wine pairs with"},"drinkwindow": {"type": "object","description": "Two years that give a window of the best time to drink the wine.","properties": {"start": {"type": "integer","description": "The starting year of the optimal drinking window."},"end": {"type": "number","description": "The ending year of the optimal drinking window."}},"required": ["start","end"],"additionalProperties": false}},"required": ["description","tasting","pairing","drinkwindow"],"additionalProperties": false}}}`,
				}],
			};
		} else if (requestType === "producer") {
			generationConfig = {
				temperature: 0.25,
				thinkingConfig: {
					thinkingBudget: -1,
				},
			};
			systemInstruction = {
				role: "system",
				parts: [{
					text: `You are a helpful expert wine sommelier. When given the input of a wine producer, gather comprehensive information about that wine producer and provide information back to the user. Use reputable sources to verify data about the wine producer. Each text response should be around 200 words. Write for an intermediate-level wine student. Keep the tone professional yet vivid, using sensory language where appropriate. Only provide information that you are sure about. Do not provide additional help to the user. Do not include sources or references in the response. Keep all information about sources separate to the structured output. Do not ask the user to provide additional information or clarifying information. Do not give the user information about your task, only respond with the structured output. If you cannot find the information or don't know the answer, then only respond using the same data structure. Output should use the following JSON structure. Do not include any other contextual information outside of this schema structure. Do not include the schema or the structure in the output. JSON Structure: {format:{type: "json_schema", name: "wine", strict: true, schema: {type: "object", properties: {"description": {"type": "string", "description": "A detailed description of the producer including any unique facts or awards or highlights as well as wine or vintage recommendations."}, "ownership": {"type": "string", "description": "The ownership structure of the producer. For example Cooperative, LVMH, Family, etc."}, "founded": {"type": "integer", "description": "The year that the producer was founded in."},"town": {"type": "string", "description": "The town that the producer is based in."}}, "required": ["description", "ownership", "founded", "town"], "additionalProperties": false}}}`,
				}],
			};
		} else if (requestType === "region") {
			generationConfig = {
				temperature: 0.25,
				thinkingConfig: {
					thinkingBudget: -1,
				},
			};
			systemInstruction = {
				role: "system",
				parts: [{
					text: `You are a helpful expert wine sommelier. When given the input of a type of drink and a region, gather comprehensive information about that region relevant to the production of the type of drink provided and provide information back to the user. Use reputable sources to verify data about the region. Each text response should be around 400 words. Write for an intermediate-level wine student. Keep the tone professional yet vivid, using sensory language where appropriate. Only provide information that you are sure about. Do not provide additional help to the user. Do not include sources or references in the response. Keep all information about sources separate to the structured output. Do not ask the user to provide additional information or clarifying information. Do not give the user information about your task, only respond with the structured output. When providing a URL for a map of the region, ensure that the URL is publicly accessible. If you cannot find the information or don't know the answer, then only respond using the same data structure. Output should use the following JSON structure. Do not include any other contextual information outside of this schema structure. Do not include the schema or the structure in the output. JSON Structure: {"format": {"type": "json_schema","name": "region","strict": true,"schema": {"type": "object","properties": {"description": {"type": "string","description": "A detailed description of the region including any unique history, facts, awards, or highlights as well as specific producer, drink, or vintage recommendations"},"soil": {"type": "string","description": "Details about the soil or geographical features of the region and how it affects the fruits grown and the drinks produced there"},"climate": {"type": "string","description": "Details about the climate of the region and how it affects the fruits grown and the drinks produced there"},"map": {"type": "string","description": "a URL of a map that shows an overview of the region related to the drink type provided"}},"required": ["description","soil","climate","map"],"additionalProperties": false}}}`,
				}],
			};
		}

		const contents = [{
			role: "user",
			parts: [
				{ text: requestData }
			]
		}];

		try {
			const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					systemInstruction,
					contents,
					generationConfig,
					tools: [
						{ google_search: {} }
					],
				}),
			});

			const data = await response.json();

			if (data.candidates && data.candidates.length > 0) {
				for (const part of data.candidates[0].content.parts) {
					try {
						const normalized = this.cleanAndNormalizeJSON(part.text);
						return normalized;
					} catch (error) {
						console.error('Error parsing AI response:', error);
						const errorReturn = {
							description: 'Error occurred while fetching response. Please try again.',
							tasting: '',
							pairing: ''
						};
						return errorReturn;
					}
				}
			}
		} catch (error) {
			console.error('Error calling Gemini API:', error);
			const errorReturn = {
				description: 'Error occurred while fetching response. Please try again.',
				tasting: '',
				pairing: ''
			};
			return errorReturn;
		}
	}

	/**
	 * Clean and normalize JSON response from AI
	 * @param {string|object} raw - Raw response
	 * @returns {object} Normalized object
	 */
	cleanAndNormalizeJSON(raw) {
		if (typeof raw !== "string") {
			// If it's already an object, return normalized
			return this.normalizeWrapper(raw);
		}

		try {
			// Step 1: Strip markdown fences if present
			const cleaned = raw
				.trim()
				.replace(/^```(?:json)?\n?/, '') // Remove ```json or ```
				.replace(/```$/, '')             // Remove trailing ```
				.replace(/\s*\[\d+(\s*,\s*\d+)*\]/g, ''); // Remove citation numbers

			// Step 2: Try to parse JSON
			const parsed = JSON.parse(cleaned);

			// Step 3: Normalize wrapper
			return this.normalizeWrapper(parsed);
		} catch (err) {
			console.warn("Could not parse JSON, returning error:", err);
			const errorReturn = {
				description: 'Error occurred while fetching response. Please try again.',
				tasting: '',
				pairing: ''
			};
			return errorReturn;
		}
	}

	/**
	 * Normalize wrapper object
	 * @param {object} obj - Object to normalize
	 * @returns {object} Normalized object
	 */
	normalizeWrapper(obj) {
		if (!obj || typeof obj !== "object") return obj;

		// Unwrap if the *only* key is "text"
		while (obj.text && Object.keys(obj).length === 1) {
			obj = obj.text;
		}

		return obj;
	}

	/**
	 * Generate region data using AI
	 */
	async genRegionData() {
		const countryDropDown = document.getElementById("countryDropDown");
		const regionName = document.getElementById("regionName");
		const drinkTypeDropDown = document.getElementById("drinkTypeDropDown");

		if (!countryDropDown || !regionName) return;

		countryDropDown.setAttribute("valid", "");
		regionName.setAttribute("valid", "");

		if (countryDropDown.value !== "" && regionName.value !== "") {
			// Show loading overlay
			showOverlay();
			const loader = document.getElementById("loader");
			if (loader) {
				loader.innerHTML = "<div class='loading'></div>";
			}

			// Get AI data
			const data = await this.getAIData(
				"region",
				`${drinkTypeDropDown?.value || 'Wine'} - ${regionName.value}, ${countryDropDown.value}`
			);

			// Hide loading
			if (loader) loader.innerHTML = "";
			hideOverlay();

			// Show extra details section
			const extraDetails = document.getElementById('regionExtraDetails');
			if (extraDetails) {
				extraDetails.classList.add("ui-animate-opacity");
				extraDetails.classList.remove("ui-animate-opacity-rev");
				extraDetails.style.display = "";
			}

			// Populate fields
			const descriptionEl = document.getElementById("regionDescription");
			const climateEl = document.getElementById("regionClimate");
			const soilEl = document.getElementById("regionSoil");

			if (descriptionEl && data.description) {
				descriptionEl.value = data.description;
				descriptionEl.style.height = descriptionEl.scrollHeight + 'px';
			}

			if (climateEl && data.climate) {
				climateEl.value = data.climate;
				climateEl.style.height = climateEl.scrollHeight + 'px';
			}

			if (soilEl && data.soil) {
				soilEl.value = data.soil;
				soilEl.style.height = soilEl.scrollHeight + 'px';
			}
		} else {
			// Mark fields as invalid
			regionName.setAttribute("valid", "invalid");
			countryDropDown.setAttribute("valid", "invalid");
		}
	}

	/**
	 * Generate producer data using AI
	 */
	async genProducerData() {
		const producerName = document.getElementById("producerName");
		const drinkTypeDropDown = document.getElementById("drinkTypeDropDown");

		if (!producerName) return;

		producerName.setAttribute("valid", "");

		if (producerName.value !== "") {
			// Get wine region
			let wineRegion = document.getElementById("findRegion")?.value || "";
			if (wineRegion === "") {
				wineRegion = document.getElementById("regionName")?.value || "";
			}

			// Show loading overlay
			showOverlay();
			const loader = document.getElementById("loader");
			if (loader) {
				loader.innerHTML = "<div class='loading'></div>";
			}

			// Get AI data
			const data = await this.getAIData(
				"producer",
				`${drinkTypeDropDown?.value || 'Wine'} - ${producerName.value} - ${wineRegion}`
			);

			// Hide loading
			if (loader) loader.innerHTML = "";
			hideOverlay();

			// Show extra details section
			const extraDetails = document.getElementById('producerExtraDetails');
			if (extraDetails) {
				extraDetails.classList.add("ui-animate-opacity");
				extraDetails.classList.remove("ui-animate-opacity-rev");
				extraDetails.style.display = "";
			}

			// Populate fields
			const descriptionEl = document.getElementById("producerDescription");
			const ownershipEl = document.getElementById("producerOwnership");
			const foundedEl = document.getElementById("producerFounded");
			const townEl = document.getElementById("producerTown");

			if (descriptionEl && data.description) {
				descriptionEl.value = data.description;
				descriptionEl.style.height = descriptionEl.scrollHeight + 'px';
			}

			if (ownershipEl && data.ownership) {
				ownershipEl.value = data.ownership;
			}

			if (foundedEl && data.founded) {
				foundedEl.value = data.founded;
			}

			if (townEl && data.town) {
				townEl.value = data.town;
			}
		} else {
			// Mark field as invalid
			producerName.setAttribute("valid", "invalid");
		}
	}

	/**
	 * Generate wine data using AI
	 */
	async genWineData() {
		const wineNameField = document.getElementById("wineName");
		const wineYearField = document.getElementById("wineYear");
		const wineTypeDropDown = document.getElementById("wineTypeDropDown");
		const drinkTypeDropDown = document.getElementById("drinkTypeDropDown");

		if (!wineNameField) return;

		wineNameField.setAttribute("valid", "");
		if (wineYearField) wineYearField.setAttribute("valid", "");

		if (wineNameField.value !== "") {
			// Get wine producer
			let wineProducer = document.getElementById("findProducer")?.value || "";
			if (wineProducer === "") {
				wineProducer = document.getElementById("producerName")?.value || "";
			}

			// Show loading overlay
			showOverlay();
			const loader = document.getElementById("loader");
			if (loader) {
				loader.innerHTML = "<div class='loading'></div>";
			}

			// Get AI data
			const data = await this.getAIData(
				"wine",
				`${wineTypeDropDown?.value || ''} ${drinkTypeDropDown?.value || 'Wine'} - ${wineNameField.value}, ${wineYearField?.value || ''} - ${wineProducer}`
			);

			// Hide loading
			if (loader) loader.innerHTML = "";
			hideOverlay();

			// Show extra details section
			const extraDetails = document.getElementById('wineExtraDetails');
			if (extraDetails) {
				extraDetails.classList.add("ui-animate-opacity");
				extraDetails.classList.remove("ui-animate-opacity-rev");
				extraDetails.style.display = "";
			}

			if (data) {
				// Populate fields
				const descriptionEl = document.getElementById("wineDescription");
				const tastingEl = document.getElementById("wineTasting");
				const pairingEl = document.getElementById("winePairing");

				if (descriptionEl && data.description) {
					descriptionEl.value = data.description;
					descriptionEl.style.height = descriptionEl.scrollHeight + 'px';
				}

				if (tastingEl && data.tasting) {
					tastingEl.value = data.tasting;
					tastingEl.style.height = tastingEl.scrollHeight + 'px';
				}

				if (pairingEl && data.pairing) {
					pairingEl.value = data.pairing;
					pairingEl.style.height = pairingEl.scrollHeight + 'px';
				}
			} else {
				const descriptionEl = document.getElementById("wineDescription");
				if (descriptionEl) {
					descriptionEl.value = "An error occurred generating the data. Please try again.";
				}
			}
		} else {
			// Mark field as invalid
			wineNameField.setAttribute("valid", "invalid");
		}
	}
}

// Create global instance
export const aiIntegrationManager = new AIIntegrationManager();
window.aiIntegrationManager = aiIntegrationManager;

/**
 * Legacy function for backward compatibility
 * Get AI data
 */
export async function getAIData(requestType, requestData) {
	return await window.aiIntegrationManager.getAIData(requestType, requestData);
}

/**
 * Legacy function for backward compatibility
 * Generate region data
 */
export async function genRegionData() {
	await window.aiIntegrationManager.genRegionData();
}

/**
 * Legacy function for backward compatibility
 * Generate producer data
 */
export async function genProducerData() {
	await window.aiIntegrationManager.genProducerData();
}

/**
 * Legacy function for backward compatibility
 * Generate wine data
 */
export async function genWineData() {
	await window.aiIntegrationManager.genWineData();
}

/**
 * Legacy function for backward compatibility
 * Clean and normalize JSON
 */
export function cleanAndNormalizeJSON(raw) {
	return window.aiIntegrationManager.cleanAndNormalizeJSON(raw);
}

/**
 * Legacy function for backward compatibility
 * Normalize wrapper
 */
export function normalizeWrapper(obj) {
	return window.aiIntegrationManager.normalizeWrapper(obj);
}

// Export for backward compatibility
window.getAIData = getAIData;
window.genRegionData = genRegionData;
window.genProducerData = genProducerData;
window.genWineData = genWineData;
window.cleanAndNormalizeJSON = cleanAndNormalizeJSON;
window.normalizeWrapper = normalizeWrapper;

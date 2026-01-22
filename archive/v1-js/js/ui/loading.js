/**
 * LoadingTextCycler - Displays cycling wine-themed messages during loading
 * Used during AI operations that take 5-30+ seconds
 */

// Wine-themed loading messages
const LOADING_MESSAGES = [
	"Searching the cellars...",
	"Tasting vintages...",
	"Consulting the sommelier...",
	"Decanting knowledge...",
	"Reading the terroir...",
	"Swirling the data...",
	"Checking the vintage charts...",
	"Nosing through the archives...",
	"Uncorking insights...",
	"Letting it breathe...",
	"Examining the legs...",
	"Pairing possibilities...",
];

/**
 * LoadingTextCycler class for managing cycling loading messages
 */
export class LoadingTextCycler {
	constructor() {
		this.intervalId = null;
		this.currentIndex = 0;
		this.messages = [];
		this.cycleInterval = 3500; // 3.5 seconds between messages
		this.textElement = null;
	}

	/**
	 * Start the loading display with cycling text
	 * @param {HTMLElement} loaderElement - The #loader element to populate
	 */
	start(loaderElement) {
		if (!loaderElement) return;

		// Shuffle messages for variety
		this.messages = this.shuffleArray([...LOADING_MESSAGES]);
		this.currentIndex = 0;

		// Create the loading HTML structure
		loaderElement.innerHTML = `
			<div class="loading-container">
				<div class="loading"></div>
				<p class="loading-text">${this.messages[0]}</p>
			</div>
		`;

		this.textElement = loaderElement.querySelector('.loading-text');

		// Start cycling through messages
		this.intervalId = setInterval(() => {
			this.currentIndex = (this.currentIndex + 1) % this.messages.length;
			if (this.textElement) {
				// Fade out, pause, change text, fade in
				this.textElement.classList.add('loading-text-fade');
				setTimeout(() => {
					if (this.textElement) {
						this.textElement.textContent = this.messages[this.currentIndex];
						this.textElement.classList.remove('loading-text-fade');
					}
				}, 600); // 600ms pause while faded out
			}
		}, this.cycleInterval);
	}

	/**
	 * Stop the loading display
	 * @param {HTMLElement} loaderElement - The #loader element to clear
	 */
	stop(loaderElement) {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
		this.textElement = null;
		if (loaderElement) {
			loaderElement.innerHTML = "";
		}
	}

	/**
	 * Shuffle array using Fisher-Yates algorithm
	 * @param {Array} array - Array to shuffle
	 * @returns {Array} Shuffled array
	 */
	shuffleArray(array) {
		for (let i = array.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[array[i], array[j]] = [array[j], array[i]];
		}
		return array;
	}
}

// Create and export singleton instance
export const loadingTextCycler = new LoadingTextCycler();
window.loadingTextCycler = loadingTextCycler;

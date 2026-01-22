/**
 * Router - Hash-based routing for single-page navigation
 * Enables navigation between different views without server requests
 */
export class Router {
	constructor() {
		this.routes = {};
		this.currentRoute = null;
		this.init();
	}

	/**
	 * Initialize router and set up hash change listener
	 */
	init() {
		window.addEventListener('hashchange', () => this.handleRoute());
		window.addEventListener('load', () => this.handleRoute());
	}

	/**
	 * Register a route handler
	 * @param {string} path - Route path (e.g., 'wines', 'region/:name', 'producer/:name')
	 * @param {function} handler - Function to call when route matches
	 */
	register(path, handler) {
		this.routes[path] = handler;
	}

	/**
	 * Navigate to a specific route
	 * @param {string} path - Path to navigate to
	 * @param {object} params - Optional parameters
	 */
	navigate(path, params = {}) {
		const hash = this.buildHash(path, params);
		window.location.hash = hash;
	}

	/**
	 * Build hash from path and params
	 * @param {string} path - Base path
	 * @param {object} params - Parameters
	 * @returns {string} Hash string
	 */
	buildHash(path, params) {
		if (Object.keys(params).length === 0) return path;
		const queryString = Object.entries(params)
			.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
			.join('&');
		return `${path}?${queryString}`;
	}

	/**
	 * Parse current hash and extract route and params
	 * @returns {object} Object with route and params
	 */
	parseHash() {
		const hash = window.location.hash.slice(1) || 'wines';
		const [path, queryString] = hash.split('?');
		const params = {};

		if (queryString) {
			queryString.split('&').forEach(param => {
				const [key, value] = param.split('=');
				params[key] = decodeURIComponent(value);
			});
		}

		return { path, params };
	}

	/**
	 * Match route path with registered routes
	 * @param {string} path - Path to match
	 * @returns {object|null} Match object with handler and params
	 */
	matchRoute(path) {
		// Exact match
		if (this.routes[path]) {
			return { handler: this.routes[path], params: {} };
		}

		// Pattern match (e.g., region/:name)
		const pathSegments = path.split('/');
		for (const [pattern, handler] of Object.entries(this.routes)) {
			const patternSegments = pattern.split('/');
			if (patternSegments.length !== pathSegments.length) continue;

			const params = {};
			let match = true;

			for (let i = 0; i < patternSegments.length; i++) {
				if (patternSegments[i].startsWith(':')) {
					// Dynamic segment
					const paramName = patternSegments[i].slice(1);
					params[paramName] = pathSegments[i];
				} else if (patternSegments[i] !== pathSegments[i]) {
					// Segment doesn't match
					match = false;
					break;
				}
			}

			if (match) {
				return { handler, params };
			}
		}

		return null;
	}

	/**
	 * Handle route change
	 */
	async handleRoute() {
		// Skip routing if no routes are registered yet (Phase 1)
		if (Object.keys(this.routes).length === 0) {
			return;
		}

		const { path, params: queryParams } = this.parseHash();
		const match = this.matchRoute(path);

		if (match) {
			this.currentRoute = path;
			const allParams = { ...match.params, ...queryParams };
			await match.handler(allParams);
		} else {
			console.warn(`No route found for: ${path}`);
			// Fallback to wines view
			this.navigate('wines');
		}
	}

	/**
	 * Get current route
	 * @returns {string} Current route path
	 */
	getCurrentRoute() {
		return this.currentRoute;
	}

	/**
	 * Go back to previous page
	 */
	back() {
		window.history.back();
	}
}

// Create global instance
export const router = new Router();
window.router = router;

export default Router;

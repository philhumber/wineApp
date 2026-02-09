import type { HandleClientError } from '@sveltejs/kit';

/**
 * WIN-212/WIN-243: Global client-side error handling
 *
 * Captures unhandled errors in SvelteKit navigation and rendering,
 * plus unhandled promise rejections globally.
 */

export const handleError: HandleClientError = ({ error, event, status, message }) => {
	const err = error as Error;

	// Log structured error info for debugging
	console.error('[Qvé Error]', {
		status,
		message,
		url: event.url?.pathname,
		stack: err?.stack
	});

	// Return user-facing error (no internal details leaked)
	return {
		message: status === 404
			? 'Page not found'
			: 'Something went wrong. Please try again.'
	};
};

// WIN-243: Catch unhandled promise rejections globally
if (typeof window !== 'undefined') {
	window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
		console.error('[Qvé Unhandled Rejection]', {
			reason: event.reason,
			stack: event.reason?.stack
		});
	});
}

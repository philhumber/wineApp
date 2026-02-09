// ─────────────────────────────────────────────────────────
// WIN-227: Request lifecycle — abort controller & scroll lock
// Extracted from stores/agent.ts
// ─────────────────────────────────────────────────────────

/**
 * WIN-187: Module-level AbortController for cancelling in-flight requests.
 * Not stored in state because AbortController is not serializable.
 */
let currentAbortController: AbortController | null = null;
let wasCancelledFlag = false;

/**
 * WIN-227: Request ID for server-side cancellation via cancel token files.
 * Generated with each new AbortController, sent as X-Request-Id header.
 */
let currentRequestId: string | null = null;

/**
 * Scroll lock flag - blocks all scroll attempts when true.
 * Set after typing message scroll during enrichment flow.
 * Cleared when user takes any action (chip tap, start over, etc).
 */
let scrollLocked = false;

/**
 * WIN-187: Create a new AbortController for the current request.
 * Aborts any previous controller before creating a new one.
 */
export function createAbortController(): AbortController {
	// Reset cancelled flag for new request
	wasCancelledFlag = false;
	// Abort any in-flight request
	if (currentAbortController) {
		currentAbortController.abort();
	}
	currentAbortController = new AbortController();
	// WIN-227: Generate unique request ID for server-side cancel token
	currentRequestId = crypto.randomUUID();
	return currentAbortController;
}

/**
 * WIN-187: Get the current AbortSignal for passing to API calls.
 */
export function getAbortSignal(): AbortSignal | undefined {
	return currentAbortController?.signal;
}

/**
 * WIN-227: Get the current request ID for X-Request-Id header.
 */
export function getRequestId(): string | null {
	return currentRequestId;
}

/**
 * WIN-187: Abort the current in-flight request.
 */
export function abortCurrentRequest(): void {
	if (currentAbortController) {
		currentAbortController.abort();
		wasCancelledFlag = true;
		currentAbortController = null;
	}
	currentRequestId = null;
}

/**
 * WIN-187: Check if the current request was cancelled.
 * Uses a flag because AbortController is nulled after abort.
 */
export function wasCancelled(): boolean {
	return wasCancelledFlag;
}

/**
 * WIN-187: Reset abort state for testing.
 * @internal
 */
export function _resetAbortState(): void {
	if (currentAbortController) {
		currentAbortController.abort();
	}
	currentAbortController = null;
	wasCancelledFlag = false;
	currentRequestId = null;
}

/**
 * Lock scroll - blocks all scroll attempts.
 * Called after typing message scroll during enrichment flow.
 */
export function lockScroll(): void {
	scrollLocked = true;
}

/**
 * Unlock scroll - allows scroll attempts again.
 * Called when user takes any action (chip tap, start over, etc).
 */
export function unlockScroll(): void {
	scrollLocked = false;
}

/**
 * Check if scroll is locked.
 */
export function isScrollLocked(): boolean {
	return scrollLocked;
}

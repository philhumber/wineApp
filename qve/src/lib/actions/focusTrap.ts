/**
 * Focus Trap Svelte Action
 *
 * Traps Tab/Shift+Tab keyboard focus within a container element.
 * Does NOT handle Escape — modals handle that independently via svelte:window.
 *
 * Usage:
 *   <div use:focusTrap>
 *   <div use:focusTrap={{ initialFocus: '.cancel-btn' }}>
 */

export interface FocusTrapOptions {
	initialFocus?: string;
}

const FOCUSABLE_SELECTOR = [
	'a[href]:not([tabindex="-1"])',
	'button:not(:disabled):not([tabindex="-1"])',
	'input:not(:disabled):not([tabindex="-1"])',
	'select:not(:disabled):not([tabindex="-1"])',
	'textarea:not(:disabled):not([tabindex="-1"])',
	'[tabindex]:not([tabindex="-1"])',
	'[contenteditable="true"]:not([tabindex="-1"])'
].join(', ');

function isVisible(el: HTMLElement): boolean {
	const style = getComputedStyle(el);
	if (style.display === 'none' || style.visibility === 'hidden') return false;
	if (el.offsetWidth === 0 && el.offsetHeight === 0) {
		if (style.position !== 'fixed' && style.position !== 'sticky') return false;
	}
	return true;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isVisible);
}

export function focusTrap(
	node: HTMLElement,
	options?: FocusTrapOptions
): { update: (opts: FocusTrapOptions) => void; destroy: () => void } {
	const previouslyFocused = document.activeElement as HTMLElement | null;
	let initialFocus = options?.initialFocus;

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key !== 'Tab') return;

		const focusable = getFocusableElements(node);
		if (focusable.length === 0) return;

		const first = focusable[0];
		const last = focusable[focusable.length - 1];

		if (event.shiftKey) {
			if (document.activeElement === first || !node.contains(document.activeElement)) {
				event.preventDefault();
				last.focus();
			}
		} else {
			if (document.activeElement === last || !node.contains(document.activeElement)) {
				event.preventDefault();
				first.focus();
			}
		}
	}

	function setInitialFocus() {
		let target: HTMLElement | null = null;

		if (initialFocus) {
			target = node.querySelector<HTMLElement>(initialFocus);
		}

		if (!target) {
			const focusable = getFocusableElements(node);
			target = focusable[0] || null;
		}

		if (target) {
			requestAnimationFrame(() => {
				if (target && document.contains(target)) {
					target.focus();
				}
			});
		} else {
			if (!node.hasAttribute('tabindex')) {
				node.setAttribute('tabindex', '-1');
			}
			node.focus();
		}
	}

	node.addEventListener('keydown', handleKeyDown);
	setInitialFocus();

	return {
		update(newOptions: FocusTrapOptions) {
			initialFocus = newOptions?.initialFocus;
		},

		destroy() {
			node.removeEventListener('keydown', handleKeyDown);

			if (
				previouslyFocused &&
				typeof previouslyFocused.focus === 'function' &&
				document.contains(previouslyFocused)
			) {
				requestAnimationFrame(() => {
					previouslyFocused.focus();
				});
			}
		}
	};
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import TypingIndicatorMessage from '../TypingIndicatorMessage.svelte';

function createTypingMessage(id = 'msg-1') {
	return {
		id,
		category: 'typing' as const,
		role: 'agent' as const,
		timestamp: Date.now(),
		isNew: false,
		data: { category: 'typing' as const, text: 'Analysing wine details...' },
	};
}

function createEnrichmentCard(id: string): HTMLDivElement {
	const card = document.createElement('div');
	card.setAttribute('data-enrichment-card', '');
	card.id = id;
	card.scrollIntoView = vi.fn();
	document.body.appendChild(card);
	return card;
}

describe('TypingIndicatorMessage', () => {
	// Suppress unhandled error from onMount RAF firing after unmount in jsdom
	const originalOnError = window.onerror;

	beforeEach(() => {
		vi.clearAllMocks();
		window.onerror = () => true;
	});

	afterEach(() => {
		cleanup();
		window.onerror = originalOnError;
		document.querySelectorAll('[data-enrichment-card]').forEach((el) => el.remove());
	});

	describe('onDestroy scroll targeting', () => {
		it('should scroll to a NEW enrichment card that appears after mount', async () => {
			// One enrichment card exists BEFORE mount (from a previous enrichment flow)
			const oldCard = createEnrichmentCard('enrichment-old');

			// Render typing indicator (captures count=1 on mount)
			const { unmount } = render(TypingIndicatorMessage, {
				props: { message: createTypingMessage() },
			});

			// Simulate a new enrichment card appearing (as would happen in the same
			// Svelte update cycle when typing indicator is removed and card is added)
			const newCard = createEnrichmentCard('enrichment-new');

			unmount();

			// Allow RAF to fire
			await vi.waitFor(() => {
				const newCalled = (newCard.scrollIntoView as ReturnType<typeof vi.fn>).mock.calls
					.length;
				expect(newCalled).toBeGreaterThan(0);
			});

			// Only the NEW card should have been scrolled to
			expect(oldCard.scrollIntoView).not.toHaveBeenCalled();
			expect(newCard.scrollIntoView).toHaveBeenCalledWith({
				behavior: 'smooth',
				block: 'start',
			});
		});

		it('should NOT scroll to old enrichment cards when no new card appears', async () => {
			// One enrichment card exists from a previous enrichment flow
			const oldCard = createEnrichmentCard('enrichment-old');

			// Render typing indicator (captures count=1 on mount)
			const { unmount } = render(TypingIndicatorMessage, {
				props: { message: createTypingMessage() },
			});

			// Unmount WITHOUT adding a new enrichment card
			// (simulates cache confirmation replacing typing indicator with chips)
			unmount();

			// Give RAF time to fire
			await new Promise((r) => setTimeout(r, 50));

			// Old card should NOT have been scrolled to
			expect(oldCard.scrollIntoView).not.toHaveBeenCalled();
		});
	});
});

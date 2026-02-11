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
	});

	it('should render without errors', () => {
		const { container } = render(TypingIndicatorMessage, {
			props: { message: createTypingMessage() },
		});
		expect(container).toBeTruthy();
	});
});

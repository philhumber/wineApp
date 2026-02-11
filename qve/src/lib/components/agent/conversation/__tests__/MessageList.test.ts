import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/svelte';
import MessageList from '../MessageList.svelte';
import type { AgentMessage } from '$lib/agent/types';

// Helper to create test messages
function createTestMessage(overrides: Partial<AgentMessage> = {}): AgentMessage {
	return {
		id: `msg_${crypto.randomUUID()}`,
		category: 'text',
		role: 'agent',
		timestamp: Date.now(),
		data: { category: 'text', content: 'Test message' },
		...overrides,
	};
}


describe('MessageList', () => {
	afterEach(() => {
		cleanup();
	});

	describe('rendering', () => {
		it('should render empty list without errors', () => {
			render(MessageList, { props: { messages: [] } });
			const list = document.querySelector('.message-list');
			expect(list).toBeInTheDocument();
		});

		it('should render message list container with proper class', () => {
			render(MessageList, { props: { messages: [] } });
			const list = document.querySelector('.message-list');
			expect(list).toBeInTheDocument();
			expect(list).toHaveClass('message-list');
			// Note: Computed style checks are not reliable in jsdom
			// The actual flex styling is verified via visual inspection
		});

		it('should have no message items when empty', () => {
			render(MessageList, { props: { messages: [] } });
			const items = document.querySelectorAll('.message-item');
			expect(items).toHaveLength(0);
		});
	});

	describe('message rendering', () => {
		it('should render single message', () => {
			const message = createTestMessage({ id: 'msg-1' });
			render(MessageList, { props: { messages: [message] } });

			const items = document.querySelectorAll('.message-item');
			expect(items).toHaveLength(1);
		});

		it('should render multiple messages', () => {
			const messages = [
				createTestMessage({ id: 'msg-1' }),
				createTestMessage({ id: 'msg-2' }),
				createTestMessage({ id: 'msg-3' }),
			];
			render(MessageList, { props: { messages } });

			const items = document.querySelectorAll('.message-item');
			expect(items).toHaveLength(3);
		});

		it('should set data-message-id attribute on each item', () => {
			const messages = [createTestMessage({ id: 'msg-abc-123' }), createTestMessage({ id: 'msg-def-456' })];
			render(MessageList, { props: { messages } });

			expect(document.querySelector('[data-message-id="msg-abc-123"]')).toBeInTheDocument();
			expect(document.querySelector('[data-message-id="msg-def-456"]')).toBeInTheDocument();
		});

		it('should render messages in order', () => {
			const messages = [
				createTestMessage({
					id: 'msg-first',
					data: { category: 'text', content: 'First message' },
				}),
				createTestMessage({
					id: 'msg-second',
					data: { category: 'text', content: 'Second message' },
				}),
				createTestMessage({
					id: 'msg-third',
					data: { category: 'text', content: 'Third message' },
				}),
			];
			render(MessageList, { props: { messages } });

			const items = document.querySelectorAll('.message-item');
			expect(items[0]).toHaveAttribute('data-message-id', 'msg-first');
			expect(items[1]).toHaveAttribute('data-message-id', 'msg-second');
			expect(items[2]).toHaveAttribute('data-message-id', 'msg-third');
		});
	});

	describe('message types', () => {
		it('should render text messages', () => {
			const message = createTestMessage({
				category: 'text',
				data: { category: 'text', content: 'Hello world' },
			});
			render(MessageList, { props: { messages: [message] } });

			expect(screen.getByText('Hello world')).toBeInTheDocument();
		});

		it('should render user messages', () => {
			const message = createTestMessage({
				role: 'user',
				data: { category: 'text', content: 'User input' },
			});
			render(MessageList, { props: { messages: [message] } });

			expect(screen.getByText('User input')).toBeInTheDocument();
		});

		it('should render agent messages', () => {
			const message = createTestMessage({
				role: 'agent',
				data: { category: 'text', content: 'Agent response' },
			});
			render(MessageList, { props: { messages: [message] } });

			expect(screen.getByText('Agent response')).toBeInTheDocument();
		});

		it('should render image messages', () => {
			const message = createTestMessage({
				category: 'image',
				role: 'user',
				data: {
					category: 'image',
					src: 'data:image/png;base64,abc123',
					mimeType: 'image/png',
				},
			});
			render(MessageList, { props: { messages: [message] } });

			const img = document.querySelector('img');
			expect(img).toBeInTheDocument();
			expect(img).toHaveAttribute('src', 'data:image/png;base64,abc123');
		});
	});

	describe('message state classes', () => {
		it('should apply disabled class to disabled messages', () => {
			const message = createTestMessage({ disabled: true });
			render(MessageList, { props: { messages: [message] } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).toHaveClass('disabled');
		});

		it('should apply is-new class to new messages', () => {
			const message = createTestMessage({ isNew: true });
			render(MessageList, { props: { messages: [message] } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).toHaveClass('is-new');
		});

		it('should apply user class to user messages', () => {
			const message = createTestMessage({ role: 'user' });
			render(MessageList, { props: { messages: [message] } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).toHaveClass('user');
		});

		it('should apply agent class to agent messages', () => {
			const message = createTestMessage({ role: 'agent' });
			render(MessageList, { props: { messages: [message] } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).toHaveClass('agent');
		});

		it('should apply streaming class to streaming messages', () => {
			const message = createTestMessage({ isStreaming: true });
			render(MessageList, { props: { messages: [message] } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).toHaveClass('streaming');
		});
	});

	// Note: Event forwarding tests are skipped because Svelte 5's createEventDispatcher
	// creates component-level events that don't bubble through the DOM. Testing event
	// forwarding requires either wrapper components or integration/E2E tests.
	// The event forwarding functionality is tested via E2E tests.

	describe('dynamic updates (regression: NaN flip animation)', () => {
		it('should render new messages added after initial render', async () => {
			const initialMessages = [
				createTestMessage({ id: 'msg-1', data: { category: 'text', content: 'First' } }),
			];
			const { rerender } = render(MessageList, { props: { messages: initialMessages } });

			expect(document.querySelectorAll('.message-item')).toHaveLength(1);

			// Simulate adding messages (as happens during identification/enrichment)
			const updatedMessages = [
				...initialMessages,
				createTestMessage({ id: 'msg-2', data: { category: 'text', content: 'Second' } }),
				createTestMessage({ id: 'msg-3', data: { category: 'text', content: 'Third' } }),
			];
			await rerender({ messages: updatedMessages });

			const items = document.querySelectorAll('.message-item');
			expect(items).toHaveLength(3);
			expect(items[0]).toHaveAttribute('data-message-id', 'msg-1');
			expect(items[1]).toHaveAttribute('data-message-id', 'msg-2');
			expect(items[2]).toHaveAttribute('data-message-id', 'msg-3');
		});
	});
});

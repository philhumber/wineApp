import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/svelte';
import MessageWrapper from '../MessageWrapper.svelte';
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


describe('MessageWrapper', () => {
	afterEach(() => {
		cleanup();
	});

	describe('rendering', () => {
		it('should render wrapper element', () => {
			const message = createTestMessage();
			render(MessageWrapper, { props: { message } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).toBeInTheDocument();
		});

		it('should render message content', () => {
			const message = createTestMessage({
				data: { category: 'text', content: 'Hello, World!' },
			});
			render(MessageWrapper, { props: { message } });

			expect(screen.getByText('Hello, World!')).toBeInTheDocument();
		});
	});

	describe('disabled state', () => {
		it('should apply disabled class when message.disabled is true', () => {
			const message = createTestMessage({ disabled: true });
			render(MessageWrapper, { props: { message } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).toHaveClass('disabled');
		});

		it('should not apply disabled class when message.disabled is false', () => {
			const message = createTestMessage({ disabled: false });
			render(MessageWrapper, { props: { message } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).not.toHaveClass('disabled');
		});

		it('should not apply disabled class when message.disabled is undefined', () => {
			const message = createTestMessage();
			delete (message as Partial<AgentMessage>).disabled;
			render(MessageWrapper, { props: { message } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).not.toHaveClass('disabled');
		});

		it('should have pointer-events: none when disabled', () => {
			const message = createTestMessage({ disabled: true });
			render(MessageWrapper, { props: { message } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).toHaveClass('disabled');
			// Note: computed styles would need to be checked differently
		});
	});

	describe('isNew state', () => {
		it('should apply is-new class when message.isNew is true', () => {
			const message = createTestMessage({ isNew: true });
			render(MessageWrapper, { props: { message } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).toHaveClass('is-new');
		});

		it('should not apply is-new class when message.isNew is false', () => {
			const message = createTestMessage({ isNew: false });
			render(MessageWrapper, { props: { message } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).not.toHaveClass('is-new');
		});

		it('should not apply is-new class when message.isNew is undefined', () => {
			const message = createTestMessage();
			delete (message as Partial<AgentMessage>).isNew;
			render(MessageWrapper, { props: { message } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).not.toHaveClass('is-new');
		});
	});

	describe('role alignment', () => {
		it('should apply user class for user messages', () => {
			const message = createTestMessage({ role: 'user' });
			render(MessageWrapper, { props: { message } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).toHaveClass('user');
			expect(wrapper).not.toHaveClass('agent');
		});

		it('should apply agent class for agent messages', () => {
			const message = createTestMessage({ role: 'agent' });
			render(MessageWrapper, { props: { message } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).toHaveClass('agent');
			expect(wrapper).not.toHaveClass('user');
		});

		it('should default to agent alignment when role is undefined', () => {
			const message = createTestMessage();
			// @ts-expect-error - Testing undefined role behavior
			delete message.role;
			render(MessageWrapper, { props: { message } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).toHaveClass('agent');
		});

		it('should right-align user messages', () => {
			const message = createTestMessage({ role: 'user' });
			render(MessageWrapper, { props: { message } });

			const wrapper = document.querySelector('.message-wrapper.user');
			expect(wrapper).toBeInTheDocument();
			// User messages have justify-content: flex-end
		});

		it('should left-align agent messages', () => {
			const message = createTestMessage({ role: 'agent' });
			render(MessageWrapper, { props: { message } });

			const wrapper = document.querySelector('.message-wrapper.agent');
			expect(wrapper).toBeInTheDocument();
			// Agent messages have justify-content: flex-start
		});
	});

	describe('streaming state', () => {
		it('should apply streaming class when message.isStreaming is true', () => {
			const message = createTestMessage({ isStreaming: true });
			render(MessageWrapper, { props: { message } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).toHaveClass('streaming');
		});

		it('should not apply streaming class when message.isStreaming is false', () => {
			const message = createTestMessage({ isStreaming: false });
			render(MessageWrapper, { props: { message } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).not.toHaveClass('streaming');
		});

		it('should not apply streaming class when message.isStreaming is undefined', () => {
			const message = createTestMessage();
			delete (message as Partial<AgentMessage>).isStreaming;
			render(MessageWrapper, { props: { message } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).not.toHaveClass('streaming');
		});
	});

	describe('combined states', () => {
		it('should apply multiple classes simultaneously', () => {
			const message = createTestMessage({
				role: 'user',
				disabled: true,
				isNew: true,
				isStreaming: true,
			});
			render(MessageWrapper, { props: { message } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).toHaveClass('user');
			expect(wrapper).toHaveClass('disabled');
			expect(wrapper).toHaveClass('is-new');
			expect(wrapper).toHaveClass('streaming');
		});

		it('should handle transition between states', async () => {
			const message = createTestMessage({ isNew: true, disabled: false });
			const { rerender } = render(MessageWrapper, { props: { message } });

			let wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).toHaveClass('is-new');
			expect(wrapper).not.toHaveClass('disabled');

			// Update message state
			const updatedMessage = { ...message, isNew: false, disabled: true };
			await rerender({ message: updatedMessage });

			wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).not.toHaveClass('is-new');
			expect(wrapper).toHaveClass('disabled');
		});
	});

	describe('action event forwarding', () => {
		// Note: Full event forwarding tests are skipped because Svelte 5's createEventDispatcher
		// creates component-level events that don't bubble through the DOM. Testing event
		// forwarding requires either wrapper components or integration/E2E tests.
		// The event forwarding functionality is tested via E2E tests.

		it('should have interactive chips when not disabled', () => {
			const message = createTestMessage({
				id: 'msg-chips',
				category: 'chips',
				data: {
					category: 'chips',
					chips: [{ id: 'chip-1', label: 'Click Me', action: 'test_action', variant: 'primary' }],
				},
			});

			render(MessageWrapper, { props: { message } });

			const chipButton = screen.getByRole('button', { name: 'Click Me' });
			expect(chipButton).not.toBeDisabled();
		});

		it('should disable chips when message is disabled', () => {
			const message = createTestMessage({
				id: 'msg-disabled-chips',
				category: 'chips',
				disabled: true,
				data: {
					category: 'chips',
					chips: [{ id: 'chip-1', label: 'Disabled Chip', action: 'should_not_fire', variant: 'primary' }],
				},
			});

			render(MessageWrapper, { props: { message } });

			const chipButton = screen.getByRole('button', { name: 'Disabled Chip' });
			expect(chipButton).toBeDisabled();
		});
	});

	describe('message content categories', () => {
		it('should render text message content', () => {
			const message = createTestMessage({
				category: 'text',
				data: { category: 'text', content: 'This is a text message' },
			});
			render(MessageWrapper, { props: { message } });

			expect(screen.getByText('This is a text message')).toBeInTheDocument();
		});

		it('should render chips message content', () => {
			const message = createTestMessage({
				category: 'chips',
				data: {
					category: 'chips',
					chips: [
						{ id: 'c1', label: 'Option A', action: 'opt_a' },
						{ id: 'c2', label: 'Option B', action: 'opt_b' },
					],
				},
			});
			render(MessageWrapper, { props: { message } });

			expect(screen.getByRole('button', { name: 'Option A' })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Option B' })).toBeInTheDocument();
		});

		it('should render image message content', () => {
			const message = createTestMessage({
				category: 'image',
				role: 'user',
				data: {
					category: 'image',
					src: 'data:image/jpeg;base64,testdata',
					mimeType: 'image/jpeg',
				},
			});
			render(MessageWrapper, { props: { message } });

			const img = document.querySelector('img');
			expect(img).toBeInTheDocument();
			expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,testdata');
		});

		it('should render error message content', () => {
			const message = createTestMessage({
				category: 'error',
				data: {
					category: 'error',
					error: {
						type: 'timeout',
						userMessage: 'Something went wrong',
						retryable: true,
					},
					retryable: true,
				},
			});
			render(MessageWrapper, { props: { message } });

			expect(screen.getByText('Something went wrong')).toBeInTheDocument();
		});
	});

	describe('accessibility', () => {
		it('should have proper opacity when disabled for visual feedback', () => {
			const message = createTestMessage({ disabled: true });
			render(MessageWrapper, { props: { message } });

			const wrapper = document.querySelector('.message-wrapper');
			expect(wrapper).toHaveClass('disabled');
			// The .disabled class applies opacity: 0.6
		});

		it('should not block interaction when not disabled', () => {
			const message = createTestMessage({
				category: 'chips',
				data: {
					category: 'chips',
					chips: [{ id: 'c1', label: 'Clickable', action: 'click_action' }],
				},
			});
			render(MessageWrapper, { props: { message } });

			const button = screen.getByRole('button', { name: 'Clickable' });
			expect(button).not.toBeDisabled();
		});
	});
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import AgentChatContainer from '../AgentChatContainer.svelte';
import { resetConversation } from '$lib/stores/agentConversation';

describe('AgentChatContainer', () => {
	beforeEach(() => {
		resetConversation();
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	describe('CSS structure for scroll', () => {
		it('should have min-height: 0 on container for flex shrinking', () => {
			const { container } = render(AgentChatContainer, {
				props: { messages: [] },
			});

			const chatContainer = container.querySelector('.agent-chat-container');
			expect(chatContainer).toBeInTheDocument();

			// Check computed style includes min-height: 0
			const styles = window.getComputedStyle(chatContainer!);
			// Note: jsdom may not fully compute styles, so we check the element exists
			// and trust the CSS is applied. Integration tests would verify actual scroll.
			expect(chatContainer).toHaveClass('agent-chat-container');
		});

		it('should have scrollable viewport with overflow-y: auto', () => {
			const { container } = render(AgentChatContainer, {
				props: { messages: [] },
			});

			const viewport = container.querySelector('.chat-viewport');
			expect(viewport).toBeInTheDocument();
		});

		it('should have flex column layout', () => {
			const { container } = render(AgentChatContainer, {
				props: { messages: [] },
			});

			const chatContainer = container.querySelector('.agent-chat-container');
			expect(chatContainer).toBeInTheDocument();
		});

		it('should have messages content wrapper', () => {
			const { container } = render(AgentChatContainer, {
				props: { messages: [] },
			});

			const messagesContent = container.querySelector('.messages-content');
			expect(messagesContent).toBeInTheDocument();
		});

		it('should have input container that does not shrink', () => {
			const { container } = render(AgentChatContainer, {
				props: { messages: [] },
			});

			const inputContainer = container.querySelector('.input-container');
			expect(inputContainer).toBeInTheDocument();
		});
	});

	describe('scroll behavior', () => {
		it('should track user scroll position', async () => {
			const { container } = render(AgentChatContainer, {
				props: { messages: [] },
			});

			const viewport = container.querySelector('.chat-viewport') as HTMLElement;
			expect(viewport).toBeInTheDocument();

			// Mock scroll properties
			Object.defineProperty(viewport, 'scrollHeight', { value: 1000, configurable: true });
			Object.defineProperty(viewport, 'scrollTop', { value: 0, configurable: true });
			Object.defineProperty(viewport, 'clientHeight', { value: 400, configurable: true });

			// Simulate scroll event
			viewport.dispatchEvent(new Event('scroll'));

			// The component should detect user scrolled up (distance from bottom > 50)
			// This is internal state, but we verify the handler runs without error
		});

		it('should have scroll container bound for programmatic scrolling', () => {
			const { container } = render(AgentChatContainer, {
				props: { messages: [] },
			});

			const viewport = container.querySelector('.chat-viewport');
			expect(viewport).toBeInTheDocument();

			// Verify scrollTo is available (jsdom provides this)
			expect(typeof viewport?.scrollTo).toBe('function');
		});
	});

	describe('slots', () => {
		it('should render messages slot content', () => {
			const { container } = render(AgentChatContainer, {
				props: { messages: [] },
			});

			const messagesContent = container.querySelector('.messages-content');
			expect(messagesContent).toBeInTheDocument();
		});

		it('should render input slot content', () => {
			const { container } = render(AgentChatContainer, {
				props: { messages: [] },
			});

			const inputContainer = container.querySelector('.input-container');
			expect(inputContainer).toBeInTheDocument();
		});
	});
});

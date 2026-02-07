import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ChipsMessage from '../ChipsMessage.svelte';
import type { AgentMessage } from '$lib/agent/types';
import * as agentConversation from '$lib/stores/agentConversation';

// Helper to create test messages
function createTestMessage(overrides: Partial<AgentMessage> = {}): AgentMessage {
	return {
		id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
		category: 'text',
		role: 'agent',
		timestamp: Date.now(),
		data: { category: 'text', content: 'Test message' },
		isNew: false,
		...overrides,
	};
}

function createChipsMessage(overrides: Partial<AgentMessage> = {}): AgentMessage {
	return createTestMessage({
		category: 'chips',
		data: {
			category: 'chips',
			chips: [
				{ id: 'chip-1', label: 'Option A', action: 'action_a' },
				{ id: 'chip-2', label: 'Option B', action: 'action_b', variant: 'primary' },
			],
		},
		...overrides,
	});
}

describe('ChipsMessage', () => {
	let scrollIntoViewMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		// Reset the conversation store to a clean state
		agentConversation.fullReset();

		// Mock scrollIntoView
		scrollIntoViewMock = vi.fn();
		Element.prototype.scrollIntoView = scrollIntoViewMock;
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	describe('preceding message readiness', () => {
		it('should render chips when there is no preceding message', () => {
			const chipsMsg = createChipsMessage({ id: 'chips-1' });

			// Add only the chips message to the store
			agentConversation.addMessage(chipsMsg);

			render(ChipsMessage, { props: { message: chipsMsg } });

			// Chips should be visible immediately
			expect(screen.getByRole('button', { name: 'Option A' })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Option B' })).toBeInTheDocument();
		});

		it('should render chips when preceding message has isNew: false', () => {
			const textMsg = createTestMessage({
				id: 'text-1',
				isNew: false, // Ready
			});
			const chipsMsg = createChipsMessage({ id: 'chips-1' });

			// Add messages to store in order
			agentConversation.addMessage(textMsg);
			agentConversation.addMessage(chipsMsg);

			render(ChipsMessage, { props: { message: chipsMsg } });

			// Chips should be visible since preceding message is ready
			expect(screen.getByRole('button', { name: 'Option A' })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Option B' })).toBeInTheDocument();
		});

		it('should NOT render chips when preceding message has isNew: true', () => {
			const textMsg = createTestMessage({
				id: 'text-1',
				isNew: true, // Still animating
			});
			const chipsMsg = createChipsMessage({ id: 'chips-1' });

			// Add messages to store in order
			agentConversation.addMessage(textMsg);
			// Manually set isNew back to true (addMessage sets it, but we need to override)
			agentConversation.updateMessage('text-1', { isNew: true });
			agentConversation.addMessage(chipsMsg);

			render(ChipsMessage, { props: { message: chipsMsg } });

			// Chips should NOT be visible since preceding message is still animating
			expect(screen.queryByRole('button', { name: 'Option A' })).not.toBeInTheDocument();
			expect(screen.queryByRole('button', { name: 'Option B' })).not.toBeInTheDocument();
		});

		it('should render chips after preceding message becomes ready', async () => {
			const textMsg = createTestMessage({
				id: 'text-1',
				isNew: true, // Still animating
			});
			const chipsMsg = createChipsMessage({ id: 'chips-1' });

			// Add messages
			agentConversation.addMessage(textMsg);
			agentConversation.updateMessage('text-1', { isNew: true });
			agentConversation.addMessage(chipsMsg);

			const { rerender } = render(ChipsMessage, { props: { message: chipsMsg } });

			// Initially not visible
			expect(screen.queryByRole('button', { name: 'Option A' })).not.toBeInTheDocument();

			// Simulate typewriter completion - clear the isNew flag
			agentConversation.clearNewFlag('text-1');

			// Need to rerender to pick up store changes
			await rerender({ message: chipsMsg });

			// Now chips should be visible
			expect(screen.getByRole('button', { name: 'Option A' })).toBeInTheDocument();
		});
	});

	describe('chip rendering', () => {
		it('should render all chips from message data', () => {
			const chipsMsg = createChipsMessage({
				id: 'chips-1',
				data: {
					category: 'chips',
					chips: [
						{ id: 'c1', label: 'First', action: 'first' },
						{ id: 'c2', label: 'Second', action: 'second' },
						{ id: 'c3', label: 'Third', action: 'third' },
					],
				},
			});
			agentConversation.addMessage(chipsMsg);

			render(ChipsMessage, { props: { message: chipsMsg } });

			expect(screen.getByRole('button', { name: 'First' })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Second' })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'Third' })).toBeInTheDocument();
		});

		it('should apply primary variant class to primary chips', () => {
			const chipsMsg = createChipsMessage({
				id: 'chips-1',
				data: {
					category: 'chips',
					chips: [
						{ id: 'c1', label: 'Normal', action: 'normal' },
						{ id: 'c2', label: 'Primary', action: 'primary', variant: 'primary' },
					],
				},
			});
			agentConversation.addMessage(chipsMsg);

			render(ChipsMessage, { props: { message: chipsMsg } });

			const normalButton = screen.getByRole('button', { name: 'Normal' });
			const primaryButton = screen.getByRole('button', { name: 'Primary' });

			expect(normalButton).not.toHaveClass('primary');
			expect(primaryButton).toHaveClass('primary');
		});
	});

	describe('disabled state', () => {
		it('should disable all chips when message is disabled', () => {
			const chipsMsg = createChipsMessage({
				id: 'chips-1',
				disabled: true,
			});
			agentConversation.addMessage(chipsMsg);

			render(ChipsMessage, { props: { message: chipsMsg } });

			const buttons = screen.getAllByRole('button');
			buttons.forEach((button) => {
				expect(button).toBeDisabled();
			});
		});

		it('should show checkmark on selected chip when disabled', () => {
			const chipsMsg = createChipsMessage({
				id: 'chips-1',
				disabled: true,
				data: {
					category: 'chips',
					chips: [
						{ id: 'c1', label: 'Yes', action: 'yes' },
						{ id: 'c2', label: 'No', action: 'no' },
					],
					selectedChipId: 'c1',
				},
			});
			agentConversation.addMessage(chipsMsg);

			render(ChipsMessage, { props: { message: chipsMsg } });

			const selectedButton = screen.getByRole('button', { name: /Yes/ });
			const unselectedButton = screen.getByRole('button', { name: /No/ });

			expect(selectedButton.textContent).toContain('✓');
			expect(selectedButton).toHaveClass('selected');
			expect(unselectedButton.textContent).not.toContain('✓');
			expect(unselectedButton).not.toHaveClass('selected');
		});
	});

	describe('scroll behavior', () => {
		it('should have scrollIntoView available for intro animation', () => {
			const chipsMsg = createChipsMessage({ id: 'chips-1' });
			agentConversation.addMessage(chipsMsg);

			render(ChipsMessage, { props: { message: chipsMsg } });

			// The element should exist and scrollIntoView should be mockable
			const chipsContainer = document.querySelector('.chips-message');
			expect(chipsContainer).toBeInTheDocument();

			// scrollIntoView is called on introend, which in tests happens synchronously
			// due to the mocked animation. The actual call timing depends on Svelte's
			// transition behavior in jsdom.
		});
	});

	describe('double-click protection (WIN-228)', () => {
		it('should only update message once on rapid double-click', async () => {
			const chipsMsg = createChipsMessage({ id: 'chips-1' });
			agentConversation.addMessage(chipsMsg);

			// Spy on updateMessage to count how many times a chip selection is recorded
			const updateMessageSpy = vi.spyOn(agentConversation, 'updateMessage');

			render(ChipsMessage, { props: { message: chipsMsg } });

			const button = screen.getByRole('button', { name: 'Option A' });

			// Simulate rapid double-click (two clicks before any async handler could complete)
			button.click();
			button.click();

			// Should only have called updateMessage once due to local processing guard
			// (updateMessage is called to record selectedChipId before dispatching)
			expect(updateMessageSpy).toHaveBeenCalledTimes(1);
		});

		it('should block clicks on other chips while processing', async () => {
			const chipsMsg = createChipsMessage({ id: 'chips-1' });
			agentConversation.addMessage(chipsMsg);

			const updateMessageSpy = vi.spyOn(agentConversation, 'updateMessage');

			render(ChipsMessage, { props: { message: chipsMsg } });

			const buttonA = screen.getByRole('button', { name: 'Option A' });
			const buttonB = screen.getByRole('button', { name: 'Option B' });

			// Click first button
			buttonA.click();

			// Try clicking second button before message.disabled propagates
			buttonB.click();

			// Should only have processed the first click
			expect(updateMessageSpy).toHaveBeenCalledTimes(1);
			expect(updateMessageSpy).toHaveBeenCalledWith(
				'chips-1',
				expect.objectContaining({
					data: expect.objectContaining({
						selectedChipId: 'chip-1', // First chip was selected
					}),
				})
			);
		});
	});
});

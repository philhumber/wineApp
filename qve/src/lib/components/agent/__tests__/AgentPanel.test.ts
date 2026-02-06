import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import AgentPanel from '../AgentPanel.svelte';
import { agent, agentPanelOpen } from '$lib/stores';
import { resetConversation } from '$lib/stores/agentConversation';
import { get } from 'svelte/store';

// Mock goto and page for navigation
vi.mock('$app/navigation', () => ({
	goto: vi.fn(),
}));

vi.mock('$app/paths', () => ({
	base: '/qve',
}));

describe('AgentPanel', () => {
	let originalInnerWidth: number;
	let visualViewportMock: {
		height: number;
		width: number;
		addEventListener: ReturnType<typeof vi.fn>;
		removeEventListener: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		resetConversation();
		vi.clearAllMocks();

		// Store original window width
		originalInnerWidth = window.innerWidth;

		// Create Visual Viewport mock
		visualViewportMock = {
			height: 800,
			width: 400,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		};
	});

	afterEach(() => {
		cleanup();
		// Restore window width
		Object.defineProperty(window, 'innerWidth', {
			value: originalInnerWidth,
			writable: true,
		});
		// Clean up visualViewport mock
		if ('visualViewport' in window) {
			delete (window as unknown as Record<string, unknown>).visualViewport;
		}
	});

	describe('panel structure', () => {
		it('should not render when panel is closed', () => {
			agent.closePanel();
			render(AgentPanel);

			expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		});

		it('should render when panel is open', () => {
			agent.openPanel();
			render(AgentPanel);

			expect(screen.getByRole('dialog')).toBeInTheDocument();
			expect(screen.getByText('Wine Assistant')).toBeInTheDocument();
		});

		it('should have close button', () => {
			agent.openPanel();
			render(AgentPanel);

			expect(screen.getByLabelText('Close')).toBeInTheDocument();
		});

		it('should have start over button', () => {
			agent.openPanel();
			render(AgentPanel);

			expect(screen.getByText('Start Over')).toBeInTheDocument();
		});

		it('should close when close button clicked', async () => {
			agent.openPanel();
			render(AgentPanel);

			const closeBtn = screen.getByLabelText('Close');
			await fireEvent.click(closeBtn);

			// Check store state directly (DOM may still show during transition)
			expect(get(agentPanelOpen)).toBe(false);
		});

		it('should close when backdrop clicked', async () => {
			agent.openPanel();
			const { container } = render(AgentPanel);

			const backdrop = container.querySelector('.agent-backdrop');
			expect(backdrop).toBeInTheDocument();

			await fireEvent.click(backdrop!);

			// Check store state directly (DOM may still show during transition)
			expect(get(agentPanelOpen)).toBe(false);
		});
	});

	describe('mobile keyboard handling', () => {
		it('should set up Visual Viewport listener on mount when available', () => {
			// Set up visualViewport mock
			Object.defineProperty(window, 'visualViewport', {
				value: visualViewportMock,
				writable: true,
				configurable: true,
			});

			// Simulate mobile width
			Object.defineProperty(window, 'innerWidth', {
				value: 400,
				writable: true,
			});

			agent.openPanel();
			render(AgentPanel);

			expect(visualViewportMock.addEventListener).toHaveBeenCalledWith(
				'resize',
				expect.any(Function)
			);
		});

		it('should clean up Visual Viewport listener on unmount', () => {
			Object.defineProperty(window, 'visualViewport', {
				value: visualViewportMock,
				writable: true,
				configurable: true,
			});

			Object.defineProperty(window, 'innerWidth', {
				value: 400,
				writable: true,
			});

			agent.openPanel();
			const { unmount } = render(AgentPanel);

			unmount();

			expect(visualViewportMock.removeEventListener).toHaveBeenCalledWith(
				'resize',
				expect.any(Function)
			);
		});

		it('should adjust panel height when viewport resizes on mobile', () => {
			Object.defineProperty(window, 'visualViewport', {
				value: visualViewportMock,
				writable: true,
				configurable: true,
			});

			Object.defineProperty(window, 'innerWidth', {
				value: 400,
				writable: true,
			});

			agent.openPanel();
			const { container } = render(AgentPanel);

			// Get the resize handler
			const resizeHandler = visualViewportMock.addEventListener.mock.calls[0]?.[1];
			expect(resizeHandler).toBeDefined();

			// Simulate keyboard appearing (viewport shrinks)
			visualViewportMock.height = 500;
			resizeHandler?.();

			const panel = container.querySelector('.agent-panel') as HTMLElement;
			// Panel height should be 85% of visible viewport
			expect(panel.style.height).toBe('425px'); // 500 * 0.85
		});

		it('should not adjust panel height on desktop (width > 640)', () => {
			Object.defineProperty(window, 'visualViewport', {
				value: visualViewportMock,
				writable: true,
				configurable: true,
			});

			// Desktop width
			Object.defineProperty(window, 'innerWidth', {
				value: 1024,
				writable: true,
			});

			agent.openPanel();
			const { container } = render(AgentPanel);

			const resizeHandler = visualViewportMock.addEventListener.mock.calls[0]?.[1];

			// Simulate viewport change
			visualViewportMock.height = 500;
			resizeHandler?.();

			const panel = container.querySelector('.agent-panel') as HTMLElement;
			// Should not have inline height style on desktop
			expect(panel.style.height).toBe('');
		});

		it('should handle missing Visual Viewport API gracefully', () => {
			// Ensure visualViewport is not defined
			if ('visualViewport' in window) {
				delete (window as unknown as Record<string, unknown>).visualViewport;
			}

			agent.openPanel();

			// Should not throw
			expect(() => render(AgentPanel)).not.toThrow();
		});
	});

	describe('CSS mobile styles', () => {
		it('should have panel element with correct class', () => {
			agent.openPanel();
			const { container } = render(AgentPanel);

			const panel = container.querySelector('.agent-panel');
			expect(panel).toBeInTheDocument();
		});

		// Note: CSS media queries can't be fully tested in jsdom.
		// These tests verify the structure exists; visual regression tests
		// or integration tests would verify actual responsive behavior.
	});
});

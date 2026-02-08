/**
 * DeleteConfirmModal Component Tests (WIN-80: Soft Delete)
 *
 * Tests for the delete confirmation modal that displays:
 * - Entity name and type
 * - Cascade impact preview (bottles, ratings to be deleted)
 * - Cancel and Delete buttons
 * - Loading state while fetching impact
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/svelte';
import DeleteConfirmModal from '../DeleteConfirmModal.svelte';
import type { DeleteImpact } from '$lib/api/types';

// Mock the API
const mockGetDeleteImpact = vi.fn();
vi.mock('$lib/api', () => ({
	api: {
		getDeleteImpact: (...args: unknown[]) => mockGetDeleteImpact(...args)
	}
}));

// Helper to create impact response
function createImpactResponse(impact: DeleteImpact) {
	return { entity: { type: 'wine', id: 123, name: 'Test Wine' }, impact };
}

describe('DeleteConfirmModal', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default mock - resolves with empty impact
		mockGetDeleteImpact.mockResolvedValue(
			createImpactResponse({ bottles: { count: 0, names: [] }, ratings: { count: 0 } })
		);
	});

	afterEach(() => {
		cleanup();
	});

	describe('basic rendering', () => {
		it('should display entity name', async () => {
			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Chateau Margaux 2015' }
			});

			expect(screen.getByText('Chateau Margaux 2015')).toBeInTheDocument();
		});

		it('should display "Delete wine?" title for wine entity', async () => {
			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' }
			});

			expect(screen.getByText('Delete wine?')).toBeInTheDocument();
		});

		it('should display "Delete bottle?" title for bottle entity', async () => {
			render(DeleteConfirmModal, {
				props: { entityType: 'bottle', entityId: 456, entityName: '750ml bottle' }
			});

			expect(screen.getByText('Delete bottle?')).toBeInTheDocument();
		});

		it('should have Cancel and Delete buttons', async () => {
			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' }
			});

			expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
		});
	});

	describe('loading state', () => {
		it('should show loading state initially', async () => {
			// Make API hang to keep loading state
			mockGetDeleteImpact.mockImplementation(() => new Promise(() => {}));

			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' }
			});

			expect(screen.getByText('Checking impact...')).toBeInTheDocument();
		});

		it('should disable Delete button while loading', async () => {
			mockGetDeleteImpact.mockImplementation(() => new Promise(() => {}));

			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' }
			});

			const deleteBtn = screen.getByRole('button', { name: /delete/i });
			expect(deleteBtn).toBeDisabled();
		});

		it('should enable Delete button after loading completes', async () => {
			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' }
			});

			await waitFor(() => {
				const deleteBtn = screen.getByRole('button', { name: /delete/i });
				expect(deleteBtn).not.toBeDisabled();
			});
		});
	});

	describe('impact display - wine delete', () => {
		it('should show bottle count when wine has bottles', async () => {
			mockGetDeleteImpact.mockResolvedValue(
				createImpactResponse({
					bottles: { count: 3, names: ['750ml - 2020', '750ml - 2021', 'Magnum'] },
					ratings: { count: 0 }
				})
			);

			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' }
			});

			await waitFor(() => {
				expect(screen.getByText('3 bottles')).toBeInTheDocument();
			});
		});

		it('should show rating count when wine has ratings', async () => {
			mockGetDeleteImpact.mockResolvedValue(
				createImpactResponse({
					bottles: { count: 1, names: ['750ml'] },
					ratings: { count: 2 }
				})
			);

			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' }
			});

			await waitFor(() => {
				expect(screen.getByText('2 ratings')).toBeInTheDocument();
			});
		});

		it('should show "This will also delete:" when there is cascade', async () => {
			mockGetDeleteImpact.mockResolvedValue(
				createImpactResponse({
					bottles: { count: 2, names: ['750ml', '750ml'] },
					ratings: { count: 1 }
				})
			);

			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' }
			});

			await waitFor(() => {
				expect(screen.getByText('This will also delete:')).toBeInTheDocument();
			});
		});

		it('should show sample names in impact section', async () => {
			mockGetDeleteImpact.mockResolvedValue(
				createImpactResponse({
					bottles: { count: 2, names: ['750ml - 2020', 'Magnum - 2019'] },
					ratings: { count: 0 }
				})
			);

			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' }
			});

			await waitFor(() => {
				expect(screen.getByText(/Including:/)).toBeInTheDocument();
				expect(screen.getByText(/750ml - 2020/)).toBeInTheDocument();
			});
		});

		it('should hide impact section when no cascade for wine with 0 bottles', async () => {
			mockGetDeleteImpact.mockResolvedValue(
				createImpactResponse({
					bottles: { count: 0, names: [] },
					ratings: { count: 0 }
				})
			);

			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' }
			});

			await waitFor(() => {
				expect(screen.queryByText('Checking impact...')).not.toBeInTheDocument();
			});

			expect(screen.queryByText('This will also delete:')).not.toBeInTheDocument();
		});
	});

	describe('impact display - bottle delete', () => {
		it('should not show cascade section for bottle entity type', async () => {
			// Even if API returns counts, bottle delete should not show cascade
			mockGetDeleteImpact.mockResolvedValue(
				createImpactResponse({
					bottles: { count: 1, names: ['750ml'] },
					ratings: { count: 1 }
				})
			);

			render(DeleteConfirmModal, {
				props: { entityType: 'bottle', entityId: 456, entityName: '750ml bottle' }
			});

			await waitFor(() => {
				expect(screen.queryByText('Checking impact...')).not.toBeInTheDocument();
			});

			// hasCascade is false when entityType === 'bottle'
			expect(screen.queryByText('This will also delete:')).not.toBeInTheDocument();
		});
	});

	describe('button interactions', () => {
		it('should dispatch cancel event when Cancel is clicked', async () => {
			const cancelHandler = vi.fn();
			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' },
				events: { cancel: cancelHandler }
			});

			await fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

			expect(cancelHandler).toHaveBeenCalled();
		});

		it('should dispatch confirm event with entity details when Delete is clicked', async () => {
			const confirmHandler = vi.fn();
			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' },
				events: { confirm: confirmHandler }
			});

			// Wait for loading to complete
			await waitFor(() => {
				expect(screen.getByRole('button', { name: /delete/i })).not.toBeDisabled();
			});

			await fireEvent.click(screen.getByRole('button', { name: /delete/i }));

			expect(confirmHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					detail: { type: 'wine', id: 123, name: 'Test Wine' }
				})
			);
		});
	});

	describe('keyboard interactions', () => {
		it('should dispatch cancel event on Escape key', async () => {
			const cancelHandler = vi.fn();
			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' },
				events: { cancel: cancelHandler }
			});

			await fireEvent.keyDown(window, { key: 'Escape' });

			expect(cancelHandler).toHaveBeenCalled();
		});
	});

	describe('backdrop click', () => {
		it('should dispatch cancel event when backdrop is clicked', async () => {
			const cancelHandler = vi.fn();
			const { container } = render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' },
				events: { cancel: cancelHandler }
			});

			const overlay = container.querySelector('.modal-overlay');
			if (overlay) {
				await fireEvent.click(overlay);
			}

			expect(cancelHandler).toHaveBeenCalled();
		});
	});

	describe('error handling', () => {
		it('should display error message when API fails', async () => {
			mockGetDeleteImpact.mockRejectedValue(new Error('Network error'));

			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' }
			});

			await waitFor(() => {
				expect(screen.getByText('Network error')).toBeInTheDocument();
			});
		});

		it('should display fallback error for non-Error rejections', async () => {
			mockGetDeleteImpact.mockRejectedValue('Unknown error');

			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' }
			});

			await waitFor(() => {
				expect(screen.getByText('Failed to load impact preview')).toBeInTheDocument();
			});
		});
	});

	describe('accessibility', () => {
		it('should have alertdialog role', async () => {
			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' }
			});

			expect(screen.getByRole('alertdialog')).toBeInTheDocument();
		});

		it('should have aria-modal attribute', async () => {
			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' }
			});

			const dialog = screen.getByRole('alertdialog');
			expect(dialog).toHaveAttribute('aria-modal', 'true');
		});

		it('should have aria-labelledby pointing to title', async () => {
			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' }
			});

			const dialog = screen.getByRole('alertdialog');
			expect(dialog).toHaveAttribute('aria-labelledby', 'delete-title');
		});
	});

	describe('pluralization', () => {
		it('should use singular "bottle" for count of 1', async () => {
			mockGetDeleteImpact.mockResolvedValue(
				createImpactResponse({
					bottles: { count: 1, names: ['750ml'] },
					ratings: { count: 0 }
				})
			);

			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' }
			});

			await waitFor(() => {
				expect(screen.getByText('1 bottle')).toBeInTheDocument();
			});
		});

		it('should use singular "rating" for count of 1', async () => {
			mockGetDeleteImpact.mockResolvedValue(
				createImpactResponse({
					bottles: { count: 1, names: ['750ml'] },
					ratings: { count: 1 }
				})
			);

			render(DeleteConfirmModal, {
				props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' }
			});

			await waitFor(() => {
				expect(screen.getByText('1 rating')).toBeInTheDocument();
			});
		});
	});
});

describe('DeleteConfirmModal - region/producer cascade', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it('should show all cascade levels for region delete', async () => {
		mockGetDeleteImpact.mockResolvedValue({
			entity: { type: 'region', id: 5, name: 'Bordeaux' },
			impact: {
				producers: { count: 5, names: ['Chateau Margaux', 'Chateau Latour'] },
				wines: { count: 23 },
				bottles: { count: 47, names: [] },
				ratings: { count: 12 }
			}
		});

		render(DeleteConfirmModal, {
			props: { entityType: 'region', entityId: 5, entityName: 'Bordeaux' }
		});

		await waitFor(() => {
			expect(screen.getByText('5 producers')).toBeInTheDocument();
			expect(screen.getByText('23 wines')).toBeInTheDocument();
			expect(screen.getByText('47 bottles')).toBeInTheDocument();
			expect(screen.getByText('12 ratings')).toBeInTheDocument();
		});
	});

	it('should show producer sample names for region delete', async () => {
		mockGetDeleteImpact.mockResolvedValue({
			entity: { type: 'region', id: 5, name: 'Bordeaux' },
			impact: {
				producers: { count: 2, names: ['Chateau Margaux', 'Chateau Latour'] },
				wines: { count: 10 },
				bottles: { count: 20, names: [] },
				ratings: { count: 5 }
			}
		});

		render(DeleteConfirmModal, {
			props: { entityType: 'region', entityId: 5, entityName: 'Bordeaux' }
		});

		await waitFor(() => {
			expect(screen.getByText(/Including:/)).toBeInTheDocument();
			expect(screen.getByText(/Chateau Margaux/)).toBeInTheDocument();
		});
	});
});

describe('DeleteConfirmModal - dark theme', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.documentElement.setAttribute('data-theme', 'dark');
		mockGetDeleteImpact.mockResolvedValue({
			entity: { type: 'wine', id: 123, name: 'Test Wine' },
			impact: { bottles: { count: 0, names: [] }, ratings: { count: 0 } }
		});
	});

	afterEach(() => {
		document.documentElement.removeAttribute('data-theme');
		cleanup();
	});

	it('should render correctly in dark theme', async () => {
		const { container } = render(DeleteConfirmModal, {
			props: { entityType: 'wine', entityId: 123, entityName: 'Test Wine' }
		});

		// Component should render without errors in dark theme
		expect(container.querySelector('.modal-overlay')).toBeInTheDocument();
		expect(screen.getByText('Delete wine?')).toBeInTheDocument();
	});
});

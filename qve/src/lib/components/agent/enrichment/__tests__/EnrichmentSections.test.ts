import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import CriticScoresSection from '../CriticScoresSection.svelte';
import StyleProfileSection from '../StyleProfileSection.svelte';
import GrapeCompositionSection from '../GrapeCompositionSection.svelte';
import DrinkWindowSection from '../DrinkWindowSection.svelte';
import type { StreamingField } from '$lib/agent/types';

// Helper to create props for section components
function createSectionProps(overrides: {
	state?: 'skeleton' | 'streaming' | 'static';
	fieldsMap?: Map<string, StreamingField>;
	staticData?: Record<string, unknown>;
} = {}) {
	const { state = 'static', fieldsMap = new Map(), staticData = {} } = overrides;

	return {
		state,
		fieldsMap,
		getFieldValue: (field: string) => staticData[field] ?? null,
		hasField: (field: string) => field in staticData && staticData[field] != null,
		isFieldTyping: () => false,
		handleFieldComplete: () => {},
	};
}

describe('Enrichment Sections - Missing Data Handling', () => {
	afterEach(() => {
		cleanup();
	});

	// ─────────────────────────────────────────────────────
	// CriticScoresSection
	// ─────────────────────────────────────────────────────
	describe('CriticScoresSection', () => {
		it('should render shimmer in skeleton state', () => {
			const props = createSectionProps({ state: 'skeleton' });
			render(CriticScoresSection, { props });

			const section = document.querySelector('.section');
			expect(section).toBeInTheDocument();
			expect(document.querySelector('.shimmer-scores')).toBeInTheDocument();
		});

		it('should render shimmer in streaming state without data', () => {
			const props = createSectionProps({ state: 'streaming' });
			render(CriticScoresSection, { props });

			const section = document.querySelector('.section');
			expect(section).toBeInTheDocument();
			expect(document.querySelector('.shimmer-scores')).toBeInTheDocument();
		});

		it('should render scores when streaming state has data', () => {
			const fieldsMap = new Map<string, StreamingField>([
				['criticScores', { value: [{ critic: 'Wine Spectator', score: 92 }], isTyping: false }],
			]);
			const props = createSectionProps({ state: 'streaming', fieldsMap });
			render(CriticScoresSection, { props });

			const section = document.querySelector('.section');
			expect(section).toBeInTheDocument();
			expect(document.querySelector('.shimmer-scores')).not.toBeInTheDocument();
		});

		it('should render scores in static state with valid data', () => {
			const props = createSectionProps({
				state: 'static',
				staticData: {
					criticScores: [
						{ critic: 'Wine Spectator', score: 92 },
						{ critic: 'Wine Advocate', score: 95 },
					],
				},
			});
			render(CriticScoresSection, { props });

			const section = document.querySelector('.section');
			expect(section).toBeInTheDocument();
			expect(document.querySelector('.shimmer-scores')).not.toBeInTheDocument();
		});

		it('should NOT render section in static state when criticScores is null', () => {
			const props = createSectionProps({
				state: 'static',
				staticData: { criticScores: null },
			});
			render(CriticScoresSection, { props });

			const section = document.querySelector('.section');
			expect(section).not.toBeInTheDocument();
		});

		it('should NOT render section in static state when criticScores is empty array', () => {
			const props = createSectionProps({
				state: 'static',
				staticData: { criticScores: [] },
			});
			render(CriticScoresSection, { props });

			const section = document.querySelector('.section');
			expect(section).not.toBeInTheDocument();
		});

		it('should NOT render section in static state when criticScores field is missing', () => {
			const props = createSectionProps({
				state: 'static',
				staticData: {},
			});
			render(CriticScoresSection, { props });

			const section = document.querySelector('.section');
			expect(section).not.toBeInTheDocument();
		});
	});

	// ─────────────────────────────────────────────────────
	// StyleProfileSection
	// ─────────────────────────────────────────────────────
	describe('StyleProfileSection', () => {
		it('should render shimmer in skeleton state', () => {
			const props = createSectionProps({ state: 'skeleton' });
			render(StyleProfileSection, { props });

			const section = document.querySelector('.section');
			expect(section).toBeInTheDocument();
			expect(document.querySelector('.shimmer-bar')).toBeInTheDocument();
		});

		it('should render profile in static state with data', () => {
			const props = createSectionProps({
				state: 'static',
				staticData: {
					body: 'Medium',
					tannin: 'Low',
					acidity: 'High',
				},
			});
			render(StyleProfileSection, { props });

			const section = document.querySelector('.section');
			expect(section).toBeInTheDocument();
			expect(document.querySelector('.shimmer-bar')).not.toBeInTheDocument();
		});

		it('should NOT render section in static state when all style fields are missing', () => {
			const props = createSectionProps({
				state: 'static',
				staticData: {},
			});
			render(StyleProfileSection, { props });

			const section = document.querySelector('.section');
			expect(section).not.toBeInTheDocument();
		});

		it('should render section in static state when at least one style field is present', () => {
			const props = createSectionProps({
				state: 'static',
				staticData: { body: 'Full' },
			});
			render(StyleProfileSection, { props });

			const section = document.querySelector('.section');
			expect(section).toBeInTheDocument();
		});
	});

	// ─────────────────────────────────────────────────────
	// GrapeCompositionSection
	// ─────────────────────────────────────────────────────
	describe('GrapeCompositionSection', () => {
		it('should render shimmer in skeleton state', () => {
			const props = createSectionProps({ state: 'skeleton' });
			render(GrapeCompositionSection, { props });

			const section = document.querySelector('.section');
			expect(section).toBeInTheDocument();
			expect(document.querySelector('.shimmer-pill')).toBeInTheDocument();
		});

		it('should render grapes in static state with valid array', () => {
			const props = createSectionProps({
				state: 'static',
				staticData: {
					grapeVarieties: [
						{ grape: 'Cabernet Sauvignon', percentage: '60%' },
						{ grape: 'Merlot', percentage: '40%' },
					],
				},
			});
			render(GrapeCompositionSection, { props });

			const section = document.querySelector('.section');
			expect(section).toBeInTheDocument();
			expect(document.querySelector('.shimmer-pill')).not.toBeInTheDocument();
		});

		it('should NOT render section in static state when grapeVarieties is null', () => {
			const props = createSectionProps({
				state: 'static',
				staticData: { grapeVarieties: null },
			});
			render(GrapeCompositionSection, { props });

			const section = document.querySelector('.section');
			expect(section).not.toBeInTheDocument();
		});

		it('should NOT render section in static state when grapeVarieties is empty array', () => {
			const props = createSectionProps({
				state: 'static',
				staticData: { grapeVarieties: [] },
			});
			render(GrapeCompositionSection, { props });

			const section = document.querySelector('.section');
			expect(section).not.toBeInTheDocument();
		});

		it('should NOT render section in static state when grapeVarieties is not an array', () => {
			const props = createSectionProps({
				state: 'static',
				staticData: { grapeVarieties: 'Pinot Noir' }, // String instead of array
			});
			render(GrapeCompositionSection, { props });

			const section = document.querySelector('.section');
			expect(section).not.toBeInTheDocument();
		});
	});

	// ─────────────────────────────────────────────────────
	// DrinkWindowSection
	// ─────────────────────────────────────────────────────
	describe('DrinkWindowSection', () => {
		it('should render shimmer in skeleton state', () => {
			const props = createSectionProps({ state: 'skeleton' });
			render(DrinkWindowSection, { props });

			const section = document.querySelector('.section');
			expect(section).toBeInTheDocument();
			expect(document.querySelector('.shimmer-bar')).toBeInTheDocument();
		});

		it('should render drink window in static state with valid data', () => {
			const props = createSectionProps({
				state: 'static',
				staticData: {
					drinkWindow: { start: 2024, end: 2030, maturity: 'ready' },
				},
			});
			render(DrinkWindowSection, { props });

			const section = document.querySelector('.section');
			expect(section).toBeInTheDocument();
			expect(document.querySelector('.shimmer-bar')).not.toBeInTheDocument();
		});

		it('should NOT render section in static state when drinkWindow is null', () => {
			const props = createSectionProps({
				state: 'static',
				staticData: { drinkWindow: null },
			});
			render(DrinkWindowSection, { props });

			const section = document.querySelector('.section');
			expect(section).not.toBeInTheDocument();
		});

		it('should NOT render section in static state when drinkWindow has no start or end', () => {
			const props = createSectionProps({
				state: 'static',
				staticData: { drinkWindow: { maturity: 'ready' } }, // No start or end
			});
			render(DrinkWindowSection, { props });

			const section = document.querySelector('.section');
			expect(section).not.toBeInTheDocument();
		});

		it('should render section when only start is present', () => {
			const props = createSectionProps({
				state: 'static',
				staticData: {
					drinkWindow: { start: 2024 },
				},
			});
			render(DrinkWindowSection, { props });

			const section = document.querySelector('.section');
			expect(section).toBeInTheDocument();
		});

		it('should render section when only end is present', () => {
			const props = createSectionProps({
				state: 'static',
				staticData: {
					drinkWindow: { end: 2030 },
				},
			});
			render(DrinkWindowSection, { props });

			const section = document.querySelector('.section');
			expect(section).toBeInTheDocument();
		});
	});

	// ─────────────────────────────────────────────────────
	// Streaming state transitions
	// ─────────────────────────────────────────────────────
	describe('Streaming state transitions', () => {
		it('CriticScoresSection: should transition from shimmer to content when data arrives', async () => {
			// Start in streaming state without data
			const props = createSectionProps({ state: 'streaming' });
			const { rerender } = render(CriticScoresSection, { props });

			expect(document.querySelector('.shimmer-scores')).toBeInTheDocument();

			// Simulate data arrival
			const fieldsMap = new Map<string, StreamingField>([
				['criticScores', { value: [{ critic: 'Decanter', score: 90 }], isTyping: false }],
			]);
			await rerender({ ...props, fieldsMap });

			expect(document.querySelector('.shimmer-scores')).not.toBeInTheDocument();
		});

		it('GrapeCompositionSection: should transition from shimmer to content when data arrives', async () => {
			const props = createSectionProps({ state: 'streaming' });
			const { rerender } = render(GrapeCompositionSection, { props });

			expect(document.querySelector('.shimmer-pill')).toBeInTheDocument();

			const fieldsMap = new Map<string, StreamingField>([
				['grapeVarieties', { value: [{ grape: 'Chardonnay', percentage: '100%' }], isTyping: false }],
			]);
			await rerender({ ...props, fieldsMap });

			expect(document.querySelector('.shimmer-pill')).not.toBeInTheDocument();
		});
	});
});

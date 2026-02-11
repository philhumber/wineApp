import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
	isEnriching,
	enrichmentData,
	enrichmentError,
	enrichmentSource,
	enrichmentForWine,
	hasEnrichmentData,
	hasOverview,
	hasGrapeComposition,
	hasTastingNotes,
	hasCriticScores,
	hasDrinkWindow,
	hasFoodPairings,
	startEnrichment,
	setEnrichmentData,
	setEnrichmentError,
	clearEnrichmentError,
	clearEnrichment,
	resetEnrichment,
	restoreFromPersistence,
	getCurrentState,
	getData,
	getForWine,
} from '../agentEnrichment';
import { clearState } from '../agentPersistence';
import type { EnrichmentData, AgentErrorInfo } from '$lib/agent/types';

// Sample test data
const sampleWineInfo = {
	producer: 'Château Margaux',
	wineName: 'Grand Vin',
	vintage: 2018,
	region: 'Margaux',
	country: 'France',
};

const sampleEnrichmentData: EnrichmentData = {
	overview: 'A prestigious First Growth from Margaux.',
	grapeComposition: [
		{ grape: 'Cabernet Sauvignon', percentage: '87%' },
		{ grape: 'Merlot', percentage: '8%' },
		{ grape: 'Petit Verdot', percentage: '3%' },
		{ grape: 'Cabernet Franc', percentage: '2%' },
	],
	styleProfile: {
		body: 'Full',
		tannin: 'High',
		acidity: 'Medium-High',
		sweetness: 'Low',
	},
	tastingNotes: {
		nose: ['blackcurrant', 'violet', 'cedar'],
		palate: ['silk', 'graphite', 'dark fruit'],
		finish: 'Long and elegant',
	},
	criticScores: [
		{ critic: 'Robert Parker', score: 98, vintage: 2018 },
		{ critic: 'Wine Spectator', score: 96, vintage: 2018 },
	],
	drinkWindow: { start: 2028, end: 2060, peak: 2040 },
	foodPairings: ['lamb', 'beef tenderloin', 'aged cheeses'],
};

describe('agentEnrichment', () => {
	beforeEach(() => {
		resetEnrichment();
		clearState();
	});

	describe('startEnrichment', () => {
		it('should set isEnriching to true', () => {
			startEnrichment(sampleWineInfo);
			expect(get(isEnriching)).toBe(true);
		});

		it('should store wine info', () => {
			startEnrichment(sampleWineInfo);
			expect(get(enrichmentForWine)).toEqual(sampleWineInfo);
		});

		it('should clear previous error', () => {
			const error: AgentErrorInfo = { type: 'timeout', userMessage: 'Test error', retryable: true };
			setEnrichmentError(error);
			startEnrichment(sampleWineInfo);
			expect(get(enrichmentError)).toBeNull();
		});

		it('should accept wine info without vintage', () => {
			const wineInfo = { producer: 'Test', wineName: 'Wine' };
			startEnrichment(wineInfo);
			expect(get(enrichmentForWine)).toEqual(wineInfo);
		});
	});

	describe('setEnrichmentData', () => {
		it('should store the enrichment data', () => {
			setEnrichmentData(sampleEnrichmentData);
			expect(get(enrichmentData)).toEqual(sampleEnrichmentData);
		});

		it('should set isEnriching to false', () => {
			startEnrichment(sampleWineInfo);
			setEnrichmentData(sampleEnrichmentData);
			expect(get(isEnriching)).toBe(false);
		});

		it('should clear error', () => {
			setEnrichmentError({ type: 'timeout', userMessage: 'Error', retryable: true });
			setEnrichmentData(sampleEnrichmentData);
			expect(get(enrichmentError)).toBeNull();
		});

		it('should set default source as inference', () => {
			setEnrichmentData(sampleEnrichmentData);
			expect(get(enrichmentSource)).toBe('inference');
		});

		it('should set source as cache when specified', () => {
			setEnrichmentData(sampleEnrichmentData, 'cache');
			expect(get(enrichmentSource)).toBe('cache');
		});

		it('should set source as web_search when specified', () => {
			setEnrichmentData(sampleEnrichmentData, 'web_search');
			expect(get(enrichmentSource)).toBe('web_search');
		});
	});

	describe('setEnrichmentError', () => {
		it('should store the error', () => {
			const error: AgentErrorInfo = { type: 'timeout', userMessage: 'Timed out', retryable: true };
			setEnrichmentError(error);
			expect(get(enrichmentError)).toEqual(error);
		});

		it('should set isEnriching to false', () => {
			startEnrichment(sampleWineInfo);
			setEnrichmentError({ type: 'timeout', userMessage: 'Error', retryable: true });
			expect(get(isEnriching)).toBe(false);
		});

		it('should preserve existing data', () => {
			setEnrichmentData(sampleEnrichmentData);
			setEnrichmentError({ type: 'timeout', userMessage: 'Error', retryable: true });
			expect(get(enrichmentData)).toEqual(sampleEnrichmentData);
		});
	});

	describe('clearEnrichmentError', () => {
		it('should clear the error', () => {
			setEnrichmentError({ type: 'timeout', userMessage: 'Error', retryable: true });
			clearEnrichmentError();
			expect(get(enrichmentError)).toBeNull();
		});

		it('should preserve other state', () => {
			setEnrichmentData(sampleEnrichmentData);
			setEnrichmentError({ type: 'timeout', userMessage: 'Error', retryable: true });
			clearEnrichmentError();
			expect(get(enrichmentData)).toEqual(sampleEnrichmentData);
		});
	});

	describe('clearEnrichment', () => {
		it('should reset all state to initial', () => {
			startEnrichment(sampleWineInfo);
			setEnrichmentData(sampleEnrichmentData);
			clearEnrichment();

			expect(get(isEnriching)).toBe(false);
			expect(get(enrichmentData)).toBeNull();
			expect(get(enrichmentError)).toBeNull();
			expect(get(enrichmentSource)).toBeNull();
			expect(get(enrichmentForWine)).toBeNull();
		});
	});

	describe('resetEnrichment', () => {
		it('should reset all state to initial', () => {
			startEnrichment(sampleWineInfo);
			setEnrichmentData(sampleEnrichmentData);
			resetEnrichment();

			expect(get(isEnriching)).toBe(false);
			expect(get(enrichmentData)).toBeNull();
			expect(get(enrichmentForWine)).toBeNull();
		});
	});

	describe('restoreFromPersistence', () => {
		it('should restore enrichment data', () => {
			restoreFromPersistence({ data: sampleEnrichmentData });
			expect(get(enrichmentData)).toEqual(sampleEnrichmentData);
		});

		it('should not restore isEnriching (prevents orphan loading states)', () => {
			startEnrichment(sampleWineInfo);
			restoreFromPersistence({ data: sampleEnrichmentData });
			expect(get(isEnriching)).toBe(false);
		});

		it('should handle null data', () => {
			restoreFromPersistence({ data: null });
			expect(get(enrichmentData)).toBeNull();
		});
	});

	describe('derived stores', () => {
		describe('hasEnrichmentData', () => {
			it('should be false when no data', () => {
				expect(get(hasEnrichmentData)).toBe(false);
			});

			it('should be true when data exists', () => {
				setEnrichmentData(sampleEnrichmentData);
				expect(get(hasEnrichmentData)).toBe(true);
			});
		});

		describe('section availability', () => {
			it('hasOverview should detect overview', () => {
				expect(get(hasOverview)).toBe(false);
				setEnrichmentData({ overview: 'Test overview' });
				expect(get(hasOverview)).toBe(true);
			});

			it('hasOverview should be false for empty overview', () => {
				setEnrichmentData({ overview: '' });
				expect(get(hasOverview)).toBe(false);
			});

			it('hasGrapeComposition should detect grapes', () => {
				expect(get(hasGrapeComposition)).toBe(false);
				setEnrichmentData({ grapeComposition: [{ grape: 'Merlot', percentage: '100%' }] });
				expect(get(hasGrapeComposition)).toBe(true);
			});

			it('hasGrapeComposition should be false for empty array', () => {
				setEnrichmentData({ grapeComposition: [] });
				expect(get(hasGrapeComposition)).toBe(false);
			});

			it('hasTastingNotes should detect tasting notes', () => {
				expect(get(hasTastingNotes)).toBe(false);
				setEnrichmentData({ tastingNotes: { nose: ['cherry'] } });
				expect(get(hasTastingNotes)).toBe(true);
			});

			it('hasCriticScores should detect critic scores', () => {
				expect(get(hasCriticScores)).toBe(false);
				setEnrichmentData({ criticScores: [{ critic: 'Parker', score: 95 }] });
				expect(get(hasCriticScores)).toBe(true);
			});

			it('hasCriticScores should be false for empty array', () => {
				setEnrichmentData({ criticScores: [] });
				expect(get(hasCriticScores)).toBe(false);
			});

			it('hasDrinkWindow should detect drink window', () => {
				expect(get(hasDrinkWindow)).toBe(false);
				setEnrichmentData({ drinkWindow: { start: 2025, end: 2040 } });
				expect(get(hasDrinkWindow)).toBe(true);
			});

			it('hasFoodPairings should detect food pairings', () => {
				expect(get(hasFoodPairings)).toBe(false);
				setEnrichmentData({ foodPairings: ['lamb', 'beef'] });
				expect(get(hasFoodPairings)).toBe(true);
			});

			it('hasFoodPairings should be false for empty array', () => {
				setEnrichmentData({ foodPairings: [] });
				expect(get(hasFoodPairings)).toBe(false);
			});
		});
	});

	describe('getters', () => {
		describe('getCurrentState', () => {
			it('should return complete state', () => {
				startEnrichment(sampleWineInfo);
				const state = getCurrentState();
				expect(state.isEnriching).toBe(true);
				expect(state.forWine).toEqual(sampleWineInfo);
			});
		});

		describe('getData', () => {
			it('should return null when no data', () => {
				expect(getData()).toBeNull();
			});

			it('should return data when set', () => {
				setEnrichmentData(sampleEnrichmentData);
				expect(getData()).toEqual(sampleEnrichmentData);
			});
		});

		describe('getForWine', () => {
			it('should return null when not enriching', () => {
				expect(getForWine()).toBeNull();
			});

			it('should return wine info when enriching', () => {
				startEnrichment(sampleWineInfo);
				expect(getForWine()).toEqual(sampleWineInfo);
			});
		});
	});
});

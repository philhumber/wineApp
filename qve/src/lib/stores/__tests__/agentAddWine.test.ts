import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
	addWineFlow,
	isInAddWineFlow,
	isAddingWine,
	addWineStep,
	currentEntityType,
	entityMatches,
	selectedEntities,
	existingWineId,
	existingBottleCount,
	hasDuplicate,
	bottleFormData,
	bottleFormStep,
	addWineError,
	addedWineId,
	startAddFlow,
	setAddWineStep,
	setEntityMatches,
	selectMatch,
	selectMatchById,
	createNewEntity,
	setExistingWine,
	clearExistingWine,
	updateBottleFormData,
	setBottleFormStep,
	setEnrichNow,
	startSubmission,
	completeSubmission,
	setSubmissionError,
	cancelAddFlow,
	resetAddWine,
	restoreFromPersistence,
	getCurrentFlow,
	getWineResult,
	getSelectedEntities,
	getBottleFormData,
} from '../agentAddWine';
import { clearState } from '../agentPersistence';
import type { WineIdentificationResult, AgentErrorInfo } from '$lib/agent/types';

// Sample test data
const sampleWineResult: WineIdentificationResult = {
	producer: 'Château Margaux',
	wineName: 'Grand Vin',
	vintage: 2018,
	region: 'Margaux',
	country: 'France',
	type: 'Red',
	grapes: ['Cabernet Sauvignon', 'Merlot'],
};

const sampleEntityMatches = {
	region: [
		{ id: 1, name: 'Margaux', confidence: 0.95 },
		{ id: 2, name: 'Médoc', confidence: 0.7 },
	],
	producer: [
		{ id: 10, name: 'Château Margaux', confidence: 0.98 },
		{ id: 11, name: 'Château Margaux (Second Label)', confidence: 0.6 },
	],
	wine: [
		{ id: 100, name: 'Grand Vin 2018', confidence: 0.95 },
	],
};

describe('agentAddWine', () => {
	beforeEach(() => {
		resetAddWine();
		clearState();
	});

	describe('startAddFlow', () => {
		it('should create a new flow', () => {
			startAddFlow(sampleWineResult);
			expect(get(isInAddWineFlow)).toBe(true);
		});

		it('should store the wine result', () => {
			startAddFlow(sampleWineResult);
			const flow = get(addWineFlow);
			expect(flow?.wineResult).toEqual(sampleWineResult);
		});

		it('should set initial step to confirm', () => {
			startAddFlow(sampleWineResult);
			expect(get(addWineStep)).toBe('confirm');
		});

		it('should initialize empty entity matches', () => {
			startAddFlow(sampleWineResult);
			expect(get(entityMatches)).toEqual({
				region: [],
				producer: [],
				wine: [],
			});
		});

		it('should initialize empty selected entities', () => {
			startAddFlow(sampleWineResult);
			expect(get(selectedEntities)).toEqual({
				region: null,
				producer: null,
				wine: null,
			});
		});

		it('should initialize empty bottle form data', () => {
			startAddFlow(sampleWineResult);
			expect(get(bottleFormData)).toEqual({});
		});

		it('should set bottleFormStep to 1', () => {
			startAddFlow(sampleWineResult);
			expect(get(bottleFormStep)).toBe(1);
		});

		it('should not be submitting', () => {
			startAddFlow(sampleWineResult);
			expect(get(isAddingWine)).toBe(false);
		});

		it('should have no error', () => {
			startAddFlow(sampleWineResult);
			expect(get(addWineError)).toBeNull();
		});

		it('should have no added wine ID', () => {
			startAddFlow(sampleWineResult);
			expect(get(addedWineId)).toBeNull();
		});
	});

	describe('setAddWineStep', () => {
		it('should update the step', () => {
			startAddFlow(sampleWineResult);
			setAddWineStep('entity_matching');
			expect(get(addWineStep)).toBe('entity_matching');
		});

		it('should do nothing if no flow', () => {
			setAddWineStep('entity_matching');
			expect(get(addWineStep)).toBeNull();
		});

		it('should allow all valid steps', () => {
			startAddFlow(sampleWineResult);

			setAddWineStep('confirm');
			expect(get(addWineStep)).toBe('confirm');

			setAddWineStep('entity_matching');
			expect(get(addWineStep)).toBe('entity_matching');

			setAddWineStep('bottle_details');
			expect(get(addWineStep)).toBe('bottle_details');

			setAddWineStep('enrichment');
			expect(get(addWineStep)).toBe('enrichment');

			setAddWineStep('complete');
			expect(get(addWineStep)).toBe('complete');
		});
	});

	describe('entity matching', () => {
		describe('setEntityMatches', () => {
			it('should set region matches', () => {
				startAddFlow(sampleWineResult);
				setEntityMatches('region', sampleEntityMatches.region);

				expect(get(entityMatches).region).toEqual(sampleEntityMatches.region);
				expect(get(currentEntityType)).toBe('region');
			});

			it('should set producer matches', () => {
				startAddFlow(sampleWineResult);
				setEntityMatches('producer', sampleEntityMatches.producer);

				expect(get(entityMatches).producer).toEqual(sampleEntityMatches.producer);
				expect(get(currentEntityType)).toBe('producer');
			});

			it('should set wine matches', () => {
				startAddFlow(sampleWineResult);
				setEntityMatches('wine', sampleEntityMatches.wine);

				expect(get(entityMatches).wine).toEqual(sampleEntityMatches.wine);
				expect(get(currentEntityType)).toBe('wine');
			});

			it('should preserve other entity matches', () => {
				startAddFlow(sampleWineResult);
				setEntityMatches('region', sampleEntityMatches.region);
				setEntityMatches('producer', sampleEntityMatches.producer);

				expect(get(entityMatches).region).toEqual(sampleEntityMatches.region);
				expect(get(entityMatches).producer).toEqual(sampleEntityMatches.producer);
			});

			it('should do nothing if no flow', () => {
				setEntityMatches('region', sampleEntityMatches.region);
				expect(get(entityMatches).region).toEqual([]);
			});
		});

		describe('selectMatch', () => {
			it('should select a region match', () => {
				startAddFlow(sampleWineResult);
				setEntityMatches('region', sampleEntityMatches.region);
				selectMatch('region', sampleEntityMatches.region[0]);

				expect(get(selectedEntities).region).toEqual({
					id: 1,
					name: 'Margaux',
				});
			});

			it('should select a producer match', () => {
				startAddFlow(sampleWineResult);
				setEntityMatches('producer', sampleEntityMatches.producer);
				selectMatch('producer', sampleEntityMatches.producer[0]);

				expect(get(selectedEntities).producer).toEqual({
					id: 10,
					name: 'Château Margaux',
				});
			});

			it('should clear current entity type after selection', () => {
				startAddFlow(sampleWineResult);
				setEntityMatches('region', sampleEntityMatches.region);
				selectMatch('region', sampleEntityMatches.region[0]);

				expect(get(currentEntityType)).toBeNull();
			});

			it('should preserve other selected entities', () => {
				startAddFlow(sampleWineResult);
				setEntityMatches('region', sampleEntityMatches.region);
				selectMatch('region', sampleEntityMatches.region[0]);
				setEntityMatches('producer', sampleEntityMatches.producer);
				selectMatch('producer', sampleEntityMatches.producer[0]);

				expect(get(selectedEntities).region).toEqual({ id: 1, name: 'Margaux' });
				expect(get(selectedEntities).producer).toEqual({ id: 10, name: 'Château Margaux' });
			});
		});

		describe('selectMatchById', () => {
			it('should select a match by ID', () => {
				startAddFlow(sampleWineResult);
				setEntityMatches('region', sampleEntityMatches.region);
				selectMatchById('region', 2);

				expect(get(selectedEntities).region).toEqual({
					id: 2,
					name: 'Médoc',
				});
			});

			it('should do nothing if ID not found', () => {
				startAddFlow(sampleWineResult);
				setEntityMatches('region', sampleEntityMatches.region);
				selectMatchById('region', 999);

				expect(get(selectedEntities).region).toBeNull();
			});

			it('should do nothing if no flow', () => {
				selectMatchById('region', 1);
				expect(get(selectedEntities).region).toBeNull();
			});
		});

		describe('createNewEntity', () => {
			it('should store new entity name', () => {
				startAddFlow(sampleWineResult);
				createNewEntity('region', 'New Region');

				const flow = get(addWineFlow);
				expect(flow?.newEntities.region).toBe('New Region');
			});

			it('should clear current entity type', () => {
				startAddFlow(sampleWineResult);
				setEntityMatches('region', sampleEntityMatches.region);
				createNewEntity('region', 'New Region');

				expect(get(currentEntityType)).toBeNull();
			});

			it('should handle multiple new entities', () => {
				startAddFlow(sampleWineResult);
				createNewEntity('region', 'New Region');
				createNewEntity('producer', 'New Producer');

				const flow = get(addWineFlow);
				expect(flow?.newEntities.region).toBe('New Region');
				expect(flow?.newEntities.producer).toBe('New Producer');
			});

			it('should do nothing if no flow', () => {
				createNewEntity('region', 'New Region');
				expect(get(addWineFlow)).toBeNull();
			});
		});
	});

	describe('duplicate handling', () => {
		describe('setExistingWine', () => {
			it('should set existing wine ID', () => {
				startAddFlow(sampleWineResult);
				setExistingWine(42, 3);

				expect(get(existingWineId)).toBe(42);
			});

			it('should set existing bottle count', () => {
				startAddFlow(sampleWineResult);
				setExistingWine(42, 3);

				expect(get(existingBottleCount)).toBe(3);
			});

			it('should set hasDuplicate to true', () => {
				startAddFlow(sampleWineResult);
				setExistingWine(42, 3);

				expect(get(hasDuplicate)).toBe(true);
			});

			it('should do nothing if no flow', () => {
				setExistingWine(42, 3);
				expect(get(existingWineId)).toBeNull();
			});
		});

		describe('clearExistingWine', () => {
			it('should clear existing wine ID', () => {
				startAddFlow(sampleWineResult);
				setExistingWine(42, 3);
				clearExistingWine();

				expect(get(existingWineId)).toBeNull();
			});

			it('should clear bottle count', () => {
				startAddFlow(sampleWineResult);
				setExistingWine(42, 3);
				clearExistingWine();

				expect(get(existingBottleCount)).toBe(0);
			});

			it('should set hasDuplicate to false', () => {
				startAddFlow(sampleWineResult);
				setExistingWine(42, 3);
				clearExistingWine();

				expect(get(hasDuplicate)).toBe(false);
			});
		});
	});

	describe('bottle form', () => {
		describe('updateBottleFormData', () => {
			it('should update form data', () => {
				startAddFlow(sampleWineResult);
				updateBottleFormData({ bottleSize: '750ml', storageLocation: 'Cellar A' });

				expect(get(bottleFormData)).toEqual({ bottleSize: '750ml', storageLocation: 'Cellar A' });
			});

			it('should merge with existing data', () => {
				startAddFlow(sampleWineResult);
				updateBottleFormData({ bottleSize: '750ml' });
				updateBottleFormData({ storageLocation: 'Cellar A' });

				expect(get(bottleFormData)).toEqual({ bottleSize: '750ml', storageLocation: 'Cellar A' });
			});

			it('should overwrite existing fields', () => {
				startAddFlow(sampleWineResult);
				updateBottleFormData({ bottleSize: '750ml' });
				updateBottleFormData({ bottleSize: '1500ml' });

				expect(get(bottleFormData).bottleSize).toBe('1500ml');
			});

			it('should do nothing if no flow', () => {
				updateBottleFormData({ bottleSize: '750ml' });
				expect(get(bottleFormData)).toEqual({});
			});
		});

		describe('setBottleFormStep', () => {
			it('should set form step to 1', () => {
				startAddFlow(sampleWineResult);
				setBottleFormStep(2);
				setBottleFormStep(1);

				expect(get(bottleFormStep)).toBe(1);
			});

			it('should set form step to 2', () => {
				startAddFlow(sampleWineResult);
				setBottleFormStep(2);

				expect(get(bottleFormStep)).toBe(2);
			});

			it('should do nothing if no flow', () => {
				setBottleFormStep(2);
				expect(get(bottleFormStep)).toBe(1);
			});
		});
	});

	describe('enrichment choice', () => {
		describe('setEnrichNow', () => {
			it('should set enrichNow to true', () => {
				startAddFlow(sampleWineResult);
				setEnrichNow(true);

				const flow = get(addWineFlow);
				expect(flow?.enrichNow).toBe(true);
			});

			it('should set enrichNow to false', () => {
				startAddFlow(sampleWineResult);
				setEnrichNow(true);
				setEnrichNow(false);

				const flow = get(addWineFlow);
				expect(flow?.enrichNow).toBe(false);
			});

			it('should do nothing if no flow', () => {
				setEnrichNow(true);
				expect(get(addWineFlow)).toBeNull();
			});
		});
	});

	describe('submission', () => {
		describe('startSubmission', () => {
			it('should set isSubmitting to true', () => {
				startAddFlow(sampleWineResult);
				startSubmission();

				expect(get(isAddingWine)).toBe(true);
			});

			it('should clear error', () => {
				startAddFlow(sampleWineResult);
				setSubmissionError({ type: 'server_error', userMessage: 'Error', retryable: true });
				startSubmission();

				expect(get(addWineError)).toBeNull();
			});

			it('should do nothing if no flow', () => {
				startSubmission();
				expect(get(isAddingWine)).toBe(false);
			});
		});

		describe('completeSubmission', () => {
			it('should set isSubmitting to false', () => {
				startAddFlow(sampleWineResult);
				startSubmission();
				completeSubmission(123);

				expect(get(isAddingWine)).toBe(false);
			});

			it('should store added wine ID', () => {
				startAddFlow(sampleWineResult);
				startSubmission();
				completeSubmission(123);

				expect(get(addedWineId)).toBe(123);
			});

			it('should set step to complete', () => {
				startAddFlow(sampleWineResult);
				startSubmission();
				completeSubmission(123);

				expect(get(addWineStep)).toBe('complete');
			});

			it('should do nothing if no flow', () => {
				completeSubmission(123);
				expect(get(addedWineId)).toBeNull();
			});
		});

		describe('setSubmissionError', () => {
			it('should store the error', () => {
				startAddFlow(sampleWineResult);
				const error: AgentErrorInfo = {
					type: 'server_error',
					userMessage: 'Failed to add wine',
					retryable: true,
				};
				setSubmissionError(error);

				expect(get(addWineError)).toEqual(error);
			});

			it('should set isSubmitting to false', () => {
				startAddFlow(sampleWineResult);
				startSubmission();
				setSubmissionError({ type: 'server_error', userMessage: 'Error', retryable: true });

				expect(get(isAddingWine)).toBe(false);
			});

			it('should do nothing if no flow', () => {
				setSubmissionError({ type: 'server_error', userMessage: 'Error', retryable: true });
				expect(get(addWineError)).toBeNull();
			});
		});
	});

	describe('cancelAddFlow', () => {
		it('should clear the flow', () => {
			startAddFlow(sampleWineResult);
			cancelAddFlow();

			expect(get(isInAddWineFlow)).toBe(false);
			expect(get(addWineFlow)).toBeNull();
		});

		it('should reset all derived stores', () => {
			startAddFlow(sampleWineResult);
			setEntityMatches('region', sampleEntityMatches.region);
			selectMatch('region', sampleEntityMatches.region[0]);
			updateBottleFormData({ bottleSize: '750ml' });
			setExistingWine(42, 3);
			cancelAddFlow();

			expect(get(addWineStep)).toBeNull();
			expect(get(entityMatches)).toEqual({ region: [], producer: [], wine: [] });
			expect(get(selectedEntities)).toEqual({ region: null, producer: null, wine: null });
			expect(get(existingWineId)).toBeNull();
			expect(get(bottleFormData)).toEqual({});
		});
	});

	describe('resetAddWine', () => {
		it('should clear the flow', () => {
			startAddFlow(sampleWineResult);
			resetAddWine();

			expect(get(isInAddWineFlow)).toBe(false);
		});
	});

	describe('restoreFromPersistence', () => {
		it('should reset to initial state (complex flow not restored)', () => {
			startAddFlow(sampleWineResult);
			restoreFromPersistence({ state: null });

			expect(get(isInAddWineFlow)).toBe(false);
		});

		it('should handle null state', () => {
			restoreFromPersistence({ state: null });
			expect(get(addWineFlow)).toBeNull();
		});
	});

	describe('derived stores', () => {
		describe('isInAddWineFlow', () => {
			it('should be false when no flow', () => {
				expect(get(isInAddWineFlow)).toBe(false);
			});

			it('should be true when flow exists', () => {
				startAddFlow(sampleWineResult);
				expect(get(isInAddWineFlow)).toBe(true);
			});
		});

		describe('isAddingWine', () => {
			it('should be false when not submitting', () => {
				startAddFlow(sampleWineResult);
				expect(get(isAddingWine)).toBe(false);
			});

			it('should be true when submitting', () => {
				startAddFlow(sampleWineResult);
				startSubmission();
				expect(get(isAddingWine)).toBe(true);
			});

			it('should be false when no flow', () => {
				expect(get(isAddingWine)).toBe(false);
			});
		});

		describe('hasDuplicate', () => {
			it('should be false when no existing wine', () => {
				startAddFlow(sampleWineResult);
				expect(get(hasDuplicate)).toBe(false);
			});

			it('should be true when existing wine set', () => {
				startAddFlow(sampleWineResult);
				setExistingWine(42, 3);
				expect(get(hasDuplicate)).toBe(true);
			});

			it('should be false when no flow', () => {
				expect(get(hasDuplicate)).toBe(false);
			});
		});
	});

	describe('getters', () => {
		describe('getCurrentFlow', () => {
			it('should return null when no flow', () => {
				expect(getCurrentFlow()).toBeNull();
			});

			it('should return flow when exists', () => {
				startAddFlow(sampleWineResult);
				const flow = getCurrentFlow();
				expect(flow?.wineResult).toEqual(sampleWineResult);
			});
		});

		describe('getWineResult', () => {
			it('should return null when no flow', () => {
				expect(getWineResult()).toBeNull();
			});

			it('should return wine result when flow exists', () => {
				startAddFlow(sampleWineResult);
				expect(getWineResult()).toEqual(sampleWineResult);
			});
		});

		describe('getSelectedEntities', () => {
			it('should return null when no flow', () => {
				expect(getSelectedEntities()).toBeNull();
			});

			it('should return selected entities when flow exists', () => {
				startAddFlow(sampleWineResult);
				setEntityMatches('region', sampleEntityMatches.region);
				selectMatch('region', sampleEntityMatches.region[0]);

				const entities = getSelectedEntities();
				expect(entities?.region).toEqual({ id: 1, name: 'Margaux' });
			});
		});

		describe('getBottleFormData', () => {
			it('should return empty object when no flow', () => {
				expect(getBottleFormData()).toEqual({});
			});

			it('should return form data when flow exists', () => {
				startAddFlow(sampleWineResult);
				updateBottleFormData({ bottleSize: '750ml' });
				expect(getBottleFormData()).toEqual({ bottleSize: '750ml' });
			});
		});
	});
});

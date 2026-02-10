import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
	isIdentifying,
	identificationResult,
	identificationError,
	identificationConfidence,
	streamingFields,
	augmentationContext,
	hasAugmentationContext,
	pendingNewSearch,
	lastImageData,
	inputType,
	isEscalating,
	escalationTier,
	hasResult,
	isStreaming,
	isLowConfidence,
	startIdentification,
	setResult,
	setError,
	clearError,
	updateStreamingField,
	completeStreamingField,
	clearStreamingFields,
	setAugmentationContext,
	clearAugmentationContext,
	setPendingNewSearch,
	setLastImageData,
	clearLastImageData,
	startEscalation,
	completeEscalation,
	clearIdentification,
	resetIdentification,
	getCurrentState,
	getResult,
	getAugmentationContext,
} from '../agentIdentification';
import { clearState } from '../agentPersistence';

describe('agentIdentification', () => {
	beforeEach(() => {
		resetIdentification();
		clearState();
	});

	describe('startIdentification', () => {
		it('should set isIdentifying to true', () => {
			startIdentification('text');
			expect(get(isIdentifying)).toBe(true);
		});

		it('should set input type', () => {
			startIdentification('image');
			expect(get(inputType)).toBe('image');
		});

		it('should clear previous error', () => {
			setError({ type: 'timeout', userMessage: 'Test', retryable: true });
			startIdentification('text');
			expect(get(identificationError)).toBeNull();
		});

		it('should clear streaming fields', () => {
			updateStreamingField('producer', 'Test', true);
			startIdentification('text');
			expect(get(streamingFields).size).toBe(0);
		});

		it('should reset escalation state', () => {
			startEscalation(2);
			startIdentification('text');
			expect(get(isEscalating)).toBe(false);
			expect(get(escalationTier)).toBe(1);
		});
	});

	describe('setResult', () => {
		it('should store the result', () => {
			const result = {
				producer: 'Test Producer',
				wineName: 'Test Wine',
				vintage: 2020,
			};
			setResult(result, 0.9);

			expect(get(identificationResult)).toEqual(result);
			expect(get(hasResult)).toBe(true);
			expect(get(identificationConfidence)).toBe(0.9);
		});

		it('should set isIdentifying to false', () => {
			startIdentification('text');
			setResult({ producer: 'Test', wineName: 'Wine' }, 0.8);
			expect(get(isIdentifying)).toBe(false);
		});

		it('should clear error', () => {
			setError({ type: 'timeout', userMessage: 'Error', retryable: true });
			setResult({ producer: 'Test', wineName: 'Wine' });
			expect(get(identificationError)).toBeNull();
		});

		it('should clear streaming fields', () => {
			updateStreamingField('producer', 'Testing', true);
			setResult({ producer: 'Test', wineName: 'Wine' });
			expect(get(streamingFields).size).toBe(0);
		});

		it('should handle confidence being undefined', () => {
			setResult({ producer: 'Test', wineName: 'Wine' });
			expect(get(identificationConfidence)).toBeNull();
		});
	});

	describe('setError', () => {
		it('should store error info', () => {
			const error = {
				type: 'timeout',
				userMessage: 'Timed out',
				retryable: true,
				supportRef: 'ERR-123',
			};
			setError(error);

			expect(get(identificationError)).toEqual(error);
		});

		it('should set isIdentifying to false', () => {
			startIdentification('text');
			setError({ type: 'timeout', userMessage: 'Error', retryable: true });
			expect(get(isIdentifying)).toBe(false);
		});

		it('should clear streaming fields', () => {
			updateStreamingField('producer', 'Test', true);
			setError({ type: 'timeout', userMessage: 'Error', retryable: true });
			expect(get(streamingFields).size).toBe(0);
		});

		it('should stop escalation', () => {
			startEscalation(2);
			setError({ type: 'timeout', userMessage: 'Error', retryable: true });
			expect(get(isEscalating)).toBe(false);
		});
	});

	describe('clearError', () => {
		it('should clear error state', () => {
			setError({ type: 'timeout', userMessage: 'Error', retryable: true });
			clearError();
			expect(get(identificationError)).toBeNull();
		});
	});

	describe('streaming fields', () => {
		it('should update streaming field', () => {
			updateStreamingField('producer', 'Châte', true);

			const fields = get(streamingFields);
			expect(fields.get('producer')).toEqual({ value: 'Châte', isTyping: true });
		});

		it('should complete streaming field', () => {
			updateStreamingField('producer', 'Château', true);
			completeStreamingField('producer');

			const fields = get(streamingFields);
			expect(fields.get('producer')?.isTyping).toBe(false);
		});

		it('should clear all streaming fields', () => {
			updateStreamingField('producer', 'Test', true);
			updateStreamingField('wineName', 'Wine', true);
			clearStreamingFields();

			expect(get(streamingFields).size).toBe(0);
		});

		it('should not error when completing non-existent field', () => {
			completeStreamingField('nonexistent');
			// Should not throw
		});
	});

	describe('isStreaming derived', () => {
		it('should be true when any field is typing', () => {
			updateStreamingField('producer', 'Test', true);
			expect(get(isStreaming)).toBe(true);
		});

		it('should be false when no fields are typing', () => {
			updateStreamingField('producer', 'Test', false);
			expect(get(isStreaming)).toBe(false);
		});

		it('should be false when no fields exist', () => {
			expect(get(isStreaming)).toBe(false);
		});
	});

	describe('augmentationContext', () => {
		it('should store augmentation context', () => {
			setAugmentationContext({ originalInput: 'test input' });
			expect(get(hasAugmentationContext)).toBe(true);
			expect(get(augmentationContext)?.originalInput).toBe('test input');
		});

		it('should store conversation history', () => {
			setAugmentationContext({
				originalInput: 'test',
				conversationHistory: ['msg1', 'msg2'],
			});
			expect(get(augmentationContext)?.conversationHistory).toEqual(['msg1', 'msg2']);
		});

		it('should clear augmentation context', () => {
			setAugmentationContext({ originalInput: 'test' });
			clearAugmentationContext();
			expect(get(hasAugmentationContext)).toBe(false);
		});
	});

	describe('pendingNewSearch', () => {
		it('should store pending search text', () => {
			setPendingNewSearch('new wine search');
			expect(get(pendingNewSearch)).toBe('new wine search');
		});

		it('should clear pending search', () => {
			setPendingNewSearch('test');
			setPendingNewSearch(null);
			expect(get(pendingNewSearch)).toBeNull();
		});
	});

	describe('image data', () => {
		it('should store image data', () => {
			setLastImageData('base64data', 'image/jpeg');

			const data = get(lastImageData);
			expect(data?.data).toBe('base64data');
			expect(data?.mimeType).toBe('image/jpeg');
		});

		it('should clear image data', () => {
			setLastImageData('test', 'image/png');
			clearLastImageData();
			expect(get(lastImageData)).toBeNull();
		});
	});

	describe('escalation', () => {
		it('should start escalation with tier', () => {
			startEscalation(2);
			expect(get(isEscalating)).toBe(true);
			expect(get(escalationTier)).toBe(2);
		});

		it('should complete escalation', () => {
			startEscalation(2);
			completeEscalation();
			expect(get(isEscalating)).toBe(false);
		});

		it('should preserve tier after completion', () => {
			startEscalation(3);
			completeEscalation();
			expect(get(escalationTier)).toBe(3);
		});
	});

	describe('isLowConfidence derived', () => {
		it('should be true when confidence < 0.7', () => {
			setResult({ producer: 'Test', wineName: 'Wine' }, 0.5);
			expect(get(isLowConfidence)).toBe(true);
		});

		it('should be false when confidence >= 0.7', () => {
			setResult({ producer: 'Test', wineName: 'Wine' }, 0.9);
			expect(get(isLowConfidence)).toBe(false);
		});

		it('should be false when confidence is null', () => {
			expect(get(isLowConfidence)).toBe(false);
		});

		it('should be true at exactly 0.69', () => {
			setResult({ producer: 'Test', wineName: 'Wine' }, 0.69);
			expect(get(isLowConfidence)).toBe(true);
		});
	});

	describe('clearIdentification', () => {
		it('should clear result but preserve context if requested', () => {
			setResult({ producer: 'Test', wineName: 'Wine' }, 0.8);
			setAugmentationContext({ originalInput: 'keep this' });
			setLastImageData('imagedata', 'image/jpeg');

			clearIdentification(true); // preserveContext = true

			expect(get(hasResult)).toBe(false);
			expect(get(hasAugmentationContext)).toBe(true);
			expect(get(lastImageData)).not.toBeNull();
		});

		it('should clear everything when preserveContext is false', () => {
			setResult({ producer: 'Test', wineName: 'Wine' }, 0.8);
			setAugmentationContext({ originalInput: 'test' });
			setLastImageData('data', 'image/png');

			clearIdentification(false);

			expect(get(hasResult)).toBe(false);
			expect(get(hasAugmentationContext)).toBe(false);
			expect(get(lastImageData)).toBeNull();
		});

		it('should clear isIdentifying flag', () => {
			startIdentification('text');
			clearIdentification();
			expect(get(isIdentifying)).toBe(false);
		});
	});

	describe('resetIdentification', () => {
		it('should reset all state to initial values', () => {
			setResult({ producer: 'Test', wineName: 'Wine' }, 0.9);
			setAugmentationContext({ originalInput: 'test' });
			setPendingNewSearch('search');
			setLastImageData('data', 'image/png');
			startEscalation(2);

			resetIdentification();

			expect(get(hasResult)).toBe(false);
			expect(get(hasAugmentationContext)).toBe(false);
			expect(get(pendingNewSearch)).toBeNull();
			expect(get(lastImageData)).toBeNull();
			expect(get(isEscalating)).toBe(false);
			expect(get(escalationTier)).toBe(1);
		});
	});

	describe('getters', () => {
		it('getCurrentState should return full state', () => {
			setResult({ producer: 'Test', wineName: 'Wine' }, 0.85);
			const state = getCurrentState();

			expect(state.result?.producer).toBe('Test');
			expect(state.confidence).toBe(0.85);
		});

		it('getResult should return result directly', () => {
			const result = { producer: 'Test', wineName: 'Wine' };
			setResult(result);

			expect(getResult()).toEqual(result);
		});

		it('getAugmentationContext should return context directly', () => {
			const context = { originalInput: 'test' };
			setAugmentationContext(context);

			expect(getAugmentationContext()).toEqual(context);
		});
	});

	describe('edge cases (Phase 0 stabilization)', () => {
		const mockResult = {
			producer: 'Château Margaux',
			wineName: 'Grand Vin',
			vintage: 2018,
			region: 'Margaux',
			country: 'France',
		};

		it('should handle startIdentification called twice rapidly', () => {
			startIdentification('text');
			startIdentification('text');

			expect(get(isIdentifying)).toBe(true);
			expect(get(inputType)).toBe('text');
			expect(get(streamingFields).size).toBe(0);
			expect(get(identificationError)).toBeNull();
		});

		it('should handle setResult with zero confidence', () => {
			setResult(mockResult, 0);

			expect(get(identificationConfidence)).toBe(0);
			expect(get(hasResult)).toBe(true);
			expect(get(isLowConfidence)).toBe(true);
		});

		it('should handle setResult with confidence at 0.7 boundary', () => {
			setResult(mockResult, 0.7);

			expect(get(identificationConfidence)).toBe(0.7);
			// Threshold is < 0.7, so exactly 0.7 is NOT low confidence
			expect(get(isLowConfidence)).toBe(false);
		});

		it('should clear everything during active streaming', () => {
			// Set up active streaming state
			updateStreamingField('producer', 'Châte', true);
			updateStreamingField('wineName', 'Grand', true);
			startIdentification('text');

			// Verify streaming fields are cleared by startIdentification
			expect(get(streamingFields).size).toBe(0);

			// Set up streaming again, then clear
			updateStreamingField('producer', 'Testing', true);
			updateStreamingField('wineName', 'Wine', true);
			expect(get(isStreaming)).toBe(true);

			clearIdentification(false);

			expect(get(streamingFields).size).toBe(0);
			expect(get(isStreaming)).toBe(false);
			expect(get(isIdentifying)).toBe(false);
			expect(get(hasResult)).toBe(false);
			expect(get(identificationError)).toBeNull();
		});

		it('should clear isEscalating when setResult is called (safety net)', () => {
			startEscalation(2);
			expect(get(isEscalating)).toBe(true);

			// setResult clears isEscalating as safety net (Phase 4 change)
			setResult(mockResult, 50);

			expect(get(isEscalating)).toBe(false);
			expect(get(hasResult)).toBe(true);
		});
	});
});

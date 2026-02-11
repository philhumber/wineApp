/**
 * processSSEStream Tests (Phase 0 Stabilization)
 *
 * Tests SSE stream parsing through the public identifyTextStream API.
 * Mocks fetch to return ReadableStream responses and verifies
 * event parsing, field callbacks, error handling, and abort support.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock fetch globally so API client constructor doesn't fail
vi.stubGlobal('fetch', vi.fn());

import { api } from '../client';
import { AgentError } from '../types';

/**
 * Create a mock Response with SSE-formatted ReadableStream body.
 */
function createMockSSEResponse(events: Array<{ event: string; data: unknown }>): Response {
	const encoder = new TextEncoder();
	const chunks = events.map(
		(e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`
	);

	let index = 0;
	const stream = new ReadableStream({
		pull(controller) {
			if (index < chunks.length) {
				controller.enqueue(encoder.encode(chunks[index++]));
			} else {
				controller.close();
			}
		},
	});

	return new Response(stream, {
		status: 200,
		headers: { 'Content-Type': 'text/event-stream' },
	});
}

describe('processSSEStream via identifyTextStream', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should parse field events from SSE stream', async () => {
		const fieldCalls: Array<{ field: string; value: unknown }> = [];

		const mockResult = {
			intent: 'add',
			parsed: {
				producer: 'Château Margaux',
				wineName: 'Grand Vin',
				vintage: '2018',
				region: 'Margaux',
				appellation: null,
				country: 'France',
				wineType: 'Red',
				grapes: [],
				confidence: 0.95,
			},
			confidence: 0.95,
			action: 'auto_populate',
			candidates: [],
			inputType: 'text',
		};

		const response = createMockSSEResponse([
			{ event: 'field', data: { field: 'producer', value: 'Château Margaux' } },
			{ event: 'field', data: { field: 'wineName', value: 'Grand Vin' } },
			{ event: 'result', data: mockResult },
			{ event: 'done', data: {} },
		]);

		vi.mocked(fetch).mockResolvedValue(response);

		const onField = vi.fn((field: string, value: unknown) => {
			fieldCalls.push({ field, value });
		});

		await api.identifyTextStream('chateau margaux', onField);

		expect(onField).toHaveBeenCalledTimes(2);
		expect(fieldCalls[0]).toEqual({ field: 'producer', value: 'Château Margaux' });
		expect(fieldCalls[1]).toEqual({ field: 'wineName', value: 'Grand Vin' });
	});

	it('should parse result event and resolve promise', async () => {
		const mockResult = {
			intent: 'add',
			parsed: {
				producer: 'Penfolds',
				wineName: 'Grange',
				vintage: '2019',
				region: 'Barossa Valley',
				appellation: null,
				country: 'Australia',
				wineType: 'Red',
				grapes: [],
				confidence: 0.92,
			},
			confidence: 0.92,
			action: 'auto_populate',
			candidates: [],
			inputType: 'text',
		};

		const response = createMockSSEResponse([
			{ event: 'field', data: { field: 'producer', value: 'Penfolds' } },
			{ event: 'result', data: mockResult },
			{ event: 'done', data: {} },
		]);

		vi.mocked(fetch).mockResolvedValue(response);

		const result = await api.identifyTextStream('penfolds grange');

		expect(result).toEqual(mockResult);
		expect(result.parsed.producer).toBe('Penfolds');
		expect(result.confidence).toBe(0.92);
	});

	it('should handle error event by throwing AgentError', async () => {
		const response = createMockSSEResponse([
			{ event: 'field', data: { field: 'producer', value: 'Test' } },
			{
				event: 'error',
				data: {
					type: 'timeout',
					message: 'Request timed out',
					retryable: true,
					supportRef: 'ERR-12345678',
				},
			},
			{ event: 'done', data: {} },
		]);

		vi.mocked(fetch).mockResolvedValue(response);

		let caughtError: unknown;
		try {
			await api.identifyTextStream('test wine');
		} catch (e) {
			caughtError = e;
		}

		expect(caughtError).toBeInstanceOf(AgentError);
		expect(AgentError.isAgentError(caughtError)).toBe(true);
		if (AgentError.isAgentError(caughtError)) {
			expect(caughtError.type).toBe('timeout');
			expect(caughtError.retryable).toBe(true);
		}
	});

	it('should forward events to onEvent callback', async () => {
		const mockResult = {
			intent: 'add',
			parsed: {
				producer: 'Test',
				wineName: 'Wine',
				vintage: null,
				region: null,
				appellation: null,
				country: null,
				wineType: null,
				grapes: [],
				confidence: 0.8,
			},
			confidence: 0.8,
			action: 'auto_populate',
			candidates: [],
			inputType: 'text',
		};

		const response = createMockSSEResponse([
			{ event: 'field', data: { field: 'producer', value: 'Test' } },
			{ event: 'result', data: mockResult },
			{ event: 'done', data: {} },
		]);

		vi.mocked(fetch).mockResolvedValue(response);

		const onEvent = vi.fn();
		const onField = vi.fn();

		await api.identifyTextStream('test', onField, onEvent);

		// onEvent should be called for each SSE event: field, result, done
		expect(onEvent).toHaveBeenCalledTimes(3);
		expect(onEvent).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'field' })
		);
		expect(onEvent).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'result' })
		);
		expect(onEvent).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'done' })
		);
	});

	it('should handle AbortSignal', async () => {
		const controller = new AbortController();

		// Create a stream that will hang (never close)
		const stream = new ReadableStream({
			start() {
				// Don't enqueue anything or close - simulate a hung connection
			},
			cancel() {
				// Stream was cancelled
			},
		});

		const response = new Response(stream, {
			status: 200,
			headers: { 'Content-Type': 'text/event-stream' },
		});

		vi.mocked(fetch).mockResolvedValue(response);

		// Abort immediately
		controller.abort();

		// AbortError should be thrown (as DOMException)
		await expect(
			api.identifyTextStream('test', undefined, undefined, controller.signal)
		).rejects.toThrow();
	});
});

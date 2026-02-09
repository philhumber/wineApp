import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateUUID } from '../uuid';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('generateUUID', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('uses crypto.randomUUID when available', () => {
		const id = generateUUID();
		// test-setup.ts mocks randomUUID to return 'test-uuid-*'
		expect(id).toMatch(/^test-uuid-/);
	});

	it('falls back to getRandomValues when randomUUID is unavailable (HTTP context)', () => {
		// Simulate non-secure context: randomUUID is undefined
		const original = crypto.randomUUID;
		vi.stubGlobal('crypto', {
			...crypto,
			randomUUID: undefined,
			getRandomValues: crypto.getRandomValues.bind(crypto)
		});

		const id = generateUUID();
		expect(id).toMatch(UUID_REGEX);

		vi.stubGlobal('crypto', { ...crypto, randomUUID: original });
	});

	it('falls back to Math.random when crypto is completely unavailable', () => {
		const originalCrypto = globalThis.crypto;
		vi.stubGlobal('crypto', undefined);

		const id = generateUUID();
		expect(id).toMatch(UUID_REGEX);

		vi.stubGlobal('crypto', originalCrypto);
	});
});

/**
 * Image Compression Tests (WIN-237)
 *
 * Verifies that compressImageForIdentification:
 * 1. Limits max dimensions to 800x800 (not 1200x1200)
 * 2. Prefers off-main-thread path (createImageBitmap + OffscreenCanvas) when available
 * 3. Falls back to main-thread canvas when Worker APIs unavailable
 * 4. Validates file types correctly
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock fetch globally so API client constructor doesn't fail
vi.stubGlobal('fetch', vi.fn());

import { api } from '../client';

// Helper to create a mock File
function createMockFile(name: string, type: string, size = 1024): File {
	const buffer = new ArrayBuffer(size);
	return new File([buffer], name, { type });
}

/** Sets up main-thread mocks (FileReader, Image, canvas) and returns tracking objects */
function setupMainThreadMocks(imgWidth: number, imgHeight: number) {
	let canvasWidth = 0;
	let canvasHeight = 0;
	let fileReaderOnload: ((e: unknown) => void) | null = null;

	const readAsDataURL = vi.fn();
	const drawImage = vi.fn();
	const toDataURL = vi.fn(() => 'data:image/jpeg;base64,/9j/fakedata');

	// FileReader as a class mock
	vi.stubGlobal(
		'FileReader',
		class {
			onload: ((e: unknown) => void) | null = null;
			onerror: (() => void) | null = null;
			readAsDataURL = (...args: unknown[]) => {
				readAsDataURL(...args);
				fileReaderOnload = this.onload;
			};
		}
	);

	// Image as a class mock
	vi.stubGlobal(
		'Image',
		class {
			width = imgWidth;
			height = imgHeight;
			onload: (() => void) | null = null;
			onerror: (() => void) | null = null;
			set src(_v: string) {
				setTimeout(() => this.onload?.(), 0);
			}
		}
	);

	// Canvas mock — track call order for white-fill-before-draw assertion
	const callOrder: string[] = [];
	const fillRect = vi.fn((..._args: unknown[]) => { callOrder.push('fillRect'); });
	const mockCtx = {
		drawImage: (...args: unknown[]) => { callOrder.push('drawImage'); drawImage(...args); },
		fillRect,
		fillStyle: '',
	};
	const mockCanvas = {
		set width(v: number) { canvasWidth = v; },
		get width() { return canvasWidth; },
		set height(v: number) { canvasHeight = v; },
		get height() { return canvasHeight; },
		getContext: vi.fn(() => mockCtx),
		toDataURL,
	};
	vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as unknown as HTMLElement);

	return {
		get canvasWidth() { return canvasWidth; },
		get canvasHeight() { return canvasHeight; },
		readAsDataURL,
		drawImage,
		fillRect,
		mockCtx,
		callOrder,
		toDataURL,
		triggerFileReaderLoad(data = 'data:image/jpeg;base64,abc') {
			fileReaderOnload?.({ target: { result: data } });
		},
	};
}

describe('compressImageForIdentification (WIN-237)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default: no off-main-thread APIs
		vi.stubGlobal('createImageBitmap', undefined);
		vi.stubGlobal('OffscreenCanvas', undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('max dimensions', () => {
		it('should use 800px max (not 1200px) in the main-thread fallback path', async () => {
			const mocks = setupMainThreadMocks(2000, 1500);
			const file = createMockFile('test.jpg', 'image/jpeg');

			const promise = api.compressImageForIdentification(file);

			await vi.waitFor(() => expect(mocks.readAsDataURL).toHaveBeenCalled());
			mocks.triggerFileReaderLoad();
			await vi.waitFor(() => expect(mocks.drawImage).toHaveBeenCalled());

			const result = await promise;

			// 2000x1500 scaled to 800x max: ratio = min(800/2000, 800/1500) = 0.4
			// → 800x600
			expect(mocks.canvasWidth).toBe(800);
			expect(mocks.canvasHeight).toBe(600);
			expect(result.mimeType).toBe('image/jpeg');
		});

		it('should not resize images already within 800px', async () => {
			const mocks = setupMainThreadMocks(640, 480);
			const file = createMockFile('small.jpg', 'image/jpeg');

			const promise = api.compressImageForIdentification(file);

			await vi.waitFor(() => expect(mocks.readAsDataURL).toHaveBeenCalled());
			mocks.triggerFileReaderLoad();
			await vi.waitFor(() => expect(mocks.drawImage).toHaveBeenCalled());

			const result = await promise;

			expect(mocks.canvasWidth).toBe(640);
			expect(mocks.canvasHeight).toBe(480);
			expect(result.mimeType).toBe('image/jpeg');
		});
	});

	describe('off-main-thread path', () => {
		it('should use createImageBitmap + OffscreenCanvas Worker when available', async () => {
			const mockBitmap = { width: 1600, height: 1200, close: vi.fn() };
			const mockCreateImageBitmap = vi.fn().mockResolvedValue(mockBitmap);
			vi.stubGlobal('createImageBitmap', mockCreateImageBitmap);
			vi.stubGlobal('OffscreenCanvas', class {});

			// Mock Worker as a class
			let workerOnMessage: ((e: MessageEvent) => void) | null = null;
			const postMessage = vi.fn().mockImplementation(() => {
				setTimeout(() => {
					workerOnMessage?.({
						data: { imageData: 'worker-base64-data', mimeType: 'image/jpeg' },
					} as MessageEvent);
				}, 0);
			});
			const terminate = vi.fn();

			vi.stubGlobal(
				'Worker',
				class {
					set onmessage(handler: (e: MessageEvent) => void) { workerOnMessage = handler; }
					onerror: ((e: ErrorEvent) => void) | null = null;
					postMessage = postMessage;
					terminate = terminate;
				}
			);

			vi.stubGlobal('URL', {
				...globalThis.URL,
				createObjectURL: vi.fn(() => 'blob:mock-url'),
				revokeObjectURL: vi.fn(),
			});

			const file = createMockFile('photo.jpg', 'image/jpeg');
			const result = await api.compressImageForIdentification(file);

			// Should have used createImageBitmap (not FileReader + Image)
			expect(mockCreateImageBitmap).toHaveBeenCalledWith(file);

			// Worker should receive scaled dimensions: 1600x1200 → 800x600
			expect(postMessage).toHaveBeenCalledWith(
				expect.objectContaining({ width: 800, height: 600 }),
				expect.any(Array)
			);

			// Should clean up
			expect(terminate).toHaveBeenCalled();

			expect(result.imageData).toBe('worker-base64-data');
			expect(result.mimeType).toBe('image/jpeg');
		});

		it('should fall back to main-thread if Worker fails', async () => {
			const mockBitmap = { width: 800, height: 600, close: vi.fn() };
			vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(mockBitmap));
			vi.stubGlobal('OffscreenCanvas', class {});

			// Worker that throws on construction
			vi.stubGlobal(
				'Worker',
				class {
					constructor() { throw new Error('Worker creation failed'); }
				}
			);

			vi.stubGlobal('URL', {
				...globalThis.URL,
				createObjectURL: vi.fn(() => 'blob:mock-url'),
				revokeObjectURL: vi.fn(),
			});

			// Set up main-thread fallback mocks
			const mocks = setupMainThreadMocks(800, 600);

			const file = createMockFile('photo.jpg', 'image/jpeg');
			const promise = api.compressImageForIdentification(file);

			// The worker failed, so it should fall back to FileReader path
			await vi.waitFor(() => expect(mocks.readAsDataURL).toHaveBeenCalled());
			mocks.triggerFileReaderLoad();
			await vi.waitFor(() => expect(mocks.drawImage).toHaveBeenCalled());

			const result = await promise;
			expect(result.mimeType).toBe('image/jpeg');
		});
	});

	describe('transparency handling', () => {
		it('should fill canvas with white before drawing image (main-thread path)', async () => {
			const mocks = setupMainThreadMocks(640, 480);
			const file = createMockFile('label.png', 'image/png');

			const promise = api.compressImageForIdentification(file);

			await vi.waitFor(() => expect(mocks.readAsDataURL).toHaveBeenCalled());
			mocks.triggerFileReaderLoad();
			await vi.waitFor(() => expect(mocks.drawImage).toHaveBeenCalled());

			await promise;

			// White fill must happen before drawImage
			expect(mocks.mockCtx.fillStyle).toBe('#ffffff');
			expect(mocks.fillRect).toHaveBeenCalledWith(0, 0, 640, 480);
			expect(mocks.callOrder).toEqual(['fillRect', 'drawImage']);
		});
	});

	describe('validation', () => {
		it('should reject HEIC files by extension', async () => {
			const file = createMockFile('photo.heic', '');
			await expect(api.compressImageForIdentification(file)).rejects.toThrow(
				'HEIC/HEIF images are not supported'
			);
		});

		it('should reject unsupported MIME types', async () => {
			const file = createMockFile('image.tiff', 'image/tiff');
			await expect(api.compressImageForIdentification(file)).rejects.toThrow(
				'Unsupported image format'
			);
		});
	});
});

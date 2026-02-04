import { vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock sessionStorage and localStorage
const createStorageMock = () => {
	let store: Record<string, string> = {};
	return {
		getItem: (key: string) => store[key] ?? null,
		setItem: (key: string, value: string) => {
			store[key] = value;
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		},
		get length() {
			return Object.keys(store).length;
		},
		key: (index: number) => Object.keys(store)[index] ?? null,
	};
};

const sessionStorageMock = createStorageMock();
const localStorageMock = createStorageMock();

Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window.matchMedia for theme detection
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

// Mock crypto.randomUUID for message ID generation
Object.defineProperty(globalThis.crypto, 'randomUUID', {
	value: () => `test-uuid-${Math.random().toString(36).substring(2, 9)}`,
});

// Mock Web Animations API for Svelte's flip/fly animations (not fully supported in jsdom)
Element.prototype.getAnimations = function () {
	return [];
};

// Mock Element.animate for Svelte transitions
Element.prototype.animate = function (keyframes: Keyframe[] | PropertyIndexedKeyframes | null, options?: number | KeyframeAnimationOptions) {
	const duration = typeof options === 'number' ? options : options?.duration || 0;
	return {
		cancel: () => {},
		finish: () => {},
		pause: () => {},
		play: () => {},
		reverse: () => {},
		updatePlaybackRate: () => {},
		commitStyles: () => {},
		persist: () => {},
		get currentTime() { return 0; },
		set currentTime(v) {},
		get playbackRate() { return 1; },
		set playbackRate(v) {},
		get playState() { return 'finished' as AnimationPlayState; },
		get pending() { return false; },
		get ready() { return Promise.resolve(this as unknown as Animation); },
		get finished() { return Promise.resolve(this as unknown as Animation); },
		onfinish: null,
		oncancel: null,
		onremove: null,
		get timeline() { return null; },
		get startTime() { return 0; },
		set startTime(v) {},
		get effect() { return null; },
		get id() { return ''; },
		get replaceState() { return 'active' as AnimationReplaceState; },
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	} as unknown as Animation;
};

// Reset storage between tests
beforeEach(() => {
	sessionStorageMock.clear();
	localStorageMock.clear();
});

// Clean up after each test
afterEach(() => {
	vi.clearAllMocks();
});

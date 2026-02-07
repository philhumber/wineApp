import { vi } from 'vitest';

// Mock for $app/navigation
export const goto = vi.fn(() => Promise.resolve());
export const invalidate = vi.fn(() => Promise.resolve());
export const invalidateAll = vi.fn(() => Promise.resolve());
export const preloadData = vi.fn(() => Promise.resolve());
export const preloadCode = vi.fn(() => Promise.resolve());
export const beforeNavigate = vi.fn();
export const afterNavigate = vi.fn();
export const onNavigate = vi.fn();
export const pushState = vi.fn();
export const replaceState = vi.fn();

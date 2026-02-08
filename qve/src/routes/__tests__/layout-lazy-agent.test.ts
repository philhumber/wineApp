import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * WIN-236: AgentPanel should be lazy-loaded, not statically imported in the layout.
 *
 * This test reads the layout source to verify the import pattern,
 * ensuring we don't regress back to a static import.
 */
describe('WIN-236: AgentPanel lazy loading', () => {
	const layoutPath = resolve(__dirname, '../+layout.svelte');
	const layoutSource = readFileSync(layoutPath, 'utf-8');

	it('should NOT statically import AgentPanel in the layout', () => {
		// A static import would look like: import ... AgentPanel ... from '...'
		const staticImportPattern = /^\s*import\s+.*\bAgentPanel\b.*from\s+/m;
		expect(layoutSource).not.toMatch(staticImportPattern);
	});

	it('should use dynamic import() for AgentPanel', () => {
		// Should contain a dynamic import like: import('...AgentPanel...')
		const dynamicImportPattern = /import\(\s*['"][^'"]*AgentPanel[^'"]*['"]\s*\)/;
		expect(layoutSource).toMatch(dynamicImportPattern);
	});

	it('should still statically import AgentBubble (lightweight)', () => {
		const bubbleImportPattern = /^\s*import\s+.*\bAgentBubble\b.*from\s+/m;
		expect(layoutSource).toMatch(bubbleImportPattern);
	});
});

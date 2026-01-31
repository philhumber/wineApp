/**
 * Client-side command detection for Wine Assistant
 * Intercepts conversational commands before they hit the identification API
 */

export type CommandType = 'start_over' | 'cancel' | 'go_back' | 'try_again';

export interface CommandDetectionResult {
	type: 'command' | 'wine_query';
	command?: CommandType;
}

const COMMAND_PATTERNS: Record<CommandType, string[]> = {
	start_over: [
		'start',
		'start over',
		'start again',
		'restart',
		'begin again',
		'reset',
		'new wine',
		'different wine',
		'start fresh',
		'fresh start'
	],
	cancel: ['stop', 'cancel', 'never mind', 'nevermind', 'forget it', 'quit', 'exit'],
	go_back: ['back', 'go back', 'undo', 'previous'],
	try_again: ['try again', 'retry', 'one more time']
};

// Expanded wine indicators to prevent false positives on international wines
const WINE_INDICATORS = [
	// French
	'château',
	'chateau',
	'domaine',
	'cru',
	'cave',
	// Spanish
	'bodega',
	'viña',
	'vina',
	'rioja',
	'ribera',
	// Italian
	'cantina',
	'tenuta',
	'azienda',
	'casa',
	// German
	'weingut',
	'schloss',
	// English/General
	'winery',
	'vineyard',
	'estate',
	'cellars',
	'reserve',
	'vintage',
	'wine',
	'bottle',
	'label',
	// Regions (common)
	'champagne',
	'burgundy',
	'bordeaux',
	'napa',
	'sonoma',
	// Appellations
	'doc',
	'docg',
	'aoc',
	'ava'
];

/**
 * Normalize text for matching: lowercase, remove punctuation, collapse whitespace
 */
function normalizeText(text: string): string {
	return text
		.toLowerCase()
		.trim()
		.replace(/[.,!?;:()'"]/g, '') // Remove punctuation
		.replace(/\s+/g, ' '); // Collapse whitespace
}

/**
 * Check if text contains wine-related indicators
 */
function containsWineIndicator(normalized: string): boolean {
	return WINE_INDICATORS.some((indicator) => normalized.includes(indicator));
}

/**
 * Detect if user input is a conversational command or wine query
 *
 * Execution order (critical for avoiding false positives):
 * 1. Wine indicators (highest priority) - "Château Cancel" → wine_query
 * 2. Word count limit - long text → wine_query
 * 3. Pattern matching - exact/substring matches
 */
export function detectCommand(text: string): CommandDetectionResult {
	const normalized = normalizeText(text);
	const words = normalized.split(' ').filter((w) => w.length > 0);

	// Priority 1: Wine indicators checked FIRST
	if (containsWineIndicator(normalized)) {
		return { type: 'wine_query' };
	}

	// Priority 2: Long inputs are wine queries (>6 words allows polite phrasing)
	if (words.length > 6) {
		return { type: 'wine_query' };
	}

	// Priority 3: Pattern matching (exact and substring)
	for (const [command, patterns] of Object.entries(COMMAND_PATTERNS)) {
		for (const pattern of patterns) {
			// Exact match
			if (normalized === pattern) {
				return { type: 'command', command: command as CommandType };
			}
			// Spaceless match (e.g., "startover")
			const spaceless = pattern.replace(/\s+/g, '');
			if (normalized === spaceless) {
				return { type: 'command', command: command as CommandType };
			}
			// Substring match for multi-word patterns only
			if (pattern.includes(' ') && normalized.includes(pattern)) {
				return { type: 'command', command: command as CommandType };
			}
		}
	}

	return { type: 'wine_query' };
}

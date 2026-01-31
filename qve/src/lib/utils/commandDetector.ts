/**
 * Client-side command detection for Wine Assistant
 * Intercepts conversational commands before they hit the identification API
 */

export type CommandType = 'start_over' | 'cancel' | 'go_back' | 'try_again';

export interface CommandDetectionResult {
	type: 'command' | 'wine_query';
	command?: CommandType;
}

export type ChipResponseType = 'positive' | 'negative';

export interface ChipResponseDetectionResult {
	type: 'chip_response' | 'wine_query';
	chipResponse?: ChipResponseType;
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

// Positive response patterns (sorted longest first for matching)
const POSITIVE_PATTERNS = [
	// Multi-word (must check first)
	'that is correct',
	'thats correct',
	'thats right',
	'thats it',
	'looks good',
	'looks right',
	'looks correct',
	// Single word
	'yes',
	'yeah',
	'yep',
	'yup',
	'aye',
	'yea',
	'ok',
	'okay',
	'correct',
	'right',
	'good',
	'great',
	'perfect',
	'sure',
	'definitely',
	'absolutely',
	// Common typos
	'yse',
	'yess',
	'yeas',
	'oaky',
	'corect',
	'corectt',
	'corrct',
	'corrrect'
];

// Negative response patterns (sorted longest first for matching)
const NEGATIVE_PATTERNS = [
	// Multi-word (must check first - prevents "right" matching in "not right")
	'doesnt look right',
	'does not look right',
	'thats wrong',
	'that is wrong',
	'not right',
	'not correct',
	'not it',
	// Single word
	'no',
	'nope',
	'nah',
	'nay',
	'wrong',
	'incorrect',
	'bad',
	// Common typos
	'nno',
	'worng',
	'incorect',
	'wrongg'
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

/**
 * Detect if user input is a yes/no type chip response
 * Only matches when input starts with a recognized pattern
 * Allows trailing words like "yes please" or "no thanks"
 */
export function detectChipResponse(text: string): ChipResponseDetectionResult {
	const normalized = normalizeText(text);

	// Empty input is not a chip response
	if (!normalized) {
		return { type: 'wine_query' };
	}

	// Wine indicators take priority (e.g., "Château Correct")
	if (containsWineIndicator(normalized)) {
		return { type: 'wine_query' };
	}

	// Long inputs are wine queries (>6 words)
	const words = normalized.split(' ').filter((w) => w.length > 0);
	if (words.length > 6) {
		return { type: 'wine_query' };
	}

	// Special case: "k" only matches if it's the entire input
	if (normalized === 'k') {
		return { type: 'chip_response', chipResponse: 'positive' };
	}

	// Check negative patterns FIRST (longer patterns checked before shorter)
	// This ensures "not right" matches before "right"
	for (const pattern of NEGATIVE_PATTERNS) {
		if (normalized === pattern || normalized.startsWith(pattern + ' ')) {
			return { type: 'chip_response', chipResponse: 'negative' };
		}
	}

	// Check positive patterns
	for (const pattern of POSITIVE_PATTERNS) {
		if (normalized === pattern || normalized.startsWith(pattern + ' ')) {
			return { type: 'chip_response', chipResponse: 'positive' };
		}
	}

	return { type: 'wine_query' };
}

/**
 * Check if input is too brief for reliable wine identification.
 * Any single word is considered brief - even wine terms like "Champagne"
 * are ambiguous without more context.
 * Used to trigger confirmation prompts before API calls.
 */
export function isBriefInput(text: string): boolean {
	const normalized = normalizeText(text);
	const words = normalized.split(' ').filter((w) => w.length > 0);

	// Any single word input is brief
	return words.length === 1;
}

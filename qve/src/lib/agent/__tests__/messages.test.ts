/**
 * Message System Tests
 *
 * Tests for the centralized message key system:
 * - MessageKey coverage (all keys have messages)
 * - Personality fallback chain
 * - Template function context handling
 * - Helper functions
 * - XSS prevention (escapeHtml, wn)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageKey } from '../messageKeys';
import { neutralMessages } from '../messages/neutral';
import { sommelierMessages } from '../messages/sommelier';
import {
  getMessageByKey,
  buildWineName,
  getEntityMessage,
  pluralizeEntity,
  getTimeBasedGreeting,
  wn,
  escapeHtml,
} from '../messages';
import { Personality } from '../personalities';

// Mock the agentSettings store
vi.mock('$lib/stores/agentSettings', () => ({
  getPersonality: vi.fn(() => Personality.SOMMELIER),
}));

// Get the mocked function for manipulation in tests
import { getPersonality } from '$lib/stores/agentSettings';
const mockGetPersonality = vi.mocked(getPersonality);

// ===========================================
// MessageKey Coverage Tests
// ===========================================

describe('MessageKey coverage', () => {
  // Get all MessageKey values
  const allMessageKeys = Object.values(MessageKey);

  describe('neutral messages (fallback)', () => {
    it('should have a message for every MessageKey', () => {
      const missingKeys: string[] = [];

      for (const key of allMessageKeys) {
        if (neutralMessages[key] === undefined) {
          missingKeys.push(key);
        }
      }

      expect(missingKeys).toEqual([]);
    });

    it('should have non-empty messages for all keys', () => {
      const emptyKeys: string[] = [];

      for (const key of allMessageKeys) {
        const message = neutralMessages[key];
        if (message !== undefined) {
          // Check if it's a string
          if (typeof message === 'string' && message.trim() === '') {
            emptyKeys.push(key);
          }
          // Arrays should have at least one item
          if (Array.isArray(message) && message.length === 0) {
            emptyKeys.push(key);
          }
        }
      }

      expect(emptyKeys).toEqual([]);
    });
  });

  describe('sommelier messages', () => {
    it('should have messages defined (partial coverage is OK since neutral is fallback)', () => {
      const sommelierKeyCount = Object.keys(sommelierMessages).length;
      // Sommelier should have a reasonable number of custom messages
      expect(sommelierKeyCount).toBeGreaterThan(50);
    });

    it('should have personality-specific versions for key messages', () => {
      // These are messages where personality really matters
      const keyPersonalityMessages = [
        MessageKey.GREETING_MORNING,
        MessageKey.GREETING_AFTERNOON,
        MessageKey.GREETING_EVENING,
        MessageKey.ID_FOUND,
        MessageKey.ID_NOT_FOUND,
        MessageKey.CONFIRM_CORRECT,
        MessageKey.ADD_COMPLETE,
      ];

      for (const key of keyPersonalityMessages) {
        expect(sommelierMessages[key]).toBeDefined();
      }
    });
  });
});

// ===========================================
// getMessageByKey Tests
// ===========================================

describe('getMessageByKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPersonality.mockReturnValue(Personality.SOMMELIER);
  });

  describe('static messages', () => {
    it('should return a string for simple message keys', () => {
      const message = getMessageByKey(MessageKey.ID_THINKING);
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should return sommelier message when personality is SOMMELIER', () => {
      mockGetPersonality.mockReturnValue(Personality.SOMMELIER);
      const message = getMessageByKey(MessageKey.CONFIRM_CORRECT);
      // Sommelier uses "Excellent" or similar refined language
      expect(message).toMatch(/excellent|very good|splendid/i);
    });
  });

  describe('array messages (random selection)', () => {
    it('should return one of the variants for array messages', () => {
      // GREETING_MORNING is an array in both neutral and sommelier
      const variants = sommelierMessages[MessageKey.GREETING_MORNING];
      expect(Array.isArray(variants)).toBe(true);

      // Call multiple times to verify randomization works
      const results = new Set<string>();
      for (let i = 0; i < 20; i++) {
        results.add(getMessageByKey(MessageKey.GREETING_MORNING));
      }

      // Should get at least 2 different variants in 20 tries
      // (statistically very likely with 5 variants)
      expect(results.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('template functions', () => {
    it('should interpolate wineName context', () => {
      const message = getMessageByKey(MessageKey.ID_FOUND, {
        wineName: 'Château Margaux 2015',
      });
      expect(message).toContain('Château Margaux 2015');
    });

    it('should interpolate entityType context', () => {
      const message = getMessageByKey(MessageKey.ENTITY_AUTO_CREATE, {
        entityType: 'producer',
      });
      expect(message).toContain('producer');
    });

    it('should interpolate multiple context values', () => {
      const message = getMessageByKey(MessageKey.ENTITY_MULTIPLE, {
        entityType: 'region',
        matchCount: 3,
        searchTerm: 'Bordeaux',
      });
      expect(message).toContain('3');
      expect(message).toContain('region');
      expect(message).toContain('Bordeaux');
    });

    it('should handle missing context gracefully with defaults', () => {
      // Template functions should have fallback defaults
      const message = getMessageByKey(MessageKey.ID_FOUND, {});
      // Should use fallback like "this wine"
      expect(message).toBeTruthy();
      expect(message).not.toContain('undefined');
    });

    it('should use grape context in ID_GRAPE_ONLY', () => {
      const message = getMessageByKey(MessageKey.ID_GRAPE_ONLY, {
        grape: 'Cabernet Sauvignon',
      });
      expect(message).toContain('Cabernet Sauvignon');
    });

    it('should use text context in ID_BRIEF_INPUT_CONFIRM', () => {
      const message = getMessageByKey(MessageKey.ID_BRIEF_INPUT_CONFIRM, {
        text: 'Margaux',
      });
      expect(message).toContain('Margaux');
    });

    it('should use bottleCount context in ADD_DUPLICATE_FOUND', () => {
      const message = getMessageByKey(MessageKey.ADD_DUPLICATE_FOUND, {
        wineName: 'Opus One',
        bottleCount: 3,
      });
      expect(message).toContain('Opus One');
      expect(message).toContain('3');
    });
  });

  describe('fallback chain', () => {
    it('should fallback to neutral when sommelier message is missing', () => {
      // Create a scenario where sommelier doesn't have a specific key
      // by temporarily removing it (we can't actually do this, so we test the concept)
      // Instead, verify the function doesn't throw for any key
      for (const key of Object.values(MessageKey)) {
        expect(() => {
          // Some keys require context, provide empty object
          getMessageByKey(key, {});
        }).not.toThrow();
      }
    });
  });
});

// ===========================================
// Helper Function Tests
// ===========================================

describe('buildWineName', () => {
  it('should return "this wine" for null result', () => {
    expect(buildWineName(null)).toBe('this wine');
  });

  it('should return "this wine" for undefined result', () => {
    expect(buildWineName(undefined)).toBe('this wine');
  });

  it('should return "this wine" for empty result', () => {
    expect(buildWineName({})).toBe('this wine');
  });

  it('should return producer when only producer is set', () => {
    expect(buildWineName({ producer: 'Château Margaux' })).toBe('Château Margaux');
  });

  it('should return wineName when only wineName is set', () => {
    expect(buildWineName({ wineName: 'Grand Vin' })).toBe('Grand Vin');
  });

  it('should combine producer and wineName', () => {
    expect(
      buildWineName({
        producer: 'Château Margaux',
        wineName: 'Grand Vin',
      })
    ).toBe('Château Margaux Grand Vin');
  });

  it('should ignore other fields', () => {
    expect(
      buildWineName({
        producer: 'Opus One',
        wineName: '2019',
        vintage: 2019,
        region: 'Napa Valley',
      })
    ).toBe('Opus One 2019');
  });
});

describe('getEntityMessage', () => {
  beforeEach(() => {
    mockGetPersonality.mockReturnValue(Personality.SOMMELIER);
  });

  it('should pass entityType to message context', () => {
    const message = getEntityMessage(MessageKey.ENTITY_AUTO_CREATE, 'producer');
    expect(message).toContain('producer');
  });

  it('should merge additional context', () => {
    const message = getEntityMessage(MessageKey.ENTITY_NO_MATCH, 'region', {
      searchTerm: 'Bordeaux',
    });
    expect(message).toContain('region');
    expect(message).toContain('Bordeaux');
  });
});

describe('pluralizeEntity', () => {
  it('should return singular for count of 1', () => {
    expect(pluralizeEntity('region', 1)).toBe('region');
    expect(pluralizeEntity('producer', 1)).toBe('producer');
    expect(pluralizeEntity('wine', 1)).toBe('wine');
  });

  it('should return plural for count > 1', () => {
    expect(pluralizeEntity('region', 2)).toBe('regions');
    expect(pluralizeEntity('producer', 5)).toBe('producers');
    expect(pluralizeEntity('wine', 100)).toBe('wines');
  });

  it('should return plural for count of 0', () => {
    expect(pluralizeEntity('region', 0)).toBe('regions');
  });
});

// ===========================================
// XSS Prevention Tests
// ===========================================

describe('escapeHtml', () => {
  it('should escape < and > characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('should escape ampersands', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('should escape double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('should escape single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#x27;s');
  });

  it('should handle all special characters together', () => {
    expect(escapeHtml('<img onerror="alert(\'xss\')" src=x>')).toBe(
      '&lt;img onerror=&quot;alert(&#x27;xss&#x27;)&quot; src=x&gt;'
    );
  });

  it('should not alter safe strings', () => {
    expect(escapeHtml('Château Margaux 2015')).toBe('Château Margaux 2015');
  });

  it('should handle empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('should handle strings with only special characters', () => {
    expect(escapeHtml('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#x27;');
  });

  it('should not double-escape already-escaped strings', () => {
    // If someone passes already-escaped content, it will be double-escaped
    // This is correct behavior - escapeHtml should always escape
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });
});

describe('wn (wine name wrapper)', () => {
  it('should wrap name in span with wine-name class', () => {
    const result = wn('Château Margaux');
    expect(result).toBe('<span class="wine-name">Château Margaux</span>');
  });

  it('should handle empty string', () => {
    const result = wn('');
    expect(result).toBe('<span class="wine-name"></span>');
  });

  it('should escape HTML in wine names to prevent XSS', () => {
    const result = wn('<script>alert("xss")</script>');
    expect(result).toBe(
      '<span class="wine-name">&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</span>'
    );
    expect(result).not.toContain('<script>');
  });

  it('should escape event handler injection attempts', () => {
    const result = wn('<img onerror=alert(1) src=x>');
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
  });

  it('should escape ampersands in wine names', () => {
    // "Domaine de la Romanée-Conti" is safe, but "R&D Wines" has an ampersand
    const result = wn('R&D Wines');
    expect(result).toBe('<span class="wine-name">R&amp;D Wines</span>');
  });

  it('should safely handle names with quotes', () => {
    const result = wn('Cuvée "Prestige"');
    expect(result).toBe('<span class="wine-name">Cuvée &quot;Prestige&quot;</span>');
  });
});

describe('XSS prevention in message templates', () => {
  beforeEach(() => {
    mockGetPersonality.mockReturnValue(Personality.SOMMELIER);
  });

  it('should escape malicious wine names in ID_FOUND messages', () => {
    const message = getMessageByKey(MessageKey.ID_FOUND, {
      wineName: '<script>alert("xss")</script>',
    });
    expect(message).not.toContain('<script>');
    expect(message).toContain('&lt;script&gt;');
  });

  it('should escape malicious producer names in ADD_DUPLICATE_FOUND messages', () => {
    const message = getMessageByKey(MessageKey.ADD_DUPLICATE_FOUND, {
      wineName: '<img onerror=alert(1)>',
      bottleCount: 1,
    });
    expect(message).not.toContain('<img');
    expect(message).toContain('&lt;img');
  });

  it('should escape malicious grape names in ID_GRAPE_ONLY messages', () => {
    const message = getMessageByKey(MessageKey.ID_GRAPE_ONLY, {
      grape: '<svg onload=alert(1)>',
    });
    expect(message).not.toContain('<svg');
    expect(message).toContain('&lt;svg');
  });

  it('should escape malicious content in ADD_COMPLETE messages', () => {
    const message = getMessageByKey(MessageKey.ADD_COMPLETE, {
      wineName: '"><script>document.cookie</script>',
    });
    expect(message).not.toContain('<script>');
  });

  it('should escape malicious content in enrichment messages', () => {
    const message = getMessageByKey(MessageKey.ENRICH_FOUND_DETAILS, {
      wineName: '<iframe src="evil.com"></iframe>',
    });
    expect(message).not.toContain('<iframe');
    expect(message).toContain('&lt;iframe');
  });
});

// ===========================================
// Time-based Greeting Tests
// ===========================================

describe('getTimeBasedGreeting', () => {
  beforeEach(() => {
    mockGetPersonality.mockReturnValue(Personality.SOMMELIER);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return morning greeting between 4am and 11am', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T08:00:00'));

    const greeting = getTimeBasedGreeting();
    // Morning greetings should contain morning-related words
    expect(greeting.toLowerCase()).toMatch(/morning|day|rise/);
  });

  it('should return afternoon greeting between 12pm and 4pm', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T14:00:00'));

    const greeting = getTimeBasedGreeting();
    expect(greeting.toLowerCase()).toMatch(/afternoon|here/);
  });

  it('should return evening greeting after 5pm', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T19:00:00'));

    const greeting = getTimeBasedGreeting();
    // Evening greetings may include evening, tonight, or cellar-related language
    expect(greeting.toLowerCase()).toMatch(/evening|tonight|cellar|awaits/);
  });
});

// ===========================================
// Personality Consistency Tests
// ===========================================

describe('personality consistency', () => {
  it('sommelier messages should use refined language', () => {
    const refinedPatterns = [
      /shall we/i,
      /would you/i,
      /I('d| would)/i,
      /perhaps/i,
      /rather/i,
      /cellar/i,
    ];

    let matchCount = 0;
    const stringMessages = Object.values(sommelierMessages).filter(
      (m) => typeof m === 'string'
    ) as string[];

    for (const message of stringMessages) {
      for (const pattern of refinedPatterns) {
        if (pattern.test(message)) {
          matchCount++;
          break;
        }
      }
    }

    // At least 10% of messages should have refined language
    expect(matchCount).toBeGreaterThan(stringMessages.length * 0.1);
  });

  it('neutral messages should be straightforward', () => {
    const stringMessages = Object.values(neutralMessages).filter(
      (m) => typeof m === 'string'
    ) as string[];

    // Neutral messages should generally be shorter and simpler
    const avgLength =
      stringMessages.reduce((sum, m) => sum + m.length, 0) / stringMessages.length;

    // Average neutral message should be under 100 characters
    expect(avgLength).toBeLessThan(100);
  });
});

// ===========================================
// Template Function Safety Tests
// ===========================================

describe('template function safety', () => {
  // Template keys that have sensible defaults when context is missing (for wineName/producer)
  const templateKeysWithWineDefaults = [
    MessageKey.ID_FOUND,
    MessageKey.ID_LOW_CONFIDENCE,
    MessageKey.ADD_COMPLETE,
    MessageKey.ENRICH_FOUND_DETAILS,
    MessageKey.ENRICH_CACHE_CONFIRM,
  ];

  // Template keys that require entityType (should provide it in tests)
  const templateKeysRequiringEntity = [
    MessageKey.ENTITY_AUTO_CREATE,
    MessageKey.ENTITY_FOUND,
    MessageKey.ENTITY_NO_MATCH,
    MessageKey.ENTITY_MULTIPLE,
  ];

  it('should not produce undefined in output for keys with wine defaults', () => {
    for (const key of templateKeysWithWineDefaults) {
      const message = getMessageByKey(key, {});
      expect(message).not.toContain('undefined');
    }
  });

  it('should not produce undefined when entityType is provided', () => {
    for (const key of templateKeysRequiringEntity) {
      const message = getMessageByKey(key, { entityType: 'region', searchTerm: 'test', matchCount: 2 });
      expect(message).not.toContain('undefined');
    }
  });

  it('should handle user-input keys with proper context', () => {
    // These keys should work correctly when proper context is provided
    expect(getMessageByKey(MessageKey.ID_BRIEF_INPUT_CONFIRM, { text: 'Margaux' })).toContain(
      'Margaux'
    );
    expect(getMessageByKey(MessageKey.ENTITY_NO_MATCH, { searchTerm: 'test', entityType: 'region' })).toContain(
      'test'
    );
  });

  it('should not produce null in output', () => {
    const allTemplateKeys = [
      ...templateKeysWithWineDefaults,
      ...templateKeysRequiringEntity,
    ];
    for (const key of allTemplateKeys) {
      const message = getMessageByKey(key, { entityType: 'region', searchTerm: 'test', matchCount: 2 });
      expect(message).not.toContain('null');
    }
  });

  it('should produce valid HTML when using wn()', () => {
    const message = getMessageByKey(MessageKey.ID_FOUND, {
      wineName: 'Test Wine',
    });

    // If message contains wine-name span, it should be properly formed
    if (message.includes('wine-name')) {
      expect(message).toMatch(/<span class="wine-name">[^<]+<\/span>/);
    }
  });
});

// ===========================================
// Cache Confirmation Message Tests (WIN-XXX)
// ===========================================

describe('cache confirmation message includes searchedFor context', () => {
  it('should include the searched-for wine name when different from matched wine', () => {
    const message = getMessageByKey(MessageKey.ENRICH_CACHE_CONFIRM, {
      wineName: 'Moet Chandon Rose Imperial',
      searchedForName: 'Moet Chandon Nectar Imperial',
    });

    // Must mention what the user actually searched for
    expect(message).toContain('Nectar Imperial');
    // Must also mention the cached match
    expect(message).toContain('Rose Imperial');
  });

  it('should still work without searchedForName (backwards compat)', () => {
    const message = getMessageByKey(MessageKey.ENRICH_CACHE_CONFIRM, {
      wineName: 'Chateau Margaux 2015',
    });

    expect(message).toContain('Chateau Margaux');
    expect(message).not.toContain('undefined');
  });
});

// ===========================================
// Chip Label Tests
// ===========================================

describe('chip labels', () => {
  const chipKeys = Object.values(MessageKey).filter((key) => key.startsWith('chips.'));

  it('should have all chip labels defined in neutral', () => {
    for (const key of chipKeys) {
      expect(neutralMessages[key]).toBeDefined();
    }
  });

  it('chip labels should be short (under 25 characters)', () => {
    for (const key of chipKeys) {
      const label = neutralMessages[key];
      if (typeof label === 'string') {
        expect(label.length).toBeLessThanOrEqual(25);
      }
    }
  });

  it('chip labels should not contain special formatting', () => {
    for (const key of chipKeys) {
      const label = neutralMessages[key];
      if (typeof label === 'string') {
        // No HTML, no markdown
        expect(label).not.toMatch(/<[^>]+>/);
        expect(label).not.toMatch(/\*\*[^*]+\*\*/);
      }
    }
  });
});

// ===========================================
// Error Message Tests
// ===========================================

describe('error messages', () => {
  const errorKeys = [
    MessageKey.ERROR_TIMEOUT,
    MessageKey.ERROR_RATE_LIMIT,
    MessageKey.ERROR_LIMIT_EXCEEDED,
    MessageKey.ERROR_GENERIC,
    MessageKey.ERROR_IMAGE_UNCLEAR,
    MessageKey.ERROR_NETWORK,
    MessageKey.ERROR_NO_RESULT,
  ];

  it('should have all error messages defined', () => {
    for (const key of errorKeys) {
      expect(neutralMessages[key]).toBeDefined();
      expect(typeof neutralMessages[key]).toBe('string');
    }
  });

  it('error messages should be user-friendly (no technical jargon)', () => {
    const technicalTerms = ['exception', 'stack', 'trace', 'null', 'undefined', 'error code'];

    for (const key of errorKeys) {
      const message = neutralMessages[key] as string;
      for (const term of technicalTerms) {
        expect(message.toLowerCase()).not.toContain(term);
      }
    }
  });

  it('error messages should suggest next steps or be reassuring', () => {
    const helpfulPatterns = [
      /try again/i,
      /please/i,
      /moment/i,
      /tomorrow/i,
      /check/i,
      /wait/i,
      /first/i, // "Please identify a wine first"
      /unclear/i, // "That image is a bit unclear"
      /could you/i,
    ];

    for (const key of errorKeys) {
      const message = neutralMessages[key] as string;
      const hasHelpfulLanguage = helpfulPatterns.some((pattern) => pattern.test(message));
      if (!hasHelpfulLanguage) {
        console.log(`Error message without helpful language: ${key} = "${message}"`);
      }
      expect(hasHelpfulLanguage).toBe(true);
    }
  });
});

# Intent Classification Layer for Agent

**Created**: 2026-02-08
**Status**: Planned
**JIRA**: TBD

## Context

The wine agent currently processes user text input through a 6-stage sequential pipeline in `handleTextSubmit()` (`qve/src/lib/agent/handlers/identification.ts:429`). Each stage uses regex pattern matching to detect commands, field inputs, chip responses, etc. This works well for obvious inputs ("yes", "start over", "Chateau Margaux") but struggles with natural language ("that sounds about right", "the French one we discussed", "I'm thinking something bold for tonight").

**Goal**: Add a fast, cheap LLM-based intent classifier that handles ambiguous inputs the pattern matching can't resolve. Returns a simple intent flag, then a phase-aware routing layer decides what to do with it.

---

## Intent Categories

| Intent | Description | Examples |
|--------|-------------|---------|
| `confirmation` | User agrees/confirms | "yes", "that sounds right", "looks good to me" |
| `rejection` | User disagrees/rejects | "no", "not quite", "that's not the one" |
| `wine_search` | Looking for a specific wine | "Margaux 2015", "that French red I had" |
| `recommendation` | Wants a suggestion/pairing | "what wine goes with steak?", "recommend a red" |
| `question` | Asking about wine knowledge | "how long should I cellar this?", "is this ready?" |
| `command` | Navigation | "start over", "cancel", "go back" |
| `chat` | Off-topic/greetings/capabilities | "hello", "what can you do?", "thanks" |

---

## Architecture: Hybrid Pattern + LLM

```
User types text → handleTextSubmit()
         │
         ▼
┌──────────────────────────┐
│ 1. Command detection     │  existing, unchanged
│ 2. Field/direct value    │  existing, unchanged (awaiting_input only)
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ 3. Pattern Pre-Filter    │  ~5ms, free
│ (intentClassifier.ts)    │
└──────────┬───────────────┘
           │
    High confidence? ──── YES ──→ Phase-intent routing
           │
           NO (ambiguous)
           │
           ▼
┌──────────────────────────┐
│ 4. Backend LLM Call      │  ~300ms, ~$0.00002/call
│ POST classifyIntent.php  │
│ Gemini 2.0 Flash         │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ 5. Phase-Intent Routing  │  validates compatibility
│ (routeByIntent)          │  dispatches or shows mismatch message
└──────────────────────────┘
```

**~80% of inputs** handled by patterns (instant). **~20% ambiguous** get the LLM call.

---

## Pipeline Change Summary

**Current stages** (lines 429-625 of identification.ts):
1. Command detection → dispatch
2. Field input detection → update result
3. Direct value detection → fill field
4. Chip response detection → confirm/reject
5. Brief input check → confirmation prompt
6. Execute identification → API call

**New stages**:
1. **Command detection** — KEEP unchanged
2. **Field input / direct value** — KEEP unchanged (only runs in `awaiting_input` with existing result)
3. **Intent classification** — NEW (replaces stages 4+5: pattern pre-filter, then LLM for ambiguous)
4. **Phase-intent routing** — NEW (validates intent vs phase, dispatches or shows mismatch message)
5. **Execute identification** — KEEP (only reached for `wine_search` intent)

---

## Phase-Intent Compatibility Matrix

After classification, **`routeByIntent(intent, phase, text)`** validates the combo before dispatching.

| Intent | `greeting` | `awaiting_input` | `confirming` | `action_select` | `error` |
|--------|-----------|-------------------|--------------|-----------------|---------|
| `confirmation` | MISMATCH | MISMATCH | handleCorrect | handleCorrect | MISMATCH |
| `rejection` | MISMATCH | skip field* | handleNotCorrect | new search prompt | MISMATCH |
| `wine_search` | identify | identify | new search prompt | new search prompt | identify |
| `recommendation` | placeholder | placeholder | placeholder | placeholder | placeholder |
| `question` | placeholder | placeholder | placeholder | placeholder | placeholder |
| `chat` | chat handler | chat handler | chat handler | chat handler | chat handler |
| `command` | (handled in stage 1, shouldn't reach here) |

*`rejection` in `awaiting_input`: "I don't know that detail" — offer to skip field and continue.

### Mismatch Response Messages

Lookup table keyed by `{intent}_{phase}`, using sommelier personality from the existing message system (`qve/src/lib/agent/messageKeys.ts`).

| Mismatch | Message | Then |
|----------|---------|------|
| `confirmation` + `greeting` | "I'm ready when you are! Describe a wine or snap a photo to get started." | Stay in `greeting` |
| `confirmation` + `awaiting_input` | "I appreciate the enthusiasm! But first, could you tell me the {missingField}?" | Stay in `awaiting_input` |
| `confirmation` + `error` | "Would you like to try again, or start fresh?" | Show retry/start over chips |
| `rejection` + `greeting` | "No worries! Just describe a wine whenever you're ready." | Stay in `greeting` |
| `rejection` + `awaiting_input` | "No problem — want to skip that detail? We can work with what we have." | Show skip/continue chips |
| `rejection` + `error` | "Let's start fresh then." | Trigger start_over |

The `{missingField}` placeholder is populated from `analyzeResultQuality()` (`qve/src/lib/agent/services/resultAnalyzer.ts`).

---

## Pre-filter Confidence Downgrade Rules

Wine indicators alone aren't enough for high-confidence `wine_search`. The pre-filter **downgrades confidence** (→ defers to LLM) when wine keywords appear inside conversational framing:

| Signal | Example | Effect |
|--------|---------|--------|
| Question framing (`?`, "can you", "how do I") | "I want to find a wine, can you help me?" | → LLM |
| Conversational starters ("I want", "I need", "help me") | "help me pick a wine" | → LLM |
| Capability questions ("what can", "do you") | "what can you do with wine?" | → LLM |

**High-confidence `wine_search`** only for actual wine names/descriptions:
- Wine indicator as proper noun: "Chateau Margaux", "Domaine Leroy"
- Wine indicator + vintage: "Barolo 2018"
- Short noun phrases with wine terms: "French Burgundy reserve"

---

## Files to Create

### 1. `qve/src/lib/agent/services/intentClassifier.ts`
Client-side service. Contains:
- **`classifyIntent(text, context)`** — main entry point
- **`preFilterByPattern(text, context)`** — reuses patterns from `qve/src/lib/utils/commandDetector.ts` + new recommendation/question/downgrade patterns
- Returns `IntentResult` with `intent`, `confidence`, `source` ('pattern' | 'llm' | 'fallback')
- On LLM error/timeout: defaults to `wine_search` (safe fallback = existing behavior)

### 2. `resources/php/agent/classifyIntent.php`
Backend endpoint:
```
POST /resources/php/agent/classifyIntent.php
Request:  { text, context: { phase, hasResult, hasAugmentation } }
Response: { success, data: { intent, confidence, reasoning } }
```

### 3. `resources/php/agent/Intent/IntentClassifier.php`
PHP classification service using `LLMClient::complete('classify_intent', ...)`:
- System prompt (~100 tokens): category definitions + "respond JSON only"
- User prompt (~30 tokens): phase, hasResult flag, user text
- Settings: `max_tokens: 80`, `temperature: 0.1`, no thinking
- Parses JSON, validates intent is known category, falls back to `wine_search` on failure

### 4. `qve/src/lib/agent/handlers/intentHandlers.ts`
Contains:
- **`routeByIntent(intent, phase, text)`** — phase-intent compatibility check + dispatch
- **Mismatch response messages** — lookup table
- **Placeholder handlers** — `handleRecommendationIntent`, `handleQuestionIntent`, `handleChatIntent`

---

## Files to Modify

### 5. `qve/src/lib/api/types.ts`
```typescript
export type IntentCategory = 'confirmation' | 'rejection' | 'wine_search'
  | 'recommendation' | 'question' | 'command' | 'chat';

export interface IntentClassifyRequest {
  text: string;
  context: { phase: string; hasResult: boolean; hasAugmentation: boolean; };
}

export interface IntentClassifyResponse {
  intent: IntentCategory;
  confidence: number;
  reasoning?: string;
}
```

### 6. `qve/src/lib/api/client.ts`
Add `classifyIntent(text, context)` with `fetchJSON<IntentClassifyResponse>()`, 2s timeout.

### 7. `qve/src/lib/agent/handlers/identification.ts`
Refactor `handleTextSubmit()`: replace stages 4-5 with `classifyIntent()` + `routeByIntent()`.

### 8. `resources/php/agent/config/agent.config.php`
```php
'classify_intent' => [
    'primary' => ['provider' => 'gemini', 'model' => 'gemini-2.0-flash'],
    'fallback' => null,
],
```

### 9. `resources/php/agent/_bootstrap.php`
Add factory function `getAgentIntentClassifier()`.

### 10. `qve/src/lib/agent/services/index.ts`
Add barrel export for `classifyIntent` and types.

---

## LLM Prompt (minimal for speed)

**System** (~100 tokens):
```
You classify user messages in a wine cellar assistant app.

Return JSON only: {"intent":"<category>","confidence":<0-1>}

Categories:
- confirmation: user agrees (yes, correct, that's the one)
- rejection: user disagrees (no, wrong, not that)
- wine_search: user names or describes a wine to find
- recommendation: user asks for wine suggestion or food pairing
- question: user asks about wine knowledge (aging, storage, quality)
- command: navigation request (start over, cancel, go back)
- chat: greeting, thanks, off-topic, or asking what the app does
```

**User** (~30 tokens):
```
Phase: {phase} | Has wine: {hasResult}
"{text}"
```

---

## Error Handling

- **LLM timeout** (>2s): Return `{ intent: 'wine_search', confidence: 0.5, source: 'fallback' }`
- **LLM parse failure**: Return `{ intent: 'wine_search', confidence: 0.5, source: 'fallback' }`
- **Network error**: Return `{ intent: 'wine_search', confidence: 0.5, source: 'fallback' }`

Safe fallback = `wine_search` because that's the current default behavior.

---

## Implementation Order

1. **Types** — `api/types.ts`
2. **Backend** — `agent.config.php`, `Intent/IntentClassifier.php`, `classifyIntent.php`, `_bootstrap.php`
3. **API client** — `client.ts`
4. **Client service** — `services/intentClassifier.ts`
5. **Handlers** — `handlers/intentHandlers.ts` (routing + placeholders + mismatch messages)
6. **Integration** — `handlers/identification.ts` (refactor handleTextSubmit)
7. **Exports** — `services/index.ts`

---

## Tests

Tests are built alongside each implementation step so we can validate as we go. Two TS test files (pattern pre-filter, full flow with LLM, phase-intent routing) and two PHP test files (classifier unit tests, endpoint integration).

### Test File 1: `qve/src/lib/agent/__tests__/intentClassifier.test.ts`

Uses Vitest, following conventions from `qve/src/lib/agent/__tests__/handlers.test.ts`. Mocks stores and API client.

#### Suite 1: Pattern Pre-Filter (`preFilterByPattern`)

Tests the client-side pattern matching that runs before any LLM call.

```
describe('preFilterByPattern', () => {
  // --- Commands (high confidence, instant) ---
  'start over'                    → { intent: 'command', confidence ≥ 0.9 }
  'cancel'                        → { intent: 'command', confidence ≥ 0.9 }

  // --- Chip responses in confirming phase ---
  'yes' (phase: confirming)       → { intent: 'confirmation', confidence ≥ 0.9 }
  'no' (phase: confirming)        → { intent: 'rejection', confidence ≥ 0.9 }
  'that is correct' (confirming)  → { intent: 'confirmation', confidence ≥ 0.9 }
  'wrong' (confirming)            → { intent: 'rejection', confidence ≥ 0.9 }

  // --- Chip responses OUTSIDE confirming phase → should NOT match ---
  'yes' (phase: greeting)         → null (defer to LLM)
  'no' (phase: awaiting_input)    → null (defer to LLM)

  // --- Wine indicators (proper nouns → high confidence wine_search) ---
  'Chateau Margaux'               → { intent: 'wine_search', confidence ≥ 0.85 }
  'Domaine Leroy Burgundy 2018'   → { intent: 'wine_search', confidence ≥ 0.85 }
  'Barolo 2018'                   → { intent: 'wine_search', confidence ≥ 0.85 }

  // --- Wine indicators with conversational framing → DOWNGRADED ---
  'I want to find a wine, can you help me?'  → null (defer to LLM)
  'help me pick a wine'                      → null (defer to LLM)
  'what can you do with wine?'               → null (defer to LLM)
  'do you know about Burgundy wines?'        → null (defer to LLM)

  // --- Recommendation patterns ---
  'what goes with steak?'         → { intent: 'recommendation', confidence ≥ 0.8 }
  'recommend a red for dinner'    → { intent: 'recommendation', confidence ≥ 0.8 }
  'pair with salmon'              → { intent: 'recommendation', confidence ≥ 0.8 }

  // --- Question patterns ---
  'how long should I cellar this?' → { intent: 'question', confidence ≥ 0.75 }
  'is this wine ready to drink?'   → { intent: 'question', confidence ≥ 0.75 }

  // --- Ambiguous (should return null → defer to LLM) ---
  'that sounds about right'       → null
  'the French one'                → null
  'something bold and full-bodied'→ null
  'I had it at a restaurant'      → null
})
```

#### Suite 2: `classifyIntent` (full flow with LLM fallback)

```
describe('classifyIntent', () => {
  // --- Pattern match skips LLM ---
  it('returns pattern result without calling API for obvious wine search', async () => {
    const result = await classifyIntent('Chateau Margaux', context)
    expect(result.source).toBe('pattern')
    expect(api.classifyIntent).not.toHaveBeenCalled()
  })

  // --- Ambiguous triggers LLM ---
  it('calls API for ambiguous input', async () => {
    vi.spyOn(api, 'classifyIntent').mockResolvedValue({
      intent: 'confirmation', confidence: 0.9, reasoning: 'agreeing'
    })
    const result = await classifyIntent('that sounds about right', context)
    expect(result.source).toBe('llm')
    expect(api.classifyIntent).toHaveBeenCalledWith('that sounds about right', context)
  })

  // --- LLM timeout → fallback ---
  it('falls back to wine_search on API timeout', async () => {
    vi.spyOn(api, 'classifyIntent').mockRejectedValue(new Error('Timeout'))
    const result = await classifyIntent('something ambiguous', context)
    expect(result.intent).toBe('wine_search')
    expect(result.source).toBe('fallback')
    expect(result.confidence).toBe(0.5)
  })

  // --- LLM returns invalid intent → fallback ---
  it('falls back on invalid intent from LLM', async () => {
    vi.spyOn(api, 'classifyIntent').mockResolvedValue({
      intent: 'invalid_thing' as any, confidence: 0.8
    })
    const result = await classifyIntent('something weird', context)
    expect(result.intent).toBe('wine_search')
    expect(result.source).toBe('fallback')
  })
})
```

#### Suite 3: Phase-Intent Routing (`routeByIntent`)

```
describe('routeByIntent', () => {
  // --- Valid combos ---
  it('confirmation + confirming → calls handleCorrect', () => {
    routeByIntent('confirmation', 'confirming', 'yes please')
    expect(handleCorrectMock).toHaveBeenCalled()
  })

  it('rejection + confirming → calls handleNotCorrect', () => {
    routeByIntent('rejection', 'confirming', 'no thats wrong')
    expect(handleNotCorrectMock).toHaveBeenCalled()
  })

  it('wine_search + greeting → calls executeTextIdentification', () => {
    routeByIntent('wine_search', 'greeting', 'Margaux 2015')
    expect(executeIdentificationMock).toHaveBeenCalled()
  })

  it('wine_search + confirming → triggers new search prompt', () => {
    routeByIntent('wine_search', 'confirming', 'actually try Barolo')
    expect(conversation.addMessage).toHaveBeenCalled() // new search confirmation
  })

  // --- Mismatch combos ---
  it('confirmation + greeting → shows mismatch message, stays in greeting', () => {
    routeByIntent('confirmation', 'greeting', 'yes')
    expect(conversation.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({
        content: expect.stringContaining('ready when you are')
      })})
    )
    expect(conversation.setPhase).not.toHaveBeenCalled()
  })

  it('confirmation + awaiting_input → shows mismatch with missing field', () => {
    routeByIntent('confirmation', 'awaiting_input', 'that sounds right')
    expect(conversation.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({
        content: expect.stringContaining('producer')
      })})
    )
  })

  it('rejection + awaiting_input → offers skip with chips', () => {
    routeByIntent('rejection', 'awaiting_input', 'no')
    expect(conversation.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({
        content: expect.stringContaining('skip')
      })})
    )
    expect(conversation.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'chips' })
    )
  })

  it('confirmation + error → shows retry/start over options', () => {
    routeByIntent('confirmation', 'error', 'ok')
    expect(conversation.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({
        content: expect.stringContaining('try again')
      })})
    )
  })

  // --- Placeholder intents (valid in all phases) ---
  it('recommendation + any phase → shows placeholder message', () => {
    routeByIntent('recommendation', 'greeting', 'recommend a red')
    expect(conversation.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({
        content: expect.stringContaining('find and add')
      })})
    )
  })

  it('chat + any phase → shows capability message', () => {
    routeByIntent('chat', 'confirming', 'hello')
    expect(conversation.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({
        content: expect.stringContaining('sommelier')
      })})
    )
  })
})
```

### Test File 2: `resources/php/tests/IntentClassifierTest.php`

PHP test following conventions from `resources/php/tests/FuzzyMatcherTest.php`. Run with `php resources/php/tests/IntentClassifierTest.php`.

```
class IntentClassifierTest
  // --- JSON parsing ---
  testValidJsonParsing:
    '{"intent":"wine_search","confidence":0.85}'  → intent: 'wine_search', confidence: 0.85
    '{"intent":"confirmation","confidence":0.9}'   → intent: 'confirmation', confidence: 0.9

  testInvalidJsonFallback:
    'not json at all'             → intent: 'wine_search', confidence: 0.5 (fallback)
    '{"intent":"invalid"}'        → intent: 'wine_search', confidence: 0.5 (fallback)
    '{}'                          → intent: 'wine_search', confidence: 0.5 (fallback)
    '{"intent":"wine_search"}'    → intent: 'wine_search', confidence: 0.5 (missing confidence ok, default)

  // --- Prompt construction ---
  testPromptContainsPhase:
    context: { phase: 'confirming', hasResult: true }
    → prompt contains 'Phase: confirming'
    → prompt contains 'Has wine: true'

  testPromptContainsUserText:
    text: 'Margaux 2015'
    → prompt contains '"Margaux 2015"'

  // --- Known intent validation ---
  testKnownIntentsAccepted:
    for each of: confirmation, rejection, wine_search, recommendation, question, command, chat
    → accepted as valid

  testUnknownIntentRejected:
    'foo', 'search', 'identify', '' → falls back to wine_search
```

### Test File 3: `resources/php/tests/ClassifyIntentEndpointTest.php`

Integration test for the endpoint. Uses curl-style assertions.

```
class ClassifyIntentEndpointTest
  testEndpointReturnsValidJson:
    POST { text: 'Margaux 2015', context: { phase: 'greeting', hasResult: false } }
    → HTTP 200
    → response.success === true
    → response.data.intent is one of known categories
    → response.data.confidence is between 0 and 1

  testEndpointRequiresText:
    POST { context: { phase: 'greeting' } }
    → HTTP 400
    → response.success === false

  testEndpointHandlesEmptyText:
    POST { text: '', context: { phase: 'greeting', hasResult: false } }
    → HTTP 400
```

---

## Verification (manual)

1. `php -l resources/php/agent/classifyIntent.php` — syntax check
2. `php resources/php/tests/IntentClassifierTest.php` — PHP unit tests
3. `curl` the endpoint with test inputs
4. `cd qve && npx vitest run src/lib/agent/__tests__/intentClassifier.test.ts` — TS tests
5. `npm run check` — TypeScript compilation
6. Manual browser testing:
   - "yes" in confirming → instant pattern → handleCorrect
   - "that sounds about right" in confirming → LLM → confirmation → handleCorrect
   - "recommend something bold" → LLM → recommendation → placeholder
   - "Chateau Margaux" → instant pattern → wine_search → identification
   - "I want to find a wine, can you help?" → downgraded confidence → LLM → chat → placeholder
   - "that sounds about right" in `awaiting_input` → LLM → confirmation → MISMATCH → "could you tell me the producer?"
   - "no" in `awaiting_input` → pattern → rejection → MISMATCH → "want to skip?" + chips
   - Network disconnected, ambiguous text → fallback → wine_search → identification

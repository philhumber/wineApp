# Optimize Identification Workflow — Implementation Summary

**Branch**: `claude/optimize-identification-workflow-X2NcF` (PR #98)
**Status**: Phases 0–4 complete (identification). Enrichment card deferred.

---

## What Was Done

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Stabilization tests | Done |
| 1 | Remove thinking from Tier 1 | Done |
| 2 | Slim the streaming prompt | Done |
| 3 | Add responseSchema | Done |
| 4 | Non-blocking escalation | Done |
| 5 | Manual testing & performance | Pending |
| 6 | Enrichment streaming optimization | Done |

---

## Phase 0: Stabilization Tests

New test files:
- `resources/php/tests/StreamingFieldDetectorTest.php` — 8 unit tests for JSON chunk parsing
- `resources/php/tests/IdentificationServiceTest.php` — prompt generation tests
- `qve/src/lib/api/__tests__/sseParser.test.ts` — SSE parsing via public `identifyTextStream`
- Extended `agentIdentification.test.ts` — edge case tests for rapid updates, escalation transitions
- Extended `streaming.test.ts` — refining/refined event handling, in-place card updates

All 918 tests pass. 0 TypeScript errors.

---

## Phase 1: Remove Thinking from Tier 1

**File**: `resources/php/agent/config/agent.config.php`

Removed `thinking_level: LOW` from the `fast` tier. This eliminates 1–2s of invisible latency before first streaming token. Reduced `max_tokens` from 4000 to 1500 (JSON output is ~200 tokens, no thinking budget needed).

Escalation tiers (`detailed`, `opus`) retain their thinking configs.

---

## Phase 2: Slim the Streaming Prompt

**File**: `resources/php/agent/Identification/IdentificationService.php`

Replaced verbose `buildIdentificationPrompt()` (~575 chars) and `buildVisionPrompt()` with minimal versions (~220 chars). Key removals:
- `confidenceRationale` field (saves ~20–50 output tokens)
- Verbose field descriptions (model knows what "producer" means)

Non-streaming path unchanged — `TextProcessor`/`VisionProcessor` use file-based prompts.

---

## Phase 3: Add responseSchema

**Files**: `IdentificationService.php`, `GeminiAdapter.php`

Added `getIdentificationSchema()` method defining the JSON shape (producer, wineName, vintage, region, country, wineType, grapes, confidence). Passed to Gemini via `response_schema` option in `buildStreamingPayload()`.

Benefits: guaranteed valid JSON, model knows shape upfront, prevents unschematized fields leaking in.

---

## Phase 4: Non-blocking Escalation

This was the biggest change and required the most debugging.

### Backend Changes

**New method**: `IdentificationService::identifyEscalateOnly()` — runs Tier 1.5 → 2 only, skipping redundant Tier 1. Extracted from `identifyFromText()` lines 702–778.

**Streaming endpoints** (`identifyTextStream.php`, `identifyImageStream.php`): replaced blocking escalation with non-blocking flow:

```
Tier 1 stream → result event (card visible) → refining event → field updates → refined event → done
```

New SSE events:
- `refining` — sent after `result`, before escalation starts
- `refined` — sent after escalation completes (with `improved`, `parsed`, `confidence`)

Changed fields are streamed individually with 50ms delays for visual effect.

### Frontend Changes

**Types** (`api/types.ts`): Added `refining`/`refined` to `StreamEvent` union, added `StreamRefinedEvent` interface.

**API client** (`client.ts`): Handle `refining`/`refined` in both `identifyTextStream()` and `identifyImageStream()` switch statements. `refined` updates `finalResult` if improved.

**Store** (`agentIdentification.ts`): Fixed `setResult()` to clear `isEscalating`.

**WineCard** (`cards/WineCard.svelte`): Added "Refining..." badge via DataCard header prop when `$isEscalating` is true.

**Identification handler** (`identification.ts`): This is where the critical bug was found and fixed. See next section.

---

## Critical Lesson: Streaming Card vs Message Card

**This lesson applies directly to the enrichment card when we tackle it.**

### The Two Rendering Paths

The agent panel has two separate ways to display wine data:

1. **Streaming card** — rendered directly in `AgentPanel.svelte` below the message list:
   ```svelte
   {#if isWineStreaming}
     <WineCard state="streaming" />
   {/if}
   ```
   Reads from the `streamingFields` store. Shows progressive field arrival during SSE stream.

2. **Message card** — rendered inside `MessageList` via `WineCardMessage.svelte`:
   ```svelte
   <WineCard state="static" data={result} confidence={confidence} />
   ```
   Reads from `message.data.result`. Shows static wine data after identification completes.

### The Transition

When identification completes:
1. `setResult()` clears `streamingFields` → streaming card disappears (`isWineStreaming` becomes false)
2. Handler calls `handleIdentificationResultFlow()` which adds a `wine_result` message → message card appears

This transition only works cleanly when the message is created **after** the stream promise resolves.

### What Went Wrong (The Bug)

The original Phase 4 implementation tried to create the message card inside the SSE `onEvent` callback:

```typescript
// BROKEN — inside onEvent callback
(event) => {
  if (event.type === 'result') {
    const wineResult = convertParsedWineToResult(event.data.parsed, event.data.confidence);
    identification.setResult(wineResult, event.data.confidence);  // Clears streaming card
    handleIdentificationResultFlow(wineResult, confidence);        // Creates message card
  }
  if (event.type === 'refining') {
    identification.startEscalation(2);  // Shows "Refining..." badge
  }
  // ...
}
```

**Result**: The message card rendered **blank** — all fields showed as skeleton/empty despite the data being present in the message object.

### Root Cause

The SSE `onEvent` callback runs synchronously within the `processSSEStream` loop. When you call `setResult()` (clears `streamingFields`) and `handleIdentificationResultFlow()` (adds message) inside this callback:

1. Svelte's reactive rendering is **batched** — it doesn't re-render synchronously after each store update
2. The streaming card disappears and message card appears in the same microtask batch
3. The `isPrecedingReady` chain (each message waits for the previous message's `isNew` to become `false`) can get confused during rapid state transitions inside callbacks
4. The message card's data is present but the component tree doesn't re-evaluate properly

### The Fix

**Don't create message cards inside SSE callbacks.** Let the streaming card handle all live display (including escalation), and only create the message card after `await` resolves:

```typescript
// WORKING — simplified approach
let escalatedResult = null;

const result = await api.identifyTextStream(
  text,
  (field, value) => {
    // Always update streaming fields — streaming card handles display
    identification.updateStreamingField(field, String(value), true);
  },
  (event) => {
    if (event.type === 'refining') {
      identification.startEscalation(2);  // "Refining..." badge on streaming card
    } else if (event.type === 'refined' && event.data.escalated) {
      escalatedResult = { parsed: event.data.parsed, confidence: event.data.confidence };
    }
    // Do NOT create message cards here!
  },
  abortController.signal,
  getRequestId()
);

// After await — safe to create message card
conversation.removeTypingMessage();

const esc = escalatedResult as { parsed: AgentParsedWine; confidence: number } | null;
const finalParsed = esc ? esc.parsed : result.parsed;
const finalConfidence = esc ? esc.confidence : result.confidence;

const wineResult = convertParsedWineToResult(finalParsed, finalConfidence);
identification.setResult(wineResult, finalConfidence);      // Clears streaming card
handleIdentificationResultFlow(wineResult, finalConfidence); // Creates message card
```

### Key Principles

1. **Streaming card = live display during stream** — field updates, "Refining..." badge
2. **Message card = final state after stream completes** — created after `await` resolves
3. **Never call `setResult()` inside onEvent** — it clears `streamingFields` which kills the streaming card mid-stream
4. **Never call message-creating functions inside onEvent** — Svelte reactivity batching + `isPrecedingReady` sequencing breaks
5. **Capture escalation results in a closure variable** — the `onEvent` callback can stash the escalated result, which the post-await code picks up

### TypeScript Gotcha

TypeScript can't track that `escalatedResult` may have been mutated inside a callback. It narrows the type to `never` after the null check. Fix with explicit type assertion:

```typescript
const esc = escalatedResult as { parsed: AgentParsedWine; confidence: number } | null;
```

### Applying to Enrichment Card

The enrichment card has the **same two-path architecture**:

```svelte
<!-- AgentPanel.svelte -->
{#if isEnrichmentStreaming}
  <EnrichmentCard state="streaming" />
{/if}
```

When optimizing the enrichment flow:
1. Use `onField` callback to update enrichment streaming fields only
2. Use `onEvent` callback only for state tracking (refining badge, etc.) — **never create message cards**
3. After `await` resolves, call `setEnrichmentResult()` then create the enrichment message card
4. The streaming → message transition should be a clean handoff after the promise resolves

---

## Files Modified

### Backend (PHP)
| File | Changes |
|------|---------|
| `resources/php/agent/config/agent.config.php` | Removed `thinking_level` from `fast` tier, reduced `max_tokens` to 1500 |
| `resources/php/agent/Identification/IdentificationService.php` | Slimmed prompts, added `getIdentificationSchema()`, added `identifyEscalateOnly()`, schema in streaming methods |
| `resources/php/agent/identifyTextStream.php` | Non-blocking escalation with refining/refined events |
| `resources/php/agent/identifyImageStream.php` | Same non-blocking escalation pattern |
| `resources/php/agent/LLM/Adapters/GeminiAdapter.php` | `response_schema` support in `buildStreamingPayload()` |

### Frontend (TypeScript/Svelte)
| File | Changes |
|------|---------|
| `qve/src/lib/api/types.ts` | `refining`/`refined` in `StreamEvent`, `StreamRefinedEvent` interface |
| `qve/src/lib/api/client.ts` | Handle `refining`/`refined` SSE events, update `finalResult` on improved |
| `qve/src/lib/agent/handlers/identification.ts` | Simplified onEvent (no message card creation), post-await result handling, escalation capture via closure |
| `qve/src/lib/stores/agentIdentification.ts` | `setResult()` clears `isEscalating` |
| `qve/src/lib/components/agent/cards/WineCard.svelte` | "Refining..." badge via `$isEscalating` (any state, not just static) |
| `qve/src/lib/components/agent/wine/WineConfidenceSection.svelte` | `isRefining` prop for pulsing animation |

### New Test Files
| File | Tests |
|------|-------|
| `resources/php/tests/StreamingFieldDetectorTest.php` | 8 unit tests |
| `resources/php/tests/IdentificationServiceTest.php` | 3 prompt tests |
| `qve/src/lib/api/__tests__/sseParser.test.ts` | 6 SSE integration tests |
| Extended `agentIdentification.test.ts` | 3 edge case tests |
| Extended `streaming.test.ts` | 4 escalation tests |

### Unchanged (intentionally)
- `text_identify.txt` / `vision_identify.txt` — kept for non-streaming escalation path via TextProcessor/VisionProcessor
- `TextProcessor.php` / `VisionProcessor.php` — non-streaming path unchanged
- `_bootstrap.php` — SSE helpers and cancellation functions unchanged
- All existing component rendering logic — WineCard/EnrichmentCard already handle streaming/static/skeleton states

---

## What's Left

- **Phase 5**: Manual testing with real wines (TTFB measurements, escalation UX)
- **Phase 6**: Enrichment card optimization (below) — same non-blocking pattern, same streaming→message card lesson applies

---

## Phase 6: Enrichment Streaming Optimization

### Problem

Enrichment has a **fundamentally different bottleneck** from identification. The streaming endpoint `agentEnrichStream.php` is **faking** streaming:

```php
// Line 71-73: Blocking call — user sees nothing for 10-30 seconds
$result = $service->enrich($identification, $confirmMatch, $forceRefresh);

// Lines 125-136: AFTER full result, fake streaming with 50ms delays
foreach ($fieldOrder as $field) {
    sendSSE('field', ['field' => $field, 'value' => $data[$field]]);
    usleep(50000);
}
```

The `WebSearchEnricher::enrich()` calls `$llmClient->complete('enrich', ...)` — a blocking, non-streaming call to Gemini 3 Pro with `web_search: true`, `max_tokens: 10000`, and `timeout: 90`. This is a **single heavy LLM call** that takes 10-30 seconds with zero visual feedback.

The frontend is **already wired for streaming** — `EnrichmentCard.svelte` has the same `skeleton | streaming | static` three-state pattern, `enrichmentStreamingFields` store, and per-section components that handle partial data. We just need the backend to actually stream.

### Solution: True LLM Streaming for Enrichment

#### 6.1 Add streaming to WebSearchEnricher

**File**: `resources/php/agent/Enrichment/WebSearchEnricher.php`
- Add new method `enrichStreaming()` alongside existing `enrich()`:

```php
/**
 * Enrich wine with streaming — fields emitted as the LLM generates them.
 *
 * @param string $producer
 * @param string $wineName
 * @param string|null $vintage
 * @param callable $onField fn(string $field, mixed $value)
 * @return EnrichmentData|null
 */
public function enrichStreaming(
    string $producer,
    string $wineName,
    ?string $vintage,
    callable $onField
): ?EnrichmentData {
    $prompt = $this->buildStreamingPrompt($producer, $wineName, $vintage);

    $options = [
        'web_search' => true,
        'temperature' => 1.0,
        'max_tokens' => 10000,
        'json_response' => true,
        'timeout' => 90,
        'response_schema' => $this->getEnrichmentSchema(),
    ];

    $response = $this->llmClient->streamComplete('enrich', $prompt, $onField, $options);

    if (!$response->success) {
        error_log("WebSearchEnricher: Streaming LLM call failed - {$response->error}");
        return null;
    }

    return $this->parseStreamingResponse($response);
}
```

**Key**: Uses `streamComplete()` instead of `complete()`. The `$onField` callback is passed through to the `StreamingFieldDetector` in `GeminiAdapter::executeStreaming()`. Fields emit to the SSE stream as the LLM generates them.

#### 6.2 Slim the enrichment streaming prompt

**File**: `resources/php/agent/Enrichment/WebSearchEnricher.php`
- Add `buildStreamingPrompt()` — shorter than the file-based prompt:

```php
private function buildStreamingPrompt(string $producer, string $wineName, ?string $vintage): string
{
    $v = $vintage ?? 'NV';
    return <<<PROMPT
Search for wine data: {$producer} {$wineName} {$v}

Return JSON with:
- grapeVarieties: [{grape, percentage}] from sources
- appellation: AOC/AVA classification
- alcoholContent: ABV as number
- drinkWindow: {start, end, maturity} (maturity: young/ready/peak/declining)
- criticScores: [{critic, score, year}] — WS, RP, Decanter, JS only, 100-point scale
- productionMethod: notable methods (oak aging etc)
- body/tannin/acidity/sweetness: style descriptors
- overview: 3-4 sentences on character and reputation
- tastingNotes: 3-4 sentences on aromas, palate, finish
- pairingNotes: 3-4 sentences with specific food pairings

Use null for unverified fields. Only include data from reputable sources.
PROMPT;
}
```

This is ~500 chars vs ~1400 chars — fewer input tokens for faster TTFB.

#### 6.3 Add responseSchema for enrichment

**File**: `resources/php/agent/Enrichment/WebSearchEnricher.php`
- Add schema method:

```php
private function getEnrichmentSchema(): array
{
    return [
        'type' => 'OBJECT',
        'properties' => [
            'grapeVarieties' => [
                'type' => 'ARRAY', 'nullable' => true,
                'items' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'grape' => ['type' => 'STRING'],
                        'percentage' => ['type' => 'INTEGER', 'nullable' => true],
                    ],
                ],
            ],
            'appellation'      => ['type' => 'STRING', 'nullable' => true],
            'alcoholContent'   => ['type' => 'NUMBER', 'nullable' => true],
            'drinkWindow' => [
                'type' => 'OBJECT', 'nullable' => true,
                'properties' => [
                    'start' => ['type' => 'INTEGER'],
                    'end'   => ['type' => 'INTEGER'],
                    'maturity' => ['type' => 'STRING', 'nullable' => true,
                                   'enum' => ['young', 'ready', 'peak', 'declining']],
                ],
            ],
            'criticScores' => [
                'type' => 'ARRAY', 'nullable' => true,
                'items' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'critic' => ['type' => 'STRING'],
                        'score'  => ['type' => 'INTEGER'],
                        'year'   => ['type' => 'INTEGER', 'nullable' => true],
                    ],
                ],
            ],
            'productionMethod' => ['type' => 'STRING', 'nullable' => true],
            'body'             => ['type' => 'STRING', 'nullable' => true],
            'tannin'           => ['type' => 'STRING', 'nullable' => true],
            'acidity'          => ['type' => 'STRING', 'nullable' => true],
            'sweetness'        => ['type' => 'STRING', 'nullable' => true],
            'overview'         => ['type' => 'STRING', 'nullable' => true],
            'tastingNotes'     => ['type' => 'STRING', 'nullable' => true],
            'pairingNotes'     => ['type' => 'STRING', 'nullable' => true],
        ],
    ];
}
```

#### 6.4 Update agentEnrichStream.php to use true streaming

**File**: `resources/php/agent/agentEnrichStream.php`
Replace the blocking `$service->enrich()` call with a streaming path:

```php
// Check cache first (fast path — no LLM needed)
$cacheResult = $service->checkCache($identification, $confirmMatch);

if ($cacheResult) {
    if ($cacheResult->pendingConfirmation) {
        // Cache match needs confirmation — same as current flow
        sendSSE('confirmation_required', [
            'matchType' => $cacheResult->matchType ?? 'unknown',
            'searchedFor' => $cacheResult->searchedFor ?? null,
            'matchedTo' => $cacheResult->matchedTo ?? null,
            'confidence' => $cacheResult->confidence ?? 0,
        ]);
        sendSSE('done', []);
        exit;
    }

    // Cache hit — emit fields with delays (fast, no LLM needed)
    $data = $cacheResult->data->toArray();
    foreach ($fieldOrder as $field) {
        if (isset($data[$field]) && $data[$field] !== null) {
            sendSSE('field', ['field' => $field, 'value' => $data[$field]]);
            usleep(50000);
        }
    }
    sendSSE('result', $cacheResult->toArray());
    sendSSE('done', []);
    exit;
}

// Cache miss — stream from LLM
$enricher = getAgentWebSearchEnricher(getAgentUserId());
$enrichmentData = $enricher->enrichStreaming(
    $body['producer'],
    $body['wineName'],
    $body['vintage'] ?? null,
    function ($field, $value) {
        // WIN-227: Stop streaming if client cancelled
        if (isRequestCancelled()) {
            return;
        }
        sendSSE('field', ['field' => $field, 'value' => $value]);
    }
);

if (!$enrichmentData) {
    sendSSE('error', [
        'type' => 'enrichment_error',
        'message' => 'Could not enrich wine data',
        'retryable' => true,
    ]);
    sendSSE('done', []);
    exit;
}

// Validate, cache, and send result
$result = $service->processEnrichmentResult($enrichmentData, $identification, $forceRefresh);
sendSSE('result', $result->toArray());
sendSSE('done', []);
```

**Key architectural change**: Split `EnrichmentService::enrich()` into:
1. `checkCache()` — cache lookup + canonical resolution (fast, no LLM)
2. `processEnrichmentResult()` — validation, caching, merge (post-LLM processing)

This lets the streaming endpoint control the flow: cache check → stream from LLM → post-process.

#### 6.5 Add StreamingFieldDetector target fields for enrichment

**File**: `resources/php/agent/LLM/Streaming/StreamingFieldDetector.php`
- The detector's `targetFields` are currently set for identification fields. For enrichment streaming, the calling code needs to pass enrichment-specific target fields:

```php
$targetFields = [
    'body', 'tannin', 'acidity', 'sweetness',     // Style fields (small, fast)
    'grapeVarieties', 'alcoholContent',              // Structured data
    'drinkWindow', 'criticScores',                   // Complex objects
    'productionMethod',
    'overview', 'tastingNotes', 'pairingNotes',      // Narrative (last, longest)
];
```

The field order in the detector determines which fields the UI shows first. Style profile fields (body, tannin, acidity) are single words that arrive in the first few tokens — the user sees immediate feedback.

#### 6.6 GeminiAdapter: responseSchema + web_search compatibility

**Gotcha**: Gemini's `web_search` tool (Google Search grounding) may have limitations when combined with `responseSchema`. If the API rejects this combination:
- **Fallback**: Keep `json_response: true` without schema for enrichment streaming
- **Test this first** before committing to schema

**File**: `resources/php/agent/LLM/Adapters/GeminiAdapter.php`
- In `buildStreamingPayload()`, if both `web_search` and `response_schema` are set, prefer `response_schema` but fall back to `json_response` if the API errors.

### Frontend Changes (Minimal)

The enrichment frontend is **already wired** for streaming. The key components:

- `EnrichmentCard.svelte` — already supports `skeleton | streaming | static` states
- `enrichmentStreamingFields` store — already has `updateEnrichmentStreamingField()`
- `enrichment.ts` handler — already passes `onField` callback to `api.enrichWineStream()`
- All section components (`OverviewSection`, `StyleProfileSection`, etc.) — already handle partial data via `DataCard` slot props

**No frontend changes needed** for basic streaming. The current `onField` callback in `executeEnrichment()` (enrichment.ts:208) already calls `enrichment.updateEnrichmentStreamingField()`.

The only potential enhancement:
- The `EnrichmentCard.svelte` header currently shows "Researching..." during streaming (line 65-66). This is already correct. No badge change needed unlike identification's "Refining..." because enrichment doesn't have escalation tiers.

### EnrichmentService Refactoring

**File**: `resources/php/agent/Enrichment/EnrichmentService.php`
Extract from `enrich()` method into two new public methods:

```php
/**
 * Check cache only (no LLM call).
 * Returns EnrichmentResult if cache hit or pending confirmation.
 * Returns null if cache miss.
 */
public function checkCache(array $identification, bool $confirmMatch): ?EnrichmentResult

/**
 * Post-process enrichment data from streaming LLM response.
 * Validates, caches, and returns final result.
 */
public function processEnrichmentResult(
    EnrichmentData $data,
    array $identification,
    bool $forceRefresh
): EnrichmentResult
```

The existing `enrich()` method remains unchanged for the non-streaming fallback path.

### Risk Analysis

| Risk | Severity | Mitigation |
|------|----------|------------|
| **web_search + responseSchema incompatibility** | Medium | Test first; fall back to `json_response: true` without schema |
| **web_search + streamGenerateContent** | Medium | Verify Gemini 3 Pro supports streaming with grounding. If not, keep faked streaming for web search calls |
| **EnrichmentService refactor breaks non-streaming** | Low | Keep `enrich()` unchanged; new methods are additive |
| **StreamingFieldDetector needs different target fields** | Low | Pass target fields as parameter, already designed for this |
| **Cancellation during enrichment streaming** | Low | `isRequestCancelled()` checks already in place via WIN-227 |

### Verification

- Run existing enrichment tests
- Test cache hit path (should be fast, no regression)
- Test cache miss path with streaming (fields appear progressively)
- Test `confirmation_required` path (canonical name resolution)
- Manual test: "Learn More" on Château Margaux → style fields appear within 2-3s, full data within 8-10s (down from 15-30s of nothing)

### Phase 6 Files Modified

| File | Changes |
|------|---------|
| `resources/php/agent/Enrichment/WebSearchEnricher.php` | New `enrichStreaming()`, `buildStreamingPrompt()`, `getEnrichmentSchema()` |
| `resources/php/agent/Enrichment/EnrichmentService.php` | New `checkCache()`, `processEnrichmentResult()` (extracted from `enrich()`) |
| `resources/php/agent/agentEnrichStream.php` | True streaming: cache check → stream from LLM → post-process |
| `resources/php/agent/LLM/Adapters/GeminiAdapter.php` | Handle `response_schema` + `web_search` gracefully in `buildStreamingPayload()` |

### Implementation Order Update

```
Phase 0 → Phase 1 + 3 → Phase 2 → Phase 4 → Phase 6 → Phase 5
 tests    thinking+schema  prompt   escalation  enrichment  verify
```

Phase 6 comes after Phase 4 because:
- It builds on the `responseSchema` support added in Phase 3
- The `buildStreamingPayload()` changes from Phase 3 benefit enrichment
- It can reuse test patterns established in Phase 0
- Phase 5 (verification) runs last to validate everything together

---

## Phase 6 Implementation Summary

**Status**: Complete

### What Was Done

Converted enrichment from fake-streaming (blocking LLM call, then emitting fields with delays) to true LLM streaming with in-place card updates and token-level text streaming.

### Backend Changes

| File | Change |
|------|--------|
| `WebSearchEnricher.php` | Added `enrichStreaming()` with `response_schema` + `googleSearch` grounding on `gemini-3-flash-preview` + `thinkingLevel: MEDIUM`. Added `getEnrichmentSchema()` (lowercase types, `propertyOrdering`, `nullable: true`), `buildStreamingPrompt()`, `parseStreamingResponse()`. Citation marker cleanup in `cleanAndParseJSON()`. |
| `EnrichmentService.php` | Added `getEnricher()`, `checkCache()` (extracted cache-only lookup), `processEnrichmentResult()` (extracted post-LLM processing: sanitize, validate, cache, merge). |
| `agentEnrichStream.php` | Rewritten: Step 1 cache fast path → Step 2 `enricher->enrichStreaming()` with real-time `onField` callback → Step 3 `processEnrichmentResult()`. WIN-227 cancellation preserved. |
| `GeminiAdapter.php` | `buildStreamingPayload()` now supports `web_search` (→ `googleSearch` camelCase), `response_schema`, `target_fields`, `thinking_level`. All `google_search` references changed to `googleSearch` across complete/streaming/formatTools. |
| `IdentificationService.php` | `getIdentificationSchema()` updated: lowercase types + `propertyOrdering` for consistent REST API format. |
| `geminiAPI.php` | `google_search` → `googleSearch` for legacy endpoint. |

### Frontend Changes

| File | Change |
|------|--------|
| `enrichment.ts` | Single message card updated in-place via `conversation.updateMessage()`. 7-second delay before card appears (LLM only). `text_delta` events update narrative fields with typewriter effect. Complex field values serialized with `JSON.stringify` (not `String()`). |
| `EnrichmentCard.svelte` | Unified card supporting skeleton and static states, updated reactively during streaming. |
| `DataCard.svelte` | Slot props use `$: getFieldValue = (field) => { ... }` reactive assignment (not `export function`) for in-place update reactivity. |

### Key Gemini REST API Learnings

- `googleSearch` (camelCase) — snake case `google_search` silently fails
- Schema types must be lowercase (`object`, `string`, not `OBJECT`, `STRING`) — uppercase causes looping output
- `nullable: true` (not `["type", "null"]`) — REST protobuf rejects type arrays
- `propertyOrdering` — controls field output order, critical for streaming field detection
- `response_schema` + `googleSearch` + streaming works on `gemini-3-flash-preview` with `thinkingLevel: MEDIUM` (not reliable on pro-preview)
- Grounding metadata is empty with `responseSchema` — use fixed confidence (0.7)
- Citation markers `[[1](url)]` injected by Google Search grounding — strip with regex before JSON parsing

### Tests Added

- `resources/php/tests/EnrichmentStreamingTest.php` — 64 assertions covering StreamingFieldDetector with enrichment fields, schema structure (lowercase types, propertyOrdering, nullable), prompt generation

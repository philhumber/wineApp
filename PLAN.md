# Optimize Identification Workflow — Implementation Plan

**Branch**: `claude/optimize-identification-workflow-X2NcF` (based on `develop`)
**Baseline**: Run `npx vitest run` from `qve/` after `npx svelte-kit sync` — track pass count before changes

---

## Problem Statement

The wine identification workflow feels slow and unresponsive. The user types a wine description or takes a photo, then stares at "Thinking..." for 3-10+ seconds before seeing anything. The root causes are:

1. **Invisible thinking tokens** — Tier 1 uses `thinking_level: LOW` with 4000 token budget. The model thinks for 1-2s before streaming starts. Dead air.
2. **Bloated fast-path prompt** — `buildIdentificationPrompt()` (IdentificationService.php:572-592) includes `confidenceRationale` field and verbose instructions. More input tokens + more output tokens = higher TTFB.
3. **Blocking escalation** — When Tier 1 confidence < 85%, both streaming endpoints call `$service->identify($input)` which runs the **full** 4-tier escalation (Tier 1 *again* + 1.5 + 2) with zero visual feedback beyond "Looking deeper...".
4. **No responseSchema** — Using `json_response: true` (→ `responseMimeType: 'application/json'`) without a schema means the model doesn't know the shape upfront, potentially hurting streaming granularity.

---

## Existing Architecture (on `develop`)

Key features already in place that our changes must integrate with:

| Feature | What it does | Must preserve |
|---------|-------------|---------------|
| **WIN-227: Cancellation** | Token-file coordination (`isRequestCancelled()`), `AbortController` on frontend, `curl_multi` loops in `makeRequest()`, WRITEFUNCTION abort in streaming | All cancellation checkpoints in escalation and streaming |
| **WIN-253: API Key Security** | `x-goog-api-key` header instead of URL param in GeminiAdapter | Header auth pattern |
| **WIN-254: Auth** | `getAgentUserId()` in `_bootstrap.php`, 401 handling in API client | Server-authoritative userId |
| **SSE Infrastructure** | `initSSE()`, `sendSSE()`, `sendSSEError()`, `registerCancelCleanup()` in `_bootstrap.php` | All SSE helpers |
| **Streaming Field Detection** | `StreamingFieldDetector` parses incremental JSON in GeminiAdapter WRITEFUNCTION | Field detection pipeline |

### Current Streaming Flow (identifyTextStream.php)

```
1. initSSE() + registerCancelCleanup()
2. $service->identifyStreaming($input, onFieldCallback)  → Tier 1 only, streams fields via SSE
3. if confidence < 85%:
   a. Check isRequestCancelled() → bail if cancelled
   b. sendSSE('escalating', ...)
   c. $service->identify($input)  → BLOCKING: re-runs Tier 1 + 1.5 + 2
   d. Send escalated fields with 50ms delays
4. sendSSE('result', ...)
5. sendSSE('done', ...)
```

The blocking `identify()` call at step 3c is the primary UX problem — it redundantly re-runs Tier 1 and can take 5-15 seconds.

### Current identifyStreaming() (IdentificationService.php:324-437)

- Reads from `$this->config['model_tiers']['fast']` which includes `thinking_level: LOW`
- Uses `buildIdentificationPrompt()` which includes `confidenceRationale`
- Passes `json_response: true` (no schema)
- On failure: falls back to full `identify()` if not cancelled

---

## Solution Overview

Four coordinated changes across backend and frontend:

| Change | Impact | Risk | Files |
|--------|--------|------|-------|
| **A. Remove thinking from Tier 1 streaming** | Eliminates 1-2s invisible delay | Low — Flash is accurate for well-known wines without thinking | Config + IdentificationService |
| **B. Slim the streaming prompt** | Faster TTFB, fewer input tokens | Low — keep full prompt in escalation path | IdentificationService |
| **C. Add responseSchema** | Structured output + better streaming granularity + guaranteed JSON | Low — Gemini 3 Flash supports this | GeminiAdapter + IdentificationService |
| **D. Non-blocking escalation** | Eliminates 5-15s freezes; show Tier 1 result immediately, refine in background | **Medium** — new SSE events, frontend state changes, cancellation integration | Streaming endpoints + API client + handlers + stores + WineCard |

---

## Phase 0: Stabilization Tests (Write BEFORE any changes)

Write tests that verify current behavior so we know immediately if a change breaks something.

### 0.1 PHP: StreamingFieldDetector unit tests
**File**: `resources/php/agent/LLM/Streaming/StreamingFieldDetectorTest.php`

Tests to write:
- `testExtractsProducerFromPartialJson` — feed chunks like `{"producer": "Château` then ` Margaux",` and verify field detected after closing quote
- `testExtractsArrayField` — grapes: `["Cab`, `ernet Sauvignon", "Merlot"]` detected after `]`
- `testExtractsNumberField` — confidence: `92` detected after terminator
- `testHandlesNullField` — `"vintage": null,` not emitted (returns PHP null)
- `testMultipleFieldsInOneChunk` — entire JSON in one chunk emits all target fields
- `testFieldOrderPreserved` — fields emitted in targetFields order, not JSON order
- `testTryParseCompleteWithValidJson` — accumulated text parses as complete JSON
- `testTryParseCompleteWithPartialJson` — returns null when incomplete

### 0.2 Frontend: agentIdentification store streaming tests
**File**: `qve/src/lib/stores/__tests__/agentIdentification.test.ts` (extend existing)

Tests to add:
- `should accumulate streaming fields progressively` — call `updateStreamingField` for producer, then wineName, verify Map grows
- `should mark isStreaming true when any field is typing` — verify derived store
- `should mark isStreaming false when all fields complete` — call `completeStreamingField` on all
- `should clear streaming fields on startIdentification` — verify Map resets
- `should handle escalation state transitions` — `startEscalation(2)` → `isEscalating` true → `completeEscalation()`

### 0.3 Frontend: Streaming integration tests
**File**: `qve/src/lib/agent/__tests__/streaming.test.ts` (extend existing)

Tests to add:
- `should display Tier 1 result immediately when high confidence` — mock API returning 90% confidence, verify `setResult` called, phase → `confirming`
- `should handle escalation event in stream` — mock API that sends field events, then escalating event, then improved fields, then result
- `should preserve Tier 1 fields during escalation` — verify fields from Tier 1 remain visible while escalation runs
- `should handle cancellation during identification` — mock API that throws AbortError, verify no error UI shown

### 0.4 Frontend: SSE processSSEStream tests
**File**: `qve/src/lib/api/__tests__/sseParser.test.ts` (new)

Tests to write:
- `should parse field events` — mock ReadableStream with SSE format, verify onEvent called with correct field/value
- `should parse result event` — verify final result parsed correctly
- `should handle escalating event` — verify event type received
- `should handle chunked SSE data` — SSE event split across multiple `reader.read()` calls
- `should handle connection errors gracefully` — stream errors mid-way
- `should respect AbortSignal` — verify stream aborts when signal fires

### 0.5 PHP: Prompt generation tests
**File**: `resources/php/agent/Identification/IdentificationServiceTest.php` (new)

Tests to write:
- `testBuildIdentificationPromptContainsInput` — verify user text appears in prompt
- `testBuildVisionPromptIncludesSupplementaryText` — verify optional text appended
- `testBuildVisionPromptWithoutSupplementaryText` — verify clean prompt without extra text

---

## Phase 1: Remove thinking from Tier 1 streaming (Change A)

### Rationale
Gemini 3 Flash with `thinking_level: LOW` adds 1-2s of invisible latency before the first token streams. For the fast path (~80% of requests), the model doesn't need to think — "2019 Château Margaux" is immediate recognition. Thinking remains valuable for Tier 1.5 (escalation) where accuracy matters more.

### Changes

**File**: `resources/php/agent/config/agent.config.php`
- Add a new `streaming_fast` tier to `model_tiers`:
```php
'streaming_fast' => [
    'provider' => 'gemini',
    'model' => 'gemini-3-flash-preview',
    // No thinking_level — optimized for lowest TTFB in streaming
    'description' => 'Streaming-optimized: no thinking tokens, fast TTFB',
    'temperature' => 0.3,
    'max_tokens' => 1500,  // JSON output is ~200 tokens, no thinking budget needed
],
```
- Add tier reference to `streaming` config:
```php
'streaming' => [
    'enabled' => true,
    'tier' => 'streaming_fast',  // NEW — dedicated streaming tier
    'tasks' => ['identify_text', 'identify_image', 'enrich'],
    'tier1_only' => true,
    'fallback_on_error' => true,
    'timeout' => 30,
],
```

**File**: `resources/php/agent/Identification/IdentificationService.php`
- In `identifyStreaming()` (lines 348-361): Use `streaming_fast` tier instead of `fast`:

```php
// Use dedicated streaming tier (no thinking for fastest TTFB)
$tierConfig = $this->config['model_tiers'][$this->config['streaming']['tier'] ?? 'fast'] ?? [];
$options = [
    'provider' => $tierConfig['provider'] ?? 'gemini',
    'model' => $tierConfig['model'] ?? 'gemini-3-flash-preview',
    'temperature' => $tierConfig['temperature'] ?? 0.3,
    'max_tokens' => $tierConfig['max_tokens'] ?? 1500,
    'json_response' => true,
];

// Only add thinking_level if configured in tier (streaming_fast omits it)
if (isset($tierConfig['thinking_level'])) {
    $options['thinking_level'] = $tierConfig['thinking_level'];
}
```

- Apply same change in `identifyStreamingImage()` (lines ~460-475)

### Risk
- Slightly lower accuracy for obscure wines on Tier 1. Mitigated by: escalation still uses thinking (Tier 1.5 = HIGH thinking). The 85% threshold catches low-confidence results.

### Verification
- Run existing streaming tests — must pass
- Manual test: well-known wine should show first field in <1s

---

## Phase 2: Slim the streaming prompt (Change B)

### Rationale
Current `buildIdentificationPrompt()` (lines 572-592) is ~575 chars and requests `confidenceRationale` (extra ~20-50 output tokens). The file-based `text_identify.txt` prompt used by `TextProcessor` is 1400+ chars with examples. For streaming, we want the minimum prompt — fewer input tokens = lower TTFB.

### Changes

**File**: `resources/php/agent/Identification/IdentificationService.php`
- Add new `buildStreamingPrompt()` alongside existing `buildIdentificationPrompt()`:

```php
/**
 * Build optimized prompt for streaming identification.
 * Minimal input tokens for fastest TTFB. No confidenceRationale.
 */
private function buildStreamingPrompt(string $text): string
{
    return <<<PROMPT
Identify this wine. Return JSON: producer, wineName, vintage, region, country, wineType, grapes (array), confidence (0-100).

Rules:
- confidence 80-100: wines you RECOGNIZE as real, existing wines
- confidence <50: not a real wine you recognize
- Single-wine estates (Opus One, Château Margaux): wineName = producer
- null for unknown fields

TEXT: {$text}
PROMPT;
}
```

- Add new `buildStreamingVisionPrompt()`:
```php
private function buildStreamingVisionPrompt(?string $supplementaryText = null): string
{
    $prompt = <<<PROMPT
Identify this wine from the label. Return JSON: producer, wineName, vintage, region, country, wineType, grapes (array), confidence (0-100).

Rules:
- confidence 80-100: wines you RECOGNIZE from the label
- confidence <50: unreadable or not a wine label
- null for unknown fields
PROMPT;

    if ($supplementaryText) {
        $prompt .= "\n\nUser context: {$supplementaryText}";
    }
    return $prompt;
}
```

- Update `identifyStreaming()` line 346 to call `buildStreamingPrompt()` instead of `buildIdentificationPrompt()`
- Update `identifyStreamingImage()` similarly

- **Keep** `buildIdentificationPrompt()` and `buildVisionPrompt()` unchanged for non-streaming escalation path

### Key differences from current prompt:
- Removes `confidenceRationale` field (saves ~20-50 output tokens)
- Removes verbose field descriptions (model knows what "producer" and "vintage" mean)
- Condenses confidence rules to 2 lines
- Total: ~220 chars vs ~575 chars = ~60% fewer input tokens

### Risk
- Slightly less precise confidence on edge cases. Mitigated by: `responseSchema` (Phase 3) constrains output; escalation uses full prompt.
- No `confidenceRationale` in streaming. This is intentional — it's extra tokens that slow TTFB and the value is only for debugging.

### Verification
- Run Phase 0 prompt tests
- Manual test: compare confidence for 5 known wines between old and new prompt

---

## Phase 3: Add responseSchema (Change C)

### Rationale
Gemini 3 Flash supports `responseSchema` which constrains output to a specific JSON shape at the API level. Benefits:
1. Guarantees valid JSON (no risk of free text, markdown wrapping, or extra fields)
2. Model knows the shape upfront → potentially better streaming granularity
3. Prevents `confidenceRationale` or other unschematized fields from leaking in
4. Works with `streamGenerateContent` on Gemini 3 models

### Changes

**File**: `resources/php/agent/Identification/IdentificationService.php`
- Define the schema as a class constant or private method:

```php
private function getIdentificationSchema(): array
{
    return [
        'type' => 'OBJECT',
        'properties' => [
            'producer'   => ['type' => 'STRING', 'nullable' => true],
            'wineName'   => ['type' => 'STRING', 'nullable' => true],
            'vintage'    => ['type' => 'STRING', 'nullable' => true],
            'region'     => ['type' => 'STRING', 'nullable' => true],
            'country'    => ['type' => 'STRING', 'nullable' => true],
            'wineType'   => ['type' => 'STRING', 'nullable' => true,
                             'enum' => ['Red', 'White', 'Rosé', 'Sparkling', 'Dessert', 'Fortified']],
            'grapes'     => ['type' => 'ARRAY', 'nullable' => true, 'items' => ['type' => 'STRING']],
            'confidence' => ['type' => 'INTEGER'],
        ],
        'required' => ['confidence'],
    ];
}
```

- In `identifyStreaming()`, replace `'json_response' => true` with `'response_schema'`:

```php
$options = [
    'provider' => $tierConfig['provider'] ?? 'gemini',
    'model' => $tierConfig['model'] ?? 'gemini-3-flash-preview',
    'temperature' => $tierConfig['temperature'] ?? 0.3,
    'max_tokens' => $tierConfig['max_tokens'] ?? 1500,
    'response_schema' => $this->getIdentificationSchema(),
    // json_response not needed — response_schema implies application/json
];
```

- Apply same change in `identifyStreamingImage()`

**File**: `resources/php/agent/LLM/Adapters/GeminiAdapter.php`
- In `buildStreamingPayload()` (lines ~304-344), add `response_schema` support:

```php
// After the json_response block (line ~331-333):
if (!empty($options['response_schema'])) {
    $payload['generationConfig']['responseMimeType'] = 'application/json';
    $payload['generationConfig']['responseSchema'] = $options['response_schema'];
}
```

This parallels the existing support in `complete()` (lines 108-111) which already handles `response_schema`. We're extending it to the streaming path.

### Risk
- Very low. Additive change — schema constrains output more tightly.
- Must verify Gemini 3 Flash supports `responseSchema` with `streamGenerateContent`. If not supported, it should be silently ignored and `json_response` serves as fallback.

### Verification
- Run StreamingFieldDetector tests — fields detected correctly from schema-constrained JSON
- Manual test: verify no extra fields in response, valid JSON guaranteed

---

## Phase 4: Non-blocking escalation (Change D)

This is the biggest change and biggest UX win.

### New Architecture

**Current flow** (blocking):
```
Tier 1 stream → [confidence < 85%] → "Looking deeper..." → identify() re-runs Tier 1 + 1.5 + 2 → result
                                      ╰───────── 5-15 seconds of nothing ──────────╯
```

**New flow** (non-blocking):
```
Tier 1 stream → show result immediately → "refining" event → Tier 1.5 → Tier 2 → "refined" event
                ╰── card visible in ~2s ──╯                  ╰── fields update live ──╯
```

### New SSE Event Types

| Event | When | Data |
|-------|------|------|
| `refining` | After `result`, before escalation starts | `{ message, tier1_confidence }` |
| `refined` | After escalation completes | `{ improved, parsed, confidence, action, escalation }` |

Full event sequence:
```
event: field      → {"field":"producer","value":"Château Margaux"}
event: field      → {"field":"wineName","value":"Château Margaux"}
event: field      → ...more fields...
event: field      → {"field":"confidence","value":72}
event: result     → {full Tier 1 result}          ← Card shown NOW
event: refining   → {"message":"Refining..."}     ← Badge appears on card
event: field      → {"field":"confidence","value":91}  ← Live update
event: refined    → {full escalated result}       ← Badge removed, chips may update
event: done       → {}
```

### Backend Changes

**File**: `resources/php/agent/Identification/IdentificationService.php`
- Add new method `identifyEscalateOnly()`:

```php
/**
 * Run escalation tiers only (1.5 → 2), skipping Tier 1.
 * Used after streaming Tier 1 has already run.
 *
 * @param array $input Original input
 * @param array $tier1Result Result from Tier 1 streaming
 * @return array Escalated result
 */
public function identifyEscalateOnly(array $input, array $tier1Result): array
```

This extracts the Tier 1.5 → Tier 2 → User Choice logic from `identifyFromText()` (lines 702-810) into a reusable method. It:
- Accepts the Tier 1 result as escalation context
- Starts at Tier 1.5 (HIGH thinking)
- Respects `isRequestCancelled()` checkpoints (WIN-227)
- Returns the best result across tiers
- Does NOT re-run Tier 1

For image input, add `identifyImageEscalateOnly()` that extracts from `identifyFromImage()`.

**File**: `resources/php/agent/identifyTextStream.php`
Replace the escalation block (lines 84-158) with non-blocking flow:

```php
// Always emit Tier 1 confidence and result FIRST
if (isset($result['confidence'])) {
    sendSSE('field', ['field' => 'confidence', 'value' => $result['confidence']]);
}

sendSSE('result', [
    'inputType' => 'text',
    'intent' => $result['intent'] ?? 'add',
    'parsed' => $result['parsed'],
    'confidence' => $result['confidence'],
    'action' => $result['action'],
    'candidates' => $result['candidates'] ?? [],
    'usage' => $result['usage'] ?? null,
    'escalation' => $result['escalation'] ?? null,
    'inferences_applied' => $result['inferences_applied'] ?? [],
    'streamed' => true,
]);

// If confidence below threshold, run escalation and stream refinements
$tier1Threshold = $config['confidence']['tier1_threshold'] ?? 85;
if ($result['confidence'] < $tier1Threshold) {
    // WIN-227: Skip escalation if client cancelled
    if (isRequestCancelled()) {
        error_log("[Agent] identifyText: CANCELLED before refinement");
        sendSSE('done', []);
        exit;
    }

    sendSSE('refining', [
        'message' => 'Refining identification...',
        'tier1_confidence' => $result['confidence'],
    ]);

    // Escalate from Tier 1.5 onwards (skip redundant Tier 1 re-run)
    $escalatedResult = $service->identifyEscalateOnly($input, $result);

    if ($escalatedResult['success'] && $escalatedResult['confidence'] > $result['confidence']) {
        // Stream improved fields
        $parsed = $escalatedResult['parsed'] ?? [];
        $fieldOrder = ['producer', 'wineName', 'vintage', 'region', 'country', 'wineType', 'grapes'];
        foreach ($fieldOrder as $field) {
            if (isset($parsed[$field]) && $parsed[$field] !== null) {
                sendSSE('field', ['field' => $field, 'value' => $parsed[$field]]);
                usleep(50000); // 50ms between fields for visual effect
            }
        }
        if (isset($escalatedResult['confidence'])) {
            sendSSE('field', ['field' => 'confidence', 'value' => $escalatedResult['confidence']]);
        }
        $finalResult = $escalatedResult;
    } else {
        $finalResult = $result;
    }

    sendSSE('refined', [
        'improved' => $escalatedResult['success'] && $escalatedResult['confidence'] > $result['confidence'],
        'parsed' => $finalResult['parsed'],
        'confidence' => $finalResult['confidence'],
        'action' => $finalResult['action'],
        'escalation' => $finalResult['escalation'] ?? null,
    ]);
}

// Logging + done (unchanged from current code)
```

**File**: `resources/php/agent/identifyImageStream.php`
- Same refactoring as text endpoint above.

### Frontend Changes

**File**: `qve/src/lib/api/client.ts`
- In `identifyTextStream()` and `identifyImageStream()`, handle new SSE event types in the event switch:

```typescript
case 'refining':
    onEvent?.({ type: 'refining', data: event.data });
    break;
case 'refined':
    // Update final result with escalated data
    if (event.data.improved && event.data.parsed) {
        finalResult = {
            ...finalResult,
            parsed: event.data.parsed,
            confidence: event.data.confidence,
            action: event.data.action,
            escalation: event.data.escalation,
            escalated: true,
        };
    }
    onEvent?.({ type: 'refined', data: event.data });
    break;
```

**Important**: The existing `signal` / `AbortSignal` parameters (WIN-227) remain unchanged. The `onField` callback continues to work — refined fields arrive as normal `field` events.

**File**: `qve/src/lib/agent/handlers/identification.ts`
- In `executeTextIdentification()` (lines ~338-372): Split the flow into two phases:

**Phase 1** — Tier 1 result arrives via `result` SSE event:
- Call `handleIdentificationResultFlow()` immediately
- Show wine card with whatever confidence we have

**Phase 2** — If `refining` event arrives:
- Set `identification.startEscalation(2)` → `isRefining = true`
- Card shows "Refining..." badge
- Continue receiving `field` events that update the card live
- When `refined` event arrives: update result via `identification.setResult()`, call `handleIdentificationResultFlow()` again to update chips if action changed
- Set `identification.completeEscalation()` → `isRefining = false`

**Key guard**: If the user has already acted (clicked "Correct", "Add to Cellar", etc.) before `refined` arrives — check that phase is still `confirming` before updating. If phase has advanced, ignore the refined result.

Implementation approach: Use the existing `onEvent` callback to detect `refining`/`refined`, and handle the Tier 1 `result` event inline:

```typescript
let tier1Resolved = false;

const result = await api.identifyTextStream(
    text,
    (field, value) => {
        identification.updateStreamingField(field, String(value), true);
    },
    (event) => {
        if (event.type === 'result' && !tier1Resolved) {
            tier1Resolved = true;
            // Show Tier 1 result immediately
            conversation.removeTypingMessage();
            const wineResult = convertParsedWineToResult(event.data.parsed, event.data.confidence);
            identification.setResult(wineResult, event.data.confidence);
            handleIdentificationResultFlow(wineResult, event.data.confidence ?? 1);
        }
        if (event.type === 'refining') {
            identification.startEscalation(2);
        }
        if (event.type === 'refined' && event.data.improved) {
            const currentPhase = conversation.getCurrentPhase();
            if (currentPhase === 'confirming') {
                const wineResult = convertParsedWineToResult(event.data.parsed, event.data.confidence);
                identification.setResult(wineResult, event.data.confidence);
                handleIdentificationResultFlow(wineResult, event.data.confidence ?? 1);
            }
            identification.completeEscalation();
        }
    },
    signal,
    requestId
);
```

- Apply same pattern to `executeImageIdentification()`

**File**: `qve/src/lib/stores/agentIdentification.ts`
- Add `isRefining` derived store (convenience for UI). The existing `isEscalating` store already tracks this — we can alias or use directly:

```typescript
// isEscalating already exists and is set by startEscalation()/completeEscalation()
// The WineCard can subscribe to this directly
```

No new state needed — `isEscalating` + `escalationTier` already exist in the store.

**File**: `qve/src/lib/components/agent/cards/WineCard.svelte`
- Subscribe to `isEscalating` store
- Show subtle "Refining..." indicator:

```svelte
<script>
    import { isEscalating } from '$lib/stores/agentIdentification';
</script>

{#if $isEscalating && state !== 'skeleton'}
    <div class="refining-badge" transition:fade={{ duration: 200 }}>
        <span class="refining-dot"></span> Refining...
    </div>
{/if}
```

**File**: `qve/src/lib/components/agent/wine/WineConfidenceSection.svelte`
- When `isEscalating` is true, add a pulsing animation to the confidence indicator to signal it may change.

### Risk Analysis

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Race: user acts during refining** | Medium | Guard: only update if phase is still `confirming` |
| **Race: refined changes action** | Low | `handleIdentificationResultFlow()` replaces chips — already handles re-calling |
| **Mobile tab switch during refining** | Low | Session persistence saves Tier 1 result. User sees valid result on return. |
| **Cancellation during refining** | Low | `isRequestCancelled()` checkpoints in `identifyEscalateOnly()` from WIN-227. Frontend AbortController cancels stream. |
| **Escalation worse than Tier 1** | Low | Only update if `escalatedResult.confidence > result.confidence` |
| **Double handleIdentificationResultFlow** | Low | Function already removes old chips before adding new ones |

### Verification
- Run all Phase 0 tests + existing 675 tests
- New integration test: mock API with refining/refined events
- Manual test: obscure wine → see Tier 1 result quickly, "Refining..." badge, result improves

---

## Phase 5: Verification & Cleanup

### 5.1 Full test suite
- `cd qve && npx svelte-kit sync && npx vitest run` — must not regress from baseline
- `cd qve && npm run check` — TypeScript must pass
- `cd qve && npm run build` — production build must succeed

### 5.2 Manual test matrix

| Scenario | Expected Behavior |
|----------|-------------------|
| Well-known wine text ("2019 Château Margaux") | Fields stream in <1s, result card in <2s, no escalation |
| Obscure wine text ("Domaine Leflaive Bâtard-Montrachet 2017") | Fields stream in <1s, result with "Refining...", improves after 3-5s |
| Nonsense text ("blue cheese 2024") | Low confidence result quickly, user_choice action |
| Clear wine label photo | Fields stream, result card appears quickly |
| Blurry/dark photo | Low confidence with "Refining..." indicator |
| Mobile tab switch during refining | Return to usable Tier 1 result |
| Clicking "Correct" during refining | Refining stops gracefully, proceeds with user action |
| Cancel during identification | Clean abort, no error shown (WIN-227) |
| Cancel during refining | Tier 1 result preserved, refining abandoned cleanly |

### 5.3 Performance baseline
Before and after: measure TTFB (time to first field) and TTR (time to result card visible) for 3 test wines. Target: **TTFB < 1s, TTR < 2.5s** (down from current 3-10s).

---

## Implementation Order

```
Phase 0 → Phase 1 + 3 → Phase 2 → Phase 4 → Phase 5
 tests    thinking+schema  prompt   escalation  verify
```

Why this order:
- Phase 0 first: safety net before any changes
- Phase 1 + 3 (thinking + schema): independent config/adapter changes, can be done together, immediate measurable impact
- Phase 2 (prompt): depends on schema being in place (slim prompt is safe with schema constraint)
- Phase 4 (escalation): biggest change, builds on Phases 1-3 being stable
- Phase 5: final verification

---

## Files Modified Summary

### Backend (PHP)
| File | Changes |
|------|---------|
| `resources/php/agent/config/agent.config.php` | Add `streaming_fast` tier, add `tier` key to streaming config |
| `resources/php/agent/Identification/IdentificationService.php` | New `buildStreamingPrompt()`, `buildStreamingVisionPrompt()`, `getIdentificationSchema()`, `identifyEscalateOnly()`, `identifyImageEscalateOnly()`. Update `identifyStreaming()` + `identifyStreamingImage()` to use new tier/prompt/schema |
| `resources/php/agent/identifyTextStream.php` | Non-blocking escalation: emit result first, then refining/refined events |
| `resources/php/agent/identifyImageStream.php` | Same non-blocking escalation |
| `resources/php/agent/LLM/Adapters/GeminiAdapter.php` | Pass `response_schema` through in `buildStreamingPayload()` |

### Frontend (TypeScript/Svelte)
| File | Changes |
|------|---------|
| `qve/src/lib/api/client.ts` | Handle `refining`/`refined` SSE events in both streaming methods |
| `qve/src/lib/agent/handlers/identification.ts` | Show Tier 1 result immediately via onEvent callback, handle refined updates with phase guard |
| `qve/src/lib/components/agent/cards/WineCard.svelte` | "Refining..." badge when `$isEscalating` |
| `qve/src/lib/components/agent/wine/WineConfidenceSection.svelte` | Pulsing confidence during escalation |

### New Test Files
| File | Tests |
|------|-------|
| `resources/php/agent/LLM/Streaming/StreamingFieldDetectorTest.php` | 8 unit tests |
| `resources/php/agent/Identification/IdentificationServiceTest.php` | 3 unit tests |
| `qve/src/lib/api/__tests__/sseParser.test.ts` | 6 unit tests |
| `qve/src/lib/stores/__tests__/agentIdentification.test.ts` | 5 added tests |
| `qve/src/lib/agent/__tests__/streaming.test.ts` | 4 added tests |

### Unchanged (intentionally)
- `text_identify.txt` / `vision_identify.txt` — kept for non-streaming escalation path via TextProcessor/VisionProcessor
- `TextProcessor.php` / `VisionProcessor.php` — non-streaming path unchanged
- `agentEnrichStream.php` — enrichment not in scope
- `_bootstrap.php` — SSE helpers and cancellation functions unchanged
- All existing component rendering logic — WineCard already handles streaming/static/skeleton states

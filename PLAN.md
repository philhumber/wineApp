# Optimize Identification Workflow — Implementation Plan

**Branch**: `claude/optimize-identification-workflow-X2NcF`
**Baseline**: 675 tests pass / 10 pre-existing failures (do not regress)

---

## Problem Statement

The wine identification workflow feels slow and unresponsive. The user types a wine description or takes a photo, then stares at "Thinking..." for 3-10+ seconds before seeing anything. The root causes are:

1. **Invisible thinking tokens** — Tier 1 uses `thinking_level: LOW` with 4000 token budget. The model thinks for 1-2s before streaming starts. Dead air.
2. **Bloated fast-path prompt** — Streaming prompt includes examples, confidence rationale field, lengthy instructions. More input tokens = higher TTFB.
3. **Blocking escalation** — When Tier 1 confidence < 85%, the streaming endpoint calls `$service->identify()` which runs up to 3 more sequential LLM calls (Tier 1 re-run + 1.5 + 2) with zero visual feedback beyond "Looking deeper...".
4. **No responseSchema** — Using `responseMimeType: 'application/json'` without a schema means the model doesn't know the shape upfront, potentially hurting streaming granularity.

---

## Solution Overview

Four coordinated changes across backend and frontend:

| Change | Impact | Risk | Files |
|--------|--------|------|-------|
| **A. Remove thinking from Tier 1 streaming** | Eliminates 1-2s invisible delay | Low — Flash is accurate for well-known wines without thinking | Config + IdentificationService |
| **B. Slim the streaming prompt** | Faster TTFB, fewer input tokens | Low — keep examples in escalation prompts | IdentificationService + new prompt |
| **C. Add responseSchema** | Structured output + potentially better streaming granularity | Low — Gemini 3 Flash supports this natively | GeminiAdapter + Config + IdentificationService |
| **D. Non-blocking escalation** | Eliminates 5-15s freezes; show Tier 1 result immediately, refine in background | **Medium** — new SSE event type, frontend state management changes | Streaming endpoints + API client + handlers + stores |

---

## Phase 0: Stabilization Tests (Write BEFORE any changes)

Write tests that verify current behavior so we know immediately if a change breaks something. All tests go in existing test directories alongside current tests.

### 0.1 PHP: StreamingFieldDetector unit tests
**File**: `resources/php/agent/LLM/Streaming/StreamingFieldDetectorTest.php`

Tests to write:
- `testExtractsProducerFromPartialJson` — feed chunks like `{"producer": "Château` then ` Margaux",` and verify field detected after closing quote
- `testExtractsArrayField` — grapes: `["Cab`, `ernet Sauvignon", "Merlot"]` detected after `]`
- `testExtractsNumberField` — confidence: `92` detected after terminator
- `testHandlesNullField` — `"vintage": null,` returns null (not emitted as field event)
- `testMultipleFieldsInOneChunk` — entire JSON in one chunk emits all fields
- `testFieldOrderPreserved` — fields emitted in targetFields order, not arrival order
- `testTryParseCompleteWithValidJson` — accumulated text parses as complete JSON
- `testTryParseCompleteWithPartialJson` — returns null when incomplete

### 0.2 Frontend: agentIdentification store streaming tests
**File**: `qve/src/lib/stores/__tests__/agentIdentification.test.ts` (extend existing)

Tests to add:
- `should accumulate streaming fields progressively` — call updateStreamingField for producer, then wineName, verify Map grows
- `should mark isStreaming true when any field is typing` — verify derived store
- `should mark isStreaming false when all fields complete` — call completeStreamingField on all
- `should clear streaming fields on startIdentification` — verify Map resets
- `should handle escalation state transitions` — startEscalation → isEscalating true → completeEscalation

### 0.3 Frontend: Streaming integration test
**File**: `qve/src/lib/agent/__tests__/streaming.test.ts` (extend existing)

Tests to add:
- `should display Tier 1 result immediately when high confidence` — mock API returning 90% confidence, verify setResult called, phase → confirming
- `should handle escalation event in stream` — mock API that sends field events, then escalating event, then improved fields, then result. Verify store updates at each stage.
- `should preserve Tier 1 fields during escalation` — verify fields from Tier 1 remain visible while escalation runs

### 0.4 Frontend: SSE processSSEStream test
**File**: `qve/src/lib/api/__tests__/sseParser.test.ts` (new)

Tests to write:
- `should parse field events` — mock ReadableStream with SSE format, verify onEvent called with correct field/value
- `should parse result event` — verify final result parsed
- `should handle escalating event` — verify event type received
- `should handle new refining event type` — for Phase D, verify new `refining` event parsed
- `should handle chunked SSE data` — SSE split across multiple read() calls
- `should handle connection errors gracefully` — stream errors mid-way

### 0.5 PHP: Prompt generation test
**File**: `resources/php/agent/Identification/IdentificationServiceTest.php` (new)

Tests to write:
- `testBuildIdentificationPromptContainsInput` — verify user text appears in prompt
- `testBuildIdentificationPromptIsCompact` — verify prompt length under threshold (for the slim prompt)
- `testBuildVisionPromptIncludesSupplementaryText` — verify optional text appended
- `testIdentifyStreamingReturnsStreamedFlag` — verify response includes `streamed: true`
- `testIdentifyStreamingFallsBackWhenDisabled` — config flag false → falls back to non-streaming

---

## Phase 1: Remove thinking from Tier 1 streaming (Change A)

### Rationale
Gemini 3 Flash with `thinking_level: LOW` adds 1-2s of invisible latency before the first token streams. For the fast path (80% of requests), the model doesn't need to think — "2019 Château Margaux" is immediate recognition. Thinking is valuable for Tier 1.5 (escalation) where accuracy matters more.

### Changes

**File**: `resources/php/agent/Identification/IdentificationService.php`
- `identifyStreaming()` (line ~349-361): Create a separate streaming tier config that omits `thinking_level`
- `identifyStreamingImage()` (line ~462-474): Same change

Specifically, instead of reading from `$this->config['model_tiers']['fast']` which has `thinking_level: LOW`, build streaming-specific options that skip thinking:

```php
// Streaming-specific: no thinking for fastest TTFB
$options = [
    'provider' => 'gemini',
    'model' => $tierConfig['model'] ?? 'gemini-3-flash-preview',
    'temperature' => $tierConfig['temperature'] ?? 0.3,
    'max_tokens' => 1500, // Reduced — JSON output is ~200 tokens
    'json_response' => true,
    // NOTE: no thinking_level — intentionally omitted for streaming speed
];
```

**File**: `resources/php/agent/config/agent.config.php`
- Add a new `streaming_fast` tier to `model_tiers`:
```php
'streaming_fast' => [
    'provider' => 'gemini',
    'model' => 'gemini-3-flash-preview',
    // No thinking_level — optimized for TTFB
    'description' => 'Streaming identification — no thinking, fastest TTFB',
    'temperature' => 0.3,
    'max_tokens' => 1500,
],
```
- Update `streaming` config to reference this tier:
```php
'streaming' => [
    'enabled' => true,
    'tier' => 'streaming_fast',  // NEW — dedicated streaming tier
    ...
],
```

### Risk
- Slightly lower accuracy for obscure wines on Tier 1. Mitigated by: escalation still uses thinking. The 85% threshold already catches low-confidence results.

### Verification
- Run existing streaming tests — must pass
- Manual test: well-known wine ("2019 Château Margaux") should show first field in <1s

---

## Phase 2: Slim the streaming prompt (Change B)

### Rationale
The current `buildIdentificationPrompt()` in IdentificationService.php (lines 556-576) is 575 chars. The file-based `text_identify.txt` prompt is 1400+ chars with 4 examples and lengthy confidence rules. For streaming, we want the minimum prompt that gets the job done — fewer input tokens = lower TTFB.

### Changes

**File**: `resources/php/agent/Identification/IdentificationService.php`
- Replace `buildIdentificationPrompt()` with a slimmer version for streaming:

```php
private function buildStreamingPrompt(string $text): string
{
    return <<<PROMPT
Identify this wine. Return JSON with: producer, wineName, vintage, region, country, wineType, grapes (array), confidence (0-100).

Rules:
- confidence 80-100 only for wines you RECOGNIZE as real
- confidence <50 if the producer/wine isn't a real winery you know
- For single-wine estates (Opus One, Château Margaux): wineName = producer
- Use null for unknown fields

TEXT: {$text}
PROMPT;
}
```

- Keep the existing `buildIdentificationPrompt()` renamed to `buildEscalationPrompt()` for use by non-streaming tiers
- Keep the file-based prompt (`text_identify.txt`) for the `TextProcessor.process()` path (non-streaming escalation)

Similarly for vision:
```php
private function buildStreamingVisionPrompt(?string $supplementaryText = null): string
{
    $prompt = <<<PROMPT
Identify this wine from the label image. Return JSON with: producer, wineName, vintage, region, country, wineType, grapes (array), confidence (0-100).

Rules:
- confidence 80-100 only for wines you RECOGNIZE
- confidence <50 if unreadable or not a wine label
- Use null for unknown fields
PROMPT;

    if ($supplementaryText) {
        $prompt .= "\n\nUser context: {$supplementaryText}";
    }
    return $prompt;
}
```

**Key**: The slim prompt removes:
- Examples (the model knows wine data already)
- `confidenceRationale` field (saves ~20-50 output tokens)
- Verbose confidence scoring rules (condensed to 2 lines)
- Total: ~250 chars vs 1400+ chars = ~80% fewer input tokens

### Risk
- Slightly less precise confidence scoring on edge cases. Mitigated by: escalation prompts retain full detail.
- Model might not follow JSON format as reliably without examples. Mitigated by: `responseSchema` (Phase 3) constrains output structurally.

### Verification
- Run Phase 0 prompt generation tests
- Manual test: compare confidence scores for 5 test wines between old and new prompt

---

## Phase 3: Add responseSchema (Change C)

### Rationale
Gemini 3 Flash supports `responseSchema` which constrains the output to a specific JSON shape at the API level — stronger than `responseMimeType: 'application/json'` alone. Benefits:
1. Guarantees valid JSON (no risk of free text)
2. Model knows the shape upfront → potentially better streaming granularity
3. No `confidenceRationale` or extra fields can leak in

### Changes

**File**: `resources/php/agent/Identification/IdentificationService.php`
- In `identifyStreaming()` and `identifyStreamingImage()`, add schema to options:

```php
$options = [
    'provider' => 'gemini',
    'model' => $tierConfig['model'] ?? 'gemini-3-flash-preview',
    'temperature' => 0.3,
    'max_tokens' => 1500,
    'response_schema' => [
        'type' => 'OBJECT',
        'properties' => [
            'producer'   => ['type' => 'STRING', 'nullable' => true],
            'wineName'   => ['type' => 'STRING', 'nullable' => true],
            'vintage'    => ['type' => 'STRING', 'nullable' => true],
            'region'     => ['type' => 'STRING', 'nullable' => true],
            'country'    => ['type' => 'STRING', 'nullable' => true],
            'wineType'   => ['type' => 'STRING', 'nullable' => true, 'enum' => ['Red','White','Rosé','Sparkling','Dessert','Fortified']],
            'grapes'     => ['type' => 'ARRAY', 'nullable' => true, 'items' => ['type' => 'STRING']],
            'confidence' => ['type' => 'INTEGER'],
        ],
        'required' => ['confidence'],
    ],
];
```

**File**: `resources/php/agent/LLM/Adapters/GeminiAdapter.php`
- The `response_schema` support already exists (lines 107-111) for non-streaming calls. Verify `buildStreamingPayload()` (line 296) also passes it through:

```php
// In buildStreamingPayload(), add after json_response handling:
if (!empty($options['response_schema'])) {
    $payload['generationConfig']['responseMimeType'] = 'application/json';
    $payload['generationConfig']['responseSchema'] = $options['response_schema'];
}
```

**Note**: When `responseSchema` is set, `responseMimeType` is implicitly `application/json`. We can remove the separate `json_response` flag from streaming options since the schema handles it.

### Risk
- Very low. This is additive — schema constrains output more tightly than prompt instructions alone.
- Verify Gemini 3 Flash supports `responseSchema` with `streamGenerateContent` (it should — this is documented for Gemini 3 models).

### Verification
- Run StreamingFieldDetector tests — fields should still be detected correctly from schema-constrained JSON
- Manual test: verify streaming output matches schema exactly

---

## Phase 4: Non-blocking escalation (Change D)

This is the biggest change and the biggest UX win. Currently when Tier 1 confidence < 85%, the user sees "Looking deeper..." and then nothing for 5-15 seconds while up to 3 more LLM calls run synchronously.

### New Architecture

**Current flow** (blocking):
```
User input → Tier 1 stream → [confidence < 85%] → "Looking deeper..." → Tier 1 + 1.5 + 2 (blocking) → result
                                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                    5-15 seconds of nothing
```

**New flow** (non-blocking):
```
User input → Tier 1 stream → show Tier 1 result immediately (even if low confidence)
                            → emit "refining" SSE event
                            → Tier 1.5 runs → if improved, emit updated fields as SSE events
                            → Tier 2 runs → if improved, emit updated fields as SSE events
                            → emit "refined" SSE event with final result
```

The user sees wine data within 1-2 seconds. If confidence is low, they see the result with a "Refining..." indicator. Fields update live as escalation improves them.

### Backend Changes

**File**: `resources/php/agent/identifyTextStream.php`
Replace the current escalation block (lines 81-158) with:

```php
// Always emit Tier 1 confidence and result FIRST
if (isset($result['confidence'])) {
    sendSSE('field', ['field' => 'confidence', 'value' => $result['confidence']]);
}

sendSSE('result', [
    'inputType' => $result['inputType'] ?? 'text',
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
    sendSSE('refining', ['message' => 'Refining identification...', 'tier1_confidence' => $result['confidence']]);

    // Run escalation tiers (1.5 → 2) — skip re-running Tier 1
    $escalatedResult = $service->identifyEscalateOnly($input, $result);

    if ($escalatedResult['success'] && $escalatedResult['confidence'] > $result['confidence']) {
        // Stream improved fields
        $parsed = $escalatedResult['parsed'] ?? [];
        $fieldOrder = ['producer', 'wineName', 'vintage', 'region', 'country', 'wineType', 'grapes'];
        foreach ($fieldOrder as $field) {
            if (isset($parsed[$field]) && $parsed[$field] !== null) {
                sendSSE('field', ['field' => $field, 'value' => $parsed[$field]]);
                usleep(50000);
            }
        }
        if (isset($escalatedResult['confidence'])) {
            sendSSE('field', ['field' => 'confidence', 'value' => $escalatedResult['confidence']]);
        }
    }

    sendSSE('refined', [
        'improved' => $escalatedResult['success'] && $escalatedResult['confidence'] > $result['confidence'],
        'parsed' => $escalatedResult['parsed'] ?? $result['parsed'],
        'confidence' => $escalatedResult['confidence'] ?? $result['confidence'],
        'action' => $escalatedResult['action'] ?? $result['action'],
        'escalation' => $escalatedResult['escalation'] ?? $result['escalation'],
    ]);
}

sendSSE('done', []);
```

**File**: `resources/php/agent/identifyImageStream.php`
- Same refactoring as text streaming endpoint above.

**File**: `resources/php/agent/Identification/IdentificationService.php`
- Add new method `identifyEscalateOnly()` that skips Tier 1 and starts from Tier 1.5:

```php
/**
 * Run escalation tiers only (skip Tier 1).
 * Used after streaming Tier 1 has already run.
 */
public function identifyEscalateOnly(array $input, array $tier1Result): array
```

This method extracts the Tier 1.5 → Tier 2 → User Choice logic from `identifyFromText()` (lines 674-758) into a reusable method. It accepts the Tier 1 result as context for escalation.

### Frontend Changes

**File**: `qve/src/lib/api/client.ts`
- In `identifyTextStream()` and `identifyImageStream()`, handle new SSE event types:

```typescript
case 'refining':
    onEvent?.({ type: 'refining', data: event.data });
    break;
case 'refined':
    // Update the final result with escalated data
    finalResult = {
        ...finalResult,
        ...event.data,
        escalated: true,
    };
    break;
```

- Add `onRefining` callback parameter alongside `onField`:

```typescript
async identifyTextStream(
    text: string,
    onField?: StreamFieldCallback,
    onEvent?: StreamEventCallback,
    onRefining?: (isRefining: boolean) => void
): Promise<AgentIdentificationResultWithMeta>
```

**File**: `qve/src/lib/agent/handlers/identification.ts`
- In `executeTextIdentification()` (lines 338-354), update the API call:

```typescript
const result = await api.identifyTextStream(
    text,
    (field, value) => {
        identification.updateStreamingField(field, String(value), true);
    },
    undefined, // onEvent
    (isRefining) => {
        if (isRefining) {
            identification.startEscalation(2);
            // Don't remove typing message — show refining indicator instead
        }
    }
);
```

- The key behavioral change: when the `result` event arrives (Tier 1), we immediately call `handleIdentificationResultFlow()` to show the wine card. If `refining` follows, the card stays visible but shows a subtle "Refining..." badge. When `refined` arrives, the card updates with improved data.

**File**: `qve/src/lib/stores/agentIdentification.ts`
- Add `isRefining` state and derived store:
```typescript
isRefining: false,    // True while background escalation is running
refiningFromTier: 1,  // Which tier we're refining from
```

**File**: `qve/src/lib/components/agent/cards/WineCard.svelte`
- Add subtle "Refining..." indicator when `isRefining` is true:
```svelte
{#if isRefining}
    <div class="refining-badge" transition:fade>
        <span class="refining-dot"></span> Refining...
    </div>
{/if}
```

**File**: `qve/src/lib/components/agent/wine/WineConfidenceSection.svelte`
- During refining, show a pulsing confidence indicator that updates when the refined score arrives.

### SSE Event Flow Summary

```
event: field          data: {"field":"producer","value":"Château Margaux"}
event: field          data: {"field":"wineName","value":"Château Margaux"}
event: field          data: {"field":"vintage","value":"2019"}
event: field          data: {"field":"region","value":"Margaux"}
event: field          data: {"field":"country","value":"France"}
event: field          data: {"field":"wineType","value":"Red"}
event: field          data: {"field":"grapes","value":["Cabernet Sauvignon","Merlot"]}
event: field          data: {"field":"confidence","value":72}
event: result         data: {full Tier 1 result}        ← Card shown NOW
event: refining       data: {"message":"Refining..."}   ← Badge appears
event: field          data: {"field":"confidence","value":91}  ← Updated live
event: refined        data: {full escalated result}     ← Badge removed
event: done           data: {}
```

### Risk
- **Race condition**: `result` event triggers `handleIdentificationResultFlow()` which sets phase to `confirming` and shows chips. If `refined` arrives and changes the action (e.g., from `suggest` to `auto_populate`), chips may need updating.
  - **Mitigation**: On `refined`, call `handleIdentificationResultFlow()` again with updated result. The function already handles replacing messages.
- **User interaction during refining**: User might click "Correct" or "Add to Cellar" while escalation is still running.
  - **Mitigation**: The `refined` event should NOT override a user action. If phase has moved past `confirming` (e.g., to `adding_wine`), ignore the refined result.
- **Mobile tab switch**: User might switch tabs during refining. The SSE stream would be interrupted.
  - **Mitigation**: Session persistence already saves the Tier 1 result. On return, the user sees the Tier 1 result (not a blank screen). The refining would be lost, but the user has a usable result.

### Verification
- Run all Phase 0 tests
- Run the streaming integration tests from 0.3
- Manual test: obscure wine → should see Tier 1 result quickly with "Refining..." → result improves after 3-5s

---

## Phase 5: Verification & Cleanup

### 5.1 Full test suite
- Run `npx vitest run` — must have ≥675 passing tests (our baseline)
- Run `npm run check` — TypeScript must pass
- Run `npm run build` — production build must succeed

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

### 5.3 Performance baseline
Before and after: measure TTFB (time to first field) and TTR (time to result card visible) for 3 test wines. Target: **TTFB < 1s, TTR < 2.5s** (down from current 3-10s).

---

## Implementation Order

```
Phase 0 → Phase 1 → Phase 3 → Phase 2 → Phase 4 → Phase 5
 tests     thinking   schema    prompt    escalation  verify
```

Why this order:
- Phase 0 first: safety net before any changes
- Phase 1 (thinking) + Phase 3 (schema): independent config changes, can be done together, immediate measurable impact
- Phase 2 (prompt): depends on schema being in place (slim prompt is safe with schema constraint)
- Phase 4 (escalation): biggest change, builds on Phases 1-3 being stable
- Phase 5: final verification

---

## Files Modified Summary

### Backend (PHP)
| File | Changes |
|------|---------|
| `resources/php/agent/config/agent.config.php` | Add `streaming_fast` tier, update streaming config |
| `resources/php/agent/Identification/IdentificationService.php` | New streaming prompt, responseSchema, `identifyEscalateOnly()`, use `streaming_fast` tier |
| `resources/php/agent/identifyTextStream.php` | Non-blocking escalation with new SSE events |
| `resources/php/agent/identifyImageStream.php` | Same non-blocking escalation |
| `resources/php/agent/LLM/Adapters/GeminiAdapter.php` | Pass responseSchema through in `buildStreamingPayload()` |

### Frontend (TypeScript/Svelte)
| File | Changes |
|------|---------|
| `qve/src/lib/api/client.ts` | Handle `refining`/`refined` SSE events, add `onRefining` callback |
| `qve/src/lib/agent/handlers/identification.ts` | Pass refining callback, handle refined result update |
| `qve/src/lib/stores/agentIdentification.ts` | Add `isRefining` state |
| `qve/src/lib/components/agent/cards/WineCard.svelte` | "Refining..." badge |
| `qve/src/lib/components/agent/wine/WineConfidenceSection.svelte` | Pulsing confidence during refining |

### New Test Files
| File | Tests |
|------|-------|
| `resources/php/agent/LLM/Streaming/StreamingFieldDetectorTest.php` | 8 unit tests |
| `resources/php/agent/Identification/IdentificationServiceTest.php` | 5 unit tests |
| `qve/src/lib/api/__tests__/sseParser.test.ts` | 6 unit tests |
| `qve/src/lib/stores/__tests__/agentIdentification.test.ts` | 5 added tests |
| `qve/src/lib/agent/__tests__/streaming.test.ts` | 3 added tests |

### Unchanged (intentionally)
- `text_identify.txt` / `vision_identify.txt` — kept for non-streaming escalation path
- `TextProcessor.php` / `VisionProcessor.php` — non-streaming path unchanged
- `agentEnrichStream.php` — enrichment not in scope
- All existing component rendering logic — WineCard already handles streaming/static states perfectly

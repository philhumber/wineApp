# Optimize Identification Workflow — Implementation Plan

**Branch**: `claude/optimize-identification-workflow-X2NcF` (based on `develop`)
**Baseline**: Run `npx vitest run` from `qve/` after `npx svelte-kit sync` — track pass count before changes

---

## Changes from Original

This plan was revised after a deep-dive review by 6 specialist agents that verified every file reference, line number, and assumption against the actual codebase.

| # | Change | Reason |
|---|--------|--------|
| 1 | **[REVISED] Phase 1: Modify existing `fast` tier** instead of creating `streaming_fast` | Simpler config. Removes `thinking_level` from `fast` tier directly — affects all Tier 1 usage, which is acceptable since escalation tiers (1.5, 2) use their own configs. |
| 2 | **[REVISED] Phase 2: Modify existing prompt methods** instead of creating new ones | `buildIdentificationPrompt()` and `buildVisionPrompt()` are ONLY called by streaming methods. Non-streaming uses separate `TextProcessor`/`VisionProcessor` with file-based prompts. Creating duplicates was unnecessary. |
| 3 | **[REVISED] Phase 3: Clarified schema insertion point** | Exact line placement in `buildStreamingPayload()` (before `return $payload` at line 344). |
| 4 | **[REVISED] Phase 4 Backend: Corrected line numbers** | Escalation logic: text at 702-778 (not 702-810), image at 1074-1154. Streaming endpoint: text at 84-150 (not 84-158), image at 107-174. |
| 5 | **[NEW] Phase 4 Backend: Stream only CHANGED fields** | Reduces visual noise during escalation. Compare Tier 1 vs escalated fields. |
| 6 | **[NEW] Phase 4 Backend: Error handling around escalation** | Wrap `identifyEscalateOnly()` in try/catch. On failure: silently preserve Tier 1 result, remove badge. |
| 7 | **[REVISED] Phase 4 Frontend: Add TypeScript types for new events** | `StreamEvent` union must include `refining`/`refined` variants. Without this, TypeScript rejects all event handlers. |
| 8 | **[REVISED] Phase 4 Frontend: Remove post-await result processing** | Current code processes result both in `onEvent` callback AND after `await`. Causes double `handleIdentificationResultFlow()` call → duplicate wine cards. |
| 9 | **[NEW] Phase 4 Frontend: Update wine card in-place on refined** | `handleIdentificationResultFlow()` ADDS messages. Calling it twice creates duplicate cards. Use `conversation.updateMessage()` (exists at line 411) to update existing card data. |
| 10 | **[REVISED] Phase 4 Frontend: Fix `setResult()` to clear `isEscalating`** | Currently leaves `isEscalating` unchanged → badge stuck forever. Must add `isEscalating: false` to state update. |
| 11 | **[REVISED] Phase 4 UI: WineCard structural changes** | WineCard doesn't currently use DataCard's header feature. Must add header prop (follow EnrichmentCard pattern). WineConfidenceSection needs prop-drilled `isEscalating`. |
| 12 | **[REVISED] Phase 0: Corrected test file paths and overlap** | PHP tests go in `resources/php/tests/` (not alongside source). Several proposed frontend tests already exist. `processSSEStream` is private — test through public methods. |
| 13 | **[NEW] Phase 0: Additional test coverage** | Added: in-place card update test, cancellation during refining test, escalation failure fallback test. |
| 14 | **[NEW] Phase 5: Quantitative pass/fail criteria and measurement methodology** | Manual test matrix now has measurable thresholds. Performance testing uses `performance.mark()` API. |
| 15 | **[REMOVED] `buildStreamingPrompt()` and `buildStreamingVisionPrompt()` new methods** | Replaced by modifying existing `buildIdentificationPrompt()` and `buildVisionPrompt()` which are already streaming-only. |
| 16 | **[REMOVED] `streaming_fast` tier in agent.config.php** | Replaced by modifying existing `fast` tier to remove `thinking_level`. |

---

## Problem Statement

The wine identification workflow feels slow and unresponsive. The user types a wine description or takes a photo, then stares at "Thinking..." for 3-10+ seconds before seeing anything. The root causes are:

1. **Invisible thinking tokens** — Tier 1 uses `thinking_level: LOW` with 4000 token budget. The model thinks for 1-2s before streaming starts. Dead air.
2. **Bloated fast-path prompt** — `buildIdentificationPrompt()` (IdentificationService.php:572-592) includes `confidenceRationale` field and verbose instructions. More input tokens + more output tokens = higher TTFB.
3. **Blocking escalation** — When Tier 1 confidence < 85%, both streaming endpoints call `$service->identify($input)` which routes to `identifyFromText()`/`identifyFromImage()`, running the full Tier 1 → 1.5 → 2 cascade with zero visual feedback beyond "Looking deeper...".
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
   c. $service->identify($input)  → BLOCKING: runs full Tier 1 → 1.5 → 2 cascade
   d. Send escalated fields with 50ms delays
4. sendSSE('result', ...)
5. sendSSE('done', ...)
```

The blocking `identify()` call at step 3c is the primary UX problem — `identify()` routes to `identifyFromText()` which runs the full tier cascade redundantly (Tier 1 again + 1.5 + 2), taking 5-15 seconds.

### Current identifyStreaming() (IdentificationService.php:324-437)

- Reads from `$this->config['model_tiers']['fast']` which includes `thinking_level: LOW`
- Uses `buildIdentificationPrompt()` which includes `confidenceRationale`
- Passes `json_response: true` (no schema)
- On failure: falls back to full `identify()` if not cancelled

### Key Code References

| Code | Location | Notes |
|------|----------|-------|
| `buildIdentificationPrompt()` | IdentificationService.php:572-592 | ONLY called by `identifyStreaming()` (line 346) |
| `buildVisionPrompt()` | IdentificationService.php:600-624 | ONLY called by `identifyStreamingImage()` (line 468) |
| `identifyStreaming()` | IdentificationService.php:324-437 | Tier config at lines 349-361 |
| `identifyStreamingImage()` | IdentificationService.php:446-562 | Tier config at lines 471-485 |
| `identifyFromText()` escalation | IdentificationService.php:702-778 | Tier 1.5 at 702-747, Tier 2 at 749-778 |
| `identifyFromImage()` escalation | IdentificationService.php:1074-1154 | Tier 1.5 at 1074-1112, Tier 2 at 1121-1154 |
| Text stream escalation block | identifyTextStream.php:84-150 | Current blocking flow |
| Image stream escalation block | identifyImageStream.php:107-174 | Current blocking flow |
| `buildStreamingPayload()` | GeminiAdapter.php:304-344 | `json_response` at 339-341, `return` at 344 |
| `complete()` response_schema | GeminiAdapter.php:112-115 | Reference impl for streaming |
| `sendSSE()` | _bootstrap.php:436 | Signature: `sendSSE(string $event, array $data)` — no event name restrictions |
| `StreamEvent` type | api/types.ts:753-759 | Currently: field, result, escalating, confirmation_required, error, done |
| `executeTextIdentification()` | identification.ts:313-372 | Currently passes `undefined` for onEvent (line 349) |
| `executeImageIdentification()` | identification.ts:378-422 | Currently passes `undefined` for onEvent (line 399) |
| `handleIdentificationResultFlow()` | identification.ts:103-173 | ADDS wine_result + text + chips messages |
| `conversation.updateMessage()` | agentConversation.ts:411-423 | Takes messageId + Partial<AgentMessage> |
| `setResult()` | agentIdentification.ts:127-142 | Does NOT clear `isEscalating` (bug to fix) |

---

## Solution Overview

Four coordinated changes across backend and frontend:

| Change | Impact | Risk | Files |
|--------|--------|------|-------|
| **A. Remove thinking from Tier 1** | Eliminates 1-2s invisible delay | Low — Flash is accurate for well-known wines without thinking | Config |
| **B. Slim the streaming prompt** | Faster TTFB, fewer input tokens | Low — non-streaming uses separate file-based prompts | IdentificationService |
| **C. Add responseSchema** | Structured output + better streaming granularity + guaranteed JSON | Low — Gemini 3 Flash supports this | GeminiAdapter + IdentificationService |
| **D. Non-blocking escalation** | Eliminates 5-15s freezes; show Tier 1 result immediately, refine in background | **Medium** — new SSE events, frontend state changes, in-place card updates | Streaming endpoints + API client + handlers + stores + WineCard |

---

## Phase 0: Stabilization Tests (Write BEFORE any changes)

Write tests that verify current behavior so we know immediately if a change breaks something.

### 0.1 PHP: StreamingFieldDetector unit tests
**File**: `resources/php/tests/StreamingFieldDetectorTest.php`

**Pre-requisite**: Verify `resources/php/tests/bootstrap.php` can autoload `Agent\LLM\Streaming\StreamingFieldDetector`. Existing tests use global functions; this tests a namespaced class. Add autoload config if needed.

Tests to write:
- `testExtractsProducerFromPartialJson` — feed chunks like `{"producer": "Château` then ` Margaux",` and verify field detected after closing quote
- `testExtractsArrayField` — grapes: `["Cab`, `ernet Sauvignon", "Merlot"]` detected after `]`
- `testExtractsNumberField` — confidence: `92` detected after terminator
- `testHandlesNullField` — `"vintage": null,` not emitted (returns PHP null)
- `testMultipleFieldsInOneChunk` — entire JSON in one chunk emits all target fields
- `testFieldOrderPreserved` — fields emitted in targetFields order, not JSON order
- `testTryParseCompleteWithValidJson` — accumulated text parses as complete JSON
- `testTryParseCompleteWithPartialJson` — returns null when incomplete

### 0.2 Frontend: agentIdentification store edge case tests
**File**: `qve/src/lib/stores/__tests__/agentIdentification.test.ts` (extend existing)

**Note**: Core streaming tests already exist at lines 156-271 (field accumulation, isStreaming, escalation transitions). Add **edge case** tests only:
- `should handle rapid sequential field updates without loss` — update same field 3x quickly, verify final value
- `should preserve result when startEscalation is called after setResult` — setResult → startEscalation → verify result still accessible
- `should clear isEscalating when setResult is called` — (this will initially FAIL — fixed in Phase 4)

### 0.3 Frontend: Streaming integration tests
**File**: `qve/src/lib/agent/__tests__/streaming.test.ts` (extend existing)

**Note**: Existing tests cover progressive field updates (lines 45-105) and interruption (lines 145-169). Add:
- `should display Tier 1 result immediately when high confidence` — mock API returning 90% confidence, verify `setResult` called, phase → `confirming`
- `should handle cancellation during identification` — mock API that throws AbortError, verify no error UI shown
- `should handle refining/refined events in stream` — mock API that sends field events, result, refining, more fields, refined
- `should update existing wine card on refined (not add duplicate)` — verify no duplicate `wine_result` messages

### 0.4 Frontend: SSE streaming tests
**File**: `qve/src/lib/api/__tests__/sseParser.test.ts` (new)

**Note**: `processSSEStream` is private in `client.ts` (line 151). Test through the public `identifyTextStream()` method with mocked `fetch` responses. This matches the existing pattern in `streaming.test.ts`.

Tests to write:
- `should parse field events from SSE stream` — mock ReadableStream with SSE format, verify onField called with correct field/value
- `should parse result event` — verify final result returned correctly
- `should handle refining event` — verify onEvent called with type 'refining'
- `should handle refined event with improved result` — verify finalResult updated
- `should handle chunked SSE data` — SSE event split across multiple `reader.read()` calls
- `should respect AbortSignal` — verify stream aborts when signal fires

### 0.5 PHP: Prompt generation tests
**File**: `resources/php/tests/IdentificationServiceTest.php` (new)

Tests to write:
- `testBuildIdentificationPromptContainsInput` — verify user text appears in prompt
- `testBuildVisionPromptIncludesSupplementaryText` — verify optional text appended
- `testBuildVisionPromptWithoutSupplementaryText` — verify clean prompt without extra text

---

## Phase 1: Remove thinking from Tier 1 (Change A)

### Rationale
Gemini 3 Flash with `thinking_level: LOW` adds 1-2s of invisible latency before the first token streams. For the fast path (~80% of requests), the model doesn't need to think — "2019 Château Margaux" is immediate recognition. Thinking remains valuable for Tier 1.5 (escalation) where accuracy matters more via the `detailed` tier which has `thinking_level: HIGH`.

### Changes

**File**: `resources/php/agent/config/agent.config.php`

Modify the existing `fast` tier (lines 167-174) to remove `thinking_level`:

```php
'fast' => [
    'provider' => 'gemini',
    'model' => 'gemini-3-flash-preview',
    // thinking_level removed — fastest TTFB for streaming
    // Escalation tiers (detailed, opus) retain their thinking configs
    'description' => 'Quick identification - Tier 1',
    'temperature' => 0.3,       // [REVISED] was 1.0, lower for more consistent JSON
    'max_tokens' => 1500,       // [REVISED] was 4000, JSON output is ~200 tokens
],
```

**Changes from current**:
- Remove `'thinking_level' => 'LOW'` — eliminates 1-2s invisible delay
- Set `temperature` to 1.0  — Gemini 3 models, recommend keeping temperature at 1.0
- Reduce `max_tokens` from 4000 to 1500 — no thinking budget needed, JSON output is ~200 tokens

**File**: `resources/php/agent/Identification/IdentificationService.php`

The existing code at lines 349-361 (text) and 471-485 (image) already conditionally adds `thinking_level`:
```php
if (isset($tierConfig['thinking_level'])) {
    $options['thinking_level'] = $tierConfig['thinking_level'];
}
```

With `thinking_level` removed from the `fast` tier, this conditional simply won't add it. **No code change needed** in IdentificationService for Phase 1.

### Risk
- Slightly lower accuracy for obscure wines on Tier 1. Mitigated by: escalation tiers (`detailed` = HIGH thinking, `opus`) still have full reasoning. The 85% threshold catches low-confidence results.
- Lower temperature may produce more uniform output but is more appropriate for JSON generation.

### Verification
- Run existing streaming tests — must pass
- Manual test: well-known wine should show first field in <1s
- Compare: before/after TTFB for "2019 Château Margaux"

---

## Phase 2: Slim the streaming prompt (Change B)

### Rationale
Current `buildIdentificationPrompt()` (lines 572-592) is ~575 chars and requests `confidenceRationale` (extra ~20-50 output tokens). Since this method is **only called by streaming** (verified: only call sites are `identifyStreaming()` line 346 and `identifyStreamingImage()` line 468), we can optimize it directly without creating new methods.

### Changes

**File**: `resources/php/agent/Identification/IdentificationService.php`

Replace `buildIdentificationPrompt()` body (lines 572-592):

```php
/**
 * Build optimized prompt for streaming identification.
 * Minimal input tokens for fastest TTFB. No confidenceRationale.
 * Note: Only used by identifyStreaming() — non-streaming uses TextProcessor/file prompts.
 */
private function buildIdentificationPrompt(string $text): string
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

Replace `buildVisionPrompt()` body (lines 600-624):

```php
/**
 * Build optimized prompt for streaming image identification.
 * Note: Only used by identifyStreamingImage() — non-streaming uses VisionProcessor/file prompts.
 */
private function buildVisionPrompt(?string $supplementaryText = null): string
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

### Key differences from current prompt:
- Removes `confidenceRationale` field (saves ~20-50 output tokens)
- Removes verbose field descriptions (model knows what "producer" and "vintage" mean)
- Condenses confidence rules to 2 lines
- Total: ~220 chars vs ~575 chars = ~60% fewer input tokens

### Non-streaming NOT affected:
- `TextProcessor.php` uses `text_identify.txt` file (loaded at line ~43-89)
- `VisionProcessor.php` uses `vision_identify.txt` file
- These are unchanged — full verbose prompts preserved for escalation quality

### Risk
- Slightly less precise confidence on edge cases. Mitigated by: `responseSchema` (Phase 3) constrains output; escalation uses full file-based prompts.
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

Add new private method (alongside existing prompt methods):

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

In `identifyStreaming()` (line 355), replace `'json_response' => true` with:
```php
'response_schema' => $this->getIdentificationSchema(),
// json_response not needed — response_schema implies application/json
```

Apply same change in `identifyStreamingImage()` (line 479).

**File**: `resources/php/agent/LLM/Adapters/GeminiAdapter.php`

In `buildStreamingPayload()`, insert before `return $payload;` at line 344:

```php
// Structured output schema (parallels complete() at lines 112-115)
if (!empty($options['response_schema'])) {
    $payload['generationConfig']['responseMimeType'] = 'application/json';
    $payload['generationConfig']['responseSchema'] = $options['response_schema'];
}
```

**Note**: When `response_schema` is present, it sets `responseMimeType` automatically. The existing `json_response` block (lines 339-341) is still valid for non-schema requests and doesn't conflict — `response_schema` simply overrides it when present.

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
Tier 1 stream → [confidence < 85%] → "Looking deeper..." → identify() runs full Tier 1→1.5→2 → result
                                      ╰───────── 5-15 seconds of nothing ──────────╯
```

**New flow** (non-blocking):
```
Tier 1 stream → show result immediately → "refining" event → Tier 1.5 → Tier 2 → "refined" event
                ╰── card visible in ~2s ──╯                  ╰── changed fields update live ──╯
```

### New SSE Event Types

| Event | When | Data |
|-------|------|------|
| `refining` | After `result`, before escalation starts | `{ message, tier1_confidence }` |
| `refined` | After escalation completes (success or failure) | `{ improved, parsed, confidence, action, escalation }` |

Full event sequence:
```
event: field      → {"field":"producer","value":"Château Margaux"}
event: field      → {"field":"wineName","value":"Château Margaux"}
event: field      → ...more fields...
event: field      → {"field":"confidence","value":72}
event: result     → {full Tier 1 result}          ← Card shown NOW
event: refining   → {"message":"Refining..."}     ← Badge appears on card
event: field      → {"field":"region","value":"Margaux, Bordeaux"}  ← Only changed fields
event: field      → {"field":"confidence","value":91}
event: refined    → {full escalated result}       ← Badge removed, card updated in-place
event: done       → {}
```

### 4.1 Backend: New `identifyEscalateOnly()` Method

**File**: `resources/php/agent/Identification/IdentificationService.php`

Extract Tier 1.5 → Tier 2 logic from `identifyFromText()` (lines 702-778) into a new method:

```php
/**
 * Run escalation tiers only (1.5 → 2), skipping Tier 1.
 * Used after streaming Tier 1 has already run.
 *
 * Extracts logic from identifyFromText() lines 702-778.
 * Must preserve: applyInference(), scoring, cost tracking, cancellation.
 *
 * @param array $input Original input (text or image data)
 * @param array $tier1Result Result from Tier 1 streaming
 * @param string $inputType 'text' or 'image'
 * @return array Best result (Tier 1, 1.5, or 2 — whichever scored highest)
 */
public function identifyEscalateOnly(array $input, array $tier1Result, string $inputType = 'text'): array
```

**Implementation requirements** (verified against actual escalation code):

1. **Accept Tier 1 baseline**: Use `$tier1Result['confidence']` as the score to beat
2. **Build prior context**: Call `buildPriorContext($tier1Result)` (line 558) to give Tier 1.5 the Tier 1 fields as context
3. **Tier 1.5** (lines 702-747): Use `detailed` tier config (HIGH thinking). Call `processWithGemini()` for text or `processImageWithGemini()` for image
4. **Post-processing after each tier**: Call `applyInference($result)` then `$this->scorer->score($result['parsed'])` to recalculate confidence (lines 712-715, 759-762)
5. **Best-result comparison**: Only promote Tier 1.5/2 if confidence improved over previous best (lines 723-732)
6. **Tier 2** (lines 749-778): Use `opus` tier. Only run if Tier 1.5 didn't exceed high-confidence threshold
7. **Cancellation checkpoints**: Check `isRequestCancelled()` before Tier 1.5 and before Tier 2 (matching existing checkpoints at lines 696, 743)
8. **Cost accumulation**: Track `total_cost` across successful tiers (lines 723-732, 769-773)
9. **Return structure**: `['success' => bool, 'parsed' => [...], 'confidence' => int, 'action' => string, 'escalation' => [...], 'usage' => [...]]`

For image input: extract from `identifyFromImage()` (lines 1074-1154) following same pattern. Can share the method with `$inputType` parameter to select the right processing function.

**Scope boundary**: Do NOT extract the "User Choice" block (lines 779-803 / 1164-1178) — that's for ambiguous results and belongs in the main flow, not in streaming refinement.

### 4.2 Backend: Non-blocking Streaming Endpoints

**File**: `resources/php/agent/identifyTextStream.php`

Replace the escalation block (lines 84-150) with non-blocking flow:

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

    try {
        // Escalate from Tier 1.5 onwards (skip redundant Tier 1)
        $escalatedResult = $service->identifyEscalateOnly($input, $result, 'text');

        if ($escalatedResult['success'] && $escalatedResult['confidence'] > $result['confidence']) {
            // Stream only CHANGED fields for focused visual feedback
            $parsed = $escalatedResult['parsed'] ?? [];
            $tier1Parsed = $result['parsed'] ?? [];
            $fieldOrder = ['producer', 'wineName', 'vintage', 'region', 'country', 'wineType', 'grapes'];

            foreach ($fieldOrder as $field) {
                $oldValue = $tier1Parsed[$field] ?? null;
                $newValue = $parsed[$field] ?? null;
                if ($newValue !== null && $newValue !== $oldValue) {
                    sendSSE('field', ['field' => $field, 'value' => $newValue]);
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

    } catch (Exception $e) {
        // Escalation failed — silently preserve Tier 1 result
        error_log("[Agent] identifyText: escalation failed: " . $e->getMessage());
        sendSSE('refined', [
            'improved' => false,
            'parsed' => $result['parsed'],
            'confidence' => $result['confidence'],
            'action' => $result['action'],
            'escalation' => null,
        ]);
    }
}

// Logging + done (unchanged from current code)
```

**File**: `resources/php/agent/identifyImageStream.php`

Same refactoring as text endpoint. Replace escalation block (lines 107-174) with identical non-blocking pattern, using `'image'` as `$inputType`.

### 4.3 Frontend: TypeScript Types

**File**: `qve/src/lib/api/types.ts`

Add new event types to `StreamEvent` union (currently at lines 753-759):

```typescript
export type StreamEvent =
  | { type: 'field'; data: StreamFieldEvent }
  | { type: 'result'; data: AgentIdentificationResultWithMeta }
  | { type: 'escalating'; data: { message: string } }
  | { type: 'refining'; data: { message: string; tier1_confidence?: number } }    // NEW
  | { type: 'refined'; data: StreamRefinedEvent }                                  // NEW
  | { type: 'confirmation_required'; data: StreamConfirmationEvent }
  | { type: 'error'; data: StreamErrorEvent }
  | { type: 'done'; data: Record<string, never> };
```

Add new interface:

```typescript
export interface StreamRefinedEvent {
  improved: boolean;
  parsed: AgentParsedWine;
  confidence: number;
  action: string;
  escalation?: Record<string, unknown> | null;
}
```

### 4.4 Frontend: API Client SSE Handling

**File**: `qve/src/lib/api/client.ts`

In both `identifyTextStream()` (switch at lines 926-952) and `identifyImageStream()` (switch at lines 1025-1042), add cases:

```typescript
case 'refining':
    // Pass through to onEvent callback
    break;

case 'refined':
    // Update finalResult if escalation improved
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
    break;
```

Both events are also forwarded to `onEvent` callback (already happens via the `default` case or explicit forwarding — verify during implementation).

### 4.5 Frontend: Identification Handler (Core Change)

**File**: `qve/src/lib/agent/handlers/identification.ts`

#### `executeTextIdentification()` (lines 313-372)

Replace the current flow with two-phase pattern:

```typescript
async function executeTextIdentification(
  text: string,
  options: { skipUserMessage?: boolean; skipLastActionUpdate?: boolean } = {}
): Promise<void> {
  // ... existing user message + phase setup (lines 317-338) unchanged ...

  const abortController = createAbortController();

  try {
    let tier1Resolved = false;

    const result = await api.identifyTextStream(
      text,
      (field, value) => {
        identification.updateStreamingField(field, String(value), true);
      },
      (event) => {
        // Phase 1: Show Tier 1 result immediately
        if (event.type === 'result' && !tier1Resolved) {
          tier1Resolved = true;
          conversation.removeTypingMessage();
          const wineResult = convertParsedWineToResult(event.data.parsed, event.data.confidence);
          identification.setResult(wineResult, event.data.confidence);
          handleIdentificationResultFlow(wineResult, event.data.confidence ?? 1);
        }

        // Phase 2: Handle refinement
        if (event.type === 'refining') {
          identification.startEscalation(2);
        }

        if (event.type === 'refined') {
          if (event.data.improved) {
            const currentPhase = conversation.getCurrentPhase();
            if (currentPhase === 'confirming') {
              // Update identification store
              const wineResult = convertParsedWineToResult(event.data.parsed, event.data.confidence);
              identification.setResult(wineResult, event.data.confidence);

              // Update existing wine card IN-PLACE (not add duplicate)
              const messages = conversation.getMessages();
              const wineResultMsg = [...messages].reverse().find(m => m.category === 'wine_result');
              if (wineResultMsg) {
                conversation.updateMessage(wineResultMsg.id, {
                  data: {
                    category: 'wine_result',
                    result: wineResult,
                    confidence: event.data.confidence,
                  },
                });
              }
            }
          }
          // Always clear escalation badge (even if not improved or phase changed)
          identification.completeEscalation();
        }
      },
      abortController.signal,
      getRequestId()
    );

    // WIN-187: Skip if cancelled
    if (wasCancelled()) {
      return;
    }

    // Safety fallback: if result wasn't handled via onEvent (shouldn't happen in normal flow)
    if (!tier1Resolved) {
      conversation.removeTypingMessage();
      const wineResult = convertParsedWineToResult(result.parsed, result.confidence);
      identification.setResult(wineResult, result.confidence);
      handleIdentificationResultFlow(wineResult, result.confidence ?? 1);
    }

  } catch (error) {
    // WIN-187: Don't show error for intentional cancellation
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }
    conversation.removeTypingMessage();
    handleIdentificationError(error);
  }
}
```

#### `executeImageIdentification()` (lines 378-422)

Apply identical two-phase pattern. The only differences:
- Calls `api.identifyImageStream(data, mimeType, supplementaryText, ...)` instead of `api.identifyTextStream(text, ...)`
- Already has different setup (no user message, different typing message)

### 4.6 Frontend: Store Fix

**File**: `qve/src/lib/stores/agentIdentification.ts`

Fix `setResult()` (lines 127-142) to clear `isEscalating`:

```typescript
export function setResult(
  result: WineIdentificationResult,
  confidence?: number
): void {
  store.update((state) => ({
    ...state,
    isIdentifying: false,
    isEscalating: false,      // [NEW] Clear escalation badge on result
    result,
    confidence: confidence ?? null,
    error: null,
    streamingFields: new Map(),
  }));

  persistIdentificationState(true);
}
```

**Note**: `completeEscalation()` also sets `isEscalating: false`, but `setResult()` should do it too as a safety net — especially for the Tier 1 result which precedes any escalation.

### 4.7 Frontend: WineCard "Refining..." Badge

**File**: `qve/src/lib/components/agent/cards/WineCard.svelte`

WineCard doesn't currently use DataCard's `header` prop. Add it following the pattern from `EnrichmentCard.svelte` (lines 62-75):

```svelte
<script>
    import { isEscalating } from '$lib/stores/agentIdentification';
    // ... existing imports ...

    // Reactive header for refining badge
    $: header = state !== 'skeleton' && $isEscalating
        ? { badge: 'Refining...', badgeStreaming: true }
        : undefined;
</script>

<!-- Pass header to DataCard -->
<DataCard {state} {data} {streamingFields} {header} ...>
```

**Note**: DataCard already supports `header.badge` and `header.badgeStreaming` for animated badge styling (DataCard.svelte:94-102, pulse animation at lines 159-171). No DataCard changes needed.

**Scope guard**: The `$isEscalating` store is global. WineCard is used on the agent panel (where refining makes sense) and potentially elsewhere. The `state !== 'skeleton'` check helps, but consider also guarding with the DataCard's `state` being `'streaming'` or `'complete'`.

### 4.8 Frontend: WineConfidenceSection Pulsing

**File**: `qve/src/lib/components/agent/wine/WineConfidenceSection.svelte`

This component receives slot props from DataCard (`state`, `fieldsMap`, `getFieldValue`, `hasField`) and has no store access. Prop-drill `isEscalating` from WineCard:

In **WineCard.svelte**, pass the prop:
```svelte
<WineConfidenceSection
    {state} {fieldsMap} {getFieldValue} {hasField}
    isEscalating={$isEscalating}
/>
```

In **WineConfidenceSection.svelte**, add prop and pulsing:
```svelte
<script>
    export let isEscalating: boolean = false;
    // ... existing props ...
</script>

<div class="confidence-section" class:pulsing={isEscalating && hasConfidence}>
    <ConfidenceIndicator score={confidence} />
</div>

<style>
    .confidence-section.pulsing :global(*) {
        animation: pulse 1.5s ease-in-out infinite;
    }

    @media (prefers-reduced-motion: reduce) {
        .confidence-section.pulsing :global(*) {
            animation: none;
        }
    }
</style>
```

Use the global `pulse` animation from `animations.css` (lines 40-47) for consistency.

### Risk Analysis

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Race: user acts during refining** | Medium | Guard: only update card if phase is still `confirming` |
| **Duplicate wine cards** | ~~Medium~~ Fixed | Use `conversation.updateMessage()` for in-place update instead of `handleIdentificationResultFlow()` |
| **Double result processing** | ~~Medium~~ Fixed | Post-await handling replaced with safety fallback (only runs if onEvent missed) |
| **Badge stuck forever** | ~~Medium~~ Fixed | `setResult()` now clears `isEscalating`. `completeEscalation()` always called on `refined` event. |
| **Mobile tab switch during refining** | Low | `isEscalating` is NOT persisted. Tier 1 result is persisted. On return: user sees valid Tier 1 result, no badge, refinement abandoned. Acceptable. |
| **Cancellation during refining** | Low | `isRequestCancelled()` checkpoints in `identifyEscalateOnly()` from WIN-227. Frontend AbortController cancels stream. |
| **Escalation worse than Tier 1** | Low | Only update if `escalatedResult.confidence > result.confidence` |
| **Escalation failure** | Low | Try/catch wraps escalation. On failure: send `refined` with `improved: false`. Frontend removes badge silently. |
| **TypeScript type errors** | ~~High~~ Fixed | `StreamEvent` union updated with `refining`/`refined` variants |

### Verification
- Run all Phase 0 tests + existing test suite
- New integration test: mock API with refining/refined events
- New test: verify in-place card update (no duplicate wine_result messages)
- Manual test: obscure wine → see Tier 1 result quickly, "Refining..." badge, result improves

---

## Phase 5: Testing Strategy

### 5.1 Automated Tests (during development)

Run after each phase:

```bash
# Frontend tests
cd qve && npx svelte-kit sync && npx vitest run

# TypeScript check
cd qve && npm run check

# Production build
cd qve && npm run build

# PHP syntax check (for each modified PHP file)
php -l resources/php/agent/Identification/IdentificationService.php
php -l resources/php/agent/identifyTextStream.php
php -l resources/php/agent/identifyImageStream.php
php -l resources/php/agent/config/agent.config.php
php -l resources/php/agent/LLM/Adapters/GeminiAdapter.php

# PHP unit tests
cd resources/php/tests && php vendor/bin/phpunit
```

**Pass criteria**: No regression from baseline test count. All new tests pass.

### 5.2 Manual Test Matrix

| # | Scenario | Input | Pass Criteria | Notes |
|---|----------|-------|---------------|-------|
| 1 | Well-known wine | "2019 Château Margaux" | TTFB < 1s, TTR < 2s, confidence ≥ 85%, no "Refining..." badge | Happy path, no escalation |
| 2 | Obscure wine | "Domaine Leflaive Bâtard-Montrachet 2017" | TTFB < 1s, card shows with "Refining..." badge, badge disappears after 3-8s, confidence improves | Escalation path |
| 3 | Nonsense text | "blue cheese 2024" | Low confidence result quickly, `user_choice` action, appropriate chips shown | Error path |
| 4 | Clear wine label photo | Photo of well-known label | TTFB < 1s, TTR < 2.5s, fields populate correctly | Image happy path |
| 5 | Blurry/dark photo | Poor quality image | Low confidence with "Refining..." badge, result improves or badge silently removed | Image escalation |
| 6 | Mobile tab switch during refining | Start obscure wine, switch to Camera app, return | Tier 1 result visible, no "Refining..." badge, no errors | Persistence |
| 7 | Click "Correct" during refining | Start obscure wine, quickly click "Correct" while "Refining..." shows | Proceeds with user action. Refined result ignored (phase advanced). Badge removed. | Race condition |
| 8 | Cancel during identification | Start search, press back/cancel before result | Clean abort, no error shown, no stale badge (WIN-227) | Cancellation |
| 9 | Cancel during refining | Start obscure wine, wait for Tier 1 card, then cancel | Tier 1 result preserved, refining abandoned, no error | Cancellation during escalation |

### 5.3 Performance Measurement

**Methodology**: Add temporary `performance.mark()` calls in the identification handler:

```typescript
// In executeTextIdentification, before API call:
performance.mark('id-start');

// In onField callback, first invocation:
if (!firstFieldMarked) { performance.mark('id-ttfb'); firstFieldMarked = true; }

// In onEvent result handler:
performance.mark('id-ttr');

// After identification complete:
console.log('TTFB:', performance.measure('ttfb', 'id-start', 'id-ttfb').duration, 'ms');
console.log('TTR:', performance.measure('ttr', 'id-start', 'id-ttr').duration, 'ms');
```

**Targets**: Measure for 3 test wines before and after changes.

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| TTFB (time to first field) | 2-4s | < 1s | `performance.measure('ttfb')` |
| TTR (time to result card) | 3-10s | < 2.5s | `performance.measure('ttr')` |

Remove `performance.mark()` calls before final commit.

---

## Phase 6: Verification & Cleanup

### 6.1 Full test suite
- `cd qve && npx svelte-kit sync && npx vitest run` — must not regress from baseline
- `cd qve && npm run check` — TypeScript must pass
- `cd qve && npm run build` — production build must succeed

### 6.2 Run full manual test matrix (Section 5.2)

### 6.3 Performance validation (Section 5.3)

### 6.4 Cleanup
- Remove any `performance.mark()` debugging
- Remove any `console.log` debugging
- Verify no TODO comments left in code

---

## Implementation Order

```
Phase 0 → Phase 1 + 3 → Phase 2 → Phase 4 → Phase 5 → Phase 6
 tests    thinking+schema  prompt   escalation  testing   verify
```

Why this order:
- Phase 0 first: safety net before any changes
- Phase 1 + 3 (thinking + schema): config changes, immediate measurable TTFB impact
- Phase 2 (prompt): depends on schema being in place (slim prompt is safe with schema constraint)
- Phase 4 (escalation): biggest change, builds on Phases 1-3 being stable
- Phase 5: testing throughout, formal testing after Phase 4
- Phase 6: final verification

---

## Files Modified Summary

### Backend (PHP)
| File | Changes |
|------|---------|
| `resources/php/agent/config/agent.config.php` | Remove `thinking_level` from `fast` tier, reduce temperature to 0.3, reduce max_tokens to 1500 |
| `resources/php/agent/Identification/IdentificationService.php` | Slim existing `buildIdentificationPrompt()` and `buildVisionPrompt()` (streaming-only). Add `getIdentificationSchema()`. Add `identifyEscalateOnly()`. Update `identifyStreaming()` + `identifyStreamingImage()` to use schema. |
| `resources/php/agent/identifyTextStream.php` | Non-blocking escalation: emit result first, then refining/refined events with try/catch |
| `resources/php/agent/identifyImageStream.php` | Same non-blocking escalation |
| `resources/php/agent/LLM/Adapters/GeminiAdapter.php` | Pass `response_schema` through in `buildStreamingPayload()` |

### Frontend (TypeScript/Svelte)
| File | Changes |
|------|---------|
| `qve/src/lib/api/types.ts` | Add `refining`/`refined` to `StreamEvent` union, add `StreamRefinedEvent` interface |
| `qve/src/lib/api/client.ts` | Handle `refining`/`refined` SSE events in both streaming method switch statements |
| `qve/src/lib/agent/handlers/identification.ts` | Two-phase pattern: show Tier 1 via onEvent, update card in-place on refined, remove post-await processing |
| `qve/src/lib/stores/agentIdentification.ts` | Fix `setResult()` to clear `isEscalating` |
| `qve/src/lib/components/agent/cards/WineCard.svelte` | Add `header` prop to DataCard with "Refining..." badge, import `isEscalating` |
| `qve/src/lib/components/agent/wine/WineConfidenceSection.svelte` | Add `isEscalating` prop, pulsing animation during escalation |

### New Test Files
| File | Tests |
|------|-------|
| `resources/php/tests/StreamingFieldDetectorTest.php` | 8 unit tests |
| `resources/php/tests/IdentificationServiceTest.php` | 3 unit tests |
| `qve/src/lib/api/__tests__/sseParser.test.ts` | 6 integration tests (via public methods) |
| `qve/src/lib/stores/__tests__/agentIdentification.test.ts` | 3 edge case tests added |
| `qve/src/lib/agent/__tests__/streaming.test.ts` | 4 tests added (including in-place update) |

### Unchanged (intentionally)
- `text_identify.txt` / `vision_identify.txt` — kept for non-streaming escalation path via TextProcessor/VisionProcessor
- `TextProcessor.php` / `VisionProcessor.php` — non-streaming path unchanged
- `agentEnrichStream.php` — enrichment not in scope
- `_bootstrap.php` — SSE helpers and cancellation functions unchanged, `sendSSE()` handles new event names without changes
- `DataCard.svelte` — already supports `header.badge` and `header.badgeStreaming`

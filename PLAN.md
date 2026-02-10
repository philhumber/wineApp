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
| — | Enrichment card (same pattern) | Deferred |

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

---

## What's Left

- **Phase 5**: Manual testing with real wines (TTFB measurements, escalation UX)
- **Enrichment card optimization**: Same non-blocking pattern, same streaming→message card lesson applies

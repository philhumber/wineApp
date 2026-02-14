# Wine Agent Prompts Documentation

All LLM prompts are defined in a single file: **`prompts/prompts.php`** (the `Prompts` class).

To review or tweak any prompt, edit that file only.

---

## Table of Contents

1. [Overview](#overview)
2. [Prompt Flow Diagrams](#prompt-flow-diagrams)
3. [Prompt Registry](#prompt-registry)
4. [Streaming vs Non-Streaming](#streaming-vs-non-streaming)
5. [Escalation Context](#escalation-context)
6. [Key Design Principles](#key-design-principles)

---

## Overview

The wine identification system uses multiple prompts across a four-tier escalation architecture.
Each tier uses a different model/thinking level, and the prompt varies by tier and input type:

| Tier | Model | Thinking | Text Prompt | Vision Prompt |
|------|-------|----------|-------------|---------------|
| **Tier 1 Streaming** | Gemini Flash | MINIMAL | `textIdentifyStreaming()` | `visionIdentifyStreaming()` |
| **Tier 1 Fallback** | Gemini Flash | LOW | `textIdentify()` | `visionIdentify()` |
| **Tier 1.5** | Gemini Flash | HIGH | `textIdentifyDetailed()` | `visionIdentifyDetailed()` |
| **Tier 2** | Claude Sonnet 4.5 | — | `textIdentify()` | `visionIdentifyDetailed()` |
| **Tier 3** | Claude Opus 4.5 | — | `textIdentify()` | `visionIdentifyDetailed()` |

Tiers 1.5–3 also append `escalationContext()` with prior result data.

**Note:** Text Tiers 2/3 use the *standard* prompt (not detailed) — Claude models are capable
enough with the standard prompt plus escalation context. Vision Tiers 2/3 always use the
*detailed* prompt because image interpretation benefits from the stricter verification rules.

---

## Prompt Flow Diagrams

### Text Identification

```
User types "Château Margaux 2015"
             │
             ▼
┌─ identifyTextStreaming() ──────────────────────────────────────┐
│  Prompt: textIdentifyStreaming($text)              [COMPACT]   │
│  Model:  Gemini Flash (MINIMAL thinking)                      │
│  + responseSchema (constrains JSON shape)                     │
│  Fields stream to UI progressively                            │
└──────────────────────────────┬─────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
       streaming off      streaming fails    confidence ok
       or not enabled     (fallback_on_error)      │
              │                │                   │
              ▼                ▼                   │
┌─ Tier 1 (non-streaming fallback) ────────┐      │
│  Prompt: textIdentify($text)    [FULL]   │      │
│  Model:  Gemini Flash (LOW thinking)     │      │
│  47 lines: examples, confidence rules    │      │
└────────────────────┬─────────────────────┘      │
                     │                             │
                conf < 85%                         │
                     │                             │
                     ▼                             │
┌─ Tier 1.5 ───────────────────────────────┐      │
│  Prompt: textIdentifyDetailed($text)     │      │
│        + escalationContext()  [DETAILED]  │      │
│  Model:  Gemini Flash (HIGH thinking)    │      │
│  Sommelier persona, abbreviation rules   │      │
└────────────────────┬─────────────────────┘      │
                     │                             │
                conf < 70%                         │
                     │                             │
                     ▼                             │
┌─ Tier 2 ─────────────────────────────────┐      │
│  Prompt: textIdentify($text)             │      │
│        + escalationContext()    [FULL]    │      │
│  Model:  Claude Sonnet 4.5              │      │
└────────────────────┬─────────────────────┘      │
                     │                             │
                conf < 60% / user triggers         │
                     │                             │
                     ▼                             │
┌─ Tier 3 (user-triggered) ────────────────┐      │
│  Prompt: textIdentify($text)             │      │
│        + escalationContext()    [FULL]    │      │
│  Model:  Claude Opus 4.5                │      │
│  Context includes user rejection reason  │      │
└──────────────────────────────────────────┘      │
                                                   │
                                                   ▼
                                              Return result
```

### Image Identification

```
User photographs a wine label
             │
             ▼
┌─ identifyImageStreaming() ─────────────────────────────────────┐
│  Prompt: visionIdentifyStreaming($suppText)        [COMPACT]   │
│  Model:  Gemini Flash (MINIMAL thinking)                      │
│  + responseSchema                                             │
│  Framing: "Read the text on this label" (anti-hallucination)  │
│  Fields stream to UI progressively                            │
└──────────────────────────────┬─────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
       streaming off      streaming fails    confidence ok
              │                │                   │
              ▼                ▼                   │
┌─ Tier 1 (non-streaming fallback) ────────┐      │
│  Prompt: visionIdentify()       [FULL]   │      │
│  Model:  Gemini Flash                    │      │
│  "Analyze this wine label image"         │      │
└────────────────────┬─────────────────────┘      │
                     │                             │
                conf < 85%                         │
                     │                             │
                     ▼                             │
┌─ Tier 1.5 ───────────────────────────────┐      │
│  Prompt: visionIdentifyDetailed()        │      │
│                             [DETAILED]   │      │
│  Model:  Gemini Flash (HIGH) + grounding │      │
│  "Use web search to verify your ID"      │      │
└────────────────────┬─────────────────────┘      │
                     │                             │
                conf < 70%                         │
                     │                             │
                     ▼                             │
┌─ Tier 2/3 ───────────────────────────────┐      │
│  Prompt: visionIdentifyDetailed()        │      │
│                             [DETAILED]   │      │
│  Model:  Claude Sonnet or Opus           │      │
│  (always detailed for vision)            │      │
└──────────────────────────────────────────┘      │
                                                   │
                                                   ▼
                                              Return result
```

### Enrichment

```
User taps "Enrich" after identification
             │
             ▼
┌─ agentEnrichStream.php ──────────────────┐
│  Prompt: enrichmentStreaming(...)         │
│  Model:  Gemini Flash (MEDIUM thinking)  │  [COMPACT]
│  + Google Search grounding               │
│  + responseSchema                        │
│  Fields stream to UI                     │
└──────────────────────────────────────────┘

(Fallback if streaming unavailable)
             │
             ▼
┌─ agentEnrich.php ────────────────────────┐
│  Prompt: enrichment(...)                 │
│  Model:  Gemini Flash                    │  [FULL]
│  + Google Search grounding               │
│  Full examples + narrative guidelines    │
└──────────────────────────────────────────┘
```

### Clarification (single tier, no escalation)

```
Duplicate wine found during add-to-cellar
             │
             ▼
┌─ clarifyMatch.php ───────────────────────┐
│  Prompt: clarifyMatch(...)               │
│  Model:  Gemini Flash                    │
│  "Which option best matches?"            │
└──────────────────────────────────────────┘
```

---

## Prompt Registry

All methods are static on the `Prompts` class in `prompts/prompts.php`.

### Text Identification

| Method | Used By | Description |
|--------|---------|-------------|
| `textIdentify($input)` | `TextProcessor::process()` | Standard prompt — examples, confidence rules, field descriptions. Used by Tier 1 fallback and Tiers 2/3 |
| `textIdentifyDetailed($input)` | `TextProcessor::process()` (escalation) | Tier 1.5 only — sommelier persona, abbreviation expansion, appellation rules |
| `textIdentifyStreaming($text)` | `IdentificationService::identifyTextStreaming()` | Compact 7-line prompt for fast TTFB. Paired with `responseSchema` which handles structure |

### Vision (Image) Identification

| Method | Used By | Description |
|--------|---------|-------------|
| `visionIdentify()` | `VisionProcessor::process()` | Standard Tier 1 — reads label text, infers from knowledge |
| `visionIdentifyDetailed()` | `VisionProcessor::process()` (escalation) | Tier 1.5/2/3 — adds web search verification, stricter null rules |
| `visionIdentifyStreaming($supplementaryText)` | `IdentificationService::identifyImageStreaming()` | "Read the label" framing to reduce hallucination. Compact for fast TTFB |

### Enrichment

| Method | Used By | Description |
|--------|---------|-------------|
| `enrichment($producer, $wineName, $vintage)` | `WebSearchEnricher::enrich()` | Full enrichment with examples and narrative field guidelines |
| `enrichmentStreaming($producer, $wineName, $vintage)` | `WebSearchEnricher::enrichStreaming()` | Compact version for streaming TTFB |

### Clarification

| Method | Used By | Description |
|--------|---------|-------------|
| `clarifyMatch(...)` | `clarifyMatch.php` | Helps user disambiguate between similar wines/regions/producers |

### Escalation Context

| Method | Used By | Description |
|--------|---------|-------------|
| `escalationContext(...)` | `IdentificationService` | Appended to any prompt when escalating to a higher tier |

---

## Streaming vs Non-Streaming

Each query type has a **compact** streaming prompt and a **full** non-streaming prompt:

| Query Type | Streaming (compact) | Non-streaming (full) | Why two? |
|------------|--------------------|--------------------|----------|
| Text ID | `textIdentifyStreaming` (7 lines) | `textIdentify` (47 lines) | Streaming uses `responseSchema` to constrain JSON shape, so the prompt doesn't need format/examples |
| Vision ID | `visionIdentifyStreaming` (26 lines) | `visionIdentify` (44 lines) | Same — schema handles structure |
| Enrichment | `enrichmentStreaming` (14 lines) | `enrichment` (51 lines) | Same — schema handles structure |

**Streaming prompts are compact for TTFB.** The `responseSchema` (defined in `getIdentificationSchema()` / `getEnrichmentSchema()`) constrains the output structure — field names, types, enums, ordering — so the prompt can skip format instructions, field descriptions, and examples. Fewer input tokens = faster time to first streamed field (~2s target).

**Non-streaming prompts include everything.** Without a schema, the prompt must fully describe the expected JSON shape, provide examples, and spell out field-level instructions. These are used for Tier 1 fallback and all escalation tiers.

---

## Escalation Context

When escalating from one tier to the next, `Prompts::escalationContext()` builds a context string that includes:

1. **Original user input** — what they searched for
2. **Previous model result** — producer, wine, region, and confidence from the prior tier
3. **Rejection reason** — whether the user rejected the result or the system auto-escalated
4. **Locked fields** — user-confirmed values that must be preserved exactly

This context is appended to the base prompt by `TextProcessor` or `VisionProcessor` via the `prior_context` option.

### User Supplementary Context

When users provide additional context (e.g., "it's a French wine from the 2010s"), this is parsed by `InferenceEngine::parse` and appended separately:

**Structured parsing**:
```
ADDITIONAL USER CONSTRAINTS:
- Country must be: France
- Vintage range: 2010-2019
```

**Fallback** (raw text):
```
USER CONTEXT: it's a French wine from the 2010s
```

---

## Key Design Principles

1. **Recognition over completion**: Confidence reflects whether the wine is actually recognized, not just whether fields can be filled with plausible data.

2. **JSON-only responses**: All prompts explicitly request JSON output to ensure parseable responses.

3. **Confidence calibration**: Clear guidelines for HIGH (80-100), MEDIUM (50-79), and LOW (0-49) confidence bands.

4. **Label-reading framing**: Vision streaming prompt says "read the text on this label" — not "identify this wine" — to reduce hallucination.

5. **Streaming prompts are compact**: Streaming variants are intentionally shorter for faster TTFB. The `responseSchema` handles structure, so the prompt can skip format instructions.

6. **Single source of truth**: Every prompt lives in `prompts/prompts.php`. No inline prompts, no .txt template files.

7. **Text vs vision escalation asymmetry**: Text Tiers 2/3 use the standard prompt (Claude handles text well without extra instructions). Vision Tiers 2/3 always use the detailed prompt (image interpretation benefits from stricter verification rules).

---

## Files Reference

| File | Purpose |
|------|---------|
| `prompts/prompts.php` | **All prompts** — the sole source of truth |
| `Identification/TextProcessor.php` | Calls `textIdentify()` / `textIdentifyDetailed()` |
| `Identification/VisionProcessor.php` | Calls `visionIdentify()` / `visionIdentifyDetailed()` |
| `Identification/IdentificationService.php` | Calls streaming prompts + `escalationContext()` |
| `Enrichment/WebSearchEnricher.php` | Calls `enrichment()` / `enrichmentStreaming()` |
| `clarifyMatch.php` | Calls `clarifyMatch()` |
| `Identification/InferenceEngine.php` | Parses user supplementary context (not a prompt file) |

---

*Last updated: February 2026*

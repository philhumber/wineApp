# Wine Agent Prompts Documentation

All LLM prompts are defined in a single file: **`prompts/prompts.php`** (the `Prompts` class).

To review or tweak any prompt, edit that file only.

---

## Table of Contents

1. [Overview](#overview)
2. [Prompt Registry](#prompt-registry)
3. [Escalation Context](#escalation-context)
4. [Prompt Usage by Tier](#prompt-usage-by-tier)
5. [Key Design Principles](#key-design-principles)

---

## Overview

The wine identification system uses multiple prompts across a four-tier escalation architecture:

| Tier | Model | Thinking | Prompt Method |
|------|-------|----------|---------------|
| **Tier 1** | Gemini 3 Flash | LOW | `textIdentify()` / `visionIdentify()` |
| **Tier 1 Streaming** | Gemini 3 Flash | MINIMAL | `textIdentifyStreaming()` / `visionIdentifyStreaming()` |
| **Tier 1.5** | Gemini 3 Flash | HIGH | `textIdentifyDetailed()` / `visionIdentifyDetailed()` |
| **Tier 2** | Claude Sonnet 4.5 | N/A | `textIdentifyDetailed()` + `escalationContext()` |
| **Tier 3** | Claude Opus 4.5 | N/A | `textIdentifyDetailed()` + `escalationContext()` |

All prompts enforce:
- JSON-only output format
- Confidence scoring based on recognition (not field completion)
- Null values for unrecognized/uncertain fields

---

## Prompt Registry

All methods are static on the `Prompts` class in `prompts/prompts.php`.

### Text Identification

| Method | Used By | Description |
|--------|---------|-------------|
| `textIdentify($input)` | `TextProcessor::process()` | Standard Tier 1 prompt with examples and confidence rules |
| `textIdentifyDetailed($input)` | `TextProcessor::process()` (escalation) | Tier 1.5+ with sommelier persona, abbreviation expansion, appellation rules |
| `textIdentifyStreaming($text)` | `IdentificationService::identifyTextStreaming()` | Compact prompt for fast TTFB with Gemini `responseSchema` |

### Vision (Image) Identification

| Method | Used By | Description |
|--------|---------|-------------|
| `visionIdentify()` | `VisionProcessor::process()` | Standard Tier 1 — reads label text, infers from knowledge |
| `visionIdentifyDetailed()` | `VisionProcessor::process()` (escalation) | Tier 1.5+ — adds web search verification, stricter null rules |
| `visionIdentifyStreaming($supplementaryText)` | `IdentificationService::identifyImageStreaming()` | "Read the label" framing to reduce hallucination. Compact for fast TTFB |

### Enrichment

| Method | Used By | Description |
|--------|---------|-------------|
| `enrichment($producer, $wineName, $vintage)` | `WebSearchEnricher::enrich()` | Full enrichment with examples and narrative field guidelines |
| `enrichmentStreaming($producer, $wineName, $vintage)` | `WebSearchEnricher::enrichStreaming()` | Compact version for streaming TTFB |

### Clarification

| Method | Used By | Description |
|--------|---------|-------------|
| `clarifyMatch($producer, $wineName, $vintage, $region, $type, $optionsList)` | `clarifyMatch.php` | Helps user disambiguate between similar wines/regions/producers |

### Escalation Context

| Method | Used By | Description |
|--------|---------|-------------|
| `escalationContext($priorResult, $lockedFields, $escalationContext)` | `IdentificationService` | Appended to any prompt when escalating to a higher tier |

---

## Escalation Context

When escalating from one tier to the next, `Prompts::escalationContext()` builds a context string that includes:

1. **Original user input** — what they searched for
2. **Previous model result** — producer, wine, region, and confidence from the prior tier
3. **Rejection reason** — whether the user rejected the result or the system auto-escalated
4. **Locked fields** — user-confirmed values that must be preserved exactly

This context is appended to the base prompt by the consuming code (`TextProcessor` or `VisionProcessor`) via the `prior_context` option.

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

## Prompt Usage by Tier

### Tier 1: Fast (Gemini 3 Flash, LOW thinking)

- **Prompt**: `Prompts::textIdentify()` or `Prompts::visionIdentify()`
- **Streaming**: `Prompts::textIdentifyStreaming()` or `Prompts::visionIdentifyStreaming()`
- **Temperature**: 0.3
- **Context**: None (first attempt)

### Tier 1.5: Detailed (Gemini 3 Flash, HIGH thinking)

- **Prompt**: `Prompts::textIdentifyDetailed()` or `Prompts::visionIdentifyDetailed()`
- **Temperature**: 0.4
- **Context**: `Prompts::escalationContext()` from Tier 1

### Tier 2: Balanced (Claude Sonnet 4.5)

- **Prompt**: `Prompts::textIdentifyDetailed()` (text) or `Prompts::visionIdentifyDetailed()` (vision)
- **Temperature**: 0.3
- **Context**: `Prompts::escalationContext()` from Tier 1.5

### Tier 3: Premium (Claude Opus 4.5) - User-triggered

- **Prompt**: `Prompts::textIdentifyDetailed()` + `Prompts::escalationContext()`
- **Temperature**: 0.3
- **Context**: Includes user rejection reason and locked fields

---

## Key Design Principles

1. **Recognition over completion**: Confidence reflects whether the wine is actually recognized, not just whether fields can be filled with plausible data.

2. **JSON-only responses**: All prompts explicitly request JSON output to ensure parseable responses.

3. **Confidence calibration**: Clear guidelines for HIGH (80-100), MEDIUM (50-79), and LOW (0-49) confidence bands.

4. **Label-reading framing**: Vision streaming prompt says "read the text on this label" — not "identify this wine" — to reduce hallucination.

5. **Streaming prompts are compact**: Streaming variants are intentionally shorter than their non-streaming counterparts for faster time-to-first-byte.

6. **Single source of truth**: Every prompt lives in `prompts/prompts.php`. No inline prompts, no .txt template files.

---

## Files Reference

| File | Purpose |
|------|---------|
| `prompts/prompts.php` | **All prompts** — the sole source of truth |
| `Identification/TextProcessor.php` | Calls `Prompts::textIdentify()` / `textIdentifyDetailed()` |
| `Identification/VisionProcessor.php` | Calls `Prompts::visionIdentify()` / `visionIdentifyDetailed()` |
| `Identification/IdentificationService.php` | Calls streaming prompts + `escalationContext()` |
| `Enrichment/WebSearchEnricher.php` | Calls `Prompts::enrichment()` / `enrichmentStreaming()` |
| `clarifyMatch.php` | Calls `Prompts::clarifyMatch()` |
| `Identification/InferenceEngine.php` | Parses user supplementary context (not a prompt file) |

---

*Last updated: February 2026*

# Agent Conversation Flows — Training & Consistency Guide

> Comprehensive step-by-step documentation of every agent conversation flow.
> Use this to QA consistency, onboard to the agent's behavior, and audit message/chip pairings.

**Personality**: All text shown is the **Sommelier** (Quentin Verre-Épais) — the default personality.
**Last Updated**: 2026-02-13

---

## 1. How to Read This Guide

### Notation

| Symbol | Meaning |
|--------|---------|
| **[Chip Label]** | Primary-variant chip (emphasized action) |
| [Chip Label] | Secondary-variant chip |
| `phase_name` | Current agent phase |
| *(1 of N)* | One of N random message variants |
| *Wine Name* | Italicized wine name (rendered via `wn()` helper) |
| -> | Flow continues at referenced section |

### Chip Format

Chips are shown as: **[Label]** `action_dispatched`

Example: **[That's Right]** `correct` means a primary chip labeled "That's Right" that dispatches the `correct` action.

### Phases

| Phase | Input Enabled | Description |
|-------|:---:|-------------|
| `greeting` | No | Initial welcome |
| `awaiting_input` | Yes | Waiting for text or image |
| `identifying` | No | API call in progress |
| `confirming` | Yes | Showing result, awaiting decision |
| `enriching` | No | Fetching enrichment data |
| `adding_wine` | Yes | Multi-step add flow |
| `error` | Yes | Error with recovery options |
| `complete` | No | Session complete |

---

## 2. Session Start & Greeting

**Trigger**: Agent panel opens for the first time (or after Start Over).

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `greeting` | "Good morning. Shall we find something worth remembering?" *(1 of 5 — varies by time of day)* | — |
| 2 | `awaiting_input` | *(input placeholder: "Wine name or photo...")* | — |

**Greeting variants by time:**

| Time | Example | Variants |
|------|---------|:--------:|
| Morning | "Good morning. Shall we find something worth remembering?" | 5 |
| Afternoon | "Good afternoon. What shall we discover?" | 5 |
| Evening | "Good evening. What shall we discover?" | 5 |
| Default | "Welcome. I'm at your service — wine-related matters preferred, though I try not to be rigid." | 1 |

**User types wine description** -> Go to [3. Text Identification Flow]
**User taps camera button** -> Go to [4. Image Identification Flow]

---

## 3. Text Identification Flow

### 3a. Happy Path — High Confidence, All Fields

**Trigger**: User types a descriptive wine query (e.g., "Château Margaux 2015")

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `awaiting_input` | — | — |
| 2 | `identifying` | "Let me take a considered look at this..." *(1 of 3)* | — |
| | | *(streaming card shows fields arriving: producer, name, vintage, region...)* | |
| 3 | `confirming` | Wine Card (producer, name, vintage, region, confidence %) | — |
| 4 | `confirming` | "Ah, *Château Margaux*. I do believe we have a match. Is this correct?" | **[That's Right]** `correct` · [Not Quite] `not_correct` |

**User taps "That's Right"** -> Go to [7a. Correct — All Fields]
**User taps "Not Quite"** -> Go to [7d. Not Correct]
**User types "yes"/"correct"/"right"** -> Same as "That's Right"
**User types "no"/"wrong"/"nope"** -> Same as "Not Quite"
**User types new wine text** -> Go to [6. New Search During Confirmation]

---

### 3b. Low Confidence Path (< 70%)

Same as 3a but step 4 uses the low-confidence message:

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 4 | `confirming` | "I have a suspicion this is *Château Margaux*, though I'd rather be certain than confident. Does this look right?" | **[That's Right]** `correct` · [Not Quite] `not_correct` |

For **image** identifications, chips also include [Verify] `verify` between Correct and Not Correct (see [4. Image Identification Flow]).

**Same branching as 3a.**

---

### 3c. Incomplete Result — Missing Producer

**Trigger**: API returns wine name + vintage but no producer.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 3 | `confirming` | Wine Card (wine name, vintage — no producer) | — |
| 4 | `confirming` | "Ah, *Pinot Noir 2018*. I do believe we have a match. Is this correct?" | **[That's Right]** `correct` · [Not Quite] `not_correct` |

**User taps "That's Right"** -> Confirmation handler detects missing producer:

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 5 | `awaiting_input` | "I know the wine, but the producer remains a mystery. Who deserves the credit?" | [Add Details] `add_missing_details` · [Search Again] `provide_more` |

**User types "Caymus Vineyards"** -> Field detected as producer, result updated -> Go to [7a] or continues prompting if more fields missing
**User taps "Add Details"** -> Go to [8d. Add Details]
**User taps "Search Again"** -> Go to [8e. Provide More Context]

---

### 3d. Incomplete Result — Missing Wine Name

**Trigger**: API returns producer but no wine name.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 5 | `awaiting_input` | "I've identified the producer, but the specific wine is being coy. Would you like to name it, or shall I suggest?" | [Use Producer Name] `use_producer_name` · [Add Details] `add_missing_details` · [Search Again] `provide_more` |

If grapes are also present, additional chip appears: [Use the Grape Name] `use_grape_as_name`

**User taps "Use Producer Name"** -> Sets wineName = producer -> Go to [7a] or continues prompting
**User taps "Use the Grape Name"** -> Sets wineName = first grape -> Go to [7a] or continues prompting
**User types a wine name** -> Field detected, result updated -> continues flow

---

### 3e. Incomplete Result — Missing Vintage

**Trigger**: API returns producer + wine name but no vintage.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 5 | `awaiting_input` | "The vintage is proving elusive. Is this a non-vintage wine, or would you care to specify the year?" | [Specify Vintage] `add_missing_details` · [Non-Vintage] `nv_vintage` |

**User taps "Non-Vintage"** -> Sets vintage = "NV" -> Go to [7a] or continues prompting
**User taps "Specify Vintage"** -> Go to [8d. Add Details] (prompts for vintage)
**User types "2019"** -> Detected as vintage, result updated

---

### 3f. Grape-Only Result

**Trigger**: API returns only grape variety — no producer or wine name.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 3 | `awaiting_input` | Wine Card (grapes only) | — |
| 4 | `awaiting_input` | "I detected *Cabernet Sauvignon* as the grape variety, but couldn't identify the wine or producer. We could use the grape name as the wine name, add details manually, or try searching again with more information." | [Use the Grape Name] `use_grape_as_name` · [Add Details] `add_missing_details` · [Search Again] `provide_more` |

If producer is also present: additional chip [Use Producer Name] `use_producer_name`
If low confidence + can escalate: additional chip **[Look Closer]** `try_opus`

**Note**: Phase is `awaiting_input` (not `confirming`) — skips confirmation since there's not enough to confirm.

---

### 3g. Nothing Found

**Trigger**: API returns no meaningful result.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 3 | `awaiting_input` | "I'm afraid this one eludes me. Could you tell me more? I'd rather ask than guess." | [Try Again] `provide_more` · [Start Over] `start_over` |

**Note**: The "Try Again" chip here dispatches `provide_more` (not `retry`), which stores augmentation context and prompts for more details.

---

### 3h. Text Tier 2 Auto-Escalation During Streaming

**Trigger**: During **text** SSE streaming, backend sends `refining` event (Tier 2 started), then `refined` event with improved result.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 2 | `identifying` | "Let me take a considered look at this..." *(1 of 3)* | — |
| | | *(streaming card shows "Refining..." badge)* | |
| | | *(escalated result replaces Tier 1 if confidence improved)* | |

This is invisible to the user except for the "Refining..." badge. The final result shown is whichever tier produced higher confidence. Flow continues to 3a-3g based on the final result.

**Note**: Image identification does NOT use backend auto-escalation. See [4. Image Identification Flow] for image-specific escalation.

---

## 4. Image Identification Flow

**Trigger**: User takes photo or selects image from gallery.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `awaiting_input` | — | — |
| | | *(user image appears in chat)* | |
| 2 | `identifying` | "Analyzing the label. The details matter." *(1 of 3)* | — |
| | | *(streaming card shows fields arriving)* | |

**Tier 1 prompt**: Framed as "read text on this label" (not "identify wine") to reduce hallucination. All schema fields are nullable — the LLM returns null for anything it can't literally read on the label.

**After Tier 1 completes, two paths based on confidence:**

### 4a. Auto-Verify (confidence < 60%)

When Tier 1 returns low confidence (< 60), the frontend automatically triggers grounded verification.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 3 | `identifying` | *(streaming card stays visible with "Refining..." badge)* | — |
| | | "Let me verify this with a web search..." | — |
| 4 | `confirming` | *(streaming fields update in-place with verified data, then transition to message card)* | — |
| 5 | `confirming` | Confidence-appropriate message (see 3a/3b) | **[That's Right]** `correct` · [Not Quite] `not_correct` |

The verify call hits `verifyImage.php` → `identifyEscalateOnly()` → Tier 1.5 (grounded Gemini + detailed prompt) → optionally Tier 2 (Claude Sonnet fallback).

If verification fails, falls back to showing the original Tier 1 result with the [Verify] chip.

### 4b. Manual Verify (confidence >= 60%)

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 3 | `confirming` | Wine Card (producer, name, vintage, region, confidence %) | — |
| 4 | `confirming` | Confidence-appropriate message (see 3a/3b) | **[That's Right]** `correct` · [Verify] `verify` · [Not Quite] `not_correct` |

**User taps "Verify"** → Go to [4c. Manual Verify Flow]
**Other chips** → Same branching as 3a.

### 4c. Manual Verify Flow

**Trigger**: User taps [Verify] chip on an image result.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `identifying` | "Let me verify this with a web search..." | — |
| 2 | `confirming` | Wine Card (verified result — possibly updated fields and confidence) | — |
| 3 | `confirming` | Confidence-appropriate message | **[That's Right]** `correct` · [Not Quite] `not_correct` |

After verification, no [Verify] chip is shown — the result is already verified.

### Image flow differences from text
- User message is an image (not text)
- Typing indicator uses `ID_ANALYZING` instead of `ID_THINKING`
- Image data is stored for potential re-identification with supplementary text
- Confirmation chips include [Verify] for manual grounded verification (text flow does not)
- Auto-escalation happens in frontend (not backend SSE events)

---

## 5. Brief Input Confirmation

**Trigger**: User types a single word (e.g., "Margaux") without augmentation context.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `awaiting_input` | — | — |
| 2 | `awaiting_input` | "Just 'Margaux'? Adding more detail will improve the match." | **[Search Anyway]** `confirm_brief_search` · [I'll Add More] `add_more_detail` |

**User taps "Search Anyway"** -> Executes identification with "Margaux" -> Go to [3a-3g]
**User taps "I'll Add More"** -> Stores "Margaux" as `briefInputPrefix`, stays in `awaiting_input`

After "I'll Add More", if user types "2015 Bordeaux":
- Combined search text: "Margaux 2015 Bordeaux" (prefix + new input)
- Deduplication: if user types "Margaux Grand Cru", search is "Margaux Grand Cru" (not "Margaux Margaux Grand Cru")

**Note**: Brief input check is skipped if augmentation context already exists (e.g., during field completion).

---

## 6. New Search During Confirmation

**Trigger**: User types new text while in `confirming` phase with an existing result.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `confirming` | *(existing wine result is showing)* | |
| | | *(user types "Actually, try Château Lafite")* | |
| 2 | `confirming` | "Shall we start afresh? Sometimes the best approach is a clean slate." | **[Search New]** `confirm_new_search` · [Keep Current] `continue_current` |

**User taps "Search New"** -> Clears current identification, executes new search -> Go to [3a-3g]
**User taps "Keep Current"** -> Dismisses chips, stays in `confirming` with original result

**Note**: If user types a recognized chip response ("yes"/"no") during confirming, that's handled as confirmation (not new search). Chip response detection runs before new search detection.

---

## 7. Confirmation Flow

### 7a. "That's Right" — All Fields Present, High Confidence

**Trigger**: User taps "That's Right" or types "yes" — result has producer + wine name + vintage and confidence >= 0.7.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `confirming` | "Excellent. What would you like to do with *Château Margaux*?" *(1 of 3)* | **[Add to Cellar]** `add_to_cellar` · [Tell Me More] `learn` · [Remember] `remember` |

**User taps "Add to Cellar"** -> Go to [11. Add to Cellar Flow]
**User taps "Tell Me More"** -> Go to [10. Enrichment Flow]
**User taps "Remember"** -> Go to [17. Remember Flow]

**Note**: If enrichment data already exists (from a previous Learn More), the "Tell Me More" chip is hidden.

---

### 7b. "That's Right" — Missing Fields

**Trigger**: User taps "That's Right" but some required fields are missing.

The agent prompts for the specific missing field. See sections [3c-3e] for the exact messages and chips based on what's missing. The handler logic is identical to `handleCorrect()` and `handleMissingFieldProvided()`.

---

### 7c. "That's Right" — Low Confidence + All Fields

**Trigger**: User taps "That's Right" — all fields present but confidence < 0.7.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `confirming` | Wine Card (showing all fields with low confidence %) | — |
| 2 | `confirming` | "I've gathered the details for *Château Margaux*. Would you like me to try matching this wine in my database, or add it manually?" | **[Try to Match]** `reidentify` · [Add Manually] `continue_as_is` |

**User taps "Try to Match"** -> Go to [8e. Re-identify]
**User taps "Add Manually"** -> Shows action chips ("Excellent. What would you like to do next?" *(1 of 3)*) with phase set to `adding_wine`

---

### 7d. "Not Quite" — Field Correction Flow

**Trigger**: User taps "Not Quite" or types "no"/"wrong". This is the same flow every time — whether it's the first "Not Quite" or after a correction/escalation.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `awaiting_input` | "What needs fixing? Tap a field to correct it, or add more details." | Field chips (grouped) + action chips (grouped) |

**Visual grouping**: Field chips and action chips render in separate bordered containers with "FIELDS" and "ACTIONS" labels. Field chip labels show the field name in bold and the value in normal weight (e.g., **Producer:** Chateau Margaux).

**Field Correction Chips** — one chip per scalar field (producer, wineName, vintage, region, country, type), displayed in a "Fields" group. All six fields are always shown — populated fields show their value, empty fields show *add...* as a placeholder:

| Chip Label | Variant | Action | Payload |
|-----------|---------|--------|---------|
| **Producer:** Chateau Margaux | — | `correct_field` | `{ field: 'producer' }` |
| **Wine:** Grand Vin | — | `correct_field` | `{ field: 'wineName' }` |
| **Vintage:** *add...* | `secondary` | `correct_field` | `{ field: 'vintage' }` |
| **Region:** Bordeaux | — | `correct_field` | `{ field: 'region' }` |
| **Country:** France | — | `correct_field` | `{ field: 'country' }` |
| **Type:** Red | — | `correct_field` | `{ field: 'type' }` |

Grapes are NOT lockable (array field — excluded from field correction chips).
Previously corrected fields show a lock indicator and `primary` variant.
Empty fields use `secondary` variant — dashed border, reduced opacity, italic *add...* placeholder. This lets users add missing fields the LLM didn't identify.

**Action chips** (displayed in a separate "Actions" group): [Add Details] `provide_more` | [Look Closer] `try_opus` | [Start Over] `start_fresh`

**User taps a field chip** (e.g., `[Producer: Chateau Margaux]`):

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 2 | `awaiting_input` | "Enter the correct producer:" *(+ input placeholder changes)* | — |

**User types correction** (e.g., "Chateau Palmer"):

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 3 | `confirming` | "Got it. Here's the updated result:" + updated wine card | [Looks Good] [Look Closer] [Not Quite] |

The updated wine card shows the corrected field value. The confirmation chips include "Look Closer" so the user can escalate with their corrections applied.

**User taps "Looks Good"** -> Accepts corrected result -> [7a. Correct — All Fields]
**User taps "Look Closer"** -> Go to [9. Opus Escalation] (locked fields sent to backend, post-processed)
**User taps "Not Quite"** -> Returns to Step 1 (same flow — previously locked fields preserved with lock indicators)
**From Step 1, user taps "Add Details"** -> Existing free-text augmentation flow (locked fields preserved alongside)
**From Step 1, user taps "Start Over"** -> Clears locked fields -> Go to [16a. Start Over]
**From Step 1, user taps another field chip** -> Enters correction mode for that field (Step 2)

**Locked fields guarantee**: Any subsequent LLM call (escalation, Opus, re-identification) will have locked field values forcibly overwritten via post-processing, regardless of LLM output. Minor normalization (capitalization, accents) is allowed if the LLM's value matches the user's core correction.

---

## 8. Field Completion Sub-Flows

### 8a. Use Producer Name as Wine Name

**Trigger**: User taps "Use Producer Name" chip.

The producer name is copied to the wine name field. Flow continues:
- If all fields now present -> Go to [7a. Action Chips]
- If more fields missing -> Prompts for next missing field

---

### 8b. Use Grape Name as Wine Name

**Trigger**: User taps "Use the Grape Name" chip.

The first grape variety is used as the wine name. Flow continues same as 8a.

---

### 8c. Non-Vintage

**Trigger**: User taps "Non-Vintage" chip.

Vintage is set to "NV". Flow continues same as 8a.

---

### 8d. Add Details (Prompted Field Input)

**Trigger**: User taps "Add Details" chip from incomplete result.

Agent prompts for the specific missing field:

| Missing Field | Agent Says |
|--------------|-----------|
| Producer | "Who makes this wine? Enter the producer or winery name." |
| Wine Name | "What's the name of this wine? You can also include the vintage." |
| Vintage | "What year is this wine? Enter the vintage (e.g., 2019) or type 'NV' for non-vintage." |
| Generic | "What details would you like to add or correct?" |

Phase: `awaiting_input` — user types the missing value directly.

**Field detection**: The system detects direct values like "2019" (vintage), "Caymus" (producer), or explicit field input like "producer: Caymus Vineyards".

---

### 8e. Re-identify with Accumulated Fields / Provide More Context

**Trigger**: User taps "Try to Match" (`reidentify`) or "I Can Help" / "Search Again" (`provide_more`).

**Reidentify** (`reidentify`):
| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `identifying` | "Let me try to find a better match..." | — |

Assembles search query from all current fields (producer + wineName + vintage + region + country + type) and re-runs identification.

**Provide More** (`provide_more`):
| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `awaiting_input` | "Tell me what's different about this wine, and I'll try again. The producer, country, region, or grape variety would help." | — |

Stores augmentation context and waits for user input. When user types, the new text is combined with accumulated result context for a richer search.

---

## 9. Opus Escalation Flow

**Trigger**: User taps "Look Closer" chip (manual escalation to Claude Opus).

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `identifying` | "Let me look more carefully. Some wines don't reveal themselves on the first glance." | — |
| 2 | `confirming` | Wine Card (Opus result) | — |
| 3 | `confirming` | "Ah, *Château Margaux*. I do believe we have a match. Is this correct?" | **[That's Right]** `correct` · [Not Quite] `not_correct` |

Escalation uses whichever input is available (in priority order):
1. Last image data (if image identification was used)
2. Last text submission
3. Augmentation context (accumulated result)

**On error**: Shows error message + error chips -> Go to [18a. Identification Errors]

---

## 10. Enrichment Flow

### 10a. Happy Path — No Cache

**Trigger**: User taps "Tell Me More" chip.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `enriching` | "Consulting my sources. One moment." *(1 of 3)* | — |
| | | *(7-second delay before enrichment card appears)* | |
| 2 | `enriching` | Enrichment Card (skeleton -> fields populate via streaming) | — |
| | | *(text fields stream token-by-token with blinking cursor)* | |
| 3 | `confirming` | "Here's what I found about *Château Margaux*. What would you like to do next?" | **[Add to Cellar]** `add_to_cellar` · [Remember] `remember` · [Start Over] `start_over` |

**User taps "Add to Cellar"** -> Go to [11. Add to Cellar] (with enrichment data attached)
**User taps "Remember"** -> Go to [17. Remember Flow]
**User taps "Start Over"** -> Go to [16a. Start Over]

**Enrichment card fields**: overview, grape composition, style profile (body/tannin/acidity/sweetness), critic scores, drink window, tasting notes, pairing notes.

---

### 10b. Cache Hit — Confirm or Refresh

**Trigger**: Enrichment API finds cached data for a similar (not exact) wine.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `confirming` | "I found cached data for *Château Margaux 2009*, but you asked about *Château Margaux 2015*. Would you like to use what I have?" | **[Use What You Have]** `confirm_cache_match` · [Search Afresh] `force_refresh` |

If exact match (no name mismatch):
| Agent Says |
|-----------|
| "I found cached data for *Château Margaux*. Is this the wine you're looking for?" |

---

### 10c. Cache Confirmation — Use Cached

**Trigger**: User taps "Use What You Have".

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `enriching` | "Using cached data..." | — |

Then continues as [10a steps 2-3] with the cached data.

---

### 10d. Cache Confirmation — Search Afresh

**Trigger**: User taps "Search Afresh".

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `enriching` | "Searching for fresh data..." | — |

Then continues as [10a steps 2-3] with fresh API data.

---

### 10e. Enrichment Error

**Trigger**: Enrichment API call fails.

**Retryable error** (timeout, rate limit, server error):

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `error` | Error message (e.g., "I appear to be taking longer than is polite...") | **[Tell Me More]** `learn` · [Add Without Details] `add_to_cellar` · [Start Over] `start_over` |

**Non-retryable error**:

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `error` | Error message | [Add Without Details] `add_to_cellar` · [Start Over] `start_over` |

**Note**: "Tell Me More" chip only shown for retryable errors (as primary variant). "Add Without Details" dispatches `add_to_cellar` directly, allowing user to proceed without enrichment.

---

## 11. Add to Cellar Flow

### 11a. No Duplicate — Entity Matching

**Trigger**: User taps "Add to Cellar" — no duplicate wine found.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `adding_wine` | "Let's get this into your cellar where it belongs." *(1 of 2)* | — |
| 2-4 | `adding_wine` | *(entity matching: region -> producer -> wine)* | — |
| | | *(see [12. Entity Matching] for details)* | |
| 5 | `adding_wine` | "Great! Now let's add the bottle details." | — |
| 6 | `adding_wine` | *(Bottle Details Form — see [13])* | — |

---

### 11b. Duplicate Found — Add Another Bottle

**Trigger**: User taps "Add to Cellar" — duplicate wine exists.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `adding_wine` | "Let's get this into your cellar where it belongs." *(1 of 2)* | — |
| 2 | `adding_wine` | "I found *Margaux* by *Château Margaux* already in your cellar with 3 bottles." | **[Add Another Bottle]** `add_bottle_existing` · [Create New Wine] `create_new_wine` |

**User taps "Add Another Bottle"** -> Skips entity matching, goes directly to Bottle Form [13]
**User taps "Create New Wine"** -> Go to [11c]

---

### 11c. Duplicate Found — Create New Wine

**Trigger**: User taps "Create New Wine" from duplicate detection.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `adding_wine` | "I'll create this as a new wine entry." | — |
| 2+ | `adding_wine` | *(entity matching starts)* -> Go to [12. Entity Matching] | — |

---

## 12. Entity Matching Sub-Flow

Entity matching processes three entity types in sequence: **region -> producer -> wine**.

### 12a. No Matches — Auto-Create

| Step | Phase | Agent Says |
|------|-------|-----------|
| 1 | `adding_wine` | "No existing regions match 'Médoc'. I'll create a new entry." |

Automatically creates a new entity and advances to the next type.

---

### 12b. Single Exact Match — Auto-Select

| Step | Phase | Agent Says |
|------|-------|-----------|
| 1 | `adding_wine` | "Found existing region: *Médoc*" |

Automatically selects the match and advances to the next type.

---

### 12c. Multiple Matches — Selection Form

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `adding_wine` | "I found 3 regions that might match 'Médoc'." | — |
| 2 | `adding_wine` | *(Match Selection Form — list of options + "Add new region" button)* | *(form interactions)* |

User selects a match -> "Selected: *Médoc*" -> advances to next entity
User taps "Add new region" -> "Creating new region: *Médoc*" -> advances to next entity

---

### 12d. Clarification Request

**Trigger**: User requests clarification on match options.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `adding_wine` | "Let me help you decide..." | — |
| 2 | `adding_wine` | *(LLM explanation of differences between options)* | — |
| 3 | `adding_wine` | *(Match Selection Form re-shown)* | *(form interactions)* |

**On clarification error**: "I couldn't get more details. Please select from the options above or create a new entry."

---

## 13. Bottle Details Form

**Trigger**: Entity matching completes (or skipped for duplicate flow).

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `adding_wine` | "Great! Now let's add the bottle details." | — |
| 2 | `adding_wine` | *(Bottle Details Form Part 1: bottle size, storage location, source, price, currency, purchase date)* | — |

User fills form and submits. If enrichment data already exists:
-> Skip enrichment choice, go directly to submission [15]

If no enrichment data:

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 3 | `adding_wine` | "Almost done! Would you like to add enrichment data (grape info, critic scores)?" | **[Yes, Do Tell]** `enrich_now` · [No, Add Quickly] `add_quickly` |

-> Go to [14. Enrichment Choice]

---

## 14. Enrichment Choice (During Add)

### 14a. "Yes, Do Tell"

**Trigger**: User taps "Yes, Do Tell".

Sets enrichment flag and proceeds to submission. (Note: enrichment happens after wine is added — future improvement may enrich first.)

-> Go to [15. Submission]

---

### 14b. "No, Add Quickly"

**Trigger**: User taps "No, Add Quickly".

Skips enrichment, proceeds directly to submission.

-> Go to [15. Submission]

---

## 15. Submission & Completion

### 15a. New Wine — Success

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `adding_wine` | "Adding to your cellar..." | — |
| 2 | `complete` | "*Margaux* is now in your cellar. An excellent addition. Your future self will thank you." | [Identify Another] `start_over` |

**User taps "Identify Another"** -> Go to [16a. Start Over]

---

### 15b. Add Bottle to Existing Wine — Success

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `adding_wine` | "Adding bottle to your cellar..." | — |
| 2 | `complete` | "Added another bottle of *Margaux* to your cellar!" | [Identify Another] `start_over` |

---

### 15c. Submission Error

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | — | Error message (e.g., "I'm afraid something went awry. The cellar door seems stuck. Shall we try again?") | [Try Again] `retry_add` · [Start Over] `start_over` |

**User taps "Try Again"** -> Re-attempts submission with same payload
**User taps "Start Over"** -> Go to [16a. Start Over]

---

## 16. Navigation Commands

### 16a. Start Over

**Trigger**: User taps "Start Over" chip, types "start over"/"restart"/"new wine", or taps "Identify Another".

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | — | *(divider: ✦)* | — |
| 2 | `greeting` | Fresh time-based greeting *(1 of 5)* | — |
| 3 | `awaiting_input` | *(input placeholder active)* | — |

Clears: identification, enrichment, addWine stores, retry tracker.
Preserves: chat history (visible above divider).

---

### 16b. Go Back

**Trigger**: User types "back"/"undo"/"previous".

Behavior depends on current phase:

| From Phase | Goes To | Agent Says | Chips |
|-----------|---------|-----------|-------|
| `confirming` | `awaiting_input` | "Let me know what wine you'd like to identify." | [Take Photo] `take_photo` · [Choose Photo] `choose_photo` |
| `adding_wine` | `confirming` | "What would you like to do with this wine?" | [Add to Cellar] `add_to_cellar` · [Learn More] `enrich_now` · [Remember Later] `remember` |
| `enriching` | `confirming` | *(no message — returns silently)* | — |
| `error` | `awaiting_input` | *(no message — returns silently)* | — |
| Other | `awaiting_input` | *(no message — returns silently)* | — |

---

### 16c. Cancel

**Trigger**: User types "stop"/"cancel"/"never mind"/"quit".

Closes the agent panel immediately. No state reset.

---

### 16d. Cancel Request (WIN-187)

**Trigger**: User taps "cancel" link on typing/thinking indicator during API call.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | *(previous)* | *(typing indicator removed)* | — |
| 2 | `confirming` or `awaiting_input` | "No problem, I've stopped. What would you like to do?" | [Try Again] `try_again` · [Start Over] `start_over` |

Phase after cancel: `confirming` (if cancelled from enriching) or `awaiting_input` (if cancelled from identifying).

Sends server-side cancel token to abort LLM processing on backend.

---

### 16e. Retry / Try Again

**Trigger**: User taps "Try Again" chip or types "try again"/"retry".

Re-dispatches the last tracked action (stored by retry tracker, expires after 5 minutes).

If no action to retry:

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `awaiting_input` | "Nothing to retry. What would you like to identify?" | — |

---

## 17. Remember Flow

**Trigger**: User taps "Remember" chip.

| Step | Phase | Agent Says | Chips |
|------|-------|-----------|-------|
| 1 | `complete` | "Memories are a function coming later. You'll have to remember *Château Margaux* yourself!" | [Identify Another] `start_over` |

**Note**: This is a placeholder — the Remember feature is not yet implemented.

---

## 18. Error Recovery

### 18a. Identification Errors

**Trigger**: Identification API call fails.

| Error Type | Agent Says (Sommelier) | Retryable |
|-----------|----------------------|:---------:|
| Timeout | "I appear to be taking longer than is polite. Shall we try again? I'm usually more prompt." | Yes |
| Rate Limit | "It seems I need a moment to catch my breath. Even digital sommeliers have their limits. Please wait a moment." | Yes |
| Limit Exceeded | "We've reached our tasting limit for the day. Even I need to rest my palate. Let's continue tomorrow." | No |
| Generic | "A momentary lapse. Shall we try again? I'm usually more reliable than this." | Yes |
| Image Unclear | "My vision is quite good, but even I have limits. Could you try a clearer photo, perhaps with steadier light?" | No |
| Network | "It seems the connection has wandered off. Would you check the network? I'll wait." | Yes |

**Retryable**: **[Try Again]** `retry` · [Start Over] `start_over`
**Non-retryable**: [Start Over] `start_over`

---

### 18b. Enrichment Errors

Same error types as 18a, but different chip set:

**Retryable**: **[Tell Me More]** `learn` · [Add Without Details] `add_to_cellar` · [Start Over] `start_over`
**Non-retryable**: [Add Without Details] `add_to_cellar` · [Start Over] `start_over`

---

### 18c. Add Wine Errors

Error message from API + fallback:

**Retryable**: [Try Again] `retry_add` · [Start Over] `start_over`
**Non-retryable**: [Start Over] `start_over`

---

## 19. Chip Reference Table

All 36 chips with their sommelier labels, variants, and dispatched actions.

| Chip Key | Sommelier Label | Variant | Action Dispatched |
|----------|----------------|---------|-------------------|
| CORRECT | That's Right | primary | `correct` |
| NOT_CORRECT | Not Quite | — | `not_correct` |
| TRY_OPUS | Look Closer | primary | `try_opus` |
| REIDENTIFY | Try Again With This | primary | `reidentify` |
| CONTINUE_AS_IS | Continue As-Is | — | `continue_as_is` |
| PROVIDE_MORE | I Can Help | — | `provide_more` |
| ADD_MISSING_DETAILS | Add Details | — | `add_missing_details` |
| START_FRESH | Start Fresh | — | `start_fresh` |
| USE_PRODUCER_NAME | Use Producer Name | — | `use_producer_name` |
| USE_GRAPE_AS_NAME | Use the Grape Name | — | `use_grape_as_name` |
| NV_VINTAGE | Non-Vintage | — | `nv_vintage` |
| SPECIFY_VINTAGE | Specify Vintage | — | `add_missing_details` |
| SPECIFY_PRODUCER | Add Details | — | `add_missing_details` |
| CONFIRM_BRIEF_SEARCH | Search Anyway | primary | `confirm_brief_search` |
| ADD_MORE_DETAIL | I'll Add More | — | `add_more_detail` |
| CONFIRM_NEW_SEARCH | Search New | primary | `confirm_new_search` |
| CONTINUE_CURRENT | Keep Current | — | `continue_current` |
| ADD_TO_CELLAR | Add to Cellar | primary | `add_to_cellar` |
| LEARN_MORE | Tell Me More | — | `learn` |
| REMEMBER | Remember | — | `remember` |
| ENRICH_NOW | Yes, Do Tell | primary | `enrich_now` |
| ADD_QUICKLY | No, Add Quickly | — | `add_quickly` |
| CONFIRM_CACHE_MATCH | Use What You Have | primary | `confirm_cache_match` |
| FORCE_REFRESH | Search Afresh | — | `force_refresh` |
| ADD_BOTTLE_EXISTING | Add Another Bottle | primary | `add_bottle_existing` |
| CREATE_NEW_WINE | Create New Wine | — | `create_new_wine` |
| RETRY_ADD | Try Again | — | `retry_add` |
| START_OVER | Start Over | — | `start_over` |
| RETRY | Try Again | primary | `retry` |
| TAKE_PHOTO | Take Photo | — | `take_photo` |
| CHOOSE_PHOTO | Choose Photo | — | `choose_photo` |
| IDENTIFY_ANOTHER | Identify Another | — | `start_over` |
| ADD_WITHOUT_DETAILS | Add Without Details | — | `add_to_cellar` |
| SEARCH_AGAIN | Search Again | — | `provide_more` |
| USE_THIS_RESULT | Use This | — | `continue_as_is` |
| CORRECT_FIELD | *(dynamic: "Producer: X")* | — / `primary` (locked) | `correct_field` |
| CONFIRM_CORRECTIONS | Looks Good | `primary` | `confirm_corrections` |

---

## 20. Consistency Checklist

### Cross-Flow Patterns to Verify

#### Error Recovery Chips
| Flow | Retryable Chips | Non-Retryable Chips |
|------|----------------|-------------------|
| Identification | **[Try Again]** `retry` + [Start Over] | [Start Over] |
| Enrichment | **[Tell Me More]** `learn` + [Add Without Details] + [Start Over] | [Add Without Details] + [Start Over] |
| Add Wine | [Try Again] `retry_add` + [Start Over] | [Start Over] |

**Observation**: Identification and Add Wine use the same pattern (retry + start over), but Enrichment adds an "Add Without Details" escape hatch. This is intentional — enrichment is optional, so users can skip it on failure.

**Observation**: Add Wine's "Try Again" chip uses `retry_add` action (not `retry`), and has no primary variant. Identification's "Try Again" uses `retry` with primary variant. Consider making Add Wine's retry also primary for consistency.

#### Confirmation Chip Labels

| Context | Positive Chip | Negative Chip |
|---------|--------------|--------------|
| Initial identification | **[That's Right]** | [Not Quite] |
| Low confidence reidentify | **[Try to Match]** | [Add Manually] |
| Cache confirmation | **[Use What You Have]** | [Search Afresh] |
| Brief input | **[Search Anyway]** | [I'll Add More] |
| New search | **[Search New]** | [Keep Current] |
| Duplicate wine | **[Add Another Bottle]** | [Create New Wine] |
| Enrichment choice | **[Yes, Do Tell]** | [No, Add Quickly] |

All positive/affirmative actions are consistently **primary** variant.

#### "Not Correct" Flow Chips
The "Not Quite" flow now uses `generateNotCorrectChips()` which dynamically generates field correction chips from the identification result data. Each populated scalar field (producer, wineName, vintage, region, country, type) gets a chip with the field's current value. Locked fields show a lock indicator and use `primary` variant.

**Visual grouping**: Field chips and action chips render in separate bordered containers (`groupLabel` on `ChipsMessageData`) with "FIELDS" and "ACTIONS" headers. Field chip labels render with a bold field name and normal-weight value via `field-name`/`field-value` spans in `ChipsMessage.svelte` (triggered by `action === 'correct_field'`).

**Post-correction flow**: After correcting a field, an updated wine card is shown with `generateCorrectionConfirmationChips()` — "Looks Good" / "Look Closer" / "Not Quite". This gives users the option to accept, escalate with corrections, or correct more fields. "Not Quite" returns to the same field correction flow (consistent — one flow, not two).

**Note**: Field correction chips are unique in the system — they have dynamic labels generated from result data, not static registry entries. The action chips (Add Details, Look Closer, Start Over) alongside them do use the chip registry.

#### "Nothing Found" Flow Chips
The "not found" flow chips are also hardcoded:
```
[Try Again] `provide_more` + [Start Over] `start_over`
```
These use hardcoded labels rather than the chip registry. Should use `getChip(ChipKey.SEARCH_AGAIN)` and `getChip(ChipKey.START_OVER)` for personality-aware labels.

#### "Go Back" from `adding_wine` Chips
The "go back" handler hardcodes: `[Add to Cellar]` + `[Learn More]` + `[Remember Later]`
with action `enrich_now` for "Learn More" — but the standard action chip uses `learn`. This is a **potential inconsistency** (different action for the same concept in different contexts).

#### "Continue As-Is" / "Add Manually" Phase
`handleContinueAsIs()` sets phase to `adding_wine` but shows the same CONFIRM_CORRECT message + action chips that `handleCorrect()` shows in `confirming` phase. The phase difference means validator middleware may behave differently. Consider whether this should be `confirming` for consistency.

#### Cancel Request Message
"No problem, I've stopped. What would you like to do?" — this message is hardcoded, not using the personality system. It works for sommelier tone but wouldn't adapt to other personalities.

#### New Search Confirmation Chips
When typing during `confirming` phase, the chips are hardcoded:
```
[Search New] `confirm_new_search` + [Keep Current] `continue_current`
```
These use hardcoded labels rather than the `generateNewSearchConfirmationChips()` function, which does exist and uses the registry. The handler should call the generator function instead.

---

### Summary of Consistency Issues Found

| Issue | Location | Severity |
|-------|----------|----------|
| ~~`handleNotCorrect()` uses hardcoded chip labels~~ — resolved by `generateNotCorrectChips()` | identification.ts | Resolved |
| "Nothing Found" chips hardcoded instead of using registry | identification.ts:166-169 | Low |
| `handleGoBack()` uses `enrich_now` instead of `learn` for enrichment action | conversation.ts:98 | Medium |
| `handleContinueAsIs()` sets phase `adding_wine` but shows same chips as `confirming` flow | identification.ts:976 | Medium |
| Cancel request message not using personality system | conversation.ts:164 | Low |
| New search confirmation chips hardcoded instead of using `generateNewSearchConfirmationChips()` | identification.ts:573-577 | Low |
| Brief input confirmation chips hardcoded instead of using `generateBriefSearchChips()` | identification.ts:595-598 | Low |
| Add Wine retry chip not primary variant (identification retry is primary) | chipRegistry.ts:262-265 | Low |

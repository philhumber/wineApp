# Wine Agent Flow Documentation

This document provides comprehensive flow diagrams and reference tables for the Wine Agent's multi-path conversation logic.

**Key Files:**
- Store: [`stores/agent.ts`](../src/lib/stores/agent.ts)
- Panel: [`components/agent/AgentPanel.svelte`](../src/lib/components/agent/AgentPanel.svelte)
- Messages: [`components/agent/ChatMessage.svelte`](../src/lib/components/agent/ChatMessage.svelte)
- Commands: [`utils/commandDetector.ts`](../src/lib/utils/commandDetector.ts)

---

## Table of Contents

1. [Phase State Machine](#1-phase-state-machine)
2. [Text Input Decision Tree](#2-text-input-decision-tree)
3. [Identification Result Routing](#3-identification-result-routing)
4. [Add Wine Pipeline](#4-add-wine-pipeline)
5. [Error Handling](#5-error-handling)
6. [Session Persistence](#6-session-persistence)
7. [Agent Phrases by Phase](#7-agent-phrases-by-phase)
8. [LLM Prompt Templates](#8-llm-prompt-templates)

---

## 1. Phase State Machine

The agent operates through distinct phases. This diagram shows all valid transitions.

```mermaid
stateDiagram-v2
    [*] --> greeting: Panel opens

    %% Initial flow
    greeting --> path_selection: User sees greeting
    path_selection --> await_input: "Identify" chip
    path_selection --> coming_soon: "Recommend" chip

    %% Identification flow
    await_input --> identifying: Text/Image submitted
    identifying --> result_confirm: High confidence (≥85%)
    identifying --> partial_match: Medium confidence
    identifying --> low_confidence: Low confidence
    identifying --> error: API error

    %% Result confirmation
    result_confirm --> action_select: "Correct" chip
    result_confirm --> handle_incorrect: "Not Correct" chip
    result_confirm --> confirm_new_search: User types new query

    %% Partial/Low confidence handling
    partial_match --> augment_input: "Tell Me More"
    partial_match --> await_input: "Wrong Direction"
    partial_match --> identifying: "Try Opus" escalation
    low_confidence --> augment_input: User provides details

    %% Augmentation loop
    augment_input --> identifying: User submits more info
    handle_incorrect --> augment_input: User describes issue
    handle_incorrect --> await_input: "Start Fresh"

    %% New search confirmation
    confirm_new_search --> identifying: "Search New"
    confirm_new_search --> result_confirm: "Keep Current"
    confirm_new_search --> action_select: "Keep Current"

    %% Action selection
    action_select --> add_region: "Add to Cellar"
    action_select --> wine_enrichment: "Learn More"
    action_select --> coming_soon: "Remember"
    action_select --> confirm_new_search: User types new query

    %% Enrichment flow
    wine_enrichment --> add_region: "Add to Cellar"
    wine_enrichment --> coming_soon: "Remember Wine"

    %% Add Wine flow (WIN-145 early check)
    action_select --> existing_wine_choice: Duplicate detected
    existing_wine_choice --> add_bottle_part1: "Add Another Bottle"
    existing_wine_choice --> add_region: "Create New Wine"

    %% Entity matching stages
    add_region --> add_producer: Region selected/created
    add_producer --> add_wine: Producer selected/created
    add_wine --> add_bottle_part1: Wine selected/created
    add_wine --> existing_wine_choice: Existing wine found

    %% Clarification within entity matching (Help Me Decide)
    add_region --> add_region: Help Me Decide (clarify)
    add_producer --> add_producer: Help Me Decide (clarify)
    add_wine --> add_wine: Help Me Decide (clarify)

    %% Bottle and completion
    add_bottle_part1 --> add_bottle_part2: "Next"
    add_bottle_part2 --> add_enrichment: "Submit"
    add_enrichment --> add_complete: "Enrich Now" or "Add Quickly"
    add_complete --> [*]: Navigate to cellar

    %% Manual entry (missing fields - can occur at any entity stage)
    add_region --> add_manual_entry: Missing required fields
    add_producer --> add_manual_entry: Missing required fields
    add_wine --> add_manual_entry: Missing required fields
    add_manual_entry --> add_region: Fields completed (restart matching)

    %% Error recovery
    error --> await_input: "Start Over"
    error --> identifying: "Try Again" (if retryable)
```

### Phase Definitions

| Phase | Description | User Input |
|-------|-------------|------------|
| `greeting` | Time-aware sommelier greeting | None (auto) |
| `path_selection` | Choose Identify or Recommend | Chip tap |
| `await_input` | Ready for text or image | Text/Image/Chip |
| `identifying` | Processing identification | Disabled |
| `result_confirm` | Show result, await confirmation | "Correct"/"Not Correct" |
| `partial_match` | Medium confidence, needs clarification | Chips or text |
| `low_confidence` | Low confidence, needs more info | Text |
| `handle_incorrect` | User said result was wrong | Text describing issue |
| `augment_input` | Collecting additional details | Text or image |
| `action_select` | Wine confirmed, choose action | Action chips |
| `confirm_new_search` | User typed during active result | "Search New"/"Keep Current" |
| `existing_wine_choice` | Duplicate wine found (WIN-145) | "Add Bottle"/"Create New" |
| `add_region` | Matching/creating region | Selection, "Add New", or "Help Me Decide" |
| `add_producer` | Matching/creating producer | Selection, "Add New", or "Help Me Decide" |
| `add_wine` | Matching/creating wine | Selection, "Add New", or "Help Me Decide" |
| `add_bottle_part1` | Bottle size, location, source | Form input |
| `add_bottle_part2` | Price, currency, date | Form input |
| `add_enrichment` | Choose enrichment timing | "Enrich Now"/"Add Quickly" |
| `add_manual_entry` | Fill missing required fields (from any entity stage) | Form input |
| `add_complete` | Success message | None (auto-navigate) |
| `wine_enrichment` | Displaying enrichment data | Action chips |
| `coming_soon` | Placeholder for future features | None |
| `error` | Error with retry options | "Try Again"/"Start Over" |

---

## 2. Text Input Decision Tree

This diagram shows all decision points when user submits text via `handleTextSubmit()`.

```mermaid
flowchart TD
    A[User submits text] --> B{detectCommand?}

    B -->|start_over| C1["Reset conversation, show new greeting"]
    B -->|cancel| C2["Show farewell, close panel"]
    B -->|go_back| C3[Return to previous phase]
    B -->|try_again| C4[Re-execute last action]

    B -->|No command| D{In result_confirm phase?}

    D -->|Yes| E{detectChipResponse?}
    E -->|Positive| F1["Trigger Correct chip"]
    E -->|Negative| F2["Trigger Not Correct chip"]
    E -->|No match, short| F3["Show fallback message"]
    E -->|No match, long| G

    D -->|No| G{hasActiveIdentification?}

    G -->|Yes| H["Store pendingNewSearch, show chips"]
    H --> H1{User choice}
    H1 -->|Search New| I["Clear context, start fresh"]
    H1 -->|Keep Current| J[Restore previous phase]

    G -->|No| K{isBriefInput? Single word}

    K -->|Yes| L["Show: Add more detail?"]
    L --> L1{User choice}
    L1 -->|Search Anyway| M
    L1 -->|Add More| A

    K -->|No| M{In augment_input phase?}

    M -->|Yes| N["Combine with existing context"]
    N --> O

    M -->|No| O["Clear context, set lastInputType"]

    O --> P["API: identify text"]
    P --> Q[handleIdentificationResult]
```

### Command Detection Priority

Commands are detected in this order (first match wins):

1. **Wine indicators** checked first - prevents "Château Cancel" from triggering cancel
2. **Long text** (>6 words) - assumed to be wine query
3. **Pattern matching** - exact, substring, spaceless variations
4. **Fallback** - treat as wine query

| Command | Triggers |
|---------|----------|
| `start_over` | "start", "start over", "restart", "reset", "new wine" |
| `cancel` | "stop", "cancel", "never mind", "quit", "exit" |
| `go_back` | "back", "go back", "undo", "previous" |
| `try_again` | "try again", "retry", "one more time" |

### Chip Response Detection

Only active in `result_confirm` phase:

| Response Type | Triggers | Action |
|---------------|----------|--------|
| Positive | "yes", "yep", "ok", "correct", "that's right" | Trigger Correct chip |
| Negative | "no", "wrong", "not right", "incorrect" | Trigger Not Correct chip |

Includes typo tolerance: "yse", "corectt", "worng"

---

## 3. Identification Result Routing

How `handleIdentificationResult()` processes API responses.

```mermaid
flowchart TD
    A[API Response] --> B{Has candidates?}

    B -->|Yes| C["Show disambiguation list"]
    C --> C1[User selects candidate]
    C1 --> D

    B -->|No| D{Augmentation retry?}

    D -->|Yes| E["Merge results: new takes precedence"]
    E --> F

    D -->|No| F{"Confidence ≥ 85?"}

    F -->|No| G[Show partial_match message]
    G --> G1["Chips: Confirm / Wrong / Try Opus"]

    F -->|Yes| H{"Has min fields?"}

    H -->|No| I{Has alternatives?}
    I -->|Has producer, no wine| J1["Chip: Use Producer as Name"]
    I -->|Has grapes, no wine| J2["Chip: Use Grape as Name"]
    I -->|No vintage| J3["Chip: NV Non-Vintage"]
    I -->|None| J4[Show partial_match with prompts]

    H -->|Yes| K[Show wine_result card]
    K --> L["Chips: Correct / Not Correct"]
    L --> M{User response}

    M -->|Correct| N["Phase: action_select"]
    M -->|Not Correct| O["Phase: handle_incorrect"]
```

### Minimum Required Fields

A wine is considered "complete" when it has:
- `producer` (non-null, non-placeholder)
- `wineName` (non-null, non-placeholder)
- `region` (non-null)
- `wineType` (non-null)

### Quick-Fill Chips

When fields are missing but alternatives exist:

| Condition | Chip Offered |
|-----------|--------------|
| Has producer, no wineName | "Use [Producer] as Name" |
| Has primary grape, no wineName | "Use [Grape] as Name" |
| No vintage | "NV (Non-Vintage)" |

---

## 4. Add Wine Pipeline

The 4-stage entity matching flow when user taps "Add to Cellar".

```mermaid
flowchart TD
    A["Add to Cellar tapped"] --> B{"Early wine check WIN-145"}

    B -->|Wine exists| C[Show existing_wine_choice]
    C --> C1{User choice}
    C1 -->|Add Another Bottle| D1["Skip to bottle form"]
    C1 -->|Create New Wine| E

    B -->|No match| E[Initialize AddState]

    E --> F[STAGE 1: Region]
    F --> F1["API: checkDuplicate region"]
    F1 --> F2{Match result}
    F2 -->|Exact match| F3["Auto-select, confirm"]
    F2 -->|Similar matches| F4["Show match list + chips"]
    F2 -->|No matches| F5["Create new, auto-advance"]
    F3 --> G
    F4 --> F6{User selection}
    F6 -->|Select existing| G
    F6 -->|Add as New| G
    F6 -->|Help Me Decide| F7["API: clarifyMatch"]
    F7 --> F4
    F5 --> G

    G[STAGE 2: Producer] --> G1["API: checkDuplicate producer"]
    G1 --> G2{Same pattern as Region}
    G2 --> H

    H[STAGE 3: Wine] --> H1["API: checkDuplicate wine"]
    H1 --> H2{Match result}
    H2 -->|Existing wine with bottles| C
    H2 -->|Other| H3{Same pattern}
    H3 --> I

    I[STAGE 4: Bottle Form]
    I --> I1[Part 1: Size, Location, Source]
    I1 -->|Next| I2[Part 2: Price, Currency, Date]
    I2 -->|Submit| J

    D1 --> I

    J[Enrichment Choice] --> J1{User choice}
    J1 -->|Enrich Now| K1[Submit with enrichment flag]
    J1 -->|Add Quickly| K2[Submit without enrichment]

    K1 --> L
    K2 --> L

    L{existingWineId set?}
    L -->|Yes| M1["API: addBottle"]
    L -->|No| M2["API: addWine 4-table transaction"]

    M1 --> N
    M2 --> N

    N[Success!] --> O["Close panel, navigate, highlight"]
```

### Entity Matching Chips

| Chip | Action |
|------|--------|
| `select_match:{type}:{id}` | Select existing entity |
| `add_new:{type}` | Create new entity |
| `clarify:{type}` | Call LLM for explanation |

### Bottle Form Fields

| Part 1 (Required) | Part 2 (Optional) |
|-------------------|-------------------|
| Bottle size | Price |
| Storage location | Currency |
| Source (purchased/gift/etc) | Purchase date |

---

## 5. Error Handling

Error classification and retry flow.

```mermaid
flowchart TD
    A[API Call] --> B{Success?}

    B -->|Yes| C[Normal flow]

    B -->|No| D{Error type}

    D --> E1[timeout - 408]
    D --> E2[rate_limit - 429]
    D --> E3[overloaded - 503]
    D --> E4[server_error - 500]
    D --> E5[database_error - 500]
    D --> E6[limit_exceeded - 429]
    D --> E7[quality_check_failed - 422]
    D --> E8[identification_error - 400]
    D --> E9[enrichment_error - 400]

    E1 --> F[Retryable]
    E2 --> F
    E3 --> F
    E4 --> F
    E5 --> F

    E6 --> G[NOT Retryable]
    E7 --> G
    E8 --> G
    E9 --> G

    F --> H["Show error message + support ref"]
    G --> H

    H --> I{Retryable?}

    I -->|Yes| J["Chips: Try Again, Start Over"]
    J --> J1{User choice}
    J1 -->|Try Again| K["handleRetry: re-execute lastAction"]
    J1 -->|Start Over| L["handleStartOver: reset conversation"]

    I -->|No| M["Chip: Start Over only"]
    M --> L
```

### Error Types Reference

| Type | HTTP | Retryable | Sommelier Message |
|------|------|-----------|-------------------|
| `timeout` | 408 | Yes | "Our sommelier is taking longer than expected..." |
| `rate_limit` | 429 | Yes | "Our sommelier is quite busy at the moment..." |
| `overloaded` | 503 | Yes | "Our sommelier is quite busy at the moment..." |
| `server_error` | 500 | Yes | "Something unexpected happened..." |
| `database_error` | 500 | Yes | "Something went wrong..." |
| `limit_exceeded` | 429 | No | "We've reached our tasting limit for today..." |
| `quality_check_failed` | 422 | No | "That image is a bit unclear..." |
| `identification_error` | 400 | No | "I couldn't identify this wine..." |
| `enrichment_error` | 400 | No | "I couldn't find additional information..." |

### Support Reference

Exception errors include a support reference: `ERR-XXXXXXXX`

- Generated from: `MD5(timestamp + errorType + endpoint)`
- Logged server-side with full stack trace
- Displayed to user for support tickets

---

## 6. Session Persistence

What data persists where and survives what events.

```mermaid
flowchart LR
    subgraph sessionStorage["sessionStorage (tab-scoped)"]
        direction TB
        S1[messages - max 30]
        S2[lastResult]
        S3[augmentationContext]
        S4[pendingNewSearch]
        S5[phase]
        S6[lastImageData - base64]
        S7[lastImageMimeType]
        S8[lastInputType]
        S9[addState]
        S10[enrichmentData]
    end

    subgraph localStorage["localStorage (permanent)"]
        direction TB
        L1[panelOpen - boolean]
    end

    subgraph Survives["Survives..."]
        direction TB
        V1[Page refresh]
        V2[Mobile tab switch]
        V3[Camera app detour]
    end

    subgraph Cleared["Cleared by..."]
        direction TB
        C1[Tab close]
        C2[startSession when no messages]
        C3[fullReset]
    end

    sessionStorage --> Survives
    sessionStorage --> Cleared
    localStorage --> V1
    localStorage --> V2
    localStorage --> V3
```

### Persistence Timing

| Data | Timing | Rationale |
|------|--------|-----------|
| Messages, phase, form data | Debounced (500ms) | Reduce writes |
| augmentationContext | Immediate | Critical for retry |
| pendingNewSearch | Immediate | Critical for mobile |
| lastResult | Immediate | Critical for flow |
| lastImageData | Immediate | Critical for retry |

### Quota Handling

When sessionStorage quota exceeded:

1. First: Drop `lastImageData` (largest item)
2. Still exceeded: Keep only last 10 messages
3. Always preserve: `augmentationContext`, `pendingNewSearch`

### Mobile Tab Switch Resilience

- Images stored as base64 data URLs (not ObjectURLs)
- `pendingNewSearch` survives camera app detour
- Augmentation context preserved for retry after interruption

---

## 7. Agent Phrases by Phase

All sommelier-style messages organized by context.

### Greetings (Time-Aware)

| Time Range | Messages |
|------------|----------|
| Morning (6 AM - 12 PM) | "Good morning. What shall we uncork today?"<br/>"A fresh day for discoveries. What are you considering?"<br/>"Morning light reveals the finest vintages. What catches your eye?" |
| Afternoon (12 PM - 5 PM) | "Good afternoon. Shall we explore your cellar?"<br/>"The light is perfect. What vintage intrigues you?"<br/>"A fine hour for contemplation. What wine has your attention?" |
| Evening (5 PM - 6 AM) | "Good evening. The cellar awaits your curiosity."<br/>"A fine hour for wine. What catches your eye?"<br/>"Evening sips begin with discovery. What shall we find?" |

### Identification Flow

| Scenario | Message |
|----------|---------|
| High confidence result | "Is this the wine you're seeking?" |
| Disambiguation (multiple) | "I found a few possibilities. Does one of these look right?" |
| Partial match | Context-aware: "I found something but I'm not certain..." |
| Request more info | "Tell me more — the producer name, vintage, region, or grape variety would help." |
| Request more info (image) | "Share an image, or type what you know." |

### Confirmation Responses

| User Action | Agent Response |
|-------------|----------------|
| "Correct" chip | "Excellent. What would you like to do?" |
| "Not Correct" chip | "I apologize for the confusion. Let's try a different approach." |
| Cancel command | "No problem. I'll be here when you need me." |
| Go back command | "Of course. Let's revisit that." |
| Try again command | "Let's try a different approach." |

### Add Wine Flow

| Phase | Message |
|-------|---------|
| Duplicate found (WIN-145) | "I found \"[wine]\" by [producer] already in your cellar with X bottle(s)." |
| Region matching | "I found some regions that might match \"[region]\"." |
| No matches | "I'll create a new [type] entry." |
| Match confirmed | "Got it - using \"[entity]\"." |
| Bottle form | "Now let's record the bottle details." |
| Bottle form part 2 | "And the purchase details?" |
| Enrichment choice | "Would you like me to research this wine now, or add it quickly and enrich later?" |
| Success | "Perfect! I've added \"[wine]\" to your cellar." |

### Brief Input Confirmation

| Scenario | Message |
|----------|---------|
| Single word input | "Just \"[input]\"? Adding more detail like the producer, vintage, or region will improve the match." |

### New Search Confirmation

| Scenario | Message |
|----------|---------|
| User types during active result | "I have a wine ready. Did you want to search for something new instead?" |

### Error Messages

| Error Type | Message |
|------------|---------|
| Timeout | "Our sommelier is taking longer than expected. Please try again or start over." |
| Rate limit | "Our sommelier is quite busy at the moment. Please try again in a moment." |
| Quota exceeded | "We've reached our tasting limit for today. Please try again tomorrow." |
| Poor image | "That image is a bit unclear. Could you try a clearer photo?" |
| Identification failed | "I couldn't identify this wine. Please try again with a clearer image or more details." |
| Add wine failed | "Something went wrong adding the wine." |
| Generic | "[Error message]\n\nReference: [ERR-XXXXXXXX]" |

### Coming Soon Placeholder

| Feature | Message |
|---------|---------|
| Recommendations | "Recommendations are being prepared for a future vintage." |
| Remember/Wishlist | "The wishlist feature is coming soon! For now, you can add this wine to your cellar." |

---

## 8. LLM Prompt Templates

Documentation of prompts sent to the AI backend.

### Text Identification Prompt

**File:** `resources/php/agent/prompts/text_identify.txt`

**Role:** "wine identification expert"

**Key Instructions:**
- Extract: producer, wineName, vintage, region, country, wineType, grapes
- For Bordeaux: producer IS usually the wine name (e.g., "Château Margaux")
- Recognize appellation hints (e.g., "Margaux" implies Bordeaux, France)
- Infer grape varieties from region knowledge

**Confidence Scoring (Critical):**

| Score | Definition |
|-------|------------|
| 80-100 (HIGH) | Wine RECOGNIZED as real, existing wine |
| 50-79 (MEDIUM) | Producer recognized but wine uncertain, or input ambiguous |
| 0-49 (LOW) | Producer/wine NOT recognized as real |

**Critical Rule:** "Do NOT give high confidence just because you can fill in fields with plausible regional data."

**Output Format:**
```json
{
  "producer": "string or null",
  "wineName": "string or null",
  "vintage": "string or null",
  "region": "string or null",
  "country": "string or null",
  "wineType": "string or null",
  "grapes": ["array"] or null,
  "confidence": number
}
```

### Vision/Image Identification Prompt

**File:** `resources/php/agent/prompts/vision_identify.txt`

**Role:** "wine label identification expert"

**Key Instructions:**
- Read all text visible on the wine label
- Identify producer (usually most prominent text)
- Find vintage year (front or neck label)
- Determine region/appellation from label text
- Use visual cues: label design style, bottle shape, medallions

**Quality-Based Confidence:**
- Clear Bordeaux label → 85-95
- Blurry but readable → 50-70
- Distance photo → 40-60
- Not a wine label → 0

### Escalation Prompt (Tier 1.5+)

**Role:** "master sommelier with expertise"

**Additional Context Prepended:**
```
Previous attempt found: Producer={producer}, Wine={wineName},
Region={region} (confidence: {confidence}%).
Please analyze more carefully and look for details that might have been missed.
```

**Enhanced Instructions:**
- Expand abbreviations: "Chx" = Château, "Dom" = Domaine
- Recognize First Growth Bordeaux by name alone
- Consider appellation rules to deduce grape varieties

### Enrichment Prompt

**File:** `resources/php/agent/prompts/enrichment_search.txt`

**Web Search Enabled:** Yes (Google Search grounding)

**Data to Extract:**
1. Grape varieties with percentages
2. Official appellation/AVA
3. Alcohol content (ABV%)
4. Drink window (start/end years, maturity)
5. Critic scores: WS, RP, Decanter, JS (100-point scale only)
6. Production method notes
7. Style profile: body, tannin, acidity, sweetness
8. Overview (3-4 sentences, 60-120 words)
9. Tasting notes (3-4 sentences, 60-120 words)
10. Food pairings (3-4 sentences, 60-100 words)

**Output Format:**
```json
{
  "grapeVarieties": [{"grape": "string", "percentage": number}],
  "appellation": "string",
  "alcoholContent": number,
  "drinkWindow": {"start": year, "end": year, "maturity": "young|ready|peak|declining"},
  "criticScores": [{"critic": "WS|RP|Decanter|JS", "score": number, "year": number}],
  "productionMethod": "string",
  "body": "string",
  "tannin": "string",
  "acidity": "string",
  "sweetness": "string",
  "overview": "string",
  "tastingNotes": "string",
  "pairingNotes": "string"
}
```

### Clarification Prompt ("Help Me Decide")

**File:** `resources/php/agent/clarifyMatch.php`

**Dynamic Prompt:**
```
You are an expert sommelier helping a wine collector.

The user is trying to add: {producer} - {wineName} ({vintage})
Region: {region}

I found these existing {type} entries in their collection:
{optionsList}

Task: In 1-2 sentences, explain which option best matches what they're
adding, or if they should create a new entry. Be concise and complete
your thought.
```

### LLM Configuration by Task

| Task | Model | Temperature | Max Tokens | Timeout | Notes |
|------|-------|-------------|------------|---------|-------|
| Text identification | Gemini | 0.3 | 1,000 | 30s | Low variance |
| Image identification | Gemini Vision | 0.3 | 4,000 | 45s | Vision model |
| Opus escalation | Claude Opus | 0.3 | 4,000 | 60s | Premium tier |
| Enrichment | Gemini | 1.0 | 10,000 | 90s | Web search requires temp=1.0 |
| Clarification | Gemini | default | 500 | 30s | Short response |

---

## Quick Reference: Chip Actions

| Chip ID | Phase | Action |
|---------|-------|--------|
| `identify` | greeting, path_selection | Show input options |
| `recommend` | greeting, path_selection | Show "Coming soon" |
| `correct` | result_confirm | Proceed to action_select |
| `not_correct` | result_confirm | Handle incorrect flow |
| `try_opus` | partial_match | Escalate to Opus model |
| `confirm_direction` | partial_match | Request more details |
| `wrong_direction` | partial_match | Clear result, keep input |
| `add` | action_select | Start add wine flow |
| `learn` | action_select | Trigger enrichment |
| `remember` | action_select | Show "Coming soon" |
| `add_bottle_existing` | existing_wine_choice | Add bottle to existing wine |
| `create_new_wine` | existing_wine_choice | Create new wine entry |
| `select_match:{type}:{id}` | match_selection | Select existing entity |
| `add_new:{type}` | match_selection | Create new entity |
| `clarify:{type}` | match_selection | Get LLM explanation |
| `bottle_next` | add_bottle_part1 | Advance to part 2 |
| `bottle_submit` | add_bottle_part2 | Show enrichment choice |
| `enrich_now` | add_enrichment | Submit with enrichment |
| `add_quickly` | add_enrichment | Submit without enrichment |
| `retry` | error | Re-execute last action |
| `start_over` | various | Reset conversation |
| `confirm_new_search` | confirm_new_search | Start new identification |
| `continue_current` | confirm_new_search | Return to previous phase |
| `confirm_brief_search` | brief_input | Proceed with single word |
| `add_more_detail` | brief_input | Prompt for more input |

---

*Last updated: 2026-02-01*

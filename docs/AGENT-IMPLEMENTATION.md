# AI Wine Agent - Implementation Guide

**Last Updated**: 2026-01-27
**Status**: Phase 2 Complete (Identification + UI)
**Branch**: `AIAgent/Phase1`

---

## Overview

The AI Wine Agent is a conversational assistant that helps users identify wines from text or images, with plans to expand into enrichment and pairing advice.

### Completed Phases
- **Phase 1**: Text-based identification with confidence scoring
- **Phase 2**: Image identification, UI components, model escalation

### Remaining Phases
- **Phase 2.5**: Enrichment Backend (grape varieties, drink windows, critic scores)
- **Phase 2.6**: Enrichment Frontend (display enriched data in UI)
- **Phase 2.7**: Basic Advice Mode (food pairing suggestions)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Svelte)                        │
├─────────────────────────────────────────────────────────────────┤
│  +layout.svelte                                                 │
│    └── AgentBubble (floating button)                           │
│    └── AgentPanel (slide-out container)                        │
│          ├── AgentLoadingState (animated loader)               │
│          ├── WineIdentificationCard (result display)           │
│          ├── DisambiguationList (multiple candidates)          │
│          └── CommandInput (text + camera input)                │
├─────────────────────────────────────────────────────────────────┤
│  Stores: agent.ts (state), addWine.ts (wizard integration)     │
│  API: client.ts (identifyText, identifyImage, compressImage)   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (PHP)                              │
├─────────────────────────────────────────────────────────────────┤
│  Endpoints:                                                     │
│    POST /agent/identifyText.php  → text identification         │
│    POST /agent/identifyImage.php → image identification        │
├─────────────────────────────────────────────────────────────────┤
│  Services (Identification/):                                    │
│    IdentificationService  → orchestrates the flow              │
│    InputClassifier        → detects input type                 │
│    IntentDetector         → determines user intent             │
│    TextProcessor          → extracts wine data from text       │
│    VisionProcessor        → extracts wine data from images     │
│    ConfidenceScorer       → calculates confidence score        │
│    DisambiguationHandler  → generates candidates               │
│    ImageQualityAssessor   → validates image quality            │
├─────────────────────────────────────────────────────────────────┤
│  LLM Layer (LLM/):                                              │
│    LLMClient              → provider abstraction               │
│    GeminiAdapter          → Gemini API integration             │
│    CostTracker            → usage logging to database          │
│    CircuitBreaker         → failure protection                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE (MySQL)                           │
├─────────────────────────────────────────────────────────────────┤
│  agentUsers        → user tracking                              │
│  agentUsageLog     → per-request token/cost logging            │
│  agentUsageDaily   → daily aggregates                          │
│  (Future: cacheWineEnrichment, refGrapeCharacteristics, etc.)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flow: Text Identification

```
1. User types "2019 Chateau Margaux" in CommandInput
2. CommandInput dispatches 'submit' event
3. AgentPanel calls agent.identify(text)
4. agent.ts store sets isLoading=true, calls api.identifyText()
5. POST to /agent/identifyText.php with {"text": "..."}
6. IdentificationService.identify() orchestrates:
   a. InputClassifier detects type='text'
   b. IntentDetector determines intent='add' (vs 'query', 'pair')
   c. TextProcessor calls Gemini to extract structured data
   d. ConfidenceScorer calculates score based on field completeness
   e. If score < 70%, escalation triggers with detailed prompt
   f. DisambiguationHandler generates candidates if needed
7. Response returned with parsed wine, confidence, action
8. AgentPanel displays WineIdentificationCard
9. User clicks "Add to Cellar" → populateFromAgent() → navigate to /add
```

---

## Flow: Image Identification

```
1. User clicks camera icon in CommandInput
2. File picker opens, user selects wine label photo
3. CommandInput calls api.compressImageForIdentification(file)
   - Resizes to max 1024px
   - Converts to JPEG at 80% quality
   - Returns base64 + mimeType
4. CommandInput dispatches 'image' event with compressed data
5. AgentPanel calls agent.identifyImage(file)
6. POST to /agent/identifyImage.php with {"image": base64, "mimeType": "..."}
7. IdentificationService.identifyFromImage() orchestrates:
   a. ImageQualityAssessor checks blur, size, lighting
   b. VisionProcessor calls Gemini Vision to extract label text
   c. Same scoring/escalation flow as text
8. Response includes quality assessment + parsed wine
```

---

## Model Escalation

When confidence is below threshold (default 70%), the system automatically retries with a more detailed prompt.

**Configuration** (`agent.config.php`):
```php
'model_tiers' => [
    'fast' => [
        'model' => 'gemini-2.0-flash',
        'description' => 'Quick identification',
    ],
    'detailed' => [
        'model' => 'gemini-2.0-flash',  // Same model, different prompt
        'temperature' => 0.4,
        'max_tokens' => 800,
    ],
],
'confidence' => [
    'escalation_threshold' => 70,
],
```

**Frontend UX**: `AgentLoadingState` switches to "deep search" mode after 2.5 seconds, showing more intense animations and messages like "Consulting sommelier..." to indicate harder work is being done.

**Response includes escalation metadata**:
```json
{
  "escalation": {
    "attempted": true,
    "improved": true,
    "originalConfidence": 45
  }
}
```

---

## Key Files Reference

### Frontend

| File | Purpose |
|------|---------|
| `stores/agent.ts` | State management, API calls, derived stores |
| `api/client.ts` | `identifyText()`, `identifyImage()`, `compressImageForIdentification()` |
| `api/types.ts` | `AgentIdentificationResult`, `AgentParsedWine`, `AgentAction`, etc. |
| `components/agent/AgentBubble.svelte` | Floating action button with pulse animation |
| `components/agent/AgentPanel.svelte` | Main container, handles all states and navigation |
| `components/agent/CommandInput.svelte` | Text input + camera button |
| `components/agent/AgentLoadingState.svelte` | Animated loader with deep search mode |
| `components/agent/WineIdentificationCard.svelte` | Displays result with actions |
| `components/agent/ConfidenceIndicator.svelte` | Visual confidence bar |
| `components/agent/DisambiguationList.svelte` | Radio list for multiple candidates |
| `routes/+layout.svelte` | Mounts AgentBubble and AgentPanel globally |

### Backend

| File | Purpose |
|------|---------|
| `agent/_bootstrap.php` | PSR-4 autoloader, factory functions |
| `agent/config/agent.config.php` | API keys, model config, thresholds |
| `agent/identifyText.php` | POST endpoint for text |
| `agent/identifyImage.php` | POST endpoint for images |
| `agent/Identification/IdentificationService.php` | Main orchestrator |
| `agent/Identification/TextProcessor.php` | Gemini text extraction |
| `agent/Identification/VisionProcessor.php` | Gemini Vision extraction |
| `agent/Identification/ConfidenceScorer.php` | Score calculation |
| `agent/Identification/ImageQualityAssessor.php` | Image validation |
| `agent/LLM/LLMClient.php` | Provider abstraction |
| `agent/LLM/Adapters/GeminiAdapter.php` | Gemini API calls |
| `agent/LLM/CostTracker.php` | Usage logging |
| `agent/prompts/text_identify.txt` | Text identification prompt |
| `agent/prompts/vision_identify.txt` | Image identification prompt |

### Database

| Table | Purpose |
|-------|---------|
| `agentUsers` | User tracking (currently just default user id=1) |
| `agentUsageLog` | Per-request: tokens, cost, latency, success/error |
| `agentUsageDaily` | Daily aggregates by provider |

---

## API Response Format

```typescript
interface AgentIdentificationResult {
  intent: 'add' | 'query' | 'pair' | 'advice' | 'unknown';
  parsed: {
    producer: string | null;
    wineName: string | null;
    vintage: string | null;
    country: string | null;
    region: string | null;
    appellation: string | null;
    wineType: 'Red' | 'White' | 'Rosé' | 'Sparkling' | 'Dessert' | 'Fortified' | null;
    grapeVarieties: string[] | null;
  };
  confidence: number;  // 0-100
  action: 'auto_populate' | 'suggest' | 'disambiguate' | 'ask_clarification';
  candidates: Array<{ parsed: AgentParsedWine; confidence: number; reason: string }>;
  usage?: { tokens: { input: number; output: number }; cost: number; latencyMs: number };
  escalation?: { attempted: boolean; improved: boolean; originalConfidence: number | null };
}
```

**Action Thresholds** (configurable):
- `auto_populate`: confidence >= 85 (high confidence, proceed automatically)
- `suggest`: confidence >= 60 (medium confidence, show for confirmation)
- `disambiguate`: confidence >= 40 with candidates (show options)
- `ask_clarification`: confidence < 40 (too uncertain)

---

## Configuration

**API Keys** (in `../wineapp-config/config.local.php`):
```php
define('GEMINI_API_KEY', 'your-api-key');
```

**Model Settings** (`agent.config.php`):
```php
'llm' => [
    'default_provider' => 'gemini',
    'providers' => [
        'gemini' => [
            'api_key_env' => 'GEMINI_API_KEY',
            'default_model' => 'gemini-2.0-flash',
            'base_url' => 'https://generativelanguage.googleapis.com/v1beta',
        ],
    ],
],
```

---

## Next Phase: Enrichment (2.5 + 2.6)

### Goal
After identification, fetch additional data about the wine:
- Grape varieties (if not in label)
- Drink window (when to drink)
- Critic scores (Wine Spectator, etc.)
- Typical characteristics
- Average price

### Suggested Approach

1. **Backend**: Create `EnrichmentService` that:
   - Takes parsed wine data
   - Checks `cacheWineEnrichment` table for cached data
   - If stale/missing, calls Gemini for enrichment
   - Caches result with TTL-based field tracking

2. **Endpoint**: `POST /agent/enrichWine.php`
   ```json
   {
     "producer": "Château Margaux",
     "wineName": "Château Margaux",
     "vintage": "2019"
   }
   ```

3. **Frontend**:
   - Add "Get More Info" button to WineIdentificationCard
   - Show enriched data in expandable section
   - Use `agent.enrichWine()` method in store

4. **Database**: Use existing `cacheWineEnrichment` table from schema

---

## Next Phase: Advice Mode (2.7)

### Goal
Answer questions like "What wine goes with lamb?" using the user's cellar.

### Suggested Approach

1. **Intent Detection**: Add 'pair' intent to IntentDetector
2. **PairingService**: Query `refPairingRules` table for matching rules
3. **Cellar Matching**: Cross-reference with user's wines in cellar
4. **Response**: Return recommended wines with reasoning

---

## Gotchas & Lessons Learned

1. **PSR-4 Case Sensitivity**: PHP folders must match namespace casing exactly on Linux. Windows is case-insensitive but production Linux is not. Use `LLM/` not `llm/`.

2. **Image Compression**: Always compress before upload. Original photos can be 5-10MB. Target ~100-200KB for API calls.

3. **Gemini Vision**: Works well with clear wine labels. Struggles with:
   - Blurry photos
   - Labels at extreme angles
   - Handwritten labels
   - Very ornate/artistic labels

4. **Model Escalation**: The "detailed" tier uses the same model but with a more thorough prompt. Consider using a different model (e.g., gemini-1.5-pro) for truly difficult cases in the future.

5. **Loading UX**: Users appreciate feedback during long operations. The time-based switch to "deep search" mode at 2.5s works well to indicate progress.

---

## Testing Checklist

### Text Identification
- [ ] Simple wine name: "Opus One 2018"
- [ ] Producer + wine: "Penfolds Grange 2017"
- [ ] Abbreviated: "DRC 2019 La Tache"
- [ ] Non-wine input: "hello" (should return low confidence)

### Image Identification
- [ ] Clear front label photo
- [ ] Back label with details
- [ ] Blurry photo (should show quality warning)
- [ ] Non-wine image (should handle gracefully)

### UI Flow
- [ ] Bubble click opens panel
- [ ] Text submit shows loading → result
- [ ] Camera opens file picker
- [ ] Image submit shows loading → result
- [ ] "Add to Cellar" navigates to /add with data
- [ ] Close button closes panel
- [ ] Escape key closes panel

### Escalation
- [ ] Low confidence text triggers escalation
- [ ] Loading shows "deep search" after delay
- [ ] Result includes escalation metadata

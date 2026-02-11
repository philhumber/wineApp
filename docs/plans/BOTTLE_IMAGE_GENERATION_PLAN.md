# Wine Bottle Image Generation

**Created**: 2026-02-11
**Status**: Planned
**JIRA**: TBD

## Context

Users take label photos for wine identification, but these raw label shots don't make for clean cellar displays — the cellar view falls back to a generic SVG placeholder. A POC at `winebottlecreator/` demonstrates a two-step Gemini pipeline: label extraction + bottle image generation using `gemini-2.5-flash-image`. The model takes an original label photo + wine details and generates a full, clean studio bottle shot on a white background.

**Goal**: Integrate bottle image generation into Qvé as an opt-in feature (future premium-gated) available both during the agent add flow and as a standalone action on existing wines.

---

## POC Summary

The POC (`winebottlecreator/`) is a React app using `@google/genai` SDK:

1. **Label identification**: `gemini-3-flash-preview` extracts wine details (producer, name, region, vintage, grape) from a label photo
2. **Bottle generation**: `gemini-2.5-flash-image` takes the original label photo + a text prompt with wine details → generates a full unopened bottle on white background

**Key technical details:**
- `gemini-2.5-flash-image` uses the same `generateContent` REST endpoint but with `responseModalities: ["IMAGE"]` in `generationConfig`
- `responseMimeType` and `responseSchema` are **NOT supported** for this model
- Response contains `inline_data.data` (base64 PNG) in `candidates[0].content.parts`
- Generation takes 10-30 seconds (significantly slower than text generation)

**Generation prompt:**
```
This is a label from a wine bottle. Generate the full, unopened bottle with a clean
white background. The wine is called {wineName} and is produced by {producer} in
{region}. Ensure the bottle is complete and unopened with the covered foil and other
typical details of this type of wine.
```

---

## Scope

**In scope (this implementation):**
- PHP backend endpoint for bottle image generation via Gemini 2.5 Flash Image
- Agent flow integration: "Generate Bottle Shot" chip after identification
- Generated image used as wine picture during add-to-cellar
- API client method + types

**Out of scope (future work):**
- Standalone edit-page generation (requires separate photo capture modal UI)
- Premium gating / feature flags
- Cost tracking in usage tables
- Batch generation for existing wines

---

## Architecture

### User Flow

```
Identification result shown (WineCard)
          │
          ▼
┌─────────────────────────────────────────┐
│ Action chips:                           │
│  [Add to Cellar] [Generate Bottle Shot] │
│  [Learn More] [Remember]                │
└─────────┬───────────────────────────────┘
          │
    User taps "Generate Bottle Shot"
          │
          ▼
┌─────────────────────────────────────────┐
│ Typing indicator:                       │
│  "Creating a studio shot..."            │
│                                         │
│  API call to agentGenerateBottle.php    │
│  with label photo + wine details        │
└─────────┬───────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│ Generated bottle image shown            │
│  "Here's your bottle shot."             │
│                                         │
│  [Use & Add to Cellar] [Try Again]      │
│  [Skip, Add Without]                    │
└─────────┬───────────────────────────────┘
          │
    User taps "Use & Add to Cellar"
          │
          ▼
    Normal add-to-cellar flow
    (with generated image as winePicture)
```

### Backend Pipeline

```
Frontend POST
  { image, mimeType, producer, wineName, region, wineType, vintage }
          │
          ▼
agentGenerateBottle.php
  ├── Validate inputs (MIME type, size)
  ├── Build prompt from wine details
  ├── GeminiAdapter->generateImage()
  │     ├── POST to /v1beta/models/gemini-2.5-flash-image:generateContent
  │     ├── Payload: { contents: [inline_data + text], generationConfig: { responseModalities: ["IMAGE"] } }
  │     └── Parse: extract inline_data.data from response parts
  ├── base64_decode → temp file
  ├── rotateAndResizeImage() → 800×800 JPEG
  ├── Save to images/wines/{guid}.jpg
  └── Return { imagePath: "images/wines/abc123.jpg" }
```

---

## Phase 1: Backend — Image Processing Extraction

### 1a. Create `imageHelper.php`

Extract reusable image processing functions from `upload.php` into a shared helper.

**Create** `resources/php/imageHelper.php` containing:
- `generate_guid_filename()` — GUID-based filename generation
- `get_unique_filename()` — collision-safe filename in target directory
- `getDominantEdgeColor()` — edge color sampling for background fill
- `rotateAndResizeImage()` — EXIF rotation + resize to max dimension + JPEG conversion

**Modify** `resources/php/upload.php`:
- Add `require_once __DIR__ . '/imageHelper.php';`
- Remove the extracted function definitions (main upload logic stays)

This avoids the problem of `require_once 'upload.php'` executing the main upload script code.

### Files

| File | Action |
|------|--------|
| `resources/php/imageHelper.php` | **CREATE** |
| `resources/php/upload.php` | MODIFY — require helper, remove extracted functions |

---

## Phase 2: Backend — Gemini Image Generation

### 2a. Add `generateImage()` to GeminiAdapter

**Modify** `resources/php/agent/LLM/Adapters/GeminiAdapter.php`:

New public method:

```php
public function generateImage(
    string $prompt,
    string $imageBase64,
    string $mimeType,
    array $options = []
): array
```

**Payload structure** (differs from `completeWithImage`):
```php
$payload = [
    'contents' => [[
        'parts' => [
            ['inline_data' => ['mime_type' => $mimeType, 'data' => $imageBase64]],
            ['text' => $prompt],
        ]
    ]],
    'generationConfig' => [
        'responseModalities' => ['IMAGE'],
    ],
];
```

- No `maxOutputTokens`, `temperature`, `responseMimeType`, or `responseSchema`
- Uses existing `makeRequest()` infrastructure (auth headers, SSL config, error handling)
- 120s timeout (image generation is slow)

New private method `parseImageResponse()`:
- Iterates `candidates[0].content.parts` looking for `inline_data.data`
- Returns `['success', 'imageData', 'imageMimeType', 'error', 'latencyMs', 'model']`

### 2b. Add model config

**Modify** `resources/php/agent/config/agent.config.php`:
- Add `gemini-2.5-flash-image` to `providers.gemini.models` with `supports_image_generation: true`
- Add `generate_bottle_image` to `task_routing` with 120s timeout, no fallback

### 2c. Create the endpoint

**Create** `resources/php/agent/agentGenerateBottle.php`:

```
POST /resources/php/agent/agentGenerateBottle.php

Request:
{
    "image": "<base64>",
    "mimeType": "image/jpeg",
    "producer": "Chateau Margaux",
    "wineName": "Chateau Margaux",
    "region": "Margaux",        // optional
    "wineType": "Red",          // optional
    "vintage": "2015"           // optional
}

Response:
{
    "success": true,
    "message": "Bottle image generated successfully",
    "data": {
        "imagePath": "images/wines/abc123def456.jpg",
        "latencyMs": 15000,
        "model": "gemini-2.5-flash-image"
    }
}
```

**Processing steps:**
1. `agentRequireMethod('POST')`, `agentGetJsonBody()`, `agentRequireFields(['image', 'mimeType', 'producer', 'wineName'])`
2. Validate MIME type (jpeg/png/webp) and size (<10MB)
3. Build prompt via `buildBottlePrompt()` helper function
4. Call `$adapter->generateImage($prompt, $imageBase64, $mimeType, ['timeout' => 120])`
5. Decode base64 → write temp file → `rotateAndResizeImage()` → save to `images/wines/`
6. Return image path via `agentResponse()`

**Error handling**: `agentStructuredError()` for validation/service errors, `agentExceptionError()` for exceptions. Generation failure is retryable.

### Files

| File | Action |
|------|--------|
| `resources/php/agent/LLM/Adapters/GeminiAdapter.php` | MODIFY — add `generateImage()` + `parseImageResponse()` |
| `resources/php/agent/config/agent.config.php` | MODIFY — add model config + task routing |
| `resources/php/agent/agentGenerateBottle.php` | **CREATE** |

---

## Phase 3: Frontend — Types, Store, API Client

### 3a. Action types

**Modify** `qve/src/lib/agent/types.ts` — add to `WineFlowAction` union:
- `{ type: 'generate_bottle_shot'; messageId: string }`
- `{ type: 'use_generated_image'; messageId: string }`
- `{ type: 'skip_generated_image'; messageId: string }`
- `{ type: 'retry_bottle_shot'; messageId: string }`

### 3b. API types

**Modify** `qve/src/lib/api/types.ts` — add `BottleShotResponse`:
```typescript
interface BottleShotResponse {
  imagePath: string;
  latencyMs: number;
  model: string;
}
```

### 3c. Store

**Modify** `qve/src/lib/stores/agentIdentification.ts`:

Add to `IdentificationState`:
```typescript
generatedBottleShot: string | null;  // Server path (images/wines/xxx.jpg)
```

Add actions:
- `setGeneratedBottleShot(imagePath: string)` — stores path, persists to sessionStorage
- `clearGeneratedBottleShot()` — clears path

Add derived store:
- `export const generatedBottleShot`

Include in persistence/restore cycle. Auto-cleared by existing `clearIdentification()`.

### 3d. API client

**Modify** `qve/src/lib/api/client.ts` — add method:

```typescript
async generateBottleShot(params: {
  producer: string;
  wineName: string;
  image?: string;      // base64 label photo (optional)
  mimeType?: string;
  vintage?: string;
  wineType?: string;
  region?: string;
}): Promise<BottleShotResponse>
```

### Files

| File | Action |
|------|--------|
| `qve/src/lib/agent/types.ts` | MODIFY — add 4 action types |
| `qve/src/lib/api/types.ts` | MODIFY — add response type |
| `qve/src/lib/stores/agentIdentification.ts` | MODIFY — add generatedBottleShot field + actions |
| `qve/src/lib/api/client.ts` | MODIFY — add generateBottleShot() method |

---

## Phase 4: Frontend — Chip Infrastructure

### 4a. Message keys

**Modify** `qve/src/lib/agent/messageKeys.ts` — add:
- `BOTTLE_SHOT_GENERATING` — "Creating a studio shot of this bottle..."
- `BOTTLE_SHOT_COMPLETE` — "Here's your bottle shot."
- `BOTTLE_SHOT_FAILED` — "I couldn't create the bottle shot. You can try again or continue without one."
- `CHIP_GENERATE_BOTTLE_SHOT` — "Generate Bottle Shot"
- `CHIP_USE_GENERATED_IMAGE` — "Use & Add to Cellar"
- `CHIP_SKIP_GENERATED_IMAGE` — "Skip, Add Without"

### 4b. Message registry

**Modify** personality message files — add sommelier-themed text for new keys.

### 4c. Chip registry

**Modify** `qve/src/lib/agent/services/chipRegistry.ts`:

Add `ChipKey` entries:
```typescript
GENERATE_BOTTLE_SHOT = 'generate_bottle_shot',
USE_GENERATED_IMAGE = 'use_generated_image',
SKIP_GENERATED_IMAGE = 'skip_generated_image',
RETRY_BOTTLE_SHOT = 'retry_bottle_shot',
```

Add `CHIP_DEFINITIONS` for each (linking to message keys, setting variants).

### 4d. Chip generator

**Modify** `qve/src/lib/agent/services/chipGenerator.ts`:

Update `generateActionChips(hasEnrichment)`:
```typescript
// Add after ADD_TO_CELLAR, before LEARN_MORE
chips.push(getChip(ChipKey.GENERATE_BOTTLE_SHOT));
```

Update `generatePostEnrichmentChips()` similarly.

Add new functions:
- `generateBottleShotResultChips()` — [Use & Add to Cellar, Try Again, Skip]
- `generateBottleShotErrorChips()` — [Try Again, Skip]

### Files

| File | Action |
|------|--------|
| `qve/src/lib/agent/messageKeys.ts` | MODIFY — add 6 message keys |
| `qve/src/lib/agent/messages/` | MODIFY — add message text |
| `qve/src/lib/agent/services/chipRegistry.ts` | MODIFY — add 4 chip definitions |
| `qve/src/lib/agent/services/chipGenerator.ts` | MODIFY — update action chips, add new generators |

---

## Phase 5: Frontend — Handler & Router Integration

### 5a. Create handler

**Create** `qve/src/lib/agent/handlers/bottleShot.ts`:

Follows the pattern of `enrichment.ts` — dedicated handler module for a distinct concern.

**`generate_bottle_shot` action:**
1. `conversation.disableMessage(messageId)` — disable tapped chips
2. Get result from `identification.getResult()` and label photo from `identification.getCurrentState().lastImageData`
3. `conversation.addTypingMessage(...)` — "Creating a studio shot..."
4. Call `api.generateBottleShot(...)` with wine details + optional label image
5. **Success**: Remove typing → `identification.setGeneratedBottleShot(imagePath)` → add image message (reuse `ImageMessage` component with `/{imagePath}` as src) → add text message → show `generateBottleShotResultChips()`
6. **Failure**: Remove typing → add error text → show `generateBottleShotErrorChips()` → stay in `confirming` phase (non-critical failure)

**`use_generated_image` action:**
1. Disable chips → dispatch `add_to_cellar` action (generated image already in identification store)

**`skip_generated_image` action:**
1. `identification.clearGeneratedBottleShot()` → dispatch `add_to_cellar`

**`retry_bottle_shot` action:**
1. Re-run the generate logic

**Design decisions:**
- Stays in `confirming` phase throughout — no new state machine phases needed
- Non-critical failure — user can always skip and add without
- No abort/cancel support needed (generation is a single request, not streaming)
- For text-only identifications (no label photo): label image is omitted, backend generates from details alone

### 5b. Router integration

**Modify** `qve/src/lib/agent/handlers/index.ts`:
- Export `isBottleShotAction()` and `handleBottleShotAction()` from `bottleShot.ts`
- Add `bottleShot` to `HANDLER_CATEGORIES`

**Modify** `qve/src/lib/agent/router.ts`:
- Import and add routing for bottle shot actions (before the existing action handler chain)

### 5c. Add wine integration

**Modify** `qve/src/lib/agent/handlers/addWine.ts` in `submitWine()` (~line 395):

Before the existing `lastImageData` upload logic, check for a generated bottle shot:

```typescript
// Prefer generated bottle shot over original label photo
const generatedShot = identification.getCurrentState().generatedBottleShot;
if (generatedShot) {
  uploadedPicturePath = generatedShot; // Already a server path
}

// Fallback to original label photo
if (!uploadedPicturePath) {
  const imageData = identification.getCurrentState().lastImageData;
  // ... existing logic ...
}
```

The generated bottle shot is already saved server-side by the endpoint, so no upload needed — just use the path directly.

### Files

| File | Action |
|------|--------|
| `qve/src/lib/agent/handlers/bottleShot.ts` | **CREATE** — new handler module |
| `qve/src/lib/agent/handlers/index.ts` | MODIFY — export new handler |
| `qve/src/lib/agent/router.ts` | MODIFY — route new actions |
| `qve/src/lib/agent/handlers/addWine.ts` | MODIFY — prefer generated image |

---

## File Summary

| # | File | Action |
|---|------|--------|
| 1 | `resources/php/imageHelper.php` | **CREATE** |
| 2 | `resources/php/upload.php` | MODIFY |
| 3 | `resources/php/agent/LLM/Adapters/GeminiAdapter.php` | MODIFY |
| 4 | `resources/php/agent/config/agent.config.php` | MODIFY |
| 5 | `resources/php/agent/agentGenerateBottle.php` | **CREATE** |
| 6 | `qve/src/lib/agent/types.ts` | MODIFY |
| 7 | `qve/src/lib/api/types.ts` | MODIFY |
| 8 | `qve/src/lib/stores/agentIdentification.ts` | MODIFY |
| 9 | `qve/src/lib/api/client.ts` | MODIFY |
| 10 | `qve/src/lib/agent/messageKeys.ts` | MODIFY |
| 11 | `qve/src/lib/agent/messages/` (personality files) | MODIFY |
| 12 | `qve/src/lib/agent/services/chipRegistry.ts` | MODIFY |
| 13 | `qve/src/lib/agent/services/chipGenerator.ts` | MODIFY |
| 14 | `qve/src/lib/agent/handlers/bottleShot.ts` | **CREATE** |
| 15 | `qve/src/lib/agent/handlers/index.ts` | MODIFY |
| 16 | `qve/src/lib/agent/router.ts` | MODIFY |
| 17 | `qve/src/lib/agent/handlers/addWine.ts` | MODIFY |

**3 new files, 14 modified files**

---

## Gotchas

1. **`responseModalities` casing**: REST API may require uppercase `["IMAGE"]` — test both
2. **Response may have text + image parts**: Parser must iterate all parts looking for `inline_data`
3. **Base64 prefix stripping**: Ensure label image base64 doesn't include `data:image/...;base64,` prefix before sending to Gemini
4. **Generated image is PNG**: Gemini returns PNG but `rotateAndResizeImage()` converts to JPEG — correct for consistency
5. **EXIF rotation**: AI-generated images won't have EXIF data — rotation code is a harmless no-op
6. **White background**: Prompt asks for white background; `getDominantEdgeColor()` will correctly detect white edges
7. **Memory**: Generated image base64 can be several MB in PHP memory — ensure `memory_limit` >= 128MB
8. **upload.php extraction**: Must not `require_once upload.php` directly — its top-level code would execute

---

## Verification

1. **PHP syntax**: `php -l` on all new/modified PHP files
2. **Backend curl test**: Send label image + wine details to endpoint, verify JPEG saved to `images/wines/`
3. **TypeScript check**: `npm run check` in `qve/` (pre-existing ChipsMessage.test.ts error excluded)
4. **Manual agent flow**:
   - Identify wine via label photo → confirm → see "Generate Bottle Shot" chip
   - Tap chip → see typing indicator → see generated bottle image
   - Tap "Use & Add to Cellar" → verify wine added with generated image in cellar
   - Test: Skip flow, retry flow, error recovery
   - Test: Text-only identification (no label photo available)
5. **Enrichment path**: Identify → Learn More → verify "Generate Bottle Shot" in post-enrichment chips
6. **Mobile**: Test generation during tab switch (sessionStorage persistence of generatedBottleShot)

---

## Future Work

- **Standalone edit-page generation**: "Generate Bottle Image" button on wine edit page — prompts user to take/upload label photo, then generates
- **Premium gating**: Feature flag to restrict to premium users
- **Cost tracking**: Log generation costs to `agentUsageLog` / `agentUsageDaily`
- **Batch generation**: "Beautify Cellar" feature to generate images for wines with placeholder images
- **Image quality options**: Allow user to choose style/background preferences

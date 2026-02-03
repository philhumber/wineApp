# Wine Card Unification Proposal

**Problem:** WineIdentificationCard.svelte and WineCardStreaming.svelte duplicate 90% of their code (layout, styling, logic).

**Solution:** Create a unified `WineCard.svelte` that handles both static and streaming modes.

---

## Proposed Architecture

```
WineCard.svelte (unified component)
├── Props:
│   ├── mode: 'static' | 'streaming'
│   ├── parsed?: AgentParsedWine (for static mode)
│   ├── confidence?: number (for static mode)
│   └── streamingFields?: Map<string, StreamingFieldState> (for streaming mode)
│
└── Renders:
    ├── Static mode: Show all data at once
    └── Streaming mode: Show skeleton → typewriter animation
```

---

## Implementation

### Step 1: Create Unified WineCard.svelte

```svelte
<!-- qve/src/lib/components/agent/WineCard.svelte -->
<script lang="ts">
  /**
   * WineCard (Unified)
   * Displays wine data in either static or streaming mode
   *
   * Static mode: Shows complete data at once
   * Streaming mode: Shows skeleton loaders that fill in progressively
   */
  import { agent } from '$lib/stores';
  import type { AgentParsedWine } from '$lib/api/types';
  import type { StreamingFieldState } from '$lib/stores/agent';
  import FieldTypewriter from './FieldTypewriter.svelte';
  import ConfidenceIndicator from './ConfidenceIndicator.svelte';

  // ─────────────────────────────────────────────────────
  // PROPS
  // ─────────────────────────────────────────────────────

  /** Display mode: static (all at once) or streaming (progressive) */
  export let mode: 'static' | 'streaming' = 'static';

  /** Static mode: Complete wine data */
  export let parsed: AgentParsedWine | null = null;

  /** Static mode: Confidence score */
  export let confidence: number = 0;

  /** Streaming mode: Map of streaming field states */
  export let streamingFields: Map<string, StreamingFieldState> = new Map();

  /** Optional: Show incomplete state (dashed border) */
  export let incomplete: boolean = false;

  // ─────────────────────────────────────────────────────
  // FIELD ACCESSORS (mode-agnostic)
  // ─────────────────────────────────────────────────────

  // In static mode: read from parsed prop
  // In streaming mode: read from streamingFields Map

  function getFieldValue(field: string): any {
    if (mode === 'static') {
      return parsed?.[field as keyof AgentParsedWine] ?? null;
    } else {
      return streamingFields.get(field)?.value ?? null;
    }
  }

  function hasField(field: string): boolean {
    if (mode === 'static') {
      const value = parsed?.[field as keyof AgentParsedWine];
      return value !== null && value !== undefined && value !== 'Unknown' && value !== 'Unknown Wine';
    } else {
      return streamingFields.has(field);
    }
  }

  function isFieldTyping(field: string): boolean {
    if (mode === 'static') return false;
    return streamingFields.get(field)?.isTyping ?? false;
  }

  // ─────────────────────────────────────────────────────
  // REACTIVE FIELD STATES
  // ─────────────────────────────────────────────────────

  $: producer = getFieldValue('producer');
  $: wineName = getFieldValue('wineName');
  $: vintage = getFieldValue('vintage');
  $: region = getFieldValue('region');
  $: country = getFieldValue('country');
  $: wineType = getFieldValue('wineType');
  $: grapes = getFieldValue('grapes');
  $: confidenceValue = mode === 'static' ? confidence : (getFieldValue('confidence') as number);

  $: hasProducer = hasField('producer');
  $: hasWineName = hasField('wineName');
  $: hasVintage = hasField('vintage');
  $: hasRegion = hasField('region');
  $: hasCountry = hasField('country');
  $: hasType = hasField('wineType');
  $: hasGrapes = hasField('grapes');
  $: hasConfidence = mode === 'static' ? true : hasField('confidence');

  $: grapeList = Array.isArray(grapes) ? grapes.join(', ') : grapes;
  $: metadata = [region, country].filter(Boolean).join(' · ');

  // ─────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────

  function getCountryFlag(country: string | null): string {
    if (!country) return '';
    const flags: Record<string, string> = {
      France: '🇫🇷',
      Italy: '🇮🇹',
      Spain: '🇪🇸',
      USA: '🇺🇸',
      Australia: '🇦🇺',
      Austria: '🇦🇹',
      'New Zealand': '🇳🇿',
      Argentina: '🇦🇷',
      Chile: '🇨🇱',
      Germany: '🇩🇪',
      Portugal: '🇵🇹',
      'South Africa': '🇿🇦'
    };
    return flags[country] || '';
  }

  function handleFieldComplete(field: string) {
    if (mode === 'streaming') {
      agent.markFieldTypingComplete(field);
    }
  }

  $: countryFlag = getCountryFlag(country);
</script>

<div
  class="wine-card"
  class:incomplete
  class:streaming={mode === 'streaming'}
  data-testid="wine-card"
>
  <!-- Wine Name -->
  <div class="field-row main-field" class:has-value={hasWineName}>
    {#if hasWineName}
      <h3 class="wine-name">
        {#if mode === 'streaming'}
          <FieldTypewriter
            value={wineName}
            isTyping={isFieldTyping('wineName')}
            on:complete={() => handleFieldComplete('wineName')}
          />
        {:else}
          {wineName}
        {/if}
      </h3>
    {:else if mode === 'streaming'}
      <span class="shimmer-line wine-name-shimmer"></span>
    {:else}
      <span class="missing-label">Wine name needed</span>
    {/if}
  </div>

  <!-- Producer -->
  <div class="field-row main-field" class:has-value={hasProducer}>
    {#if hasProducer}
      <p class="producer-name">
        {#if mode === 'streaming'}
          <FieldTypewriter
            value={producer}
            isTyping={isFieldTyping('producer')}
            on:complete={() => handleFieldComplete('producer')}
          />
        {:else}
          {producer}
        {/if}
      </p>
    {:else if mode === 'streaming'}
      <span class="shimmer-line producer-shimmer"></span>
    {/if}
  </div>

  <!-- Accent divider -->
  <div class="divider"></div>

  <!-- Metadata line (vintage · region · country) -->
  <div class="metadata-row">
    {#if hasVintage}
      <span class="vintage">
        {#if mode === 'streaming'}
          <FieldTypewriter
            value={vintage}
            isTyping={isFieldTyping('vintage')}
            on:complete={() => handleFieldComplete('vintage')}
          />
        {:else}
          {vintage}
        {/if}
      </span>
      {#if hasRegion || hasCountry}
        <span class="separator"> · </span>
      {/if}
    {:else if mode === 'streaming'}
      <span class="shimmer-inline shimmer-vintage"></span>
    {/if}

    {#if hasRegion}
      <span class="region">
        {#if mode === 'streaming'}
          <FieldTypewriter
            value={region}
            isTyping={isFieldTyping('region')}
            on:complete={() => handleFieldComplete('region')}
          />
        {:else}
          {region}
        {/if}
      </span>
    {:else if mode === 'streaming' && !hasVintage}
      <span class="shimmer-inline shimmer-region"></span>
    {/if}

    {#if hasCountry}
      {#if hasRegion}
        <span class="separator"> · </span>
      {/if}
      <span class="country">
        {#if mode === 'streaming'}
          <FieldTypewriter
            value={country}
            isTyping={isFieldTyping('country')}
            on:complete={() => handleFieldComplete('country')}
          />
        {:else}
          {country}
        {/if}
      </span>
      {#if countryFlag}
        <span class="flag">{countryFlag}</span>
      {/if}
    {/if}
  </div>

  <!-- Confidence indicator -->
  {#if hasConfidence}
    <div class="confidence-section">
      <ConfidenceIndicator score={confidenceValue} />
    </div>
  {:else if mode === 'streaming'}
    <div class="confidence-section">
      <span class="shimmer-inline shimmer-confidence"></span>
    </div>
  {/if}

  <!-- Type and grapes -->
  <div class="details">
    {#if hasType}
      <span class="type-badge">
        {#if mode === 'streaming'}
          <FieldTypewriter
            value={wineType}
            isTyping={isFieldTyping('wineType')}
            speed={25}
            on:complete={() => handleFieldComplete('wineType')}
          />
        {:else}
          {wineType}
        {/if}
      </span>
    {:else if mode === 'streaming'}
      <span class="shimmer-badge"></span>
    {/if}

    {#if hasGrapes}
      <span class="grapes">
        {#if mode === 'streaming'}
          <FieldTypewriter
            value={grapeList}
            isTyping={isFieldTyping('grapes')}
            on:complete={() => handleFieldComplete('grapes')}
          />
        {:else}
          {grapeList}
        {/if}
      </span>
    {:else if mode === 'streaming'}
      <span class="shimmer-inline shimmer-grapes"></span>
    {/if}
  </div>
</div>

<style>
  .wine-card {
    padding: var(--space-5);
    background: var(--surface);
    border-radius: var(--radius-lg);
    border: 1px solid var(--divider-subtle);
    animation: slideUp 0.3s var(--ease-out);
  }

  .wine-card.incomplete {
    border-color: var(--warning);
    border-style: dashed;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .field-row {
    min-height: 1.5em;
    margin-bottom: var(--space-1);
  }

  .main-field {
    min-height: 1.75em;
  }

  .missing-label {
    display: block;
    font-family: var(--font-serif);
    font-size: 1.125rem;
    font-style: italic;
    color: var(--text-tertiary);
    margin-bottom: var(--space-1);
  }

  .wine-name {
    font-family: var(--font-serif);
    font-size: 1.5rem;
    font-weight: 500;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.2;
  }

  .producer-name {
    font-family: var(--font-serif);
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--text-primary);
    margin: var(--space-1) 0 0 0;
  }

  .wine-card.incomplete .producer-name {
    font-size: 1.5rem;
    margin-top: var(--space-2);
  }

  .divider {
    width: 40px;
    height: 1px;
    background: var(--accent);
    margin: var(--space-3) 0;
  }

  .metadata-row {
    font-family: var(--font-sans);
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0 0 var(--space-4) 0;
    min-height: 1.25em;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0;
  }

  .separator {
    color: var(--text-tertiary);
  }

  .flag {
    margin-left: var(--space-1);
  }

  .confidence-section {
    margin-bottom: var(--space-4);
    min-height: 1.5em;
  }

  .details {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    min-height: 1.5em;
  }

  .type-badge {
    display: inline-block;
    padding: 2px 8px;
    background: var(--bg-subtle);
    border-radius: var(--radius-pill);
    font-family: var(--font-sans);
    font-size: 0.625rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
  }

  .grapes {
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    color: var(--text-tertiary);
  }

  /* Shimmer animations (streaming mode only) */
  .shimmer-line,
  .shimmer-inline,
  .shimmer-badge {
    display: inline-block;
    background: linear-gradient(
      90deg,
      var(--bg-subtle) 25%,
      var(--bg-elevated) 50%,
      var(--bg-subtle) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: var(--radius-sm);
  }

  .shimmer-line {
    display: block;
    height: 1em;
  }

  .wine-name-shimmer {
    width: 70%;
    height: 1.5rem;
  }

  .producer-shimmer {
    width: 50%;
    height: 1.25rem;
  }

  .shimmer-inline {
    height: 1em;
  }

  .shimmer-vintage {
    width: 3em;
  }

  .shimmer-region {
    width: 8em;
  }

  .shimmer-confidence {
    width: 6em;
    height: 1.25em;
  }

  .shimmer-badge {
    width: 4em;
    height: 1.5em;
    border-radius: var(--radius-pill);
  }

  .shimmer-grapes {
    width: 12em;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  /* Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .shimmer-line,
    .shimmer-inline,
    .shimmer-badge {
      animation: none;
      background: var(--bg-subtle);
    }
  }
</style>
```

---

### Step 2: Update Usage Sites

#### ChatMessage.svelte (Static Mode)
```svelte
<!-- Before -->
<WineIdentificationCard
  parsed={message.wineResult}
  confidence={message.confidence ?? 0}
/>

<!-- After -->
<WineCard
  mode="static"
  parsed={message.wineResult}
  confidence={message.confidence ?? 0}
/>
```

#### AgentPanel.svelte (Streaming Mode)
```svelte
<!-- Before -->
{#if $agentStreamingFields.size > 0 && !$agentEnriching}
  <WineCardStreaming />
{/if}

<!-- After -->
{#if $agentStreamingFields.size > 0 && !$agentEnriching}
  <WineCard
    mode="streaming"
    streamingFields={$agentStreamingFields}
  />
{/if}
```

---

### Step 3: Delete Old Components

```bash
# Remove duplicates
rm qve/src/lib/components/agent/WineIdentificationCard.svelte
rm qve/src/lib/components/agent/WineCardStreaming.svelte

# Update exports in index.ts
```

---

## Benefits

### 1. **Single Source of Truth**
- Change layout once → both modes update
- Change styling once → consistent everywhere
- Fix bugs once → both modes fixed

### 2. **Reduced Code Size**
```
Before:
  WineIdentificationCard.svelte:  201 lines
  WineCardStreaming.svelte:       400 lines
  Total:                          601 lines

After:
  WineCard.svelte (unified):      350 lines
  Reduction:                      251 lines (42% smaller!)
```

### 3. **Easier Maintenance**
```svelte
<!-- Add a new field to the card -->
<!-- BEFORE: Edit 2 files -->
<!-- AFTER: Edit 1 file -->

<!-- Example: Add "appellation" field -->
<div class="field-row">
  {#if hasAppellation}
    <span class="appellation">
      {#if mode === 'streaming'}
        <FieldTypewriter value={appellation} ... />
      {:else}
        {appellation}
      {/if}
    </span>
  {:else if mode === 'streaming'}
    <span class="shimmer-inline shimmer-appellation"></span>
  {/if}
</div>
```

### 4. **Better Testing**
```typescript
// Test both modes with same component
test('wine card in static mode', async ({ page }) => {
  // ... test static rendering
});

test('wine card in streaming mode', async ({ page }) => {
  // ... test streaming + skeleton loaders
});

// Guaranteed identical layout between modes
```

### 5. **Type Safety**
```typescript
// Props are validated at compile time
<WineCard mode="static" parsed={data} /> // ✓ Valid
<WineCard mode="streaming" streamingFields={fields} /> // ✓ Valid
<WineCard mode="static" streamingFields={fields} /> // ✗ TypeScript error: wrong props for mode
```

---

## Alternative Approach: Composition Pattern

If you want more separation between static/streaming logic:

```svelte
<!-- WineCard.svelte (container) -->
<script lang="ts">
  export let mode: 'static' | 'streaming';
  // ... props
</script>

{#if mode === 'static'}
  <WineCardContent parsed={parsed} confidence={confidence} />
{:else}
  <WineCardContent streamingFields={streamingFields} />
{/if}

<!-- WineCardContent.svelte (shared layout) -->
<script lang="ts">
  export let parsed: AgentParsedWine | null = null;
  export let streamingFields: Map<...> = new Map();

  // Unified field accessors (same as unified approach)
  $: mode = parsed ? 'static' : 'streaming';
  // ... rest of logic
</script>

<!-- Single layout template -->
```

**Pros:** Cleaner separation of concerns
**Cons:** Extra component layer, more files

---

## Implementation Steps

1. **Create `WineCard.svelte`** (unified component)
2. **Update `ChatMessage.svelte`** (use static mode)
3. **Update `AgentPanel.svelte`** (use streaming mode)
4. **Test both modes**
5. **Delete old components**
6. **Update exports in `index.ts`**

**Estimated time:** 2 hours

---

## Migration Strategy (Low Risk)

### Phase 1: Add Unified Component (No Breaking Changes)
```bash
# Create new component alongside old ones
touch qve/src/lib/components/agent/WineCard.svelte
```

### Phase 2: Test Unified Component
```typescript
// Add tests for both modes
test('unified wine card - static mode', ...);
test('unified wine card - streaming mode', ...);
```

### Phase 3: Switch Static Usage
```svelte
<!-- ChatMessage.svelte -->
import WineCard from './WineCard.svelte'; // New
// import WineIdentificationCard from './WineIdentificationCard.svelte'; // Old (commented)

<WineCard mode="static" ... />
```

Test → If works → Delete `WineIdentificationCard.svelte`

### Phase 4: Switch Streaming Usage
```svelte
<!-- AgentPanel.svelte -->
import WineCard from './WineCard.svelte'; // New
// import WineCardStreaming from './WineCardStreaming.svelte'; // Old (commented)

<WineCard mode="streaming" ... />
```

Test → If works → Delete `WineCardStreaming.svelte`

---

## Visual Regression Tests

Add to Playwright tests:

```typescript
test('unified wine card matches baseline - static mode', async ({ page }) => {
  // Render static mode
  await page.evaluate(() => {
    // Programmatically render WineCard in static mode
  });

  // Compare against old WineIdentificationCard baseline
  await expect(page.locator('[data-testid="wine-card"]'))
    .toHaveScreenshot('wine-card-static.png', { maxDiffPixels: 0 });
});

test('unified wine card matches baseline - streaming mode', async ({ page }) => {
  // Render streaming mode
  await page.evaluate(() => {
    // Programmatically render WineCard in streaming mode
  });

  // Compare against old WineCardStreaming baseline
  await expect(page.locator('[data-testid="wine-card"]'))
    .toHaveScreenshot('wine-card-streaming.png', { maxDiffPixels: 0 });
});
```

**Result:** Pixel-perfect guarantee that unified component renders identically to old components.

---

## Summary

**Before:**
- 2 separate components
- 601 lines total
- Duplicate layout, styling, logic
- Change layout → edit 2 files
- Risk of inconsistency

**After:**
- 1 unified component
- 350 lines total (42% reduction)
- Single source of truth
- Change layout → edit 1 file
- Guaranteed consistency

**Recommendation:** Start with unified approach. It's simpler, reduces code by 42%, and maintains identical behavior.

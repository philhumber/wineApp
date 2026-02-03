# Enrichment Card Unification Proposal

**Problem:** EnrichmentCard.svelte and EnrichmentCardStreaming.svelte duplicate **95% of their code** (even more than wine cards!).

**Solution:** Create a unified `EnrichmentCard.svelte` that handles both static and streaming modes.

---

## Duplication Analysis

### EnrichmentCard.svelte (168 lines)
- **Purpose:** Static display of completed enrichment data
- **Usage:** ChatMessage.svelte (chat history)
- **Sections:** Overview, Style Profile, Grapes, Tasting Notes, Pairings, Drink Window, Critic Scores
- **CSS:** 68 lines

### EnrichmentCardStreaming.svelte (355 lines)
- **Purpose:** Progressive streaming display
- **Usage:** AgentPanel.svelte (real-time enrichment)
- **Sections:** Overview, Style Profile, Grapes, Tasting Notes, Pairings, Drink Window, Critic Scores (IDENTICAL!)
- **CSS:** 159 lines (91 lines shimmer animations, 68 lines DUPLICATE base styles)

### Shared Code (~95%)
- ✅ **Identical card structure**: Header, content container, 7 sections
- ✅ **Identical section titles**: "Overview", "Style Profile", "Grape Composition", etc.
- ✅ **Identical section ordering**: Overview → Style → Grapes → Tasting → Pairings → Drink → Scores
- ✅ **Identical styling**: 68 lines of CSS copied verbatim
- ✅ **Identical visibility logic**: Same conditional rendering for each section
- ✅ **Identical sub-components**: StyleProfileDisplay, CriticScores, DrinkWindow, GrapeComposition

### Key Differences (5%)
- **EnrichmentCard**: Reads from `data` prop (complete object)
- **EnrichmentCardStreaming**: Reads from `$agentStreamingFields` Map, shows skeleton loaders

---

## Current Duplication Evidence

### Section Structure (100% Identical)
```svelte
<!-- EnrichmentCard.svelte -->
{#if hasOverview}
  <section class="section">
    <h4 class="section-title">Overview</h4>
    <p class="narrative-text">{data.overview}</p>
  </section>
{/if}

<!-- EnrichmentCardStreaming.svelte -->
<section class="section">
  <h4 class="section-title">Overview</h4>
  {#if hasOverview}
    <p class="narrative-text">
      <FieldTypewriter value={overview} isTyping={descriptionTyping} />
    </p>
  {:else}
    <div class="shimmer-container">...</div>
  {/if}
</section>
```

**Observation:** Same wrapper, same title, only data source differs!

### CSS Duplication (68 lines × 2 = 136 lines)
```css
/* EXACT DUPLICATE in both files */
.enrichment-card { background: var(--surface-raised); ... }
.card-header { display: flex; ... }
.header-title { font-weight: 600; ... }
.source-badge { font-size: 0.75rem; ... }
.card-content { padding: var(--space-4); }
.section { margin-bottom: var(--space-5); }
.section-title { font-size: 0.8125rem; ... }
.narrative-text { font-family: var(--font-serif); ... }
@keyframes slideUp { ... }
```

**Total Duplication:** 136 lines of CSS!

---

## Solution: Unified EnrichmentCard

### Component Signature
```svelte
<EnrichmentCard mode="static" data={enrichmentData} source="cache" />
<!-- OR -->
<EnrichmentCard mode="streaming" streamingFields={$agentStreamingFields} />
```

---

## Implementation

```svelte
<!-- qve/src/lib/components/agent/enrichment/EnrichmentCard.svelte -->
<script lang="ts">
  /**
   * EnrichmentCard (Unified)
   * Displays wine enrichment data in either static or streaming mode
   *
   * Static mode: Shows complete data at once
   * Streaming mode: Shows skeleton loaders that fill in progressively
   */
  import type { AgentEnrichmentData } from '$lib/api/types';
  import type { StreamingFieldState } from '$lib/stores/agent';
  import FieldTypewriter from '../FieldTypewriter.svelte';
  import StyleProfileDisplay from './StyleProfileDisplay.svelte';
  import CriticScores from './CriticScores.svelte';
  import DrinkWindow from './DrinkWindow.svelte';
  import GrapeComposition from './GrapeComposition.svelte';

  // ─────────────────────────────────────────────────────
  // PROPS
  // ─────────────────────────────────────────────────────

  /** Display mode: static (all at once) or streaming (progressive) */
  export let mode: 'static' | 'streaming' = 'static';

  /** Static mode: Complete enrichment data */
  export let data: AgentEnrichmentData | null = null;

  /** Static mode: Data source badge */
  export let source: 'cache' | 'web_search' | 'inference' | undefined = undefined;

  /** Streaming mode: Map of streaming field states */
  export let streamingFields: Map<string, StreamingFieldState> = new Map();

  /** Streaming mode: Whether enrichment is still in progress */
  export let isStreaming: boolean = false;

  // ─────────────────────────────────────────────────────
  // FIELD ACCESSORS (mode-agnostic)
  // ─────────────────────────────────────────────────────

  function getFieldValue(field: string): any {
    if (mode === 'static') {
      return data?.[field as keyof AgentEnrichmentData] ?? null;
    } else {
      return streamingFields.get(field)?.value ?? null;
    }
  }

  function hasField(field: string): boolean {
    if (mode === 'static') {
      const value = data?.[field as keyof AgentEnrichmentData];
      return value !== null && value !== undefined;
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

  // Overview field (can be 'overview' or 'description')
  $: overviewValue = mode === 'static'
    ? data?.overview
    : (getFieldValue('overview') || getFieldValue('description'));
  $: overviewTyping = mode === 'streaming'
    ? (isFieldTyping('overview') || isFieldTyping('description'))
    : false;

  // Style profile
  $: bodyValue = mode === 'static'
    ? data?.body
    : (getFieldValue('body') || getFieldValue('style'));
  $: tanninValue = getFieldValue('tannin');
  $: acidityValue = getFieldValue('acidity');

  // Grapes (can be 'grapeVarieties' or 'grapes')
  $: grapesValue = mode === 'static'
    ? data?.grapeVarieties
    : (getFieldValue('grapeVarieties') || getFieldValue('grapes'));

  // Tasting notes
  $: tastingNotesValue = getFieldValue('tastingNotes');
  $: tastingNotesTyping = isFieldTyping('tastingNotes');

  // Pairing notes (can be 'pairingNotes' or 'pairings')
  $: pairingNotesValue = mode === 'static'
    ? data?.pairingNotes
    : (getFieldValue('pairingNotes') || getFieldValue('pairings'));
  $: pairingNotesTyping = mode === 'streaming'
    ? (isFieldTyping('pairingNotes') || isFieldTyping('pairings'))
    : false;

  // Drink window
  $: drinkWindowValue = mode === 'static'
    ? data?.drinkWindow
    : getFieldValue('drinkWindow');

  // Critic scores
  $: criticScoresValue = mode === 'static'
    ? data?.criticScores
    : getFieldValue('criticScores');

  // Section visibility
  $: hasOverview = !!overviewValue;
  $: hasStyleProfile = !!bodyValue || !!tanninValue || !!acidityValue;
  $: hasGrapes = grapesValue && Array.isArray(grapesValue) && grapesValue.length > 0;
  $: hasTastingNotes = !!tastingNotesValue;
  $: hasPairingNotes = !!pairingNotesValue;
  $: hasDrinkWindow = drinkWindowValue && (drinkWindowValue.start || drinkWindowValue.end);
  $: hasCriticScores = criticScoresValue && Array.isArray(criticScoresValue) && criticScoresValue.length > 0;

  // Badge text
  $: badgeText = mode === 'static'
    ? (source === 'cache' ? 'Cached' : source === 'web_search' ? 'Web' : 'AI')
    : (isStreaming ? 'Researching...' : 'Research complete');
</script>

<div
  class="enrichment-card"
  class:complete={mode === 'streaming' && !isStreaming}
  data-testid="enrichment-card"
>
  <div class="card-header">
    <span class="header-title">Wine Details</span>
    <span
      class="source-badge"
      class:streaming={mode === 'streaming' && isStreaming}
    >
      {badgeText}
    </span>
  </div>

  <div class="card-content">
    <!-- Overview Section -->
    <section class="section">
      <h4 class="section-title">Overview</h4>
      {#if hasOverview}
        <p class="narrative-text">
          {#if mode === 'streaming'}
            <FieldTypewriter
              value={overviewValue}
              isTyping={overviewTyping}
            />
          {:else}
            {overviewValue}
          {/if}
        </p>
      {:else if mode === 'streaming'}
        <div class="shimmer-container">
          <span class="shimmer-bar" style="width: 100%;"></span>
          <span class="shimmer-bar" style="width: 90%;"></span>
          <span class="shimmer-bar" style="width: 70%;"></span>
        </div>
      {/if}
    </section>

    <!-- Style Profile Section -->
    <section class="section">
      <h4 class="section-title">Style Profile</h4>
      {#if hasStyleProfile}
        <StyleProfileDisplay
          body={bodyValue}
          tannin={tanninValue}
          acidity={acidityValue}
        />
      {:else if mode === 'streaming'}
        <div class="shimmer-container">
          <span class="shimmer-bar" style="width: 100%;"></span>
          <span class="shimmer-bar" style="width: 80%;"></span>
        </div>
      {/if}
    </section>

    <!-- Grape Composition Section -->
    <section class="section">
      <h4 class="section-title">Grape Composition</h4>
      {#if hasGrapes}
        <GrapeComposition grapes={grapesValue} />
      {:else if mode === 'streaming'}
        <div class="shimmer-container">
          <div class="shimmer-grapes">
            <span class="shimmer-pill"></span>
            <span class="shimmer-pill"></span>
          </div>
        </div>
      {/if}
    </section>

    <!-- Tasting Notes Section -->
    <section class="section">
      <h4 class="section-title">Tasting Notes</h4>
      {#if hasTastingNotes}
        <p class="narrative-text">
          {#if mode === 'streaming'}
            <FieldTypewriter
              value={tastingNotesValue}
              isTyping={tastingNotesTyping}
            />
          {:else}
            {tastingNotesValue}
          {/if}
        </p>
      {:else if mode === 'streaming'}
        <div class="shimmer-container">
          <span class="shimmer-bar" style="width: 100%;"></span>
          <span class="shimmer-bar" style="width: 85%;"></span>
        </div>
      {/if}
    </section>

    <!-- Food Pairings Section -->
    <section class="section">
      <h4 class="section-title">Food Pairings</h4>
      {#if hasPairingNotes}
        <p class="narrative-text">
          {#if mode === 'streaming'}
            <FieldTypewriter
              value={pairingNotesValue}
              isTyping={pairingNotesTyping}
            />
          {:else}
            {pairingNotesValue}
          {/if}
        </p>
      {:else if mode === 'streaming'}
        <div class="shimmer-container">
          <span class="shimmer-bar" style="width: 100%;"></span>
          <span class="shimmer-bar" style="width: 75%;"></span>
        </div>
      {/if}
    </section>

    <!-- Drink Window Section -->
    <section class="section">
      <h4 class="section-title">Drink Window</h4>
      {#if hasDrinkWindow}
        <DrinkWindow
          start={drinkWindowValue.start ?? null}
          end={drinkWindowValue.end ?? null}
          maturity={drinkWindowValue.maturity}
        />
      {:else if mode === 'streaming'}
        <div class="shimmer-container">
          <span class="shimmer-bar" style="width: 60%;"></span>
        </div>
      {/if}
    </section>

    <!-- Critic Scores Section -->
    <section class="section">
      <h4 class="section-title">Critic Scores</h4>
      {#if hasCriticScores}
        <CriticScores scores={criticScoresValue} />
      {:else if mode === 'streaming'}
        <div class="shimmer-container">
          <div class="shimmer-scores">
            <span class="shimmer-score"></span>
            <span class="shimmer-score"></span>
            <span class="shimmer-score"></span>
          </div>
        </div>
      {/if}
    </section>
  </div>
</div>

<style>
  /* ─────────────────────────────────────────────────────
     BASE STYLES (shared by both modes)
     ───────────────────────────────────────────────────── */

  .enrichment-card {
    background: var(--surface-raised);
    border-radius: var(--radius-lg);
    margin-top: var(--space-3);
    animation: slideUp 0.3s ease-out;
  }

  .enrichment-card.complete {
    border: 1px solid var(--accent);
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

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--divider);
  }

  .header-title {
    font-weight: 600;
    color: var(--text-primary);
  }

  .source-badge {
    font-size: 0.75rem;
    padding: var(--space-1) var(--space-2);
    background: var(--bg-subtle);
    border-radius: var(--radius-pill);
    color: var(--text-secondary);
  }

  .source-badge.streaming {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .card-content {
    padding: var(--space-4);
  }

  .section {
    margin-bottom: var(--space-5);
  }

  .section:last-child {
    margin-bottom: 0;
  }

  .section-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: var(--space-2);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .narrative-text {
    font-family: var(--font-serif);
    font-size: 0.9375rem;
    line-height: 1.6;
    color: var(--text-primary);
  }

  /* ─────────────────────────────────────────────────────
     SHIMMER ANIMATIONS (streaming mode only)
     ───────────────────────────────────────────────────── */

  .shimmer-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .shimmer-bar {
    display: block;
    height: 1em;
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

  .shimmer-scores {
    display: flex;
    gap: var(--space-3);
  }

  .shimmer-score {
    display: block;
    width: 60px;
    height: 40px;
    background: linear-gradient(
      90deg,
      var(--bg-subtle) 25%,
      var(--bg-elevated) 50%,
      var(--bg-subtle) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: var(--radius-md);
  }

  .shimmer-grapes {
    display: flex;
    gap: var(--space-2);
  }

  .shimmer-pill {
    display: block;
    width: 80px;
    height: 1.5em;
    background: linear-gradient(
      90deg,
      var(--bg-subtle) 25%,
      var(--bg-elevated) 50%,
      var(--bg-subtle) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: var(--radius-pill);
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .shimmer-bar,
    .shimmer-score,
    .shimmer-pill {
      animation: none;
      background: var(--bg-subtle);
    }
    .source-badge.streaming {
      animation: none;
    }
  }
</style>
```

---

## Usage Updates

### ChatMessage.svelte (Static Mode)
```svelte
<!-- Before -->
<EnrichmentCard data={message.enrichmentData} source={message.enrichmentSource} />

<!-- After -->
<EnrichmentCard
  mode="static"
  data={message.enrichmentData}
  source={message.enrichmentSource}
/>
```

### AgentPanel.svelte (Streaming Mode)
```svelte
<!-- Before -->
{#if $agentEnriching || $agentEnrichmentStreamingChips}
  {#if $agentStreamingFields.size > 0}
    <EnrichmentCardStreaming />
  {:else if $agentEnriching}
    <EnrichmentSkeleton />
  {/if}
{/if}

<!-- After -->
{#if $agentEnriching || $agentEnrichmentStreamingChips}
  {#if $agentStreamingFields.size > 0}
    <EnrichmentCard
      mode="streaming"
      streamingFields={$agentStreamingFields}
      isStreaming={$agentEnriching}
    />
  {:else if $agentEnriching}
    <EnrichmentSkeleton />
  {/if}
{/if}
```

---

## Benefits

### 1. **Massive Code Reduction**
```
Before:
  EnrichmentCard.svelte:          168 lines
  EnrichmentCardStreaming.svelte: 355 lines
  Total:                          523 lines

After:
  EnrichmentCard.svelte (unified): 280 lines
  Reduction:                       243 lines (46% smaller!)
```

### 2. **Eliminated CSS Duplication**
```
Before: 68 lines × 2 = 136 lines of duplicate CSS
After:  68 lines (single source of truth)
Saved:  68 lines of CSS!
```

### 3. **Guaranteed Layout Consistency**
- Both modes share **exact same section ordering**
- Impossible for layouts to diverge
- Add a new section → automatically appears in both modes

### 4. **Single Source of Truth**
```svelte
<!-- Add a new section (e.g., "Awards") -->
<!-- BEFORE: Edit EnrichmentCard.svelte AND EnrichmentCardStreaming.svelte -->
<!-- AFTER:  Edit EnrichmentCard.svelte only -->

<section class="section">
  <h4 class="section-title">Awards</h4>
  {#if hasAwards}
    {#if mode === 'streaming'}
      <FieldTypewriter value={awards} />
    {:else}
      {awards}
    {/if}
  {:else if mode === 'streaming'}
    <div class="shimmer-container">...</div>
  {/if}
</section>
```

---

## Additional Optimization: Remove EnrichmentSkeleton.svelte

**Current:** You have 3 components:
- EnrichmentCard.svelte
- EnrichmentCardStreaming.svelte
- EnrichmentSkeleton.svelte (full skeleton while loading)

**After Unification:** Only need 1 component!
- Unified EnrichmentCard can show skeleton loaders for each section when `mode="streaming"` and field hasn't arrived yet

**Benefit:** Delete EnrichmentSkeleton.svelte entirely (save 90+ lines)

---

## Implementation Steps

1. **Create unified `EnrichmentCard.svelte`**
2. **Update `ChatMessage.svelte`** (use static mode)
3. **Update `AgentPanel.svelte`** (use streaming mode)
4. **Test both modes**
5. **Delete old components:**
   ```bash
   rm EnrichmentCard.svelte.old
   rm EnrichmentCardStreaming.svelte
   # Optionally: rm EnrichmentSkeleton.svelte (skeleton now built-in)
   ```
6. **Update `index.ts`**

**Estimated time:** 2 hours

---

## Migration Strategy (Low Risk)

Same as wine cards:

1. **Create unified component** alongside old ones
2. **Test thoroughly** with visual regression
3. **Switch ChatMessage** → test
4. **Switch AgentPanel** → test
5. **Delete old components**

---

## Summary Comparison

### Wine Cards
- Before: 601 lines (2 files)
- After: 350 lines (1 file)
- Reduction: **42%**

### Enrichment Cards
- Before: 523 lines (2 files, or 613 with skeleton)
- After: 280 lines (1 file with built-in skeleton)
- Reduction: **46% (or 54% if removing skeleton)**

### Combined Savings
- Before: 1,124+ lines (4+ files)
- After: 630 lines (2 files)
- **Total reduction: 494 lines (44%)**

---

## Recommendation

**Unify both wine cards AND enrichment cards** as a single batch:

1. **Day 1 Morning:** Unify WineCard (2 hours)
2. **Day 1 Afternoon:** Unify EnrichmentCard (2 hours)
3. **Day 1 End:** Test + visual regression (1 hour)

**Result:** 5 hours of work, 494 lines removed, zero duplication, guaranteed consistency.

This sets a **strong foundation** before tackling the Phase 1 AgentPanel refactor, and demonstrates the unification pattern we'll use throughout.

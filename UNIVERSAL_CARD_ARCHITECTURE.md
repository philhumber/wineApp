# Universal Card Architecture Proposal

**Goal:** Create a single card architecture that handles all states (skeleton, streaming, static) and can be reused for wine cards, enrichment cards, and future card types.

---

## Problem: Inconsistent State Models

### Current State
- **Wine Card:** 2 states (streaming, static)
- **Enrichment Card:** 3 states (skeleton, streaming, static)
- **Different architectures:** Hard to add new card types

### Desired State
- **Universal Card:** 3 states for all card types
- **Consistent API:** Same props, same behavior
- **Easy to extend:** New card types inherit the pattern

---

## Proposed Architecture

### Three-Tier System

```
Tier 1: DataCard.svelte (Abstract base component)
        ↓
Tier 2: WineCard.svelte, EnrichmentCard.svelte, FutureCard.svelte
        ↓
Tier 3: Field components (FieldTypewriter, ConfidenceIndicator, etc.)
```

---

## Tier 1: DataCard.svelte (Abstract Base)

**Purpose:** Generic card that handles skeleton/streaming/static states

```svelte
<!-- qve/src/lib/components/agent/DataCard.svelte -->
<script lang="ts">
  /**
   * DataCard (Abstract Base Component)
   *
   * Handles three states for any card type:
   * - skeleton: Full placeholder (no data yet)
   * - streaming: Progressive data arrival
   * - static: Complete data display
   *
   * Card types (wine, enrichment, etc.) provide section definitions
   * and field rendering logic.
   */
  import { createEventDispatcher } from 'svelte';
  import type { StreamingFieldState } from '$lib/stores/agent';
  import FieldTypewriter from './FieldTypewriter.svelte';

  const dispatch = createEventDispatcher();

  // ─────────────────────────────────────────────────────
  // PROPS
  // ─────────────────────────────────────────────────────

  /** Card state: skeleton | streaming | static */
  export let state: 'skeleton' | 'streaming' | 'static' = 'static';

  /** Static state: Complete data object */
  export let data: Record<string, any> | null = null;

  /** Streaming state: Map of field states */
  export let streamingFields: Map<string, StreamingFieldState> = new Map();

  /** Section definitions (provided by child components) */
  export let sections: CardSection[] = [];

  /** Optional header content */
  export let header: { title: string; badge?: string } | null = null;

  /** Optional CSS class for styling */
  export let cardClass: string = '';

  // ─────────────────────────────────────────────────────
  // TYPES
  // ─────────────────────────────────────────────────────

  interface CardSection {
    key: string;
    title: string;
    visible: (data: any, fields: Map<string, StreamingFieldState>) => boolean;
    render: (props: SectionRenderProps) => any; // Svelte component
    skeleton?: () => any; // Skeleton component (optional, defaults to shimmer bars)
  }

  interface SectionRenderProps {
    state: 'streaming' | 'static';
    data: any;
    streamingFields: Map<string, StreamingFieldState>;
    onFieldComplete?: (field: string) => void;
  }

  // ─────────────────────────────────────────────────────
  // FIELD ACCESSORS
  // ─────────────────────────────────────────────────────

  function getFieldValue(field: string): any {
    if (state === 'static') {
      return data?.[field] ?? null;
    } else if (state === 'streaming') {
      return streamingFields.get(field)?.value ?? null;
    }
    return null;
  }

  function hasField(field: string): boolean {
    if (state === 'skeleton') return false;
    if (state === 'static') {
      return data?.[field] !== null && data?.[field] !== undefined;
    }
    return streamingFields.has(field);
  }

  function isFieldTyping(field: string): boolean {
    if (state !== 'streaming') return false;
    return streamingFields.get(field)?.isTyping ?? false;
  }

  function handleFieldComplete(field: string) {
    dispatch('fieldComplete', { field });
  }

  // Build context object for sections
  $: sectionContext = {
    state: state === 'skeleton' ? 'streaming' : state,
    data,
    streamingFields,
    getFieldValue,
    hasField,
    isFieldTyping,
    onFieldComplete: handleFieldComplete
  };
</script>

<div class="data-card {cardClass}" class:skeleton={state === 'skeleton'}>
  <!-- Header (optional) -->
  {#if header}
    <div class="card-header">
      <span class="header-title">{header.title}</span>
      {#if header.badge}
        <span class="header-badge">{header.badge}</span>
      {/if}
    </div>
  {/if}

  <!-- Content -->
  <div class="card-content">
    {#each sections as section (section.key)}
      {#if state === 'skeleton'}
        <!-- Skeleton state: show placeholder for all sections -->
        <section class="section">
          <h4 class="section-title">{section.title}</h4>
          {#if section.skeleton}
            <svelte:component this={section.skeleton} />
          {:else}
            <!-- Default skeleton: 2-3 shimmer bars -->
            <div class="shimmer-container">
              <span class="shimmer-bar" style="width: 100%;"></span>
              <span class="shimmer-bar" style="width: 85%;"></span>
            </div>
          {/if}
        </section>
      {:else if section.visible(data, streamingFields)}
        <!-- Streaming/Static state: render actual content -->
        <section class="section">
          <h4 class="section-title">{section.title}</h4>
          <svelte:component
            this={section.render}
            {...sectionContext}
          />
        </section>
      {:else if state === 'streaming'}
        <!-- Streaming state with no data yet: show skeleton -->
        <section class="section">
          <h4 class="section-title">{section.title}</h4>
          {#if section.skeleton}
            <svelte:component this={section.skeleton} />
          {:else}
            <div class="shimmer-container">
              <span class="shimmer-bar" style="width: 100%;"></span>
              <span class="shimmer-bar" style="width: 85%;"></span>
            </div>
          {/if}
        </section>
      {/if}
    {/each}
  </div>
</div>

<style>
  .data-card {
    background: var(--surface);
    border-radius: var(--radius-lg);
    border: 1px solid var(--divider-subtle);
    animation: slideUp 0.3s var(--ease-out);
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

  .header-badge {
    font-size: 0.75rem;
    padding: var(--space-1) var(--space-2);
    background: var(--bg-subtle);
    border-radius: var(--radius-pill);
    color: var(--text-secondary);
  }

  .card-content {
    padding: var(--space-5);
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

  /* Default shimmer animations */
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

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .shimmer-bar {
      animation: none;
      background: var(--bg-subtle);
    }
  }
</style>
```

---

## Tier 2: WineCard.svelte (Using DataCard)

```svelte
<!-- qve/src/lib/components/agent/WineCard.svelte -->
<script lang="ts">
  /**
   * WineCard
   * Wine identification card using universal DataCard architecture
   */
  import DataCard from './DataCard.svelte';
  import type { AgentParsedWine } from '$lib/api/types';
  import type { StreamingFieldState } from '$lib/stores/agent';
  import { agent } from '$lib/stores';

  // Import section renderers
  import WineNameSection from './wine-sections/WineNameSection.svelte';
  import WineMetadataSection from './wine-sections/WineMetadataSection.svelte';
  import WineConfidenceSection from './wine-sections/WineConfidenceSection.svelte';
  import WineDetailsSection from './wine-sections/WineDetailsSection.svelte';

  // ─────────────────────────────────────────────────────
  // PROPS
  // ─────────────────────────────────────────────────────

  /** Card state */
  export let state: 'skeleton' | 'streaming' | 'static' = 'static';

  /** Static state: Parsed wine data */
  export let parsed: AgentParsedWine | null = null;

  /** Static state: Confidence score */
  export let confidence: number = 0;

  /** Streaming state: Field map */
  export let streamingFields: Map<string, StreamingFieldState> = new Map();

  // ─────────────────────────────────────────────────────
  // SECTION DEFINITIONS
  // ─────────────────────────────────────────────────────

  const sections = [
    {
      key: 'wine-name',
      title: '', // No title for this section
      visible: (data, fields) => {
        return state === 'skeleton' ||
               (state === 'static' && data?.wineName) ||
               (state === 'streaming' && (fields.has('wineName') || fields.has('producer')));
      },
      render: WineNameSection
    },
    {
      key: 'divider',
      title: '',
      visible: () => true,
      render: () => '<div class="wine-divider"></div>' // Just a divider
    },
    {
      key: 'metadata',
      title: '',
      visible: (data, fields) => {
        return state === 'skeleton' ||
               (state === 'static' && (data?.vintage || data?.region || data?.country)) ||
               (state === 'streaming' && (fields.has('vintage') || fields.has('region') || fields.has('country')));
      },
      render: WineMetadataSection
    },
    {
      key: 'confidence',
      title: '',
      visible: (data, fields) => {
        return state === 'skeleton' ||
               (state === 'static' && data?.confidence !== null) ||
               (state === 'streaming' && fields.has('confidence'));
      },
      render: WineConfidenceSection
    },
    {
      key: 'details',
      title: '',
      visible: (data, fields) => {
        return state === 'skeleton' ||
               (state === 'static' && (data?.wineType || data?.grapes)) ||
               (state === 'streaming' && (fields.has('wineType') || fields.has('grapes')));
      },
      render: WineDetailsSection
    }
  ];

  // Build data object for DataCard
  $: cardData = state === 'static' ? { ...parsed, confidence } : null;

  function handleFieldComplete(event: CustomEvent<{ field: string }>) {
    agent.markFieldTypingComplete(event.detail.field);
  }
</script>

<DataCard
  {state}
  data={cardData}
  {streamingFields}
  {sections}
  cardClass="wine-card"
  on:fieldComplete={handleFieldComplete}
/>

<style>
  /* Wine-specific overrides */
  :global(.wine-card) {
    /* Override default DataCard styles if needed */
  }

  :global(.wine-divider) {
    width: 40px;
    height: 1px;
    background: var(--accent);
    margin: var(--space-3) 0;
  }
</style>
```

---

## Tier 2: EnrichmentCard.svelte (Using DataCard)

```svelte
<!-- qve/src/lib/components/agent/enrichment/EnrichmentCard.svelte -->
<script lang="ts">
  /**
   * EnrichmentCard
   * Wine enrichment card using universal DataCard architecture
   */
  import DataCard from '../DataCard.svelte';
  import type { AgentEnrichmentData } from '$lib/api/types';
  import type { StreamingFieldState } from '$lib/stores/agent';

  // Import section renderers
  import OverviewSection from './sections/OverviewSection.svelte';
  import StyleProfileSection from './sections/StyleProfileSection.svelte';
  import GrapeCompositionSection from './sections/GrapeCompositionSection.svelte';
  import TastingNotesSection from './sections/TastingNotesSection.svelte';
  import PairingsSection from './sections/PairingsSection.svelte';
  import DrinkWindowSection from './sections/DrinkWindowSection.svelte';
  import CriticScoresSection from './sections/CriticScoresSection.svelte';

  // ─────────────────────────────────────────────────────
  // PROPS
  // ─────────────────────────────────────────────────────

  /** Card state */
  export let state: 'skeleton' | 'streaming' | 'static' = 'static';

  /** Static state: Complete enrichment data */
  export let data: AgentEnrichmentData | null = null;

  /** Static state: Data source */
  export let source: 'cache' | 'web_search' | 'inference' | undefined = undefined;

  /** Streaming state: Field map */
  export let streamingFields: Map<string, StreamingFieldState> = new Map();

  /** Streaming state: Is currently streaming */
  export let isStreaming: boolean = false;

  // ─────────────────────────────────────────────────────
  // SECTION DEFINITIONS
  // ─────────────────────────────────────────────────────

  const sections = [
    {
      key: 'overview',
      title: 'Overview',
      visible: (d, f) => state === 'skeleton' || d?.overview || f.has('overview') || f.has('description'),
      render: OverviewSection
    },
    {
      key: 'style',
      title: 'Style Profile',
      visible: (d, f) => state === 'skeleton' || d?.body || d?.tannin || d?.acidity || f.has('body') || f.has('tannin'),
      render: StyleProfileSection
    },
    {
      key: 'grapes',
      title: 'Grape Composition',
      visible: (d, f) => state === 'skeleton' || d?.grapeVarieties?.length || f.has('grapeVarieties') || f.has('grapes'),
      render: GrapeCompositionSection
    },
    {
      key: 'tasting',
      title: 'Tasting Notes',
      visible: (d, f) => state === 'skeleton' || d?.tastingNotes || f.has('tastingNotes'),
      render: TastingNotesSection
    },
    {
      key: 'pairings',
      title: 'Food Pairings',
      visible: (d, f) => state === 'skeleton' || d?.pairingNotes || f.has('pairingNotes') || f.has('pairings'),
      render: PairingsSection
    },
    {
      key: 'drink-window',
      title: 'Drink Window',
      visible: (d, f) => state === 'skeleton' || d?.drinkWindow || f.has('drinkWindow'),
      render: DrinkWindowSection
    },
    {
      key: 'critic-scores',
      title: 'Critic Scores',
      visible: (d, f) => state === 'skeleton' || d?.criticScores?.length || f.has('criticScores'),
      render: CriticScoresSection
    }
  ];

  // Header configuration
  $: header = {
    title: 'Wine Details',
    badge: state === 'static'
      ? (source === 'cache' ? 'Cached' : source === 'web_search' ? 'Web' : 'AI')
      : (isStreaming ? 'Researching...' : 'Research complete')
  };
</script>

<DataCard
  {state}
  {data}
  {streamingFields}
  {sections}
  {header}
  cardClass="enrichment-card"
/>

<style>
  /* Enrichment-specific overrides */
  :global(.enrichment-card) {
    background: var(--surface-raised);
  }

  :global(.enrichment-card.complete) {
    border: 1px solid var(--accent);
  }
</style>
```

---

## Usage Examples

### Wine Card - All States

```svelte
<!-- Skeleton state (initial loading) -->
<WineCard state="skeleton" />

<!-- Streaming state (fields arriving) -->
<WineCard state="streaming" streamingFields={$agentStreamingFields} />

<!-- Static state (complete data in history) -->
<WineCard state="static" parsed={wineData} confidence={92} />
```

### Enrichment Card - All States

```svelte
<!-- Skeleton state (EnrichmentSkeleton.svelte replacement) -->
<EnrichmentCard state="skeleton" />

<!-- Streaming state (fields arriving) -->
<EnrichmentCard
  state="streaming"
  streamingFields={$agentStreamingFields}
  isStreaming={true}
/>

<!-- Static state (complete data in history) -->
<EnrichmentCard
  state="static"
  data={enrichmentData}
  source="cache"
/>
```

---

## Benefits

### 1. **Consistent State Model**
```
All cards support:
├── skeleton: Initial placeholder
├── streaming: Progressive data arrival
└── static: Complete data display
```

### 2. **Easy to Add New Card Types**
```svelte
<!-- Future: CollectionCard -->
<script>
  import DataCard from './DataCard.svelte';

  const sections = [
    { key: 'summary', title: 'Summary', ... },
    { key: 'wines', title: 'Wines in Collection', ... },
    { key: 'value', title: 'Collection Value', ... }
  ];
</script>

<DataCard {state} {data} {streamingFields} {sections} />
```

**Result:** New card in ~50 lines instead of 400!

### 3. **Shared Infrastructure**
- Skeleton animations (DRY)
- State transitions (consistent)
- Field accessors (reusable)
- Error handling (centralized)

### 4. **Code Reduction**
```
Before (Current):
  WineIdentificationCard.svelte:     201 lines
  WineCardStreaming.svelte:          400 lines
  EnrichmentCard.svelte:             168 lines
  EnrichmentCardStreaming.svelte:    355 lines
  EnrichmentSkeleton.svelte:          90 lines
  Total:                           1,214 lines

After (Universal):
  DataCard.svelte (base):            250 lines
  WineCard.svelte:                   120 lines
  EnrichmentCard.svelte:             100 lines
  Section components (8):            600 lines (reusable!)
  Total:                           1,070 lines

Reduction:                           144 lines (12%)
But with MUCH better architecture!
```

### 5. **Testability**
```typescript
// Test DataCard with mock sections
test('DataCard handles skeleton state', () => {
  render(DataCard, { state: 'skeleton', sections: mockSections });
  expect(screen.getAllByClass('shimmer-bar')).toHaveLength(6);
});

// Test WineCard with all states
test('WineCard skeleton → streaming → static', async () => {
  const { rerender } = render(WineCard, { state: 'skeleton' });

  rerender({ state: 'streaming', streamingFields: mockFields });
  await waitFor(() => expect(screen.getByText('Château Margaux')).toBeVisible());

  rerender({ state: 'static', parsed: mockWine });
  expect(screen.queryByClass('shimmer-bar')).not.toBeInTheDocument();
});
```

---

## Migration Path

### Phase 1: Create DataCard Base (2 hours)
- Implement DataCard.svelte
- Create example section components
- Test with mock data

### Phase 2: Migrate WineCard (2 hours)
- Create section components (WineNameSection, etc.)
- Update WineCard to use DataCard
- Add skeleton state support
- Test all three states

### Phase 3: Migrate EnrichmentCard (2 hours)
- Create section components (OverviewSection, etc.)
- Update EnrichmentCard to use DataCard
- Delete EnrichmentSkeleton.svelte
- Test all three states

### Phase 4: Update Usage Sites (1 hour)
- Update AgentPanel (add skeleton state)
- Update ChatMessage (no changes needed)
- Visual regression tests

**Total:** 7 hours

---

## State Transitions with Universal Architecture

### Wine Card Flow
```
1. User submits → WineCard state="skeleton" (NEW!)
2. First field arrives → WineCard state="streaming"
3. Fields stream in → component updates reactively
4. Stream completes → chips appear below
5. User acts → agent.clearStreamingResult()
6. Card unmounts → WineCard state="static" added to history
```

### Enrichment Card Flow
```
1. Enrich triggered → EnrichmentCard state="skeleton"
2. First field arrives → EnrichmentCard state="streaming"
3. Fields stream in → component updates reactively
4. Stream completes → chips appear below
5. User acts → agent.clearEnrichmentStreamingResult()
6. Card unmounts → EnrichmentCard state="static" added to history
```

**Result:** Identical flow, consistent API!

---

## Comparison: Unified vs Universal

### Unified Approach (Previous Proposal)
```
✓ Single component per card type
✓ Handles static + streaming modes
✓ 42-46% code reduction
✗ Each card type duplicates base logic
✗ Wine card has 2 states, enrichment has 3 (inconsistent)
✗ Adding new card types = copy-paste pattern
```

### Universal Approach (This Proposal)
```
✓ Single DataCard base for ALL card types
✓ Consistent 3-state model (skeleton/streaming/static)
✓ Section-based composition (highly reusable)
✓ New card types in ~50 lines
✓ Shared skeleton animations, state management
✓ Better testability
~ More upfront complexity (DataCard abstraction)
~ Requires refactoring into section components
```

---

## Recommendation

**Use the Universal Architecture** because:

1. ✅ **Future-proof**: Easy to add new card types (CollectionCard, RegionCard, ProducerCard)
2. ✅ **Consistent**: All cards use same state model
3. ✅ **Maintainable**: Change DataCard → all cards benefit
4. ✅ **Testable**: Test DataCard once, cards inherit reliability
5. ✅ **Professional**: Industry-standard composition pattern

**Trade-off:** More initial work (7 hours vs 5 hours), but **massive long-term benefits**.

---

## Implementation Priority

### Option A: Universal First (Recommended)
```
Week 1: Build universal architecture (7 hours)
Week 2: Phase 1 AgentPanel refactor uses universal cards
Result: Clean foundation for all future work
```

### Option B: Unified First, Universal Later
```
Day 1: Quick unified components (5 hours)
Week 2: Phase 1 AgentPanel refactor
Week 3: Upgrade to universal architecture (4 hours)
Result: Faster initial win, but extra refactoring later
```

I recommend **Option A** - build it right the first time!

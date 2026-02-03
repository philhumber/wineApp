# Phase 1 Implementation Plan: AgentPanel Refactor
**Target:** Break AgentPanel.svelte (3,794 lines) into 8-10 focused components
**Timeline:** 2-3 days
**Risk Level:** Medium (requires careful testing, but can be done incrementally)

---

## Current Structure Analysis

### AgentPanel.svelte Breakdown (3,794 lines)
```
Lines 1-500:    Imports, reactive declarations, state variables
Lines 500-1800: Event handlers and helper functions
  - handleChipAction() (400+ lines) - Main action router
  - handleTextSubmit() (500+ lines) - Text input processing
  - handleImageSubmit() - Image input processing
  - Add-wine flow helpers (startRegionMatching, etc.)
Lines 1800-2900: More add-wine flow logic
  - submitAddWine()
  - handleTryOpus()
  - handleIncorrectResult()
Lines 2900-3500: Template section begins
  - Message rendering loop
  - Streaming card display
  - Typing indicator
Lines 3500-3794: Styles

Key Insight: ChatMessage.svelte already handles most message rendering!
AgentPanel is bloated because of massive chip action router and event handlers.
```

---

## Target Architecture

### After Refactoring
```
qve/src/lib/components/agent/
├── AgentPanel.svelte (200-300 lines)         ← REFACTORED
│   └── Container + state coordination only
│
├── flows/                                     ← NEW DIRECTORY
│   ├── IdentificationFlow.svelte (300 lines)
│   │   └── Handles identification logic, streaming, chip routing
│   ├── AddWineFlow.svelte (500 lines)
│   │   └── Handles add-wine phases, entity matching, bottle form
│   └── EnrichmentFlow.svelte (200 lines)
│       └── Handles enrichment logic, cache confirmation
│
├── conversation/                              ← NEW DIRECTORY
│   ├── ConversationContainer.svelte (200 lines)
│   │   └── Message list + scroll management
│   └── ChatMessage.svelte (existing)
│
├── input/                                     ← NEW DIRECTORY (rename existing CommandInput)
│   └── CommandInput.svelte (existing)
│
└── [existing components]
    ├── WineCardStreaming.svelte
    ├── EnrichmentCardStreaming.svelte
    ├── ActionChips.svelte
    ├── TypingIndicator.svelte
    └── [...]
```

---

## Step-by-Step Implementation

### Step 1: Create Test Harness (Day 1 - 2 hours)
**Goal:** Ensure we don't break anything

#### 1.1 Create Visual Regression Test
```bash
cd qve
npm install -D @playwright/test
```

Create `qve/tests/agent-panel.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Agent Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/qve/');
    // Open agent panel
    await page.click('[data-testid="agent-bubble"]');
  });

  test('shows greeting message on first open', async ({ page }) => {
    const greeting = page.locator('.chat-message.agent').first();
    await expect(greeting).toContainText(/Good morning|Good afternoon|Good evening/);
  });

  test('handles text identification', async ({ page }) => {
    await page.fill('input[placeholder*="Type wine"]', '2019 Château Margaux');
    await page.press('input[placeholder*="Type wine"]', 'Enter');

    // Wait for typing indicator
    await expect(page.locator('[data-testid="typing-indicator"]')).toBeVisible();

    // Wait for result (timeout 30s for API call)
    await expect(page.locator('[data-testid="wine-card"]')).toBeVisible({ timeout: 30000 });
  });

  test('streaming card appears and fills progressively', async ({ page }) => {
    await page.fill('input[placeholder*="Type wine"]', '2019 Penfolds Grange');
    await page.press('input[placeholder*="Type wine"]', 'Enter');

    // Wait for streaming card
    await expect(page.locator('[data-testid="wine-card-streaming"]')).toBeVisible();

    // Check that fields appear progressively
    await expect(page.locator('[data-field="producer"]')).toBeVisible();
    await expect(page.locator('[data-field="wineName"]')).toBeVisible();
  });

  test('handles "Correct" chip action', async ({ page }) => {
    // ... test chip interactions
  });

  test('handles add-wine flow', async ({ page }) => {
    // ... test complete add-wine flow
  });

  test('screenshot comparison', async ({ page }) => {
    await page.fill('input[placeholder*="Type wine"]', '2019 Opus One');
    await page.press('input[placeholder*="Type wine"]', 'Enter');
    await page.waitForSelector('[data-testid="wine-card"]', { timeout: 30000 });

    // Visual regression
    await expect(page).toHaveScreenshot('agent-panel-wine-result.png');
  });
});
```

#### 1.2 Add data-testid attributes to existing components
Update `AgentPanel.svelte`:
```svelte
<!-- Add testids for key elements -->
<div class="panel" data-testid="agent-panel">
  <!-- Typing indicator -->
  {#if isTyping}
    <TypingIndicator data-testid="typing-indicator" ... />
  {/if}

  <!-- Wine card -->
  {#if $agentStreamingFields.size > 0}
    <WineCardStreaming data-testid="wine-card-streaming" />
  {/if}
</div>
```

#### 1.3 Run baseline tests
```bash
npm run test:e2e
```

**Success Criteria:** All tests pass, screenshots captured

---

### Step 2: Extract ConversationContainer (Day 1 - 3 hours)
**Goal:** Separate message list rendering from event handling

#### 2.1 Create ConversationContainer.svelte
```svelte
<!-- qve/src/lib/components/agent/conversation/ConversationContainer.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy, tick } from 'svelte';
  import type { AgentMessage } from '$lib/stores';
  import ChatMessage from './ChatMessage.svelte';

  export let messages: AgentMessage[];
  export let isTyping: boolean = false;
  export let typingText: string = '';

  const dispatch = createEventDispatcher<{
    chipSelect: { action: string; data?: unknown };
    selectCandidate: { candidate: any };
    cancel: void;
  }>();

  let messageContainer: HTMLElement;
  let userScrolledUp = false;
  let messageElements: HTMLElement[] = [];
  let lastSeenMessageId: string | null = null;

  // Auto-scroll when new messages arrive
  $: {
    const lastMessage = messages[messages.length - 1];
    const lastId = lastMessage?.id ?? null;
    if (lastId && lastId !== lastSeenMessageId) {
      lastSeenMessageId = lastId;
      scrollToNewMessage();
    }
  }

  function handleScroll(e: Event) {
    const el = e.target as HTMLElement;
    const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 50;
    userScrolledUp = !isAtBottom;
  }

  async function scrollToNewMessage() {
    if (!userScrolledUp && messageContainer) {
      await tick();
      requestAnimationFrame(() => {
        const lastMessage = messageElements[messageElements.length - 1];
        if (lastMessage) {
          lastMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }

  function handleChipSelect(e: CustomEvent<{ action: string; data?: unknown }>) {
    dispatch('chipSelect', e.detail);
  }

  function handleCandidateSelect(e: CustomEvent<{ candidate: any }>) {
    dispatch('selectCandidate', e.detail);
  }

  function handleCancel() {
    dispatch('cancel');
  }
</script>

<div
  class="conversation-container"
  bind:this={messageContainer}
  on:scroll={handleScroll}
>
  {#if messages.length > 0}
    {#each messages as message, i (message.id)}
      <div bind:this={messageElements[i]} class="message-wrapper">
        <ChatMessage
          {message}
          isLatest={i === messages.length - 1}
          on:chipSelect={handleChipSelect}
          on:selectCandidate={handleCandidateSelect}
          on:formReady
          on:chipsReady
        />
      </div>
    {/each}
  {/if}

  {#if isTyping}
    <TypingIndicator
      text={typingText}
      showCancel={true}
      on:cancel={handleCancel}
    />
  {/if}
</div>

<style>
  .conversation-container {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .message-wrapper {
    display: contents;
  }
</style>
```

#### 2.2 Update AgentPanel to use ConversationContainer
```svelte
<!-- AgentPanel.svelte (line ~3400, in template section) -->
<script lang="ts">
  import ConversationContainer from './conversation/ConversationContainer.svelte';
  // ... other imports
</script>

<!-- Replace message rendering loop with: -->
<ConversationContainer
  messages={$agentMessages}
  isTyping={isTyping && $agentStreamingFields.size === 0}
  typingText={typingText}
  on:chipSelect={handleChipSelectFromMessage}
  on:selectCandidate={handleCandidateSelect}
  on:cancel={handleCancelIdentification}
/>
```

#### 2.3 Test
```bash
npm run dev
# Manually test: greeting, text input, result display, chip actions
npm run test:e2e
```

**Success Criteria:**
- All messages render correctly
- Scrolling works as before
- Visual regression tests pass

---

### Step 3: Extract IdentificationFlow (Day 1-2 - 4 hours)
**Goal:** Move identification logic out of AgentPanel

#### 3.1 Create IdentificationFlow.svelte
```svelte
<!-- qve/src/lib/components/agent/flows/IdentificationFlow.svelte -->
<script lang="ts">
  /**
   * IdentificationFlow
   * Handles wine identification: text/image input → streaming → result handling
   * Emits events for parent to handle phase transitions
   */
  import { createEventDispatcher } from 'svelte';
  import { agent, agentStreamingFields, agentStreamingChips, agentEnriching, agentEnrichmentStreamingChips } from '$lib/stores';
  import type { AgentIdentificationResult, AgentParsedWine, AgentCandidate } from '$lib/api/types';
  import WineCardStreaming from '../WineCardStreaming.svelte';
  import ActionChips from '../ActionChips.svelte';

  export let isStreaming: boolean = false;
  export let streamingFields: Map<string, any>;
  export let streamingChips: { content: string; chips: any[] } | null = null;

  const dispatch = createEventDispatcher<{
    identificationComplete: { result: AgentIdentificationResult; inputText: string };
    chipAction: { action: string; data?: unknown };
  }>();

  /**
   * Handle text identification (called from parent)
   */
  export async function identifyText(text: string, augmentationContext?: any) {
    try {
      let queryText = buildQueryText(text, augmentationContext);

      const result = await agent.identifyWithStreaming(queryText);

      if (result) {
        dispatch('identificationComplete', { result, inputText: text });
      }
    } catch (error) {
      console.error('Identification failed:', error);
      throw error;
    }
  }

  /**
   * Handle image identification (called from parent)
   */
  export async function identifyImage(file: File) {
    try {
      const result = await agent.identifyImageWithStreaming(file);

      if (result) {
        dispatch('identificationComplete', { result, inputText: '' });
      }
    } catch (error) {
      console.error('Image identification failed:', error);
      throw error;
    }
  }

  /**
   * Build augmented query text from context
   */
  function buildQueryText(text: string, context?: any): string {
    if (!context) return text;

    if (context.isCorrection) {
      // User said "Not Correct" - their correction takes priority
      const orig = context.originalResult?.parsed;
      if (orig) {
        const prevParts: string[] = [];
        if (orig.producer && orig.producer !== 'Unknown') prevParts.push(`producer: ${orig.producer}`);
        if (orig.wineName && orig.wineName !== 'Unknown Wine') prevParts.push(`wine: ${orig.wineName}`);
        const prevInfo = prevParts.length > 0 ? ` Previous (incorrect) search found: ${prevParts.join(', ')}.` : '';
        return `USER CORRECTION (prioritize this): ${text}.${prevInfo}`;
      }
    } else if (context.originalResult?.parsed) {
      // Augmentation - combine original result with new input
      const orig = context.originalResult.parsed;
      const parts: string[] = [];
      if (orig.producer) parts.push(`Producer: ${orig.producer}`);
      if (orig.wineName) parts.push(`Wine: ${orig.wineName}`);
      if (orig.vintage) parts.push(`Vintage: ${orig.vintage}`);
      parts.push(`Additional info: ${text}`);
      return parts.join('. ');
    }

    return text;
  }

  function handleChipAction(e: CustomEvent<{ action: string; data?: unknown }>) {
    dispatch('chipAction', e.detail);
  }
</script>

<!-- Streaming wine card -->
{#if $agentStreamingFields.size > 0 && !$agentEnriching && !$agentEnrichmentStreamingChips}
  <WineCardStreaming />

  <!-- Chips below streaming card -->
  {#if $agentStreamingChips}
    <div class="streaming-chips-container">
      <p class="streaming-chips-content">{$agentStreamingChips.content}</p>
      <ActionChips
        chips={$agentStreamingChips.chips}
        on:select={handleChipAction}
      />
    </div>
  {/if}
{/if}

<style>
  .streaming-chips-container {
    margin-top: var(--space-4);
    padding: var(--space-4);
    background: var(--surface-raised);
    border-radius: var(--radius-lg);
  }

  .streaming-chips-content {
    font-family: var(--font-serif);
    color: var(--text-secondary);
    margin-bottom: var(--space-3);
  }
</style>
```

#### 3.2 Update AgentPanel to use IdentificationFlow
```svelte
<!-- AgentPanel.svelte -->
<script lang="ts">
  import IdentificationFlow from './flows/IdentificationFlow.svelte';

  let identificationFlow: IdentificationFlow;

  async function handleTextSubmit(e: CustomEvent<{ text: string }>) {
    const text = e.detail.text.trim();
    if (!text) return;

    // Add user message
    agent.addMessage({ role: 'user', type: 'text', content: text });

    // Set phase
    agent.setPhase('identifying');
    agent.setTyping(true);

    try {
      // Delegate to IdentificationFlow
      await identificationFlow.identifyText(text, $agentAugmentationContext);
    } catch (error) {
      agent.setTyping(false);
      showErrorWithRetry($agentErrorMessage || 'Something went wrong.');
    }
  }

  function handleIdentificationComplete(e: CustomEvent<{ result: any; inputText: string }>) {
    agent.setTyping(false);

    // Handle result with existing logic
    const handled = handleIdentificationResult(e.detail.result, e.detail.inputText);
    if (!handled) {
      showErrorWithRetry('Could not identify wine.');
    }
  }

  function handleIdentificationChipAction(e: CustomEvent<{ action: string; data?: unknown }>) {
    // Route to existing chip handler
    handleChipAction(e);
  }
</script>

<!-- Template -->
<ConversationContainer ... />

<IdentificationFlow
  bind:this={identificationFlow}
  isStreaming={$agentIsStreaming}
  streamingFields={$agentStreamingFields}
  streamingChips={$agentStreamingChips}
  on:identificationComplete={handleIdentificationComplete}
  on:chipAction={handleIdentificationChipAction}
/>

<!-- ... rest of template -->
```

#### 3.3 Test
```bash
npm run dev
# Test text identification, image identification, streaming, chip actions
npm run test:e2e
```

**Success Criteria:**
- Text identification works
- Image identification works
- Streaming fields appear progressively
- Chips work after streaming completes
- Visual regression tests pass

---

### Step 4: Extract AddWineFlow (Day 2 - 5 hours)
**Goal:** Move add-wine logic out of AgentPanel

#### 4.1 Create AddWineFlow.svelte
```svelte
<!-- qve/src/lib/components/agent/flows/AddWineFlow.svelte -->
<script lang="ts">
  /**
   * AddWineFlow
   * Handles add-to-cellar flow: region/producer/wine matching → bottle form → enrichment
   */
  import { createEventDispatcher } from 'svelte';
  import { agent, agentAddState } from '$lib/stores';
  import type { AgentPhase, AgentAddState } from '$lib/stores';
  import type { Region, Producer, Wine, DuplicateMatch } from '$lib/api/types';
  import { api } from '$lib/api';
  import MatchSelectionList from '../MatchSelectionList.svelte';
  import BottleDetailsForm from '../BottleDetailsForm.svelte';

  export let phase: AgentPhase;
  export let addState: AgentAddState | null;

  const dispatch = createEventDispatcher<{
    regionMatched: { mode: 'search' | 'create'; entity?: Region };
    producerMatched: { mode: 'search' | 'create'; entity?: Producer };
    wineMatched: { mode: 'search' | 'create'; entity?: Wine };
    bottleComplete: { part: 1 | 2 };
    submitComplete: { success: boolean; wineId?: number };
    error: { message: string };
  }>();

  // Add-wine phases
  $: isAddPhase = phase.startsWith('add_');
  $: currentStep = phase.replace('add_', '') as 'region' | 'producer' | 'wine' | 'bottle_part1' | 'bottle_part2' | 'enrichment';

  /**
   * Start region matching
   */
  export async function startRegionMatching() {
    if (!addState?.regionData.regionName) {
      // Auto-create
      agent.setAddSelection('region', 'create');
      dispatch('regionMatched', { mode: 'create' });
      return;
    }

    try {
      const result = await api.checkDuplicate({
        type: 'region',
        name: addState.regionData.regionName
      });

      const matches = [
        ...(result.exactMatch ? [result.exactMatch] : []),
        ...(result.similarMatches || [])
      ];

      agent.setAddMatches('region', matches);

      if (matches.length === 0) {
        agent.setAddSelection('region', 'create');
        dispatch('regionMatched', { mode: 'create' });
      } else {
        // Show match selection (handled by parent)
        agent.addMessage({
          role: 'agent',
          type: 'match_selection',
          content: `I found some regions that might match "${addState.regionData.regionName}".`,
          matches,
          matchType: 'region'
        });
      }
    } catch (error) {
      dispatch('error', { message: 'Region matching failed' });
    }
  }

  /**
   * Start producer matching (similar to region)
   */
  export async function startProducerMatching() {
    // ... similar logic
  }

  /**
   * Start wine matching
   */
  export async function startWineMatching() {
    // ... similar logic
  }

  /**
   * Submit add wine
   */
  export async function submitAddWine(enrichNow: boolean) {
    // Validation
    const validationError = agent.validateAddState();
    if (validationError) {
      dispatch('error', { message: validationError });
      return;
    }

    try {
      // Build payload
      const payload = buildAddWinePayload(addState!);

      // Call API
      const result = await api.addWine(payload);

      if (result.success) {
        dispatch('submitComplete', { success: true, wineId: result.wineId });

        // Enrich if requested
        if (enrichNow && addState?.identified) {
          // ... trigger enrichment
        }
      } else {
        dispatch('error', { message: result.message || 'Failed to add wine' });
      }
    } catch (error) {
      dispatch('error', { message: 'Failed to add wine' });
    }
  }

  function buildAddWinePayload(state: AgentAddState): any {
    // ... existing payload building logic
  }
</script>

{#if isAddPhase}
  {#if currentStep === 'region' || currentStep === 'producer' || currentStep === 'wine'}
    <!-- Entity matching -->
    {#if addState?.matches[currentStep]?.length > 0}
      <MatchSelectionList
        matches={addState.matches[currentStep]}
        entityType={currentStep}
        on:select={(e) => {/* handle selection */}}
      />
    {/if}
  {:else if currentStep === 'bottle_part1' || currentStep === 'bottle_part2'}
    <!-- Bottle form -->
    <BottleDetailsForm
      part={addState?.bottleFormPart ?? 1}
      on:next={(e) => dispatch('bottleComplete', { part: 1 })}
      on:submit={(e) => dispatch('bottleComplete', { part: 2 })}
    />
  {/if}
{/if}
```

#### 4.2 Update AgentPanel to use AddWineFlow
```svelte
<!-- AgentPanel.svelte -->
<script lang="ts">
  import AddWineFlow from './flows/AddWineFlow.svelte';

  let addWineFlow: AddWineFlow;

  function handleAddRegionMatched(e: CustomEvent<{ mode: string; entity?: any }>) {
    // Handle region match complete
    advanceToNextStep('region');
  }

  function handleAddSubmitComplete(e: CustomEvent<{ success: boolean; wineId?: number }>) {
    // Show success message
    agent.addMessage({
      role: 'agent',
      type: 'add_complete',
      content: 'Wine added successfully!'
    });
    agent.setPhase('complete');
    agent.clearAddState();
  }
</script>

<!-- Template -->
<AddWineFlow
  bind:this={addWineFlow}
  phase={$agentPhase}
  addState={$agentAddState}
  on:regionMatched={handleAddRegionMatched}
  on:producerMatched={handleAddProducerMatched}
  on:wineMatched={handleAddWineMatched}
  on:bottleComplete={handleBottleComplete}
  on:submitComplete={handleAddSubmitComplete}
  on:error={handleAddError}
/>
```

#### 4.3 Test
```bash
npm run dev
# Test complete add-wine flow: identify → add → entity matching → bottle form → submit
npm run test:e2e
```

**Success Criteria:**
- Add-wine flow completes successfully
- Entity matching works (region/producer/wine)
- Bottle form works (part 1 and 2)
- Submission succeeds
- Visual regression tests pass

---

### Step 5: Extract EnrichmentFlow (Day 2 - 2 hours)
**Goal:** Move enrichment logic out of AgentPanel

#### 5.1 Create EnrichmentFlow.svelte
```svelte
<!-- qve/src/lib/components/agent/flows/EnrichmentFlow.svelte -->
<script lang="ts">
  /**
   * EnrichmentFlow
   * Handles wine enrichment: fetch data → stream → display
   */
  import { createEventDispatcher } from 'svelte';
  import { agent, agentStreamingFields, agentEnrichmentStreamingChips, agentEnriching } from '$lib/stores';
  import type { AgentParsedWine, AgentEnrichmentData } from '$lib/api/types';
  import { EnrichmentCardStreaming, EnrichmentSkeleton } from '../enrichment';
  import ActionChips from '../ActionChips.svelte';

  const dispatch = createEventDispatcher<{
    enrichmentComplete: { data: AgentEnrichmentData | null };
    cacheMatchConfirmation: { parsed: AgentParsedWine };
    chipAction: { action: string };
  }>();

  /**
   * Enrich wine with streaming
   */
  export async function enrichWine(parsed: AgentParsedWine, confirmMatch = false, forceRefresh = false) {
    try {
      await agent.enrichWineWithStreaming(parsed, confirmMatch, forceRefresh);

      // Check if pendingCacheMatch was set (needs confirmation)
      const state = get(agent);
      if (!state.pendingCacheMatch) {
        // Normal completion
        dispatch('enrichmentComplete', { data: state.enrichmentData });
      }
    } catch (error) {
      console.error('Enrichment failed:', error);
      throw error;
    }
  }

  function handleChipAction(e: CustomEvent<{ action: string }>) {
    dispatch('chipAction', e.detail);
  }
</script>

<!-- Enrichment streaming card or skeleton -->
{#if $agentEnriching || $agentEnrichmentStreamingChips}
  {#if $agentStreamingFields.size > 0}
    <EnrichmentCardStreaming />

    <!-- Chips below streaming card -->
    {#if $agentEnrichmentStreamingChips}
      <div class="streaming-chips-container">
        <p class="streaming-chips-content">{$agentEnrichmentStreamingChips.content}</p>
        <ActionChips
          chips={$agentEnrichmentStreamingChips.chips}
          on:select={handleChipAction}
        />
      </div>
    {/if}
  {:else if $agentEnriching}
    <EnrichmentSkeleton />
  {/if}
{/if}

<style>
  .streaming-chips-container {
    margin-top: var(--space-4);
    padding: var(--space-4);
    background: var(--surface-raised);
    border-radius: var(--radius-lg);
  }

  .streaming-chips-content {
    font-family: var(--font-serif);
    color: var(--text-secondary);
    margin-bottom: var(--space-3);
  }
</style>
```

#### 5.2 Update AgentPanel to use EnrichmentFlow
```svelte
<!-- AgentPanel.svelte -->
<script lang="ts">
  import EnrichmentFlow from './flows/EnrichmentFlow.svelte';

  let enrichmentFlow: EnrichmentFlow;

  async function handleEnrichNow() {
    const parsed = $agentParsed;
    if (!parsed) return;

    try {
      await enrichmentFlow.enrichWine(parsed);
    } catch (error) {
      showErrorWithRetry('Enrichment failed');
    }
  }

  function handleEnrichmentComplete(e: CustomEvent<{ data: any }>) {
    // Add enrichment message or transition phase
    agent.setPhase('action_select');
  }
</script>

<!-- Template -->
<EnrichmentFlow
  bind:this={enrichmentFlow}
  on:enrichmentComplete={handleEnrichmentComplete}
  on:cacheMatchConfirmation={handleCacheMatchConfirmation}
  on:chipAction={handleEnrichmentChipAction}
/>
```

#### 5.3 Test
```bash
npm run dev
# Test enrichment: identify wine → enrich → streaming → result display
npm run test:e2e
```

**Success Criteria:**
- Enrichment completes successfully
- Streaming card appears and fills progressively
- Cache match confirmation works (WIN-162)
- Visual regression tests pass

---

### Step 6: Refactor AgentPanel (Day 3 - 3 hours)
**Goal:** AgentPanel becomes a thin coordinator

#### 6.1 Simplify AgentPanel.svelte
After extracting all flow components, AgentPanel should look like:

```svelte
<!-- AgentPanel.svelte (target: 200-300 lines) -->
<script lang="ts">
  /**
   * AgentPanel
   * Coordinator for agent flows
   * Delegates to: IdentificationFlow, AddWineFlow, EnrichmentFlow
   */
  import { fly, fade } from 'svelte/transition';
  import { agent, agentPanelOpen, agentPhase, agentMessages } from '$lib/stores';
  import ConversationContainer from './conversation/ConversationContainer.svelte';
  import IdentificationFlow from './flows/IdentificationFlow.svelte';
  import AddWineFlow from './flows/AddWineFlow.svelte';
  import EnrichmentFlow from './flows/EnrichmentFlow.svelte';
  import CommandInput from './input/CommandInput.svelte';
  import { Icon } from '$lib/components';

  // Refs to flow components
  let identificationFlow: IdentificationFlow;
  let addWineFlow: AddWineFlow;
  let enrichmentFlow: EnrichmentFlow;

  // Reactive bindings
  $: isOpen = $agentPanelOpen;
  $: phase = $agentPhase;
  $: messages = $agentMessages;

  // Initialize conversation
  onMount(() => {
    if ($agentMessages.length === 0) {
      agent.startSession();
    }
  });

  // ─────────────────────────────────────────────────────
  // INPUT HANDLERS (delegate to flows)
  // ─────────────────────────────────────────────────────

  async function handleTextSubmit(e: CustomEvent<{ text: string }>) {
    const text = e.detail.text.trim();
    if (!text) return;

    agent.addMessage({ role: 'user', type: 'text', content: text });
    agent.setPhase('identifying');
    agent.setTyping(true);

    try {
      await identificationFlow.identifyText(text, $agentAugmentationContext);
    } catch (error) {
      agent.setTyping(false);
      showErrorWithRetry('Identification failed');
    }
  }

  async function handleImageSubmit(e: CustomEvent<{ file: File }>) {
    const file = e.detail.file;

    // Show image preview
    const { imageData, mimeType } = await api.compressImageForIdentification(file);
    const imageUrl = `data:${mimeType};base64,${imageData}`;
    agent.addMessage({ role: 'user', type: 'image_preview', content: 'Wine label image', imageUrl });

    agent.setPhase('identifying');
    agent.setTyping(true);

    try {
      await identificationFlow.identifyImage(file);
    } catch (error) {
      agent.setTyping(false);
      showErrorWithRetry('Image identification failed');
    }
  }

  // ─────────────────────────────────────────────────────
  // FLOW EVENT HANDLERS
  // ─────────────────────────────────────────────────────

  function handleIdentificationComplete(e: CustomEvent<{ result: any; inputText: string }>) {
    agent.setTyping(false);
    // Process result and show appropriate message/chips
    processIdentificationResult(e.detail.result);
  }

  function handleChipAction(e: CustomEvent<{ action: string; data?: unknown }>) {
    // Route chip actions to appropriate flow
    const action = e.detail.action;

    if (action === 'correct' || action === 'not_correct') {
      // Identification flow
      handleIdentificationChipAction(action);
    } else if (action.startsWith('add_')) {
      // Add-wine flow
      handleAddWineChipAction(action);
    } else if (action === 'enrich_now') {
      // Enrichment flow
      handleEnrichNow();
    } else {
      // ... other actions
    }
  }

  // ─────────────────────────────────────────────────────
  // HELPER FUNCTIONS
  // ─────────────────────────────────────────────────────

  function processIdentificationResult(result: any) {
    // Simplified result processing logic
    const confidence = result.confidence;

    if (confidence >= 85) {
      // High confidence - show result + "Correct/Not Correct"
      agent.setStreamingChips('Is this the wine you\'re seeking?', [
        { id: 'correct', label: 'Correct', icon: 'check', action: 'correct' },
        { id: 'not_correct', label: 'Not Correct', icon: 'x', action: 'not_correct' }
      ]);
      agent.setPhase('result_confirm');
    } else if (confidence >= 70) {
      // Medium confidence - ask for confirmation
      agent.setStreamingChips('Is this the right direction?', [
        { id: 'confirm_direction', label: 'Yes', icon: 'check', action: 'confirm_direction' },
        { id: 'wrong_direction', label: 'No', icon: 'x', action: 'wrong_direction' }
      ]);
      agent.setPhase('result_confirm');
    } else {
      // Low confidence - offer options
      agent.setStreamingChips('I couldn\'t identify this wine clearly.', [
        { id: 'not_correct', label: 'Try Again', icon: 'x', action: 'not_correct' }
      ]);
      agent.setPhase('result_confirm');
    }
  }

  function showErrorWithRetry(message: string) {
    agent.addMessage({
      role: 'agent',
      type: 'error',
      content: message,
      chips: [
        { id: 'retry', label: 'Try Again', icon: 'refresh', action: 'retry' },
        { id: 'start_over', label: 'Start Over', icon: 'refresh', action: 'start_over' }
      ]
    });
  }
</script>

<!-- Backdrop (mobile only) -->
{#if isOpen}
  <div class="backdrop" on:click={() => agent.closePanel()} transition:fade={{ duration: 200 }} />
{/if}

<!-- Panel -->
{#if isOpen}
  <div class="panel" transition:fly={{ y: 500, duration: 300, easing: cubicOut }}>
    <!-- Header -->
    <div class="panel-header">
      <div class="header-title">
        <Icon name="sparkle" size={20} />
        <h2>Sommelier</h2>
      </div>
      <button class="close-btn" on:click={() => agent.closePanel()}>
        <Icon name="x" size={20} />
      </button>
    </div>

    <!-- Conversation -->
    <ConversationContainer
      messages={$agentMessages}
      isTyping={$agentIsTyping && $agentStreamingFields.size === 0}
      typingText={typingText}
      on:chipSelect={handleChipAction}
      on:selectCandidate={handleCandidateSelect}
      on:cancel={handleCancelIdentification}
    />

    <!-- Flow Components -->
    <IdentificationFlow
      bind:this={identificationFlow}
      on:identificationComplete={handleIdentificationComplete}
      on:chipAction={handleChipAction}
    />

    <AddWineFlow
      bind:this={addWineFlow}
      phase={$agentPhase}
      addState={$agentAddState}
      on:regionMatched={handleAddRegionMatched}
      on:submitComplete={handleAddSubmitComplete}
      on:error={handleAddError}
    />

    <EnrichmentFlow
      bind:this={enrichmentFlow}
      on:enrichmentComplete={handleEnrichmentComplete}
      on:chipAction={handleChipAction}
    />

    <!-- Footer -->
    {#if $agentHasStarted}
      <div class="panel-footer">
        <button class="footer-action" on:click={handleStartOver}>
          <Icon name="refresh" size={14} />
          <span>Start over</span>
        </button>
      </div>
    {/if}

    <!-- Input -->
    <div class="panel-input">
      <CommandInput
        disabled={isLoading || isTyping}
        placeholder={inputPlaceholder}
        on:submit={handleTextSubmit}
        on:image={handleImageSubmit}
      />
    </div>
  </div>
{/if}

<style>
  /* ... existing styles (unchanged) ... */
</style>
```

**Result:** AgentPanel is now **~300 lines** instead of 3,794!

#### 6.2 Test final integration
```bash
npm run dev
# Test ALL flows: greeting → identify → add → enrich → complete
npm run test:e2e
```

**Success Criteria:**
- All flows work end-to-end
- No regressions in functionality
- Visual regression tests pass
- AgentPanel is < 400 lines

---

### Step 7: Documentation & Cleanup (Day 3 - 1 hour)

#### 7.1 Update AGENT_FLOW.md
Document the new architecture:

```markdown
## New Agent Panel Architecture (Refactored)

### Component Hierarchy
```
AgentPanel (coordinator, 300 lines)
├── ConversationContainer (message list + scroll, 200 lines)
│   └── ChatMessage (existing, 400 lines)
├── IdentificationFlow (identification logic, 300 lines)
├── AddWineFlow (add-wine logic, 500 lines)
└── EnrichmentFlow (enrichment logic, 200 lines)
```

### Flow Delegation
- **AgentPanel**: Thin coordinator, handles input → delegates to flows
- **IdentificationFlow**: Handles identifyText(), identifyImage(), streaming
- **AddWineFlow**: Handles entity matching, bottle form, submission
- **EnrichmentFlow**: Handles enrichment, cache confirmation
```

#### 7.2 Add inline documentation
Add JSDoc comments to each new component explaining:
- Purpose
- Inputs (props)
- Outputs (events)
- Example usage

#### 7.3 Create index.ts for flows
```typescript
// qve/src/lib/components/agent/flows/index.ts
export { default as IdentificationFlow } from './IdentificationFlow.svelte';
export { default as AddWineFlow } from './AddWineFlow.svelte';
export { default as EnrichmentFlow } from './EnrichmentFlow.svelte';
```

---

## Success Metrics

### Before Refactoring
- AgentPanel: **3,794 lines**
- Largest component: 3,794 lines
- Testability: Poor (requires mocking 10+ stores)
- New feature time: 2-3 days
- Bug fix time: 1-2 days

### After Refactoring
- AgentPanel: **~300 lines** (12x reduction!)
- Largest component: ~500 lines (AddWineFlow)
- Testability: Good (each flow is independently testable)
- New feature time: **1 day** (50% faster)
- Bug fix time: **1-2 hours** (80% faster)

---

## Risk Mitigation

### Risk 1: Breaking existing functionality
**Mitigation:**
- Visual regression tests BEFORE starting
- Test after EACH step (incremental refactor)
- Keep old AgentPanel.svelte.backup until fully tested

### Risk 2: Merge conflicts with other developers
**Mitigation:**
- Work on feature branch
- Communicate with team before starting
- Complete refactor in 2-3 days (minimize conflict window)

### Risk 3: Subtle bugs from state management changes
**Mitigation:**
- No changes to stores - only component reorganization
- Event-driven architecture preserves behavior
- Comprehensive manual testing

---

## Rollback Plan

If refactoring fails mid-way:

1. **Revert to backup:**
   ```bash
   git checkout HEAD -- qve/src/lib/components/agent/AgentPanel.svelte
   ```

2. **Keep new components for future use:**
   - ConversationContainer can be used later
   - Flow components are useful even if not integrated yet

3. **Staged rollout:**
   - Keep both old and new AgentPanel
   - Add feature flag to switch between them
   - Gradual migration

---

## Timeline Summary

| Day | Hours | Task | Outcome |
|-----|-------|------|---------|
| 1 | 2 | Create test harness | Visual regression tests passing |
| 1 | 3 | Extract ConversationContainer | Message rendering separated |
| 1-2 | 4 | Extract IdentificationFlow | Identification logic separated |
| 2 | 5 | Extract AddWineFlow | Add-wine logic separated |
| 2 | 2 | Extract EnrichmentFlow | Enrichment logic separated |
| 3 | 3 | Refactor AgentPanel | AgentPanel is thin coordinator |
| 3 | 1 | Documentation & cleanup | Code documented, ready for review |
| **Total** | **20 hours** | **2.5 days** | **Refactor complete** |

---

## Next Steps After Phase 1

Once Phase 1 is complete:
- **Phase 2**: Split agent store (see main report)
- **Phase 3**: Simplify phase model (see main report)
- **Phase 4**: Backend cleanup (see main report)
- **Phase 5**: Add comprehensive test suite (see main report)

---

## Questions & Answers

**Q: Why not rewrite from scratch?**
A: Incremental refactor is safer - we preserve all existing logic and can test after each step.

**Q: What if we find new issues during refactoring?**
A: Document them but don't fix unless critical. Stay focused on refactoring goal.

**Q: How do we handle the chip action router?**
A: Initially keep it in AgentPanel, then gradually move chip handling into each flow component.

**Q: Should we refactor ChatMessage.svelte too?**
A: Not in Phase 1 - it's already well-structured. Focus on AgentPanel first.

**Q: Can we do this incrementally over multiple PRs?**
A: Yes! Each extraction step (2-5) can be a separate PR. Start with ConversationContainer.

---

## Conclusion

Phase 1 is the **most impactful** refactoring we can do. Breaking AgentPanel from 3,794 lines to ~300 lines will:
- Make the code **12x more maintainable**
- **Enable testing** (each flow is independently testable)
- **Speed up development** (new features touch fewer files)
- **Reduce bugs** (clearer boundaries, less coupling)

The incremental approach with visual regression tests makes this **low-risk** despite the large scope.

**Recommended:** Start with Step 2 (ConversationContainer) as a proof-of-concept PR to validate the approach before committing to the full refactor.

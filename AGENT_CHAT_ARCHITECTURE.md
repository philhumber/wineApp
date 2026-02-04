# Agent Chat Architecture Proposal

**Date:** 2026-02-04
**Status:** Draft
**Problem:** Messages, chips, scrolling, and disabling are all manually managed in a 4,037-line monolith

---

## The Problem

Currently, AgentPanel.svelte handles:
- Message rendering (18 different types)
- Scroll management (manual `scrollIntoView` calls scattered throughout)
- Input state (disabled during certain phases)
- Chip disabling (tracks which chips are tapped)
- Message ordering (manual array management)
- Streaming state (special handling for streaming messages)

**Result:** Every new message type requires touching 5+ places. Scroll bugs are frequent. Disable logic is inconsistent.

---

## Proposed Architecture

### Layer Model

```
┌─────────────────────────────────────────────────────────┐
│  AgentChatContainer                                      │
│  (scroll, layout, global controls)                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │  MessageList                                       │  │
│  │  (message ordering, virtualization, animations)    │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  MessageWrapper                              │  │  │
│  │  │  (disabled state, scroll-to, transitions)    │  │  │
│  │  │  ┌─────────────────────────────────────┐    │  │  │
│  │  │  │  MessageContent                      │    │  │  │
│  │  │  │  (just renders: text/chips/card/etc) │    │  │  │
│  │  │  └─────────────────────────────────────┘    │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │  ... more messages ...                            │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  InputArea                                         │  │
│  │  (text box, submit, camera, disabled state)        │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

### 1. AgentChatContainer.svelte (~150 lines)

**Single Responsibility:** Manage the chat viewport and global controls

```svelte
<script lang="ts">
  import { MessageList, InputArea } from './conversation';
  import { agentMessages, agentPhase, resetConversation } from '$lib/stores/agent';

  let scrollContainer: HTMLElement;
  let shouldAutoScroll = true;

  // Scroll management - ONE place for all scroll logic
  function scrollToBottom(behavior: 'smooth' | 'instant' = 'smooth') {
    scrollContainer?.scrollTo({ top: scrollContainer.scrollHeight, behavior });
  }

  function scrollToMessage(messageId: string) {
    const el = scrollContainer?.querySelector(`[data-message-id="${messageId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  // Auto-scroll on new messages
  $: if ($agentMessages.length) {
    if (shouldAutoScroll) scrollToBottom();
  }

  // Detect user scroll (disable auto-scroll if user scrolled up)
  function handleScroll(e: Event) {
    const { scrollTop, scrollHeight, clientHeight } = e.target as HTMLElement;
    shouldAutoScroll = scrollHeight - scrollTop - clientHeight < 100;
  }
</script>

<div class="agent-chat-container">
  <header class="chat-header">
    <button on:click={resetConversation}>Start Over</button>
  </header>

  <div
    class="chat-viewport"
    bind:this={scrollContainer}
    on:scroll={handleScroll}
  >
    <MessageList
      messages={$agentMessages}
      on:scrollTo={(e) => scrollToMessage(e.detail.id)}
    />
  </div>

  <InputArea />
</div>
```

**What it handles:**
- ✅ Scroll container
- ✅ Auto-scroll on new messages
- ✅ User scroll detection
- ✅ Scroll-to-message API
- ✅ Global "Start Over" button
- ✅ Layout structure

**What it DOESN'T handle:**
- ❌ Message content rendering
- ❌ Chip disable state
- ❌ Input validation
- ❌ API calls

---

### 2. MessageList.svelte (~100 lines)

**Single Responsibility:** Render messages in order, handle transitions

```svelte
<script lang="ts">
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import MessageWrapper from './MessageWrapper.svelte';
  import type { AgentMessage } from '$lib/stores/agent';

  export let messages: AgentMessage[] = [];

  // Dispatch scroll events up to container
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
</script>

<div class="message-list">
  {#each messages as message (message.id)}
    <div
      animate:flip={{ duration: 200 }}
      in:fly={{ y: 20, duration: 300 }}
      data-message-id={message.id}
    >
      <MessageWrapper
        {message}
        on:scrollIntoView={() => dispatch('scrollTo', { id: message.id })}
      />
    </div>
  {/each}
</div>
```

**What it handles:**
- ✅ Message ordering (via Svelte's keyed each)
- ✅ Entry animations
- ✅ Reorder animations (flip)
- ✅ Message ID data attributes (for scroll targeting)

**What it DOESN'T handle:**
- ❌ Scroll management (delegated to container)
- ❌ Message content
- ❌ Disabled states

---

### 3. MessageWrapper.svelte (~80 lines)

**Single Responsibility:** Wrap any message with common behavior

```svelte
<script lang="ts">
  import MessageContent from './MessageContent.svelte';
  import type { AgentMessage } from '$lib/stores/agent';

  export let message: AgentMessage;

  // Computed states
  $: isDisabled = message.disabled ?? false;
  $: isNew = message.isNew ?? false;
  $: role = message.role ?? 'agent';
</script>

<div
  class="message-wrapper"
  class:disabled={isDisabled}
  class:is-new={isNew}
  class:user={role === 'user'}
  class:agent={role === 'agent'}
>
  <MessageContent {message} />
</div>

<style>
  .message-wrapper {
    padding: var(--space-sm);
    transition: opacity 0.2s;
  }

  .message-wrapper.disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .message-wrapper.is-new {
    animation: highlight 0.5s ease-out;
  }

  .message-wrapper.user {
    text-align: right;
  }
</style>
```

**What it handles:**
- ✅ Disabled state styling
- ✅ New message highlighting
- ✅ Role-based styling (user vs agent)
- ✅ Common padding/transitions

**What it DOESN'T handle:**
- ❌ What content to render (delegated to MessageContent)
- ❌ Scroll position
- ❌ Business logic

---

### 4. MessageContent.svelte (~150 lines)

**Single Responsibility:** Render the right component for the message type

```svelte
<script lang="ts">
  import type { AgentMessage } from '$lib/stores/agent';

  // Content components
  import TextMessage from './content/TextMessage.svelte';
  import ChipsMessage from './content/ChipsMessage.svelte';
  import WineCardMessage from './content/WineCardMessage.svelte';
  import EnrichmentMessage from './content/EnrichmentMessage.svelte';
  import FormMessage from './content/FormMessage.svelte';
  import StreamingMessage from './content/StreamingMessage.svelte';
  import ErrorMessage from './content/ErrorMessage.svelte';
  import ImagePreviewMessage from './content/ImagePreviewMessage.svelte';

  export let message: AgentMessage;

  // Map categories to components (not 18 types, but 8 categories)
  const componentMap = {
    text: TextMessage,
    chips: ChipsMessage,
    wine_result: WineCardMessage,
    enrichment: EnrichmentMessage,
    form: FormMessage,
    streaming: StreamingMessage,
    error: ErrorMessage,
    image: ImagePreviewMessage,
  };

  $: Component = componentMap[message.category] ?? TextMessage;
</script>

<svelte:component this={Component} {message} />
```

**What it handles:**
- ✅ Mapping message category → component
- ✅ Dynamic component rendering
- ✅ Fallback to TextMessage

**What it DOESN'T handle:**
- ❌ How each message type renders (delegated to content components)
- ❌ Disabled state (handled by wrapper)
- ❌ Animations (handled by list)

---

### 5. InputArea.svelte (~200 lines)

**Single Responsibility:** Manage user input

```svelte
<script lang="ts">
  import { agentPhase, submitText, submitImage } from '$lib/stores/agent';
  import { detectCommand } from '$lib/utils/commandDetector';

  let inputValue = '';
  let inputElement: HTMLTextAreaElement;

  // Input disabled during certain phases
  $: isDisabled = ['identifying', 'complete', 'confirm_new_search'].includes($agentPhase);

  // Dynamic placeholder based on phase
  $: placeholder = getPlaceholder($agentPhase);

  function getPlaceholder(phase: string): string {
    const placeholders: Record<string, string> = {
      greeting: 'Type wine name or take a photo...',
      identifying: 'Processing...',
      result_confirm: 'Or type to search again...',
      action_select: 'Or identify another wine...',
      // ... etc
    };
    return placeholders[phase] ?? 'Type a message...';
  }

  async function handleSubmit() {
    if (!inputValue.trim() || isDisabled) return;

    const command = detectCommand(inputValue);
    if (command) {
      // Handle command (start_over, cancel, etc.)
      handleCommand(command);
    } else {
      await submitText(inputValue);
    }
    inputValue = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }
</script>

<div class="input-area" class:disabled={isDisabled}>
  <textarea
    bind:this={inputElement}
    bind:value={inputValue}
    {placeholder}
    disabled={isDisabled}
    on:keydown={handleKeydown}
  />
  <button on:click={handleSubmit} disabled={isDisabled || !inputValue.trim()}>
    Send
  </button>
  <button on:click={() => /* camera logic */}>
    📷
  </button>
</div>
```

**What it handles:**
- ✅ Text input state
- ✅ Disabled states per phase
- ✅ Dynamic placeholders
- ✅ Command detection
- ✅ Submit logic
- ✅ Camera button

**What it DOESN'T handle:**
- ❌ Message rendering
- ❌ Scroll management
- ❌ API calls (delegated to store)

---

## Message Model Simplification

### Before: 18 Message Types

```typescript
type AgentMessageType =
  | 'greeting' | 'text' | 'divider' | 'chips' | 'image_preview'
  | 'wine_result' | 'wine_enrichment' | 'cache_match_confirm'
  | 'low_confidence' | 'partial_match' | 'disambiguation'
  | 'error' | 'coming_soon'
  | 'add_confirm' | 'match_selection' | 'match_confirmed'
  | 'existing_wine_choice' | 'manual_entry' | 'bottle_form'
  | 'enrichment_choice' | 'add_complete';
```

### After: 8 Message Categories

```typescript
type MessageCategory =
  | 'text'        // greeting, divider, coming_soon, low_confidence text
  | 'chips'       // any actionable chips (confirm, action_select, etc.)
  | 'wine_result' // wine card (identified wine)
  | 'enrichment'  // enrichment card
  | 'form'        // bottle_form, manual_entry, match_selection
  | 'streaming'   // any streaming content (wine or enrichment)
  | 'error'       // error messages
  | 'image';      // image preview

interface AgentMessage {
  id: string;
  category: MessageCategory;
  role: 'user' | 'agent';
  timestamp: number;
  disabled?: boolean;
  isNew?: boolean;

  // Category-specific data (discriminated union)
  data: MessageData;
}

// Each category has typed data
type MessageData =
  | { category: 'text'; content: string; variant?: 'greeting' | 'info' | 'warning'; }
  | { category: 'chips'; chips: AgentChip[]; }
  | { category: 'wine_result'; result: WineIdentificationResult; }
  | { category: 'enrichment'; data: EnrichmentData; }
  | { category: 'form'; formType: FormType; formData: any; onSubmit: (data: any) => void; }
  | { category: 'streaming'; streamingFields: Map<string, StreamingField>; }
  | { category: 'error'; error: AgentErrorInfo; }
  | { category: 'image'; src: string; mimeType: string; };
```

---

## Chips Simplification

### Before: Chips Are Special

```svelte
<!-- In AgentPanel, chips have special handling everywhere -->
{#if message.type === 'chips'}
  <ActionChips
    chips={message.chips}
    disabled={message.chipsDisabled}
    on:select={handleChipSelect}
  />
{:else if message.type === 'wine_result'}
  <!-- Wine result has its own chips -->
  <WineCard ...>
    <ActionChips chips={confirmChips} />
  </WineCard>
{:else if message.type === 'action_select'}
  <!-- Action select has different chips -->
  <ActionChips chips={actionChips} />
{/if}
```

### After: Chips Are Just Messages

```svelte
<!-- ChipsMessage.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AgentChip } from '$lib/stores/agent';

  export let message: { category: 'chips'; data: { chips: AgentChip[] } };

  const dispatch = createEventDispatcher();

  function handleChipClick(chip: AgentChip) {
    // Disable this message's chips after selection
    message.disabled = true;
    dispatch('action', { action: chip.action, payload: chip.payload });
  }
</script>

<div class="chips-container">
  {#each message.data.chips as chip}
    <button
      class="chip"
      class:primary={chip.variant === 'primary'}
      disabled={message.disabled}
      on:click={() => handleChipClick(chip)}
    >
      {chip.label}
    </button>
  {/each}
</div>
```

**Key insight:** When a chip is tapped:
1. The chip message marks itself disabled
2. An action is dispatched (handled by store)
3. A new message is added (response to chip)

The chip doesn't need to know what happens next — it just fires an action.

---

## Scroll Management Consolidation

### Before: Scattered scrollIntoView Calls

```svelte
<!-- AgentPanel.svelte - scroll logic scattered everywhere -->
function addMessage(message) {
  messages = [...messages, message];
  tick().then(() => {
    messageContainer?.querySelector('.message:last-child')?.scrollIntoView();
  });
}

function handleStreamingField() {
  // Different scroll for streaming
  tick().then(() => {
    streamingCard?.scrollIntoView({ block: 'end' });
  });
}

function handleEnrichment() {
  // Yet another scroll approach
  setTimeout(() => {
    enrichmentCard?.scrollIntoView({ behavior: 'smooth' });
  }, 100);
}
```

### After: Single Scroll Authority

```svelte
<!-- AgentChatContainer.svelte - ONE place for scroll -->
<script>
  import { agentMessages, agentStreamingMessage } from '$lib/stores/agent';

  let scrollContainer: HTMLElement;
  let shouldAutoScroll = true;

  // Single scroll function
  function scrollToBottom() {
    scrollContainer?.scrollTo({
      top: scrollContainer.scrollHeight,
      behavior: shouldAutoScroll ? 'smooth' : 'instant'
    });
  }

  // React to new messages
  $: if ($agentMessages.length) scrollToBottom();

  // React to streaming updates (debounced)
  let scrollTimeout: number;
  $: if ($agentStreamingMessage) {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(scrollToBottom, 50);
  }
</script>
```

**No component inside the container manages scroll.** They can dispatch a `scrollIntoView` event, but the container decides when/how to scroll.

---

## Disabled State Consolidation

### Before: Disabled Logic Everywhere

```svelte
<!-- AgentPanel.svelte - disabled checks scattered -->
{#if message.type === 'chips'}
  <ActionChips
    disabled={message.chipsDisabled || $agentLoading || $agentPhase === 'identifying'}
  />
{/if}

{#if message.type === 'bottle_form'}
  <BottleForm
    disabled={$agentPhase === 'complete' || formSubmitted}
  />
{/if}

<!-- And in InputArea -->
<input disabled={
  $agentPhase === 'identifying' ||
  $agentPhase === 'complete' ||
  $agentPhase === 'confirm_new_search'
} />
```

### After: Disabled State on Message

```typescript
// When adding a message, compute disabled state ONCE
function addMessage(message: Omit<AgentMessage, 'disabled'>): AgentMessage {
  return {
    ...message,
    disabled: false, // Messages start enabled
  };
}

// When phase changes, disable previous interactive messages
function setPhase(newPhase: AgentPhase) {
  // Disable all chips/forms from previous phase
  messages = messages.map(m =>
    m.category === 'chips' || m.category === 'form'
      ? { ...m, disabled: true }
      : m
  );

  phase = newPhase;
}

// When chip is tapped, disable just that message
function handleChipAction(messageId: string, action: string) {
  messages = messages.map(m =>
    m.id === messageId ? { ...m, disabled: true } : m
  );

  // Process the action...
}
```

**MessageWrapper applies the disabled style. Content components don't need to know.**

---

## Directory Structure

```
qve/src/lib/components/agent/
├── AgentPanel.svelte          # Reduced to layout only (~100 lines)
├── AgentBubble.svelte         # FAB to open panel (existing)
│
├── conversation/              # NEW: Chat architecture
│   ├── AgentChatContainer.svelte   # Scroll, layout, global controls
│   ├── MessageList.svelte          # Message ordering, animations
│   ├── MessageWrapper.svelte       # Disabled state, common styling
│   ├── MessageContent.svelte       # Category → component mapping
│   ├── InputArea.svelte            # Text input, camera, submit
│   └── index.ts
│
├── content/                   # NEW: Message content components
│   ├── TextMessage.svelte
│   ├── ChipsMessage.svelte
│   ├── WineCardMessage.svelte
│   ├── EnrichmentMessage.svelte
│   ├── FormMessage.svelte
│   ├── StreamingMessage.svelte
│   ├── ErrorMessage.svelte
│   ├── ImagePreviewMessage.svelte
│   └── index.ts
│
├── forms/                     # Existing form components
│   ├── BottleDetailsForm.svelte
│   ├── ManualEntryForm.svelte
│   └── MatchSelectionList.svelte
│
├── cards/                     # Existing card components
│   ├── WineCard.svelte
│   ├── EnrichmentCard.svelte
│   └── DataCard.svelte
│
└── index.ts
```

---

## Migration Path

### Step 1: Create Container Structure (Day 1)

1. Create `conversation/AgentChatContainer.svelte`
2. Create `conversation/MessageList.svelte`
3. Create `conversation/MessageWrapper.svelte`
4. Create `conversation/InputArea.svelte`

### Step 2: Create Content Components (Day 1-2)

1. Create `content/TextMessage.svelte` (extract from AgentPanel)
2. Create `content/ChipsMessage.svelte` (extract ActionChips usage)
3. Create `content/WineCardMessage.svelte` (wrapper around WineCard)
4. Create `content/StreamingMessage.svelte` (consolidate streaming)

### Step 3: Simplify Message Model (Day 2)

1. Define new `MessageCategory` type
2. Create migration function for old messages
3. Update `agent.ts` store

### Step 4: Wire Up AgentPanel (Day 3)

1. Replace AgentPanel internals with `<AgentChatContainer>`
2. Move remaining logic to appropriate components
3. Delete dead code

### Step 5: Test & Polish (Day 4)

1. Visual regression tests
2. Scroll behavior verification
3. Disabled state verification
4. Clean up old code

---

## Benefits

| Aspect | Before | After |
|--------|--------|-------|
| **Scroll logic** | 5+ places | 1 place |
| **Disabled logic** | Every message type | MessageWrapper |
| **New message type** | Touch AgentPanel | Add content component |
| **AgentPanel size** | 4,037 lines | ~100 lines |
| **Message types** | 18 | 8 categories |
| **Testability** | Impossible | Component-level tests |

---

## Example: Adding a New Message Type

### Before (touch AgentPanel.svelte + 5 other places)

```svelte
<!-- Add to the giant if/else chain -->
{:else if message.type === 'new_feature'}
  <div class="new-feature-message">
    <!-- 50 lines of new feature rendering -->
  </div>
{/if}

<!-- Add scroll handling -->
function handleNewFeature() {
  // Custom scroll logic
}

<!-- Add disabled logic -->
$: newFeatureDisabled = $agentPhase === 'something';
```

### After (create one component)

```svelte
<!-- content/NewFeatureMessage.svelte -->
<script lang="ts">
  export let message: { category: 'new_feature'; data: NewFeatureData };
</script>

<div class="new-feature">
  {message.data.content}
</div>
```

```typescript
// MessageContent.svelte - add one line
const componentMap = {
  // ... existing
  new_feature: NewFeatureMessage,
};
```

**Done.** Scroll, disabled state, animations all handled by the wrapper layers.

---

## Design Decisions

### 1. Streaming: Flag, Not Category ✅

Streaming is a **flag on any message**, not a separate category.

```typescript
interface AgentMessage {
  id: string;
  category: MessageCategory;  // 'wine_result', 'enrichment', etc.
  data: MessageData;

  // Streaming state (optional, applies to any category)
  isStreaming?: boolean;
  streamingFields?: Map<string, { value: string; isTyping: boolean }>;
}
```

**Why:** The current approach created duplicate components (WineCard + WineCardStreaming = 527 lines). With streaming as a flag:
- ONE card component handles both states
- No flashing when switching from streaming → complete
- Delete WineCardStreaming.svelte (399 lines)
- Delete EnrichmentCardStreaming.svelte

**How cards handle it:**
```svelte
<!-- WineCard.svelte - handles both streaming and static -->
{#if message.isStreaming && message.streamingFields?.has('wineName')}
  <FieldTypewriter field={message.streamingFields.get('wineName')} />
{:else}
  {message.data.wineName}
{/if}
```

---

### 2. Form Submission: Command Pattern ✅

Forms emit **typed commands**, a central handler routes to stores.

```typescript
// All possible actions (typed, serializable)
type AgentAction =
  | { type: 'submit_text'; payload: string }
  | { type: 'submit_image'; payload: { data: string; mimeType: string } }
  | { type: 'chip_tap'; payload: { action: string; data?: any } }
  | { type: 'submit_bottle'; payload: BottleFormData }
  | { type: 'select_match'; payload: { entityType: string; matchId: number } }
  | { type: 'create_new'; payload: { entityType: string; name: string } }
  | { type: 'manual_entry_submit'; payload: ManualEntryData };
```

**Forms don't import stores:**
```svelte
<!-- BottleDetailsForm.svelte -->
<script>
  const dispatch = createEventDispatcher<{ action: AgentAction }>();

  function handleSubmit() {
    dispatch('action', { type: 'submit_bottle', payload: formData });
  }
</script>
```

**Central action handler:**
```typescript
// stores/agentActions.ts
export function handleAgentAction(action: AgentAction) {
  switch (action.type) {
    case 'submit_text':
      agentIdentification.identifyText(action.payload);
      break;
    case 'chip_tap':
      handleChipAction(action.payload);
      break;
    case 'submit_bottle':
      agentAddWine.submitBottle(action.payload);
      break;
    // ...
  }
}
```

**Why:**
- Forms/chips are decoupled from stores (testable)
- All actions flow through one place (loggable, debuggable)
- Actions are serializable (undo/redo possible)
- Easy to extend: add action type + case

---

### 3. Chips: Separate Messages ✅

Cards are **pure display**. Chips are **pure action**. Never embedded.

**Before (embedded):**
```
┌───────────────────────────┐
│  WineCard                 │
│  Château Margaux 2018     │
│  [Correct] [Not Correct]  │  ← chips inside
└───────────────────────────┘
```

**After (separated):**
```
┌───────────────────────────┐
│  WineCard (message 1)     │
│  Château Margaux 2018     │
└───────────────────────────┘
┌───────────────────────────┐
│  Chips (message 2)        │
│  [Correct] [Not Correct]  │
└───────────────────────────┘
```

**Implementation:**
```typescript
// After identification
agentConversation.addMessage({
  category: 'wine_result',
  data: identificationResult,
});

agentConversation.addMessage({
  category: 'chips',
  data: {
    chips: [
      { label: 'Correct', action: 'correct', variant: 'primary' },
      { label: 'Not Correct', action: 'not_correct' },
    ]
  }
});
```

**Why:**
- Disable chips without touching cards
- Replace chips easily (confirm → action → enrichment)
- Cards reusable across app (cellar, history, etc.)
- Clear message history

---

## Additional Improvements

### 4. Agent Speech Registry ✅

Centralize all agent messages in one file for easy editing and future i18n.

```typescript
// lib/agent/messages.ts
export const agentMessages = {
  greeting: {
    morning: "Good morning! I'm your wine sommelier.",
    afternoon: "Good afternoon! Ready to explore some wines?",
    evening: "Good evening! Let's find the perfect wine.",
  },

  identification: {
    thinking: "Let me identify that wine...",
    found: (wine: string) => `I found **${wine}**. Is this correct?`,
    notFound: "I couldn't identify that wine. Can you tell me more?",
    lowConfidence: "I'm not entirely sure, but this might be it.",
    escalating: "Let me take a closer look...",
  },

  confirm: {
    correct: "Great! What would you like to do next?",
    incorrect: "No problem. What did I get wrong?",
  },

  addFlow: {
    duplicateFound: (wine: string, count: number) =>
      `I found **${wine}** already in your cellar with ${count} bottle${count > 1 ? 's' : ''}.`,
    addComplete: (wine: string) => `Added **${wine}** to your cellar!`,
  },

  errors: {
    timeout: "Our sommelier is taking longer than expected...",
    rateLimit: "Our sommelier is quite busy. Please wait a moment.",
    generic: "Something went wrong. Please try again.",
  },

  chips: {
    correct: "Correct",
    notCorrect: "Not Correct",
    addToCellar: "Add to Cellar",
    learnMore: "Learn More",
    tryAgain: "Try Again",
    startOver: "Start Over",
  },
} as const;

// Helper with interpolation
export function getMessage(path: string, params?: Record<string, any>): string {
  const message = path.split('.').reduce((obj, key) => obj?.[key], agentMessages);
  if (typeof message === 'function') return message(...Object.values(params ?? {}));
  return message ?? path;
}
```

**Benefits:**
- Edit agent personality in ONE file
- Find all messages with grep
- i18n-ready (swap the object)
- Consistent tone across app

---

### 5. Loading States Registry ✅

Centralize loading state configuration:

```typescript
// lib/agent/loadingStates.ts
export const loadingStates = {
  identifying: {
    message: () => getMessage('identification.thinking'),
    icon: 'search',
    timeout: 30000,
  },
  enriching: {
    message: () => getMessage('enrichment.loading'),
    icon: 'book',
    timeout: 20000,
  },
  addingWine: {
    message: 'Adding to cellar...',
    icon: 'plus',
    timeout: 10000,
  },
} as const;

export type LoadingStateKey = keyof typeof loadingStates;
```

**Usage:**
```svelte
<script>
  import { loadingStates } from '$lib/agent/loadingStates';
  export let state: LoadingStateKey;
  $: config = loadingStates[state];
</script>

<div class="loading">
  <Icon name={config.icon} />
  <span>{config.message()}</span>
</div>
```

---

### 6. Directory Structure (Updated)

```
qve/src/lib/
├── agent/                     # NEW: Agent configuration
│   ├── messages.ts            # All agent speech
│   ├── loadingStates.ts       # Loading configurations
│   ├── actions.ts             # AgentAction types + handler
│   └── index.ts
│
├── components/agent/
│   ├── AgentPanel.svelte      # Reduced to ~100 lines
│   ├── conversation/          # Chat architecture
│   ├── content/               # Message content components
│   ├── forms/                 # Form components
│   └── cards/                 # Card components
│
├── stores/
│   ├── agentIdentification.ts # Identification state
│   ├── agentEnrichment.ts     # Enrichment state
│   ├── agentConversation.ts   # Messages, phase
│   └── agentAddWine.ts        # Add-to-cellar flow
```

---

## Conclusion

This architecture provides:

1. **Single responsibility** — Each layer does one thing
2. **Content agnosticism** — MessageWrapper doesn't care what's inside
3. **Centralized scroll** — One place to debug scroll issues
4. **Centralized disabled state** — One pattern for all messages
5. **Centralized speech** — One file for all agent messages
6. **Command pattern** — All actions flow through one handler
5. **Easy extension** — New message types = new content component
6. **Testability** — Each component can be tested in isolation

**Estimated effort:** 4-5 days to migrate existing code to this architecture.

This should be done AS PART OF the AgentPanel refactoring, not separately.

# Phase 2: Agent Rearchitecture Plan

**Status**: Planning
**Created**: 2026-02-05
**Last Updated**: 2026-02-05
**Prerequisites**: Phase 1 complete (store split, action handler, 422 tests passing)

---

## Executive Summary

Phase 1 delivered a functional agent rearchitecture with clean store separation and comprehensive test coverage. Phase 2 addresses architectural debt identified in the deep dive review, focusing on:

1. **Handler Decomposition** - Split 2,831-line monolith into feature modules
2. **State Machine** - Enforce valid phase transitions
3. **Middleware System** - Centralize cross-cutting concerns
4. **Message Registry** - Type-safe message and chip definitions
5. **Test Expansion** - Integration tests and error scenarios

---

## 1. Handler Decomposition

### Problem

`handleAgentAction.ts` is 2,831 lines with:
- 40+ action cases in one function
- 5-7 levels of nested conditionals
- Module-level state (`lastAction`, `pendingBriefSearch`)
- Duplicated error handling patterns
- No reusable abstractions

### Solution: Feature-Based Modules

```
qve/src/lib/agent/
├── handleAgentAction.ts      # Slim router (~150 lines)
├── types.ts                  # Existing
├── messages.ts               # Existing
│
├── handlers/
│   ├── index.ts              # Barrel export
│   ├── identification.ts     # Text/image/Opus identification
│   ├── enrichment.ts         # Wine enrichment flow
│   ├── addWine.ts            # Add to cellar, entity matching
│   ├── conversation.ts       # Navigation, phase changes
│   └── forms.ts              # Bottle, manual entry forms
│
├── middleware/
│   ├── index.ts
│   ├── errorHandler.ts       # Unified error handling
│   ├── retryTracker.ts       # Action history for retry
│   └── validator.ts          # Pre-action validation
│
└── services/
    ├── resultAnalyzer.ts     # Quality analysis, confidence checks
    ├── chipGenerator.ts      # Context-aware chip generation
    └── messageBuilder.ts     # Multi-message sequences
```

### Handler Interface

```typescript
// handlers/types.ts
export type ActionHandler<T extends AgentAction = AgentAction> = (
  action: T
) => Promise<void>;

export interface HandlerModule {
  actions: string[];  // Action types this module handles
  handle: ActionHandler;
}
```

### Router Implementation

```typescript
// handleAgentAction.ts (~150 lines)
import * as identification from './handlers/identification';
import * as enrichment from './handlers/enrichment';
import * as addWine from './handlers/addWine';
import * as conversation from './handlers/conversation';
import * as forms from './handlers/forms';
import { withErrorHandling, withRetryTracking, withValidation } from './middleware';

// Action → Handler mapping
const actionHandlers: Record<string, ActionHandler> = {
  // Identification
  submit_text: identification.handleSubmitText,
  submit_image: identification.handleSubmitImage,
  try_opus: identification.handleTryOpus,
  reidentify: identification.handleReidentify,

  // Enrichment
  enrich_now: enrichment.handleEnrichNow,
  remember: enrichment.handleRemember,
  recommend: enrichment.handleRecommend,

  // Add Wine
  add_to_cellar: addWine.handleAddToCellar,
  add_bottle_existing: addWine.handleAddBottleExisting,
  create_new_wine: addWine.handleCreateNewWine,
  select_match: addWine.handleSelectMatch,
  add_new: addWine.handleAddNew,

  // Conversation
  start_over: conversation.handleStartOver,
  go_back: conversation.handleGoBack,
  cancel: conversation.handleCancel,
  retry: conversation.handleRetry,
  correct: conversation.handleCorrect,
  not_correct: conversation.handleNotCorrect,

  // Forms
  submit_bottle: forms.handleSubmitBottle,
  bottle_next: forms.handleBottleNext,
  manual_entry_submit: forms.handleManualEntrySubmit,
};

export async function handleAgentAction(action: AgentAction): Promise<void> {
  const handler = actionHandlers[action.type];

  if (!handler) {
    console.warn(`[AgentAction] Unknown action type: ${action.type}`);
    return;
  }

  // Compose middleware chain
  const pipeline = withErrorHandling(
    withRetryTracking(
      withValidation(handler)
    )
  );

  await pipeline(action);
}
```

### Example Handler Module

```typescript
// handlers/identification.ts (~400 lines)
import * as conversation from '$lib/stores/agentConversation';
import * as identification from '$lib/stores/agentIdentification';
import { api } from '$lib/api';
import { analyzeResult, generateIdentificationChips } from '../services';
import type { SubmitTextAction, SubmitImageAction } from '../types';

export async function handleSubmitText(action: SubmitTextAction): Promise<void> {
  const { text } = action.payload;

  // Add user message
  conversation.addMessage(
    conversation.createTextMessage(text, { role: 'user' })
  );

  // Start identification
  conversation.setPhase('identifying');
  identification.startIdentification('text');

  // Call API with streaming
  const result = await api.identifyTextStream(text, {
    onField: (field, value) => {
      identification.updateStreamingField(field, value);
    },
    onComplete: (fullResult) => {
      identification.setResult(fullResult);
    },
  });

  // Analyze result quality
  const analysis = analyzeResult(result);

  // Generate appropriate response
  if (analysis.isHighConfidence) {
    conversation.setPhase('result_confirm');
    conversation.addMessages([
      conversation.createTextMessage(getMessage('identification.found')),
      conversation.createMessage('wine_result', { result }),
      conversation.createChipsMessage(generateIdentificationChips(analysis)),
    ]);
  } else if (analysis.needsMoreInfo) {
    conversation.setPhase('augment_input');
    conversation.addMessages([
      conversation.createTextMessage(getMessage('identification.needsMore')),
      conversation.createChipsMessage([
        { id: 'provide_more', label: 'Add Details', action: 'provide_more' },
        { id: 'use_anyway', label: 'Use This Result', action: 'continue_as_is' },
      ]),
    ]);
  }
}

export async function handleSubmitImage(action: SubmitImageAction): Promise<void> {
  // Similar structure...
}

export async function handleTryOpus(action: TryOpusAction): Promise<void> {
  // Escalation to premium model...
}
```

### Migration Strategy

1. **Create handler shells** - Empty modules with action type mapping
2. **Extract one module at a time** - Start with simplest (conversation)
3. **Keep tests passing** - Run after each extraction
4. **Remove from monolith** - Delete extracted code from original
5. **Final cleanup** - Remove original cases, verify router only

---

## 2. State Machine for Phase Transitions

### Problem

Phase transitions happen implicitly throughout the handler:
```typescript
// Current: No validation that this transition is valid
conversation.setPhase('result_confirm');
```

Invalid transitions can leave the system in undefined states.

### Solution: Explicit State Machine

```typescript
// stateMachine.ts
export const phaseTransitions: Record<AgentPhase, AgentPhase[]> = {
  // Initial states
  'greeting': ['awaiting_input', 'identifying'],
  'awaiting_input': ['identifying', 'greeting'],

  // Identification flow
  'identifying': ['result_confirm', 'augment_input', 'error', 'awaiting_input'],
  'result_confirm': ['action_select', 'handle_incorrect', 'awaiting_input', 'identifying'],
  'augment_input': ['identifying', 'awaiting_input'],
  'handle_incorrect': ['identifying', 'awaiting_input'],

  // Action selection
  'action_select': ['adding_wine', 'enriching', 'awaiting_input', 'complete'],

  // Add wine flow
  'adding_wine': ['entity_matching', 'bottle_form', 'complete', 'error', 'awaiting_input'],
  'entity_matching': ['adding_wine', 'bottle_form', 'awaiting_input'],
  'bottle_form': ['complete', 'adding_wine', 'error'],

  // Enrichment flow
  'enriching': ['action_select', 'complete', 'error', 'awaiting_input'],

  // Terminal states
  'complete': ['awaiting_input', 'greeting'],
  'error': ['awaiting_input', 'greeting', 'identifying'],

  // Confirmation flows
  'confirm_new_search': ['identifying', 'action_select', 'awaiting_input'],
  'confirm_brief_search': ['identifying', 'awaiting_input'],
};

export function validateTransition(from: AgentPhase, to: AgentPhase): boolean {
  const validTargets = phaseTransitions[from];
  return validTargets?.includes(to) ?? false;
}

export function assertValidTransition(from: AgentPhase, to: AgentPhase): void {
  if (!validateTransition(from, to)) {
    console.error(`Invalid phase transition: ${from} → ${to}`);
    if (import.meta.env.DEV) {
      throw new Error(`Invalid phase transition: ${from} → ${to}`);
    }
  }
}
```

### Integration with Conversation Store

```typescript
// agentConversation.ts
import { assertValidTransition, validateTransition } from '../agent/stateMachine';

export function setPhase(newPhase: AgentPhase, step?: AddWineStep | null): void {
  const currentPhase = get(store).phase;

  // Validate transition in development
  assertValidTransition(currentPhase, newPhase);

  store.update((state) => ({
    ...state,
    phase: newPhase,
    addWineStep: step ?? (newPhase === 'adding_wine' ? state.addWineStep : null),
  }));

  persistConversationState();
}

// Safe transition check for conditional logic
export function canTransitionTo(targetPhase: AgentPhase): boolean {
  const currentPhase = get(store).phase;
  return validateTransition(currentPhase, targetPhase);
}
```

### Phase-to-State Invariants

```typescript
// stateInvariants.ts
export interface PhaseInvariants {
  requiredStores: {
    identification?: boolean;  // Must have identification result
    enrichment?: boolean;      // Must have enrichment data
    addWine?: boolean;         // Must have add wine flow
  };
  allowedMessageTypes: MessageCategory[];
}

export const phaseInvariants: Record<AgentPhase, PhaseInvariants> = {
  'greeting': {
    requiredStores: {},
    allowedMessageTypes: ['text', 'chips'],
  },
  'result_confirm': {
    requiredStores: { identification: true },
    allowedMessageTypes: ['text', 'wine_result', 'chips'],
  },
  'adding_wine': {
    requiredStores: { identification: true, addWine: true },
    allowedMessageTypes: ['text', 'chips', 'match_selection', 'bottle_form'],
  },
  'enriching': {
    requiredStores: { identification: true },
    allowedMessageTypes: ['text', 'enrichment', 'chips'],
  },
  // ... etc
};

export function validatePhaseState(phase: AgentPhase): ValidationResult {
  const invariants = phaseInvariants[phase];
  const errors: string[] = [];

  if (invariants.requiredStores.identification && !getResult()) {
    errors.push('Phase requires identification result but none exists');
  }
  if (invariants.requiredStores.addWine && !getCurrentFlow()) {
    errors.push('Phase requires add wine flow but none exists');
  }

  return { valid: errors.length === 0, errors };
}
```

---

## 3. Middleware System

### Problem

Cross-cutting concerns are duplicated throughout handlers:
- Error handling (try/catch with message generation)
- Retry tracking (storing last action)
- Validation (checking prerequisites)
- Logging (debug output)

### Solution: Composable Middleware

```typescript
// middleware/types.ts
export type ActionHandler = (action: AgentAction) => Promise<void>;
export type Middleware = (handler: ActionHandler) => ActionHandler;

// Compose multiple middleware
export function compose(...middlewares: Middleware[]): Middleware {
  return (handler) =>
    middlewares.reduceRight((h, middleware) => middleware(h), handler);
}
```

### Error Handling Middleware

```typescript
// middleware/errorHandler.ts
import { extractErrorInfo, createErrorMessage } from '../services/errorService';
import * as conversation from '$lib/stores/agentConversation';

export const withErrorHandling: Middleware = (handler) => async (action) => {
  try {
    await handler(action);
  } catch (error) {
    const errorInfo = extractErrorInfo(error);

    // Add error message to conversation
    conversation.addMessage(createErrorMessage(errorInfo));

    // Add retry chips if error is retryable
    if (errorInfo.retryable) {
      conversation.addMessage(
        conversation.createChipsMessage([
          { id: 'retry', label: 'Try Again', action: 'retry' },
          { id: 'start_over', label: 'Start Over', action: 'start_over' },
        ])
      );
    }

    // Set error phase
    conversation.setPhase('error');

    // Log for debugging
    console.error('[AgentAction] Error handling action:', action.type, errorInfo);
  }
};
```

### Retry Tracking Middleware

```typescript
// middleware/retryTracker.ts
import { writable, get } from 'svelte/store';

interface LastActionState {
  action: AgentAction | null;
  timestamp: number;
}

// Store instead of module-level variable
export const lastActionStore = writable<LastActionState>({
  action: null,
  timestamp: 0,
});

// Actions that should be tracked for retry
const retryableActions = new Set([
  'submit_text',
  'submit_image',
  'enrich_now',
  'add_to_cellar',
  'submit_bottle',
]);

export const withRetryTracking: Middleware = (handler) => async (action) => {
  // Track action if retryable
  if (retryableActions.has(action.type)) {
    lastActionStore.set({
      action,
      timestamp: Date.now(),
    });
  }

  await handler(action);
};

// Get last action for retry
export function getLastAction(): AgentAction | null {
  const state = get(lastActionStore);
  // Expire after 5 minutes
  if (Date.now() - state.timestamp > 5 * 60 * 1000) {
    return null;
  }
  return state.action;
}

// Clear on session reset
export function clearLastAction(): void {
  lastActionStore.set({ action: null, timestamp: 0 });
}
```

### Validation Middleware

```typescript
// middleware/validator.ts
import { getCurrentPhase, canTransitionTo } from '$lib/stores/agentConversation';
import { getResult } from '$lib/stores/agentIdentification';
import { getCurrentFlow } from '$lib/stores/agentAddWine';

interface ActionPrerequisites {
  requiresPhase?: AgentPhase[];
  requiresIdentification?: boolean;
  requiresAddWineFlow?: boolean;
}

const prerequisites: Record<string, ActionPrerequisites> = {
  // Can only confirm if we have a result
  'correct': { requiresIdentification: true, requiresPhase: ['result_confirm'] },
  'not_correct': { requiresIdentification: true, requiresPhase: ['result_confirm'] },

  // Can only add to cellar if we have identification
  'add_to_cellar': { requiresIdentification: true },

  // Can only submit bottle if in add wine flow
  'submit_bottle': { requiresAddWineFlow: true },

  // Enrichment needs identification
  'enrich_now': { requiresIdentification: true },
};

export const withValidation: Middleware = (handler) => async (action) => {
  const prereqs = prerequisites[action.type];

  if (prereqs) {
    const currentPhase = getCurrentPhase();

    // Check phase requirement
    if (prereqs.requiresPhase && !prereqs.requiresPhase.includes(currentPhase)) {
      console.warn(`Action ${action.type} requires phase ${prereqs.requiresPhase}, current: ${currentPhase}`);
      return; // Skip action
    }

    // Check identification requirement
    if (prereqs.requiresIdentification && !getResult()) {
      console.warn(`Action ${action.type} requires identification result`);
      return;
    }

    // Check add wine flow requirement
    if (prereqs.requiresAddWineFlow && !getCurrentFlow()) {
      console.warn(`Action ${action.type} requires add wine flow`);
      return;
    }
  }

  await handler(action);
};
```

---

## 4. Message & Chip Registry

### Problem

- Messages are strings in `messages.ts` accessed by string paths
- Chips are defined inline throughout handlers
- No type safety for message keys
- No consistency for chip labels/actions

### Solution: Type-Safe Registries

### Message Registry

```typescript
// registry/messages.ts
export enum MessageKey {
  // Greetings
  GREETING_MORNING = 'greeting.morning',
  GREETING_AFTERNOON = 'greeting.afternoon',
  GREETING_EVENING = 'greeting.evening',

  // Identification
  IDENTIFYING_START = 'identification.start',
  IDENTIFYING_FOUND = 'identification.found',
  IDENTIFYING_LOW_CONFIDENCE = 'identification.lowConfidence',
  IDENTIFYING_NEEDS_MORE = 'identification.needsMore',
  IDENTIFYING_FAILED = 'identification.failed',

  // Add Wine
  ADD_WINE_START = 'addWine.start',
  ADD_WINE_DUPLICATE = 'addWine.duplicate',
  ADD_WINE_MATCHING = 'addWine.matching',
  ADD_WINE_SUCCESS = 'addWine.success',

  // Enrichment
  ENRICHMENT_START = 'enrichment.start',
  ENRICHMENT_COMPLETE = 'enrichment.complete',

  // Errors
  ERROR_TIMEOUT = 'error.timeout',
  ERROR_RATE_LIMIT = 'error.rateLimit',
  ERROR_SERVER = 'error.server',
}

interface MessageTemplate {
  content: string | ((context: MessageContext) => string);
  variants?: string[];  // Random variants for natural feel
}

interface MessageContext {
  wineName?: string;
  producer?: string;
  confidence?: number;
  bottleCount?: number;
  [key: string]: unknown;
}

const messageTemplates: Record<MessageKey, MessageTemplate> = {
  [MessageKey.GREETING_MORNING]: {
    variants: [
      "Good morning! What wine can I help you with?",
      "Morning! Ready to explore some wines?",
      "Good morning! Let's find your next favorite wine.",
    ],
  },

  [MessageKey.IDENTIFYING_FOUND]: {
    content: (ctx) => `I found ${ctx.wineName} by ${ctx.producer}. Is this correct?`,
  },

  [MessageKey.IDENTIFYING_LOW_CONFIDENCE]: {
    content: (ctx) =>
      `I'm ${Math.round((ctx.confidence || 0) * 100)}% confident this is ${ctx.wineName}. ` +
      `Can you confirm or provide more details?`,
  },

  [MessageKey.ADD_WINE_DUPLICATE]: {
    content: (ctx) =>
      `I found ${ctx.wineName} already in your cellar with ${ctx.bottleCount} bottle${ctx.bottleCount === 1 ? '' : 's'}. ` +
      `Would you like to add another bottle or create a new entry?`,
  },

  // ... etc
};

export function getMessage(key: MessageKey, context?: MessageContext): string {
  const template = messageTemplates[key];

  if (!template) {
    console.warn(`Unknown message key: ${key}`);
    return '';
  }

  // Handle variants
  if (template.variants) {
    const index = Math.floor(Math.random() * template.variants.length);
    return template.variants[index];
  }

  // Handle template function
  if (typeof template.content === 'function') {
    return template.content(context || {});
  }

  return template.content;
}
```

### Chip Registry

```typescript
// registry/chips.ts
export enum ChipKey {
  // Confirmation
  CORRECT = 'correct',
  NOT_CORRECT = 'not_correct',

  // Actions
  ADD_TO_CELLAR = 'add_to_cellar',
  LEARN_MORE = 'learn_more',
  REMEMBER = 'remember',

  // Navigation
  START_OVER = 'start_over',
  GO_BACK = 'go_back',
  TRY_AGAIN = 'try_again',

  // Add Wine
  ADD_BOTTLE_EXISTING = 'add_bottle_existing',
  CREATE_NEW_WINE = 'create_new_wine',

  // Identification
  PROVIDE_MORE = 'provide_more',
  USE_ANYWAY = 'use_anyway',
  TRY_OPUS = 'try_opus',
}

interface ChipDefinition {
  label: string;
  action: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

const chipDefinitions: Record<ChipKey, ChipDefinition> = {
  [ChipKey.CORRECT]: {
    label: "Yes, that's right",
    action: 'correct',
    icon: 'check',
    variant: 'primary',
  },
  [ChipKey.NOT_CORRECT]: {
    label: "No, that's not it",
    action: 'not_correct',
    icon: 'x',
  },
  [ChipKey.ADD_TO_CELLAR]: {
    label: 'Add to Cellar',
    action: 'add_to_cellar',
    icon: 'plus',
    variant: 'primary',
  },
  [ChipKey.LEARN_MORE]: {
    label: 'Learn More',
    action: 'enrich_now',
    icon: 'info',
  },
  [ChipKey.TRY_OPUS]: {
    label: 'Try Premium Model',
    action: 'try_opus',
    icon: 'sparkle',
    variant: 'secondary',
  },
  // ... etc
};

export function getChip(key: ChipKey): AgentChip {
  const def = chipDefinitions[key];
  return {
    id: key,
    label: def.label,
    action: def.action,
    icon: def.icon,
    variant: def.variant,
  };
}

export function getChips(...keys: ChipKey[]): AgentChip[] {
  return keys.map(getChip);
}
```

### Chip Generator Service

```typescript
// services/chipGenerator.ts
import { ChipKey, getChips } from '../registry/chips';
import type { ResultAnalysis } from './resultAnalyzer';

export function generateIdentificationChips(analysis: ResultAnalysis): AgentChip[] {
  if (analysis.isHighConfidence) {
    return getChips(ChipKey.CORRECT, ChipKey.NOT_CORRECT);
  }

  if (analysis.needsMoreInfo) {
    return getChips(ChipKey.PROVIDE_MORE, ChipKey.USE_ANYWAY);
  }

  if (analysis.canEscalate) {
    return getChips(ChipKey.TRY_OPUS, ChipKey.USE_ANYWAY, ChipKey.START_OVER);
  }

  return getChips(ChipKey.START_OVER);
}

export function generateActionChips(hasEnrichment: boolean): AgentChip[] {
  const chips = [ChipKey.ADD_TO_CELLAR];

  if (!hasEnrichment) {
    chips.push(ChipKey.LEARN_MORE);
  }

  chips.push(ChipKey.REMEMBER);

  return getChips(...chips);
}

export function generateDuplicateChips(): AgentChip[] {
  return getChips(ChipKey.ADD_BOTTLE_EXISTING, ChipKey.CREATE_NEW_WINE);
}
```

---

## 5. Test Expansion

### Current State

- 422 tests passing
- Focus on unit tests for individual store operations
- Handler tests mock API calls

### Gaps Identified

1. **No integration tests** - Full flow from action to store updates
2. **No error scenario tests** - API failures, timeouts, edge cases
3. **No streaming tests** - Progressive field updates
4. **Limited component tests** - Basic rendering only

### Integration Test Plan

```typescript
// __tests__/integration/addWineFlow.test.ts
describe('Add Wine Flow Integration', () => {
  beforeEach(() => {
    // Reset all stores
    resetAllStores();
    // Setup API mocks
    setupApiMocks();
  });

  it('should complete full add wine flow: identify → add → complete', async () => {
    // 1. User submits text
    await handleAgentAction({ type: 'submit_text', payload: { text: 'Margaux 2018' } });

    // Verify identification started
    expect(get(agentPhase)).toBe('identifying');
    expect(get(isIdentifying)).toBe(true);

    // Wait for identification to complete
    await waitFor(() => expect(get(identificationResult)).not.toBeNull());

    // 2. User confirms result
    await handleAgentAction({ type: 'correct', messageId: 'msg_1' });
    expect(get(agentPhase)).toBe('action_select');

    // 3. User starts add flow
    await handleAgentAction({ type: 'add_to_cellar', messageId: 'msg_2' });
    expect(get(agentPhase)).toBe('adding_wine');
    expect(get(isInAddWineFlow)).toBe(true);

    // 4. User completes bottle form
    await handleAgentAction({
      type: 'submit_bottle',
      payload: { size: 'Standard', location: 'Rack 1', source: 'Gift' }
    });

    // Verify completion
    expect(get(agentPhase)).toBe('complete');
    expect(get(addedWineId)).not.toBeNull();

    // Verify all stores in consistent state
    expect(validatePhaseState(get(agentPhase)).valid).toBe(true);
  });

  it('should handle duplicate wine detection', async () => {
    // Setup: Mock checkDuplicate to return existing wine
    mockApi.checkDuplicate.mockResolvedValue({
      success: true,
      hasDuplicate: true,
      existingWine: { wineID: 123, bottles: 2 }
    });

    // ... test flow
  });

  it('should handle API timeout with retry', async () => {
    // Setup: First call times out, second succeeds
    mockApi.identifyText
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ success: true, result: mockResult });

    // User submits
    await handleAgentAction({ type: 'submit_text', payload: { text: 'test' } });

    // Verify error state
    expect(get(agentPhase)).toBe('error');
    expect(get(agentMessages).some(m => m.category === 'error')).toBe(true);

    // User retries
    await handleAgentAction({ type: 'retry' });

    // Verify success
    expect(get(agentPhase)).toBe('result_confirm');
  });
});
```

### Error Scenario Matrix

```typescript
// __tests__/errorScenarios.test.ts
const ERROR_SCENARIOS = [
  {
    name: 'identification timeout',
    action: { type: 'submit_text', payload: { text: 'test' } },
    mockSetup: () => mockApi.identifyText.mockRejectedValue(new TimeoutError()),
    expectedPhase: 'error',
    expectedRetryable: true,
  },
  {
    name: 'rate limit exceeded',
    action: { type: 'submit_text', payload: { text: 'test' } },
    mockSetup: () => mockApi.identifyText.mockRejectedValue(new RateLimitError()),
    expectedPhase: 'error',
    expectedRetryable: true,
  },
  {
    name: 'daily quota exceeded',
    action: { type: 'submit_text', payload: { text: 'test' } },
    mockSetup: () => mockApi.identifyText.mockRejectedValue(new QuotaExceededError()),
    expectedPhase: 'error',
    expectedRetryable: false,
  },
  {
    name: 'add wine database error',
    action: { type: 'submit_bottle', payload: mockBottleData },
    mockSetup: () => mockApi.addWine.mockRejectedValue(new DatabaseError()),
    expectedPhase: 'error',
    expectedRetryable: true,
  },
  // ... more scenarios
];

describe('Error Scenarios', () => {
  ERROR_SCENARIOS.forEach(scenario => {
    it(`should handle ${scenario.name}`, async () => {
      scenario.mockSetup();

      await handleAgentAction(scenario.action);

      expect(get(agentPhase)).toBe(scenario.expectedPhase);

      const errorMsg = get(agentMessages).find(m => m.category === 'error');
      expect(errorMsg).toBeDefined();

      const hasRetryChip = get(agentMessages).some(m =>
        m.category === 'chips' &&
        m.data.chips.some(c => c.action === 'retry')
      );
      expect(hasRetryChip).toBe(scenario.expectedRetryable);
    });
  });
});
```

### Streaming Tests

```typescript
// __tests__/streaming.test.ts
describe('Streaming Field Updates', () => {
  it('should progressively update fields during identification', async () => {
    const fieldUpdates: Array<{ field: string; value: string }> = [];

    // Track field updates
    streamingFields.subscribe(fields => {
      fields.forEach((state, field) => {
        if (state.value) {
          fieldUpdates.push({ field, value: state.value });
        }
      });
    });

    // Mock streaming response
    mockApi.identifyTextStream.mockImplementation(async (text, callbacks) => {
      callbacks.onField('wineName', 'Château');
      await delay(50);
      callbacks.onField('wineName', 'Château Margaux');
      await delay(50);
      callbacks.onField('producer', 'Château Margaux');
      await delay(50);
      callbacks.onField('vintage', '2018');
      callbacks.onComplete(mockFullResult);
      return mockFullResult;
    });

    await handleAgentAction({ type: 'submit_text', payload: { text: 'test' } });

    // Verify progressive updates
    expect(fieldUpdates.length).toBeGreaterThan(3);
    expect(fieldUpdates[0].field).toBe('wineName');
    expect(fieldUpdates[0].value).toBe('Château');
  });

  it('should handle stream interruption gracefully', async () => {
    mockApi.identifyTextStream.mockImplementation(async (text, callbacks) => {
      callbacks.onField('wineName', 'Château');
      throw new Error('Connection lost');
    });

    await handleAgentAction({ type: 'submit_text', payload: { text: 'test' } });

    // Should be in error state, not stuck in identifying
    expect(get(agentPhase)).toBe('error');
    expect(get(isIdentifying)).toBe(false);
  });
});
```

---

## 6. Implementation Order

### Sprint 1: Foundation (Week 1)

1. **Create handler module structure**
   - Create `/handlers/` directory
   - Create `/middleware/` directory
   - Create `/services/` directory
   - Setup barrel exports

2. **Implement middleware system**
   - Error handler middleware
   - Retry tracker middleware (with store)
   - Validation middleware
   - Compose utility

3. **Extract conversation handlers**
   - `start_over`, `go_back`, `cancel`, `retry`
   - Simplest handlers, good for validating pattern

### Sprint 2: Core Handlers (Week 2)

4. **Extract identification handlers**
   - `submit_text`, `submit_image`
   - `try_opus`, `reidentify`
   - Result analyzer service
   - Chip generator service

5. **Extract enrichment handlers**
   - `enrich_now`, `remember`, `recommend`

### Sprint 3: Add Wine & Forms (Week 3)

6. **Extract add wine handlers**
   - `add_to_cellar`, `select_match`, `add_new`
   - `add_bottle_existing`, `create_new_wine`

7. **Extract form handlers**
   - `submit_bottle`, `bottle_next`
   - `manual_entry_submit`

### Sprint 4: Registries & State Machine (Week 4)

8. **Implement message registry**
   - Message enum and templates
   - Context-aware message generation

9. **Implement chip registry**
   - Chip definitions
   - Chip generator service

10. **Implement state machine**
    - Phase transition map
    - Validation integration with setPhase

### Sprint 5: Testing (Week 5)

11. **Integration tests**
    - Full flow tests
    - Error scenario matrix
    - Streaming tests

12. **Documentation**
    - Architecture diagram
    - Handler contribution guide
    - Migration notes

---

## 7. Success Criteria

### Code Quality

- [ ] `handleAgentAction.ts` reduced to <200 lines (router only)
- [ ] Each handler module <500 lines
- [ ] No module-level mutable state (all in stores)
- [ ] 100% type coverage for actions and messages

### Testing

- [ ] 600+ tests (up from 422)
- [ ] Integration tests for all major flows
- [ ] Error scenario coverage >90%
- [ ] Streaming field tests

### Architecture

- [ ] State machine validates all transitions
- [ ] Middleware handles all cross-cutting concerns
- [ ] Message/chip registries eliminate inline strings
- [ ] Clear dependency graph documented

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking changes during extraction | Medium | High | Extract one module at a time, keep tests passing |
| Performance regression from middleware | Low | Medium | Profile before/after, optimize if needed |
| Type system complexity increases | Medium | Low | Strong IDE support, clear documentation |
| Team learning curve | Medium | Medium | Pair programming, detailed PR reviews |

---

## Appendix: File Size Targets

| File | Current | Target | Notes |
|------|---------|--------|-------|
| `handleAgentAction.ts` | 2,831 | <200 | Router only |
| `handlers/identification.ts` | - | ~400 | Text, image, Opus |
| `handlers/enrichment.ts` | - | ~300 | Enrichment flow |
| `handlers/addWine.ts` | - | ~400 | Entity matching, submission |
| `handlers/conversation.ts` | - | ~200 | Navigation, phase changes |
| `handlers/forms.ts` | - | ~200 | Form submissions |
| `middleware/*.ts` | - | ~100 each | Small, focused |
| `services/*.ts` | - | ~150 each | Shared utilities |

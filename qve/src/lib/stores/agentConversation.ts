/**
 * Agent Conversation Store
 *
 * Handles:
 * - Messages array
 * - Phase management
 * - Add/remove messages
 * - Phase transitions
 *
 * Part of the Phase 4 store split from the monolithic agent.ts
 */

import { writable, derived, get } from 'svelte/store';
import {
  persistState,
  loadState,
  createEmptyState,
  type PersistedState,
} from './agentPersistence';
import type {
  AgentMessage,
  AgentPhase,
  AddWineStep,
  MessageCategory,
  MessageData,
  AgentChip,
} from '$lib/agent/types';
import { getTimeBasedGreeting } from '$lib/agent/messages';
import { assertValidTransition } from '$lib/agent/stateMachine';

// ===========================================
// Constants
// ===========================================

const MAX_MESSAGES = 30;
const MESSAGE_DELAY_MS = 500; // Delay between consecutive agent messages
export const TYPING_MESSAGE_ID = 'msg_typing_indicator';

// ===========================================
// Delay Utility
// ===========================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===========================================
// Message Queue (Race Condition Fix - WIN-195)
// ===========================================

/**
 * Promise queue for serializing addMessageWithDelay calls.
 * Ensures FIFO ordering and that delay calculations use current state,
 * not stale snapshots from when the call was initiated.
 */
let messageQueue: Promise<void> = Promise.resolve();

/**
 * Tracks whether there are pending operations in the message queue.
 * Used to warn in dev mode if addMessage is called while queue is active.
 */
let queuePendingCount = 0;

// ===========================================
// Origin Tracking Types
// ===========================================

export type OriginViewMode = 'ourWines' | 'allWines';

export interface OriginState {
  path: string;
  viewMode: OriginViewMode;
}

// ===========================================
// Internal State
// ===========================================

interface ConversationState {
  messages: AgentMessage[];
  phase: AgentPhase;
  addWineStep: AddWineStep | null;
  isInitialized: boolean;
  origin: OriginState | null;
}

const initialState: ConversationState = {
  messages: [],
  phase: 'greeting',
  addWineStep: null,
  isInitialized: false,
  origin: null,
};

const store = writable<ConversationState>(initialState);

// ===========================================
// Derived Stores (Readable exports)
// ===========================================

export const agentMessages = derived(store, ($store) => $store.messages);
export const agentPhase = derived(store, ($store) => $store.phase);
export const addWineStep = derived(store, ($store) => $store.addWineStep);
export const isConversationInitialized = derived(store, ($store) => $store.isInitialized);
export const agentOrigin = derived(store, ($store) => $store.origin);

// Convenience derived stores
export const hasMessages = derived(store, ($store) => $store.messages.length > 0);
export const lastMessage = derived(store, ($store) =>
  $store.messages.length > 0 ? $store.messages[$store.messages.length - 1] : null
);
export const lastAgentMessage = derived(store, ($store) =>
  [...$store.messages].reverse().find((m) => m.role === 'agent') ?? null
);
export const lastUserMessage = derived(store, ($store) =>
  [...$store.messages].reverse().find((m) => m.role === 'user') ?? null
);

// Phase-based derived stores
export const isInAddWineFlow = derived(
  store,
  ($store) => $store.phase === 'adding_wine'
);
export const isInEnrichmentFlow = derived(
  store,
  ($store) => $store.phase === 'enriching'
);
export const isInLoadingPhase = derived(
  store,
  ($store) => ['identifying', 'enriching'].includes($store.phase)
);

// Animation tracking - true while any agent message is still animating (isNew: true)
// Used to disable input until message animations complete, preventing message queue buildup
export const hasAnimatingMessages = derived(
  store,
  ($store) => $store.messages.some((m) => m.role === 'agent' && m.isNew === true)
);

// Active chips tracking - true when there are non-disabled chip messages
// Used to disable text input when chips are displayed, forcing user to select a chip action
// WIN-268: Chips should disable text input to force the user down a path
export const hasActiveChips = derived(
  store,
  ($store) => $store.messages.some((m) => m.category === 'chips' && !m.disabled)
);

// ===========================================
// Message Creation Helpers
// ===========================================

let messageCounter = 0;

function generateMessageId(): string {
  messageCounter++;
  return `msg_${Date.now()}_${messageCounter}`;
}

/**
 * Create a new message with all required fields.
 */
export function createMessage(
  category: MessageCategory,
  data: Omit<MessageData, 'category'>,
  options: Partial<Omit<AgentMessage, 'id' | 'timestamp' | 'category' | 'data'>> = {}
): AgentMessage {
  return {
    id: generateMessageId(),
    category,
    role: options.role ?? 'agent',
    timestamp: Date.now(),
    data: { category, ...data } as MessageData,
    isNew: true,
    ...options,
  };
}

/**
 * Create a text message.
 */
export function createTextMessage(
  content: string,
  options: Partial<Omit<AgentMessage, 'id' | 'timestamp' | 'category' | 'data'>> = {}
): AgentMessage {
  return createMessage('text', { content }, options);
}

/**
 * Create a chips message.
 */
export function createChipsMessage(
  chips: AgentChip[],
  options: Partial<Omit<AgentMessage, 'id' | 'timestamp' | 'category' | 'data'>> & { groupLabel?: string } = {}
): AgentMessage {
  const { groupLabel, ...messageOptions } = options;
  return createMessage('chips', { chips, ...(groupLabel && { groupLabel }) }, messageOptions);
}

/**
 * Add a typing indicator message to the conversation.
 * Uses a well-known ID so it can be reliably removed when results arrive.
 * Removes any existing typing message first to prevent duplicates.
 */
export function addTypingMessage(text: string): AgentMessage {
  // Remove any existing typing message first
  removeTypingMessage();

  const message: AgentMessage = {
    id: TYPING_MESSAGE_ID,
    category: 'typing',
    role: 'agent',
    timestamp: Date.now(),
    data: { category: 'typing', text },
    isNew: true,
  };

  return addMessage(message);
}

/**
 * Remove the typing indicator message if present.
 */
export function removeTypingMessage(): void {
  const messages = get(store).messages;
  if (messages.some((m) => m.id === TYPING_MESSAGE_ID)) {
    removeMessage(TYPING_MESSAGE_ID);
  }
}

// ===========================================
// Actions
// ===========================================

/**
 * Add a message to the conversation.
 * Automatically trims old messages if exceeding MAX_MESSAGES.
 * Disables all previous chip messages to prevent stale interactions.
 *
 * @param message - The message to add
 * @param options._fromQueue - Internal flag: true when called from addMessageWithDelay queue
 */
export function addMessage(
  message: Omit<AgentMessage, 'id' | 'timestamp'> | AgentMessage,
  options: { _fromQueue?: boolean } = {}
): AgentMessage {
  // DEV warning: detect potential race condition if addMessage is called
  // while addMessageWithDelay has pending operations in the queue
  if (import.meta.env.DEV && queuePendingCount > 0 && !options._fromQueue) {
    console.warn(
      '[AgentConversation] addMessage() called while addMessageWithDelay queue has pending operations. ' +
      'This may cause message ordering issues. Ensure addMessageWithDelay is awaited before calling addMessage.'
    );
  }

  const fullMessage: AgentMessage = {
    id: 'id' in message && message.id ? message.id : generateMessageId(),
    timestamp: 'timestamp' in message && message.timestamp ? message.timestamp : Date.now(),
    isNew: true,
    ...message,
  } as AgentMessage;

  store.update((state) => {
    // Disable all existing interactive messages (chips and errors) before adding the new one
    let messages = state.messages.map((msg) =>
      msg.category === 'chips' || msg.category === 'error'
        ? { ...msg, disabled: true }
        : msg
    );

    // Add the new message
    messages = [...messages, fullMessage];

    // Trim old messages if needed
    if (messages.length > MAX_MESSAGES) {
      messages = messages.slice(-MAX_MESSAGES);
    }

    return { ...state, messages };
  });

  // Persist (debounced)
  persistConversationState();

  return fullMessage;
}

/**
 * Add multiple messages at once.
 * Disables all previous chip messages to prevent stale interactions.
 */
export function addMessages(
  messages: Array<Omit<AgentMessage, 'id' | 'timestamp'>>
): AgentMessage[] {
  const fullMessages = messages.map((msg) => ({
    id: generateMessageId(),
    timestamp: Date.now(),
    isNew: true,
    ...msg,
  } as AgentMessage));

  store.update((state) => {
    // Disable all existing interactive messages (chips and errors) before adding new ones
    let existingMessages = state.messages.map((msg) =>
      msg.category === 'chips' || msg.category === 'error'
        ? { ...msg, disabled: true }
        : msg
    );

    let allMessages = [...existingMessages, ...fullMessages];

    if (allMessages.length > MAX_MESSAGES) {
      allMessages = allMessages.slice(-MAX_MESSAGES);
    }

    return { ...state, messages: allMessages };
  });

  persistConversationState();

  return fullMessages;
}

/**
 * Add a message with delay if needed for natural conversational pacing.
 *
 * Adds a delay before new agent text/card messages if the previous message
 * was also from the agent. Chips messages are added immediately (no delay)
 * since they should appear alongside their preceding text.
 *
 * Uses a promise queue to ensure FIFO ordering when called concurrently.
 * This fixes a race condition (WIN-195) where concurrent calls would read
 * stale state and messages could appear out of order.
 *
 * @param message - The message to add
 * @param options.skipDelay - Force skip delay even if conditions would trigger it
 * @returns The added message
 */
export async function addMessageWithDelay(
  message: Omit<AgentMessage, 'id' | 'timestamp'> | AgentMessage,
  options: { skipDelay?: boolean } = {}
): Promise<AgentMessage> {
  // Capture the message and options, then queue the execution
  let resolveMessage: (msg: AgentMessage) => void;
  const messagePromise = new Promise<AgentMessage>((resolve) => {
    resolveMessage = resolve;
  });

  // Track pending queue operations
  queuePendingCount++;

  // Chain onto the queue to ensure FIFO ordering
  messageQueue = messageQueue.then(async () => {
    // Check state HERE (inside queue), not before queueing
    // This ensures we see the actual current state after prior messages
    const state = get(store);
    const lastMsg = state.messages[state.messages.length - 1];

    // Determine if delay is needed:
    // 1. skipDelay is not set
    // 2. There's a previous message
    // 3. Previous message was from agent (and not chips - chips don't count as "agent speaking")
    // 4. New message is from agent
    // 5. New message is NOT chips (chips follow text immediately)
    const shouldDelay =
      !options.skipDelay &&
      lastMsg &&
      lastMsg.role === 'agent' &&
      lastMsg.category !== 'chips' &&
      (message.role ?? 'agent') === 'agent' &&
      message.category !== 'chips';

    if (shouldDelay) {
      await delay(MESSAGE_DELAY_MS);
    }

    const addedMessage = addMessage(message, { _fromQueue: true });
    queuePendingCount--;
    resolveMessage!(addedMessage);
  });

  return messagePromise;
}

/**
 * Add multiple messages with delays between agent message groups.
 * Messages are grouped: text + following chips appear together,
 * then delay before the next text message.
 */
export async function addMessagesWithDelay(
  messages: Array<Omit<AgentMessage, 'id' | 'timestamp'>>
): Promise<AgentMessage[]> {
  const results: AgentMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const nextMsg = messages[i + 1];

    // Use delay for this message (respects natural pacing)
    const result = await addMessageWithDelay(msg);
    results.push(result);

    // If this is a text message and next is chips, add chips immediately (no extra delay)
    // The delay logic in addMessageWithDelay handles this automatically
  }

  return results;
}

/**
 * Update a specific message by ID.
 */
export function updateMessage(
  messageId: string,
  updates: Partial<AgentMessage>
): void {
  store.update((state) => ({
    ...state,
    messages: state.messages.map((msg) =>
      msg.id === messageId ? { ...msg, ...updates } : msg
    ),
  }));

  persistConversationState();
}

/**
 * Disable a message (e.g., after chip is tapped).
 */
export function disableMessage(messageId: string): void {
  updateMessage(messageId, { disabled: true });
}

/**
 * Disable all interactive messages (chips and errors).
 * Prevents interaction with old action buttons.
 */
export function disableAllChips(): void {
  store.update((state) => ({
    ...state,
    messages: state.messages.map((msg) =>
      msg.category === 'chips' || msg.category === 'error'
        ? { ...msg, disabled: true }
        : msg
    ),
  }));

  persistConversationState();
}

/**
 * Mark a message as no longer "new" (disable animation).
 */
export function clearNewFlag(messageId: string): void {
  updateMessage(messageId, { isNew: false });
}

/**
 * Clear all "new" flags from messages.
 */
export function clearAllNewFlags(): void {
  store.update((state) => ({
    ...state,
    messages: state.messages.map((msg) => ({ ...msg, isNew: false })),
  }));
}

/**
 * Remove a specific message by ID.
 */
export function removeMessage(messageId: string): void {
  store.update((state) => ({
    ...state,
    messages: state.messages.filter((msg) => msg.id !== messageId),
  }));

  persistConversationState();
}

/**
 * Set the conversation phase.
 *
 * Validates the transition using the state machine:
 * - In DEV mode: Throws on invalid transitions
 * - In production: Logs and allows (fail-safe)
 *
 * @param phase - Target phase
 * @param step - Optional target substep (for adding_wine phase)
 */
export function setPhase(phase: AgentPhase, step?: AddWineStep | null): void {
  const currentState = get(store);
  const currentPhase = currentState.phase;
  const currentStep = currentState.addWineStep;

  // Validate transition (throws in DEV, logs in production)
  assertValidTransition(
    currentPhase,
    phase,
    step,
    currentStep,
    `setPhase(${phase}${step ? `, ${step}` : ''})`
  );

  store.update((state) => ({
    ...state,
    phase,
    addWineStep: step ?? (phase === 'adding_wine' ? state.addWineStep : null),
  }));

  persistConversationState();
}

/**
 * Set the origin state (where user was when opening the panel).
 * Used for navigation after adding a wine.
 */
export function setOrigin(origin: OriginState): void {
  store.update((state) => ({
    ...state,
    origin,
  }));
}

/**
 * Clear the origin state.
 */
export function clearOrigin(): void {
  store.update((state) => ({
    ...state,
    origin: null,
  }));
}

/**
 * Get current origin synchronously.
 */
export function getOrigin(): OriginState | null {
  return get(store).origin;
}

/**
 * Set just the add-wine step without changing phase.
 */
export function setAddWineStep(step: AddWineStep | null): void {
  store.update((state) => ({
    ...state,
    addWineStep: step,
  }));

  persistConversationState();
}

/**
 * Reset the conversation to initial state.
 * Keeps a divider and adds a new greeting.
 */
export function resetConversation(
  greetingContent = "Let's start fresh. What wine can I help you with?"
): void {
  const currentMessages = get(store).messages;

  // Add divider if there are existing messages
  const newMessages: AgentMessage[] = [];
  if (currentMessages.length > 0) {
    newMessages.push(
      createMessage('text', { content: '', variant: 'divider' }, { role: 'agent', isNew: false })
    );
  }

  // Add greeting
  newMessages.push(createTextMessage(greetingContent));

  store.update((state) => {
    // Disable all existing interactive messages (chips and errors) before adding new ones
    const updatedMessages = state.messages.map((msg) =>
      msg.category === 'chips' || msg.category === 'error'
        ? { ...msg, disabled: true }
        : msg
    );

    return {
      ...state,
      messages: [...updatedMessages, ...newMessages],
      phase: 'awaiting_input',
      addWineStep: null,
    };
  });

  persistConversationState();
}

/**
 * Start a new session (full reset including clearing messages).
 */
export function startSession(): void {
  const greeting = getTimeBasedGreeting();

  store.set({
    messages: [createTextMessage(greeting)],
    phase: 'greeting',
    addWineStep: null,
    isInitialized: true,
    origin: null,
  });

  persistConversationState(true); // Immediate persist
}

/**
 * Full reset - clears everything including storage.
 */
export function fullReset(): void {
  store.set({
    ...initialState,
    isInitialized: true,
  });

  // Clear persistence
  persistState({
    messages: [],
    phase: 'greeting',
    addWineStep: null,
  }, true);
}

// ===========================================
// Initialization
// ===========================================

/**
 * Initialize the conversation store.
 * Restores from persistence if available.
 */
export function initializeConversation(): void {
  const state = get(store);
  if (state.isInitialized) return;

  const persisted = loadState();

  if (persisted && persisted.messages.length > 0) {
    // Restore from persistence
    store.set({
      messages: persisted.messages.map((msg) => ({
        ...msg,
        isNew: false, // Prevent animation on restore
      })),
      phase: persisted.phase,
      addWineStep: persisted.addWineStep,
      isInitialized: true,
      origin: null, // Origin is not persisted, set fresh when panel opens
    });
  } else {
    // Start fresh session
    startSession();
  }
}

/**
 * Restore conversation state from callbacks (used by persistence coordinator).
 */
export function restoreFromCallbacks(data: {
  messages: AgentMessage[];
  phase: AgentPhase;
  addWineStep: AddWineStep | null;
}): void {
  store.set({
    messages: data.messages.map((msg) => ({ ...msg, isNew: false })),
    phase: data.phase,
    addWineStep: data.addWineStep,
    isInitialized: true,
    origin: null, // Origin is not persisted, set fresh when panel opens
  });
}

// ===========================================
// Helpers
// ===========================================

/**
 * Persist current conversation state.
 */
function persistConversationState(immediate = false): void {
  const state = get(store);

  persistState(
    {
      messages: state.messages,
      phase: state.phase,
      addWineStep: state.addWineStep,
    },
    immediate
  );
}

// ===========================================
// Getters (for action handler)
// ===========================================

/**
 * Get current phase synchronously.
 */
export function getCurrentPhase(): AgentPhase {
  return get(store).phase;
}

/**
 * Get all messages synchronously.
 */
export function getMessages(): AgentMessage[] {
  return get(store).messages;
}

/**
 * Get the most recent chips message (for chip response detection).
 */
export function getLastChipsMessage(): AgentMessage | null {
  const messages = get(store).messages;
  return [...messages].reverse().find((m) => m.category === 'chips' && !m.disabled) ?? null;
}

// ===========================================
// Subscribe for debugging
// ===========================================

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  store.subscribe((state) => {
    console.debug('[AgentConversation]', {
      messageCount: state.messages.length,
      phase: state.phase,
      addWineStep: state.addWineStep,
    });
  });
}

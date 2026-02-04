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

// ===========================================
// Constants
// ===========================================

const MAX_MESSAGES = 30;
const MESSAGE_DELAY_MS = 500; // Delay between consecutive agent messages

// ===========================================
// Delay Utility
// ===========================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===========================================
// Internal State
// ===========================================

interface ConversationState {
  messages: AgentMessage[];
  phase: AgentPhase;
  addWineStep: AddWineStep | null;
  isInitialized: boolean;
}

const initialState: ConversationState = {
  messages: [],
  phase: 'greeting',
  addWineStep: null,
  isInitialized: false,
};

const store = writable<ConversationState>(initialState);

// ===========================================
// Derived Stores (Readable exports)
// ===========================================

export const agentMessages = derived(store, ($store) => $store.messages);
export const agentPhase = derived(store, ($store) => $store.phase);
export const addWineStep = derived(store, ($store) => $store.addWineStep);
export const isConversationInitialized = derived(store, ($store) => $store.isInitialized);

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
  options: Partial<Omit<AgentMessage, 'id' | 'timestamp' | 'category' | 'data'>> = {}
): AgentMessage {
  return createMessage('chips', { chips }, options);
}

// ===========================================
// Actions
// ===========================================

/**
 * Add a message to the conversation.
 * Automatically trims old messages if exceeding MAX_MESSAGES.
 * Disables all previous chip messages to prevent stale interactions.
 */
export function addMessage(
  message: Omit<AgentMessage, 'id' | 'timestamp'> | AgentMessage
): AgentMessage {
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
 * @param message - The message to add
 * @param options.skipDelay - Force skip delay even if conditions would trigger it
 * @returns The added message
 */
export async function addMessageWithDelay(
  message: Omit<AgentMessage, 'id' | 'timestamp'> | AgentMessage,
  options: { skipDelay?: boolean } = {}
): Promise<AgentMessage> {
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

  return addMessage(message);
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
 */
export function setPhase(phase: AgentPhase, step?: AddWineStep | null): void {
  store.update((state) => ({
    ...state,
    phase,
    addWineStep: step ?? (phase === 'adding_wine' ? state.addWineStep : null),
  }));

  persistConversationState();
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

  store.update((state) => ({
    ...state,
    messages: [...state.messages, ...newMessages],
    phase: 'awaiting_input',
    addWineStep: null,
  }));

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

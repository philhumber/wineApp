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

// ===========================================
// Constants
// ===========================================

const MAX_MESSAGES = 30;

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
    let messages = [...state.messages, fullMessage];

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
    let allMessages = [...state.messages, ...fullMessages];

    if (allMessages.length > MAX_MESSAGES) {
      allMessages = allMessages.slice(-MAX_MESSAGES);
    }

    return { ...state, messages: allMessages };
  });

  persistConversationState();

  return fullMessages;
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
 * Disable all chip messages (prevent interaction with old chips).
 */
export function disableAllChips(): void {
  store.update((state) => ({
    ...state,
    messages: state.messages.map((msg) =>
      msg.category === 'chips' ? { ...msg, disabled: true } : msg
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
      createTextMessage('---', { role: 'agent' })
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

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning! I'm your wine sommelier. What can I help you with today?";
  } else if (hour < 17) {
    return "Good afternoon! Ready to explore some wines?";
  } else {
    return "Good evening! Let's find the perfect wine for you.";
  }
}

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

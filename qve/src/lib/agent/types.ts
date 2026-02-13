import { generateUUID } from '$lib/utils';
import type { AgentEnrichmentData } from '$lib/api/types';

// ===========================================
// Message Categories (reduced from 18 types)
// ===========================================
export type MessageCategory =
  | 'text'
  | 'chips'
  | 'wine_result'
  | 'enrichment'
  | 'form'
  | 'error'
  | 'image'
  | 'typing';

// ===========================================
// Simplified Phases (reduced from 20+)
// ===========================================
export type AgentPhase =
  | 'greeting'
  | 'awaiting_input'
  | 'identifying'
  | 'confirming'
  | 'adding_wine'
  | 'enriching'
  | 'error'
  | 'complete';

// Add-wine sub-states
export type AddWineStep =
  | 'confirm'
  | 'entity_matching'
  | 'bottle_details'
  | 'enrichment'
  | 'complete';

// ===========================================
// Unified Message Interface
// ===========================================
export interface AgentMessage {
  id: string;
  category: MessageCategory;
  role: 'user' | 'agent';
  timestamp: number;
  disabled?: boolean;
  isNew?: boolean;
  animated?: boolean;

  // Streaming support (flag, not category)
  isStreaming?: boolean;
  streamingFields?: Map<string, StreamingField>;

  // Category-specific data
  data: MessageData;
}

export interface StreamingField {
  value: unknown; // Using 'unknown' for compatibility with old StreamingFieldState
  isTyping: boolean;
}

// ===========================================
// Message Data (Discriminated Union)
// ===========================================
export type MessageData =
  | TextMessageData
  | ChipsMessageData
  | WineResultMessageData
  | EnrichmentMessageData
  | FormMessageData
  | ErrorMessageData
  | ImageMessageData
  | TypingMessageData;

export interface TextMessageData {
  category: 'text';
  content: string;
  variant?: 'greeting' | 'info' | 'warning' | 'success' | 'divider';
}

export interface ChipsMessageData {
  category: 'chips';
  chips: AgentChip[];
  selectedChipId?: string;
  groupLabel?: string;
}

export interface AgentChip {
  id: string;
  label: string;
  action: string;
  payload?: unknown;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface WineResultMessageData {
  category: 'wine_result';
  result: WineIdentificationResult;
  confidence?: number;
}

export interface EnrichmentMessageData {
  category: 'enrichment';
  data: AgentEnrichmentData | null;  // null = skeleton state
  streamingTextFields: string[];      // field names with active text cursor
}

export type FormType = 'bottle_details' | 'manual_entry' | 'match_selection';

// Form-specific data types
export interface BottleDetailsFormData extends Partial<BottleFormData> {
  part?: 1 | 2;
  step?: 1 | 2;
}

export interface MatchSelectionFormData {
  matches: Array<{ id: number; name: string; [key: string]: unknown }>;
  entityType: EntityType;
}

export interface ManualEntryFormData {
  [key: string]: string | number | undefined;
}

// Union of all form data types
export type FormDataUnion = BottleDetailsFormData | MatchSelectionFormData | ManualEntryFormData;

export interface FormMessageData {
  category: 'form';
  formType: FormType;
  formData: FormDataUnion;
  step?: number;
}

export interface ErrorMessageData {
  category: 'error';
  error: AgentErrorInfo;
  retryable?: boolean;
}

export interface ImageMessageData {
  category: 'image';
  src: string;
  mimeType: string;
}

export interface TypingMessageData {
  category: 'typing';
  text: string;
}

// ===========================================
// Action Types (Command Pattern)
// Expanded from 10 to ~50 typed actions based on Phase 4 review
// ===========================================

// Input Actions
export type InputAction =
  | { type: 'submit_text'; payload: string }
  | { type: 'submit_image'; payload: { data: string; mimeType: string } };

// Navigation Actions
export type NavigationAction =
  | { type: 'start_over' }
  | { type: 'go_back' }
  | { type: 'cancel' }
  | { type: 'cancel_request' }  // WIN-187: Abort in-flight LLM request
  | { type: 'retry' }
  | { type: 'try_again' };

// Confirmation Actions
export type ConfirmationAction =
  | { type: 'correct'; messageId: string }
  | { type: 'not_correct'; messageId: string }
  | { type: 'confirm_direction'; messageId: string }
  | { type: 'wrong_direction'; messageId: string }
  | { type: 'confirm_new_search'; messageId: string }
  | { type: 'continue_current'; messageId: string }
  | { type: 'confirm_brief_search'; messageId: string }
  | { type: 'add_more_detail'; messageId: string }
  | { type: 'confirm_cache_match'; messageId: string }
  | { type: 'force_refresh'; messageId: string };

// Identification Actions
export type IdentificationAction =
  | { type: 'identify'; messageId: string }
  | { type: 'try_opus'; messageId: string }
  | { type: 'see_result'; messageId: string }
  | { type: 'see_partial_result'; messageId: string }
  | { type: 'use_conversation'; messageId: string }
  | { type: 'add_missing_details'; messageId: string }
  | { type: 'use_producer_name'; messageId: string; payload?: { name: string } }
  | { type: 'use_grape_as_name'; messageId: string; payload?: { name: string } }
  | { type: 'nv_vintage'; messageId: string }
  | { type: 'provide_more'; messageId: string }
  | { type: 'new_input'; messageId: string }
  | { type: 'start_fresh'; messageId: string }
  | { type: 'reidentify'; messageId: string }
  | { type: 'continue_as_is'; messageId: string }
  | { type: 'correct_field'; messageId: string; payload: { field: string } }
  | { type: 'confirm_corrections'; messageId: string }
  | { type: 'verify'; messageId: string };

// Wine Flow Actions
export type WineFlowAction =
  | { type: 'add'; messageId: string }
  | { type: 'add_to_cellar'; messageId: string }
  | { type: 'learn'; messageId: string }
  | { type: 'remember'; messageId: string }
  | { type: 'remember_wine'; messageId: string }
  | { type: 'recommend'; messageId: string }
  | { type: 'enrich_now'; messageId: string }
  | { type: 'add_quickly'; messageId: string };

// Entity Matching Actions
export type EntityMatchAction =
  | { type: 'select_match'; payload: { entityType: EntityType; matchId: number }; messageId: string }
  | { type: 'add_new'; payload: { entityType: EntityType }; messageId: string }
  | { type: 'clarify'; payload: { entityType: EntityType }; messageId: string }
  | { type: 'add_bottle_existing'; messageId: string }
  | { type: 'create_new_wine'; messageId: string };

// Form Actions
export type FormAction =
  | { type: 'submit_bottle'; payload: BottleFormData }
  | { type: 'manual_entry_submit'; payload: ManualEntryData }
  | { type: 'manual_entry_complete'; payload: ManualEntryData; messageId: string }
  | { type: 'bottle_next'; messageId: string; payload?: BottleFormData }
  | { type: 'bottle_submit'; messageId: string }
  | { type: 'retry_add'; messageId: string };

// Camera Actions
export type CameraAction =
  | { type: 'take_photo'; messageId: string }
  | { type: 'choose_photo'; messageId: string };

// Error Actions
export type ErrorAction =
  | { type: 'start_over_error'; messageId: string };

// Generic chip tap (fallback for unmapped actions)
export type GenericChipAction = {
  type: 'chip_tap';
  payload: { action: string; messageId: string; data?: unknown }
};

// Union of all action types
export type AgentAction =
  | InputAction
  | NavigationAction
  | ConfirmationAction
  | IdentificationAction
  | WineFlowAction
  | EntityMatchAction
  | FormAction
  | CameraAction
  | ErrorAction
  | GenericChipAction;

// Entity types for matching
export type EntityType = 'region' | 'producer' | 'wine';

// ===========================================
// Placeholder types (reference existing)
// ===========================================
// These will be properly imported from api/types.ts later
export interface WineIdentificationResult {
  producer?: string;
  wineName?: string;
  vintage?: number | string;
  region?: string;
  country?: string;
  grapes?: string[];
  type?: string;
  appellation?: string;
  confidence?: number;
}

export interface EnrichmentData {
  overview?: string;
  grapeComposition?: Array<{ grape: string; percentage?: string }>;
  styleProfile?: { body?: string; tannin?: string; acidity?: string; sweetness?: string };
  tastingNotes?: { nose?: string[]; palate?: string[]; finish?: string };
  criticScores?: Array<{ critic: string; score: number; vintage?: number }>;
  drinkWindow?: { start: number; end: number; peak?: number };
  foodPairings?: string[];
}

export interface AgentErrorInfo {
  type: string;
  userMessage: string;
  retryable?: boolean;
  supportRef?: string;
}

export interface BottleFormData {
  bottleSize?: string;
  storageLocation?: string;
  source?: string;
  price?: number;
  currency?: string;
  purchaseDate?: string;
}

export interface ManualEntryData {
  [key: string]: string | number | undefined;
}

// ===========================================
// Utility Types
// ===========================================
export type MessageOf<T extends MessageCategory> = AgentMessage & {
  data: Extract<MessageData, { category: T }>;
};

// Helper to create typed messages
export function createMessage<T extends MessageCategory>(
  category: T,
  data: Omit<Extract<MessageData, { category: T }>, 'category'>,
  options?: Partial<Omit<AgentMessage, 'id' | 'timestamp' | 'category' | 'data'>>
): AgentMessage {
  return {
    id: generateUUID(),
    category,
    role: 'agent',
    timestamp: Date.now(),
    data: { category, ...data } as unknown as MessageData,
    ...options,
  };
}

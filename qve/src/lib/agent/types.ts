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
  | 'image';

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

  // Streaming support (flag, not category)
  isStreaming?: boolean;
  streamingFields?: Map<string, StreamingField>;

  // Category-specific data
  data: MessageData;
}

export interface StreamingField {
  value: string;
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
  | ImageMessageData;

export interface TextMessageData {
  category: 'text';
  content: string;
  variant?: 'greeting' | 'info' | 'warning' | 'success';
}

export interface ChipsMessageData {
  category: 'chips';
  chips: AgentChip[];
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
  data: EnrichmentData;
}

export type FormType = 'bottle_details' | 'manual_entry' | 'match_selection';

export interface FormMessageData {
  category: 'form';
  formType: FormType;
  formData: unknown;
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

// ===========================================
// Action Types (Command Pattern)
// ===========================================
export type AgentAction =
  | { type: 'submit_text'; payload: string }
  | { type: 'submit_image'; payload: { data: string; mimeType: string } }
  | { type: 'chip_tap'; payload: { action: string; messageId: string; data?: unknown } }
  | { type: 'submit_bottle'; payload: BottleFormData }
  | { type: 'select_match'; payload: { entityType: string; matchId: number } }
  | { type: 'create_new'; payload: { entityType: string; name: string } }
  | { type: 'manual_entry_submit'; payload: ManualEntryData }
  | { type: 'start_over' }
  | { type: 'go_back' }
  | { type: 'cancel' };

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
  grapeComposition?: Array<{ grape: string; percentage?: number }>;
  styleProfile?: Record<string, number>;
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
  size?: string;
  location?: string;
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
    id: crypto.randomUUID(),
    category,
    role: 'agent',
    timestamp: Date.now(),
    data: { category, ...data } as unknown as MessageData,
    ...options,
  };
}

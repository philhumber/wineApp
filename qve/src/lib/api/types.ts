/**
 * Qvé API Type Definitions
 * Matches the existing PHP backend response structures
 */

// ─────────────────────────────────────────────────────────
// ENTITY TYPES
// ─────────────────────────────────────────────────────────

export interface Wine {
  wineID: number;
  wineName: string;
  year: string | null;              // PHP returns 'year' not 'wineYear'
  isNonVintage: boolean;            // WIN-176: True for NV wines
  pictureURL: string | null;        // PHP returns 'pictureURL' not 'winePicture'
  description: string | null;       // PHP returns 'description' not 'wineDescription'
  tastingNotes: string | null;
  pairing: string | null;           // PHP returns 'pairing' not 'pairingNotes'
  producerName: string;
  regionName: string;
  countryName: string;
  code: string;                     // Country code (e.g., 'FR')
  wineType: string;                 // PHP returns 'wineType' not 'wineTypeName'
  bottleCount: number;
  avgRating: number | null;
  avgOverallRating?: number | null;  // Average of overallRating across all ratings
  avgValueRating?: number | null;    // Average of valueRating across all ratings
  rating: number | null;            // Individual rating
  // Price fields from PHP
  avgPricePerLiterEUR?: string;
  avgBottlePriceEUR?: string;        // Median bottle price in EUR
  typeAvgPricePerLiterEUR?: string;  // Type average for price scale
  standardPrice?: string | null;
  magnumPrice?: string | null;
  demiPrice?: string | null;
  smallPrice?: string | null;
  currency?: string;
  standardBottles?: string;
  smallBottles?: string;
  largeBottles?: string;
  // Additional details (WIN-111)
  bottleSources?: string | null;     // Comma-separated sources
  buyAgainPercent?: number | null;   // 0-100 percentage
  ratingCount?: number;              // Number of ratings
  // Enrichment tracking (Segment 5)
  enrichment_status?: 'pending' | 'complete' | 'failed' | null;
}

export interface Bottle {
  bottleID: number;
  wineID: number;
  bottleSize: string;
  bottleLocation: string;
  bottleSource: string;
  bottlePrice: number | null;
  bottleCurrency: string | null;
  purchaseDate: string | null;
  isDrunk: boolean;
  drinkDate: string | null;
  overallRating: number | null;
  valueRating: number | null;
  notes: string | null;
}

export interface DrunkWine extends Wine {
  // Rating ID (for updates)
  ratingID: number;
  // Bottle info
  bottleID: number;
  bottleSize: string;
  bottleDrunk: number;
  bottlePrice: string | number | null;  // Bottle price (PHP returns decimal as string)
  bottleCurrency: string | null;        // Currency code (EUR, GBP, USD, etc.)
  // Rating data from ratings table
  drinkDate: string | null;
  overallRating: number | null;
  valueRating: number | null;
  buyAgain: number | null;           // PHP returns 0/1, not boolean
  notes: string | null;              // Mapped from Notes (capital N in PHP)
  // Optional ratings (0-5 scale, null if not provided)
  complexityRating: number | null;
  drinkabilityRating: number | null;
  surpriseRating: number | null;
  foodPairingRating: number | null;
}

// ─────────────────────────────────────────────────────────
// DROPDOWN/LOOKUP TYPES
// ─────────────────────────────────────────────────────────

export interface Country {
  countryName: string;
  code: string;
  bottleCount?: number;
}

export interface Region {
  regionID: number;
  regionName: string;
  countryID: number;
  countryName?: string;
  bottleCount?: number;
}

export interface Producer {
  producerID: number;
  producerName: string;
  regionID: number;
  regionName?: string;
  bottleCount?: number;
}

export interface WineType {
  wineTypeID?: number;
  wineTypeName: string;
  wineType?: string; // PHP returns this field name
  bottleCount?: number;
}

export interface Year {
  wineYear: string;
  bottleCount?: number;
}

// ─────────────────────────────────────────────────────────
// FILTER TYPES
// ─────────────────────────────────────────────────────────

export interface WineFilters {
  typesDropdown?: string;
  countryDropdown?: string;
  regionDropdown?: string;
  producerDropdown?: string;
  yearDropdown?: string;
  bottleCount?: '0' | '1';  // '1' = has bottles (Our Wines), '0' = all
  searchQuery?: string;     // WIN-24: Free text search (min 3 chars)
  wineID?: string | number;
}

// ─────────────────────────────────────────────────────────
// API RESPONSE TYPES
// ─────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface WineListResponse {
  wineList: Wine[];
}

export interface BottleListResponse {
  bottleList: Bottle[];
}

// ─────────────────────────────────────────────────────────
// MUTATION PAYLOAD TYPES
// ─────────────────────────────────────────────────────────

/**
 * AddWinePayload - matches PHP addWine.php expected field names
 * Uses search-first pattern: findX for existing, xName for new
 */
export interface AddWinePayload {
  // Region - either existing (findRegion) or new (regionName + details)
  findRegion: string;
  regionName: string;
  regionCountry: string;
  regionDescription?: string;
  regionClimate?: string;
  regionSoil?: string;
  regionMap?: string;

  // Producer - either existing (findProducer) or new (producerName + details)
  findProducer: string;
  producerName: string;
  producerTown?: string;
  producerFounded?: string;
  producerOwnership?: string;
  producerDescription?: string;

  // Wine - either existing (findWine) or new (wineName + details)
  findWine: string;
  wineName: string;
  wineYear: string;
  isNonVintage?: boolean;           // WIN-176: True for NV wines
  wineType: string;
  appellation?: string; // WIN-148: Specific appellation (e.g., Margaux)
  wineDescription?: string;
  wineTasting?: string;
  winePairing?: string;
  winePicture?: string;

  // Bottle details
  bottleType: string;
  storageLocation: string;
  bottleSource: string;
  bottlePrice?: string;
  bottleCurrency?: string;
  bottlePurchaseDate?: string;
}

export interface AddBottlePayload {
  wineID: number;
  bottleSize: string;
  bottleLocation?: string;
  bottleSource?: string;
  bottlePrice?: number;
  bottleCurrency?: string;
  purchaseDate?: string;
  quantity?: number; // WIN-222: Batch insert for atomicity
}

// WIN-222: Response type for addBottle (single or batch)
export interface AddBottleResponse {
  bottleID?: number;      // Single bottle insert
  bottleIDs?: number[];   // Batch insert (quantity > 1)
}

export interface UpdateWinePayload {
  wineID: number;
  wineName: string;
  wineType: string;          // PHP expects 'wineType' (name), not wineTypeID
  wineYear?: string;
  isNonVintage?: boolean;    // WIN-176: True for NV wines
  wineDescription: string;
  wineTasting: string;       // PHP expects 'wineTasting'
  winePairing: string;       // PHP expects 'winePairing'
  winePicture: string;
}

export interface UpdateBottlePayload {
  bottleID: number;
  bottleSize: string;
  location: string;          // PHP expects 'location', not 'bottleLocation'
  bottleSource: string;
  bottlePrice?: number;
  bottleCurrency?: string;
  purchaseDate?: string;
}

export interface DrinkBottlePayload {
  wineID: number;
  bottleID: number;
  overallRating: number;
  valueRating: number;
  drinkDate: string;
  buyAgain?: 0 | 1;
  notes?: string;
  // Optional ratings (0-5 scale)
  complexityRating?: number;
  drinkabilityRating?: number;
  surpriseRating?: number;
  foodPairingRating?: number;
}

export interface UpdateRatingPayload {
  ratingID: number;
  wineID: number;
  bottleID: number;
  overallRating: number;
  valueRating: number;
  drinkDate: string;
  buyAgain?: 0 | 1;
  notes?: string;
  // Optional ratings (0-5 scale)
  complexityRating?: number;
  drinkabilityRating?: number;
  surpriseRating?: number;
  foodPairingRating?: number;
}

// ─────────────────────────────────────────────────────────
// SOFT DELETE TYPES (WIN-80)
// ─────────────────────────────────────────────────────────

export type DeleteEntityType = 'wine' | 'bottle' | 'producer' | 'region';

export interface DeleteImpact {
  producers?: { count: number; names?: string[] };
  wines?: { count: number; names?: string[] };
  bottles?: { count: number; names?: string[] };
  ratings?: { count: number };
}

export interface DeleteImpactResponse {
  entity: {
    type: DeleteEntityType;
    id: number;
    name: string;
  };
  impact: DeleteImpact;
}

export interface DeleteItemResponse {
  deletedId: number;
  deletedType: DeleteEntityType;
  cascade?: {
    wines?: number;
    bottles?: number;
    ratings?: number;
  };
}

// ─────────────────────────────────────────────────────────
// AI RESPONSE TYPES
// ─────────────────────────────────────────────────────────

export interface AIRegionData {
  description?: string;
  climate?: string;
  soil?: string;
  map?: string;
}

export interface AIProducerData {
  description?: string;
  founded?: number | string;
  town?: string;
  ownership?: string;
}

export interface AIWineData {
  description?: string;
  tasting?: string;
  pairing?: string;
  drinkwindow?: {
    start?: number;
    end?: number;
  };
}

// ─────────────────────────────────────────────────────────
// CURRENCY & BOTTLE SIZE TYPES
// ─────────────────────────────────────────────────────────

export interface Currency {
  currencyCode: string;
  currencyName: string;
  symbol: string;
  rateToEUR: number;
}

export interface BottleSize {
  sizeCode: string;
  sizeName: string;
  volumeLitres: number;
}

export interface CurrencyDataResponse {
  currencies: Currency[];
  bottleSizes: BottleSize[];
}

// ─────────────────────────────────────────────────────────
// USER SETTINGS TYPES (WIN-126)
// ─────────────────────────────────────────────────────────

export interface UserSettings {
  collectionName: string;
}

export interface UpdateSettingsPayload {
  collectionName?: string;
}

// ─────────────────────────────────────────────────────────
// CELLAR VALUE TYPES (WIN-127)
// ─────────────────────────────────────────────────────────

export interface CellarValue {
  totalValueEUR: number;
  bottleCount: number;
  bottlesWithPrice: number;
  bottlesWithoutPrice: number;
  hasIncompleteData: boolean;
}

// DUPLICATE CHECK TYPES
// ─────────────────────────────────────────────────────────

export type DuplicateCheckType = 'region' | 'producer' | 'wine';

export interface DuplicateCheckParams {
  type: DuplicateCheckType;
  name: string;
  producerId?: number;
  producerName?: string;
  regionId?: number;
  regionName?: string;
  year?: string;
}

export interface DuplicateMatch {
  id: number;
  name: string;
  meta?: string;
  bottleCount?: number;
}

export interface DuplicateCheckResult {
  exactMatch: DuplicateMatch | null;
  similarMatches: DuplicateMatch[];
  existingBottles: number;
  existingWineId: number | null;
}

// ─────────────────────────────────────────────────────────
// AI AGENT TYPES
// ─────────────────────────────────────────────────────────

export type AgentWineType = 'Red' | 'White' | 'Rosé' | 'Sparkling' | 'Dessert' | 'Fortified';

export interface AgentParsedWine {
  producer: string | null;
  wineName: string | null;
  vintage: string | null;
  region: string | null;
  appellation: string | null; // WIN-148: Specific appellation (e.g., Margaux) if different from region
  country: string | null;
  wineType: AgentWineType | null;
  grapes: string[] | null;
  confidence: number;
}

export interface AgentCandidate {
  source: 'collection' | 'reference';
  confidence: number;
  data: Record<string, unknown>;
}

export type AgentAction = 'auto_populate' | 'suggest' | 'user_choice' | 'disambiguate';

export type AgentInputType = 'text' | 'image';

export interface AgentTierResult {
  model: string;
  confidence: number;
  cost: number;
  latencyMs: number;
  timestamp: string;
  thinking_level?: string; // Only for tier1_5
}

export interface AgentEscalationMeta {
  tiers: {
    tier1?: AgentTierResult;
    tier1_5?: AgentTierResult;
    tier2?: AgentTierResult;
    tier3?: AgentTierResult;
  };
  final_tier: 'tier1' | 'tier1_5' | 'tier2' | 'tier3' | 'user_choice';
  total_cost: number;
  total_latency: number;
}

export interface AgentIdentificationResult {
  intent: 'add' | 'advice' | 'pair';
  parsed: AgentParsedWine;
  confidence: number;
  action: AgentAction;
  candidates: AgentCandidate[];
  escalation?: AgentEscalationMeta;
  inferences_applied?: string[];
  usage?: {
    tokens: { input: number; output: number };
    cost: number;
    latencyMs: number;
  };
}

export interface AgentImageQuality {
  width: number;
  height: number;
  estimatedQuality: 'good' | 'acceptable' | 'poor';
}

export interface AgentIdentificationResultWithMeta extends AgentIdentificationResult {
  inputType: 'text' | 'image';
  quality?: AgentImageQuality;
}

// ─────────────────────────────────────────────────────────
// AI AGENT CLARIFICATION TYPES
// ─────────────────────────────────────────────────────────

export interface AgentClarificationRequest {
  type: DuplicateCheckType;  // Reuses existing 'region' | 'producer' | 'wine'
  identified: AgentParsedWine;
  options: DuplicateMatch[];
  userId?: number;
}

export interface AgentClarificationResult {
  explanation: string;
}

// ─────────────────────────────────────────────────────────
// AI AGENT ENRICHMENT TYPES (Phase 2.5)
// ─────────────────────────────────────────────────────────

export interface AgentUsage {
  tokens: { input: number; output: number };
  cost: number;
  latencyMs: number;
}

export interface GrapeVariety {
  grape: string;
  percentage: string | null;
  source?: string;
}

export interface CriticScore {
  critic: string;      // "WS", "RP", "Decanter", "JS"
  score: number;       // 50-100
  year?: number;       // Review year
  source?: string;     // URL reference
}

export interface DrinkWindow {
  start: number | null;
  end: number | null;
  maturity?: 'young' | 'ready' | 'peak' | 'declining';
}

export interface AgentEnrichmentData {
  grapeVarieties: GrapeVariety[] | null;
  appellation: string | null;
  alcoholContent: number | null;
  drinkWindow: DrinkWindow | null;
  productionMethod: string | null;
  criticScores: CriticScore[] | null;
  averagePrice: number | null;
  priceSource: string | null;
  body: string | null;
  tannin: string | null;
  acidity: string | null;
  sweetness: string | null;
  overview: string | null;
  tastingNotes: string | null;
  pairingNotes: string | null;
  confidence: number;
  sources: string[];
}

/**
 * WIN-162: Match type for canonical resolution
 */
export type CacheMatchType = 'exact' | 'abbreviation' | 'alias' | 'fuzzy';

/**
 * WIN-162: Wine identification for confirmation display
 */
export interface WineIdentificationSummary {
  producer: string | null;
  wineName: string | null;
  vintage: string | null;
}

export interface AgentEnrichmentResult {
  success: boolean;
  data: AgentEnrichmentData | null;
  source: 'cache' | 'web_search' | 'inference';
  warnings: string[];
  fieldSources: Record<string, string> | null;
  usage: AgentUsage | null;
  // WIN-162: Canonical resolution confirmation fields
  pendingConfirmation?: boolean;
  matchType?: CacheMatchType;
  searchedFor?: WineIdentificationSummary;
  matchedTo?: WineIdentificationSummary;
  confidence?: number;
}

// ─────────────────────────────────────────────────────────
// AI AGENT ERROR TYPES
// ─────────────────────────────────────────────────────────

/**
 * Agent error types matching backend classification.
 * Used for structured error handling and user-friendly messaging.
 */
export type AgentErrorType =
  | 'timeout'
  | 'rate_limit'
  | 'limit_exceeded'
  | 'server_error'
  | 'overloaded'
  | 'database_error'
  | 'ssl_error'
  | 'quality_check_failed'
  | 'identification_error'
  | 'enrichment_error'
  | 'clarification_error'
  | 'unknown';

/**
 * Structured error information from agent endpoints.
 * Contains type classification, user message, and retry guidance.
 */
export interface AgentErrorInfo {
  type: AgentErrorType;
  userMessage: string;
  retryable: boolean;
  supportRef?: string | null;
}

/**
 * Error response structure from agent endpoints.
 * All agent errors return this shape for consistent handling.
 */
export interface AgentErrorResponse {
  success: false;
  message: string;
  error: AgentErrorInfo;
}

/**
 * Custom error class for agent-related failures.
 * Extends Error with structured error information.
 */
export class AgentError extends Error {
  type: AgentErrorType;
  userMessage: string;
  retryable: boolean;
  supportRef: string | null;

  constructor(errorInfo: AgentErrorInfo, fallbackMessage?: string) {
    super(errorInfo.userMessage || fallbackMessage || 'Something went wrong');
    this.name = 'AgentError';
    this.type = errorInfo.type;
    this.userMessage = errorInfo.userMessage;
    this.retryable = errorInfo.retryable;
    this.supportRef = errorInfo.supportRef || null;
  }

  /**
   * Create AgentError from a structured error response
   */
  static fromResponse(json: AgentErrorResponse): AgentError {
    return new AgentError(json.error, json.message);
  }

  /**
   * Type guard to check if an error is an AgentError
   */
  static isAgentError(error: unknown): error is AgentError {
    return error instanceof AgentError;
  }
}

// ─────────────────────────────────────────────────────────
// SSE STREAMING TYPES (WIN-181)
// ─────────────────────────────────────────────────────────

/**
 * Individual field update from SSE stream.
 * Emitted as fields are parsed from streaming LLM response.
 */
export interface StreamFieldEvent {
  field: string;
  value: unknown;
}

/**
 * Error event from SSE stream.
 * Contains structured error info for display and retry logic.
 */
export interface StreamErrorEvent {
  type: AgentErrorType;
  message: string;
  retryable: boolean;
  supportRef?: string;
}

/**
 * Confirmation required event for canonical name resolution.
 * Emitted when enrichment finds a non-exact cache match.
 */
export interface StreamConfirmationEvent {
  matchType: CacheMatchType;
  searchedFor: WineIdentificationSummary | null;
  matchedTo: WineIdentificationSummary | null;
  confidence: number;
}

/**
 * Union type for all SSE stream events.
 * Discriminated union allows type-safe event handling.
 */
export type StreamEvent =
  | { type: 'field'; data: StreamFieldEvent }
  | { type: 'result'; data: AgentIdentificationResultWithMeta }
  | { type: 'escalating'; data: { message: string } }
  | { type: 'confirmation_required'; data: StreamConfirmationEvent }
  | { type: 'error'; data: StreamErrorEvent }
  | { type: 'done'; data: Record<string, never> };

/**
 * Callback type for handling individual field updates during streaming.
 */
export type StreamFieldCallback = (field: string, value: unknown) => void;

/**
 * Callback type for handling complete stream events.
 */
export type StreamEventCallback = (event: StreamEvent) => void;

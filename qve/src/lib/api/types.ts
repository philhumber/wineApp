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
  rating: number | null;            // Individual rating
  // Price fields from PHP
  avgPricePerLiterEUR?: string;
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
  wineType: string;
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
}

export interface UpdateWinePayload {
  wineID: number;
  wineName: string;
  wineType: string;          // PHP expects 'wineType' (name), not wineTypeID
  wineYear?: string;
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
  buyAgain?: boolean;
  notes?: string;
  // Optional ratings (0-5 scale)
  complexityRating?: number;
  drinkabilityRating?: number;
  surpriseRating?: number;
  foodPairingRating?: number;
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

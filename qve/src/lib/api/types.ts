/**
 * Qve API Type Definitions
 * Matches the existing PHP backend response structures
 */

// ─────────────────────────────────────────────────────────
// ENTITY TYPES
// ─────────────────────────────────────────────────────────

export interface Wine {
  wineID: number;
  wineName: string;
  wineYear: string;
  winePicture: string | null;
  wineDescription: string | null;
  tastingNotes: string | null;
  pairingNotes: string | null;
  producerID: number;
  producerName: string;
  regionID: number;
  regionName: string;
  countryID: number;
  countryName: string;
  countryEmoji: string;
  wineTypeID: number;
  wineTypeName: string;
  bottleCount: number;
  avgRating: number | null;
  avgValue: number | null;
  // Price calculation fields (from getWines.php)
  minPricePerLiter?: number;
  maxPricePerLiter?: number;
  medianPricePerLiter?: number;
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
  drinkDate: string;
  overallRating: number;
  valueRating: number;
  buyAgain: boolean;
  notes: string | null;
}

// ─────────────────────────────────────────────────────────
// DROPDOWN/LOOKUP TYPES
// ─────────────────────────────────────────────────────────

export interface Country {
  countryID: number;
  countryName: string;
  countryEmoji: string;
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
  wineTypeID: number;
  wineTypeName: string;
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

export interface AddWinePayload {
  // Region (new or existing)
  regionID?: number;
  regionName?: string;
  countryID?: number;
  countryName?: string;

  // Producer (new or existing)
  producerID?: number;
  producerName?: string;

  // Wine details
  wineName: string;
  wineYear: string;
  wineTypeID: number;
  wineDescription?: string;
  tastingNotes?: string;
  pairingNotes?: string;
  winePicture?: string;

  // Bottle details
  bottleSize?: string;
  bottleLocation?: string;
  bottleSource?: string;
  bottlePrice?: number;
  bottleCurrency?: string;
  purchaseDate?: string;
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
  wineName?: string;
  wineYear?: string;
  wineTypeID?: number;
  wineDescription?: string;
  tastingNotes?: string;
  pairingNotes?: string;
  winePicture?: string;
}

export interface UpdateBottlePayload {
  bottleID: number;
  bottleSize?: string;
  bottleLocation?: string;
  bottleSource?: string;
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
}

// ─────────────────────────────────────────────────────────
// AI RESPONSE TYPES
// ─────────────────────────────────────────────────────────

export interface AIRegionData {
  description?: string;
  climate?: string;
  terroir?: string;
  grapes?: string[];
}

export interface AIProducerData {
  description?: string;
  founded?: string;
  winemaker?: string;
  philosophy?: string;
}

export interface AIWineData {
  description?: string;
  tastingNotes?: string;
  pairingNotes?: string;
  grapes?: string[];
  agingPotential?: string;
}

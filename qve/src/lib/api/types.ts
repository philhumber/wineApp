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

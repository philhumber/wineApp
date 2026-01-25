/**
 * Qvé API Client
 * Communicates with existing PHP backend at /resources/php/
 */

import type {
  Wine,
  Bottle,
  DrunkWine,
  Country,
  Region,
  Producer,
  WineType,
  Year,
  WineFilters,
  ApiResponse,
  AddWinePayload,
  AddBottlePayload,
  UpdateWinePayload,
  UpdateBottlePayload,
  DrinkBottlePayload,
  UpdateRatingPayload,
  AIRegionData,
  AIProducerData,
  AIWineData,
  CurrencyDataResponse,
  DuplicateCheckParams,
  DuplicateCheckResult
} from './types';

class WineApiClient {
  private baseURL: string;

  constructor(baseURL = '/resources/php/') {
    this.baseURL = baseURL;
  }

  // ─────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────

  /**
   * Generic fetch with JSON body and response
   */
  private async fetchJSON<T>(
    endpoint: string,
    data?: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    const options: RequestInit = data
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' };

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      return json;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  /**
   * Map frontend filter keys to backend expected parameter names
   * The PHP backend expects: typesDropdown, countryDropdown, etc.
   */
  private mapFilters(filters: WineFilters): Record<string, string> {
    const mapped: Record<string, string> = {};

    if (filters.typesDropdown) mapped.typesDropdown = filters.typesDropdown;
    if (filters.countryDropdown) mapped.countryDropdown = filters.countryDropdown;
    if (filters.regionDropdown) mapped.regionDropdown = filters.regionDropdown;
    if (filters.producerDropdown) mapped.producerDropdown = filters.producerDropdown;
    if (filters.yearDropdown) mapped.yearDropdown = filters.yearDropdown;
    if (filters.bottleCount) mapped.bottleCount = filters.bottleCount;
    if (filters.wineID) mapped.wineID = String(filters.wineID);

    return mapped;
  }

  // ─────────────────────────────────────────────────────────
  // READ ENDPOINTS
  // ─────────────────────────────────────────────────────────

  /**
   * Get wines with optional filters
   * Default: returns wines with bottles (Our Wines view)
   */
  async getWines(filters: WineFilters = {}): Promise<Wine[]> {
    // Default to showing wines with bottles if not specified
    const defaultedFilters = {
      bottleCount: '1' as const,
      ...filters
    };

    const response = await this.fetchJSON<{ wineList: Wine[] }>(
      'getWines.php',
      this.mapFilters(defaultedFilters)
    );

    return response.data?.wineList ?? [];
  }

  /**
   * Get single wine by ID
   */
  async getWine(wineID: number): Promise<Wine | null> {
    const wines = await this.getWines({ wineID: String(wineID), bottleCount: '0' });
    return wines[0] ?? null;
  }

  /**
   * Get countries for dropdown
   * Context-aware: can filter by typeName, regionName, producerName, and/or year
   */
  async getCountries(options: {
    withBottleCount?: boolean;
    typeName?: string;
    regionName?: string;
    producerName?: string;
    year?: string;
  } = {}): Promise<Country[]> {
    const { withBottleCount = false, typeName, regionName, producerName, year } = options;
    const params: Record<string, string> = {};

    if (withBottleCount) params.bottleCount = '1';
    if (typeName) params.typeName = typeName;
    if (regionName) params.regionName = regionName;
    if (producerName) params.producerName = producerName;
    if (year) params.year = year;

    const response = await this.fetchJSON<{ wineList: Country[] }>(
      'getCountries.php',
      params
    );
    return response.data?.wineList ?? [];
  }

  /**
   * Get regions for dropdown
   * Context-aware: can filter by countryName, typeName, producerName, and/or year
   */
  async getRegions(options: {
    withBottleCount?: boolean;
    countryName?: string;
    typeName?: string;
    producerName?: string;
    year?: string;
  } = {}): Promise<Region[]> {
    const { withBottleCount = false, countryName, typeName, producerName, year } = options;
    const params: Record<string, string> = {};

    if (withBottleCount) params.bottleCount = '1';
    if (countryName) params.countryName = countryName;
    if (typeName) params.typeName = typeName;
    if (producerName) params.producerName = producerName;
    if (year) params.year = year;

    const response = await this.fetchJSON<{ wineList: Region[] }>(
      'getRegions.php',
      params
    );
    return response.data?.wineList ?? [];
  }

  /**
   * Get producers for dropdown
   * Context-aware: can filter by countryName, regionName, typeName, and/or year
   */
  async getProducers(options: {
    withBottleCount?: boolean;
    countryName?: string;
    regionName?: string;
    typeName?: string;
    year?: string;
  } = {}): Promise<Producer[]> {
    const { withBottleCount = false, countryName, regionName, typeName, year } = options;
    const params: Record<string, string> = {};

    if (withBottleCount) params.bottleCount = '1';
    if (countryName) params.countryName = countryName;
    if (regionName) params.regionName = regionName;
    if (typeName) params.typeName = typeName;
    if (year) params.year = year;

    const response = await this.fetchJSON<{ wineList: Producer[] }>(
      'getProducers.php',
      params
    );
    return response.data?.wineList ?? [];
  }

  /**
   * Get wine types for dropdown
   * Context-aware: can filter by countryName, regionName, producerName, and/or year
   */
  async getTypes(options: {
    withBottleCount?: boolean;
    countryName?: string;
    regionName?: string;
    producerName?: string;
    year?: string;
  } = {}): Promise<WineType[]> {
    const { withBottleCount = false, countryName, regionName, producerName, year } = options;
    const params: Record<string, string> = {};

    if (withBottleCount) params.bottleCount = '1';
    if (countryName) params.countryName = countryName;
    if (regionName) params.regionName = regionName;
    if (producerName) params.producerName = producerName;
    if (year) params.year = year;

    const response = await this.fetchJSON<{ wineList: Array<{ wineType: string; bottleCount?: number }> }>(
      'getTypes.php',
      params
    );
    // Map PHP field name (wineType) to our interface (wineTypeName)
    return (response.data?.wineList ?? []).map(t => ({
      wineTypeName: t.wineType,
      bottleCount: t.bottleCount
    }));
  }

  /**
   * Get vintage years for dropdown
   * Context-aware: can filter by countryName, regionName, producerName, and/or typeName
   */
  async getYears(options: {
    withBottleCount?: boolean;
    countryName?: string;
    regionName?: string;
    producerName?: string;
    typeName?: string;
  } = {}): Promise<Year[]> {
    const { withBottleCount = true, countryName, regionName, producerName, typeName } = options;
    const params: Record<string, string> = {};

    if (withBottleCount) params.bottleCount = '1';
    if (countryName) params.countryName = countryName;
    if (regionName) params.regionName = regionName;
    if (producerName) params.producerName = producerName;
    if (typeName) params.typeName = typeName;

    const response = await this.fetchJSON<{ wineList: Year[] }>(
      'getYears.php',
      params
    );
    return response.data?.wineList ?? [];
  }

  /**
   * Get bottles for a specific wine (only non-drunk bottles)
   * Maps PHP field names to TypeScript interface names
   */
  async getBottles(wineID: number): Promise<Bottle[]> {
    interface PHPBottle {
      bottleID: number;
      bottleSize: string;
      source: string;
      price: number | null;
      currency: string | null;
      location: string;
      dateAdded: string | null;
      purchaseDate: string | null;
    }
    const response = await this.fetchJSON<{ bottleList: PHPBottle[] }>(
      'getBottles.php',
      { wineID }
    );
    // Map PHP field names to TypeScript interface
    // Use purchaseDate if available, otherwise fall back to dateAdded
    return (response.data?.bottleList ?? []).map((b) => ({
      bottleID: b.bottleID,
      wineID: wineID,
      bottleSize: b.bottleSize,
      bottleLocation: b.location,
      bottleSource: b.source,
      bottlePrice: b.price,
      bottleCurrency: b.currency,
      purchaseDate: b.purchaseDate || b.dateAdded,
      isDrunk: false,
      drinkDate: null,
      overallRating: null,
      valueRating: null,
      notes: null
    }));
  }

  /**
   * Get drunk wines with ratings (history view)
   */
  async getDrunkWines(): Promise<DrunkWine[]> {
    const response = await this.fetchJSON<{ wineList: DrunkWine[] }>(
      'getDrunkWines.php'
    );
    return response.data?.wineList ?? [];
  }

  /**
   * Get currencies and bottle sizes reference data
   */
  async getCurrencies(): Promise<CurrencyDataResponse> {
    const response = await this.fetchJSON<CurrencyDataResponse>(
      'getCurrencies.php'
    );
    return response.data ?? { currencies: [], bottleSizes: [] };
  }

  // ─────────────────────────────────────────────────────────
  // WRITE ENDPOINTS
  // ─────────────────────────────────────────────────────────

  /**
   * Add new wine with bottle (multi-table transaction)
   */
  async addWine(data: AddWinePayload): Promise<{ wineID: number; bottleID: number }> {
    const response = await this.fetchJSON<{ wineID: number; bottleID: number }>(
      'addWine.php',
      data as unknown as Record<string, unknown>
    );

    if (!response.success) {
      throw new Error(response.message || 'Failed to add wine');
    }

    return response.data;
  }

  /**
   * Add bottle to existing wine
   * Maps TypeScript field names to PHP backend expected names
   */
  async addBottle(data: AddBottlePayload): Promise<{ bottleID: number }> {
    // Map TypeScript fields to PHP expected field names
    const payload: Record<string, unknown> = {
      wineID: data.wineID,
      bottleType: data.bottleSize,           // PHP expects 'bottleType'
      storageLocation: data.bottleLocation,  // PHP expects 'storageLocation'
      bottleSource: data.bottleSource,
      bottlePrice: data.bottlePrice,
      bottleCurrency: data.bottleCurrency,
      purchaseDate: data.purchaseDate
    };

    const response = await this.fetchJSON<{ bottleID: number }>(
      'addBottle.php',
      payload
    );

    if (!response.success) {
      throw new Error(response.message || 'Failed to add bottle');
    }

    return response.data;
  }

  /**
   * Update wine details
   */
  async updateWine(data: UpdateWinePayload): Promise<void> {
    const response = await this.fetchJSON<void>(
      'updateWine.php',
      data as unknown as Record<string, unknown>
    );

    if (!response.success) {
      throw new Error(response.message || 'Failed to update wine');
    }
  }

  /**
   * Update bottle details
   */
  async updateBottle(data: UpdateBottlePayload): Promise<void> {
    const response = await this.fetchJSON<void>(
      'updateBottle.php',
      data as unknown as Record<string, unknown>
    );

    if (!response.success) {
      throw new Error(response.message || 'Failed to update bottle');
    }
  }

  /**
   * Mark bottle as drunk with rating (transaction)
   */
  async drinkBottle(data: DrinkBottlePayload): Promise<void> {
    const response = await this.fetchJSON<void>(
      'drinkBottle.php',
      data as unknown as Record<string, unknown>
    );

    if (!response.success) {
      throw new Error(response.message || 'Failed to record drink');
    }
  }

  /**
   * Update an existing rating
   */
  async updateRating(data: UpdateRatingPayload): Promise<void> {
    const response = await this.fetchJSON<void>(
      'updateRating.php',
      data as unknown as Record<string, unknown>
    );

    if (!response.success) {
      throw new Error(response.message || 'Failed to update rating');
    }
  }

  // ─────────────────────────────────────────────────────────
  // FILE UPLOAD
  // ─────────────────────────────────────────────────────────

  /**
   * Upload wine image (returns filename)
   * Backend processes to 800x800px with edge-sampled background
   */
  async uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('fileToUpload', file);

    const response = await fetch(`${this.baseURL}upload.php`, {
      method: 'POST',
      body: formData
    });

    const text = await response.text();

    // Backend returns "Filename: xyz.jpg" on success
    if (text.startsWith('Filename: ')) {
      return text.replace('Filename: ', '').trim();
    }

    throw new Error(text || 'Upload failed');
  }

  // ─────────────────────────────────────────────────────────
  // AI INTEGRATION
  // ─────────────────────────────────────────────────────────

  /**
   * Call Gemini AI to generate region data
   */
  async getAIRegionData(regionName: string, countryName: string): Promise<AIRegionData> {
    const response = await this.fetchJSON<AIRegionData>(
      'geminiAPI.php',
      { type: 'region', prompt: `${regionName}, ${countryName}` }
    );
    return response.data ?? {};
  }

  /**
   * Call Gemini AI to generate producer data
   */
  async getAIProducerData(producerName: string, regionName: string): Promise<AIProducerData> {
    const response = await this.fetchJSON<AIProducerData>(
      'geminiAPI.php',
      { type: 'producer', prompt: `${producerName} from ${regionName}` }
    );
    return response.data ?? {};
  }

  /**
   * Call Gemini AI to generate wine data
   */
  async getAIWineData(wineName: string, producerName: string, year: string): Promise<AIWineData> {
    const response = await this.fetchJSON<AIWineData>(
      'geminiAPI.php',
      { type: 'wine', prompt: `${wineName} ${year} by ${producerName}` }
    );
    return response.data ?? {};
  }

  // ─────────────────────────────────────────────────────────
  // DUPLICATE CHECKING
  // ─────────────────────────────────────────────────────────

  /**
   * Check for duplicate/similar entries when adding new items
   * Used to warn users before creating duplicates
   */
  async checkDuplicate(params: DuplicateCheckParams): Promise<DuplicateCheckResult> {
    const response = await this.fetchJSON<DuplicateCheckResult>(
      'checkDuplicate.php',
      params as unknown as Record<string, unknown>
    );
    return response.data ?? {
      exactMatch: null,
      similarMatches: [],
      existingBottles: 0,
      existingWineId: null
    };
  }
}

// Singleton instance
export const api = new WineApiClient();
export default api;

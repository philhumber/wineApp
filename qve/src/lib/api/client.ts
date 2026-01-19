/**
 * Qve API Client
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
  AIRegionData,
  AIProducerData,
  AIWineData
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
   * Get all countries for dropdown
   */
  async getCountries(withBottleCount = true): Promise<Country[]> {
    const response = await this.fetchJSON<{ wineList: Country[] }>(
      'getCountries.php',
      withBottleCount ? { bottleCount: '1' } : {}
    );
    return response.data?.wineList ?? [];
  }

  /**
   * Get regions, optionally filtered by country
   */
  async getRegions(filters?: { countryID?: number; withBottleCount?: boolean }): Promise<Region[]> {
    const params: Record<string, string> = {};
    if (filters?.withBottleCount) params.bottleCount = '1';

    const response = await this.fetchJSON<{ wineList: Region[] }>(
      'getRegions.php',
      params
    );
    return response.data?.wineList ?? [];
  }

  /**
   * Get producers, optionally filtered by region
   */
  async getProducers(filters?: { regionName?: string; withBottleCount?: boolean }): Promise<Producer[]> {
    const params: Record<string, string> = {};
    if (filters?.regionName) params.regionName = filters.regionName;
    if (filters?.withBottleCount) params.bottleCount = '1';

    const response = await this.fetchJSON<{ wineList: Producer[] }>(
      'getProducers.php',
      params
    );
    return response.data?.wineList ?? [];
  }

  /**
   * Get wine types for dropdown
   */
  async getTypes(withBottleCount = true): Promise<WineType[]> {
    const response = await this.fetchJSON<{ wineList: WineType[] }>(
      'getTypes.php',
      withBottleCount ? { bottleCount: '1' } : {}
    );
    return response.data?.wineList ?? [];
  }

  /**
   * Get vintage years for dropdown
   */
  async getYears(withBottleCount = true): Promise<Year[]> {
    const response = await this.fetchJSON<{ wineList: Year[] }>(
      'getYears.php',
      withBottleCount ? { bottleCount: '1' } : {}
    );
    return response.data?.wineList ?? [];
  }

  /**
   * Get bottles for a specific wine (only non-drunk bottles)
   */
  async getBottles(wineID: number): Promise<Bottle[]> {
    const response = await this.fetchJSON<{ bottleList: Bottle[] }>(
      'getBottles.php',
      { wineID }
    );
    return response.data?.bottleList ?? [];
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
   */
  async addBottle(data: AddBottlePayload): Promise<{ bottleID: number }> {
    const response = await this.fetchJSON<{ bottleID: number }>(
      'addBottle.php',
      data as unknown as Record<string, unknown>
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
}

// Singleton instance
export const api = new WineApiClient();
export default api;

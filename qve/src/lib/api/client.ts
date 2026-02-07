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
  UserSettings,
  UpdateSettingsPayload,
  CellarValue,
  DuplicateCheckParams,
  DuplicateCheckResult,
  AgentIdentificationResult,
  AgentIdentificationResultWithMeta,
  AgentEnrichmentResult,
  AgentClarificationRequest,
  AgentClarificationResult,
  AgentErrorResponse,
  StreamEvent,
  StreamEventCallback,
  StreamFieldCallback
} from './types';
import { AgentError } from './types';
import { PUBLIC_API_KEY } from '$env/static/public';

class WineApiClient {
  private baseURL: string;

  constructor(baseURL = '/resources/php/') {
    this.baseURL = baseURL;
  }

  // ─────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────

  /**
   * Common headers included in every request.
   * - X-API-Key: API key authentication (WIN-203)
   * - X-Requested-With: CSRF protection custom header (WIN-215)
   */
  private get authHeaders(): Record<string, string> {
    return {
      'X-API-Key': PUBLIC_API_KEY,
      'X-Requested-With': 'XMLHttpRequest'
    };
  }

  /**
   * Generic fetch with JSON body and response.
   * Handles structured agent errors with user-friendly messages.
   */
  private async fetchJSON<T>(
    endpoint: string,
    data?: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    const options: RequestInit = data
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...this.authHeaders },
          body: JSON.stringify(data)
        }
      : { method: 'POST', headers: { 'Content-Type': 'application/json', ...this.authHeaders }, body: '{}' };

    try {
      const response = await fetch(url, options);
      const json = await response.json();

      // Check for structured agent error (works for both HTTP errors and 200 with success:false)
      if (!json.success && json.error?.type) {
        throw AgentError.fromResponse(json as AgentErrorResponse);
      }

      // Generic HTTP error without structured info
      if (!response.ok) {
        throw new Error(json.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return json;
    } catch (error) {
      // Re-throw AgentError as-is to preserve structured error info
      if (AgentError.isAgentError(error)) {
        throw error;
      }
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  /**
   * Parse and process Server-Sent Events from a streaming response.
   * Handles event: and data: lines, calling onEvent for each complete event.
   */
  private async processSSEStream(
    response: Response,
    onEvent: StreamEventCallback
  ): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = 'message';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            const dataStr = line.slice(5).trim();
            if (dataStr) {
              try {
                const data = JSON.parse(dataStr);
                onEvent({ type: currentEvent, data } as StreamEvent);
              } catch {
                console.warn('Failed to parse SSE data:', dataStr);
              }
            }
            currentEvent = 'message'; // Reset for next event
          }
          // Ignore empty lines and comments (lines starting with :)
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const dataStr = line.slice(5).trim();
            if (dataStr) {
              try {
                const data = JSON.parse(dataStr);
                onEvent({ type: currentEvent, data } as StreamEvent);
              } catch {
                console.warn('Failed to parse final SSE data:', dataStr);
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
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
      headers: { ...this.authHeaders },
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

  // ─────────────────────────────────────────────────────────
  // USER SETTINGS (WIN-126)
  // ─────────────────────────────────────────────────────────

  /**
   * Get user settings (collection name, etc.)
   */
  async getUserSettings(): Promise<UserSettings> {
    const response = await this.fetchJSON<UserSettings>('getUserSettings.php');
    return response.data ?? { collectionName: 'Our Wines' };
  }

  /**
   * Update user settings
   */
  async updateUserSettings(settings: UpdateSettingsPayload): Promise<UserSettings> {
    const response = await this.fetchJSON<UserSettings>(
      'updateUserSettings.php',
      settings as Record<string, unknown>
    );

    if (!response.success) {
      throw new Error(response.message || 'Failed to update settings');
    }

    return response.data ?? { collectionName: 'Our Wines' };
  }

  // ─────────────────────────────────────────────────────────
  // CELLAR VALUE (WIN-127)
  // ─────────────────────────────────────────────────────────

  /**
   * Get cellar value statistics
   * Returns total value in EUR (frontend handles currency conversion)
   */
  async getCellarValue(): Promise<CellarValue> {
    const response = await this.fetchJSON<CellarValue>('getCellarValue.php');
    return response.data ?? {
      totalValueEUR: 0,
      bottleCount: 0,
      bottlesWithPrice: 0,
      bottlesWithoutPrice: 0,
      hasIncompleteData: false
    };
  }

  // ─────────────────────────────────────────────────────────
  // AI AGENT IDENTIFICATION
  // ─────────────────────────────────────────────────────────

  /**
   * Identify wine from text description
   * Uses AI to parse wine details and match against collection/reference data
   */
  async identifyText(text: string): Promise<AgentIdentificationResult> {
    const response = await this.fetchJSON<AgentIdentificationResult>(
      'agent/identifyText.php',
      { text }
    );

    if (!response.success) {
      throw new Error(response.message || 'Failed to identify wine from text');
    }

    return response.data;
  }

  /**
   * Identify wine from image (label photo)
   * Uses AI vision to extract wine details from label
   * Optionally includes supplementary text for re-identification with user context
   */
  async identifyImage(
    imageBase64: string,
    mimeType: string,
    supplementaryText?: string
  ): Promise<AgentIdentificationResultWithMeta> {
    const body: Record<string, string> = { image: imageBase64, mimeType };
    if (supplementaryText) {
      body.supplementaryText = supplementaryText;
    }

    const response = await this.fetchJSON<AgentIdentificationResultWithMeta>(
      'agent/identifyImage.php',
      body
    );

    if (!response.success) {
      throw new Error(response.message || 'Failed to identify wine from image');
    }

    return response.data;
  }

  /**
   * User-triggered escalation to Claude Opus for maximum accuracy
   * Called when user clicks "Try harder" after a user_choice action
   * Supports both text and image inputs based on inputType
   */
  async identifyWithOpus(
    input: string,
    inputType: 'text' | 'image',
    priorResult: AgentIdentificationResult,
    mimeType?: string,
    supplementaryText?: string
  ): Promise<AgentIdentificationResult> {
    // Build request body based on input type
    const body: Record<string, unknown> = { priorResult };

    if (inputType === 'image') {
      body.image = input;
      body.mimeType = mimeType || 'image/jpeg';
      if (supplementaryText) {
        body.supplementaryText = supplementaryText;
      }
    } else {
      body.text = input;
    }

    const response = await this.fetchJSON<AgentIdentificationResult>(
      'agent/identifyWithOpus.php',
      body
    );

    if (!response.success) {
      throw new Error(response.message || 'Failed to identify wine with premium model');
    }

    return response.data;
  }

  // ─────────────────────────────────────────────────────────
  // AI AGENT STREAMING IDENTIFICATION (WIN-181)
  // ─────────────────────────────────────────────────────────

  /**
   * Identify wine from text description with streaming response.
   * Fields are emitted as they become available via onField callback.
   * Returns the complete result or throws on error.
   *
   * @param text Wine description text
   * @param onField Callback for each field as it streams in
   * @param onEvent Optional callback for all SSE events (field, result, escalating, error, done)
   */
  async identifyTextStream(
    text: string,
    onField?: StreamFieldCallback,
    onEvent?: StreamEventCallback
  ): Promise<AgentIdentificationResultWithMeta> {
    const url = `${this.baseURL}agent/identifyTextStream.php`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      // Try to parse error response
      try {
        const json = await response.json();
        if (json.error?.type) {
          throw AgentError.fromResponse(json as AgentErrorResponse);
        }
        throw new Error(json.message || `HTTP ${response.status}`);
      } catch (e) {
        if (AgentError.isAgentError(e)) throw e;
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

    // Track the final result across escalations
    let finalResult: AgentIdentificationResultWithMeta | null = null;
    let streamError: Error | null = null;

    await this.processSSEStream(response, (event) => {
      // Call the generic event handler if provided
      onEvent?.(event);

      switch (event.type) {
        case 'field':
          onField?.(event.data.field, event.data.value);
          break;

        case 'result':
          // Keep the latest result (could be escalated)
          finalResult = event.data as AgentIdentificationResultWithMeta;
          break;

        case 'error':
          streamError = new AgentError({
            type: event.data.type,
            userMessage: event.data.message,
            retryable: event.data.retryable,
            supportRef: event.data.supportRef
          });
          break;

        case 'escalating':
          // Info only - continue processing
          break;

        case 'done':
          // Stream complete
          break;
      }
    });

    if (streamError) {
      throw streamError;
    }

    if (!finalResult) {
      throw new Error('No result received from streaming identification');
    }

    return finalResult;
  }

  /**
   * Identify wine from image with streaming response.
   * Fields are emitted as they become available via onField callback.
   * Returns the complete result or throws on error.
   *
   * @param imageBase64 Base64-encoded image data
   * @param mimeType Image MIME type (e.g., 'image/jpeg')
   * @param supplementaryText Optional user context
   * @param onField Callback for each field as it streams in
   * @param onEvent Optional callback for all SSE events
   */
  async identifyImageStream(
    imageBase64: string,
    mimeType: string,
    supplementaryText?: string,
    onField?: StreamFieldCallback,
    onEvent?: StreamEventCallback
  ): Promise<AgentIdentificationResultWithMeta> {
    const url = `${this.baseURL}agent/identifyImageStream.php`;

    const body: Record<string, string> = { image: imageBase64, mimeType };
    if (supplementaryText) {
      body.supplementaryText = supplementaryText;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      try {
        const json = await response.json();
        if (json.error?.type) {
          throw AgentError.fromResponse(json as AgentErrorResponse);
        }
        throw new Error(json.message || `HTTP ${response.status}`);
      } catch (e) {
        if (AgentError.isAgentError(e)) throw e;
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

    let finalResult: AgentIdentificationResultWithMeta | null = null;
    let streamError: Error | null = null;

    await this.processSSEStream(response, (event) => {
      onEvent?.(event);

      switch (event.type) {
        case 'field':
          onField?.(event.data.field, event.data.value);
          break;

        case 'result':
          finalResult = event.data as AgentIdentificationResultWithMeta;
          break;

        case 'error':
          streamError = new AgentError({
            type: event.data.type,
            userMessage: event.data.message,
            retryable: event.data.retryable,
            supportRef: event.data.supportRef
          });
          break;
      }
    });

    if (streamError) {
      throw streamError;
    }

    if (!finalResult) {
      throw new Error('No result received from streaming identification');
    }

    return finalResult;
  }

  // ─────────────────────────────────────────────────────────
  // AI AGENT ENRICHMENT
  // ─────────────────────────────────────────────────────────

  /**
   * Enrich wine with web search data
   * Returns grape varieties, critic scores, drink windows, style profiles
   * Called on-demand by Phase 2.6 UI
   *
   * WIN-162: Added confirmMatch and forceRefresh for canonical resolution
   * - confirmMatch: User confirmed a non-exact cache match
   * - forceRefresh: Skip cache entirely, do fresh web search
   */
  async enrichWine(
    producer: string,
    wineName: string,
    vintage?: string | null,
    wineType?: string | null,
    region?: string | null,
    confirmMatch = false,
    forceRefresh = false
  ): Promise<AgentEnrichmentResult> {
    const response = await this.fetchJSON<AgentEnrichmentResult>(
      'agent/agentEnrich.php',
      { producer, wineName, vintage, wineType, region, confirmMatch, forceRefresh }
    );

    if (!response.success) {
      throw new Error(response.message || 'Enrichment failed');
    }

    return response.data;
  }

  /**
   * Enrich wine with streaming response (WIN-181).
   * Fields are emitted progressively as they become available.
   *
   * @param producer Wine producer name
   * @param wineName Wine name
   * @param vintage Optional vintage year
   * @param wineType Optional wine type
   * @param region Optional region
   * @param confirmMatch Confirm a non-exact cache match
   * @param forceRefresh Skip cache, do fresh web search
   * @param onField Callback for each field as it streams in
   * @param onEvent Optional callback for all SSE events
   */
  async enrichWineStream(
    producer: string,
    wineName: string,
    vintage?: string | null,
    wineType?: string | null,
    region?: string | null,
    confirmMatch = false,
    forceRefresh = false,
    onField?: StreamFieldCallback,
    onEvent?: StreamEventCallback
  ): Promise<AgentEnrichmentResult> {
    const url = `${this.baseURL}agent/agentEnrichStream.php`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders },
      body: JSON.stringify({ producer, wineName, vintage, wineType, region, confirmMatch, forceRefresh })
    });

    if (!response.ok) {
      try {
        const json = await response.json();
        if (json.error?.type) {
          throw AgentError.fromResponse(json as AgentErrorResponse);
        }
        throw new Error(json.message || `HTTP ${response.status}`);
      } catch (e) {
        if (AgentError.isAgentError(e)) throw e;
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

    let finalResult: AgentEnrichmentResult | null = null;
    let streamError: Error | null = null;
    let confirmationResult: AgentEnrichmentResult | null = null;

    await this.processSSEStream(response, (event) => {
      onEvent?.(event);

      switch (event.type) {
        case 'field':
          onField?.(event.data.field, event.data.value);
          break;

        case 'result':
          // Enrichment result - cast through unknown since StreamEvent uses identification type
          finalResult = event.data as unknown as AgentEnrichmentResult;
          break;

        case 'confirmation_required':
          // Build a pending confirmation result
          confirmationResult = {
            success: true,
            data: null,
            source: 'cache',
            warnings: [],
            fieldSources: null,
            usage: null,
            pendingConfirmation: true,
            matchType: event.data.matchType,
            searchedFor: event.data.searchedFor ?? undefined,
            matchedTo: event.data.matchedTo ?? undefined,
            confidence: event.data.confidence
          };
          break;

        case 'error':
          streamError = new AgentError({
            type: event.data.type,
            userMessage: event.data.message,
            retryable: event.data.retryable,
            supportRef: event.data.supportRef
          });
          break;
      }
    });

    if (streamError) {
      throw streamError;
    }

    // Handle confirmation required case
    if (confirmationResult) {
      return confirmationResult;
    }

    if (!finalResult) {
      throw new Error('No result received from streaming enrichment');
    }

    return finalResult;
  }

  // ─────────────────────────────────────────────────────────
  // AI AGENT CLARIFICATION
  // ─────────────────────────────────────────────────────────

  /**
   * Get LLM clarification to help user decide between matching options
   * Returns an explanation of which option best matches the wine being added
   */
  async clarifyMatch(request: AgentClarificationRequest): Promise<AgentClarificationResult> {
    const response = await this.fetchJSON<AgentClarificationResult>(
      'agent/clarifyMatch.php',
      request as unknown as Record<string, unknown>
    );
    if (!response.success) {
      throw new Error(response.message || 'Failed to clarify match');
    }
    return response.data;
  }

  // ─────────────────────────────────────────────────────────
  // UTILITY METHODS
  // ─────────────────────────────────────────────────────────

  /**
   * Compress and convert image file for identification API
   * Returns base64-encoded image data with mime type
   * @throws Error with specific message for unsupported formats
   */
  async compressImageForIdentification(file: File): Promise<{ imageData: string; mimeType: string }> {
    // Browser-supported image types (most browsers cannot decode HEIC/HEIF)
    const SUPPORTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
    const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    const HEIC_EXTENSIONS = ['.heic', '.heif'];

    // Get file extension (browsers often don't set MIME type for HEIC)
    const fileName = file.name.toLowerCase();
    const extension = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';

    // Check for HEIC by extension first (file.type is often empty for HEIC)
    if (HEIC_EXTENSIONS.includes(extension)) {
      throw new Error('HEIC/HEIF images are not supported. Please convert to JPEG or take a new photo with your camera app set to "Most Compatible" format.');
    }

    // Check file type if available
    const fileType = file.type.toLowerCase();
    if (fileType) {
      if (fileType === 'image/heic' || fileType === 'image/heif') {
        throw new Error('HEIC/HEIF images are not supported. Please convert to JPEG or take a new photo with your camera app set to "Most Compatible" format.');
      }
      if (!SUPPORTED_TYPES.includes(fileType)) {
        throw new Error(`Unsupported image format: ${fileType}. Please use JPEG, PNG, or WebP.`);
      }
    } else if (extension && !SUPPORTED_EXTENSIONS.includes(extension)) {
      // No MIME type but unsupported extension
      throw new Error(`Unsupported image format: ${extension}. Please use JPEG, PNG, or WebP.`);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const img = new Image();

      reader.onload = (e) => {
        img.onload = () => {
          // Create canvas for compression
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          // Max dimensions for upload
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;

          let { width, height } = img;

          // Scale down if needed
          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;

          // Draw image
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to JPEG with quality
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const base64Data = dataUrl.split(',')[1];

          resolve({
            imageData: base64Data,
            mimeType: 'image/jpeg'
          });
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }
}

// Singleton instance
export const api = new WineApiClient();
export default api;

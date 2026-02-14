<?php
/**
 * Central Prompt Registry
 *
 * The SOLE source of truth for all LLM prompts in the application.
 * To review or tweak any prompt, edit this file only.
 *
 * @package Agent\Prompts
 */

class Prompts
{
    // ════════════════════════════════════════════════════════════════
    //  TEXT IDENTIFICATION
    // ════════════════════════════════════════════════════════════════

    /**
     * Text identification — Tier 1 (standard, non-streaming).
     * Used by TextProcessor for the initial fast identification pass.
     */
    public static function textIdentify(string $input): string
    {
        return <<<PROMPT
You are a wine identification expert. Parse the following wine description and extract structured data.

Input: {$input}

Instructions:
1. Extract wine details from the text
2. Use your knowledge to infer missing details when confident
3. For Bordeaux wines, the producer IS usually the wine name (e.g., "Château Margaux" is both)
4. Recognize appellation hints (e.g., "Margaux" implies Bordeaux, France)
5. Identify grape varieties from region knowledge when not explicit

CRITICAL - Confidence Scoring Rules:
- HIGH confidence (80-100): ONLY for wines you actually RECOGNIZE as real, existing wines
- MEDIUM confidence (50-79): Partial match - you recognize the producer but not the specific wine, or the input is ambiguous
- LOW confidence (0-49): The producer/wine name is NOT a real wine you recognize, or the input is too vague

Do NOT give high confidence just because you can fill in fields with plausible regional data.
If the producer name doesn't match a real winery you know, confidence must be LOW (<50).
Pattern matching (e.g., "Ch." = Château) is NOT enough for high confidence - the actual wine must exist.

Extract these fields (use null if not found or truly uncertain):
- producer: The winery/château/domaine name (only if it's a real producer you recognize)
- wineName: The wine's name. For single-wine estates (Opus One, Château Margaux, Screaming Eagle), set wineName = producer. Only use null if producer makes multiple wines and no specific wine is mentioned.
- vintage: The year (4 digits only)
- region: The specific wine region or appellation
- country: Country of origin
- wineType: One of: Red, White, Rosé, Sparkling, Dessert, Fortified
- grapes: Array of grape varieties (infer from region knowledge if needed)
- confidence: Your confidence 0-100 that this is a REAL, IDENTIFIABLE wine

Examples:
- "2019 Château Margaux" → producer: "Château Margaux", wineName: "Château Margaux", vintage: "2019", region: "Margaux", country: "France", wineType: "Red", grapes: ["Cabernet Sauvignon", "Merlot"], confidence: 95
- "Opus One 2018" → producer: "Opus One", wineName: "Opus One", vintage: "2018", region: "Napa Valley", country: "USA", wineType: "Red", grapes: ["Cabernet Sauvignon", "Merlot"], confidence: 90
- "Ch. something red 2018" → producer: null, wineName: null, vintage: "2018", region: null, country: null, wineType: "Red", grapes: null, confidence: 15 (not a real wine)
- "red wine" → producer: null, vintage: null, region: null, country: null, wineType: "Red", grapes: null, confidence: 10

Respond ONLY with valid JSON:
{
  "producer": "string or null",
  "wineName": "string or null",
  "vintage": "string or null",
  "region": "string or null",
  "country": "string or null",
  "wineType": "string or null",
  "grapes": ["array"] or null,
  "confidence": number
}
PROMPT;
    }

    /**
     * Text identification — Tier 1.5 (detailed, escalated).
     * Used when initial identification needs more thorough analysis.
     */
    public static function textIdentifyDetailed(string $input): string
    {
        return <<<PROMPT
You are a master sommelier with expertise in wine identification. Analyze the following wine description thoroughly.

Input: {$input}

Use your extensive knowledge to identify this wine. Consider:
- If the input is abbreviated, expand it (e.g., "Chx" = Château, "Dom" = Domaine)
- If the region is implied, deduce it from the wine name or producer
- For First Growth Bordeaux or prestigious estates, recognize them by name alone
- For New World wines, consider typical regional grape varieties
- For European wines, consider appellation rules to deduce grape varieties

CRITICAL - Confidence Scoring Rules:
- HIGH confidence (80-100): ONLY for wines you actually RECOGNIZE as real, existing wines
- MEDIUM confidence (50-79): You recognize the producer but not the specific wine, or input is ambiguous
- LOW confidence (0-49): The producer/wine is NOT a real wine you recognize

Do NOT give high confidence just because you can fill in fields with plausible regional data.
If the producer name doesn't match a real winery you know, confidence must be LOW (<50).
The wine must actually EXIST for high confidence - pattern matching alone is not enough.

Extract these fields (use null if the wine is not recognized):
- producer: The full winery/producer name (only if it's a REAL producer you recognize)
- wineName: The specific wine/cuvée name if different from producer
- vintage: The year (4 digits)
- region: The wine region or appellation (be specific - e.g., "Margaux" not just "Bordeaux")
- country: Country of origin
- wineType: Red, White, Rosé, Sparkling, Dessert, or Fortified
- grapes: Array of likely grape varieties (can infer from region/style if not stated)
- confidence: Your confidence score (0-100) that this is a REAL, IDENTIFIABLE wine

Respond ONLY with valid JSON:
{
  "producer": "string or null",
  "wineName": "string or null",
  "vintage": "string or null",
  "region": "string or null",
  "country": "string or null",
  "wineType": "string or null",
  "grapes": ["array"] or null,
  "confidence": number
}
PROMPT;
    }

    /**
     * Text identification — Streaming Tier 1.
     * Compact prompt used with Gemini's responseSchema for structured streaming output.
     * Kept intentionally short for fast TTFB.
     */
    public static function textIdentifyStreaming(string $text): string
    {
        return <<<PROMPT
Identify this wine. Return ONLY JSON.

TEXT: {$text}

Fields: producer (required), wineName (required), vintage (number|null), region, country, wineType ("Red"|"White"|"Rosé"|"Sparkling"|"Dessert"|"Fortified"), grapes (array), confidence (0-100).
All country names MUST be in English (e.g., "France", "Italy", "Germany", NOT "Deutschland", "España", "Italia").
Null if unsure.
PROMPT;
    }

    // ════════════════════════════════════════════════════════════════
    //  VISION (IMAGE) IDENTIFICATION
    // ════════════════════════════════════════════════════════════════

    /**
     * Vision identification — Tier 1 (standard, non-streaming).
     * Used by VisionProcessor for the initial image identification pass.
     */
    public static function visionIdentify(): string
    {
        return <<<'PROMPT'
You are a wine label identification expert. Analyze this wine label image and extract structured data.

Instructions:
1. Read all text visible on the wine label
2. Identify the producer/winery name (usually the most prominent text)
3. Find the vintage year (4-digit year, typically on front or neck label)
4. Identify the wine name/cuvée if different from producer
5. Determine the region/appellation from the label text
6. Identify grape varieties if listed
7. Determine the wine type from visual cues and text (color mentions, "brut", "rosé", etc.)
8. Use your wine knowledge to infer missing details when confident

If the image is:
- Not a wine label: set confidence to 0 and return nulls
- Blurry or unreadable: describe the issue in your confidence score (lower)
- Only partially visible: extract what you can and note lower confidence

Extract these fields (use null if not found or truly uncertain):
- producer: The winery/château/domaine name (usually largest text)
- wineName: The specific cuvée name if different from producer, otherwise null
- vintage: The year (4 digits only)
- region: The specific wine region or appellation (e.g., "Margaux", "Napa Valley")
- country: Country of origin (infer from region if not explicit)
- wineType: One of: Red, White, Rosé, Sparkling, Dessert, Fortified
- grapes: Array of grape varieties (infer from region knowledge if needed)
- confidence: Your confidence 0-100 in the overall identification

Examples of expected output:
- Clear Bordeaux label → confidence: 85-95
- Blurry label with some readable text → confidence: 50-70
- Photo of wine bottle from distance → confidence: 40-60
- Not a wine label → confidence: 0

Respond ONLY with valid JSON:
{
  "producer": "string or null",
  "wineName": "string or null",
  "vintage": "string or null",
  "region": "string or null",
  "country": "string or null",
  "wineType": "string or null",
  "grapes": ["array"] or null,
  "confidence": number
}
PROMPT;
    }

    /**
     * Vision identification — Tier 1.5 (detailed, grounded).
     * Used for escalated image identification with web search verification.
     */
    public static function visionIdentifyDetailed(): string
    {
        return <<<'PROMPT'
Identify the wine from this label image. Use web search to verify your identification.

Analysis steps:
- Read all visible text carefully, including small or stylized fonts
- Look for appellation markers (AOC, DOCG, etc.), alcohol %, awards
- Search for the producer and wine name to verify they exist
- Only fill fields with data you can READ on the label or VERIFY via search

CRITICAL RULES:
- Do NOT guess or infer producer, region, or country from visual style alone
- Do NOT fill fields with plausible-sounding data you cannot verify
- Use null for any field you cannot read on the label or confirm via search
- grapes: Only include if stated on label or confirmed via search for this specific wine

Confidence guide:
- 80-100: Text clearly readable AND verified as a real wine via search
- 50-79: Partially readable OR search results are inconclusive
- 0-39: Cannot read label text OR search finds no matching wine

Fields: producer, wineName, vintage (number|null), region, country, wineType ("Red"|"White"|"Rosé"|"Sparkling"|"Dessert"|"Fortified"), grapes (array), confidence (0-100).
Null if unsure.
PROMPT;
    }

    /**
     * Vision identification — Streaming Tier 1.
     * Framed as "read the label" (not "identify the wine") to reduce hallucination.
     * Used with Gemini's responseSchema for structured streaming output.
     */
    public static function visionIdentifyStreaming(?string $supplementaryText = null): string
    {
        $prompt = <<<'PROMPT'
Read the text on this wine label. Extract ONLY what you can literally see written on the label. Return JSON.

STEP 1 — READ: Look at the label and identify every piece of readable text (words, numbers, names).
STEP 2 — EXTRACT: Fill in fields ONLY from text you identified in Step 1. If a field's value is not written on the label, set it to null.

RULES:
- producer: Only if you can READ the producer/winery name on the label. null if not visible.
- wineName: Only if a distinct wine name (not the producer) is readable. null if not visible.
- vintage: Only if a 4-digit year is visible on the label. null if not visible.
- region: Only if an appellation or region name is printed on the label. null if not visible.
- country: Only if a country name is printed on the label. null if not visible.
- wineType: Only if the wine type is stated on the label (e.g., "Red Wine"). null if not stated.
- grapes: Only if grape varieties are listed on the label. null if not listed.

CRITICAL: Return null — NEVER guess. An incorrect value is far worse than null.
If the label is artistic, decorative, or has minimal text, most fields should be null.
Do not infer region from producer, do not infer grapes from region, do not infer country from language.
All country names MUST be in English (e.g., "France", "Italy", "Germany", NOT "Deutschland", "España", "Italia").

Confidence: How much text could you actually read?
- 80-100: All key fields are clearly readable on the label
- 50-79: Some fields readable, others unclear or partially visible
- 20-49: Very little readable text, only 1-2 fields extractable
- 0-19: No readable text / not a wine label
PROMPT;

        if ($supplementaryText) {
            $prompt .= "\n\nContext: {$supplementaryText}";
        }

        return $prompt;
    }

    // ════════════════════════════════════════════════════════════════
    //  ENRICHMENT
    // ════════════════════════════════════════════════════════════════

    /**
     * Enrichment — Full (non-streaming).
     * Used with Google Search grounding to find detailed wine data.
     */
    public static function enrichment(string $producer, string $wineName, ?string $vintage): string
    {
        $v = $vintage ?? 'NV';
        return <<<PROMPT
Search for detailed wine information about: {$producer} {$wineName} {$v}

Find and extract from reliable wine sources:
1. Grape varieties with percentages (e.g., "Cabernet Sauvignon 75%, Merlot 20%")
2. Official appellation or AVA classification
3. Alcohol content (ABV %)
4. Recommended drink window (start year to end year)
5. Critic scores from: Wine Spectator (WS), Robert Parker/Wine Advocate (RP), Decanter, James Suckling (JS)
   - Only include 100-point scale scores
6. Production method notes (if notable, e.g., barrel aging)
7. Style profile: body, tannin level, acidity, sweetness
8. Wine overview - 3-4 sentences (60-120 words) describing the wine's character, style, and reputation
9. Tasting notes - 3-4 sentences (60-120 words) with aromas, palate flavors, texture, and finish
10. Food pairings - 3-4 sentences (60-100 words) with specific food recommendations

Return as JSON:
{
  "grapeVarieties": [
    {"grape": "Cabernet Sauvignon", "percentage": 75},
    {"grape": "Merlot", "percentage": 20},
    {"grape": "Petit Verdot", "percentage": 5}
  ],
  "appellation": "Margaux AOC",
  "alcoholContent": 13.5,
  "drinkWindow": {
    "start": 2025,
    "end": 2055,
    "maturity": "young"
  },
  "criticScores": [
    {"critic": "WS", "score": 98, "year": 2023},
    {"critic": "RP", "score": 97, "year": 2022}
  ],
  "productionMethod": "18 months in new French oak",
  "body": "Full",
  "tannin": "High",
  "acidity": "Medium-High",
  "sweetness": "Dry",
  "overview": "A flagship Left Bank Bordeaux from one of the most prestigious estates in Margaux. Known for its elegance, power, and remarkable aging potential. This vintage showcases the estate's commitment to excellence.",
  "tastingNotes": "Intense aromas of blackcurrant, violet, and cedar on the nose. The palate reveals layers of dark fruit, tobacco, and graphite with silky, refined tannins. The finish is exceptionally long with mineral undertones.",
  "pairingNotes": "Pairs beautifully with lamb rack, beef Wellington, or aged hard cheeses like Comté. Also excellent alongside slow-braised short ribs or wild mushroom dishes."
}

IMPORTANT:
- Only include data you find from reputable wine sources
- Use null for any field you cannot verify
- For critic scores, only include 100-point scale scores (not 20-point or 5-star)
- maturity values: "young", "ready", "peak", "declining"
- Do not guess or invent data
- For narrative fields (overview, tastingNotes, pairingNotes): write in an accessible, wine-enthusiast style; use sensory descriptors; keep each field to 3-4 sentences
PROMPT;
    }

    /**
     * Enrichment — Streaming.
     * Compact prompt for faster TTFB during streaming enrichment.
     * Used with Gemini's responseSchema for structured streaming output.
     */
    public static function enrichmentStreaming(string $producer, string $wineName, ?string $vintage): string
    {
        $v = $vintage ?? 'NV';
        return <<<PROMPT
Search for wine data: {$producer} {$wineName} {$v}

Return JSON with:
- grapeVarieties: [{grape, percentage}] from sources
- appellation: AOC/AVA classification
- alcoholContent: ABV as number
- drinkWindow: {start, end, maturity} (maturity: young/ready/peak/declining)
- criticScores: [{critic, score, year}] — WS, RP, Decanter, JS only, 100-point scale
- productionMethod: notable methods (oak aging etc)
- body/tannin/acidity/sweetness: style descriptors
- overview: 3-4 sentences on character and reputation
- tastingNotes: 3-4 sentences on aromas, palate, finish
- pairingNotes: 3-4 sentences with specific food pairings

Use null for unverified fields. Only include data from reputable sources.
PROMPT;
    }

    // ════════════════════════════════════════════════════════════════
    //  CLARIFICATION
    // ════════════════════════════════════════════════════════════════

    /**
     * Match clarification — helps user disambiguate between similar wines.
     *
     * @param string $optionsList Pre-formatted list of options (one per line)
     */
    public static function clarifyMatch(
        string $producer,
        string $wineName,
        string $vintage,
        string $region,
        string $type,
        string $optionsList
    ): string {
        return <<<PROMPT
You are an expert sommelier helping a wine collector.

The user is trying to add: {$producer} - {$wineName} ({$vintage})
Region: {$region}

I found these existing {$type} entries in their collection:
{$optionsList}

Task: In 1-2 sentences, explain which option best matches what they're adding, or if they should create a new entry. Be concise and complete your thought.
PROMPT;
    }

    // ════════════════════════════════════════════════════════════════
    //  ESCALATION CONTEXT (appended to any identification prompt)
    // ════════════════════════════════════════════════════════════════

    /**
     * Build escalation context string from a prior identification result.
     * Appended to higher-tier prompts so the model knows what was already tried.
     */
    public static function escalationContext(
        array $priorResult,
        array $lockedFields = [],
        array $escalationContext = []
    ): string {
        $parsed = $priorResult['parsed'] ?? [];
        $originalUserText = $escalationContext['originalUserText'] ?? null;
        $reason = $escalationContext['reason'] ?? null;

        $context = "ESCALATION CONTEXT:";

        if ($originalUserText) {
            $context .= sprintf("\nThe user originally searched for: \"%s\"", $originalUserText);
        }

        $context .= sprintf(
            "\nA previous model identified this as: Producer=%s, Wine=%s, Region=%s (confidence: %d%%).",
            $parsed['producer'] ?? 'unknown',
            $parsed['wineName'] ?? 'unknown',
            $parsed['region'] ?? 'unknown',
            $priorResult['confidence'] ?? 0
        );

        if ($reason === 'user_rejected') {
            $context .= "\nThe user indicated this identification is NOT CORRECT and has requested premium re-analysis.";
        } else {
            $context .= "\nPlease analyze more carefully and look for details that might have been missed.";
        }

        if (!empty($lockedFields)) {
            $context .= "\n\nUSER-CONFIRMED VALUES (use exactly as provided, you may normalize capitalization/accents):";
            foreach ($lockedFields as $field => $value) {
                $context .= "\n- {$field}: {$value}";
            }
        }

        return $context;
    }
}

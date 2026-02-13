<?php
/**
 * Inference Engine
 *
 * Consolidated inference engine for wine identification. Handles:
 * 1. Supplementary context parsing (user-provided hints)
 * 2. Post-LLM inference (region → country, grape → wine type, etc.)
 * 3. Appellation matching for region/country/grape inference
 *
 * Core inference chains:
 * - Appellation → Region → Country → typical grapes
 * - Region → Country (direct lookup)
 * - Grape → Wine Type (via color)
 * - Wine Type → Grape color constraint
 *
 * @package Agent\Identification
 */

namespace Agent\Identification;

class InferenceEngine
{
    /** @var \PDO|null Database connection for appellation lookups */
    private ?\PDO $pdo;

    // ─────────────────────────────────────────────────────
    // STATIC LOOKUP DATA
    // ─────────────────────────────────────────────────────

    /** Region -> Country mapping (~25 entries) */
    public const REGIONS = [
        'bordeaux' => ['name' => 'Bordeaux', 'country' => 'France'],
        'burgundy' => ['name' => 'Burgundy', 'country' => 'France'],
        'bourgogne' => ['name' => 'Burgundy', 'country' => 'France'],
        'champagne' => ['name' => 'Champagne', 'country' => 'France'],
        'rhône' => ['name' => 'Rhône', 'country' => 'France'],
        'rhone' => ['name' => 'Rhône', 'country' => 'France'],
        'loire' => ['name' => 'Loire', 'country' => 'France'],
        'alsace' => ['name' => 'Alsace', 'country' => 'France'],
        'provence' => ['name' => 'Provence', 'country' => 'France'],
        'languedoc' => ['name' => 'Languedoc', 'country' => 'France'],
        'tuscany' => ['name' => 'Tuscany', 'country' => 'Italy'],
        'toscana' => ['name' => 'Tuscany', 'country' => 'Italy'],
        'piedmont' => ['name' => 'Piedmont', 'country' => 'Italy'],
        'piemonte' => ['name' => 'Piedmont', 'country' => 'Italy'],
        'veneto' => ['name' => 'Veneto', 'country' => 'Italy'],
        'rioja' => ['name' => 'Rioja', 'country' => 'Spain'],
        'ribera del duero' => ['name' => 'Ribera del Duero', 'country' => 'Spain'],
        'priorat' => ['name' => 'Priorat', 'country' => 'Spain'],
        'napa' => ['name' => 'Napa Valley', 'country' => 'USA'],
        'napa valley' => ['name' => 'Napa Valley', 'country' => 'USA'],
        'sonoma' => ['name' => 'Sonoma', 'country' => 'USA'],
        'willamette' => ['name' => 'Willamette Valley', 'country' => 'USA'],
        'barossa' => ['name' => 'Barossa Valley', 'country' => 'Australia'],
        'barossa valley' => ['name' => 'Barossa Valley', 'country' => 'Australia'],
        'mclaren vale' => ['name' => 'McLaren Vale', 'country' => 'Australia'],
        'marlborough' => ['name' => 'Marlborough', 'country' => 'New Zealand'],
        'central otago' => ['name' => 'Central Otago', 'country' => 'New Zealand'],
        'mosel' => ['name' => 'Mosel', 'country' => 'Germany'],
        'mendoza' => ['name' => 'Mendoza', 'country' => 'Argentina'],
        'stellenbosch' => ['name' => 'Stellenbosch', 'country' => 'South Africa'],
    ];

    /** Country name normalization */
    public const COUNTRIES = [
        'france' => 'France',
        'french' => 'France',
        'italy' => 'Italy',
        'italian' => 'Italy',
        'spain' => 'Spain',
        'spanish' => 'Spain',
        'portugal' => 'Portugal',
        'portuguese' => 'Portugal',
        'germany' => 'Germany',
        'german' => 'Germany',
        'australia' => 'Australia',
        'australian' => 'Australia',
        'new zealand' => 'New Zealand',
        'argentina' => 'Argentina',
        'argentinan' => 'Argentina',
        'chile' => 'Chile',
        'south africa' => 'South Africa',
        'south african' => 'South Africa',
        'usa' => 'USA',
        'united states' => 'USA',
        'america' => 'USA',
        'american' => 'USA',
        'california' => 'USA',
        'californian' => 'USA',
        'austria' => 'Austria',
        'austrian' => 'Austria',
    ];

    /** Wine type normalization */
    public const WINE_TYPES = [
        'red' => 'Red',
        'white' => 'White',
        'rose' => 'Rosé',
        'rosé' => 'Rosé',
        'pink' => 'Rosé',
        'sparkling' => 'Sparkling',
        'dessert' => 'Dessert',
        'sweet' => 'Dessert',
        'fortified' => 'Fortified',
        'port' => 'Fortified',
        'sherry' => 'Fortified',
    ];

    /** Grape variety matching with color (red/white) */
    public const GRAPES = [
        // Red grapes
        'cabernet sauvignon' => ['name' => 'Cabernet Sauvignon', 'color' => 'Red'],
        'cabernet' => ['name' => 'Cabernet Sauvignon', 'color' => 'Red'],
        'cab sav' => ['name' => 'Cabernet Sauvignon', 'color' => 'Red'],
        'merlot' => ['name' => 'Merlot', 'color' => 'Red'],
        'pinot noir' => ['name' => 'Pinot Noir', 'color' => 'Red'],
        'pinot' => ['name' => 'Pinot Noir', 'color' => 'Red'],
        'syrah' => ['name' => 'Syrah', 'color' => 'Red'],
        'shiraz' => ['name' => 'Shiraz', 'color' => 'Red'],
        'tempranillo' => ['name' => 'Tempranillo', 'color' => 'Red'],
        'sangiovese' => ['name' => 'Sangiovese', 'color' => 'Red'],
        'nebbiolo' => ['name' => 'Nebbiolo', 'color' => 'Red'],
        'malbec' => ['name' => 'Malbec', 'color' => 'Red'],
        'grenache' => ['name' => 'Grenache', 'color' => 'Red'],
        'garnacha' => ['name' => 'Grenache', 'color' => 'Red'],
        'zinfandel' => ['name' => 'Zinfandel', 'color' => 'Red'],
        'mourvèdre' => ['name' => 'Mourvèdre', 'color' => 'Red'],
        'mourvedre' => ['name' => 'Mourvèdre', 'color' => 'Red'],
        'barbera' => ['name' => 'Barbera', 'color' => 'Red'],
        'cabernet franc' => ['name' => 'Cabernet Franc', 'color' => 'Red'],
        'cab franc' => ['name' => 'Cabernet Franc', 'color' => 'Red'],
        'petit verdot' => ['name' => 'Petit Verdot', 'color' => 'Red'],
        'pinotage' => ['name' => 'Pinotage', 'color' => 'Red'],
        // White grapes
        'chardonnay' => ['name' => 'Chardonnay', 'color' => 'White'],
        'sauvignon blanc' => ['name' => 'Sauvignon Blanc', 'color' => 'White'],
        'sauv blanc' => ['name' => 'Sauvignon Blanc', 'color' => 'White'],
        'riesling' => ['name' => 'Riesling', 'color' => 'White'],
        'pinot grigio' => ['name' => 'Pinot Grigio', 'color' => 'White'],
        'pinot gris' => ['name' => 'Pinot Gris', 'color' => 'White'],
        'gewürztraminer' => ['name' => 'Gewürztraminer', 'color' => 'White'],
        'gewurztraminer' => ['name' => 'Gewürztraminer', 'color' => 'White'],
        'viognier' => ['name' => 'Viognier', 'color' => 'White'],
        'chenin blanc' => ['name' => 'Chenin Blanc', 'color' => 'White'],
        'grüner veltliner' => ['name' => 'Grüner Veltliner', 'color' => 'White'],
        'gruner veltliner' => ['name' => 'Grüner Veltliner', 'color' => 'White'],
        'albariño' => ['name' => 'Albariño', 'color' => 'White'],
        'albarino' => ['name' => 'Albariño', 'color' => 'White'],
        'moscato' => ['name' => 'Moscato', 'color' => 'White'],
        'muscat' => ['name' => 'Muscat', 'color' => 'White'],
    ];

    /** Country -> typical regions mapping for inferences */
    public const COUNTRY_REGIONS = [
        'France' => ['Bordeaux', 'Burgundy', 'Champagne', 'Rhône', 'Loire', 'Alsace', 'Provence'],
        'Italy' => ['Tuscany', 'Piedmont', 'Veneto', 'Sicily', 'Puglia'],
        'Spain' => ['Rioja', 'Ribera del Duero', 'Priorat', 'Rías Baixas'],
        'USA' => ['Napa Valley', 'Sonoma', 'Willamette Valley', 'Paso Robles'],
        'Australia' => ['Barossa Valley', 'McLaren Vale', 'Margaret River', 'Hunter Valley'],
        'Germany' => ['Mosel', 'Rheingau', 'Pfalz'],
        'Argentina' => ['Mendoza', 'Salta'],
        'New Zealand' => ['Marlborough', 'Central Otago', 'Hawke\'s Bay'],
        'South Africa' => ['Stellenbosch', 'Swartland', 'Franschhoek'],
    ];

    /**
     * Create a new inference engine
     *
     * @param \PDO|null $pdo Optional database connection for appellation lookups
     */
    public function __construct(?\PDO $pdo = null)
    {
        $this->pdo = $pdo;
    }

    // ─────────────────────────────────────────────────────
    // MAIN INFERENCE METHOD (NEW)
    // ─────────────────────────────────────────────────────

    /**
     * Infer missing fields from parsed wine data
     *
     * @param array $parsedWine Parsed wine data from LLM
     * @return array List of inferences applied: [{field, value, type, confidence}]
     */
    public function infer(array $parsedWine): array
    {
        $inferences = [];

        // 1. Appellation → Region → Country (if appellation present)
        if (!empty($parsedWine['appellation'])) {
            $appellationMatch = $this->matchAppellation($parsedWine['appellation']);
            if ($appellationMatch) {
                if (empty($parsedWine['region'])) {
                    $inferences[] = [
                        'field' => 'region',
                        'value' => $appellationMatch['region'],
                        'type' => 'region_from_appellation',
                        'confidence' => 0.90,
                    ];
                }
                if (empty($parsedWine['country'])) {
                    $inferences[] = [
                        'field' => 'country',
                        'value' => $appellationMatch['country'],
                        'type' => 'country_from_appellation',
                        'confidence' => 0.95,
                    ];
                }
                if (!empty($appellationMatch['typicalGrapes']) && empty($parsedWine['grapes'])) {
                    $inferences[] = [
                        'field' => 'grapes',
                        'value' => $appellationMatch['typicalGrapes'],
                        'type' => 'grapes_from_appellation',
                        'confidence' => 0.70,
                    ];
                }
                if (!empty($appellationMatch['wineTypes']) && empty($parsedWine['wineType'])) {
                    $inferences[] = [
                        'field' => 'wineType',
                        'value' => $appellationMatch['wineTypes'][0],
                        'type' => 'type_from_appellation',
                        'confidence' => 0.75,
                    ];
                }
            }
        }

        // 2. Region → Country (if region present but no country)
        if (!empty($parsedWine['region']) && empty($parsedWine['country'])) {
            $regionLower = strtolower($parsedWine['region']);
            $regionMatch = $this->matchRegion($regionLower);
            if ($regionMatch) {
                $inferences[] = [
                    'field' => 'country',
                    'value' => $regionMatch['country'],
                    'type' => 'country_from_region',
                    'confidence' => 0.95,
                ];
            }
        }

        // 3. Grape → Wine Type (if grapes present but no type)
        if (!empty($parsedWine['grapes']) && empty($parsedWine['wineType'])) {
            $grapes = is_array($parsedWine['grapes']) ? $parsedWine['grapes'] : [$parsedWine['grapes']];
            foreach ($grapes as $grape) {
                $grapeLower = strtolower($grape);
                $grapeMatch = $this->matchGrape($grapeLower);
                if ($grapeMatch) {
                    $inferences[] = [
                        'field' => 'wineType',
                        'value' => $grapeMatch['color'],
                        'type' => 'type_from_grape',
                        'confidence' => 0.85,
                    ];
                    break; // Use first match
                }
            }
        }

        // 4. Producer → Region (LLM inference only - database lookup deferred to WIN-155)
        // For now, we rely on the LLM's knowledge of producers
        // Future: integrate Wine-Searcher or Vivino API for producer lookups

        return $inferences;
    }

    /**
     * Match text against appellation database
     * Uses fuzzy matching with Levenshtein distance
     *
     * @param string $text Appellation name to match
     * @return array|null {region, country, typicalGrapes?, wineTypes?} or null
     */
    public function matchAppellation(string $text): ?array
    {
        if (!$this->pdo) {
            // Fallback to static lookup when no database
            return $this->matchAppellationStatic($text);
        }

        try {
            // Normalize input (must match migration normalization logic)
            $normalized = strtolower(str_replace(['-', ' ', 'é', 'è', 'ê', 'à', 'ô', 'û', 'ï'], ['', '', 'e', 'e', 'e', 'a', 'o', 'u', 'i'], $text));

            // Query refAppellations table using indexed normalizedName column
            $stmt = $this->pdo->prepare("
                SELECT
                    a.appellationName,
                    a.region,
                    a.country,
                    a.primaryGrapes,
                    a.wineTypes
                FROM refAppellations a
                WHERE a.normalizedName = :normalized
                LIMIT 1
            ");
            $stmt->execute(['normalized' => $normalized]);
            $row = $stmt->fetch(\PDO::FETCH_ASSOC);

            if ($row) {
                return [
                    'appellationName' => $row['appellationName'],
                    'region' => $row['region'],
                    'country' => $row['country'],
                    'typicalGrapes' => $row['primaryGrapes'] ? explode(',', $row['primaryGrapes']) : null,
                    'wineTypes' => $row['wineTypes'] ? explode(',', $row['wineTypes']) : null,
                ];
            }

            // Try fuzzy match with Levenshtein using pre-computed normalizedName
            $stmt = $this->pdo->query("SELECT appellationName, normalizedName, region, country, primaryGrapes, wineTypes FROM refAppellations");
            $appellations = $stmt->fetchAll(\PDO::FETCH_ASSOC);

            $bestMatch = null;
            $bestDistance = PHP_INT_MAX;
            $threshold = 3; // Max edit distance

            foreach ($appellations as $app) {
                // Use pre-computed normalizedName if available, otherwise normalize on the fly
                $appNormalized = $app['normalizedName'] ?? strtolower(str_replace(['-', ' '], '', $app['appellationName']));
                $distance = levenshtein($normalized, $appNormalized);
                if ($distance < $bestDistance && $distance <= $threshold) {
                    $bestDistance = $distance;
                    $bestMatch = $app;
                }
            }

            if ($bestMatch) {
                return [
                    'appellationName' => $bestMatch['appellationName'],
                    'region' => $bestMatch['region'],
                    'country' => $bestMatch['country'],
                    'typicalGrapes' => $bestMatch['primaryGrapes'] ? explode(',', $bestMatch['primaryGrapes']) : null,
                    'wineTypes' => $bestMatch['wineTypes'] ? explode(',', $bestMatch['wineTypes']) : null,
                ];
            }
        } catch (\Exception $e) {
            // Log error but don't fail
            error_log("Appellation lookup failed: " . $e->getMessage());
        }

        // Fall back to static lookup if database didn't find a match
        return $this->matchAppellationStatic($text);
    }

    /**
     * Static appellation matching (fallback when no database)
     * Common appellations with their region/country mappings
     *
     * @param string $text Appellation name
     * @return array|null
     */
    public function matchAppellationStatic(string $text): ?array
    {
        $appellations = [
            // ─────────────────────────────────────────────────────
            // BORDEAUX APPELLATIONS (Left Bank - Médoc)
            // ─────────────────────────────────────────────────────
            'margaux' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['Red']],
            'pauillac' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['Red']],
            'saint-julien' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['Red']],
            'saint-estephe' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['Red']],
            'listrac-medoc' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['Red']],
            'moulis' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['Red']],
            'haut-medoc' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['Red']],
            'medoc' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['Red']],
            // Bordeaux (Graves & Pessac)
            'pessac-leognan' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['Red', 'White']],
            'graves' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['Red', 'White']],
            // Bordeaux (Right Bank)
            'pomerol' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['Red']],
            'saint-emilion' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['Red']],
            'fronsac' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['Red']],
            'canon-fronsac' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['Red']],
            'lalande-de-pomerol' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['Red']],
            'montagne-saint-emilion' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['Red']],
            'lussac-saint-emilion' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['Red']],
            'castillon-cotes-de-bordeaux' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['Red']],
            // Bordeaux (Sweet)
            'sauternes' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['Dessert']],
            'barsac' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['Dessert']],
            // Bordeaux (Entre-Deux-Mers)
            'entre-deux-mers' => ['region' => 'Bordeaux', 'country' => 'France', 'wineTypes' => ['White']],

            // ─────────────────────────────────────────────────────
            // BURGUNDY APPELLATIONS (Côte de Nuits)
            // ─────────────────────────────────────────────────────
            'gevrey-chambertin' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Pinot Noir']],
            'chambolle-musigny' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Pinot Noir']],
            'morey-saint-denis' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Pinot Noir']],
            'vougeot' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Pinot Noir']],
            'clos-de-vougeot' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Pinot Noir']],
            'vosne-romanee' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Pinot Noir']],
            'flagey-echezeaux' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Pinot Noir']],
            'nuits-saint-georges' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Pinot Noir']],
            'cote-de-nuits-villages' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Pinot Noir']],
            // Burgundy (Côte de Beaune - Red)
            'pommard' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Pinot Noir']],
            'volnay' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Pinot Noir']],
            'beaune' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['Red', 'White']],
            'savigny-les-beaune' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['Red']],
            'aloxe-corton' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['Red']],
            'corton' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Pinot Noir']],
            'santenay' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['Red']],
            'cote-de-beaune-villages' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['Red']],
            // Burgundy (Côte de Beaune - White)
            'meursault' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['White'], 'typicalGrapes' => ['Chardonnay']],
            'puligny-montrachet' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['White'], 'typicalGrapes' => ['Chardonnay']],
            'chassagne-montrachet' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['White', 'Red']],
            'corton-charlemagne' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['White'], 'typicalGrapes' => ['Chardonnay']],
            // Burgundy (Chablis)
            'chablis' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['White'], 'typicalGrapes' => ['Chardonnay']],
            'petit-chablis' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['White'], 'typicalGrapes' => ['Chardonnay']],
            // Burgundy (Côte Chalonnaise)
            'mercurey' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['Red']],
            'givry' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['Red']],
            'rully' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['White', 'Sparkling']],
            'montagny' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['White']],
            // Burgundy (Mâconnais)
            'pouilly-fuisse' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['White'], 'typicalGrapes' => ['Chardonnay']],
            'saint-veran' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['White']],
            'macon' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['White', 'Red']],
            'macon-villages' => ['region' => 'Burgundy', 'country' => 'France', 'wineTypes' => ['White']],

            // ─────────────────────────────────────────────────────
            // RHÔNE APPELLATIONS (Northern)
            // ─────────────────────────────────────────────────────
            'cote-rotie' => ['region' => 'Rhône', 'country' => 'France', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Syrah']],
            'hermitage' => ['region' => 'Rhône', 'country' => 'France', 'wineTypes' => ['Red', 'White'], 'typicalGrapes' => ['Syrah']],
            'crozes-hermitage' => ['region' => 'Rhône', 'country' => 'France', 'wineTypes' => ['Red', 'White'], 'typicalGrapes' => ['Syrah']],
            'saint-joseph' => ['region' => 'Rhône', 'country' => 'France', 'wineTypes' => ['Red', 'White'], 'typicalGrapes' => ['Syrah']],
            'cornas' => ['region' => 'Rhône', 'country' => 'France', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Syrah']],
            'condrieu' => ['region' => 'Rhône', 'country' => 'France', 'wineTypes' => ['White'], 'typicalGrapes' => ['Viognier']],
            'chateau-grillet' => ['region' => 'Rhône', 'country' => 'France', 'wineTypes' => ['White'], 'typicalGrapes' => ['Viognier']],
            // Rhône (Southern)
            'chateauneuf-du-pape' => ['region' => 'Rhône', 'country' => 'France', 'wineTypes' => ['Red', 'White']],
            'gigondas' => ['region' => 'Rhône', 'country' => 'France', 'wineTypes' => ['Red']],
            'vacqueyras' => ['region' => 'Rhône', 'country' => 'France', 'wineTypes' => ['Red']],
            'rasteau' => ['region' => 'Rhône', 'country' => 'France', 'wineTypes' => ['Red', 'Fortified']],
            'beaumes-de-venise' => ['region' => 'Rhône', 'country' => 'France', 'wineTypes' => ['Red', 'Dessert']],
            'lirac' => ['region' => 'Rhône', 'country' => 'France', 'wineTypes' => ['Red', 'Rosé']],
            'tavel' => ['region' => 'Rhône', 'country' => 'France', 'wineTypes' => ['Rosé']],
            'cotes-du-rhone' => ['region' => 'Rhône', 'country' => 'France', 'wineTypes' => ['Red', 'White', 'Rosé']],
            'cotes-du-rhone-villages' => ['region' => 'Rhône', 'country' => 'France', 'wineTypes' => ['Red']],

            // ─────────────────────────────────────────────────────
            // ITALIAN APPELLATIONS
            // ─────────────────────────────────────────────────────
            // Piedmont
            'barolo' => ['region' => 'Piedmont', 'country' => 'Italy', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Nebbiolo']],
            'barbaresco' => ['region' => 'Piedmont', 'country' => 'Italy', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Nebbiolo']],
            'barbera-d-asti' => ['region' => 'Piedmont', 'country' => 'Italy', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Barbera']],
            'gavi' => ['region' => 'Piedmont', 'country' => 'Italy', 'wineTypes' => ['White'], 'typicalGrapes' => ['Cortese']],
            // Tuscany
            'brunello-di-montalcino' => ['region' => 'Tuscany', 'country' => 'Italy', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Sangiovese']],
            'chianti' => ['region' => 'Tuscany', 'country' => 'Italy', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Sangiovese']],
            'chianti-classico' => ['region' => 'Tuscany', 'country' => 'Italy', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Sangiovese']],
            'vino-nobile-di-montepulciano' => ['region' => 'Tuscany', 'country' => 'Italy', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Sangiovese']],
            'bolgheri' => ['region' => 'Tuscany', 'country' => 'Italy', 'wineTypes' => ['Red']],
            // Veneto
            'amarone' => ['region' => 'Veneto', 'country' => 'Italy', 'wineTypes' => ['Red']],
            'valpolicella' => ['region' => 'Veneto', 'country' => 'Italy', 'wineTypes' => ['Red']],
            'soave' => ['region' => 'Veneto', 'country' => 'Italy', 'wineTypes' => ['White']],
            'prosecco' => ['region' => 'Veneto', 'country' => 'Italy', 'wineTypes' => ['Sparkling']],

            // ─────────────────────────────────────────────────────
            // SPANISH APPELLATIONS
            // ─────────────────────────────────────────────────────
            'rioja' => ['region' => 'Rioja', 'country' => 'Spain', 'wineTypes' => ['Red', 'White'], 'typicalGrapes' => ['Tempranillo']],
            'rioja-alta' => ['region' => 'Rioja', 'country' => 'Spain', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Tempranillo']],
            'rioja-alavesa' => ['region' => 'Rioja', 'country' => 'Spain', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Tempranillo']],
            'ribera-del-duero' => ['region' => 'Ribera del Duero', 'country' => 'Spain', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Tempranillo']],
            'priorat' => ['region' => 'Catalonia', 'country' => 'Spain', 'wineTypes' => ['Red']],
            'rias-baixas' => ['region' => 'Galicia', 'country' => 'Spain', 'wineTypes' => ['White'], 'typicalGrapes' => ['Albariño']],
            'rueda' => ['region' => 'Castilla y León', 'country' => 'Spain', 'wineTypes' => ['White'], 'typicalGrapes' => ['Verdejo']],

            // ─────────────────────────────────────────────────────
            // LOIRE APPELLATIONS
            // ─────────────────────────────────────────────────────
            'sancerre' => ['region' => 'Loire', 'country' => 'France', 'wineTypes' => ['White', 'Red'], 'typicalGrapes' => ['Sauvignon Blanc']],
            'pouilly-fume' => ['region' => 'Loire', 'country' => 'France', 'wineTypes' => ['White'], 'typicalGrapes' => ['Sauvignon Blanc']],
            'vouvray' => ['region' => 'Loire', 'country' => 'France', 'wineTypes' => ['White', 'Sparkling'], 'typicalGrapes' => ['Chenin Blanc']],
            'chinon' => ['region' => 'Loire', 'country' => 'France', 'wineTypes' => ['Red'], 'typicalGrapes' => ['Cabernet Franc']],
            'muscadet' => ['region' => 'Loire', 'country' => 'France', 'wineTypes' => ['White'], 'typicalGrapes' => ['Melon de Bourgogne']],
        ];

        $normalized = strtolower(str_replace([' ', '-', '_'], '', $text));

        foreach ($appellations as $key => $data) {
            $keyNormalized = str_replace([' ', '-', '_'], '', $key);
            if ($normalized === $keyNormalized || strpos($normalized, $keyNormalized) !== false) {
                return $data;
            }
        }

        return null;
    }

    // ─────────────────────────────────────────────────────
    // REGION ROLLUP (WIN-148)
    // ─────────────────────────────────────────────────────

    /**
     * Roll up village/appellation to parent region
     *
     * If the given region string is actually a village-level appellation
     * (e.g., "Margaux", "Pauillac", "Gevrey-Chambertin"), returns the
     * parent wine region (e.g., "Bordeaux", "Burgundy").
     *
     * If already a region or not recognized, returns the original value.
     *
     * @param string $region Region string to check
     * @return array{region: string, appellation: string|null} Rolled-up region and original appellation if different
     */
    public function rollUpRegion(string $region): array
    {
        $regionLower = strtolower($region);

        // Already a known region? Return as-is
        if (isset(self::REGIONS[$regionLower])) {
            return ['region' => self::REGIONS[$regionLower]['name'], 'appellation' => null];
        }

        // Try to match as an appellation (uses both DB and static fallback)
        $match = $this->matchAppellation($region);
        if ($match && isset($match['region']) && strtolower($match['region']) !== $regionLower) {
            return [
                'region' => $match['region'],
                'appellation' => $region  // Preserve original as appellation
            ];
        }

        // Not recognized - return as-is
        return ['region' => $region, 'appellation' => null];
    }

    // ─────────────────────────────────────────────────────
    // SUPPLEMENTARY TEXT PARSING (FROM SupplementaryContextParser)
    // ─────────────────────────────────────────────────────

    /**
     * Parse supplementary text into structured constraints
     *
     * @param string $text User-provided supplementary text
     * @return array {constraints: array, inferences: array, promptSnippet: string}
     */
    public function parse(string $text): array
    {
        $text = trim($text);
        if (empty($text)) {
            return ['constraints' => [], 'inferences' => [], 'promptSnippet' => ''];
        }

        $constraints = [];
        $inferences = [];
        $lower = strtolower($text);

        // Detect uncertainty markers — reduces constraint confidence
        $hasUncertainty = (bool) preg_match('/\b(i think|maybe|possibly|perhaps|not sure|might be)\b/i', $text);
        $confidenceMultiplier = $hasUncertainty ? 0.7 : 1.0;

        // Split input into terms for multi-term matching
        $terms = preg_split('/[,;]+/', $lower);
        $terms = array_map('trim', $terms);
        $terms = array_filter($terms);

        // Also try the full text as a single match
        array_unshift($terms, $lower);

        $matchedTypes = [];

        foreach ($terms as $term) {
            // Strip common filler words for matching
            $cleanTerm = preg_replace('/\b(i think|maybe|possibly|perhaps|it\'?s?\s+(a|an)?|from|the|wine|grape|is)\b/', '', $term);
            $cleanTerm = trim(preg_replace('/\s+/', ' ', $cleanTerm));
            if (empty($cleanTerm)) continue;

            // Priority 1: Region match (highest priority)
            if (!isset($matchedTypes['region'])) {
                $regionMatch = $this->matchRegion($cleanTerm);
                if ($regionMatch) {
                    $matchedTypes['region'] = true;
                    $constraints[] = [
                        'type' => 'region',
                        'value' => $regionMatch['name'],
                        'confidence' => 0.90 * $confidenceMultiplier,
                    ];
                    // Infer country from region
                    if (!isset($matchedTypes['country'])) {
                        $matchedTypes['country'] = true;
                        $constraints[] = [
                            'type' => 'country',
                            'value' => $regionMatch['country'],
                            'confidence' => 0.95 * $confidenceMultiplier,
                        ];
                        $inferences[] = "Country inferred as {$regionMatch['country']} from region {$regionMatch['name']}";
                    }
                    continue;
                }
            }

            // Priority 2: Country match
            if (!isset($matchedTypes['country'])) {
                $countryMatch = $this->matchCountry($cleanTerm);
                if ($countryMatch) {
                    $matchedTypes['country'] = true;
                    $constraints[] = [
                        'type' => 'country',
                        'value' => $countryMatch,
                        'confidence' => 0.90 * $confidenceMultiplier,
                    ];
                    if (isset(self::COUNTRY_REGIONS[$countryMatch])) {
                        $regions = implode(', ', self::COUNTRY_REGIONS[$countryMatch]);
                        $inferences[] = "Region should be in {$countryMatch} ({$regions})";
                    }
                    continue;
                }
            }

            // Priority 3: Wine type match
            if (!isset($matchedTypes['wineType'])) {
                $typeMatch = $this->matchWineType($cleanTerm);
                if ($typeMatch) {
                    $matchedTypes['wineType'] = true;
                    $constraints[] = [
                        'type' => 'wineType',
                        'value' => $typeMatch,
                        'confidence' => 0.85 * $confidenceMultiplier,
                    ];
                    if (in_array($typeMatch, ['Red', 'White'])) {
                        $inferences[] = "Grapes should be {$typeMatch} varieties";
                    }
                    continue;
                }
            }

            // Priority 4: Grape match
            if (!isset($matchedTypes['grape'])) {
                $grapeMatch = $this->matchGrape($cleanTerm);
                if ($grapeMatch) {
                    $matchedTypes['grape'] = true;
                    $constraints[] = [
                        'type' => 'grape',
                        'value' => $grapeMatch['name'],
                        'confidence' => 0.85 * $confidenceMultiplier,
                    ];
                    if (!isset($matchedTypes['wineType'])) {
                        $matchedTypes['wineType'] = true;
                        $constraints[] = [
                            'type' => 'wineType',
                            'value' => $grapeMatch['color'],
                            'confidence' => 0.80 * $confidenceMultiplier,
                        ];
                        $inferences[] = "Wine type inferred as {$grapeMatch['color']} from grape {$grapeMatch['name']}";
                    }
                    continue;
                }
            }
        }

        // Build prompt snippet
        $promptSnippet = $this->buildPromptSnippet($constraints, $inferences);

        return [
            'constraints' => $constraints,
            'inferences' => $inferences,
            'promptSnippet' => $promptSnippet,
        ];
    }

    // ─────────────────────────────────────────────────────
    // MATCHERS
    // ─────────────────────────────────────────────────────

    /**
     * Match text against known regions
     *
     * @param string $text Lowercase text
     * @return array|null {name, country} or null
     */
    public function matchRegion(string $text): ?array
    {
        if (isset(self::REGIONS[$text])) {
            return self::REGIONS[$text];
        }

        foreach (self::REGIONS as $key => $data) {
            if (strlen($key) >= 4 && strpos($text, $key) !== false) {
                return $data;
            }
        }

        return null;
    }

    /**
     * Match text against known countries
     *
     * @param string $text Lowercase text
     * @return string|null Normalized country name or null
     */
    public function matchCountry(string $text): ?string
    {
        if (isset(self::COUNTRIES[$text])) {
            return self::COUNTRIES[$text];
        }

        foreach (self::COUNTRIES as $key => $name) {
            if (strlen($key) >= 4 && strpos($text, $key) !== false) {
                return $name;
            }
        }

        return null;
    }

    /**
     * Match text against wine types
     *
     * @param string $text Lowercase text
     * @return string|null Normalized wine type or null
     */
    public function matchWineType(string $text): ?string
    {
        foreach (self::WINE_TYPES as $key => $type) {
            if (preg_match('/\b' . preg_quote($key, '/') . '\b/', $text)) {
                return $type;
            }
        }

        return null;
    }

    /**
     * Match text against grape varieties
     *
     * @param string $text Lowercase text
     * @return array|null {name, color} or null
     */
    public function matchGrape(string $text): ?array
    {
        if (isset(self::GRAPES[$text])) {
            return self::GRAPES[$text];
        }

        foreach (self::GRAPES as $key => $data) {
            if (strlen($key) >= 5 && strpos($text, $key) !== false) {
                return $data;
            }
        }

        return null;
    }

    // ─────────────────────────────────────────────────────
    // PROMPT BUILDER
    // ─────────────────────────────────────────────────────

    /**
     * Build a prompt snippet from parsed constraints and inferences
     *
     * @param array $constraints Parsed constraints
     * @param array $inferences Inferred context
     * @return string Prompt snippet to append to LLM prompt
     */
    private function buildPromptSnippet(array $constraints, array $inferences): string
    {
        if (empty($constraints) && empty($inferences)) {
            return '';
        }

        $lines = ['USER CONTEXT (use to guide identification):'];

        foreach ($constraints as $constraint) {
            $lines[] = "- {$constraint['type']}: {$constraint['value']} (user indicated)";
        }

        foreach ($inferences as $inference) {
            $lines[] = "- Inferred: {$inference}";
        }

        $lines[] = 'Ensure identification is consistent with these hints, but trust clear visual/textual evidence over user hints if they conflict.';

        return implode("\n", $lines);
    }

    // ─────────────────────────────────────────────────────
    // POST-LLM VALIDATION
    // ─────────────────────────────────────────────────────

    /**
     * Validate LLM output against user-provided constraints
     * Returns a confidence adjustment value (positive = matches, negative = conflicts)
     *
     * @param array $parsed Parsed wine data from LLM
     * @param array $constraints Constraints from parse()
     * @return int Confidence adjustment (can be positive or negative)
     */
    public function validateAgainstConstraints(array $parsed, array $constraints): int
    {
        $adjustment = 0;

        foreach ($constraints as $constraint) {
            $type = $constraint['type'];
            $expectedValue = $constraint['value'];
            $constraintConfidence = $constraint['confidence'] ?? 0.5;
            $isHighConfidence = $constraintConfidence >= 0.80;

            $actualValue = $this->getFieldValue($parsed, $type);

            if ($actualValue === null) {
                continue;
            }

            $matches = $this->valuesMatch($type, $expectedValue, $actualValue);

            if ($matches) {
                $adjustment += $isHighConfidence ? 15 : 10;
            } else {
                $adjustment -= $isHighConfidence ? 10 : 5;
            }
        }

        return $adjustment;
    }

    /**
     * Get the relevant field value from parsed data for a constraint type
     *
     * @param array $parsed Parsed wine data
     * @param string $type Constraint type
     * @return string|null Field value
     */
    private function getFieldValue(array $parsed, string $type): ?string
    {
        $fieldMap = [
            'country' => 'country',
            'region' => 'region',
            'wineType' => 'wineType',
            'grape' => 'grapes',
        ];

        $field = $fieldMap[$type] ?? $type;
        $value = $parsed[$field] ?? null;

        if (is_array($value)) {
            return !empty($value) ? implode(', ', $value) : null;
        }

        return is_string($value) && $value !== '' ? $value : null;
    }

    /**
     * Check if constraint value matches the LLM output
     *
     * @param string $type Constraint type
     * @param string $expected Expected value
     * @param string $actual Actual value from LLM
     * @return bool Whether values match
     */
    private function valuesMatch(string $type, string $expected, string $actual): bool
    {
        $expectedLower = strtolower($expected);
        $actualLower = strtolower($actual);

        if ($expectedLower === $actualLower) {
            return true;
        }

        if (strpos($actualLower, $expectedLower) !== false || strpos($expectedLower, $actualLower) !== false) {
            return true;
        }

        if ($type === 'grape') {
            return strpos($actualLower, strtolower($expected)) !== false;
        }

        return false;
    }

    /**
     * Public normalization wrapper for frontend validation
     *
     * @param string $field Field type (country, wineType)
     * @param string $value Value to normalize
     * @return string|null Normalized value or null if no match
     */
    public function normalize(string $field, string $value): ?string
    {
        $valueLower = strtolower(trim($value));

        switch ($field) {
            case 'country':
                return $this->matchCountry($valueLower);
            case 'wineType':
                return $this->matchWineType($valueLower);
            default:
                return null;
        }
    }
}

// Backward compatibility alias
class_alias(InferenceEngine::class, 'Agent\Identification\SupplementaryContextParser');

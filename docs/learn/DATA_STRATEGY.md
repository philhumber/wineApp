# Learn Feature - Data Strategy

**Author**: Data Strategy Expert
**Date**: 2026-02-09
**Status**: Proposal - Sprint Planning

---

## Table of Contents

1. [Current Data Inventory](#1-current-data-inventory)
2. [Gap Analysis](#2-gap-analysis)
3. [Schema Proposals](#3-schema-proposals)
4. [Seed Data Expansion Plan](#4-seed-data-expansion-plan)
5. [Personalization Queries](#5-personalization-queries)
6. [Content Generation Strategy](#6-content-generation-strategy)
7. [Architecture Options](#7-architecture-options)
8. [Implementation Roadmap](#8-implementation-roadmap)

---

## 1. Current Data Inventory

### 1.1 Reference Data (Rich -- Ready for Learn)

| Table | Rows | Key Columns | Richness | Learn-Ready? |
|-------|------|-------------|----------|:------------:|
| `country` | 33 | wineHistory, classificationSystem, keyGrapes, totalVineyardHectares, wineRankingWorld | Very Rich | Yes |
| `refGrapeCharacteristics` | 29 | color, body, tannin, acidity, sweetness, primaryFlavors, secondaryFlavors, agingPotential, classicPairings | Very Rich | Yes |
| `refAppellations` | 47 | country, region, subRegion, wineTypes, primaryGrapes, classificationLevel, parentAppellation (hierarchy) | Rich | Yes |
| `refWineStyles` | 30 | wineType, description, characteristics (JSON), typicalGrapes, typicalRegions, servingTemp | Rich | Yes |
| `refPairingRules` | 58 | 5-level specificity hierarchy (foodCategory -> foodItem -> preparationMethod), reasoning, source | Very Rich | Yes |
| `refIntensityProfiles` | 25 | entityType (food/wine_type/grape/style), weight, richness, acidityNeed, tanninTolerance | Moderate | Yes |
| `grapes` | 42 | grapeName, description (detailed paragraphs), picture (Wikipedia URLs) | Rich | Yes |
| `region` | 30+ | regionName, description, climate, soil, map | Rich | Yes |

### 1.2 User Collection Data (Personal Context for Learn)

| Table | Est. Rows | Key Columns | Learn Potential |
|-------|-----------|-------------|-----------------|
| `wine` | ~1000 | wineName, wineTypeID, producerID, year, appellation, description, tastingNotes, pairing, ABV, drinkWindowStart/End | Core personal context |
| `bottles` | ~2000 | bottleSize, location, source, price, currency, purchaseDate | Purchase/collecting patterns |
| `ratings` | ~1000 | overallRating, valueRating, buyAgain, Notes, complexityRating, drinkabilityRating, surpriseRating, foodPairingRating | Taste preferences, learning signals |
| `producers` | ~200+ | producerName, regionID, town, founded, ownership, description | Producer knowledge |
| `grapemix` | ~500+ | wineID, grapeID, mixPercent | Personal grape exposure |
| `critic_scores` | varies | critic, score, scoreYear, source | Quality context |

### 1.3 Enrichment/Cache Data (AI-Generated Content Available)

| Table | Est. Rows | Key Columns | Learn Potential |
|-------|-----------|-------------|-----------------|
| `cacheWineEnrichment` | ~500+ | grapeVarieties (JSON), appellation, alcoholContent, drinkWindowStart/End, productionMethod, criticScores (JSON), body, tannin, acidity, sweetness, overview, tastingNotes, pairingNotes | Massive: wine-level educational content |
| `cacheProducers` | varies | country, region, foundedYear, website, description, winemaker, certifications | Producer deep-dives |
| `cacheCanonicalAliases` | varies | aliasKey, canonicalKey, aliasType | Name resolution |

### 1.4 Existing Empty Tables (Designed but Unpopulated)

| Table | Columns | Original Intent | Learn Repurposing |
|-------|---------|-----------------|-------------------|
| `agentUserTasteProfile` | preferredTypes/Countries/Grapes/Styles (JSON), avoidCharacteristics, priceRange, computedAt | Agent recommendations | Direct reuse for Learn personalization |
| `agentWineEmbeddings` | embedding (1536-dim JSON), embeddingModel, textUsed | Similarity search | Wine similarity for "If you liked X, explore Y" |

### 1.5 Data Volume Summary

| Category | Count | Quality |
|----------|-------|---------|
| Reference grape profiles | 29 with full characteristics, 42 total grapes | High |
| Countries with wine context | 33 with history, classification, key grapes | High |
| Wine regions with terroir data | 30+ with climate, soil, description | High |
| Appellations with hierarchy | 47 with classification levels | High |
| Wine styles with characteristics | 30 with JSON profiles | High |
| Food pairing rules | 58 with 5-tier specificity | High |
| Intensity profiles | 25 (12 food, 6 wine types, 7 grapes) | Moderate |
| Cached enrichments | 500+ with full wine profiles | High |
| User wines | ~1000 with ratings, notes | High |
| User ratings | ~1000 with 7 dimensions | High |

---

## 2. Gap Analysis

### 2.1 Critical Gaps (Must Have for Learn MVP)

| Gap | Impact | Effort | Priority |
|-----|--------|--------|----------|
| **No learning progress tracking** | Cannot track what user has explored/learned | Medium | P0 |
| **No content linking/navigation** | Cannot connect "this grape" to "these wines in your cellar" | Low (query-only) | P0 |
| **No winemaking process content** | Cannot teach how wine is made | High (content creation) | P0 |
| **No topic bookmarking** | Cannot save interesting topics for later | Low | P1 |
| **Missing 13 grape characteristic profiles** | 13 of 42 grapes lack flavor/body/pairing data | Medium | P1 |

### 2.2 Important Gaps (Enhance the Experience)

| Gap | Impact | Effort | Priority |
|-----|--------|--------|----------|
| **No sub-region/microclimate data** | Cannot drill down below region level | High | P2 |
| **No vintage variation data** | Cannot explain "why 2015 Bordeaux is special" | High | P2 |
| **No production method reference** | "Traditional method" vs "Charmat" unexplained | Medium | P2 |
| **No wine serving/decanting guide** | Missing practical knowledge | Low | P2 |
| **Taste profile computation not implemented** | `agentUserTasteProfile` exists but empty | Medium | P2 |

### 2.3 Nice-to-Have Gaps (Future Enrichment)

| Gap | Impact | Effort | Priority |
|-----|--------|--------|----------|
| **No terroir/geology deep content** | Cannot explain volcanic vs limestone soil impact | High | P3 |
| **No wine history timeline data** | Cannot show chronological wine evolution | High | P3 |
| **No quiz/assessment content** | Cannot test knowledge retention | Medium | P3 |
| **No social/comparative data** | "Wine lovers who like X also explore Y" | High | P3 |
| **No sommelier tip content** | Professional wine service knowledge | Medium | P3 |

### 2.4 Existing Data Underutilized

These columns/tables exist but are not surfaced to the user:

- `country.wineHistory` -- Rich history text for each of 33 countries (unused in UI)
- `country.classificationSystem` -- Full classification system explanations (unused)
- `country.keyGrapes` -- JSON arrays of key varieties per country (unused)
- `refGrapeCharacteristics.classicPairings` -- JSON arrays of food pairings (unused)
- `refGrapeCharacteristics.secondaryFlavors` -- Deeper flavor complexity (unused)
- `refWineStyles.characteristics` -- JSON style profiles (unused)
- `refWineStyles.servingTemp` -- Serving temperature guides (unused)
- `refPairingRules.reasoning` -- Explanations of WHY pairings work (unused)
- `cacheWineEnrichment.productionMethod` -- Winemaking process per wine (unused)
- `cacheWineEnrichment.overview` -- AI-generated wine overviews (unused)

**Key insight**: The Learn feature can ship an MVP that primarily surfaces existing hidden data before needing significant new content creation.

---

## 3. Schema Proposals

### 3.1 Learning Progress & Exploration Tracking

```sql
-- =====================================================
-- learnExplorationLog: Track what the user has viewed/explored
-- Enables "You've explored 15 of 42 grape varieties" progress tracking
-- and "Continue where you left off" functionality
-- =====================================================

CREATE TABLE `learnExplorationLog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL DEFAULT 1,
  `topicType` enum(
    'grape', 'country', 'region', 'appellation', 'style',
    'pairing', 'process', 'concept', 'producer'
  ) NOT NULL COMMENT 'Category of explored content',
  `topicId` varchar(100) NOT NULL COMMENT 'Polymorphic: grapeID, countryID, or slug for concepts',
  `topicName` varchar(200) NOT NULL COMMENT 'Denormalized for fast display',
  `firstViewedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lastViewedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `viewCount` int NOT NULL DEFAULT 1,
  `timeSpentSeconds` int NOT NULL DEFAULT 0 COMMENT 'Approximate engagement time',
  `source` enum('browse', 'cellar_link', 'search', 'recommendation', 'quiz')
    NOT NULL DEFAULT 'browse' COMMENT 'How user arrived at this content',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_topic` (`userId`, `topicType`, `topicId`),
  KEY `idx_user_recent` (`userId`, `lastViewedAt` DESC),
  KEY `idx_topic_popular` (`topicType`, `viewCount` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### 3.2 Topic Bookmarking / Favorites

```sql
-- =====================================================
-- learnBookmarks: Save topics for later / "want to learn"
-- =====================================================

CREATE TABLE `learnBookmarks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL DEFAULT 1,
  `topicType` enum(
    'grape', 'country', 'region', 'appellation', 'style',
    'pairing', 'process', 'concept', 'producer'
  ) NOT NULL,
  `topicId` varchar(100) NOT NULL,
  `topicName` varchar(200) NOT NULL COMMENT 'Denormalized for display',
  `note` text DEFAULT NULL COMMENT 'User note about why they saved this',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_bookmark` (`userId`, `topicType`, `topicId`),
  KEY `idx_user_date` (`userId`, `createdAt` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### 3.3 Educational Content / Articles

```sql
-- =====================================================
-- learnContent: Curated educational content articles
-- Supports both hand-curated and AI-generated content
-- =====================================================

CREATE TABLE `learnContent` (
  `id` int NOT NULL AUTO_INCREMENT,
  `slug` varchar(150) NOT NULL COMMENT 'URL-friendly identifier',
  `title` varchar(255) NOT NULL,
  `subtitle` varchar(255) DEFAULT NULL,
  `category` enum(
    'grape_guide', 'region_guide', 'winemaking', 'tasting',
    'pairing', 'serving', 'history', 'concept', 'style_guide'
  ) NOT NULL,
  `body` text NOT NULL COMMENT 'Markdown content',
  `summary` varchar(500) DEFAULT NULL COMMENT 'Card preview text',
  `difficulty` enum('beginner', 'intermediate', 'advanced') NOT NULL DEFAULT 'beginner',
  `readTimeMinutes` tinyint NOT NULL DEFAULT 3,
  `heroImage` varchar(500) DEFAULT NULL,
  `relatedTopics` json DEFAULT NULL COMMENT '[{"type":"grape","id":"4","name":"Cabernet Sauvignon"}]',
  `tags` json DEFAULT NULL COMMENT '["red wine", "bordeaux", "tannins"]',
  `contentSource` enum('curated', 'ai_generated', 'data_derived') NOT NULL DEFAULT 'curated',
  `aiModel` varchar(50) DEFAULT NULL COMMENT 'Model used if AI-generated',
  `reviewedAt` timestamp DEFAULT NULL COMMENT 'Human review timestamp',
  `isPublished` tinyint(1) NOT NULL DEFAULT 0,
  `sortOrder` int NOT NULL DEFAULT 0 COMMENT 'Within category',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_slug` (`slug`),
  KEY `idx_category_published` (`category`, `isPublished`, `sortOrder`),
  KEY `idx_difficulty` (`difficulty`),
  FULLTEXT KEY `idx_content_search` (`title`, `body`, `tags`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### 3.4 Knowledge Graph / Topic Connections

```sql
-- =====================================================
-- learnTopicLinks: Connect topics to each other
-- Enables "Related topics" navigation and knowledge graph
-- =====================================================

CREATE TABLE `learnTopicLinks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sourceType` enum(
    'grape', 'country', 'region', 'appellation', 'style',
    'pairing', 'process', 'concept', 'producer', 'content'
  ) NOT NULL,
  `sourceId` varchar(100) NOT NULL,
  `targetType` enum(
    'grape', 'country', 'region', 'appellation', 'style',
    'pairing', 'process', 'concept', 'producer', 'content'
  ) NOT NULL,
  `targetId` varchar(100) NOT NULL,
  `linkType` enum(
    'grows_in',           -- grape -> region
    'native_to',          -- grape -> country
    'classified_under',   -- appellation -> country
    'sub_region_of',      -- appellation -> appellation (parent)
    'pairs_with',         -- grape/style -> food
    'used_in',            -- grape -> style
    'similar_to',         -- grape -> grape, region -> region
    'contrasts_with',     -- grape -> grape (educational contrast)
    'explained_in',       -- any -> content article
    'produced_by'         -- style -> region
  ) NOT NULL,
  `strength` decimal(3,2) DEFAULT 1.00 COMMENT '0.00-1.00 relevance strength',
  `metadata` json DEFAULT NULL COMMENT 'Extra context, e.g., {"note": "dominant in blends"}',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_link_pair` (`sourceType`, `sourceId`, `targetType`, `targetId`, `linkType`),
  KEY `idx_source` (`sourceType`, `sourceId`),
  KEY `idx_target` (`targetType`, `targetId`),
  KEY `idx_link_type` (`linkType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### 3.5 Winemaking Process Reference

```sql
-- =====================================================
-- refWinemakingProcesses: Educational content about how wine is made
-- =====================================================

CREATE TABLE `refWinemakingProcesses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `processName` varchar(100) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `category` enum(
    'viticulture', 'harvest', 'fermentation', 'aging',
    'blending', 'finishing', 'sparkling', 'fortified', 'sweet'
  ) NOT NULL,
  `description` text NOT NULL COMMENT 'Detailed educational description',
  `shortDescription` varchar(300) NOT NULL COMMENT 'One-line summary for cards',
  `stageOrder` tinyint NOT NULL DEFAULT 0 COMMENT 'Order in winemaking process',
  `applicableWineTypes` json DEFAULT NULL COMMENT '["Red", "White", "Sparkling"]',
  `relatedProcesses` json DEFAULT NULL COMMENT '[{"id": 5, "relationship": "alternative_to"}]',
  `funFact` varchar(500) DEFAULT NULL COMMENT 'Engaging factoid for cards',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_slug` (`slug`),
  KEY `idx_category_order` (`category`, `stageOrder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### 3.6 Expanded Grape Characteristics (Fill Gaps)

```sql
-- =====================================================
-- Add missing columns to refGrapeCharacteristics
-- =====================================================

ALTER TABLE `refGrapeCharacteristics`
  ADD COLUMN `originCountry` varchar(100) DEFAULT NULL COMMENT 'Country of origin',
  ADD COLUMN `originRegion` varchar(100) DEFAULT NULL COMMENT 'Region of origin',
  ADD COLUMN `parentage` json DEFAULT NULL COMMENT '{"parents": ["Cabernet Franc", "Sauvignon Blanc"]}',
  ADD COLUMN `globalPlantingHectares` int DEFAULT NULL COMMENT 'Estimated global hectares',
  ADD COLUMN `funFact` varchar(500) DEFAULT NULL COMMENT 'Engaging factoid for Learn cards',
  ADD COLUMN `pronunciationGuide` varchar(200) DEFAULT NULL COMMENT 'e.g., "kab-er-NAY soh-vee-NYON"',
  ADD COLUMN `mapImageUrl` varchar(500) DEFAULT NULL COMMENT 'Map showing where this grape grows';
```

### 3.7 Taste Profile Computation Support

```sql
-- =====================================================
-- learnTasteInsights: Computed taste insights from user data
-- More granular than agentUserTasteProfile, specifically for Learn
-- =====================================================

CREATE TABLE `learnTasteInsights` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL DEFAULT 1,
  `insightType` enum(
    'top_grape', 'top_country', 'top_region', 'top_style',
    'preference_body', 'preference_acidity', 'preference_tannin',
    'preference_sweetness', 'price_sweet_spot', 'adventurousness',
    'unexplored_grape', 'unexplored_region', 'unexplored_country'
  ) NOT NULL,
  `insightKey` varchar(100) NOT NULL COMMENT 'Specific item, e.g., grape name',
  `insightValue` decimal(10,2) DEFAULT NULL COMMENT 'Numeric score/count',
  `insightLabel` varchar(200) NOT NULL COMMENT 'Human-readable, e.g., "Pinot Noir (23 bottles, avg 8.2)"',
  `insightDetail` json DEFAULT NULL COMMENT 'Supporting data for drill-down',
  `computedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` timestamp DEFAULT NULL COMMENT 'When to recompute',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_insight` (`userId`, `insightType`, `insightKey`),
  KEY `idx_user_type` (`userId`, `insightType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

---

## 4. Seed Data Expansion Plan

### 4.1 Priority 0 -- Fill Existing Gaps

**Complete the 13 missing grape characteristic profiles:**

The following grapes exist in `grapes` but lack entries in `refGrapeCharacteristics`:

| Grape | Color | Priority Reason |
|-------|-------|-----------------|
| Gamay | red | Major variety (Beaujolais) |
| Cinsault | red | Key blending grape, Provence rosé |
| Corvina | red | Amarone/Valpolicella |
| Rondinella | red | Amarone component |
| Molinara | red | Traditional Valpolicella |
| Garganega | white | Soave |
| Glera | white | Prosecco |
| Touriga Nacional | red | Portugal's finest |
| Touriga Franca | red | Douro's most planted |
| Macabeo | white | Cava/Rioja |
| Parellada | white | Cava |
| Xarel-lo | white | Cava |
| Meunier | red | Champagne's third grape |

```sql
-- Example: Complete the gap for Gamay
INSERT INTO `refGrapeCharacteristics`
  (`grapeName`, `alternateNames`, `color`, `body`, `tannin`, `acidity`, `sweetness`,
   `primaryFlavors`, `secondaryFlavors`, `agingPotential`, `classicPairings`)
VALUES
('Gamay', NULL, 'red', 'light', 'low', 'high', 'dry',
 '["cherry", "raspberry", "violet", "banana", "bubblegum"]',
 '["pepper", "earth", "cinnamon"]',
 'drink-now',
 '["charcuterie", "roast chicken", "salmon", "light pasta"]'),

('Corvina', NULL, 'red', 'medium', 'medium', 'high', 'dry',
 '["sour cherry", "almond", "herbs", "red plum", "spice"]',
 '["raisin", "chocolate", "cinnamon"]',
 'long',
 '["risotto", "braised meats", "hard cheese", "pasta"]'),

('Glera', NULL, 'white', 'light', NULL, 'medium-high', 'off-dry',
 '["green apple", "pear", "white flowers", "melon", "peach"]',
 '["almond", "honey"]',
 'drink-now',
 '["aperitif", "light seafood", "prosciutto", "fruit desserts"]'),

('Touriga Nacional', NULL, 'red', 'full', 'high', 'medium', 'dry',
 '["blackberry", "violet", "dark chocolate", "resinous herbs", "plum"]',
 '["leather", "graphite", "menthol"]',
 'very-long',
 '["grilled meats", "game", "hearty stews", "aged cheese"]'),

('Meunier', '["Pinot Meunier"]', 'red', 'light', 'low', 'medium-high', 'dry',
 '["red berries", "apple", "brioche", "citrus"]',
 '["toast", "honey"]',
 'short',
 '["aperitif", "light seafood", "soft cheese", "sushi"]');

-- ... (remaining 8 grapes follow same pattern)
```

### 4.2 Priority 1 -- Winemaking Process Seed Data

```sql
INSERT INTO `refWinemakingProcesses`
  (`processName`, `slug`, `category`, `description`, `shortDescription`, `stageOrder`,
   `applicableWineTypes`, `funFact`)
VALUES
('Terroir', 'terroir', 'viticulture',
 'Terroir is the French concept encompassing all environmental factors that affect a grape: soil composition, climate, altitude, aspect (slope direction), and even nearby vegetation. Two vineyards separated by a narrow road can produce dramatically different wines because of subtle differences in drainage, sun exposure, or microclimate. Terroir is the reason a Pinot Noir from Burgundy tastes nothing like one from Oregon, even when vinified identically.',
 'The complete environmental fingerprint of a vineyard',
 1, '["Red", "White", "Rosé", "Sparkling", "Dessert", "Fortified"]',
 'In Burgundy, the word "climat" refers to a named vineyard parcel, and the Climats of Burgundy are a UNESCO World Heritage Site.'),

('Harvest', 'harvest', 'harvest',
 'Harvest (vendange in French, vendemmia in Italian) is the most critical decision a winemaker makes each year: when to pick the grapes. Too early means unripe flavors and harsh acidity; too late risks overripe fruit, low acidity, and vulnerability to rot. In premium regions, grapes are often hand-picked to select only the best clusters, while in high-volume regions, mechanical harvesters work through the night when temperatures are coolest to preserve freshness.',
 'The pivotal moment that determines the character of each vintage',
 2, '["Red", "White", "Rosé", "Sparkling", "Dessert", "Fortified"]',
 'In Champagne, the harvest date is decided collectively by a committee for the entire region.'),

('Crushing & Destemming', 'crushing-destemming', 'fermentation',
 'After harvest, grapes are typically destemmed (removing the stems) and gently crushed to release their juice. For red wines, the crushed grapes, skins, seeds, and juice (collectively called "must") ferment together, extracting color, tannin, and flavor from the skins. For white wines, the juice is usually separated from the skins immediately. Some winemakers use whole-cluster fermentation, leaving stems intact for added tannin structure and a distinctive herbal spiciness.',
 'Breaking grapes open to begin the transformation from fruit to wine',
 3, '["Red", "White", "Rosé"]',
 'Ancient winemakers crushed grapes by foot in stone troughs called lagares -- a tradition still practiced for premium Port production.'),

('Alcoholic Fermentation', 'alcoholic-fermentation', 'fermentation',
 'Yeast converts the natural grape sugars into alcohol and carbon dioxide. This can take anywhere from a few days to several weeks. Winemakers choose between native/wild yeasts (present on grape skins, producing more complex but less predictable results) and commercial yeasts (reliable and consistent). Temperature control during fermentation is crucial: cooler fermentation preserves delicate aromatics in whites, while warmer temperatures extract more color and tannin in reds.',
 'Yeast transforms grape sugar into alcohol -- the heart of winemaking',
 4, '["Red", "White", "Rosé", "Sparkling", "Dessert", "Fortified"]',
 'A single gram of grape sugar produces roughly 0.6ml of alcohol. A typical grape with 24 Brix sugar yields around 14% ABV.'),

('Malolactic Fermentation', 'malolactic-fermentation', 'fermentation',
 'MLF is a secondary fermentation where bacteria convert sharp malic acid (think green apple) into softer lactic acid (think cream). Nearly all red wines undergo MLF for smoother texture. For whites, it is a deliberate style choice: oaked Chardonnay typically undergoes full MLF for buttery richness, while Chablis and most Sauvignon Blanc block it to preserve crisp acidity.',
 'The softening step that turns sharp apple-acid into creamy lactic acid',
 5, '["Red", "White"]',
 'The "buttery" quality in oaked Chardonnay comes from diacetyl, a byproduct of MLF -- the same compound that gives butter its flavor.'),

('Oak Aging', 'oak-aging', 'aging',
 'Oak barrels serve three purposes: they add flavors (vanilla, toast, spice, coconut), they allow micro-oxygenation (softening tannins over time), and they contribute tannin structure from the wood itself. French oak tends to add subtle spice and silky tannin, while American oak delivers bolder vanilla and coconut flavors. New barrels have the strongest impact; older barrels ("neutral oak") primarily provide gentle oxygenation without adding flavor.',
 'Barrels add complexity, soften tannins, and shape a wine''s character',
 6, '["Red", "White", "Fortified"]',
 'A standard French oak barrique (225L) costs $800-1200 and adds roughly $2-4 per bottle. Top estates use 100% new oak, which doubles the per-bottle cost.'),

('Traditional Method (Methode Champenoise)', 'traditional-method', 'sparkling',
 'The traditional method involves a second fermentation inside the bottle, trapping CO2 to create fine, persistent bubbles. After fermentation, the wine ages on its dead yeast cells (lees) for months to years, developing complex biscuit, brioche, and toasty flavors. Riddling (turning bottles gradually) collects the lees in the neck, which are then frozen and expelled (disgorgement) before a dosage of sugar-wine solution sets the final sweetness level.',
 'Second fermentation in-bottle creates the world''s finest sparkling wines',
 7, '["Sparkling"]',
 'Non-vintage Champagne must age on lees for at least 15 months; vintage Champagne for 36 months. Some prestige cuvees age for 7-10 years.'),

('Charmat (Tank) Method', 'charmat-method', 'sparkling',
 'The Charmat method (also called Martinotti) performs the second fermentation in large pressurized steel tanks rather than individual bottles. This preserves the primary fruit and floral aromas of the grape, producing fresh, approachable sparkling wines. It is faster and more economical than the traditional method, and is the standard for Prosecco, Lambrusco, and most Asti wines.',
 'Tank fermentation for fresh, fruit-forward sparkling wines like Prosecco',
 8, '["Sparkling"]',
 'Prosecco''s second fermentation takes about 30 days in tank vs 15+ months in bottle for Champagne.'),

('Carbonic Maceration', 'carbonic-maceration', 'fermentation',
 'Whole, uncrushed grape clusters are placed in a sealed tank filled with carbon dioxide. Fermentation begins inside each individual grape, producing distinctive bubblegum, banana, and bright cherry flavors with minimal tannin extraction. This technique is the hallmark of Beaujolais Nouveau and many Beaujolais cru wines, and is increasingly used worldwide for fresh, fruity, immediately drinkable reds.',
 'Intracellular fermentation of whole grapes for fruity, soft reds',
 9, '["Red"]',
 'In full carbonic maceration, enzymes inside the grape convert sugar to alcohol without yeast until the berry reaches about 2% ABV, then conventional fermentation takes over.'),

('Appassimento (Grape Drying)', 'appassimento', 'harvest',
 'Grapes are harvested and then dried on straw mats or in special drying rooms for weeks to months, concentrating sugars, flavors, and acids. This ancient technique is used to make Amarone della Valpolicella (the grapes lose 30-40% of their weight), Recioto, and Vin Santo. The resulting wines are rich, intense, and often high in alcohol.',
 'Drying grapes after harvest to concentrate flavors for rich, powerful wines',
 10, '["Red", "Dessert"]',
 'Amarone grapes are dried for 100-120 days, losing up to 40% of their weight, which concentrates the sugar enough to produce wines of 15-17% ABV.'),

('Botrytis (Noble Rot)', 'botrytis', 'sweet',
 'Botrytis cinerea is a fungus that, under the right conditions of morning moisture and afternoon sun, pierces grape skins and dehydrates the berries without spoiling them. This concentrates sugars, acids, and flavors to extraordinary levels, producing the world''s greatest dessert wines: Sauternes, Tokaji Aszú, German Beerenauslese, and Loire Valley Quarts de Chaume. The infection is unpredictable and hand-harvesting affected berries is labor-intensive.',
 'The "noble rot" fungus that creates the world''s most luscious sweet wines',
 11, '["Dessert"]',
 'At Chateau d''Yquem, pickers may pass through the vineyard up to 13 times over 6 weeks, selecting individual botrytized berries, and the estate produces only one glass of wine per vine.'),

('Fortification', 'fortification', 'fortified',
 'Fortification involves adding a neutral grape spirit (brandy) to wine, raising the alcohol level to 17-22%. For Port, the spirit is added during fermentation, killing the yeast and leaving residual sugar for sweetness. For Sherry, the spirit is added after fermentation is complete, producing a dry base wine that then ages under flor (Fino/Manzanilla) or oxidatively (Oloroso). The timing of fortification is the key difference between sweet and dry fortified wines.',
 'Adding grape spirit to create powerful, long-lived wines like Port and Sherry',
 12, '["Fortified"]',
 'Vintage Port can age for over 100 years. The oldest drinkable Port commercially available dates to the 1800s.');
```

### 4.3 Priority 2 -- Knowledge Graph Seed Data

Auto-populate `learnTopicLinks` from existing reference data:

```sql
-- Grape -> Country (native_to) from refGrapeCharacteristics + country data
-- Example: derive from country.keyGrapes JSON
INSERT INTO `learnTopicLinks`
  (`sourceType`, `sourceId`, `targetType`, `targetId`, `linkType`, `strength`)
SELECT 'grape', gc.id, 'country', c.countryID, 'native_to', 0.90
FROM refGrapeCharacteristics gc
JOIN country c ON JSON_CONTAINS(c.keyGrapes, CONCAT('"', gc.grapeName, '"'))
WHERE c.keyGrapes IS NOT NULL;

-- Grape -> Appellation (grows_in) from refAppellations.primaryGrapes
INSERT INTO `learnTopicLinks`
  (`sourceType`, `sourceId`, `targetType`, `targetId`, `linkType`, `strength`)
SELECT 'grape', gc.id, 'appellation', a.id, 'grows_in', 0.85
FROM refGrapeCharacteristics gc
JOIN refAppellations a ON JSON_CONTAINS(a.primaryGrapes, CONCAT('"', gc.grapeName, '"'))
WHERE a.primaryGrapes IS NOT NULL;

-- Grape -> Style (used_in) from refWineStyles.typicalGrapes
INSERT INTO `learnTopicLinks`
  (`sourceType`, `sourceId`, `targetType`, `targetId`, `linkType`, `strength`)
SELECT 'grape', gc.id, 'style', ws.id, 'used_in', 0.80
FROM refGrapeCharacteristics gc
JOIN refWineStyles ws ON JSON_CONTAINS(ws.typicalGrapes, CONCAT('"', gc.grapeName, '"'))
WHERE ws.typicalGrapes IS NOT NULL;

-- Appellation -> Country (classified_under)
INSERT INTO `learnTopicLinks`
  (`sourceType`, `sourceId`, `targetType`, `targetId`, `linkType`, `strength`)
SELECT 'appellation', a.id, 'country', c.countryID, 'classified_under', 1.00
FROM refAppellations a
JOIN country c ON a.country = c.countryName;

-- Appellation -> Appellation (sub_region_of)
INSERT INTO `learnTopicLinks`
  (`sourceType`, `sourceId`, `targetType`, `targetId`, `linkType`, `strength`)
SELECT 'appellation', a.id, 'appellation', a.parentAppellation, 'sub_region_of', 1.00
FROM refAppellations a
WHERE a.parentAppellation IS NOT NULL;
```

### 4.4 Priority 3 -- Expanded Content

**Pronunciation guides for common mispronounced terms:**

```sql
UPDATE `refGrapeCharacteristics` SET
  pronunciationGuide = 'kab-er-NAY soh-vee-NYON'
WHERE grapeName = 'Cabernet Sauvignon';

UPDATE `refGrapeCharacteristics` SET
  pronunciationGuide = 'PEE-noh NWAR'
WHERE grapeName = 'Pinot Noir';

UPDATE `refGrapeCharacteristics` SET
  pronunciationGuide = 'neb-ee-OH-loh'
WHERE grapeName = 'Nebbiolo';

UPDATE `refGrapeCharacteristics` SET
  pronunciationGuide = 'geh-VURTS-trah-mee-ner'
WHERE grapeName = 'Gewürztraminer';

UPDATE `refGrapeCharacteristics` SET
  pronunciationGuide = 'vee-oh-NYAY'
WHERE grapeName = 'Viognier';

UPDATE `refGrapeCharacteristics` SET
  pronunciationGuide = 'GREW-ner FELT-lee-ner'
WHERE grapeName = 'Grüner Veltliner';

UPDATE `refGrapeCharacteristics` SET
  pronunciationGuide = 'al-bah-REE-nyoh'
WHERE grapeName = 'Albariño';

UPDATE `refGrapeCharacteristics` SET
  pronunciationGuide = 'sahn-joh-VAY-zeh'
WHERE grapeName = 'Sangiovese';

UPDATE `refGrapeCharacteristics` SET
  pronunciationGuide = 'tem-prah-NEE-yoh'
WHERE grapeName = 'Tempranillo';

-- ... etc for all 29 varieties
```

**Fun facts for grape cards:**

```sql
UPDATE `refGrapeCharacteristics` SET
  funFact = 'Cabernet Sauvignon is a natural cross between Cabernet Franc and Sauvignon Blanc, first identified through DNA profiling in 1996 at UC Davis.'
WHERE grapeName = 'Cabernet Sauvignon';

UPDATE `refGrapeCharacteristics` SET
  funFact = 'Pinot Noir is called "the heartbreak grape" because it is so difficult to grow. Clones number over 1,000, more than any other variety.'
WHERE grapeName = 'Pinot Noir';

UPDATE `refGrapeCharacteristics` SET
  funFact = 'Despite its fearsome reputation, Nebbiolo produces pale, translucent wines -- the deep color is all in other grapes; Nebbiolo''s power is in its tannins and aromatics.'
WHERE grapeName = 'Nebbiolo';
```

---

## 5. Personalization Queries

These SQL examples show how to blend personal collection data with reference data for personalized Learn experiences.

### 5.1 "Your Grapes" -- Grapes You've Tried with Characteristics

```sql
-- Which grape varieties has the user actually tasted, with their characteristics?
SELECT
  g.grapeName,
  gc.color,
  gc.body,
  gc.tannin,
  gc.acidity,
  gc.primaryFlavors,
  gc.classicPairings,
  gc.agingPotential,
  gc.pronunciationGuide,
  COUNT(DISTINCT gm.wineID) AS wineCount,
  COUNT(DISTINCT b.bottleID) AS bottleCount,
  ROUND(AVG(r.overallRating), 1) AS avgRating,
  ROUND(
    SUM(CASE WHEN r.buyAgain = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(r.ratingID), 0)
  , 0) AS buyAgainPercent,
  MIN(w.year) AS oldestVintage,
  MAX(w.year) AS newestVintage
FROM grapes g
JOIN grapemix gm ON g.grapeID = gm.grapeID
JOIN wine w ON gm.wineID = w.wineID AND w.deleted = 0
LEFT JOIN bottles b ON w.wineID = b.wineID AND b.deleted = 0
LEFT JOIN ratings r ON w.wineID = r.wineID
LEFT JOIN refGrapeCharacteristics gc ON gc.grapeName = g.grapeName
GROUP BY g.grapeID
ORDER BY wineCount DESC, avgRating DESC;
```

### 5.2 "Your Regions" -- Regions in Your Cellar with Stats

```sql
-- Regions the user has explored through their collection
SELECT
  reg.regionName,
  c.countryName,
  c.code AS countryCode,
  reg.description AS regionDescription,
  reg.climate,
  reg.soil,
  c.wineHistory,
  c.classificationSystem,
  COUNT(DISTINCT w.wineID) AS wineCount,
  COUNT(DISTINCT CASE WHEN b.bottleDrunk = 0 AND b.deleted = 0 THEN b.bottleID END) AS inCellar,
  COUNT(DISTINCT CASE WHEN b.bottleDrunk = 1 THEN b.bottleID END) AS drunk,
  ROUND(AVG(r.overallRating), 1) AS avgRating,
  GROUP_CONCAT(DISTINCT wt.wineType ORDER BY wt.wineType SEPARATOR ', ') AS wineTypes,
  GROUP_CONCAT(DISTINCT g.grapeName ORDER BY g.grapeName SEPARATOR ', ') AS grapesInCollection
FROM region reg
JOIN country c ON reg.countryID = c.countryID
JOIN producers p ON p.regionID = reg.regionID AND p.deleted = 0
JOIN wine w ON w.producerID = p.producerID AND w.deleted = 0
JOIN winetype wt ON w.wineTypeID = wt.wineTypeID
LEFT JOIN bottles b ON w.wineID = b.wineID AND b.deleted = 0
LEFT JOIN ratings r ON w.wineID = r.wineID
LEFT JOIN grapemix gm ON w.wineID = gm.wineID
LEFT JOIN grapes g ON gm.grapeID = g.grapeID
WHERE reg.deleted = 0
GROUP BY reg.regionID
HAVING wineCount > 0
ORDER BY wineCount DESC;
```

### 5.3 "Unexplored Territory" -- Grapes/Regions/Countries You Haven't Tried

```sql
-- Grapes with full profiles that the user has NEVER had in their collection
SELECT
  gc.grapeName,
  gc.color,
  gc.body,
  gc.primaryFlavors,
  gc.classicPairings,
  gc.agingPotential,
  gc.pronunciationGuide,
  -- Find "similar" grapes the user HAS tried (by body + color)
  (
    SELECT GROUP_CONCAT(gc2.grapeName SEPARATOR ', ')
    FROM refGrapeCharacteristics gc2
    JOIN grapes g2 ON gc2.grapeName = g2.grapeName
    JOIN grapemix gm2 ON g2.grapeID = gm2.grapeID
    JOIN wine w2 ON gm2.wineID = w2.wineID AND w2.deleted = 0
    WHERE gc2.color = gc.color
      AND gc2.body = gc.body
      AND gc2.grapeName != gc.grapeName
    LIMIT 3
  ) AS similarGrapesYouKnow
FROM refGrapeCharacteristics gc
LEFT JOIN grapes g ON gc.grapeName = g.grapeName
LEFT JOIN grapemix gm ON g.grapeID = gm.grapeID
LEFT JOIN wine w ON gm.wineID = w.wineID AND w.deleted = 0
WHERE w.wineID IS NULL
ORDER BY gc.color, gc.body;

-- Countries the user has NOT explored
SELECT
  c.countryName,
  c.code,
  c.wineHistory,
  c.classificationSystem,
  c.keyGrapes,
  c.totalVineyardHectares,
  c.wineRankingWorld
FROM country c
LEFT JOIN region reg ON reg.countryID = c.countryID AND reg.deleted = 0
LEFT JOIN producers p ON p.regionID = reg.regionID AND p.deleted = 0
LEFT JOIN wine w ON w.producerID = p.producerID AND w.deleted = 0
WHERE w.wineID IS NULL
  AND c.wineHistory IS NOT NULL
ORDER BY c.wineRankingWorld ASC, c.countryName ASC;
```

### 5.4 "Your Taste Profile" -- Preferences Derived from Ratings

```sql
-- Body preference: what body levels does the user rate highest?
SELECT
  gc.body,
  COUNT(DISTINCT r.ratingID) AS ratingCount,
  ROUND(AVG(r.overallRating), 1) AS avgOverallRating,
  ROUND(AVG(r.valueRating), 1) AS avgValueRating,
  ROUND(
    SUM(CASE WHEN r.buyAgain = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(r.ratingID), 0)
  , 0) AS buyAgainPct
FROM ratings r
JOIN wine w ON r.wineID = w.wineID AND w.deleted = 0
JOIN grapemix gm ON w.wineID = gm.wineID
JOIN grapes g ON gm.grapeID = g.grapeID
JOIN refGrapeCharacteristics gc ON gc.grapeName = g.grapeName
GROUP BY gc.body
ORDER BY avgOverallRating DESC;

-- Acidity preference
SELECT
  gc.acidity,
  COUNT(DISTINCT r.ratingID) AS ratingCount,
  ROUND(AVG(r.overallRating), 1) AS avgOverallRating,
  ROUND(
    SUM(CASE WHEN r.buyAgain = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(r.ratingID), 0)
  , 0) AS buyAgainPct
FROM ratings r
JOIN wine w ON r.wineID = w.wineID AND w.deleted = 0
JOIN grapemix gm ON w.wineID = gm.wineID
JOIN grapes g ON gm.grapeID = g.grapeID
JOIN refGrapeCharacteristics gc ON gc.grapeName = g.grapeName
WHERE gc.acidity IS NOT NULL
GROUP BY gc.acidity
ORDER BY avgOverallRating DESC;

-- Overall taste DNA: top rated flavors
SELECT
  flavor.value AS flavor,
  COUNT(DISTINCT r.ratingID) AS timesRated,
  ROUND(AVG(r.overallRating), 1) AS avgRating
FROM ratings r
JOIN wine w ON r.wineID = w.wineID AND w.deleted = 0
JOIN grapemix gm ON w.wineID = gm.wineID
JOIN grapes g ON gm.grapeID = g.grapeID
JOIN refGrapeCharacteristics gc ON gc.grapeName = g.grapeName
CROSS JOIN JSON_TABLE(gc.primaryFlavors, '$[*]' COLUMNS (value VARCHAR(100) PATH '$')) flavor
WHERE r.overallRating >= 7
GROUP BY flavor.value
HAVING timesRated >= 3
ORDER BY avgRating DESC, timesRated DESC
LIMIT 15;
```

### 5.5 "Adventurousness Score" -- How Diverse is the User's Collection?

```sql
-- Calculate diversity metrics
SELECT
  COUNT(DISTINCT c.countryID) AS countriesExplored,
  (SELECT COUNT(*) FROM country WHERE wineHistory IS NOT NULL) AS countriesAvailable,
  COUNT(DISTINCT reg.regionID) AS regionsExplored,
  (SELECT COUNT(*) FROM region WHERE deleted = 0) AS regionsAvailable,
  COUNT(DISTINCT g.grapeID) AS grapesExplored,
  (SELECT COUNT(*) FROM grapes) AS grapesAvailable,
  COUNT(DISTINCT wt.wineTypeID) AS typesExplored,
  (SELECT COUNT(*) FROM winetype) AS typesAvailable,
  ROUND(
    (COUNT(DISTINCT c.countryID) * 100.0 / NULLIF((SELECT COUNT(*) FROM country WHERE wineHistory IS NOT NULL), 0) +
     COUNT(DISTINCT g.grapeID) * 100.0 / NULLIF((SELECT COUNT(*) FROM grapes), 0) +
     COUNT(DISTINCT wt.wineTypeID) * 100.0 / NULLIF((SELECT COUNT(*) FROM winetype), 0))
    / 3
  , 0) AS adventurenessScore
FROM wine w
JOIN producers p ON w.producerID = p.producerID AND p.deleted = 0
JOIN region reg ON p.regionID = reg.regionID AND reg.deleted = 0
JOIN country c ON reg.countryID = c.countryID
JOIN winetype wt ON w.wineTypeID = wt.wineTypeID
LEFT JOIN grapemix gm ON w.wineID = gm.wineID
LEFT JOIN grapes g ON gm.grapeID = g.grapeID
WHERE w.deleted = 0;
```

---

## 6. Content Generation Strategy

### 6.1 Content Source Matrix

| Content Type | Source | Rationale |
|-------------|--------|-----------|
| Grape profiles (body, tannin, flavors, pairings) | **Data-derived** from `refGrapeCharacteristics` | Already structured, just needs UI |
| Grape descriptions (paragraph text) | **Existing** in `grapes.description` | Rich, detailed text already written |
| Country wine history | **Existing** in `country.wineHistory` | 33 countries already populated |
| Classification systems | **Existing** in `country.classificationSystem` | Already populated |
| Region terroir (climate, soil) | **Existing** in `region.description/climate/soil` | Already populated |
| Appellation hierarchy | **Data-derived** from `refAppellations` | Structure exists, needs navigation UI |
| Wine style characteristics | **Data-derived** from `refWineStyles` | JSON characteristics ready to display |
| Food pairing rules + reasoning | **Existing** in `refPairingRules.reasoning` | 58 rules with explanations |
| Serving temperatures | **Existing** in `refWineStyles.servingTemp` | Already populated |
| Winemaking processes | **New seed data** (Section 4.2) | Needs one-time content creation |
| Pronunciation guides | **New seed data** (Section 4.4) | Simple data entry |
| Fun facts | **AI-generated**, human-reviewed | Good AI use case; verify accuracy |
| "Your taste profile" insights | **Computed** from user data + ref data | SQL-derived (Section 5) |
| "Unexplored territory" suggestions | **Computed** from user data gaps | SQL-derived (Section 5.3) |
| Deep-dive articles | **AI-generated**, human-reviewed | For Phase 2 content expansion |

### 6.2 AI Generation Guidelines

For content that will be AI-generated:

1. **Generate in batches, review before publishing** -- Use `learnContent.isPublished` flag
2. **Always include source attribution** -- `learnContent.contentSource` tracks provenance
3. **Fact-check against reference data** -- Cross-reference AI claims against `refGrapeCharacteristics`, `refAppellations`, `country` data
4. **Generate at appropriate difficulty levels** -- Use the `difficulty` field to target beginner/intermediate/advanced
5. **Prefer data-derived over AI-generated** -- If the data already exists in reference tables, surface it directly rather than asking AI to paraphrase it

### 6.3 Content Freshness Strategy

| Content Type | Update Frequency | Mechanism |
|-------------|-----------------|-----------|
| Reference data (grapes, countries, appellations) | Rarely (annually) | Manual seed data updates |
| Winemaking processes | Static | One-time creation, occasional corrections |
| User taste insights | On-demand / daily | Computed when user visits Learn, cached in `learnTasteInsights` |
| "Unexplored" suggestions | On-demand | Computed from current cellar state |
| AI-generated articles | Batch quarterly | `learnContent` with review workflow |
| Fun facts | Batch with review | Low-churn, high-engagement content |

---

## 7. Architecture Options

### Option A: "Data-First" (Recommended for MVP)

**Philosophy**: Surface existing reference data + computed personal insights with minimal new content.

**New Tables**: 2 (learnExplorationLog, learnBookmarks)
**New Columns**: 5 (on refGrapeCharacteristics)
**New Content**: None initially -- all from existing DB
**API Endpoints**: 4-5 new PHP endpoints
**Frontend**: New Learn route + components reading existing data

**Pros**:
- Ships fast (days, not weeks)
- Zero content creation dependency
- Already-verified data (seed data is curated)
- Personalization from day one via collection queries

**Cons**:
- Limited depth (no articles, no processes)
- Learn experience feels more like "reference" than "education"
- No engagement tracking initially

**Schema impact**: Minimal -- 2 small tables + ALTER on refGrapeCharacteristics.

### Option B: "Content-Rich" (Recommended for Phase 2)

**Philosophy**: Full educational platform with articles, processes, knowledge graph, and progress tracking.

**New Tables**: 6 (all from Section 3)
**New Columns**: 7 (on refGrapeCharacteristics)
**New Seed Data**: Winemaking processes (12 entries), knowledge graph links (auto-generated), pronunciation guides
**API Endpoints**: 8-10 new PHP endpoints
**Frontend**: Full Learn section with multiple views

**Pros**:
- Rich, engaging educational experience
- Knowledge graph enables discovery
- Progress tracking drives return visits
- Bookmarking enables "learning wishlist"

**Cons**:
- More development effort
- Winemaking process content needs creation
- Knowledge graph needs curation/QA

**Schema impact**: 6 new tables, all self-contained (no changes to existing tables beyond refGrapeCharacteristics ALTER).

### Option C: "AI-Powered Learn" (Future / Phase 3)

**Philosophy**: Use AI to generate personalized educational content on-demand, conversational learning.

**Additional Tables**: `learnContent` (for caching AI outputs), extend `agentSessions` for learn mode
**New Endpoints**: Streaming AI endpoints for conversational learning
**Frontend**: Chat-like interface within Learn section (reuse agent components)

**Pros**:
- Infinite depth on any topic
- Highly personalized (AI reads your cellar, ratings, taste profile)
- Conversational format matches existing agent UX

**Cons**:
- AI cost per interaction
- Hallucination risk for factual wine content
- Requires content review/fact-checking pipeline
- Agent architecture dependency

**Schema impact**: Extends existing agent tables + learnContent for caching.

### Recommended Phasing

| Phase | Option | Timeline | Scope |
|-------|--------|----------|-------|
| Phase 1 (MVP) | **A: Data-First** | Sprint 14 | Surface existing data, basic personal insights |
| Phase 2 | **B: Content-Rich** | Sprint 15-16 | Full schema, processes, knowledge graph, progress tracking |
| Phase 3 | **C: AI-Powered** | Sprint 17+ | Conversational learning, AI-generated deep dives |

---

## 8. Implementation Roadmap

### Phase 1: Data-First MVP

1. **ALTER refGrapeCharacteristics** -- Add pronunciationGuide, funFact, originCountry columns
2. **INSERT missing grape profiles** -- Complete 13 missing refGrapeCharacteristics entries
3. **CREATE learnExplorationLog** -- Basic exploration tracking
4. **CREATE learnBookmarks** -- Topic saving
5. **New PHP endpoints**:
   - `getGrapeProfile.php` -- Single grape with characteristics + user's wines with that grape
   - `getCountryProfile.php` -- Country detail with wine history + user's wines from that country
   - `getRegionProfile.php` -- Region detail with terroir data + user's wines from that region
   - `getLearnOverview.php` -- Dashboard data: exploration stats, taste insights, suggestions
   - `getUnexplored.php` -- Grapes/regions/countries the user hasn't tried
6. **Populate pronunciation guides + fun facts** for 29 grape characteristics

### Phase 2: Content-Rich

1. **CREATE learnContent** -- Article/content storage
2. **CREATE learnTopicLinks** -- Knowledge graph
3. **CREATE refWinemakingProcesses** -- Process reference table
4. **CREATE learnTasteInsights** -- Computed taste cache
5. **Seed winemaking processes** (12 entries from Section 4.2)
6. **Auto-populate knowledge graph** from existing reference data (Section 4.3)
7. **New PHP endpoints** for content, knowledge graph navigation, taste computation
8. **AI batch generation** of fun facts and beginner articles

### Phase 3: AI-Powered

1. Conversational learn mode via agent
2. AI-generated deep-dive articles with fact-checking
3. Wine embeddings for similarity-based recommendations
4. Taste profile computation engine (populate `agentUserTasteProfile`)

---

## Appendix A: Entity Relationship Additions

```
                           EXISTING                                    NEW
                    ┌──────────────────┐                     ┌──────────────────────┐
                    │      grapes      │                     │  learnExplorationLog │
                    │   42 varieties   │                     │   (topic tracking)   │
                    └───────┬──────────┘                     └──────────┬───────────┘
                            │                                          │
                    ┌───────▼──────────┐                     ┌─────────▼───────────┐
                    │refGrapeCharacter-│                     │   learnBookmarks    │
                    │   istics (29)    │◄────────────────────│   (saved topics)    │
                    │ + pronunciations │    topicType=grape  └─────────────────────┘
                    │ + funFacts       │
                    │ + origin         │                     ┌─────────────────────┐
                    └───────┬──────────┘                     │  learnTopicLinks    │
                            │                                │  (knowledge graph)  │
                    ┌───────▼──────────┐                     └──────────┬──────────┘
                    │  refAppellations │◄────────────────────           │
                    │   47 entries     │    grows_in,                   │
                    └───────┬──────────┘    classified_under            │
                            │                                          │
                    ┌───────▼──────────┐                     ┌─────────▼──────────┐
                    │    country       │◄────────────────────│    learnContent    │
                    │   33 entries     │    explained_in     │   (articles)       │
                    │ + wineHistory    │                     └────────────────────┘
                    │ + classification │
                    └───────┬──────────┘                     ┌────────────────────┐
                            │                                │refWinemakingProcess│
                    ┌───────▼──────────┐                     │   (12 processes)   │
                    │    region        │                     └────────────────────┘
                    │   30+ entries    │
                    │ + climate, soil  │                     ┌────────────────────┐
                    └──────────────────┘                     │ learnTasteInsights │
                                                            │   (computed)       │
                    ┌──────────────────┐                     └────────────────────┘
                    │  refWineStyles   │
                    │   30 styles      │
                    └──────────────────┘

                    ┌──────────────────┐
                    │  refPairingRules │
                    │  58 rules (5-lv) │
                    └──────────────────┘
```

## Appendix B: Query Patterns Compatibility

All proposed queries follow the existing codebase patterns:

- **Dynamic WHERE/params**: Same `$where[]`, `$params[]`, `implode()` pattern as `getWines.php`, `getCountries.php`
- **CTE usage**: MySQL 8 CTEs as established in `getWines.php` (WIN-204)
- **JSON functions**: `JSON_CONTAINS()`, `JSON_TABLE()` already available (MySQL 8)
- **Server-side pagination**: LIMIT/OFFSET pattern from `getDrunkWines.php` (WIN-205)
- **No new indexes required on existing tables**: All new indexes are on new tables only

## Appendix C: Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Grape characteristic data inaccuracies | Low | Medium | Cross-reference with Wine Folly, CMS textbooks |
| Pronunciation guide errors | Medium | Low | Professional sommelier review |
| AI-generated fun facts hallucination | Medium | Medium | Human review before `isPublished = 1` |
| Performance of taste profile queries | Low | Medium | Cache in `learnTasteInsights`, compute async |
| Knowledge graph becoming stale | Low | Low | Auto-regenerate from reference data on seed updates |
| User engagement with reference-heavy content | Medium | High | Phase 2 adds richer content; track via `learnExplorationLog` |

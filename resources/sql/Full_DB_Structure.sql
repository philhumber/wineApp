-- phpMyAdmin SQL Dump
-- version 5.2.1deb3
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Feb 09, 2026 at 04:13 PM
-- Server version: 8.0.44-0ubuntu0.24.04.2
-- PHP Version: 8.3.6

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `winelist`
--

-- --------------------------------------------------------

--
-- Table structure for table `agentIdentificationResults`
--

CREATE TABLE `agentIdentificationResults` (
  `id` bigint NOT NULL,
  `userId` int NOT NULL DEFAULT '1',
  `sessionId` int DEFAULT NULL,
  `inputType` enum('text','image') NOT NULL,
  `inputHash` varchar(64) DEFAULT NULL COMMENT 'Hash of input for dedup analysis',
  `finalConfidence` int NOT NULL COMMENT '0-100 confidence score',
  `finalAction` varchar(30) NOT NULL COMMENT 'auto_populate, suggest, user_choice, disambiguate',
  `finalTier` varchar(20) NOT NULL COMMENT 'tier1, tier1_5, tier2, tier3, user_choice',
  `tier1Confidence` int DEFAULT NULL COMMENT 'Gemini Flash (low thinking)',
  `tier1_5Confidence` int DEFAULT NULL COMMENT 'Gemini Flash (high thinking)',
  `tier2Confidence` int DEFAULT NULL COMMENT 'Claude Sonnet',
  `tier3Confidence` int DEFAULT NULL COMMENT 'Claude Opus (user-triggered)',
  `tier1Model` varchar(50) DEFAULT NULL,
  `tier1_5Model` varchar(50) DEFAULT NULL,
  `tier2Model` varchar(50) DEFAULT NULL,
  `tier3Model` varchar(50) DEFAULT NULL,
  `totalCostUSD` decimal(10,6) NOT NULL DEFAULT '0.000000',
  `totalLatencyMs` int DEFAULT NULL,
  `identifiedProducer` varchar(255) DEFAULT NULL,
  `identifiedWineName` varchar(255) DEFAULT NULL,
  `identifiedVintage` int DEFAULT NULL,
  `identifiedRegion` varchar(100) DEFAULT NULL,
  `userAccepted` tinyint(1) DEFAULT NULL COMMENT 'Did user confirm this identification?',
  `userCorrected` tinyint(1) DEFAULT NULL COMMENT 'Did user make corrections?',
  `inferencesApplied` json DEFAULT NULL COMMENT 'Array of inference types applied',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `agentIdentificationResults`:
--

-- --------------------------------------------------------

--
-- Table structure for table `agentSessions`
--

CREATE TABLE `agentSessions` (
  `id` int NOT NULL,
  `userId` int NOT NULL DEFAULT '1',
  `sessionToken` varchar(100) NOT NULL,
  `state` enum('idle','identifying','disambiguating','enriching','pairing') DEFAULT 'idle',
  `contextData` json DEFAULT NULL COMMENT 'Current wine, candidates, etc.',
  `lastActivityAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `agentSessions`:
--   `userId`
--       `agentUsers` -> `id`
--

-- --------------------------------------------------------

--
-- Table structure for table `agentUsageDaily`
--

CREATE TABLE `agentUsageDaily` (
  `id` int NOT NULL,
  `userId` int NOT NULL DEFAULT '1',
  `date` date NOT NULL,
  `provider` varchar(20) NOT NULL,
  `requestCount` int NOT NULL DEFAULT '0',
  `successCount` int NOT NULL DEFAULT '0',
  `failureCount` int NOT NULL DEFAULT '0',
  `totalInputTokens` bigint NOT NULL DEFAULT '0',
  `totalOutputTokens` bigint NOT NULL DEFAULT '0',
  `totalCostUSD` decimal(10,4) NOT NULL DEFAULT '0.0000',
  `avgLatencyMs` int DEFAULT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `agentUsageDaily`:
--

-- --------------------------------------------------------

--
-- Table structure for table `agentUsageLog`
--

CREATE TABLE `agentUsageLog` (
  `id` bigint NOT NULL,
  `userId` int NOT NULL DEFAULT '1',
  `sessionId` int DEFAULT NULL,
  `provider` varchar(20) NOT NULL COMMENT 'gemini, claude, openai',
  `model` varchar(50) NOT NULL,
  `taskType` varchar(50) NOT NULL COMMENT 'identify_text, enrich, pair',
  `inputTokens` int NOT NULL DEFAULT '0',
  `outputTokens` int NOT NULL DEFAULT '0',
  `totalTokens` int GENERATED ALWAYS AS ((`inputTokens` + `outputTokens`)) STORED,
  `costUSD` decimal(10,6) NOT NULL DEFAULT '0.000000',
  `latencyMs` int DEFAULT NULL,
  `success` tinyint(1) NOT NULL DEFAULT '1',
  `errorType` varchar(50) DEFAULT NULL,
  `errorMessage` text,
  `requestHash` varchar(64) DEFAULT NULL COMMENT 'For dedup detection',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `agentUsageLog`:
--

-- --------------------------------------------------------

--
-- Table structure for table `agentUsers`
--

CREATE TABLE `agentUsers` (
  `id` int NOT NULL,
  `externalId` varchar(255) DEFAULT NULL COMMENT 'Future auth provider ID',
  `displayName` varchar(100) NOT NULL DEFAULT 'Default User',
  `email` varchar(255) DEFAULT NULL,
  `preferences` json DEFAULT NULL COMMENT 'User preferences blob',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `agentUsers`:
--

-- --------------------------------------------------------

--
-- Table structure for table `agentUserTasteProfile`
--

CREATE TABLE `agentUserTasteProfile` (
  `id` int NOT NULL,
  `userId` int NOT NULL,
  `profileType` enum('computed','stated') NOT NULL DEFAULT 'computed',
  `preferredTypes` json DEFAULT NULL COMMENT '{"Red": 0.7, "White": 0.3}',
  `preferredCountries` json DEFAULT NULL,
  `preferredGrapes` json DEFAULT NULL,
  `preferredStyles` json DEFAULT NULL,
  `avoidCharacteristics` json DEFAULT NULL COMMENT '["high tannin", "oaky"]',
  `priceRangeMin` decimal(10,2) DEFAULT NULL,
  `priceRangeMax` decimal(10,2) DEFAULT NULL,
  `computedAt` timestamp NULL DEFAULT NULL,
  `ratingCount` int DEFAULT '0',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `agentUserTasteProfile`:
--   `userId`
--       `agentUsers` -> `id`
--

-- --------------------------------------------------------

--
-- Table structure for table `agentWineEmbeddings`
--

CREATE TABLE `agentWineEmbeddings` (
  `id` int NOT NULL,
  `wineId` int NOT NULL COMMENT 'FK to wine table',
  `embeddingModel` varchar(50) NOT NULL DEFAULT 'text-embedding-3-small',
  `embeddingVersion` int NOT NULL DEFAULT '1',
  `embedding` json NOT NULL COMMENT '1536-dimensional vector',
  `textUsed` text NOT NULL COMMENT 'Source text for embedding',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `agentWineEmbeddings`:
--

-- --------------------------------------------------------

--
-- Table structure for table `audit_log`
--

CREATE TABLE `audit_log` (
  `auditID` int NOT NULL,
  `tableName` varchar(50) NOT NULL,
  `recordID` int NOT NULL,
  `action` enum('INSERT','UPDATE','DELETE') NOT NULL,
  `columnName` varchar(50) DEFAULT NULL,
  `oldValue` text,
  `newValue` text,
  `changedBy` int DEFAULT NULL,
  `changedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ipAddress` varchar(45) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `audit_log`:
--

-- --------------------------------------------------------

--
-- Table structure for table `bottles`
--

CREATE TABLE `bottles` (
  `bottleID` int NOT NULL,
  `wineID` int NOT NULL,
  `bottleSize` varchar(50) NOT NULL,
  `location` varchar(50) NOT NULL,
  `source` varchar(50) NOT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `currency` char(3) DEFAULT NULL,
  `purchaseDate` date DEFAULT NULL,
  `dateAdded` date NOT NULL,
  `bottleDrunk` tinyint(1) NOT NULL DEFAULT '0',
  `deleted` tinyint DEFAULT '0',
  `deletedAt` timestamp NULL DEFAULT NULL,
  `deletedBy` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `bottles`:
--   `wineID`
--       `wine` -> `wineID`
--

-- --------------------------------------------------------

--
-- Table structure for table `bottle_sizes`
--

CREATE TABLE `bottle_sizes` (
  `sizeCode` varchar(20) NOT NULL COMMENT 'Size code matching bottles.bottleSize',
  `sizeName` varchar(50) NOT NULL COMMENT 'Display name with volume',
  `volumeLitres` decimal(5,3) NOT NULL COMMENT 'Volume in litres',
  `isActive` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Show in size selector',
  `sortOrder` int NOT NULL DEFAULT '0' COMMENT 'Display order in dropdowns'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `bottle_sizes`:
--

-- --------------------------------------------------------

--
-- Table structure for table `cacheCanonicalAliases`
--

CREATE TABLE `cacheCanonicalAliases` (
  `id` int NOT NULL,
  `aliasKey` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Variant key, e.g., "ch-margaux|margaux|2015"',
  `canonicalKey` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Canonical key in cacheWineEnrichment',
  `aliasType` enum('abbreviation','variant','fuzzy') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'variant' COMMENT 'How alias was created',
  `confidence` decimal(3,2) DEFAULT '1.00' COMMENT 'Match confidence when alias was created',
  `hitCount` int NOT NULL DEFAULT '0' COMMENT 'Times this alias resolved successfully',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `lastUsedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `cacheCanonicalAliases`:
--

-- --------------------------------------------------------

--
-- Table structure for table `cacheProducers`
--

CREATE TABLE `cacheProducers` (
  `id` int NOT NULL,
  `producerName` varchar(255) NOT NULL,
  `normalizedName` varchar(255) NOT NULL COMMENT 'Lowercase, no accents',
  `country` varchar(100) DEFAULT NULL,
  `region` varchar(100) DEFAULT NULL,
  `foundedYear` int DEFAULT NULL,
  `website` varchar(500) DEFAULT NULL,
  `description` text,
  `winemaker` varchar(255) DEFAULT NULL,
  `certifications` json DEFAULT NULL COMMENT '["organic", "biodynamic"]',
  `staticFetchedAt` timestamp NULL DEFAULT NULL COMMENT 'foundedYear, country - 365 day TTL',
  `semiStaticFetchedAt` timestamp NULL DEFAULT NULL COMMENT 'winemaker, description - 180 day TTL',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `cacheProducers`:
--

-- --------------------------------------------------------

--
-- Table structure for table `cacheWineEnrichment`
--

CREATE TABLE `cacheWineEnrichment` (
  `id` int NOT NULL,
  `wineId` int DEFAULT NULL COMMENT 'FK to wine table if linked',
  `lookupKey` varchar(500) NOT NULL COMMENT 'producer|wineName|vintage',
  `grapeVarieties` json DEFAULT NULL,
  `appellation` varchar(150) DEFAULT NULL,
  `alcoholContent` decimal(4,2) DEFAULT NULL,
  `drinkWindowStart` int DEFAULT NULL,
  `drinkWindowEnd` int DEFAULT NULL,
  `productionMethod` text,
  `criticScores` json DEFAULT NULL COMMENT '[{"critic": "WS", "score": 94, "year": 2023}]',
  `averagePrice` decimal(10,2) DEFAULT NULL,
  `priceSource` varchar(50) DEFAULT NULL,
  `priceFetchedAt` timestamp NULL DEFAULT NULL,
  `staticFetchedAt` timestamp NULL DEFAULT NULL,
  `semiStaticFetchedAt` timestamp NULL DEFAULT NULL,
  `dynamicFetchedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `body` enum('Light','Medium-Light','Medium','Medium-Full','Full') DEFAULT NULL,
  `tannin` enum('Low','Medium-Low','Medium','Medium-High','High') DEFAULT NULL,
  `acidity` enum('Low','Medium-Low','Medium','Medium-High','High') DEFAULT NULL,
  `sweetness` enum('Dry','Off-Dry','Medium-Sweet','Sweet') DEFAULT NULL,
  `confidence` decimal(3,2) DEFAULT NULL COMMENT '0.00-1.00',
  `dataSource` varchar(100) DEFAULT NULL COMMENT 'web_search, inference, cache',
  `hitCount` int NOT NULL DEFAULT '0' COMMENT 'Cache hit counter',
  `lastAccessedAt` timestamp NULL DEFAULT NULL COMMENT 'Last cache access time',
  `overview` text COMMENT 'AI-generated wine overview/description',
  `tastingNotes` text COMMENT 'AI-generated tasting notes',
  `pairingNotes` text COMMENT 'AI-generated food pairing suggestions'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `cacheWineEnrichment`:
--

-- --------------------------------------------------------

--
-- Table structure for table `country`
--

CREATE TABLE `country` (
  `countryID` int NOT NULL,
  `countryName` varchar(255) NOT NULL,
  `code` char(2) NOT NULL COMMENT 'Two-letter country code (ISO 3166-1 alpha-2)',
  `world_code` varchar(255) NOT NULL,
  `full_name` varchar(255) NOT NULL COMMENT 'Full English country name',
  `iso3` char(3) NOT NULL COMMENT 'Three-letter country code (ISO 3166-1 alpha-3)',
  `number` char(3) NOT NULL COMMENT 'Three-digit country number (ISO 3166-1 numeric)',
  `continent` char(2) NOT NULL COMMENT 'Two-letter continent code (ISO 3166-1 alpha-2)',
  `wineHistory` text DEFAULT NULL COMMENT 'Brief history of winemaking in this country',
  `classificationSystem` text DEFAULT NULL COMMENT 'Wine classification system (AOC, DOC, AVA, etc.)',
  `keyGrapes` json DEFAULT NULL COMMENT 'Primary grape varieties JSON array',
  `totalVineyardHectares` int DEFAULT NULL COMMENT 'Total vineyard area (OIV data)',
  `wineRankingWorld` tinyint DEFAULT NULL COMMENT 'Global production ranking'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `country`:
--   `world_code`
--       `worlds` -> `name`
--

-- --------------------------------------------------------

--
-- Table structure for table `critic_scores`
--

CREATE TABLE `critic_scores` (
  `scoreID` int NOT NULL,
  `wineID` int NOT NULL,
  `critic` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'WS, RP, JS, Decanter, etc.',
  `score` int NOT NULL COMMENT '50-100 scale only',
  `scoreYear` year DEFAULT NULL COMMENT 'Year review was published',
  `source` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'URL or publication reference',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `critic_scores`:
--   `wineID`
--       `wine` -> `wineID`
--

-- --------------------------------------------------------

--
-- Table structure for table `currencies`
--

CREATE TABLE `currencies` (
  `currencyCode` char(3) NOT NULL COMMENT 'ISO 4217 currency code',
  `currencyName` varchar(50) NOT NULL COMMENT 'Full currency name',
  `symbol` varchar(10) NOT NULL COMMENT 'Display symbol (€, £, $)',
  `rateToEUR` decimal(10,6) NOT NULL COMMENT 'Multiply EUR by this to get target currency',
  `isActive` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Show in currency selector',
  `sortOrder` int NOT NULL DEFAULT '0' COMMENT 'Display order in dropdowns',
  `lastUpdated` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `currencies`:
--

-- --------------------------------------------------------

--
-- Table structure for table `grapemix`
--

CREATE TABLE `grapemix` (
  `mixID` int NOT NULL,
  `wineID` int NOT NULL,
  `grapeID` int NOT NULL,
  `mixPercent` decimal(10,0) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `grapemix`:
--   `grapeID`
--       `grapes` -> `grapeID`
--   `wineID`
--       `wine` -> `wineID`
--

-- --------------------------------------------------------

--
-- Table structure for table `grapes`
--

CREATE TABLE `grapes` (
  `grapeID` int NOT NULL,
  `grapeName` varchar(50) NOT NULL,
  `description` text NOT NULL,
  `picture` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `grapes`:
--

-- --------------------------------------------------------

--
-- Table structure for table `producers`
--

CREATE TABLE `producers` (
  `producerID` int NOT NULL,
  `producerName` varchar(255) NOT NULL,
  `deleted` tinyint(1) NOT NULL DEFAULT '0',
  `deletedAt` timestamp NULL DEFAULT NULL,
  `deletedBy` int DEFAULT NULL,
  `regionID` int NOT NULL,
  `town` varchar(255) NOT NULL,
  `founded` int NOT NULL,
  `ownership` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `description` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `producers`:
--   `regionID`
--       `region` -> `regionID`
--

-- --------------------------------------------------------

--
-- Table structure for table `ratings`
--

CREATE TABLE `ratings` (
  `ratingID` int NOT NULL,
  `wineID` int NOT NULL,
  `bottleID` int NOT NULL,
  `overallRating` int NOT NULL,
  `valueRating` int NOT NULL,
  `avgRating` decimal(4,2) GENERATED ALWAYS AS (((`overallRating` + `valueRating`) / 2)) VIRTUAL,
  `drinkDate` date NOT NULL,
  `buyAgain` tinyint(1) NOT NULL,
  `Notes` text NOT NULL,
  `complexityRating` tinyint DEFAULT NULL COMMENT 'Optional 0-5: Simple to Multi-layered',
  `drinkabilityRating` tinyint DEFAULT NULL COMMENT 'Optional 0-5: Demanding to Easy drinking',
  `surpriseRating` tinyint DEFAULT NULL COMMENT 'Optional 0-5: Met expectations to Exceeded',
  `foodPairingRating` tinyint DEFAULT NULL COMMENT 'Optional 0-5: Poor match to Perfect pairing'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `ratings`:
--   `bottleID`
--       `bottles` -> `bottleID`
--   `wineID`
--       `wine` -> `wineID`
--

-- --------------------------------------------------------

--
-- Table structure for table `refAbbreviations`
--

CREATE TABLE `refAbbreviations` (
  `id` int NOT NULL,
  `abbreviation` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Abbreviated form, e.g., "Ch.", "Dom."',
  `expansion` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Full form, e.g., "Château", "Domaine"',
  `context` enum('producer','wine','both') COLLATE utf8mb4_unicode_ci DEFAULT 'both' COMMENT 'Where abbreviation typically appears',
  `priority` tinyint DEFAULT '1' COMMENT 'Higher = process first (for overlapping patterns)',
  `isActive` tinyint(1) DEFAULT '1',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `refAbbreviations`:
--

-- --------------------------------------------------------

--
-- Table structure for table `refAppellations`
--

CREATE TABLE `refAppellations` (
  `id` int NOT NULL,
  `appellationName` varchar(150) NOT NULL,
  `normalizedName` varchar(150) NOT NULL DEFAULT '',
  `country` varchar(100) NOT NULL,
  `region` varchar(100) DEFAULT NULL,
  `subRegion` varchar(100) DEFAULT NULL,
  `wineTypes` json DEFAULT NULL COMMENT '["Red", "White"]',
  `primaryGrapes` json DEFAULT NULL,
  `classificationLevel` varchar(50) DEFAULT NULL COMMENT 'Grand Cru, Premier Cru, etc.',
  `parentAppellation` int DEFAULT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `refAppellations`:
--   `parentAppellation`
--       `refAppellations` -> `id`
--

-- --------------------------------------------------------

--
-- Table structure for table `refGrapeCharacteristics`
--

CREATE TABLE `refGrapeCharacteristics` (
  `id` int NOT NULL,
  `grapeName` varchar(100) NOT NULL,
  `alternateNames` json DEFAULT NULL COMMENT '["Syrah", "Shiraz"]',
  `color` enum('red','white','pink') NOT NULL,
  `body` enum('light','medium-light','medium','medium-full','full') NOT NULL,
  `tannin` enum('low','medium-low','medium','medium-high','high') DEFAULT NULL,
  `acidity` enum('low','medium-low','medium','medium-high','high') NOT NULL,
  `sweetness` enum('bone-dry','dry','off-dry','medium-sweet','sweet') DEFAULT 'dry',
  `primaryFlavors` json NOT NULL COMMENT '["black cherry", "plum", "pepper"]',
  `secondaryFlavors` json DEFAULT NULL,
  `agingPotential` enum('drink-now','short','medium','long','very-long') DEFAULT 'medium',
  `classicPairings` json DEFAULT NULL COMMENT '["lamb", "beef", "mushrooms"]',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `refGrapeCharacteristics`:
--

-- --------------------------------------------------------

--
-- Table structure for table `refIntensityProfiles`
--

CREATE TABLE `refIntensityProfiles` (
  `id` int NOT NULL,
  `entityType` enum('food','wine_type','grape','style') NOT NULL,
  `entityName` varchar(100) NOT NULL,
  `weight` decimal(3,2) NOT NULL COMMENT '0.00-1.00, light to heavy',
  `richness` decimal(3,2) NOT NULL COMMENT '0.00-1.00, lean to rich',
  `acidityNeed` decimal(3,2) DEFAULT NULL COMMENT 'For food: how much acidity wanted',
  `tanninTolerance` decimal(3,2) DEFAULT NULL COMMENT 'For food: tannin compatibility',
  `sweetnessAffinity` decimal(3,2) DEFAULT NULL COMMENT 'For food: sweetness pairing',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `refIntensityProfiles`:
--

-- --------------------------------------------------------

--
-- Table structure for table `refPairingRules`
--

CREATE TABLE `refPairingRules` (
  `id` int NOT NULL,
  `foodCategory` varchar(100) NOT NULL COMMENT 'Broad: "Seafood", "Red Meat"',
  `foodSubcategory` varchar(100) DEFAULT NULL COMMENT 'Specific: "Shellfish", "Lamb"',
  `foodItem` varchar(100) DEFAULT NULL COMMENT 'Exact: "Oysters", "Lamb Chops"',
  `preparationMethod` varchar(100) DEFAULT NULL COMMENT '"grilled", "raw", "braised"',
  `wineTypes` json NOT NULL COMMENT '["Sparkling", "White"]',
  `wineStyles` json DEFAULT NULL COMMENT '["Blanc de Blancs", "Muscadet"]',
  `grapeVarieties` json DEFAULT NULL COMMENT '["Chardonnay", "Sauvignon Blanc"]',
  `avoidTypes` json DEFAULT NULL COMMENT 'Types to avoid',
  `avoidStyles` json DEFAULT NULL,
  `specificity` tinyint NOT NULL DEFAULT '1' COMMENT '1=general, 5=exact match',
  `reasoning` text,
  `source` varchar(100) DEFAULT NULL COMMENT 'Wine Folly, CMS, etc.',
  `isActive` tinyint(1) DEFAULT '1',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `refPairingRules`:
--

-- --------------------------------------------------------

--
-- Table structure for table `refWineStyles`
--

CREATE TABLE `refWineStyles` (
  `id` int NOT NULL,
  `styleName` varchar(100) NOT NULL,
  `wineType` enum('Red','White','Rosé','Sparkling','Dessert','Fortified') NOT NULL,
  `description` text,
  `characteristics` json DEFAULT NULL COMMENT '{"body": "light", "sweetness": "dry"}',
  `typicalGrapes` json DEFAULT NULL,
  `typicalRegions` json DEFAULT NULL,
  `servingTemp` varchar(50) DEFAULT NULL COMMENT '"7-10°C" or "45-50°F"',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `refWineStyles`:
--

-- --------------------------------------------------------

--
-- Table structure for table `region`
--

CREATE TABLE `region` (
  `regionID` int NOT NULL,
  `regionName` varchar(50) NOT NULL,
  `countryID` int NOT NULL,
  `description` text NOT NULL,
  `climate` text NOT NULL,
  `soil` text NOT NULL,
  `map` text NOT NULL,
  `deleted` tinyint(1) NOT NULL DEFAULT '0',
  `deletedAt` timestamp NULL DEFAULT NULL,
  `deletedBy` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `region`:
--   `countryID`
--       `country` -> `countryID`
--

-- --------------------------------------------------------

--
-- Table structure for table `user_settings`
--

CREATE TABLE `user_settings` (
  `settingID` int NOT NULL,
  `settingKey` varchar(50) NOT NULL,
  `settingValue` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `user_settings`:
--

-- --------------------------------------------------------

--
-- Stand-in structure for view `vw_model_comparison`
-- (See below for the actual view)
--
CREATE TABLE `vw_model_comparison` (
`avg_confidence` decimal(12,1)
,`model` varchar(50)
,`pct_resolved` decimal(28,1)
,`tier` varchar(7)
,`times_used` bigint
,`times_was_final` decimal(23,0)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `vw_model_confidence_stats`
-- (See below for the actual view)
--
CREATE TABLE `vw_model_confidence_stats` (
`auto_populate_count` decimal(23,0)
,`avg_confidence` decimal(12,1)
,`avg_cost` decimal(11,6)
,`avg_latency_ms` decimal(11,0)
,`finalTier` varchar(20)
,`inputType` enum('text','image')
,`max_confidence` bigint
,`min_confidence` bigint
,`suggest_count` decimal(23,0)
,`total_identifications` bigint
,`user_choice_count` decimal(23,0)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `vw_tier_escalation_analysis`
-- (See below for the actual view)
--
CREATE TABLE `vw_tier_escalation_analysis` (
`avg_confidence` decimal(12,1)
,`date` date
,`pct_auto_populate` decimal(28,1)
,`pct_tier1` decimal(28,1)
,`resolved_tier1` decimal(23,0)
,`resolved_tier1_5` decimal(23,0)
,`resolved_tier2` decimal(23,0)
,`resolved_tier3` decimal(23,0)
,`total` bigint
,`total_cost` decimal(31,4)
,`user_choice` decimal(23,0)
);

-- --------------------------------------------------------

--
-- Table structure for table `wine`
--

CREATE TABLE `wine` (
  `wineID` int NOT NULL,
  `wineName` varchar(50) NOT NULL,
  `wineTypeID` int NOT NULL,
  `producerID` int NOT NULL,
  `year` year DEFAULT NULL,
  `isNonVintage` tinyint(1) DEFAULT '0' COMMENT 'Flag for non-vintage wines (NV)',
  `appellation` varchar(150) DEFAULT NULL COMMENT 'Specific appellation (e.g., Margaux, Pauillac) - more granular than region',
  `description` text NOT NULL,
  `tastingNotes` text NOT NULL,
  `pairing` text NOT NULL,
  `pictureURL` text NOT NULL,
  `ABV` decimal(10,0) DEFAULT NULL,
  `drinkDate` year DEFAULT NULL,
  `rating` decimal(10,0) DEFAULT NULL,
  `bottlesDrunk` int DEFAULT '0',
  `deleted` tinyint DEFAULT '0',
  `deletedAt` timestamp NULL DEFAULT NULL,
  `deletedBy` int DEFAULT NULL,
  `enrichment_status` enum('pending','complete','failed') DEFAULT NULL COMMENT 'AI enrichment: NULL=legacy, pending=queued, complete=done, failed=error',
  `drinkWindowStart` year DEFAULT NULL COMMENT 'Earliest recommended drinking year',
  `drinkWindowEnd` year DEFAULT NULL COMMENT 'Latest optimal drinking year'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `wine`:
--   `producerID`
--       `producers` -> `producerID`
--   `wineTypeID`
--       `winetype` -> `wineTypeID`
--

-- --------------------------------------------------------

--
-- Table structure for table `winetype`
--

CREATE TABLE `winetype` (
  `wineTypeID` int NOT NULL,
  `wineType` varchar(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `winetype`:
--

-- --------------------------------------------------------

--
-- Table structure for table `worlds`
--

CREATE TABLE `worlds` (
  `name` varchar(255) NOT NULL COMMENT 'Wine World'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `worlds`:
--

-- --------------------------------------------------------

--
-- Structure for view `vw_model_comparison`
--
DROP TABLE IF EXISTS `vw_model_comparison`;

CREATE OR REPLACE VIEW `vw_model_comparison`  AS SELECT 'tier1' AS `tier`, `agentIdentificationResults`.`tier1Model` AS `model`, count(0) AS `times_used`, round(avg(`agentIdentificationResults`.`tier1Confidence`),1) AS `avg_confidence`, sum((case when (`agentIdentificationResults`.`finalTier` = 'tier1') then 1 else 0 end)) AS `times_was_final`, round(((100.0 * sum((case when (`agentIdentificationResults`.`finalTier` = 'tier1') then 1 else 0 end))) / count(0)),1) AS `pct_resolved` FROM `agentIdentificationResults` WHERE (`agentIdentificationResults`.`tier1Confidence` is not null) GROUP BY `agentIdentificationResults`.`tier1Model`union all select 'tier1_5' AS `tier`,`agentIdentificationResults`.`tier1_5Model` AS `model`,count(0) AS `times_used`,round(avg(`agentIdentificationResults`.`tier1_5Confidence`),1) AS `avg_confidence`,sum((case when (`agentIdentificationResults`.`finalTier` = 'tier1_5') then 1 else 0 end)) AS `times_was_final`,round(((100.0 * sum((case when (`agentIdentificationResults`.`finalTier` = 'tier1_5') then 1 else 0 end))) / count(0)),1) AS `pct_resolved` from `agentIdentificationResults` where (`agentIdentificationResults`.`tier1_5Confidence` is not null) group by `agentIdentificationResults`.`tier1_5Model` union all select 'tier2' AS `tier`,`agentIdentificationResults`.`tier2Model` AS `model`,count(0) AS `times_used`,round(avg(`agentIdentificationResults`.`tier2Confidence`),1) AS `avg_confidence`,sum((case when (`agentIdentificationResults`.`finalTier` = 'tier2') then 1 else 0 end)) AS `times_was_final`,round(((100.0 * sum((case when (`agentIdentificationResults`.`finalTier` = 'tier2') then 1 else 0 end))) / count(0)),1) AS `pct_resolved` from `agentIdentificationResults` where (`agentIdentificationResults`.`tier2Confidence` is not null) group by `agentIdentificationResults`.`tier2Model` union all select 'tier3' AS `tier`,`agentIdentificationResults`.`tier3Model` AS `model`,count(0) AS `times_used`,round(avg(`agentIdentificationResults`.`tier3Confidence`),1) AS `avg_confidence`,sum((case when (`agentIdentificationResults`.`finalTier` = 'tier3') then 1 else 0 end)) AS `times_was_final`,round(((100.0 * sum((case when (`agentIdentificationResults`.`finalTier` = 'tier3') then 1 else 0 end))) / count(0)),1) AS `pct_resolved` from `agentIdentificationResults` where (`agentIdentificationResults`.`tier3Confidence` is not null) group by `agentIdentificationResults`.`tier3Model`  ;

-- --------------------------------------------------------

--
-- Structure for view `vw_model_confidence_stats`
--
DROP TABLE IF EXISTS `vw_model_confidence_stats`;

CREATE OR REPLACE VIEW `vw_model_confidence_stats`  AS SELECT `agentIdentificationResults`.`finalTier` AS `finalTier`, `agentIdentificationResults`.`inputType` AS `inputType`, count(0) AS `total_identifications`, round(avg(`agentIdentificationResults`.`finalConfidence`),1) AS `avg_confidence`, round(min(`agentIdentificationResults`.`finalConfidence`),0) AS `min_confidence`, round(max(`agentIdentificationResults`.`finalConfidence`),0) AS `max_confidence`, sum((case when (`agentIdentificationResults`.`finalAction` = 'auto_populate') then 1 else 0 end)) AS `auto_populate_count`, sum((case when (`agentIdentificationResults`.`finalAction` = 'suggest') then 1 else 0 end)) AS `suggest_count`, sum((case when (`agentIdentificationResults`.`finalAction` = 'user_choice') then 1 else 0 end)) AS `user_choice_count`, round(avg(`agentIdentificationResults`.`totalCostUSD`),6) AS `avg_cost`, round(avg(`agentIdentificationResults`.`totalLatencyMs`),0) AS `avg_latency_ms` FROM `agentIdentificationResults` GROUP BY `agentIdentificationResults`.`finalTier`, `agentIdentificationResults`.`inputType` ;

-- --------------------------------------------------------

--
-- Structure for view `vw_tier_escalation_analysis`
--
DROP TABLE IF EXISTS `vw_tier_escalation_analysis`;

CREATE OR REPLACE VIEW `vw_tier_escalation_analysis`  AS SELECT cast(`agentIdentificationResults`.`createdAt` as date) AS `date`, count(0) AS `total`, sum((case when (`agentIdentificationResults`.`finalTier` = 'tier1') then 1 else 0 end)) AS `resolved_tier1`, sum((case when (`agentIdentificationResults`.`finalTier` = 'tier1_5') then 1 else 0 end)) AS `resolved_tier1_5`, sum((case when (`agentIdentificationResults`.`finalTier` = 'tier2') then 1 else 0 end)) AS `resolved_tier2`, sum((case when (`agentIdentificationResults`.`finalTier` = 'tier3') then 1 else 0 end)) AS `resolved_tier3`, sum((case when (`agentIdentificationResults`.`finalTier` = 'user_choice') then 1 else 0 end)) AS `user_choice`, round(((100.0 * sum((case when (`agentIdentificationResults`.`finalTier` = 'tier1') then 1 else 0 end))) / count(0)),1) AS `pct_tier1`, round(((100.0 * sum((case when (`agentIdentificationResults`.`finalAction` = 'auto_populate') then 1 else 0 end))) / count(0)),1) AS `pct_auto_populate`, round(avg(`agentIdentificationResults`.`finalConfidence`),1) AS `avg_confidence`, round(sum(`agentIdentificationResults`.`totalCostUSD`),4) AS `total_cost` FROM `agentIdentificationResults` GROUP BY cast(`agentIdentificationResults`.`createdAt` as date) ORDER BY `date` DESC ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `agentIdentificationResults`
--
ALTER TABLE `agentIdentificationResults`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_userId_date` (`userId`,`createdAt`),
  ADD KEY `idx_finalTier` (`finalTier`,`createdAt`),
  ADD KEY `idx_confidence` (`finalConfidence`),
  ADD KEY `idx_action` (`finalAction`),
  ADD KEY `idx_inputType` (`inputType`);

--
-- Indexes for table `agentSessions`
--
ALTER TABLE `agentSessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_sessionToken` (`sessionToken`),
  ADD KEY `idx_userId` (`userId`),
  ADD KEY `idx_expiresAt` (`expiresAt`);

--
-- Indexes for table `agentUsageDaily`
--
ALTER TABLE `agentUsageDaily`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_user_date_provider` (`userId`,`date`,`provider`),
  ADD KEY `idx_date` (`date`);

--
-- Indexes for table `agentUsageLog`
--
ALTER TABLE `agentUsageLog`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_userId_date` (`userId`,`createdAt`),
  ADD KEY `idx_provider` (`provider`,`createdAt`),
  ADD KEY `idx_taskType` (`taskType`,`createdAt`),
  ADD KEY `idx_sessionId` (`sessionId`);

--
-- Indexes for table `agentUsers`
--
ALTER TABLE `agentUsers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_externalId` (`externalId`);

--
-- Indexes for table `agentUserTasteProfile`
--
ALTER TABLE `agentUserTasteProfile`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_userId_type` (`userId`,`profileType`);

--
-- Indexes for table `agentWineEmbeddings`
--
ALTER TABLE `agentWineEmbeddings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_wine_model` (`wineId`,`embeddingModel`),
  ADD KEY `idx_model_version` (`embeddingModel`,`embeddingVersion`);

--
-- Indexes for table `audit_log`
--
ALTER TABLE `audit_log`
  ADD PRIMARY KEY (`auditID`),
  ADD KEY `tableName` (`tableName`,`recordID`),
  ADD KEY `changedAt` (`changedAt`);

--
-- Indexes for table `bottles`
--
ALTER TABLE `bottles`
  ADD PRIMARY KEY (`bottleID`),
  ADD KEY `fk_bottle_wineID` (`wineID`),
  ADD KEY `idx_deleted` (`deleted`),
  ADD KEY `idx_wine_deleted_drunk` (`wineID`,`deleted`,`bottleDrunk`);

--
-- Indexes for table `bottle_sizes`
--
ALTER TABLE `bottle_sizes`
  ADD PRIMARY KEY (`sizeCode`),
  ADD KEY `idx_bottle_sizes_active` (`isActive`,`sortOrder`);

--
-- Indexes for table `cacheCanonicalAliases`
--
ALTER TABLE `cacheCanonicalAliases`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_aliasKey` (`aliasKey`),
  ADD KEY `idx_canonicalKey` (`canonicalKey`),
  ADD KEY `idx_hitCount` (`hitCount` DESC);

--
-- Indexes for table `cacheProducers`
--
ALTER TABLE `cacheProducers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_normalizedName` (`normalizedName`),
  ADD KEY `idx_producerName` (`producerName`);

--
-- Indexes for table `cacheWineEnrichment`
--
ALTER TABLE `cacheWineEnrichment`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_lookupKey` (`lookupKey`),
  ADD KEY `idx_wineId` (`wineId`);

--
-- Indexes for table `country`
--
ALTER TABLE `country`
  ADD PRIMARY KEY (`countryID`),
  ADD UNIQUE KEY `countryName` (`countryName`),
  ADD KEY `fk_country_world` (`world_code`);

--
-- Indexes for table `critic_scores`
--
ALTER TABLE `critic_scores`
  ADD PRIMARY KEY (`scoreID`),
  ADD KEY `idx_wine_critic` (`wineID`,`critic`),
  ADD KEY `idx_score` (`score`);

--
-- Indexes for table `currencies`
--
ALTER TABLE `currencies`
  ADD PRIMARY KEY (`currencyCode`),
  ADD KEY `idx_currencies_active` (`isActive`,`sortOrder`);

--
-- Indexes for table `grapemix`
--
ALTER TABLE `grapemix`
  ADD PRIMARY KEY (`mixID`),
  ADD KEY `fk_grapeMix_wineID` (`wineID`),
  ADD KEY `fk_grapeMix_grapeID` (`grapeID`);

--
-- Indexes for table `grapes`
--
ALTER TABLE `grapes`
  ADD PRIMARY KEY (`grapeID`),
  ADD UNIQUE KEY `idx_grapeName` (`grapeName`);

--
-- Indexes for table `producers`
--
ALTER TABLE `producers`
  ADD PRIMARY KEY (`producerID`),
  ADD UNIQUE KEY `uq_producer_active` (`producerName`,`deletedAt`),
  ADD KEY `fk_producer_region` (`regionID`),
  ADD KEY `idx_deleted` (`deleted`);

--
-- Indexes for table `ratings`
--
ALTER TABLE `ratings`
  ADD PRIMARY KEY (`ratingID`),
  ADD KEY `fk_rating_bottle` (`bottleID`),
  ADD KEY `fk_rating_wine` (`wineID`),
  ADD KEY `idx_ratings_wine_scores` (`wineID`,`overallRating`,`valueRating`,`buyAgain`);

--
-- Indexes for table `refAbbreviations`
--
ALTER TABLE `refAbbreviations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_abbreviation` (`abbreviation`);

--
-- Indexes for table `refAppellations`
--
ALTER TABLE `refAppellations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_appellation` (`appellationName`,`country`),
  ADD KEY `idx_country` (`country`),
  ADD KEY `idx_region` (`region`),
  ADD KEY `parentAppellation` (`parentAppellation`),
  ADD KEY `idx_normalizedName` (`normalizedName`);

--
-- Indexes for table `refGrapeCharacteristics`
--
ALTER TABLE `refGrapeCharacteristics`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_grapeName` (`grapeName`),
  ADD KEY `idx_color` (`color`),
  ADD KEY `idx_body` (`body`);

--
-- Indexes for table `refIntensityProfiles`
--
ALTER TABLE `refIntensityProfiles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_entity` (`entityType`,`entityName`);

--
-- Indexes for table `refPairingRules`
--
ALTER TABLE `refPairingRules`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_foodCategory` (`foodCategory`),
  ADD KEY `idx_specificity` (`specificity` DESC),
  ADD KEY `idx_lookup` (`foodCategory`,`foodSubcategory`,`foodItem`);

--
-- Indexes for table `refWineStyles`
--
ALTER TABLE `refWineStyles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_styleName` (`styleName`),
  ADD KEY `idx_wineType` (`wineType`);

--
-- Indexes for table `region`
--
ALTER TABLE `region`
  ADD PRIMARY KEY (`regionID`),
  ADD UNIQUE KEY `uq_region_active` (`regionName`,`deletedAt`),
  ADD KEY `fk_region_country` (`countryID`),
  ADD KEY `idx_deleted` (`deleted`);

--
-- Indexes for table `user_settings`
--
ALTER TABLE `user_settings`
  ADD PRIMARY KEY (`settingID`),
  ADD UNIQUE KEY `unique_setting_key` (`settingKey`);

--
-- Indexes for table `wine`
--
ALTER TABLE `wine`
  ADD PRIMARY KEY (`wineID`),
  ADD KEY `fk_wine_producerID` (`producerID`),
  ADD KEY `fk_wine_wineTypeID` (`wineTypeID`),
  ADD KEY `idx_deleted` (`deleted`),
  ADD KEY `idx_enrichment_status` (`enrichment_status`),
  ADD KEY `idx_wine_appellation` (`appellation`);

--
-- Indexes for table `winetype`
--
ALTER TABLE `winetype`
  ADD PRIMARY KEY (`wineTypeID`);

--
-- Indexes for table `worlds`
--
ALTER TABLE `worlds`
  ADD PRIMARY KEY (`name`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `agentIdentificationResults`
--
ALTER TABLE `agentIdentificationResults`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `agentSessions`
--
ALTER TABLE `agentSessions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `agentUsageDaily`
--
ALTER TABLE `agentUsageDaily`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `agentUsageLog`
--
ALTER TABLE `agentUsageLog`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `agentUsers`
--
ALTER TABLE `agentUsers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `agentUserTasteProfile`
--
ALTER TABLE `agentUserTasteProfile`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `agentWineEmbeddings`
--
ALTER TABLE `agentWineEmbeddings`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `audit_log`
--
ALTER TABLE `audit_log`
  MODIFY `auditID` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `bottles`
--
ALTER TABLE `bottles`
  MODIFY `bottleID` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `cacheCanonicalAliases`
--
ALTER TABLE `cacheCanonicalAliases`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `cacheProducers`
--
ALTER TABLE `cacheProducers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `cacheWineEnrichment`
--
ALTER TABLE `cacheWineEnrichment`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `country`
--
ALTER TABLE `country`
  MODIFY `countryID` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `critic_scores`
--
ALTER TABLE `critic_scores`
  MODIFY `scoreID` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `grapemix`
--
ALTER TABLE `grapemix`
  MODIFY `mixID` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `grapes`
--
ALTER TABLE `grapes`
  MODIFY `grapeID` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `producers`
--
ALTER TABLE `producers`
  MODIFY `producerID` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ratings`
--
ALTER TABLE `ratings`
  MODIFY `ratingID` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `refAbbreviations`
--
ALTER TABLE `refAbbreviations`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `refAppellations`
--
ALTER TABLE `refAppellations`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `refGrapeCharacteristics`
--
ALTER TABLE `refGrapeCharacteristics`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `refIntensityProfiles`
--
ALTER TABLE `refIntensityProfiles`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `refPairingRules`
--
ALTER TABLE `refPairingRules`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `refWineStyles`
--
ALTER TABLE `refWineStyles`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `region`
--
ALTER TABLE `region`
  MODIFY `regionID` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_settings`
--
ALTER TABLE `user_settings`
  MODIFY `settingID` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `wine`
--
ALTER TABLE `wine`
  MODIFY `wineID` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `winetype`
--
ALTER TABLE `winetype`
  MODIFY `wineTypeID` int NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `agentSessions`
--
ALTER TABLE `agentSessions`
  ADD CONSTRAINT `agentSessions_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `agentUsers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `agentUserTasteProfile`
--
ALTER TABLE `agentUserTasteProfile`
  ADD CONSTRAINT `agentUserTasteProfile_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `agentUsers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `bottles`
--
ALTER TABLE `bottles`
  ADD CONSTRAINT `fk_bottle_wineID` FOREIGN KEY (`wineID`) REFERENCES `wine` (`wineID`) ON DELETE RESTRICT;

--
-- Constraints for table `country`
--
ALTER TABLE `country`
  ADD CONSTRAINT `fk_country_world` FOREIGN KEY (`world_code`) REFERENCES `worlds` (`name`) ON DELETE RESTRICT;

--
-- Constraints for table `critic_scores`
--
ALTER TABLE `critic_scores`
  ADD CONSTRAINT `fk_critic_scores_wine` FOREIGN KEY (`wineID`) REFERENCES `wine` (`wineID`) ON DELETE CASCADE;

--
-- Constraints for table `grapemix`
--
ALTER TABLE `grapemix`
  ADD CONSTRAINT `fk_grapeMix_grapeID` FOREIGN KEY (`grapeID`) REFERENCES `grapes` (`grapeID`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_grapeMix_wineID` FOREIGN KEY (`wineID`) REFERENCES `wine` (`wineID`) ON DELETE RESTRICT;

--
-- Constraints for table `producers`
--
ALTER TABLE `producers`
  ADD CONSTRAINT `fk_producer_region` FOREIGN KEY (`regionID`) REFERENCES `region` (`regionID`) ON DELETE RESTRICT;

--
-- Constraints for table `ratings`
--
ALTER TABLE `ratings`
  ADD CONSTRAINT `fk_rating_bottle` FOREIGN KEY (`bottleID`) REFERENCES `bottles` (`bottleID`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_rating_wine` FOREIGN KEY (`wineID`) REFERENCES `wine` (`wineID`) ON DELETE RESTRICT;

--
-- Constraints for table `refAppellations`
--
ALTER TABLE `refAppellations`
  ADD CONSTRAINT `refAppellations_ibfk_1` FOREIGN KEY (`parentAppellation`) REFERENCES `refAppellations` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `region`
--
ALTER TABLE `region`
  ADD CONSTRAINT `fk_region_country` FOREIGN KEY (`countryID`) REFERENCES `country` (`countryID`) ON DELETE RESTRICT;

--
-- Constraints for table `wine`
--
ALTER TABLE `wine`
  ADD CONSTRAINT `fk_wine_producerID` FOREIGN KEY (`producerID`) REFERENCES `producers` (`producerID`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_wine_wineTypeID` FOREIGN KEY (`wineTypeID`) REFERENCES `winetype` (`wineTypeID`) ON DELETE RESTRICT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

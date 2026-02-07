-- phpMyAdmin SQL Dump
-- version 5.2.1deb3
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Feb 07, 2026 at 01:19 PM
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
-- Database: `winelist_test`
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

--
-- Dumping data for table `bottle_sizes`
--

INSERT INTO `bottle_sizes` (`sizeCode`, `sizeName`, `volumeLitres`, `isActive`, `sortOrder`) VALUES
('Balthazar', 'Balthazar (12L)', 12.000, 1, 11),
('Demi', 'Demi (375ml)', 0.375, 1, 3),
('Jeroboam', 'Jeroboam (3L)', 3.000, 1, 7),
('Litre', 'Litre (1L)', 1.000, 1, 5),
('Magnum', 'Magnum (1.5L)', 1.500, 1, 6),
('Methuselah', 'Methuselah (6L)', 6.000, 1, 9),
('Nebuchadnezzar', 'Nebuchadnezzar (15L)', 15.000, 1, 12),
('Piccolo', 'Piccolo (187.5ml)', 0.187, 1, 1),
('Quarter', 'Quarter (200ml)', 0.187, 1, 2),
('Rehoboam', 'Rehoboam (4.5L)', 4.500, 1, 8),
('Salmanazar', 'Salmanazar (9L)', 9.000, 1, 10),
('Standard', 'Standard (750ml)', 0.750, 1, 4);

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
  `continent` char(2) NOT NULL COMMENT 'Two-letter continent code (ISO 3166-1 alpha-2)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- RELATIONSHIPS FOR TABLE `country`:
--   `world_code`
--       `worlds` -> `name`
--

--
-- Dumping data for table `country`
--

INSERT INTO `country` (`countryID`, `countryName`, `code`, `world_code`, `full_name`, `iso3`, `number`, `continent`) VALUES
(2, 'Afghanistan', 'AF', 'Other World', 'Islamic Republic of Afghanistan', 'AFG', '004', 'AS'),
(3, 'Åland Islands', 'AX', 'Other World', 'Åland Islands', 'ALA', '248', 'EU'),
(4, 'Albania', 'AL', 'Other World', 'Republic of Albania', 'ALB', '008', 'EU'),
(5, 'Algeria', 'DZ', 'Other World', 'People\'s Democratic Republic of Algeria', 'DZA', '012', 'AF'),
(6, 'American Samoa', 'AS', 'Other World', 'American Samoa', 'ASM', '016', 'OC'),
(7, 'Andorra', 'AD', 'Other World', 'Principality of Andorra', 'AND', '020', 'EU'),
(8, 'Angola', 'AO', 'Other World', 'Republic of Angola', 'AGO', '024', 'AF'),
(9, 'Anguilla', 'AI', 'Other World', 'Anguilla', 'AIA', '660', 'NA'),
(10, 'Antarctica', 'AQ', 'Other World', 'Antarctica (the territory South of 60 deg S)', 'ATA', '010', 'AN'),
(11, 'Antigua and Barbuda', 'AG', 'Other World', 'Antigua and Barbuda', 'ATG', '028', 'NA'),
(12, 'Argentina', 'AR', 'New World', 'Argentine Republic', 'ARG', '032', 'SA'),
(13, 'Armenia', 'AM', 'Other World', 'Republic of Armenia', 'ARM', '051', 'AS'),
(14, 'Aruba', 'AW', 'Other World', 'Aruba', 'ABW', '533', 'NA'),
(15, 'Australia', 'AU', 'New World', 'Commonwealth of Australia', 'AUS', '036', 'OC'),
(16, 'Austria', 'AT', 'Old World', 'Republic of Austria', 'AUT', '040', 'EU'),
(17, 'Azerbaijan', 'AZ', 'Other World', 'Republic of Azerbaijan', 'AZE', '031', 'AS'),
(18, 'Bahamas', 'BS', 'Other World', 'Commonwealth of the Bahamas', 'BHS', '044', 'NA'),
(19, 'Bahrain', 'BH', 'Other World', 'Kingdom of Bahrain', 'BHR', '048', 'AS'),
(20, 'Bangladesh', 'BD', 'Other World', 'People\'s Republic of Bangladesh', 'BGD', '050', 'AS'),
(21, 'Barbados', 'BB', 'Other World', 'Barbados', 'BRB', '052', 'NA'),
(22, 'Belarus', 'BY', 'Other World', 'Republic of Belarus', 'BLR', '112', 'EU'),
(23, 'Belgium', 'BE', 'Other World', 'Kingdom of Belgium', 'BEL', '056', 'EU'),
(24, 'Belize', 'BZ', 'Other World', 'Belize', 'BLZ', '084', 'NA'),
(25, 'Benin', 'BJ', 'Other World', 'Republic of Benin', 'BEN', '204', 'AF'),
(26, 'Bermuda', 'BM', 'Other World', 'Bermuda', 'BMU', '060', 'NA'),
(27, 'Bhutan', 'BT', 'Other World', 'Kingdom of Bhutan', 'BTN', '064', 'AS'),
(28, 'Bolivia', 'BO', 'Other World', 'Plurinational State of Bolivia', 'BOL', '068', 'SA'),
(29, 'Bonaire, Sint Eustatius and Saba', 'BQ', 'Other World', 'Bonaire, Sint Eustatius and Saba', 'BES', '535', 'NA'),
(30, 'Bosnia and Herzegovina', 'BA', 'Other World', 'Bosnia and Herzegovina', 'BIH', '070', 'EU'),
(31, 'Botswana', 'BW', 'Other World', 'Republic of Botswana', 'BWA', '072', 'AF'),
(32, 'Bouvet Island (Bouvet°ya)', 'BV', 'Other World', 'Bouvet Island (Bouvet°ya)', 'BVT', '074', 'AN'),
(33, 'Brazil', 'BR', 'Other World', 'Federative Republic of Brazil', 'BRA', '076', 'SA'),
(34, 'British Indian Ocean Territory (Chagos Archipelago)', 'IO', 'Other World', 'British Indian Ocean Territory (Chagos Archipelago)', 'IOT', '086', 'AS'),
(35, 'British Virgin Islands', 'VG', 'Other World', 'British Virgin Islands', 'VGB', '092', 'NA'),
(36, 'Brunei Darussalam', 'BN', 'Other World', 'Brunei Darussalam', 'BRN', '096', 'AS'),
(37, 'Bulgaria', 'BG', 'Old World', 'Republic of Bulgaria', 'BGR', '100', 'EU'),
(38, 'Burkina Faso', 'BF', 'Other World', 'Burkina Faso', 'BFA', '854', 'AF'),
(39, 'Burundi', 'BI', 'Other World', 'Republic of Burundi', 'BDI', '108', 'AF'),
(40, 'Cambodia', 'KH', 'Other World', 'Kingdom of Cambodia', 'KHM', '116', 'AS'),
(41, 'Cameroon', 'CM', 'Other World', 'Republic of Cameroon', 'CMR', '120', 'AF'),
(42, 'Canada', 'CA', 'New World', 'Canada', 'CAN', '124', 'NA'),
(43, 'Cabo Verde', 'CV', 'Other World', 'Republic of Cabo Verde', 'CPV', '132', 'AF'),
(44, 'Cayman Islands', 'KY', 'Other World', 'Cayman Islands', 'CYM', '136', 'NA'),
(45, 'Central African Republic', 'CF', 'Other World', 'Central African Republic', 'CAF', '140', 'AF'),
(46, 'Chad', 'TD', 'Other World', 'Republic of Chad', 'TCD', '148', 'AF'),
(47, 'Chile', 'CL', 'New World', 'Republic of Chile', 'CHL', '152', 'SA'),
(48, 'China', 'CN', 'Other World', 'People\'s Republic of China', 'CHN', '156', 'AS'),
(49, 'Christmas Island', 'CX', 'Other World', 'Christmas Island', 'CXR', '162', 'AS'),
(50, 'Cocos (Keeling) Islands', 'CC', 'Other World', 'Cocos (Keeling) Islands', 'CCK', '166', 'AS'),
(51, 'Colombia', 'CO', 'Other World', 'Republic of Colombia', 'COL', '170', 'SA'),
(52, 'Comoros', 'KM', 'Other World', 'Union of the Comoros', 'COM', '174', 'AF'),
(53, 'Congo', 'CG', 'Other World', 'Republic of the Congo', 'COG', '178', 'AF'),
(54, 'Cook Islands', 'CK', 'Other World', 'Cook Islands', 'COK', '184', 'OC'),
(55, 'Costa Rica', 'CR', 'Other World', 'Republic of Costa Rica', 'CRI', '188', 'NA'),
(56, 'Cote d\'Ivoire', 'CI', 'Other World', 'Republic of Cote d\'Ivoire', 'CIV', '384', 'AF'),
(57, 'Croatia', 'HR', 'Old World', 'Republic of Croatia', 'HRV', '191', 'EU'),
(58, 'Cuba', 'CU', 'Other World', 'Republic of Cuba', 'CUB', '192', 'NA'),
(59, 'Curaçao', 'CW', 'Other World', 'Curaçao', 'CUW', '531', 'NA'),
(60, 'Cyprus', 'CY', 'Old World', 'Republic of Cyprus', 'CYP', '196', 'AS'),
(61, 'Czechia', 'CZ', 'Old World', 'Czech Republic', 'CZE', '203', 'EU'),
(62, 'Denmark', 'DK', 'Other World', 'Kingdom of Denmark', 'DNK', '208', 'EU'),
(63, 'Djibouti', 'DJ', 'Other World', 'Republic of Djibouti', 'DJI', '262', 'AF'),
(64, 'Dominica', 'DM', 'Other World', 'Commonwealth of Dominica', 'DMA', '212', 'NA'),
(65, 'Dominican Republic', 'DO', 'Other World', 'Dominican Republic', 'DOM', '214', 'NA'),
(66, 'Ecuador', 'EC', 'Other World', 'Republic of Ecuador', 'ECU', '218', 'SA'),
(67, 'Egypt', 'EG', 'Other World', 'Arab Republic of Egypt', 'EGY', '818', 'AF'),
(68, 'El Salvador', 'SV', 'Other World', 'Republic of El Salvador', 'SLV', '222', 'NA'),
(69, 'Equatorial Guinea', 'GQ', 'Other World', 'Republic of Equatorial Guinea', 'GNQ', '226', 'AF'),
(70, 'Eritrea', 'ER', 'Other World', 'State of Eritrea', 'ERI', '232', 'AF'),
(71, 'Estonia', 'EE', 'Other World', 'Republic of Estonia', 'EST', '233', 'EU'),
(72, 'Ethiopia', 'ET', 'Other World', 'Federal Democratic Republic of Ethiopia', 'ETH', '231', 'AF'),
(73, 'Faroe Islands', 'FO', 'Other World', 'Faroe Islands', 'FRO', '234', 'EU'),
(74, 'Falkland Islands (Malvinas)', 'FK', 'Other World', 'Falkland Islands (Malvinas)', 'FLK', '238', 'SA'),
(75, 'Fiji', 'FJ', 'Other World', 'Republic of Fiji', 'FJI', '242', 'OC'),
(76, 'Finland', 'FI', 'Other World', 'Republic of Finland', 'FIN', '246', 'EU'),
(77, 'France', 'FR', 'Old World', 'French Republic', 'FRA', '250', 'EU'),
(78, 'French Guiana', 'GF', 'Other World', 'French Guiana', 'GUF', '254', 'SA'),
(79, 'French Polynesia', 'PF', 'Other World', 'French Polynesia', 'PYF', '258', 'OC'),
(80, 'French Southern Territories', 'TF', 'Other World', 'French Southern Territories', 'ATF', '260', 'AN'),
(81, 'Gabon', 'GA', 'Other World', 'Gabonese Republic', 'GAB', '266', 'AF'),
(82, 'Gambia', 'GM', 'Other World', 'Republic of the Gambia', 'GMB', '270', 'AF'),
(83, 'Georgia', 'GE', 'Other World', 'Georgia', 'GEO', '268', 'AS'),
(84, 'Germany', 'DE', 'Old World', 'Federal Republic of Germany', 'DEU', '276', 'EU'),
(85, 'Ghana', 'GH', 'Other World', 'Republic of Ghana', 'GHA', '288', 'AF'),
(86, 'Gibraltar', 'GI', 'Other World', 'Gibraltar', 'GIB', '292', 'EU'),
(87, 'Greece', 'GR', 'Old World', 'Hellenic Republic of Greece', 'GRC', '300', 'EU'),
(88, 'Greenland', 'GL', 'Other World', 'Greenland', 'GRL', '304', 'NA'),
(89, 'Grenada', 'GD', 'Other World', 'Grenada', 'GRD', '308', 'NA'),
(90, 'Guadeloupe', 'GP', 'Other World', 'Guadeloupe', 'GLP', '312', 'NA'),
(91, 'Guam', 'GU', 'Other World', 'Guam', 'GUM', '316', 'OC'),
(92, 'Guatemala', 'GT', 'Other World', 'Republic of Guatemala', 'GTM', '320', 'NA'),
(93, 'Guernsey', 'GG', 'Other World', 'Bailiwick of Guernsey', 'GGY', '831', 'EU'),
(94, 'Guinea', 'GN', 'Other World', 'Republic of Guinea', 'GIN', '324', 'AF'),
(95, 'Guinea-Bissau', 'GW', 'Other World', 'Republic of Guinea-Bissau', 'GNB', '624', 'AF'),
(96, 'Guyana', 'GY', 'Other World', 'Co-operative Republic of Guyana', 'GUY', '328', 'SA'),
(97, 'Haiti', 'HT', 'Other World', 'Republic of Haiti', 'HTI', '332', 'NA'),
(98, 'Heard Island and McDonald Islands', 'HM', 'Other World', 'Heard Island and McDonald Islands', 'HMD', '334', 'AN'),
(99, 'Holy See (Vatican City State)', 'VA', 'Other World', 'Holy See (Vatican City State)', 'VAT', '336', 'EU'),
(100, 'Honduras', 'HN', 'Other World', 'Republic of Honduras', 'HND', '340', 'NA'),
(101, 'Hong Kong', 'HK', 'Other World', 'Hong Kong Special Administrative Region of China', 'HKG', '344', 'AS'),
(102, 'Hungary', 'HU', 'Old World', 'Hungary', 'HUN', '348', 'EU'),
(103, 'Iceland', 'IS', 'Other World', 'Iceland', 'ISL', '352', 'EU'),
(104, 'India', 'IN', 'Other World', 'Republic of India', 'IND', '356', 'AS'),
(105, 'Indonesia', 'ID', 'Other World', 'Republic of Indonesia', 'IDN', '360', 'AS'),
(106, 'Iran', 'IR', 'Other World', 'Islamic Republic of Iran', 'IRN', '364', 'AS'),
(107, 'Iraq', 'IQ', 'Other World', 'Republic of Iraq', 'IRQ', '368', 'AS'),
(108, 'Ireland', 'IE', 'Other World', 'Ireland', 'IRL', '372', 'EU'),
(109, 'Isle of Man', 'IM', 'Other World', 'Isle of Man', 'IMN', '833', 'EU'),
(110, 'Israel', 'IL', 'Other World', 'State of Israel', 'ISR', '376', 'AS'),
(111, 'Italy', 'IT', 'Old World', 'Republic of Italy', 'ITA', '380', 'EU'),
(112, 'Jamaica', 'JM', 'Other World', 'Jamaica', 'JAM', '388', 'NA'),
(113, 'Japan', 'JP', 'Other World', 'Japan', 'JPN', '392', 'AS'),
(114, 'Jersey', 'JE', 'Other World', 'Bailiwick of Jersey', 'JEY', '832', 'EU'),
(115, 'Jordan', 'JO', 'Other World', 'Hashemite Kingdom of Jordan', 'JOR', '400', 'AS'),
(116, 'Kazakhstan', 'KZ', 'Other World', 'Republic of Kazakhstan', 'KAZ', '398', 'AS'),
(117, 'Kenya', 'KE', 'Other World', 'Republic of Kenya', 'KEN', '404', 'AF'),
(118, 'Kiribati', 'KI', 'Other World', 'Republic of Kiribati', 'KIR', '296', 'OC'),
(119, 'North Korea', 'KP', 'Other World', 'Democratic People\'s Republic of Korea', 'PRK', '408', 'AS'),
(120, 'South Korea', 'KR', 'Other World', 'Republic of Korea', 'KOR', '410', 'AS'),
(121, 'Kuwait', 'KW', 'Other World', 'State of Kuwait', 'KWT', '414', 'AS'),
(122, 'Kyrgyz Republic', 'KG', 'Other World', 'Kyrgyz Republic', 'KGZ', '417', 'AS'),
(123, 'Lao People\'s Democratic Republic', 'LA', 'Other World', 'Lao People\'s Democratic Republic', 'LAO', '418', 'AS'),
(124, 'Latvia', 'LV', 'Other World', 'Republic of Latvia', 'LVA', '428', 'EU'),
(125, 'Lebanon', 'LB', 'Other World', 'Lebanese Republic', 'LBN', '422', 'AS'),
(126, 'Lesotho', 'LS', 'Other World', 'Kingdom of Lesotho', 'LSO', '426', 'AF'),
(127, 'Liberia', 'LR', 'Other World', 'Republic of Liberia', 'LBR', '430', 'AF'),
(128, 'Libya', 'LY', 'Other World', 'State of Libya', 'LBY', '434', 'AF'),
(129, 'Liechtenstein', 'LI', 'Other World', 'Principality of Liechtenstein', 'LIE', '438', 'EU'),
(130, 'Lithuania', 'LT', 'Other World', 'Republic of Lithuania', 'LTU', '440', 'EU'),
(131, 'Luxembourg', 'LU', 'Other World', 'Grand Duchy of Luxembourg', 'LUX', '442', 'EU'),
(132, 'Macao', 'MO', 'Other World', 'Macao Special Administrative Region of China', 'MAC', '446', 'AS'),
(133, 'Madagascar', 'MG', 'Other World', 'Republic of Madagascar', 'MDG', '450', 'AF'),
(134, 'Malawi', 'MW', 'Other World', 'Republic of Malawi', 'MWI', '454', 'AF'),
(135, 'Malaysia', 'MY', 'Other World', 'Malaysia', 'MYS', '458', 'AS'),
(136, 'Maldives', 'MV', 'Other World', 'Republic of Maldives', 'MDV', '462', 'AS'),
(137, 'Mali', 'ML', 'Other World', 'Republic of Mali', 'MLI', '466', 'AF'),
(138, 'Malta', 'MT', 'Old World', 'Republic of Malta', 'MLT', '470', 'EU'),
(139, 'Marshall Islands', 'MH', 'Other World', 'Republic of the Marshall Islands', 'MHL', '584', 'OC'),
(140, 'Martinique', 'MQ', 'Other World', 'Martinique', 'MTQ', '474', 'NA'),
(141, 'Mauritania', 'MR', 'Other World', 'Islamic Republic of Mauritania', 'MRT', '478', 'AF'),
(142, 'Mauritius', 'MU', 'Other World', 'Republic of Mauritius', 'MUS', '480', 'AF'),
(143, 'Mayotte', 'YT', 'Other World', 'Mayotte', 'MYT', '175', 'AF'),
(144, 'Mexico', 'MX', 'Other World', 'United Mexican States', 'MEX', '484', 'NA'),
(145, 'Micronesia', 'FM', 'Other World', 'Federated States of Micronesia', 'FSM', '583', 'OC'),
(146, 'Moldova', 'MD', 'Old World', 'Republic of Moldova', 'MDA', '498', 'EU'),
(147, 'Monaco', 'MC', 'Other World', 'Principality of Monaco', 'MCO', '492', 'EU'),
(148, 'Mongolia', 'MN', 'Other World', 'Mongolia', 'MNG', '496', 'AS'),
(149, 'Montenegro', 'ME', 'Other World', 'Montenegro', 'MNE', '499', 'EU'),
(150, 'Montserrat', 'MS', 'Other World', 'Montserrat', 'MSR', '500', 'NA'),
(151, 'Morocco', 'MA', 'Other World', 'Kingdom of Morocco', 'MAR', '504', 'AF'),
(152, 'Mozambique', 'MZ', 'Other World', 'Republic of Mozambique', 'MOZ', '508', 'AF'),
(153, 'Myanmar', 'MM', 'Other World', 'Republic of the Union of Myanmar', 'MMR', '104', 'AS'),
(154, 'Namibia', 'NA', 'Other World', 'Republic of Namibia', 'NAM', '516', 'AF'),
(155, 'Nauru', 'NR', 'Other World', 'Republic of Nauru', 'NRU', '520', 'OC'),
(156, 'Nepal', 'NP', 'Other World', 'Nepal', 'NPL', '524', 'AS'),
(157, 'Netherlands', 'NL', 'Other World', 'Kingdom of the Netherlands', 'NLD', '528', 'EU'),
(158, 'New Caledonia', 'NC', 'Other World', 'New Caledonia', 'NCL', '540', 'OC'),
(159, 'New Zealand', 'NZ', 'New World', 'New Zealand', 'NZL', '554', 'OC'),
(160, 'Nicaragua', 'NI', 'Other World', 'Republic of Nicaragua', 'NIC', '558', 'NA'),
(161, 'Niger', 'NE', 'Other World', 'Republic of Niger', 'NER', '562', 'AF'),
(162, 'Nigeria', 'NG', 'Other World', 'Federal Republic of Nigeria', 'NGA', '566', 'AF'),
(163, 'Niue', 'NU', 'Other World', 'Niue', 'NIU', '570', 'OC'),
(164, 'Norfolk Island', 'NF', 'Other World', 'Norfolk Island', 'NFK', '574', 'OC'),
(165, 'North Macedonia', 'MK', 'Other World', 'Republic of North Macedonia', 'MKD', '807', 'EU'),
(166, 'Northern Mariana Islands', 'MP', 'Other World', 'Commonwealth of the Northern Mariana Islands', 'MNP', '580', 'OC'),
(167, 'Norway', 'NO', 'Other World', 'Kingdom of Norway', 'NOR', '578', 'EU'),
(168, 'Oman', 'OM', 'Other World', 'Sultanate of Oman', 'OMN', '512', 'AS'),
(169, 'Pakistan', 'PK', 'Other World', 'Islamic Republic of Pakistan', 'PAK', '586', 'AS'),
(170, 'Palau', 'PW', 'Other World', 'Republic of Palau', 'PLW', '585', 'OC'),
(171, 'Palestine', 'PS', 'Other World', 'State of Palestine', 'PSE', '275', 'AS'),
(172, 'Panama', 'PA', 'Other World', 'Republic of Panama', 'PAN', '591', 'NA'),
(173, 'Papua New Guinea', 'PG', 'Other World', 'Independent State of Papua New Guinea', 'PNG', '598', 'OC'),
(174, 'Paraguay', 'PY', 'Other World', 'Republic of Paraguay', 'PRY', '600', 'SA'),
(175, 'Peru', 'PE', 'Other World', 'Republic of Peru', 'PER', '604', 'SA'),
(176, 'Philippines', 'PH', 'Other World', 'Republic of the Philippines', 'PHL', '608', 'AS'),
(177, 'Pitcairn Islands', 'PN', 'Other World', 'Pitcairn Islands', 'PCN', '612', 'OC'),
(178, 'Poland', 'PL', 'Other World', 'Republic of Poland', 'POL', '616', 'EU'),
(179, 'Portugal', 'PT', 'Old World', 'Portuguese Republic', 'PRT', '620', 'EU'),
(180, 'Puerto Rico', 'PR', 'Other World', 'Commonwealth of Puerto Rico', 'PRI', '630', 'NA'),
(181, 'Qatar', 'QA', 'Other World', 'State of Qatar', 'QAT', '634', 'AS'),
(182, 'Réunion', 'RE', 'Other World', 'Réunion', 'REU', '638', 'AF'),
(183, 'Romania', 'RO', 'Old World', 'Romania', 'ROU', '642', 'EU'),
(184, 'Russia', 'RU', 'Other World', 'Russian Federation', 'RUS', '643', 'EU'),
(185, 'Rwanda', 'RW', 'Other World', 'Republic of Rwanda', 'RWA', '646', 'AF'),
(186, 'Saint Barthélemy', 'BL', 'Other World', 'Saint Barthélemy', 'BLM', '652', 'NA'),
(187, 'Saint Helena, Ascension and Tristan da Cunha', 'SH', 'Other World', 'Saint Helena, Ascension and Tristan da Cunha', 'SHN', '654', 'AF'),
(188, 'Saint Kitts and Nevis', 'KN', 'Other World', 'Federation of Saint Kitts and Nevis', 'KNA', '659', 'NA'),
(189, 'Saint Lucia', 'LC', 'Other World', 'Saint Lucia', 'LCA', '662', 'NA'),
(190, 'Saint Martin', 'MF', 'Other World', 'Saint Martin (French part)', 'MAF', '663', 'NA'),
(191, 'Saint Pierre and Miquelon', 'PM', 'Other World', 'Saint Pierre and Miquelon', 'SPM', '666', 'NA'),
(192, 'Saint Vincent and the Grenadines', 'VC', 'Other World', 'Saint Vincent and the Grenadines', 'VCT', '670', 'NA'),
(193, 'Samoa', 'WS', 'Other World', 'Independent State of Samoa', 'WSM', '882', 'OC'),
(194, 'San Marino', 'SM', 'Other World', 'Republic of San Marino', 'SMR', '674', 'EU'),
(195, 'Sao Tome and Principe', 'ST', 'Other World', 'Democratic Republic of Sao Tome and Principe', 'STP', '678', 'AF'),
(196, 'Saudi Arabia', 'SA', 'Other World', 'Kingdom of Saudi Arabia', 'SAU', '682', 'AS'),
(197, 'Senegal', 'SN', 'Other World', 'Republic of Senegal', 'SEN', '686', 'AF'),
(198, 'Serbia', 'RS', 'Other World', 'Republic of Serbia', 'SRB', '688', 'EU'),
(199, 'Seychelles', 'SC', 'Other World', 'Republic of Seychelles', 'SYC', '690', 'AF'),
(200, 'Sierra Leone', 'SL', 'Other World', 'Republic of Sierra Leone', 'SLE', '694', 'AF'),
(201, 'Singapore', 'SG', 'Other World', 'Republic of Singapore', 'SGP', '702', 'AS'),
(202, 'Sint Maarten (Dutch part)', 'SX', 'Other World', 'Sint Maarten (Dutch part)', 'SXM', '534', 'NA'),
(203, 'Slovakia (Slovak Republic)', 'SK', 'Old World', 'Slovakia (Slovak Republic)', 'SVK', '703', 'EU'),
(204, 'Slovenia', 'SI', 'Old World', 'Republic of Slovenia', 'SVN', '705', 'EU'),
(205, 'Solomon Islands', 'SB', 'Other World', 'Solomon Islands', 'SLB', '090', 'OC'),
(206, 'Somalia', 'SO', 'Other World', 'Federal Republic of Somalia', 'SOM', '706', 'AF'),
(207, 'South Africa', 'ZA', 'New World', 'Republic of South Africa', 'ZAF', '710', 'AF'),
(208, 'South Georgia and the South Sandwich Islands', 'GS', 'Other World', 'South Georgia and the South Sandwich Islands', 'SGS', '239', 'AN'),
(209, 'South Sudan', 'SS', 'Other World', 'Republic of South Sudan', 'SSD', '728', 'AF'),
(210, 'Spain', 'ES', 'Old World', 'Kingdom of Spain', 'ESP', '724', 'EU'),
(211, 'Sri Lanka', 'LK', 'Other World', 'Democratic Socialist Republic of Sri Lanka', 'LKA', '144', 'AS'),
(212, 'Sudan', 'SD', 'Other World', 'Republic of Sudan', 'SDN', '729', 'AF'),
(213, 'Suriname', 'SR', 'Other World', 'Republic of Suriname', 'SUR', '740', 'SA'),
(214, 'Svalbard & Jan Mayen Islands', 'SJ', 'Other World', 'Svalbard & Jan Mayen Islands', 'SJM', '744', 'EU'),
(215, 'Eswatini', 'SZ', 'Other World', 'Kingdom of Eswatini', 'SWZ', '748', 'AF'),
(216, 'Sweden', 'SE', 'Other World', 'Kingdom of Sweden', 'SWE', '752', 'EU'),
(217, 'Switzerland', 'CH', 'Old World', 'Swiss Confederation', 'CHE', '756', 'EU'),
(218, 'Syrian Arab Republic', 'SY', 'Other World', 'Syrian Arab Republic', 'SYR', '760', 'AS'),
(219, 'Taiwan', 'TW', 'Other World', 'Taiwan, Province of China', 'TWN', '158', 'AS'),
(220, 'Tajikistan', 'TJ', 'Other World', 'Republic of Tajikistan', 'TJK', '762', 'AS'),
(221, 'Tanzania', 'TZ', 'Other World', 'United Republic of Tanzania', 'TZA', '834', 'AF'),
(222, 'Thailand', 'TH', 'Other World', 'Kingdom of Thailand', 'THA', '764', 'AS'),
(223, 'Timor-Leste', 'TL', 'Other World', 'Democratic Republic of Timor-Leste', 'TLS', '626', 'AS'),
(224, 'Togo', 'TG', 'Other World', 'Togolese Republic', 'TGO', '768', 'AF'),
(225, 'Tokelau', 'TK', 'Other World', 'Tokelau', 'TKL', '772', 'OC'),
(226, 'Tonga', 'TO', 'Other World', 'Kingdom of Tonga', 'TON', '776', 'OC'),
(227, 'Trinidad and Tobago', 'TT', 'Other World', 'Republic of Trinidad and Tobago', 'TTO', '780', 'NA'),
(228, 'Tunisia', 'TN', 'Other World', 'Tunisian Republic', 'TUN', '788', 'AF'),
(229, 'Turkey', 'TR', 'Other World', 'Republic of Türkiye', 'TUR', '792', 'AS'),
(230, 'Turkmenistan', 'TM', 'Other World', 'Turkmenistan', 'TKM', '795', 'AS'),
(231, 'Turks and Caicos Islands', 'TC', 'Other World', 'Turks and Caicos Islands', 'TCA', '796', 'NA'),
(232, 'Tuvalu', 'TV', 'Other World', 'Tuvalu', 'TUV', '798', 'OC'),
(233, 'Uganda', 'UG', 'Other World', 'Republic of Uganda', 'UGA', '800', 'AF'),
(234, 'Ukraine', 'UA', 'Other World', 'Ukraine', 'UKR', '804', 'EU'),
(235, 'United Arab Emirates', 'AE', 'Other World', 'United Arab Emirates', 'ARE', '784', 'AS'),
(236, 'United Kingdom', 'GB', 'Other World', 'United Kingdom', 'GBR', '826', 'EU'),
(237, 'United States of America', 'US', 'New World', 'United States of America', 'USA', '840', 'NA'),
(238, 'United States Minor Outlying Islands', 'UM', 'Other World', 'United States Minor Outlying Islands', 'UMI', '581', 'OC'),
(239, 'United States Virgin Islands', 'VI', 'Other World', 'United States Virgin Islands', 'VIR', '850', 'NA'),
(240, 'Uruguay', 'UY', 'Other World', 'Eastern Republic of Uruguay', 'URY', '858', 'SA'),
(241, 'Uzbekistan', 'UZ', 'Other World', 'Republic of Uzbekistan', 'UZB', '860', 'AS'),
(242, 'Vanuatu', 'VU', 'Other World', 'Republic of Vanuatu', 'VUT', '548', 'OC'),
(243, 'Venezuela', 'VE', 'Other World', 'Bolivarian Republic of Venezuela', 'VEN', '862', 'SA'),
(244, 'Vietnam', 'VN', 'Other World', 'Socialist Republic of Vietnam', 'VNM', '704', 'AS'),
(245, 'Wallis and Futuna', 'WF', 'Other World', 'Wallis and Futuna', 'WLF', '876', 'OC'),
(246, 'Western Sahara', 'EH', 'Other World', 'Western Sahara', 'ESH', '732', 'AF'),
(247, 'Yemen', 'YE', 'Other World', 'Yemen', 'YEM', '887', 'AS'),
(248, 'Zambia', 'ZM', 'Other World', 'Republic of Zambia', 'ZMB', '894', 'AF'),
(249, 'Zimbabwe', 'ZW', 'Other World', 'Republic of Zimbabwe', 'ZWE', '716', 'AF');

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

--
-- Dumping data for table `currencies`
--

INSERT INTO `currencies` (`currencyCode`, `currencyName`, `symbol`, `rateToEUR`, `isActive`, `sortOrder`, `lastUpdated`) VALUES
('AUD', 'Australian Dollar', 'A$', 1.650000, 1, 4, '2026-01-24 17:42:09'),
('CHF', 'Swiss Franc', 'CHF ', 0.950000, 1, 6, '2026-01-24 17:42:09'),
('DKK', 'Danish Krone', 'kr ', 7.450000, 1, 7, '2026-01-24 17:42:09'),
('EUR', 'Euro', '€', 1.000000, 1, 2, '2026-01-24 17:42:09'),
('GBP', 'British Pound', '£', 0.854700, 1, 1, '2026-01-24 17:42:09'),
('HKD', 'Hong Kong Dollar', 'HK$', 8.500000, 1, 11, '2026-01-24 17:42:09'),
('JPY', 'Japanese Yen', '¥', 160.000000, 1, 10, '2026-01-24 17:42:09'),
('NOK', 'Norwegian Krone', 'kr ', 11.500000, 1, 8, '2026-01-24 17:42:09'),
('NZD', 'New Zealand Dollar', 'NZ$', 1.750000, 1, 5, '2026-01-24 17:42:09'),
('SEK', 'Swedish Krona', 'kr ', 11.494253, 1, 9, '2026-01-24 17:42:09'),
('USD', 'US Dollar', '$', 1.086957, 1, 3, '2026-01-24 17:42:09');

-- --------------------------------------------------------

--
-- Table structure for table `grapemix`
--

CREATE TABLE `grapemix` (
  `mixID` int NOT NULL,
  `wineID` int NOT NULL,
  `grapeID` int NOT NULL,
  `mixPercent` decimal(10,0) NOT NULL
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
  `regionID` int NOT NULL,
  `town` varchar(255) NOT NULL,
  `founded` text NOT NULL,
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
  `expansion` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Full form, e.g., "Ch├óteau", "Domaine"',
  `context` enum('producer','wine','both') COLLATE utf8mb4_unicode_ci DEFAULT 'both' COMMENT 'Where abbreviation typically appears',
  `priority` tinyint DEFAULT '1' COMMENT 'Higher = process first (for overlapping patterns)',
  `isActive` tinyint(1) DEFAULT '1',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- RELATIONSHIPS FOR TABLE `refAbbreviations`:
--

--
-- Dumping data for table `refAbbreviations`
--

INSERT INTO `refAbbreviations` (`id`, `abbreviation`, `expansion`, `context`, `priority`, `isActive`, `createdAt`) VALUES
(1, 'Ch.', 'Ch├óteau', 'producer', 10, 1, '2026-02-02 13:14:40'),
(2, 'Cht.', 'Ch├óteau', 'producer', 10, 1, '2026-02-02 13:14:40'),
(3, 'Chateau', 'Ch├óteau', 'producer', 9, 1, '2026-02-02 13:14:40'),
(4, 'Dom.', 'Domaine', 'producer', 10, 1, '2026-02-02 13:14:40'),
(5, 'Wgt.', 'Weingut', 'producer', 10, 1, '2026-02-02 13:14:40'),
(6, 'Bod.', 'Bodega', 'producer', 10, 1, '2026-02-02 13:14:40'),
(7, 'Tnta.', 'Tenuta', 'producer', 10, 1, '2026-02-02 13:14:40'),
(8, 'Cstl.', 'Castello', 'producer', 10, 1, '2026-02-02 13:14:40'),
(9, 'Qt├á.', 'Quinta', 'producer', 10, 1, '2026-02-02 13:14:40'),
(10, 'Qta.', 'Quinta', 'producer', 10, 1, '2026-02-02 13:14:40'),
(11, 'Clos', 'Clos', 'producer', 5, 1, '2026-02-02 13:14:40'),
(12, 'Marchesi', 'Marchesi', 'producer', 5, 1, '2026-02-02 13:14:40'),
(13, 'GC', 'Grand Cru', 'wine', 5, 1, '2026-02-02 13:14:40'),
(14, 'PC', 'Premier Cru', 'wine', 5, 1, '2026-02-02 13:14:40'),
(15, '1er Cru', 'Premier Cru', 'wine', 5, 1, '2026-02-02 13:14:40'),
(16, 'VV', 'Vieilles Vignes', 'wine', 5, 1, '2026-02-02 13:14:40'),
(17, 'Res.', 'Reserva', 'wine', 5, 1, '2026-02-02 13:14:40'),
(18, 'Rsv.', 'Riserva', 'wine', 5, 1, '2026-02-02 13:14:40'),
(19, 'Gran Res.', 'Gran Reserva', 'wine', 5, 1, '2026-02-02 13:14:40'),
(20, 'Ste.', 'Sainte', 'both', 8, 1, '2026-02-02 13:14:40'),
(21, 'St.', 'Saint', 'both', 8, 1, '2026-02-02 13:14:40'),
(22, 'Mt.', 'Mont', 'both', 7, 1, '2026-02-02 13:14:40'),
(23, 'Mte.', 'Monte', 'both', 7, 1, '2026-02-02 13:14:40');

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
  `wineType` enum('Red','White','Ros??','Sparkling','Dessert','Fortified') NOT NULL,
  `description` text,
  `characteristics` json DEFAULT NULL COMMENT '{"body": "light", "sweetness": "dry"}',
  `typicalGrapes` json DEFAULT NULL,
  `typicalRegions` json DEFAULT NULL,
  `servingTemp` varchar(50) DEFAULT NULL COMMENT '"7-10??C" or "45-50??F"',
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
  `map` text NOT NULL
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

--
-- Dumping data for table `winetype`
--

INSERT INTO `winetype` (`wineTypeID`, `wineType`) VALUES
(1, 'Red'),
(2, 'White'),
(3, 'Rosé'),
(4, 'Orange'),
(5, 'Sparkling'),
(6, 'Dessert'),
(7, 'Rice'),
(8, 'Fruit'),
(9, 'Honey'),
(10, 'Cider');

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

--
-- Dumping data for table `worlds`
--

INSERT INTO `worlds` (`name`) VALUES
('New World'),
('Old World'),
('Other World');

-- --------------------------------------------------------

--
-- Structure for view `vw_model_comparison` exported as a table
--
DROP TABLE IF EXISTS `vw_model_comparison`;
CREATE TABLE`vw_model_comparison`(
    `tier` varchar(7) COLLATE cp850_general_ci NOT NULL DEFAULT '',
    `model` varchar(50) COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
    `times_used` bigint NOT NULL DEFAULT '0',
    `avg_confidence` decimal(12,1) DEFAULT NULL,
    `times_was_final` decimal(23,0) DEFAULT NULL,
    `pct_resolved` decimal(28,1) DEFAULT NULL
);

-- --------------------------------------------------------

--
-- Structure for view `vw_model_confidence_stats` exported as a table
--
DROP TABLE IF EXISTS `vw_model_confidence_stats`;
CREATE TABLE`vw_model_confidence_stats`(
    `finalTier` varchar(20) COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'tier1, tier1_5, tier2, tier3, user_choice',
    `inputType` enum('text','image') COLLATE utf8mb4_0900_ai_ci NOT NULL,
    `total_identifications` bigint NOT NULL DEFAULT '0',
    `avg_confidence` decimal(12,1) DEFAULT NULL,
    `min_confidence` bigint DEFAULT NULL,
    `max_confidence` bigint DEFAULT NULL,
    `auto_populate_count` decimal(23,0) DEFAULT NULL,
    `suggest_count` decimal(23,0) DEFAULT NULL,
    `user_choice_count` decimal(23,0) DEFAULT NULL,
    `avg_cost` decimal(11,6) DEFAULT NULL,
    `avg_latency_ms` decimal(11,0) DEFAULT NULL
);

-- --------------------------------------------------------

--
-- Structure for view `vw_tier_escalation_analysis` exported as a table
--
DROP TABLE IF EXISTS `vw_tier_escalation_analysis`;
CREATE TABLE`vw_tier_escalation_analysis`(
    `date` date DEFAULT NULL,
    `total` bigint NOT NULL DEFAULT '0',
    `resolved_tier1` decimal(23,0) DEFAULT NULL,
    `resolved_tier1_5` decimal(23,0) DEFAULT NULL,
    `resolved_tier2` decimal(23,0) DEFAULT NULL,
    `resolved_tier3` decimal(23,0) DEFAULT NULL,
    `user_choice` decimal(23,0) DEFAULT NULL,
    `pct_tier1` decimal(28,1) DEFAULT NULL,
    `pct_auto_populate` decimal(28,1) DEFAULT NULL,
    `avg_confidence` decimal(12,1) DEFAULT NULL,
    `total_cost` decimal(31,4) DEFAULT NULL
);

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
  ADD KEY `idx_deleted` (`deleted`);

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
  ADD PRIMARY KEY (`grapeID`);

--
-- Indexes for table `producers`
--
ALTER TABLE `producers`
  ADD PRIMARY KEY (`producerID`),
  ADD UNIQUE KEY `producerName` (`producerName`),
  ADD KEY `fk_producer_region` (`regionID`);

--
-- Indexes for table `ratings`
--
ALTER TABLE `ratings`
  ADD PRIMARY KEY (`ratingID`),
  ADD KEY `fk_rating_bottle` (`bottleID`),
  ADD KEY `fk_rating_wine` (`wineID`);

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
  ADD UNIQUE KEY `regionName` (`regionName`),
  ADD KEY `fk_region_country` (`countryID`);

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
  MODIFY `countryID` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=250;

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
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

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
  MODIFY `wineTypeID` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

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

# Remember Feature - Data Model Proposal

> **Author**: data-architect
> **Date**: 2026-02-12
> **Status**: UNIFIED -- Aligned with system-architect's `ARCHITECTURE_PROPOSAL.md`
> **Companion doc**: `ARCHITECTURE_PROPOSAL.md` (system-architect)

---

## Table of Contents

1. [Existing Schema Analysis](#1-existing-schema-analysis)
2. [Design Principles](#2-design-principles)
3. [Schema Options](#3-schema-options) (exploratory -- see Section 10 for final)
   - [Option A: Minimal (MVP)](#option-a-minimal-mvp)
   - [Option B: Medium](#option-b-medium)
   - [Option C: Full-Featured](#option-c-full-featured)
4. [Sample Data](#4-sample-data)
5. [Key Queries](#5-key-queries)
6. [Migration Strategy](#6-migration-strategy)
7. [Media Storage](#7-media-storage)
8. [Performance & Scaling](#8-performance--scaling)
9. [Recommendation](#9-recommendation)

---

## 1. Existing Schema Analysis

### 1.1 Tables Directly Relevant to Remember

| Table | Relevance | How Remember Connects |
|-------|-----------|----------------------|
| `wine` | **Primary link target** | A memory can be about a wine already in the cellar (FK to `wineID`). Fields like `wineName`, `producerID`, `pictureURL` are displayable in memory cards. |
| `bottles` | **Context enrichment** | A memory might reference a specific bottle (where it was bought, the price paid). Useful for "I saw this at X for Y price" memories. |
| `ratings` | **Companion data** | Ratings have `Notes`, `drinkDate`, `buyAgain` -- a memory could be created alongside or linked to a rating. "The night we drank this" memories. |
| `producers` | **Lookup / display** | Memory cards showing the producer name, region, country chain. Also useful for "visited this producer" travel memories. |
| `region` / `country` | **Location context** | Travel memories link naturally to wine regions/countries. Existing geographic hierarchy can be reused. |
| `agentIdentificationResults` | **Agent integration** | When the agent identifies a wine from a photo/text, that identification could spawn a memory. The `inputHash` and `finalConfidence` link the AI interaction to the memory. |
| `cacheWineEnrichment` | **Enrichment display** | If a memory is about an enriched wine, the cached enrichment data (tasting notes, critics, drink window) can be shown alongside the memory without re-fetching. |
| `agentSessions` | **Session context** | An agent session could trigger memory creation. The `contextData` JSON could reference memory IDs. |

### 1.2 Tables Not Directly Relevant

| Table | Why Not |
|-------|---------|
| `grapes`, `grapemix` | Too granular for memories -- grape data is part of enrichment, not user-facing memory content |
| `critic_scores` | Reference data, not user-generated content |
| `ref*` tables | Static reference data for the agent -- no user memory connection |
| `agentUsageLog`, `agentUsageDaily` | Analytics/billing, not user-facing |
| `agentWineEmbeddings` | Vector search -- could be useful later for "find similar memories" but not for MVP |
| `audit_log` | System-level auditing, separate concern |

### 1.3 Key Schema Patterns to Follow

Looking at the existing schema, several patterns are consistent and should be carried forward:

1. **Naming**: `camelCase` for columns (`wineID`, `bottleSize`, `createdAt`), table names match purpose (`wine`, `bottles`, `ratings`)
2. **Soft deletes**: `deleted` TINYINT + `deletedAt` TIMESTAMP + `deletedBy` INT (used by `wine`, `bottles`, `producers`, `region`)
3. **Timestamps**: `createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP`, `updatedAt ... ON UPDATE CURRENT_TIMESTAMP`
4. **JSON columns**: Used for flexible/nested data (`preferences`, `certifications`, `criticScores`, `inferencesApplied`)
5. **INT auto-increment PKs**: Standard pattern across all tables
6. **FK naming**: `fk_<child>_<parentColumn>` (e.g., `fk_bottle_wineID`)
7. **Index naming**: `idx_<purpose>` (e.g., `idx_deleted`, `idx_userId_date`)
8. **User ID**: Currently `userId INT NOT NULL DEFAULT '1'` (single-user, future multi-user ready)
9. **Charset**: `utf8mb4` with `utf8mb4_0900_ai_ci` collation (full Unicode support including emoji)

---

## 2. Design Principles

1. **Wine-optional**: A memory can exist without linking to a wine in the cellar. "Saw this in a magazine" does not require the wine to be in the collection.
2. **Source-typed**: Every memory has a source type (restaurant, social media, friend recommendation, travel, article, etc.) that determines UI rendering and filtering.
3. **Timeline-first**: Memories are primarily browsed chronologically. The data model must support efficient date-range queries.
4. **Agent-aware**: The wine agent should be able to query memories ("Have I seen this wine before?") and create memories from identification flows.
5. **Media-flexible**: Photos, screenshots, URLs, and text notes are all first-class content types. Multiple media items per memory.
6. **Taggable**: User-defined tags for personal categorization beyond the fixed source types.
7. **Soft-deletable**: Follow the existing app pattern -- memories can be soft-deleted and recovered.

---

## 3. Schema Options

### Option A: Minimal (MVP)

**Philosophy**: One table does it all. JSON columns handle variable content. Ship fast, learn from usage, expand later.

**Tables**: 1 new table

```sql
-- ============================================================
-- OPTION A: Minimal (MVP) - Single table with JSON flexibility
-- ============================================================

CREATE TABLE `memories` (
  `memoryID` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL DEFAULT 1,

  -- Core content
  `title` varchar(255) NOT NULL COMMENT 'User-provided or auto-generated title',
  `notes` text DEFAULT NULL COMMENT 'Free-form user notes (markdown supported)',
  `sourceType` enum(
    'restaurant', 'shop', 'social_media', 'friend_recommendation',
    'travel', 'article', 'tasting_event', 'gift_idea', 'agent_identify',
    'cellar_moment', 'other'
  ) NOT NULL DEFAULT 'other' COMMENT 'How the user encountered this wine',

  -- Wine link (optional)
  `wineID` int DEFAULT NULL COMMENT 'FK to wine table if wine is in cellar',
  `wineSnapshot` json DEFAULT NULL COMMENT 'Snapshot of wine data at time of memory creation: {"wineName", "producer", "vintage", "region", "country", "type"}',

  -- Media (stored as JSON array)
  `media` json DEFAULT NULL COMMENT '[{"type": "image|url|screenshot", "path": "...", "caption": "...", "order": 1}]',

  -- Context
  `location` varchar(255) DEFAULT NULL COMMENT 'Where: restaurant name, shop name, city, etc.',
  `people` varchar(500) DEFAULT NULL COMMENT 'Who: comma-separated names or free text',
  `price` decimal(10,2) DEFAULT NULL COMMENT 'Price seen/paid',
  `currency` char(3) DEFAULT NULL COMMENT 'ISO 4217 currency code',
  `memoryDate` date NOT NULL COMMENT 'When the memory happened (user-provided)',

  -- Tags (JSON array for flexibility)
  `tags` json DEFAULT NULL COMMENT '["birthday", "anniversary", "bucket-list", "gift"]',

  -- Agent integration
  `agentIdentificationID` bigint DEFAULT NULL COMMENT 'FK to agentIdentificationResults if created from agent flow',

  -- Metadata
  `isFavorite` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Starred/pinned memory',
  `deleted` tinyint(1) NOT NULL DEFAULT 0,
  `deletedAt` timestamp NULL DEFAULT NULL,
  `deletedBy` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`memoryID`),
  KEY `idx_userId_date` (`userId`, `memoryDate` DESC),
  KEY `idx_userId_source` (`userId`, `sourceType`),
  KEY `idx_wineID` (`wineID`),
  KEY `idx_agentIdentificationID` (`agentIdentificationID`),
  KEY `idx_deleted` (`deleted`),
  KEY `idx_favorite` (`userId`, `isFavorite`, `memoryDate` DESC),
  KEY `idx_createdAt` (`createdAt` DESC),

  CONSTRAINT `fk_memory_wine` FOREIGN KEY (`wineID`) REFERENCES `wine` (`wineID`) ON DELETE SET NULL,
  CONSTRAINT `fk_memory_agentIdent` FOREIGN KEY (`agentIdentificationID`) REFERENCES `agentIdentificationResults` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Pros**:
- Single table, simple CRUD, fast to implement
- JSON columns handle variable media and tags without schema changes
- Can ship in one sprint

**Cons**:
- JSON media array means no relational queries on media (can't "show all memories with photos")
- Tags in JSON mean no efficient tag-based filtering (MySQL JSON functions exist but are slower than indexed columns)
- No support for shared/collaborative memories
- `wineSnapshot` duplicates data (but intentionally -- preserves history if wine is deleted)

---

### Option B: Medium

**Philosophy**: Normalize media and tags into their own tables. Keep the core memory table clean. Support efficient filtering on tags and media types.

**Tables**: 3 new tables

```sql
-- ============================================================
-- OPTION B: Medium - Normalized media and tags
-- ============================================================

CREATE TABLE `memories` (
  `memoryID` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL DEFAULT 1,

  -- Core content
  `title` varchar(255) NOT NULL,
  `notes` text DEFAULT NULL,
  `sourceType` enum(
    'restaurant', 'shop', 'social_media', 'friend_recommendation',
    'travel', 'article', 'tasting_event', 'gift_idea', 'agent_identify',
    'cellar_moment', 'other'
  ) NOT NULL DEFAULT 'other',

  -- Wine link (optional)
  `wineID` int DEFAULT NULL,
  `wineSnapshot` json DEFAULT NULL COMMENT '{"wineName", "producer", "vintage", "region", "country", "type"}',

  -- Context
  `location` varchar(255) DEFAULT NULL,
  `people` varchar(500) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `currency` char(3) DEFAULT NULL,
  `memoryDate` date NOT NULL,

  -- Agent integration
  `agentIdentificationID` bigint DEFAULT NULL,

  -- Metadata
  `isFavorite` tinyint(1) NOT NULL DEFAULT 0,
  `deleted` tinyint(1) NOT NULL DEFAULT 0,
  `deletedAt` timestamp NULL DEFAULT NULL,
  `deletedBy` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`memoryID`),
  KEY `idx_userId_date` (`userId`, `memoryDate` DESC),
  KEY `idx_userId_source` (`userId`, `sourceType`),
  KEY `idx_wineID` (`wineID`),
  KEY `idx_agentIdentificationID` (`agentIdentificationID`),
  KEY `idx_deleted` (`deleted`),
  KEY `idx_favorite` (`userId`, `isFavorite`, `memoryDate` DESC),
  KEY `idx_createdAt` (`createdAt` DESC),

  CONSTRAINT `fk_memory_wine` FOREIGN KEY (`wineID`) REFERENCES `wine` (`wineID`) ON DELETE SET NULL,
  CONSTRAINT `fk_memory_agentIdent` FOREIGN KEY (`agentIdentificationID`) REFERENCES `agentIdentificationResults` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE `memoryMedia` (
  `mediaID` int NOT NULL AUTO_INCREMENT,
  `memoryID` int NOT NULL,

  `mediaType` enum('image', 'url', 'screenshot') NOT NULL,
  `path` varchar(500) NOT NULL COMMENT 'File path (images) or URL (links)',
  `thumbnailPath` varchar(500) DEFAULT NULL COMMENT 'Thumbnail for images/screenshots',
  `caption` varchar(500) DEFAULT NULL,
  `sortOrder` tinyint NOT NULL DEFAULT 0,

  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`mediaID`),
  KEY `idx_memoryID` (`memoryID`, `sortOrder`),
  KEY `idx_mediaType` (`mediaType`),

  CONSTRAINT `fk_media_memory` FOREIGN KEY (`memoryID`) REFERENCES `memories` (`memoryID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE `memoryTags` (
  `tagID` int NOT NULL AUTO_INCREMENT,
  `memoryID` int NOT NULL,

  `tag` varchar(50) NOT NULL COMMENT 'User-defined tag (lowercase, trimmed)',

  PRIMARY KEY (`tagID`),
  UNIQUE KEY `idx_memory_tag` (`memoryID`, `tag`),
  KEY `idx_tag` (`tag`),

  CONSTRAINT `fk_tag_memory` FOREIGN KEY (`memoryID`) REFERENCES `memories` (`memoryID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Pros**:
- Clean relational model -- can query "all memories with photos" efficiently
- Tag filtering via JOIN is fast with indexed `tag` column
- Media items can be individually managed (reorder, delete, replace)
- Thumbnail support for performance
- CASCADE deletes keep data consistent

**Cons**:
- 3 tables means slightly more complex CRUD (but manageable with transactions)
- Two extra JOINs for a full memory load (but these are small tables per-memory)

---

### Option C: Full-Featured

**Philosophy**: Everything normalized. Location as a first-class entity (reusable across memories). Wine "wish list" concept built in. Collections/boards for grouping. Full-text search support.

**Tables**: 6 new tables

```sql
-- ============================================================
-- OPTION C: Full-Featured - Locations, collections, wish list
-- ============================================================

CREATE TABLE `memories` (
  `memoryID` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL DEFAULT 1,

  -- Core content
  `title` varchar(255) NOT NULL,
  `notes` text DEFAULT NULL,
  `sourceType` enum(
    'restaurant', 'shop', 'social_media', 'friend_recommendation',
    'travel', 'article', 'tasting_event', 'gift_idea', 'agent_identify',
    'cellar_moment', 'other'
  ) NOT NULL DEFAULT 'other',

  -- Wine link (optional)
  `wineID` int DEFAULT NULL,
  `wineSnapshot` json DEFAULT NULL,

  -- Structured context
  `locationID` int DEFAULT NULL COMMENT 'FK to memoryLocations',
  `people` varchar(500) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `currency` char(3) DEFAULT NULL,
  `memoryDate` date NOT NULL,

  -- Wish list / intent
  `wantToBuy` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Flag: user wants to buy this wine',
  `wantToBuyResolved` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Flag: wine has been purchased',
  `priority` tinyint DEFAULT NULL COMMENT '1=low, 2=medium, 3=high (for wish list sorting)',

  -- Agent integration
  `agentIdentificationID` bigint DEFAULT NULL,

  -- Full-text search support
  `searchText` text GENERATED ALWAYS AS (
    CONCAT_WS(' ', `title`, `notes`, `location`, `people`)
  ) STORED COMMENT 'Concatenated text for FULLTEXT index',

  -- Metadata
  `isFavorite` tinyint(1) NOT NULL DEFAULT 0,
  `deleted` tinyint(1) NOT NULL DEFAULT 0,
  `deletedAt` timestamp NULL DEFAULT NULL,
  `deletedBy` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`memoryID`),
  KEY `idx_userId_date` (`userId`, `memoryDate` DESC),
  KEY `idx_userId_source` (`userId`, `sourceType`),
  KEY `idx_wineID` (`wineID`),
  KEY `idx_locationID` (`locationID`),
  KEY `idx_agentIdentificationID` (`agentIdentificationID`),
  KEY `idx_deleted` (`deleted`),
  KEY `idx_favorite` (`userId`, `isFavorite`, `memoryDate` DESC),
  KEY `idx_wantToBuy` (`userId`, `wantToBuy`, `wantToBuyResolved`, `priority` DESC),
  KEY `idx_createdAt` (`createdAt` DESC),
  FULLTEXT KEY `ft_search` (`searchText`),

  CONSTRAINT `fk_memory_wine` FOREIGN KEY (`wineID`) REFERENCES `wine` (`wineID`) ON DELETE SET NULL,
  CONSTRAINT `fk_memory_location` FOREIGN KEY (`locationID`) REFERENCES `memoryLocations` (`locationID`) ON DELETE SET NULL,
  CONSTRAINT `fk_memory_agentIdent` FOREIGN KEY (`agentIdentificationID`) REFERENCES `agentIdentificationResults` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE `memoryMedia` (
  `mediaID` int NOT NULL AUTO_INCREMENT,
  `memoryID` int NOT NULL,

  `mediaType` enum('image', 'url', 'screenshot') NOT NULL,
  `path` varchar(500) NOT NULL,
  `thumbnailPath` varchar(500) DEFAULT NULL,
  `caption` varchar(500) DEFAULT NULL,
  `mimeType` varchar(50) DEFAULT NULL COMMENT 'e.g., image/jpeg, image/png',
  `fileSize` int DEFAULT NULL COMMENT 'File size in bytes',
  `dimensions` varchar(20) DEFAULT NULL COMMENT 'WxH for images, e.g., "800x600"',
  `sortOrder` tinyint NOT NULL DEFAULT 0,

  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`mediaID`),
  KEY `idx_memoryID` (`memoryID`, `sortOrder`),
  KEY `idx_mediaType` (`mediaType`),

  CONSTRAINT `fk_media_memory` FOREIGN KEY (`memoryID`) REFERENCES `memories` (`memoryID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE `memoryTags` (
  `tagID` int NOT NULL AUTO_INCREMENT,
  `memoryID` int NOT NULL,

  `tag` varchar(50) NOT NULL,

  PRIMARY KEY (`tagID`),
  UNIQUE KEY `idx_memory_tag` (`memoryID`, `tag`),
  KEY `idx_tag` (`tag`),

  CONSTRAINT `fk_tag_memory` FOREIGN KEY (`memoryID`) REFERENCES `memories` (`memoryID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE `memoryLocations` (
  `locationID` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL DEFAULT 1,

  `name` varchar(255) NOT NULL COMMENT 'Restaurant name, shop name, etc.',
  `locationType` enum('restaurant', 'wine_bar', 'shop', 'winery', 'hotel', 'event_venue', 'home', 'other') NOT NULL DEFAULT 'other',
  `address` varchar(500) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `countryID` int DEFAULT NULL COMMENT 'FK to country table (reuses existing geography)',
  `regionID` int DEFAULT NULL COMMENT 'FK to region table (for wine-region travel)',
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `website` varchar(500) DEFAULT NULL,
  `notes` text DEFAULT NULL,

  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`locationID`),
  KEY `idx_userId` (`userId`),
  KEY `idx_name` (`name`),
  KEY `idx_city` (`city`),
  KEY `idx_countryID` (`countryID`),
  KEY `idx_regionID` (`regionID`),
  KEY `idx_type` (`locationType`),

  CONSTRAINT `fk_location_country` FOREIGN KEY (`countryID`) REFERENCES `country` (`countryID`) ON DELETE SET NULL,
  CONSTRAINT `fk_location_region` FOREIGN KEY (`regionID`) REFERENCES `region` (`regionID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE `memoryCollections` (
  `collectionID` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL DEFAULT 1,

  `name` varchar(100) NOT NULL COMMENT 'Collection/board name',
  `description` text DEFAULT NULL,
  `coverMediaID` int DEFAULT NULL COMMENT 'FK to memoryMedia for cover image',
  `color` varchar(7) DEFAULT NULL COMMENT 'Hex color for collection badge, e.g., #8B4513',
  `sortOrder` tinyint NOT NULL DEFAULT 0,

  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`collectionID`),
  KEY `idx_userId` (`userId`, `sortOrder`),

  CONSTRAINT `fk_collection_cover` FOREIGN KEY (`coverMediaID`) REFERENCES `memoryMedia` (`mediaID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE `memoryCollectionItems` (
  `id` int NOT NULL AUTO_INCREMENT,
  `collectionID` int NOT NULL,
  `memoryID` int NOT NULL,
  `sortOrder` int NOT NULL DEFAULT 0,
  `addedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_collection_memory` (`collectionID`, `memoryID`),
  KEY `idx_memoryID` (`memoryID`),

  CONSTRAINT `fk_collItem_collection` FOREIGN KEY (`collectionID`) REFERENCES `memoryCollections` (`collectionID`) ON DELETE CASCADE,
  CONSTRAINT `fk_collItem_memory` FOREIGN KEY (`memoryID`) REFERENCES `memories` (`memoryID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Pros**:
- Locations are reusable -- "Nobu London" created once, linked to many memories
- Collections/boards allow Pinterest-style organization ("Tuscany 2025 Trip", "Gift Ideas", "Wines to Try")
- Wish list built in with priority and resolved tracking
- Full-text search via MySQL FULLTEXT index
- Media metadata (dimensions, file size, MIME type) enables smart UI rendering
- Connects to existing `country`/`region` tables for geographic cross-referencing

**Cons**:
- 6 tables is a significant schema addition (current app has 28 total)
- Collections/boards may be over-engineering for v1
- Location entity adds CRUD complexity (autocomplete, dedup, geocoding)
- FULLTEXT index adds write overhead
- More frontend components needed to manage locations and collections

---

## 4. Sample Data

### 4.1 Sample INSERT Statements (Option B)

```sql
-- Memory 1: Restaurant discovery (linked to existing cellar wine)
INSERT INTO `memories`
  (`userId`, `title`, `notes`, `sourceType`, `wineID`, `wineSnapshot`,
   `location`, `people`, `price`, `currency`, `memoryDate`, `isFavorite`)
VALUES
  (1, 'Amazing Margaux at The Ledbury',
   'Had this with the venison course. The sommelier decanted it for 2 hours and it was absolutely stunning. Silky tannins, incredible length. One of the best Bordeaux experiences I''ve had.',
   'restaurant', 42,
   '{"wineName": "Pavillon Rouge", "producer": "Chateau Margaux", "vintage": 2015, "region": "Bordeaux", "country": "France", "type": "Red"}',
   'The Ledbury, Notting Hill, London',
   'Sarah, James',
   85.00, 'GBP',
   '2026-01-18', 1);

-- Media for memory 1
INSERT INTO `memoryMedia` (`memoryID`, `mediaType`, `path`, `caption`, `sortOrder`)
VALUES
  (1, 'image', 'images/memories/2026/01/ledbury-margaux.jpg', 'The bottle at the table', 0),
  (1, 'image', 'images/memories/2026/01/ledbury-venison.jpg', 'Venison course pairing', 1);

-- Tags for memory 1
INSERT INTO `memoryTags` (`memoryID`, `tag`)
VALUES
  (1, 'fine-dining'),
  (1, 'bordeaux'),
  (1, 'special-occasion');

-- --------------------------------------------------------

-- Memory 2: Instagram discovery (wine NOT in cellar)
INSERT INTO `memories`
  (`userId`, `title`, `notes`, `sourceType`, `wineID`, `wineSnapshot`,
   `location`, `memoryDate`)
VALUES
  (1, 'Stunning orange wine from Georgia',
   'Saw this on @wine_adventures Instagram. Amber color, made in qvevri (clay vessels). Need to find this! Apparently available at Les Caves de Pyrene.',
   'social_media', NULL,
   '{"wineName": "Rkatsiteli", "producer": "Pheasant''s Tears", "vintage": 2022, "region": "Kakheti", "country": "Georgia", "type": "Orange"}',
   NULL,
   '2026-02-05');

INSERT INTO `memoryMedia` (`memoryID`, `mediaType`, `path`, `caption`, `sortOrder`)
VALUES
  (2, 'screenshot', 'images/memories/2026/02/instagram-georgia-wine.jpg', 'Instagram post by @wine_adventures', 0),
  (2, 'url', 'https://www.instagram.com/p/ABC123/', 'Original Instagram post', 1);

INSERT INTO `memoryTags` (`memoryID`, `tag`)
VALUES
  (2, 'natural-wine'),
  (2, 'want-to-try'),
  (2, 'orange-wine');

-- --------------------------------------------------------

-- Memory 3: Friend recommendation
INSERT INTO `memories`
  (`userId`, `title`, `notes`, `sourceType`, `wineID`, `wineSnapshot`,
   `people`, `price`, `currency`, `memoryDate`)
VALUES
  (1, 'Tom''s Barolo recommendation',
   'Tom said this is the best value Barolo he''s had in years. "If you can find the 2019, buy a case." Said it drinks well young but will age 20+ years. He got it from Berry Bros.',
   'friend_recommendation', NULL,
   '{"wineName": "Barolo DOCG", "producer": "G.D. Vajra", "vintage": 2019, "region": "Piedmont", "country": "Italy", "type": "Red"}',
   'Tom Henderson',
   38.00, 'GBP',
   '2026-01-25');

INSERT INTO `memoryTags` (`memoryID`, `tag`)
VALUES
  (3, 'buy-recommendation'),
  (3, 'barolo'),
  (3, 'ageable');

-- --------------------------------------------------------

-- Memory 4: Travel discovery
INSERT INTO `memories`
  (`userId`, `title`, `notes`, `sourceType`, `wineID`, `wineSnapshot`,
   `location`, `price`, `currency`, `memoryDate`, `isFavorite`)
VALUES
  (1, 'Domaine de la Romanee-Conti visit',
   'Once-in-a-lifetime visit arranged through the wine club. Tasted the 2020 La Tache from barrel. The complexity even at this stage was extraordinary. Also visited Vosne-Romanee village and had lunch at Le Richebourg restaurant.',
   'travel', NULL,
   '{"wineName": "La Tache Grand Cru", "producer": "Domaine de la Romanee-Conti", "vintage": 2020, "region": "Burgundy", "country": "France", "type": "Red"}',
   'Domaine de la Romanee-Conti, Vosne-Romanee, Burgundy',
   NULL, NULL,
   '2025-09-14', 1);

INSERT INTO `memoryMedia` (`memoryID`, `mediaType`, `path`, `caption`, `sortOrder`)
VALUES
  (4, 'image', 'images/memories/2025/09/drc-entrance.jpg', 'The famous DRC gate', 0),
  (4, 'image', 'images/memories/2025/09/drc-barrel-room.jpg', 'Barrel room tasting', 1),
  (4, 'image', 'images/memories/2025/09/vosne-romanee-village.jpg', 'Vosne-Romanee village', 2);

INSERT INTO `memoryTags` (`memoryID`, `tag`)
VALUES
  (4, 'burgundy-trip'),
  (4, 'bucket-list'),
  (4, 'winery-visit');

-- --------------------------------------------------------

-- Memory 5: Agent-created memory (from identification flow)
INSERT INTO `memories`
  (`userId`, `title`, `notes`, `sourceType`, `wineID`, `wineSnapshot`,
   `agentIdentificationID`, `memoryDate`)
VALUES
  (1, 'Wine menu photo at Chez Bruce',
   'Took a photo of the wine list. Agent identified the Chablis Grand Cru as Les Clos 2018 from Dauvissat. Price on the list was £120 -- need to check retail.',
   'agent_identify', NULL,
   '{"wineName": "Chablis Grand Cru Les Clos", "producer": "Rene & Vincent Dauvissat", "vintage": 2018, "region": "Burgundy", "country": "France", "type": "White"}',
   47,
   '2026-02-10');

INSERT INTO `memoryMedia` (`memoryID`, `mediaType`, `path`, `caption`, `sortOrder`)
VALUES
  (5, 'image', 'images/memories/2026/02/chez-bruce-winelist.jpg', 'Wine list at Chez Bruce', 0);

INSERT INTO `memoryTags` (`memoryID`, `tag`)
VALUES
  (5, 'wine-list'),
  (5, 'white-burgundy');

-- --------------------------------------------------------

-- Memory 6: Article/magazine find
INSERT INTO `memories`
  (`userId`, `title`, `notes`, `sourceType`, `wineID`, `wineSnapshot`,
   `memoryDate`)
VALUES
  (1, 'Decanter Top 10 Rieslings 2025',
   'Decanter''s annual Riesling roundup. The Donnhoff Oberhauser Brucke Spatlese 2022 scored 97 points and was called "the definition of Nahe Riesling." Available at Justerini & Brooks for around £45.',
   'article', NULL,
   '{"wineName": "Oberhauser Brucke Spatlese", "producer": "Donnhoff", "vintage": 2022, "region": "Nahe", "country": "Germany", "type": "White"}',
   '2026-02-01');

INSERT INTO `memoryMedia` (`memoryID`, `mediaType`, `path`, `sortOrder`)
VALUES
  (6, 'url', 'https://www.decanter.com/top-rieslings-2025', 0);

INSERT INTO `memoryTags` (`memoryID`, `tag`)
VALUES
  (6, 'critics-pick'),
  (6, 'riesling'),
  (6, 'want-to-try');

-- --------------------------------------------------------

-- Memory 7: Cellar moment (about a wine already in the collection)
INSERT INTO `memories`
  (`userId`, `title`, `notes`, `sourceType`, `wineID`, `wineSnapshot`,
   `people`, `memoryDate`)
VALUES
  (1, 'Opening night for the 2010 Lynch-Bages',
   'Finally opened one of the three bottles we''ve been sitting on. Decanted for 3 hours. Cedar, graphite, blackcurrant -- textbook Pauillac at peak. This was worth the wait. Still have 2 bottles left -- might hold one more year.',
   'cellar_moment', 15,
   '{"wineName": "Grand Vin", "producer": "Chateau Lynch-Bages", "vintage": 2010, "region": "Bordeaux", "country": "France", "type": "Red"}',
   'Emma',
   '2026-02-08');

INSERT INTO `memoryMedia` (`memoryID`, `mediaType`, `path`, `caption`, `sortOrder`)
VALUES
  (7, 'image', 'images/memories/2026/02/lynch-bages-2010-open.jpg', 'After 3 hours in the decanter', 0);

INSERT INTO `memoryTags` (`memoryID`, `tag`)
VALUES
  (7, 'peak-drinking'),
  (7, 'pauillac');
```

---

## 5. Key Queries

### 5.1 Timeline Query (paginated, with media and tags)

```sql
-- Main timeline: most recent memories with first media item and tag list
SELECT
  m.memoryID,
  m.title,
  m.notes,
  m.sourceType,
  m.wineSnapshot,
  m.location,
  m.people,
  m.price,
  m.currency,
  m.memoryDate,
  m.isFavorite,
  m.createdAt,
  -- Wine data (if linked)
  w.wineName,
  w.pictureURL AS winePictureURL,
  p.producerName,
  -- First media item (cover image)
  (SELECT mm.path FROM memoryMedia mm
   WHERE mm.memoryID = m.memoryID
   ORDER BY mm.sortOrder LIMIT 1) AS coverImagePath,
  -- Media count
  (SELECT COUNT(*) FROM memoryMedia mm
   WHERE mm.memoryID = m.memoryID) AS mediaCount,
  -- Tags as JSON array
  (SELECT JSON_ARRAYAGG(mt.tag) FROM memoryTags mt
   WHERE mt.memoryID = m.memoryID) AS tags
FROM memories m
LEFT JOIN wine w ON m.wineID = w.wineID AND w.deleted = 0
LEFT JOIN producers p ON w.producerID = p.producerID
WHERE m.userId = 1
  AND m.deleted = 0
ORDER BY m.memoryDate DESC, m.createdAt DESC
LIMIT 20 OFFSET 0;
```

### 5.2 Filter by Source Type

```sql
-- All restaurant memories
SELECT m.*,
  (SELECT mm.path FROM memoryMedia mm
   WHERE mm.memoryID = m.memoryID ORDER BY mm.sortOrder LIMIT 1) AS coverImage
FROM memories m
WHERE m.userId = 1
  AND m.deleted = 0
  AND m.sourceType = 'restaurant'
ORDER BY m.memoryDate DESC
LIMIT 20 OFFSET 0;
```

### 5.3 Filter by Tag

```sql
-- All memories tagged "want-to-try" (acts as a wish list)
SELECT m.*,
  m.wineSnapshot,
  (SELECT JSON_ARRAYAGG(mt2.tag) FROM memoryTags mt2
   WHERE mt2.memoryID = m.memoryID) AS tags
FROM memories m
INNER JOIN memoryTags mt ON m.memoryID = mt.memoryID
WHERE m.userId = 1
  AND m.deleted = 0
  AND mt.tag = 'want-to-try'
ORDER BY m.memoryDate DESC;
```

### 5.4 Search Memories (text search)

```sql
-- Search across title, notes, location, people
SELECT m.*,
  m.wineSnapshot
FROM memories m
WHERE m.userId = 1
  AND m.deleted = 0
  AND (
    m.title LIKE '%barolo%'
    OR m.notes LIKE '%barolo%'
    OR m.location LIKE '%barolo%'
    OR JSON_EXTRACT(m.wineSnapshot, '$.wineName') LIKE '%barolo%'
    OR JSON_EXTRACT(m.wineSnapshot, '$.producer') LIKE '%barolo%'
  )
ORDER BY m.memoryDate DESC;
```

For Option C, the FULLTEXT index makes this simpler and faster:

```sql
-- Full-text search (Option C only)
SELECT m.*, MATCH(m.searchText) AGAINST('barolo' IN NATURAL LANGUAGE MODE) AS relevance
FROM memories m
WHERE m.userId = 1
  AND m.deleted = 0
  AND MATCH(m.searchText) AGAINST('barolo' IN NATURAL LANGUAGE MODE)
ORDER BY relevance DESC
LIMIT 20;
```

### 5.5 Agent Integration: "Have I seen this wine before?"

```sql
-- Agent checks if a wine has been remembered (by producer + name fuzzy match)
SELECT m.memoryID, m.title, m.sourceType, m.memoryDate, m.notes,
  JSON_EXTRACT(m.wineSnapshot, '$.wineName') AS rememberedWineName,
  JSON_EXTRACT(m.wineSnapshot, '$.producer') AS rememberedProducer,
  JSON_EXTRACT(m.wineSnapshot, '$.vintage') AS rememberedVintage
FROM memories m
WHERE m.userId = 1
  AND m.deleted = 0
  AND (
    -- Exact match on wine table link
    m.wineID = :wineId
    OR (
      -- Fuzzy match on snapshot data
      JSON_UNQUOTE(JSON_EXTRACT(m.wineSnapshot, '$.producer')) LIKE :producerPattern
      AND JSON_UNQUOTE(JSON_EXTRACT(m.wineSnapshot, '$.wineName')) LIKE :wineNamePattern
    )
  )
ORDER BY m.memoryDate DESC;
```

### 5.6 Memories for a Specific Wine

```sql
-- All memories related to a specific wine (for wine detail page integration)
SELECT m.*,
  (SELECT mm.path FROM memoryMedia mm
   WHERE mm.memoryID = m.memoryID ORDER BY mm.sortOrder LIMIT 1) AS coverImage,
  (SELECT JSON_ARRAYAGG(mt.tag) FROM memoryTags mt
   WHERE mt.memoryID = m.memoryID) AS tags
FROM memories m
WHERE m.userId = 1
  AND m.deleted = 0
  AND m.wineID = :wineId
ORDER BY m.memoryDate DESC;
```

### 5.7 Tag Cloud / Popular Tags

```sql
-- Get all tags with counts for the tag filter UI
SELECT mt.tag, COUNT(*) AS count
FROM memoryTags mt
INNER JOIN memories m ON mt.memoryID = m.memoryID
WHERE m.userId = 1
  AND m.deleted = 0
GROUP BY mt.tag
ORDER BY count DESC, mt.tag ASC;
```

### 5.8 Monthly Timeline Grouping

```sql
-- Group memories by month for timeline section headers
SELECT
  DATE_FORMAT(m.memoryDate, '%Y-%m') AS monthKey,
  DATE_FORMAT(m.memoryDate, '%M %Y') AS monthLabel,
  COUNT(*) AS memoryCount,
  GROUP_CONCAT(DISTINCT m.sourceType) AS sourceTypes
FROM memories m
WHERE m.userId = 1
  AND m.deleted = 0
GROUP BY monthKey
ORDER BY monthKey DESC;
```

---

## 6. Migration Strategy

### 6.1 From Existing Data

The Remember feature is **additive** -- no existing tables are modified. However, there are opportunities to seed memories from existing data:

#### Potential Auto-Generated Memories

1. **From `ratings` with `Notes`**: Ratings that have substantial notes could be offered as "Import as Memory?" suggestions.

```sql
-- Find ratings with rich notes that could become memories
SELECT r.ratingID, r.drinkDate, r.Notes, r.overallRating,
  w.wineName, p.producerName, w.year
FROM ratings r
JOIN wine w ON r.wineID = w.wineID
JOIN producers p ON w.producerID = p.producerID
WHERE LENGTH(r.Notes) > 50
  AND r.Notes NOT IN ('', 'N/A', '-')
ORDER BY r.drinkDate DESC;
```

2. **From agent identifications**: Past agent identification results could be offered as memories (the wine was interesting enough to identify).

```sql
-- Past identifications that could become memories
SELECT air.id, air.inputType, air.identifiedProducer, air.identifiedWineName,
  air.identifiedVintage, air.createdAt
FROM agentIdentificationResults air
WHERE air.userAccepted = 1
  AND air.finalConfidence >= 70
ORDER BY air.createdAt DESC;
```

### 6.2 Migration Script Approach

**Phase 1 (Schema only)**: Run CREATE TABLE statements. No data migration.

**Phase 2 (Optional seeding)**: Offer UI to "Import past experiences as memories" -- user-driven, not automatic.

**Phase 3 (Agent integration)**: Agent starts creating memories from identification flows (opt-in).

### 6.3 Rollback

Since all new tables are independent (only outbound FKs to existing tables), rollback is simply:

```sql
-- Full rollback (Option B)
DROP TABLE IF EXISTS `memoryTags`;
DROP TABLE IF EXISTS `memoryMedia`;
DROP TABLE IF EXISTS `memories`;

-- Full rollback (Option C, additional tables)
DROP TABLE IF EXISTS `memoryCollectionItems`;
DROP TABLE IF EXISTS `memoryCollections`;
DROP TABLE IF EXISTS `memoryLocations`;
DROP TABLE IF EXISTS `memoryTags`;
DROP TABLE IF EXISTS `memoryMedia`;
DROP TABLE IF EXISTS `memories`;
```

No existing tables are altered, so no data loss risk.

---

## 7. Media Storage

### 7.1 Directory Structure

Following the existing pattern where wine images live in `images/wines/`, memory media should live in a parallel directory:

```
images/
├── wines/           # Existing wine photos (from upload.php)
└── memories/        # New: memory media
    └── 2026/
        ├── 01/
        │   ├── ledbury-margaux.jpg
        │   └── ledbury-margaux-thumb.jpg
        ├── 02/
        │   ├── instagram-georgia-wine.jpg
        │   └── instagram-georgia-wine-thumb.jpg
        └── ...
```

Year/month subdirectories prevent any single directory from growing too large and make cleanup/archival easier.

### 7.2 Upload Processing

Extend the existing `upload.php` pattern or create a new `uploadMemoryMedia.php`:

- **Max original size**: 1200x1200 (slightly larger than wine images' 800x800, since memories are more photo-forward)
- **Thumbnail generation**: 300x300 center-crop for timeline cards
- **Supported formats**: JPEG, PNG, WebP
- **File naming**: `{timestamp}-{sanitized-title}.{ext}` to avoid collisions
- **Storage path**: `images/memories/{YYYY}/{MM}/{filename}`

### 7.3 URL Storage

External URLs (articles, Instagram posts, etc.) store the URL string directly in `memoryMedia.path`. No local file. The frontend renders these as link cards with metadata (could use Open Graph scraping in the future, but not for MVP).

### 7.4 Deployment Consideration

The existing `deploy.ps1` already handles `images/wines/` with MERGE (additive only). The same pattern should apply to `images/memories/`:

```powershell
# Add to deploy.ps1 image sync
robocopy "$LocalDir\images\memories" "$RemoteDir\images\memories" /MIR /XO
```

---

## 8. Performance & Scaling

### 8.1 Expected Data Volume

For a single-user personal app, realistic estimates:

| Metric | Year 1 | Year 3 | Year 5 |
|--------|--------|--------|--------|
| Memories | 50-100 | 200-400 | 500-1000 |
| Media items | 100-200 | 400-800 | 1000-2000 |
| Tags | 150-300 | 600-1200 | 1500-3000 |
| Disk (media) | 100-200 MB | 400-800 MB | 1-2 GB |

This is comfortably within MySQL single-table performance for all options. No partitioning or sharding needed.

### 8.2 Index Strategy

The proposed indexes cover the primary access patterns:

| Query Pattern | Index Used |
|---------------|-----------|
| Timeline (newest first) | `idx_userId_date` |
| Filter by source type | `idx_userId_source` |
| Favorites only | `idx_favorite` |
| Wine-linked memories | `idx_wineID` |
| Tag filtering | `memoryTags.idx_tag` + JOIN |
| Agent lookup | `idx_agentIdentificationID` |
| Soft delete filtering | `idx_deleted` |

### 8.3 JSON Column Performance

The `wineSnapshot` JSON column is queried via `JSON_EXTRACT()` in the agent lookup query. For the expected data volume (<1000 rows), this is fast enough without a generated column index. If performance becomes an issue:

```sql
-- Add generated columns + indexes for JSON fields (future optimization)
ALTER TABLE memories
  ADD COLUMN `snapshotProducer` varchar(255) GENERATED ALWAYS AS (
    JSON_UNQUOTE(JSON_EXTRACT(wineSnapshot, '$.producer'))
  ) STORED,
  ADD KEY `idx_snapshotProducer` (`snapshotProducer`);
```

### 8.4 Image Lazy Loading

Timeline cards should use thumbnail images (`thumbnailPath`) and lazy-load full images only when the user opens a memory detail view. This keeps timeline scroll performance smooth even with hundreds of memories.

---

## 9. Recommendation

**Option B (Medium)** is the recommended starting point.

### Why Not Option A (Minimal)?

Option A's JSON `media` and `tags` columns sacrifice query flexibility for schema simplicity. Since we already know tags and media are core features (not speculative), normalizing them from the start avoids a painful migration later. The incremental complexity (2 extra tables with CASCADE deletes) is minimal.

### Why Not Option C (Full-Featured)?

Option C's locations table and collections system are valuable features, but they introduce significant frontend complexity (location autocomplete, collection management UI, drag-and-drop reordering) that would delay the initial release. The wish list flags (`wantToBuy`, `priority`) can be achieved more simply using tags (`want-to-try`, `high-priority`) in Option B.

### Migration Path: B to C

Option B is designed to upgrade to Option C without data loss:

1. Add `memoryLocations` table
2. Migrate `memories.location` (varchar) to `memories.locationID` (FK) -- parse existing location strings, create location records, update FKs
3. Add `memoryCollections` and `memoryCollectionItems` tables
4. Convert tag-based wish list entries to proper `wantToBuy` flags
5. Add FULLTEXT index

Each step is independently deployable.

### Summary

| Aspect | Option A | **Option B (Rec.)** | Option C |
|--------|----------|---------------------|----------|
| Tables | 1 | **3** | 6 |
| Media queries | JSON functions | **Relational JOINs** | Relational + metadata |
| Tag filtering | JSON functions | **Indexed JOINs** | Indexed JOINs |
| Locations | Free text | **Free text** | Normalized entity |
| Collections | None | **None (use tags)** | Full boards |
| Wish list | Tags | **Tags** | Dedicated flags |
| Full-text search | LIKE queries | **LIKE queries** | FULLTEXT index |
| Upgrade path | Must migrate JSON | **Clean upgrade to C** | Already complete |
| Implementation effort | 1 sprint | **1-2 sprints** | 3-4 sprints |

---

## 10. Unified Schema (CANONICAL)

> **This section is the agreed-upon schema**, reconciling the data-architect's Option B with the system-architect's `ARCHITECTURE_PROPOSAL.md` Section 5. All differences have been resolved. Use this section for implementation.

### 10.1 Alignment Summary

| Decision | Resolution | Source |
|----------|-----------|--------|
| Wine data | **Flat columns** (not JSON snapshot) | system-architect -- enables FULLTEXT, direct ORDER BY, simpler WHERE |
| Media table | **`memoryMedia`** with mediaType enum + isPrimary flag | Merged: data-architect's broader media scope + system-architect's isPrimary |
| Tags table | **`memoryTags`** normalized join table | Both agreed |
| Connections table | **`memoryConnections`** included from day one, empty for MVP | system-architect -- avoids future migration |
| Occasion field | **VARCHAR(100)** not ENUM | system-architect -- avoids ALTER TABLE for new types |
| AI snapshots | **JSON columns** (enrichmentSnapshot, identificationSnapshot) | system-architect -- frozen display data, not queryable |
| lat/lng | **Included from day one** | system-architect -- hard to backfill |
| Quick rating | **TINYINT 1-10** on memories table | system-architect -- simpler than full ratings form |
| isFavorite | **Included** | data-architect -- essential for "best memories" filter |
| Exact price + priceRange | **Both included** | Merged: exact price for shops, priceRange for restaurants |
| Table naming | **camelCase** (memoryMedia, memoryTags, memoryConnections) | data-architect -- matches existing schema convention |
| FK referential integrity | **Application-level** for memoryConnections (polymorphic) | Acknowledged tradeoff, acceptable for single-user app |

### 10.2 CREATE TABLE Statements

```sql
-- ============================================================
-- UNIFIED SCHEMA: 4 tables
-- Remember Feature - Canonical DDL
-- ============================================================

-- --------------------------------------------------------
-- Table 1: memories (core entity)
-- --------------------------------------------------------

CREATE TABLE `memories` (
  `memoryID` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL DEFAULT 1,

  -- Core content
  `title` varchar(255) DEFAULT NULL COMMENT 'User-provided or auto-generated title',
  `notes` text DEFAULT NULL COMMENT 'Free-form user notes / tasting thoughts',
  `occasion` varchar(100) DEFAULT NULL COMMENT 'restaurant, shop, social_media, friend_recommendation, travel, article, tasting_event, gift_idea, agent_identify, cellar_moment, other',

  -- Wine data (denormalized — memories can reference wines not in the cellar)
  `wineID` int DEFAULT NULL COMMENT 'FK to wine table if wine is in cellar',
  `producer` varchar(255) DEFAULT NULL COMMENT 'Snapshot — may not match a cellar producer',
  `wineName` varchar(255) DEFAULT NULL,
  `vintage` year DEFAULT NULL,
  `wineType` varchar(50) DEFAULT NULL COMMENT 'Red, White, Rose, Sparkling, etc.',
  `region` varchar(255) DEFAULT NULL,
  `country` varchar(255) DEFAULT NULL,
  `countryCode` char(2) DEFAULT NULL COMMENT 'ISO alpha-2 for flag display',
  `appellation` varchar(255) DEFAULT NULL,

  -- Context
  `location` varchar(255) DEFAULT NULL COMMENT 'Free-text place name (restaurant, city, etc.)',
  `latitude` decimal(10,7) DEFAULT NULL COMMENT 'For future map view',
  `longitude` decimal(10,7) DEFAULT NULL,
  `companions` varchar(500) DEFAULT NULL COMMENT 'Free-text; comma-separated names',
  `mood` varchar(50) DEFAULT NULL COMMENT 'Optional emotional tag',
  `rating` tinyint DEFAULT NULL COMMENT 'Quick 1-10 rating (simpler than full rating form)',
  `price` decimal(10,2) DEFAULT NULL COMMENT 'Exact price seen/paid (for shops, wine lists)',
  `currency` char(3) DEFAULT NULL COMMENT 'ISO 4217 currency code',
  `priceRange` varchar(20) DEFAULT NULL COMMENT '$, $$, $$$, $$$$ — approximate (for restaurants)',

  -- Creation source
  `source` enum('agent', 'manual', 'quick') NOT NULL DEFAULT 'manual' COMMENT 'How the memory was created',

  -- Agent integration
  `agentIdentificationID` bigint DEFAULT NULL COMMENT 'FK to agentIdentificationResults if created from agent flow',
  `enrichmentSnapshot` json DEFAULT NULL COMMENT 'Frozen enrichment data at time of memory creation',
  `identificationSnapshot` json DEFAULT NULL COMMENT 'Frozen identification result at time of memory creation',

  -- Metadata
  `memoryDate` date NOT NULL COMMENT 'When the experience happened (user-provided)',
  `isFavorite` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Starred/pinned memory',
  `deleted` tinyint(1) NOT NULL DEFAULT 0,
  `deletedAt` timestamp NULL DEFAULT NULL,
  `deletedBy` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`memoryID`),
  KEY `idx_userId_date` (`userId`, `memoryDate` DESC),
  KEY `idx_userId_occasion` (`userId`, `occasion`),
  KEY `idx_wineID` (`wineID`),
  KEY `idx_agentIdentificationID` (`agentIdentificationID`),
  KEY `idx_deleted` (`deleted`),
  KEY `idx_favorite` (`userId`, `isFavorite`, `memoryDate` DESC),
  KEY `idx_createdAt` (`createdAt` DESC),
  KEY `idx_producer` (`producer`),
  KEY `idx_country` (`country`),
  FULLTEXT KEY `ft_memory_search` (`title`, `producer`, `wineName`, `notes`, `location`),

  CONSTRAINT `fk_memory_wine` FOREIGN KEY (`wineID`) REFERENCES `wine` (`wineID`) ON DELETE SET NULL,
  CONSTRAINT `fk_memory_agentIdent` FOREIGN KEY (`agentIdentificationID`) REFERENCES `agentIdentificationResults` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table 2: memoryMedia (photos, URLs, screenshots)
-- --------------------------------------------------------

CREATE TABLE `memoryMedia` (
  `mediaID` int NOT NULL AUTO_INCREMENT,
  `memoryID` int NOT NULL,

  `mediaType` enum('image', 'url', 'screenshot') NOT NULL,
  `path` varchar(500) NOT NULL COMMENT 'File path (images/screenshots) or URL (links)',
  `thumbnailPath` varchar(500) DEFAULT NULL COMMENT 'Thumbnail for images/screenshots (300x300)',
  `caption` varchar(500) DEFAULT NULL,
  `isPrimary` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Cover photo flag for timeline cards',
  `sortOrder` tinyint NOT NULL DEFAULT 0,

  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`mediaID`),
  KEY `idx_memoryID` (`memoryID`, `sortOrder`),
  KEY `idx_mediaType` (`mediaType`),
  KEY `idx_primary` (`memoryID`, `isPrimary`),

  CONSTRAINT `fk_media_memory` FOREIGN KEY (`memoryID`) REFERENCES `memories` (`memoryID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table 3: memoryTags (normalized tags for filtering)
-- --------------------------------------------------------

CREATE TABLE `memoryTags` (
  `tagID` int NOT NULL AUTO_INCREMENT,
  `memoryID` int NOT NULL,

  `tag` varchar(100) NOT NULL COMMENT 'User-defined tag (lowercase, trimmed)',

  PRIMARY KEY (`tagID`),
  UNIQUE KEY `idx_memory_tag` (`memoryID`, `tag`),
  KEY `idx_tag` (`tag`),

  CONSTRAINT `fk_tag_memory` FOREIGN KEY (`memoryID`) REFERENCES `memories` (`memoryID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table 4: memoryConnections (links to wines, other memories, producers, regions)
-- NOTE: Empty for MVP. Populated by agent in V2.
-- Uses polymorphic association (targetType + targetID) — no FK referential integrity.
-- Application-level validation in saveMemory.php checks target existence.
-- --------------------------------------------------------

CREATE TABLE `memoryConnections` (
  `connectionID` int NOT NULL AUTO_INCREMENT,
  `memoryID` int NOT NULL COMMENT 'Source memory',

  `targetType` enum('wine', 'memory', 'producer', 'region') NOT NULL COMMENT 'What entity type this links to',
  `targetID` int NOT NULL COMMENT 'ID of the target entity (validated at application level)',
  `relationship` varchar(50) DEFAULT NULL COMMENT 'same_wine, same_occasion, similar, follow_up',

  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`connectionID`),
  UNIQUE KEY `idx_memory_target` (`memoryID`, `targetType`, `targetID`),
  KEY `idx_targetType_targetID` (`targetType`, `targetID`),

  CONSTRAINT `fk_connection_memory` FOREIGN KEY (`memoryID`) REFERENCES `memories` (`memoryID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- AUTO_INCREMENT
-- --------------------------------------------------------

ALTER TABLE `memories`
  MODIFY `memoryID` int NOT NULL AUTO_INCREMENT;

ALTER TABLE `memoryMedia`
  MODIFY `mediaID` int NOT NULL AUTO_INCREMENT;

ALTER TABLE `memoryTags`
  MODIFY `tagID` int NOT NULL AUTO_INCREMENT;

ALTER TABLE `memoryConnections`
  MODIFY `connectionID` int NOT NULL AUTO_INCREMENT;
```

### 10.3 Updated Sample Data (Unified Schema)

```sql
-- Memory 1: Restaurant discovery (linked to existing cellar wine)
INSERT INTO `memories`
  (`userId`, `title`, `notes`, `occasion`, `wineID`,
   `producer`, `wineName`, `vintage`, `wineType`, `region`, `country`, `countryCode`, `appellation`,
   `location`, `companions`, `price`, `currency`, `priceRange`,
   `rating`, `mood`, `source`, `memoryDate`, `isFavorite`)
VALUES
  (1, 'Amazing Margaux at The Ledbury',
   'Had this with the venison course. The sommelier decanted it for 2 hours and it was absolutely stunning. Silky tannins, incredible length. One of the best Bordeaux experiences I''ve had.',
   'restaurant', 42,
   'Chateau Margaux', 'Pavillon Rouge', 2015, 'Red', 'Bordeaux', 'France', 'FR', 'Margaux',
   'The Ledbury, Notting Hill, London',
   'Sarah, James',
   85.00, 'GBP', '$$$$',
   9, 'celebratory', 'manual',
   '2026-01-18', 1);

INSERT INTO `memoryMedia` (`memoryID`, `mediaType`, `path`, `caption`, `isPrimary`, `sortOrder`)
VALUES
  (1, 'image', 'images/memories/2026/01/ledbury-margaux.jpg', 'The bottle at the table', 1, 0),
  (1, 'image', 'images/memories/2026/01/ledbury-venison.jpg', 'Venison course pairing', 0, 1);

INSERT INTO `memoryTags` (`memoryID`, `tag`)
VALUES (1, 'fine-dining'), (1, 'bordeaux'), (1, 'special-occasion');

-- --------------------------------------------------------

-- Memory 2: Instagram discovery (wine NOT in cellar)
INSERT INTO `memories`
  (`userId`, `title`, `notes`, `occasion`,
   `producer`, `wineName`, `vintage`, `wineType`, `region`, `country`, `countryCode`,
   `source`, `memoryDate`)
VALUES
  (1, 'Stunning orange wine from Georgia',
   'Saw this on @wine_adventures Instagram. Amber color, made in qvevri (clay vessels). Need to find this! Apparently available at Les Caves de Pyrene.',
   'social_media',
   'Pheasant''s Tears', 'Rkatsiteli', 2022, 'Orange', 'Kakheti', 'Georgia', 'GE',
   'manual',
   '2026-02-05');

INSERT INTO `memoryMedia` (`memoryID`, `mediaType`, `path`, `caption`, `isPrimary`, `sortOrder`)
VALUES
  (2, 'screenshot', 'images/memories/2026/02/instagram-georgia-wine.jpg', 'Instagram post by @wine_adventures', 1, 0),
  (2, 'url', 'https://www.instagram.com/p/ABC123/', 'Original Instagram post', 0, 1);

INSERT INTO `memoryTags` (`memoryID`, `tag`)
VALUES (2, 'natural-wine'), (2, 'want-to-try'), (2, 'orange-wine');

-- --------------------------------------------------------

-- Memory 3: Friend recommendation
INSERT INTO `memories`
  (`userId`, `title`, `notes`, `occasion`,
   `producer`, `wineName`, `vintage`, `wineType`, `region`, `country`, `countryCode`,
   `companions`, `price`, `currency`,
   `source`, `memoryDate`)
VALUES
  (1, 'Tom''s Barolo recommendation',
   'Tom said this is the best value Barolo he''s had in years. "If you can find the 2019, buy a case." Said it drinks well young but will age 20+ years. He got it from Berry Bros.',
   'friend_recommendation',
   'G.D. Vajra', 'Barolo DOCG', 2019, 'Red', 'Piedmont', 'Italy', 'IT',
   'Tom Henderson',
   38.00, 'GBP',
   'manual',
   '2026-01-25');

INSERT INTO `memoryTags` (`memoryID`, `tag`)
VALUES (3, 'buy-recommendation'), (3, 'barolo'), (3, 'ageable');

-- --------------------------------------------------------

-- Memory 4: Travel discovery with GPS
INSERT INTO `memories`
  (`userId`, `title`, `notes`, `occasion`,
   `producer`, `wineName`, `vintage`, `wineType`, `region`, `country`, `countryCode`,
   `location`, `latitude`, `longitude`,
   `mood`, `source`, `memoryDate`, `isFavorite`)
VALUES
  (1, 'Domaine de la Romanee-Conti visit',
   'Once-in-a-lifetime visit arranged through the wine club. Tasted the 2020 La Tache from barrel. The complexity even at this stage was extraordinary. Also visited Vosne-Romanee village and had lunch at Le Richebourg restaurant.',
   'travel',
   'Domaine de la Romanee-Conti', 'La Tache Grand Cru', 2020, 'Red', 'Burgundy', 'France', 'FR',
   'Domaine de la Romanee-Conti, Vosne-Romanee, Burgundy',
   47.1627, 4.9517,
   'awestruck', 'manual',
   '2025-09-14', 1);

INSERT INTO `memoryMedia` (`memoryID`, `mediaType`, `path`, `caption`, `isPrimary`, `sortOrder`)
VALUES
  (4, 'image', 'images/memories/2025/09/drc-entrance.jpg', 'The famous DRC gate', 1, 0),
  (4, 'image', 'images/memories/2025/09/drc-barrel-room.jpg', 'Barrel room tasting', 0, 1),
  (4, 'image', 'images/memories/2025/09/vosne-romanee-village.jpg', 'Vosne-Romanee village', 0, 2);

INSERT INTO `memoryTags` (`memoryID`, `tag`)
VALUES (4, 'burgundy-trip'), (4, 'bucket-list'), (4, 'winery-visit');

-- --------------------------------------------------------

-- Memory 5: Agent-created memory (from identification flow)
INSERT INTO `memories`
  (`userId`, `title`, `notes`, `occasion`,
   `producer`, `wineName`, `vintage`, `wineType`, `region`, `country`, `countryCode`,
   `location`, `price`, `currency`, `priceRange`,
   `source`, `agentIdentificationID`,
   `identificationSnapshot`,
   `memoryDate`)
VALUES
  (1, 'Wine menu photo at Chez Bruce',
   'Took a photo of the wine list. Agent identified the Chablis Grand Cru as Les Clos 2018 from Dauvissat. Price on the list was 120 -- need to check retail.',
   'restaurant',
   'Rene & Vincent Dauvissat', 'Chablis Grand Cru Les Clos', 2018, 'White', 'Burgundy', 'France', 'FR',
   'Chez Bruce, Wandsworth, London',
   120.00, 'GBP', '$$$$',
   'agent', 47,
   '{"confidence": 92, "tier": "tier1", "inputType": "image"}',
   '2026-02-10');

INSERT INTO `memoryMedia` (`memoryID`, `mediaType`, `path`, `caption`, `isPrimary`, `sortOrder`)
VALUES
  (5, 'image', 'images/memories/2026/02/chez-bruce-winelist.jpg', 'Wine list at Chez Bruce', 1, 0);

INSERT INTO `memoryTags` (`memoryID`, `tag`)
VALUES (5, 'wine-list'), (5, 'white-burgundy');

-- --------------------------------------------------------

-- Memory 6: Article find with URL media
INSERT INTO `memories`
  (`userId`, `title`, `notes`, `occasion`,
   `producer`, `wineName`, `vintage`, `wineType`, `region`, `country`, `countryCode`,
   `source`, `memoryDate`)
VALUES
  (1, 'Decanter Top 10 Rieslings 2025',
   'Decanter''s annual Riesling roundup. The Donnhoff Oberhauser Brucke Spatlese 2022 scored 97 points and was called "the definition of Nahe Riesling." Available at Justerini & Brooks for around 45.',
   'article',
   'Donnhoff', 'Oberhauser Brucke Spatlese', 2022, 'White', 'Nahe', 'Germany', 'DE',
   'manual',
   '2026-02-01');

INSERT INTO `memoryMedia` (`memoryID`, `mediaType`, `path`, `isPrimary`, `sortOrder`)
VALUES
  (6, 'url', 'https://www.decanter.com/top-rieslings-2025', 1, 0);

INSERT INTO `memoryTags` (`memoryID`, `tag`)
VALUES (6, 'critics-pick'), (6, 'riesling'), (6, 'want-to-try');

-- --------------------------------------------------------

-- Memory 7: Cellar moment with quick rating
INSERT INTO `memories`
  (`userId`, `title`, `notes`, `occasion`, `wineID`,
   `producer`, `wineName`, `vintage`, `wineType`, `region`, `country`, `countryCode`, `appellation`,
   `companions`, `rating`, `mood`,
   `source`, `memoryDate`)
VALUES
  (1, 'Opening night for the 2010 Lynch-Bages',
   'Finally opened one of the three bottles we''ve been sitting on. Decanted for 3 hours. Cedar, graphite, blackcurrant -- textbook Pauillac at peak. This was worth the wait. Still have 2 bottles left -- might hold one more year.',
   'cellar_moment', 15,
   'Chateau Lynch-Bages', 'Grand Vin', 2010, 'Red', 'Bordeaux', 'France', 'FR', 'Pauillac',
   'Emma',
   9, 'nostalgic',
   'manual',
   '2026-02-08');

INSERT INTO `memoryMedia` (`memoryID`, `mediaType`, `path`, `caption`, `isPrimary`, `sortOrder`)
VALUES
  (7, 'image', 'images/memories/2026/02/lynch-bages-2010-open.jpg', 'After 3 hours in the decanter', 1, 0);

INSERT INTO `memoryTags` (`memoryID`, `tag`)
VALUES (7, 'peak-drinking'), (7, 'pauillac');
```

### 10.4 Updated Key Queries (Unified Schema)

With flat wine columns instead of JSON snapshot, queries are simpler and FULLTEXT-capable.

#### Timeline (paginated)

```sql
SELECT
  m.memoryID, m.title, m.notes, m.occasion,
  m.producer, m.wineName, m.vintage, m.wineType,
  m.region, m.country, m.countryCode,
  m.location, m.companions, m.rating, m.priceRange,
  m.memoryDate, m.isFavorite, m.createdAt,
  -- Linked cellar wine picture (if linked)
  w.pictureURL AS winePictureURL,
  -- Primary photo
  (SELECT mm.path FROM memoryMedia mm
   WHERE mm.memoryID = m.memoryID AND mm.isPrimary = 1
   LIMIT 1) AS primaryPhoto,
  -- Media count
  (SELECT COUNT(*) FROM memoryMedia mm
   WHERE mm.memoryID = m.memoryID) AS photoCount,
  -- Tags as JSON array
  (SELECT JSON_ARRAYAGG(mt.tag) FROM memoryTags mt
   WHERE mt.memoryID = m.memoryID) AS tags
FROM memories m
LEFT JOIN wine w ON m.wineID = w.wineID AND w.deleted = 0
WHERE m.userId = 1
  AND m.deleted = 0
ORDER BY m.memoryDate DESC, m.createdAt DESC
LIMIT 20 OFFSET 0;
```

#### Full-text search

```sql
SELECT m.*,
  MATCH(m.title, m.producer, m.wineName, m.notes, m.location)
    AGAINST('barolo tuscany' IN BOOLEAN MODE) AS relevance
FROM memories m
WHERE m.userId = 1
  AND m.deleted = 0
  AND MATCH(m.title, m.producer, m.wineName, m.notes, m.location)
    AGAINST('barolo tuscany' IN BOOLEAN MODE)
ORDER BY relevance DESC
LIMIT 20;
```

#### Agent: "Have I seen this wine before?"

```sql
SELECT m.memoryID, m.title, m.occasion, m.memoryDate, m.notes,
  m.producer, m.wineName, m.vintage, m.rating
FROM memories m
WHERE m.userId = 1
  AND m.deleted = 0
  AND (
    m.wineID = :wineId
    OR (m.producer LIKE :producerPattern AND m.wineName LIKE :wineNamePattern)
  )
ORDER BY m.memoryDate DESC;
```

#### Filter by occasion with cascading filter options

```sql
-- Memories filtered by occasion, with available filter options for remaining filters
SELECT m.*,
  (SELECT mm.path FROM memoryMedia mm
   WHERE mm.memoryID = m.memoryID AND mm.isPrimary = 1 LIMIT 1) AS primaryPhoto,
  (SELECT JSON_ARRAYAGG(mt.tag) FROM memoryTags mt
   WHERE mt.memoryID = m.memoryID) AS tags
FROM memories m
WHERE m.userId = 1
  AND m.deleted = 0
  AND m.occasion = :occasion
ORDER BY m.memoryDate DESC
LIMIT 20 OFFSET 0;

-- Cascading: available countries given current occasion filter
SELECT m.country, COUNT(*) AS count
FROM memories m
WHERE m.userId = 1 AND m.deleted = 0
  AND (:occasion IS NULL OR m.occasion = :occasion)
  AND m.country IS NOT NULL
GROUP BY m.country
ORDER BY count DESC;
```

### 10.5 Rollback

```sql
-- Full rollback (drop in FK-safe order)
DROP TABLE IF EXISTS `memoryConnections`;
DROP TABLE IF EXISTS `memoryTags`;
DROP TABLE IF EXISTS `memoryMedia`;
DROP TABLE IF EXISTS `memories`;
```

No existing tables are altered. Zero data loss risk.

-- =====================================================
-- AI Agent Phase 1 - Database Schema
-- Wine AI Sommelier Foundation Tables
-- =====================================================

-- 1. User Foundation (Multi-user ready)
CREATE TABLE IF NOT EXISTS agentUsers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    externalId VARCHAR(255) NULL COMMENT 'Future auth provider ID',
    displayName VARCHAR(100) NOT NULL DEFAULT 'Default User',
    email VARCHAR(255) NULL,
    preferences JSON NULL COMMENT 'User preferences blob',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_externalId (externalId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default user (id=1 for single-user mode)
INSERT INTO agentUsers (id, displayName) VALUES (1, 'Default User')
ON DUPLICATE KEY UPDATE displayName = VALUES(displayName);

-- 2. Reference: Grape Characteristics
CREATE TABLE IF NOT EXISTS refGrapeCharacteristics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    grapeName VARCHAR(100) NOT NULL,
    alternateNames JSON NULL COMMENT '["Syrah", "Shiraz"]',
    color ENUM('red', 'white', 'pink') NOT NULL,
    body ENUM('light', 'medium-light', 'medium', 'medium-full', 'full') NOT NULL,
    tannin ENUM('low', 'medium-low', 'medium', 'medium-high', 'high') NULL,
    acidity ENUM('low', 'medium-low', 'medium', 'medium-high', 'high') NOT NULL,
    sweetness ENUM('bone-dry', 'dry', 'off-dry', 'medium-sweet', 'sweet') DEFAULT 'dry',
    primaryFlavors JSON NOT NULL COMMENT '["black cherry", "plum", "pepper"]',
    secondaryFlavors JSON NULL,
    agingPotential ENUM('drink-now', 'short', 'medium', 'long', 'very-long') DEFAULT 'medium',
    classicPairings JSON NULL COMMENT '["lamb", "beef", "mushrooms"]',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_grapeName (grapeName),
    INDEX idx_color (color),
    INDEX idx_body (body)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Reference: Pairing Rules (Hierarchical)
CREATE TABLE IF NOT EXISTS refPairingRules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    foodCategory VARCHAR(100) NOT NULL COMMENT 'Broad: "Seafood", "Red Meat"',
    foodSubcategory VARCHAR(100) NULL COMMENT 'Specific: "Shellfish", "Lamb"',
    foodItem VARCHAR(100) NULL COMMENT 'Exact: "Oysters", "Lamb Chops"',
    preparationMethod VARCHAR(100) NULL COMMENT '"grilled", "raw", "braised"',
    wineTypes JSON NOT NULL COMMENT '["Sparkling", "White"]',
    wineStyles JSON NULL COMMENT '["Blanc de Blancs", "Muscadet"]',
    grapeVarieties JSON NULL COMMENT '["Chardonnay", "Sauvignon Blanc"]',
    avoidTypes JSON NULL COMMENT 'Types to avoid',
    avoidStyles JSON NULL,
    specificity TINYINT NOT NULL DEFAULT 1 COMMENT '1=general, 5=exact match',
    reasoning TEXT NULL,
    source VARCHAR(100) NULL COMMENT 'Wine Folly, CMS, etc.',
    isActive BOOLEAN DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_foodCategory (foodCategory),
    INDEX idx_specificity (specificity DESC),
    INDEX idx_lookup (foodCategory, foodSubcategory, foodItem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Reference: Intensity Profiles
CREATE TABLE IF NOT EXISTS refIntensityProfiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    entityType ENUM('food', 'wine_type', 'grape', 'style') NOT NULL,
    entityName VARCHAR(100) NOT NULL,
    weight DECIMAL(3,2) NOT NULL COMMENT '0.00-1.00, light to heavy',
    richness DECIMAL(3,2) NOT NULL COMMENT '0.00-1.00, lean to rich',
    acidityNeed DECIMAL(3,2) NULL COMMENT 'For food: how much acidity wanted',
    tanninTolerance DECIMAL(3,2) NULL COMMENT 'For food: tannin compatibility',
    sweetnessAffinity DECIMAL(3,2) NULL COMMENT 'For food: sweetness pairing',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_entity (entityType, entityName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Reference: Wine Styles
CREATE TABLE IF NOT EXISTS refWineStyles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    styleName VARCHAR(100) NOT NULL,
    wineType ENUM('Red', 'White', 'Rosé', 'Sparkling', 'Dessert', 'Fortified') NOT NULL,
    description TEXT NULL,
    characteristics JSON NULL COMMENT '{"body": "light", "sweetness": "dry"}',
    typicalGrapes JSON NULL,
    typicalRegions JSON NULL,
    servingTemp VARCHAR(50) NULL COMMENT '"7-10°C" or "45-50°F"',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_styleName (styleName),
    INDEX idx_wineType (wineType)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Reference: Appellations
CREATE TABLE IF NOT EXISTS refAppellations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    appellationName VARCHAR(150) NOT NULL,
    country VARCHAR(100) NOT NULL,
    region VARCHAR(100) NULL,
    subRegion VARCHAR(100) NULL,
    wineTypes JSON NULL COMMENT '["Red", "White"]',
    primaryGrapes JSON NULL,
    classificationLevel VARCHAR(50) NULL COMMENT 'Grand Cru, Premier Cru, etc.',
    parentAppellation INT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_appellation (appellationName, country),
    INDEX idx_country (country),
    INDEX idx_region (region),
    FOREIGN KEY (parentAppellation) REFERENCES refAppellations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Cache: Producers
CREATE TABLE IF NOT EXISTS cacheProducers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    producerName VARCHAR(255) NOT NULL,
    normalizedName VARCHAR(255) NOT NULL COMMENT 'Lowercase, no accents',
    country VARCHAR(100) NULL,
    region VARCHAR(100) NULL,
    foundedYear INT NULL,
    website VARCHAR(500) NULL,
    description TEXT NULL,
    winemaker VARCHAR(255) NULL,
    certifications JSON NULL COMMENT '["organic", "biodynamic"]',
    -- Field-level TTL tracking
    staticFetchedAt TIMESTAMP NULL COMMENT 'foundedYear, country - 365 day TTL',
    semiStaticFetchedAt TIMESTAMP NULL COMMENT 'winemaker, description - 180 day TTL',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_normalizedName (normalizedName),
    INDEX idx_producerName (producerName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Cache: Wine Enrichment
CREATE TABLE IF NOT EXISTS cacheWineEnrichment (
    id INT PRIMARY KEY AUTO_INCREMENT,
    wineId INT NULL COMMENT 'FK to wine table if linked',
    lookupKey VARCHAR(500) NOT NULL COMMENT 'producer|wineName|vintage',
    -- Static fields (365 day TTL)
    grapeVarieties JSON NULL,
    appellation VARCHAR(150) NULL,
    alcoholContent DECIMAL(4,2) NULL,
    -- Semi-static fields (90 day TTL)
    drinkWindowStart INT NULL,
    drinkWindowEnd INT NULL,
    productionMethod TEXT NULL,
    -- Dynamic fields (30 day TTL)
    criticScores JSON NULL COMMENT '[{"critic": "WS", "score": 94, "year": 2023}]',
    averagePrice DECIMAL(10,2) NULL,
    priceSource VARCHAR(50) NULL,
    -- Very dynamic (7 day TTL)
    priceFetchedAt TIMESTAMP NULL,
    -- Field group timestamps
    staticFetchedAt TIMESTAMP NULL,
    semiStaticFetchedAt TIMESTAMP NULL,
    dynamicFetchedAt TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_lookupKey (lookupKey),
    INDEX idx_wineId (wineId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Wine Embeddings
CREATE TABLE IF NOT EXISTS agentWineEmbeddings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    wineId INT NOT NULL COMMENT 'FK to wine table',
    embeddingModel VARCHAR(50) NOT NULL DEFAULT 'text-embedding-3-small',
    embeddingVersion INT NOT NULL DEFAULT 1,
    embedding JSON NOT NULL COMMENT '1536-dimensional vector',
    textUsed TEXT NOT NULL COMMENT 'Source text for embedding',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_wine_model (wineId, embeddingModel),
    INDEX idx_model_version (embeddingModel, embeddingVersion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Agent Sessions
CREATE TABLE IF NOT EXISTS agentSessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    userId INT NOT NULL DEFAULT 1,
    sessionToken VARCHAR(100) NOT NULL,
    state ENUM('idle', 'identifying', 'disambiguating', 'enriching', 'pairing') DEFAULT 'idle',
    contextData JSON NULL COMMENT 'Current wine, candidates, etc.',
    lastActivityAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expiresAt TIMESTAMP NULL,
    UNIQUE KEY idx_sessionToken (sessionToken),
    INDEX idx_userId (userId),
    INDEX idx_expiresAt (expiresAt),
    FOREIGN KEY (userId) REFERENCES agentUsers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. User Taste Profile
CREATE TABLE IF NOT EXISTS agentUserTasteProfile (
    id INT PRIMARY KEY AUTO_INCREMENT,
    userId INT NOT NULL,
    profileType ENUM('computed', 'stated') NOT NULL DEFAULT 'computed',
    preferredTypes JSON NULL COMMENT '{"Red": 0.7, "White": 0.3}',
    preferredCountries JSON NULL,
    preferredGrapes JSON NULL,
    preferredStyles JSON NULL,
    avoidCharacteristics JSON NULL COMMENT '["high tannin", "oaky"]',
    priceRangeMin DECIMAL(10,2) NULL,
    priceRangeMax DECIMAL(10,2) NULL,
    computedAt TIMESTAMP NULL,
    ratingCount INT DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_userId_type (userId, profileType),
    FOREIGN KEY (userId) REFERENCES agentUsers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. Usage Log (per-request)
CREATE TABLE IF NOT EXISTS agentUsageLog (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    userId INT NOT NULL DEFAULT 1,
    sessionId INT NULL,
    provider VARCHAR(20) NOT NULL COMMENT 'gemini, claude, openai',
    model VARCHAR(50) NOT NULL,
    taskType VARCHAR(50) NOT NULL COMMENT 'identify_text, enrich, pair',
    inputTokens INT NOT NULL DEFAULT 0,
    outputTokens INT NOT NULL DEFAULT 0,
    totalTokens INT GENERATED ALWAYS AS (inputTokens + outputTokens) STORED,
    costUSD DECIMAL(10,6) NOT NULL DEFAULT 0,
    latencyMs INT NULL,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    errorType VARCHAR(50) NULL,
    errorMessage TEXT NULL,
    requestHash VARCHAR(64) NULL COMMENT 'For dedup detection',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_userId_date (userId, createdAt),
    INDEX idx_provider (provider, createdAt),
    INDEX idx_taskType (taskType, createdAt),
    INDEX idx_sessionId (sessionId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. Usage Daily Aggregates
CREATE TABLE IF NOT EXISTS agentUsageDaily (
    id INT PRIMARY KEY AUTO_INCREMENT,
    userId INT NOT NULL DEFAULT 1,
    date DATE NOT NULL,
    provider VARCHAR(20) NOT NULL,
    requestCount INT NOT NULL DEFAULT 0,
    successCount INT NOT NULL DEFAULT 0,
    failureCount INT NOT NULL DEFAULT 0,
    totalInputTokens BIGINT NOT NULL DEFAULT 0,
    totalOutputTokens BIGINT NOT NULL DEFAULT 0,
    totalCostUSD DECIMAL(10,4) NOT NULL DEFAULT 0,
    avgLatencyMs INT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_user_date_provider (userId, date, provider),
    INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Migration: WIN-162 Canonical Name Resolution
-- Date: 2026-02-02
-- JIRA: WIN-162
-- Description: Add tables for enrichment cache canonical name resolution
--              to improve cache hit rates by resolving abbreviations and name variants

-- =====================================================
-- TABLE 1: refAbbreviations
-- Common wine industry abbreviations for expansion
-- =====================================================

CREATE TABLE IF NOT EXISTS refAbbreviations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    abbreviation VARCHAR(50) NOT NULL COMMENT 'Abbreviated form, e.g., "Ch.", "Dom."',
    expansion VARCHAR(100) NOT NULL COMMENT 'Full form, e.g., "Château", "Domaine"',
    context ENUM('producer', 'wine', 'both') DEFAULT 'both' COMMENT 'Where abbreviation typically appears',
    priority TINYINT DEFAULT 1 COMMENT 'Higher = process first (for overlapping patterns)',
    isActive BOOLEAN DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_abbreviation (abbreviation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed common wine abbreviations
INSERT INTO refAbbreviations (abbreviation, expansion, context, priority) VALUES
-- Producer prefixes (high priority)
('Ch.', 'Château', 'producer', 10),
('Cht.', 'Château', 'producer', 10),
('Chateau', 'Château', 'producer', 9),
('Dom.', 'Domaine', 'producer', 10),
('Wgt.', 'Weingut', 'producer', 10),
('Bod.', 'Bodega', 'producer', 10),
('Tnta.', 'Tenuta', 'producer', 10),
('Cstl.', 'Castello', 'producer', 10),
('Qtà.', 'Quinta', 'producer', 10),
('Qta.', 'Quinta', 'producer', 10),
('Clos', 'Clos', 'producer', 5),
('Marchesi', 'Marchesi', 'producer', 5),
-- Wine classification abbreviations (medium priority)
('GC', 'Grand Cru', 'wine', 5),
('PC', 'Premier Cru', 'wine', 5),
('1er Cru', 'Premier Cru', 'wine', 5),
('VV', 'Vieilles Vignes', 'wine', 5),
('Res.', 'Reserva', 'wine', 5),
('Rsv.', 'Riserva', 'wine', 5),
('Gran Res.', 'Gran Reserva', 'wine', 5),
-- Both contexts
('Ste.', 'Sainte', 'both', 8),
('St.', 'Saint', 'both', 8),
('Mt.', 'Mont', 'both', 7),
('Mte.', 'Monte', 'both', 7)
ON DUPLICATE KEY UPDATE
    expansion = VALUES(expansion),
    context = VALUES(context),
    priority = VALUES(priority);


-- =====================================================
-- TABLE 2: cacheCanonicalAliases
-- Maps variant lookup keys to canonical cache keys
-- =====================================================

CREATE TABLE IF NOT EXISTS cacheCanonicalAliases (
    id INT PRIMARY KEY AUTO_INCREMENT,
    aliasKey VARCHAR(500) NOT NULL COMMENT 'Variant key, e.g., "ch-margaux|margaux|2015"',
    canonicalKey VARCHAR(500) NOT NULL COMMENT 'Canonical key in cacheWineEnrichment',
    aliasType ENUM('abbreviation', 'variant', 'fuzzy') NOT NULL DEFAULT 'variant' COMMENT 'How alias was created',
    confidence DECIMAL(3,2) DEFAULT 1.00 COMMENT 'Match confidence when alias was created',
    hitCount INT NOT NULL DEFAULT 0 COMMENT 'Times this alias resolved successfully',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    lastUsedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_aliasKey (aliasKey),
    INDEX idx_canonicalKey (canonicalKey),
    INDEX idx_hitCount (hitCount DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================
-- Verification queries (run after migration)
-- =====================================================

-- SELECT COUNT(*) as abbreviation_count FROM refAbbreviations WHERE isActive = 1;
-- SELECT * FROM refAbbreviations ORDER BY priority DESC, abbreviation;
-- DESCRIBE cacheCanonicalAliases;


-- =====================================================
-- ROLLBACK (if needed)
-- =====================================================

-- DROP TABLE IF EXISTS cacheCanonicalAliases;
-- DROP TABLE IF EXISTS refAbbreviations;

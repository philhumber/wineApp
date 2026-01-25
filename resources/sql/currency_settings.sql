-- Currency and Bottle Size Reference Tables
-- WIN-130: Allow Currency Setting
-- WIN-103: Remove hardcoded currencies and sizes
--
-- Run this migration on the winelist database
-- mysql -h 10.0.0.16 -u username -p winelist < currency_settings.sql

-- ─────────────────────────────────────────────────────────
-- CURRENCIES TABLE
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `currencies` (
  `currencyCode` char(3) NOT NULL PRIMARY KEY COMMENT 'ISO 4217 currency code',
  `currencyName` varchar(50) NOT NULL COMMENT 'Full currency name',
  `symbol` varchar(10) NOT NULL COMMENT 'Display symbol (€, £, $)',
  `rateToEUR` decimal(10,6) NOT NULL COMMENT 'Multiply EUR by this to get target currency',
  `isActive` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Show in currency selector',
  `sortOrder` int NOT NULL DEFAULT 0 COMMENT 'Display order in dropdowns',
  `lastUpdated` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Seed data: 11 currencies matching frontend currencyOptions
-- rateToEUR: how many units of this currency = 1 EUR
-- Example: 1 EUR = 0.8547 GBP, so rateToEUR for GBP = 0.8547
INSERT INTO `currencies` (`currencyCode`, `currencyName`, `symbol`, `rateToEUR`, `isActive`, `sortOrder`) VALUES
('GBP', 'British Pound', '£', 0.854700, 1, 1),
('EUR', 'Euro', '€', 1.000000, 1, 2),
('USD', 'US Dollar', '$', 1.086957, 1, 3),
('AUD', 'Australian Dollar', 'A$', 1.650000, 1, 4),
('NZD', 'New Zealand Dollar', 'NZ$', 1.750000, 1, 5),
('CHF', 'Swiss Franc', 'CHF ', 0.950000, 1, 6),
('DKK', 'Danish Krone', 'kr ', 7.450000, 1, 7),
('NOK', 'Norwegian Krone', 'kr ', 11.500000, 1, 8),
('SEK', 'Swedish Krona', 'kr ', 11.494253, 1, 9),
('JPY', 'Japanese Yen', '¥', 160.000000, 1, 10),
('HKD', 'Hong Kong Dollar', 'HK$', 8.500000, 1, 11)
ON DUPLICATE KEY UPDATE
  currencyName = VALUES(currencyName),
  symbol = VALUES(symbol),
  rateToEUR = VALUES(rateToEUR),
  sortOrder = VALUES(sortOrder);

-- Index for active currencies lookup (run separately, may fail if already exists)
ALTER TABLE currencies ADD INDEX idx_currencies_active (isActive, sortOrder);

-- ─────────────────────────────────────────────────────────
-- BOTTLE SIZES TABLE
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `bottle_sizes` (
  `sizeCode` varchar(20) NOT NULL PRIMARY KEY COMMENT 'Size code matching bottles.bottleSize',
  `sizeName` varchar(50) NOT NULL COMMENT 'Display name with volume',
  `volumeLitres` decimal(5,3) NOT NULL COMMENT 'Volume in litres',
  `isActive` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Show in size selector',
  `sortOrder` int NOT NULL DEFAULT 0 COMMENT 'Display order in dropdowns'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Seed data: 12 bottle sizes matching frontend bottleSizeOptions
INSERT INTO `bottle_sizes` (`sizeCode`, `sizeName`, `volumeLitres`, `isActive`, `sortOrder`) VALUES
('Piccolo', 'Piccolo (187.5ml)', 0.187, 1, 1),
('Quarter', 'Quarter (200ml)', 0.187, 1, 2),
('Demi', 'Demi (375ml)', 0.375, 1, 3),
('Standard', 'Standard (750ml)', 0.750, 1, 4),
('Litre', 'Litre (1L)', 1.000, 1, 5),
('Magnum', 'Magnum (1.5L)', 1.500, 1, 6),
('Jeroboam', 'Jeroboam (3L)', 3.000, 1, 7),
('Rehoboam', 'Rehoboam (4.5L)', 4.500, 1, 8),
('Methuselah', 'Methuselah (6L)', 6.000, 1, 9),
('Salmanazar', 'Salmanazar (9L)', 9.000, 1, 10),
('Balthazar', 'Balthazar (12L)', 12.000, 1, 11),
('Nebuchadnezzar', 'Nebuchadnezzar (15L)', 15.000, 1, 12)
ON DUPLICATE KEY UPDATE
  sizeName = VALUES(sizeName),
  volumeLitres = VALUES(volumeLitres),
  sortOrder = VALUES(sortOrder);

-- Index for active sizes lookup (run separately, may fail if already exists)
ALTER TABLE bottle_sizes ADD INDEX idx_bottle_sizes_active (isActive, sortOrder);

-- =====================================================
-- Qvé Wine App - Seed Data
-- Reference data for AI Agent + core lookup tables
-- Source: phpMyAdmin export (winelist DB) + refWineStyles
-- =====================================================

SET NAMES utf8mb4;

-- =====================================================
-- Core Lookup Tables
-- =====================================================

INSERT INTO `worlds` (`name`) VALUES
('New World'),
('Old World'),
('Other World');

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

INSERT INTO `bottle_sizes` (`sizeCode`, `sizeName`, `volumeLitres`, `isActive`, `sortOrder`) VALUES
('Balthazar', 'Balthazar (12L)', 12.000, 1, 11),
('Demi', 'Demi (375ml)', 0.375, 1, 3),
('Jeroboam', 'Jeroboam (3L)', 3.000, 1, 7),
('Litre', 'Litre (1L)', 1.000, 1, 5),
('Magnum', 'Magnum (1.5L)', 1.500, 1, 6),
('Methuselah', 'Methuselah (6L)', 6.000, 1, 9),
('Nebuchadnezzar', 'Nebuchadnezzar (15L)', 15.000, 1, 12),
('Piccolo', 'Piccolo (187.5ml)', 0.187, 1, 1),
('Quarter', 'Quarter (200ml)', 0.200, 1, 2),
('Rehoboam', 'Rehoboam (4.5L)', 4.500, 1, 8),
('Salmanazar', 'Salmanazar (9L)', 9.000, 1, 10),
('Standard', 'Standard (750ml)', 0.750, 1, 4);

INSERT INTO `currencies` (`currencyCode`, `currencyName`, `symbol`, `rateToEUR`, `isActive`, `sortOrder`, `lastUpdated`) VALUES
('AUD', 'Australian Dollar', 'A$', 1.650000, 1, 4, '2026-01-25 19:54:57'),
('CHF', 'Swiss Franc', 'CHF ', 0.950000, 1, 6, '2026-01-25 19:54:57'),
('DKK', 'Danish Krone', 'kr ', 7.450000, 1, 7, '2026-01-25 19:54:57'),
('EUR', 'Euro', '€', 1.000000, 1, 2, '2026-01-25 19:54:57'),
('GBP', 'British Pound', '£', 0.854700, 1, 1, '2026-01-25 19:54:57'),
('HKD', 'Hong Kong Dollar', 'HK$', 8.500000, 1, 11, '2026-01-25 19:54:57'),
('JPY', 'Japanese Yen', '¥', 160.000000, 1, 10, '2026-01-25 19:54:57'),
('NOK', 'Norwegian Krone', 'kr ', 11.500000, 1, 8, '2026-01-25 19:54:57'),
('NZD', 'New Zealand Dollar', 'NZ$', 1.750000, 1, 5, '2026-01-25 19:54:57'),
('SEK', 'Swedish Krona', 'kr ', 11.494253, 1, 9, '2026-01-25 19:54:57'),
('USD', 'US Dollar', '$', 1.086957, 1, 3, '2026-01-25 19:54:57');

INSERT INTO `grapes` (`grapeID`, `grapeName`, `description`, `picture`) VALUES
(1, 'Pinot Noir', 'Pinot Noir is a thin-skinned, early-ripening grape variety that thrives in cool to moderate climates and is known for its delicate, aromatic wines with high acidity and soft tannins. It is notoriously difficult to grow, as it is highly susceptible to disease, rot, and climate variation, requiring well-drained soils and careful vineyard management. Pinot Noir prefers limestone-rich or well-draining soils and flourishes in regions like Burgundy, Oregon, and New Zealand, where cooler temperatures allow for slow, even ripening, preserving its signature bright red fruit, floral, and earthy aromas. The grape''s thin skins and tight clusters make it vulnerable to botrytis and mildew, demanding meticulous canopy management to ensure airflow and sun exposure. Despite its challenges, Pinot Noir produces some of the world''s most elegant and terroir-expressive wines, known for their silky texture and complex aromatics.', 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Grape_near_Sancerre.jpg'),
(2, 'Chardonnay', 'Chardonnay is a versatile, green-skinned grape variety that adapts well to a wide range of climates, making it one of the most widely planted white wine grapes in the world. It thrives in cool, moderate, and warm climates, expressing different characteristics depending on terroir and winemaking style. In cooler regions like Chablis and Champagne, Chardonnay retains high acidity and citrus-driven flavors, while in warmer climates like California and Australia, it develops richer, tropical fruit notes. The grape grows vigorously and is relatively resilient to disease, though it can be susceptible to frost in early budding regions. Chardonnay''s neutral flavor profile makes it an excellent canvas for winemaking techniques, including oak aging (adding vanilla and spice notes) and malolactic fermentation (bringing creamy, buttery textures).', 'https://upload.wikimedia.org/wikipedia/commons/6/66/Chardonnay.jpg'),
(3, 'Meunier', 'Meunier, often called Pinot Meunier, is a black-skinned grape variety primarily used in Champagne blends, though it is increasingly being recognized for its potential in single-varietal wines. It thrives in cool climates and is particularly valued for its hardiness and ability to withstand frost, making it an essential grape in the cool, northern vineyards of Champagne. Meunier is a mutant of Pinot Noir and shares some characteristics, but it buds later and ripens earlier, reducing the risk of spring frost damage. The grape''s name, meaning ''miller'' in French, comes from the white, powdery appearance of its leaves, which are covered in fine hairs. Meunier contributes softness, fruitiness, and approachability to Champagne, offering flavors of red berries, orchard fruit, and floral notes, often making wines that are more immediate and expressive in youth compared to Pinot Noir-based Champagnes.', 'https://upload.wikimedia.org/wikipedia/commons/f/f4/Pinot_Meunier.jpg');

-- =====================================================
-- Abbreviations (Producer & Wine name expansions)
-- =====================================================

INSERT INTO `refAbbreviations` (`id`, `abbreviation`, `expansion`, `context`, `priority`, `isActive`, `createdAt`) VALUES
(1, 'Ch.', 'Château', 'producer', 10, 1, '2026-02-09 16:00:03'),
(2, 'Cht.', 'Château', 'producer', 10, 1, '2026-02-09 16:00:03'),
(3, 'Chateau', 'Château', 'producer', 9, 1, '2026-02-09 16:00:03'),
(4, 'Dom.', 'Domaine', 'producer', 10, 1, '2026-02-09 16:00:03'),
(5, 'Wgt.', 'Weingut', 'producer', 10, 1, '2026-02-09 16:00:03'),
(6, 'Bod.', 'Bodega', 'producer', 10, 1, '2026-02-09 16:00:03'),
(7, 'Tnta.', 'Tenuta', 'producer', 10, 1, '2026-02-09 16:00:03'),
(8, 'Cstl.', 'Castello', 'producer', 10, 1, '2026-02-09 16:00:03'),
(9, 'Qtà.', 'Quinta', 'producer', 10, 1, '2026-02-09 16:00:03'),
(10, 'Clos', 'Clos', 'producer', 5, 1, '2026-02-09 16:00:03'),
(11, 'Marchesi', 'Marchesi', 'producer', 5, 1, '2026-02-09 16:00:03'),
(12, 'GC', 'Grand Cru', 'wine', 5, 1, '2026-02-09 16:00:03'),
(13, 'PC', 'Premier Cru', 'wine', 5, 1, '2026-02-09 16:00:03'),
(14, '1er Cru', 'Premier Cru', 'wine', 5, 1, '2026-02-09 16:00:03'),
(15, 'VV', 'Vieilles Vignes', 'wine', 5, 1, '2026-02-09 16:00:03'),
(16, 'Res.', 'Reserva', 'wine', 5, 1, '2026-02-09 16:00:03'),
(17, 'Rsv.', 'Riserva', 'wine', 5, 1, '2026-02-09 16:00:03'),
(18, 'Gran Res.', 'Gran Reserva', 'wine', 5, 1, '2026-02-09 16:00:03'),
(19, 'Ste.', 'Sainte', 'both', 8, 1, '2026-02-09 16:00:03'),
(20, 'St.', 'Saint', 'both', 8, 1, '2026-02-09 16:00:03'),
(21, 'Mt.', 'Mont', 'both', 7, 1, '2026-02-09 16:00:03'),
(22, 'Mte.', 'Monte', 'both', 7, 1, '2026-02-09 16:00:03');

-- =====================================================
-- Grape Characteristics (29 varieties)
-- =====================================================

INSERT INTO `refGrapeCharacteristics` (`id`, `grapeName`, `alternateNames`, `color`, `body`, `tannin`, `acidity`, `sweetness`, `primaryFlavors`, `secondaryFlavors`, `agingPotential`, `classicPairings`, `createdAt`) VALUES
(1, 'Cabernet Sauvignon', NULL, 'red', 'full', 'high', 'medium', 'dry', '["blackcurrant", "cedar", "tobacco", "dark cherry", "graphite"]', '["vanilla", "chocolate", "leather"]', 'very-long', '["lamb", "beef", "hard cheese", "grilled meats"]', '2026-02-01 16:59:36'),
(2, 'Pinot Noir', NULL, 'red', 'light', 'low', 'medium-high', 'dry', '["red cherry", "raspberry", "strawberry", "earth", "mushroom"]', '["cola", "clove", "forest floor"]', 'medium', '["duck", "salmon", "pork", "mushroom dishes", "chicken"]', '2026-02-01 16:59:36'),
(3, 'Merlot', NULL, 'red', 'medium-full', 'medium', 'medium', 'dry', '["plum", "cherry", "chocolate", "herbs", "bay leaf"]', '["vanilla", "mocha", "tobacco"]', 'medium', '["roast chicken", "pasta", "mushrooms", "pork tenderloin"]', '2026-02-01 16:59:36'),
(4, 'Syrah', '["Shiraz"]', 'red', 'full', 'medium-high', 'medium', 'dry', '["blackberry", "pepper", "smoke", "meat", "olive"]', '["bacon", "tar", "violet"]', 'long', '["grilled meats", "stews", "game", "barbecue", "lamb"]', '2026-02-01 16:59:36'),
(5, 'Tempranillo', '["Tinto Fino", "Tinta Roriz", "Aragonez"]', 'red', 'medium-full', 'medium-high', 'medium', 'dry', '["cherry", "leather", "tobacco", "tomato", "dried fig"]', '["vanilla", "dill", "coconut"]', 'long', '["lamb", "cured meats", "tapas", "chorizo", "manchego"]', '2026-02-01 16:59:36'),
(6, 'Sangiovese', '["Brunello", "Prugnolo Gentile"]', 'red', 'medium', 'medium-high', 'high', 'dry', '["cherry", "tomato", "herbs", "tea", "rose"]', '["tobacco", "leather", "earth"]', 'long', '["tomato-based pasta", "pizza", "grilled vegetables", "hard Italian cheese"]', '2026-02-01 16:59:36'),
(7, 'Nebbiolo', NULL, 'red', 'full', 'high', 'high', 'dry', '["cherry", "rose", "tar", "truffle", "dried herbs"]', '["leather", "licorice", "menthol"]', 'very-long', '["truffle dishes", "braised meats", "aged cheese", "risotto"]', '2026-02-01 16:59:36'),
(8, 'Grenache', '["Garnacha", "Cannonau"]', 'red', 'medium-full', 'medium-low', 'medium', 'dry', '["raspberry", "strawberry", "orange peel", "white pepper", "herbs"]', '["leather", "tar", "licorice"]', 'medium', '["grilled lamb", "Mediterranean cuisine", "roasted vegetables"]', '2026-02-01 16:59:36'),
(9, 'Malbec', '["Côt"]', 'red', 'full', 'medium-high', 'medium', 'dry', '["plum", "blackberry", "black cherry", "cocoa", "violet"]', '["vanilla", "tobacco", "leather"]', 'medium', '["grilled steak", "barbecue", "empanadas", "hard cheese"]', '2026-02-01 16:59:36'),
(10, 'Zinfandel', '["Primitivo"]', 'red', 'full', 'medium', 'medium', 'dry', '["blackberry", "raspberry", "black pepper", "licorice", "jam"]', '["vanilla", "tobacco", "cinnamon"]', 'medium', '["barbecue", "pizza", "grilled sausages", "spicy food"]', '2026-02-01 16:59:36'),
(11, 'Cabernet Franc', NULL, 'red', 'medium', 'medium', 'medium-high', 'dry', '["raspberry", "bell pepper", "violet", "graphite", "herbs"]', '["tobacco", "cedar"]', 'medium', '["roast chicken", "pork", "vegetable dishes", "goat cheese"]', '2026-02-01 16:59:36'),
(12, 'Mourvèdre', '["Monastrell", "Mataro"]', 'red', 'full', 'high', 'medium', 'dry', '["blackberry", "meat", "earth", "game", "black pepper"]', '["leather", "herbs"]', 'long', '["game", "lamb", "hearty stews", "aged cheese"]', '2026-02-01 16:59:36'),
(13, 'Petit Verdot', NULL, 'red', 'full', 'high', 'medium', 'dry', '["violet", "blueberry", "plum", "sage", "pencil lead"]', '["leather", "smoke"]', 'long', '["beef", "lamb", "hard aged cheese"]', '2026-02-01 16:59:36'),
(14, 'Barbera', NULL, 'red', 'medium', 'low', 'high', 'dry', '["cherry", "plum", "herbs", "licorice", "dried flowers"]', '["vanilla", "spice"]', 'medium', '["tomato-based dishes", "pizza", "pasta", "cured meats"]', '2026-02-01 16:59:36'),
(15, 'Dolcetto', NULL, 'red', 'medium', 'medium', 'medium-low', 'dry', '["black cherry", "licorice", "prune", "cocoa", "almond"]', NULL, 'drink-now', '["pasta", "pizza", "antipasti", "cured meats"]', '2026-02-01 16:59:36'),
(16, 'Chardonnay', NULL, 'white', 'medium-full', NULL, 'medium', 'dry', '["apple", "citrus", "pear", "melon"]', '["butter", "vanilla", "toast", "hazelnut"]', 'medium', '["lobster", "chicken", "cream sauces", "rich fish", "soft cheese"]', '2026-02-01 16:59:36'),
(17, 'Sauvignon Blanc', NULL, 'white', 'light', NULL, 'high', 'dry', '["grapefruit", "grass", "green apple", "gooseberry", "lime"]', '["jalapeño", "passionfruit", "boxwood"]', 'drink-now', '["goat cheese", "seafood", "salads", "asparagus", "sushi"]', '2026-02-01 16:59:36'),
(18, 'Riesling', NULL, 'white', 'light', NULL, 'high', 'dry', '["lime", "green apple", "peach", "apricot", "honey"]', '["petrol", "slate", "ginger"]', 'very-long', '["spicy food", "pork", "shellfish", "Asian cuisine", "duck"]', '2026-02-01 16:59:36'),
(19, 'Pinot Grigio', '["Pinot Gris"]', 'white', 'light', NULL, 'medium-high', 'dry', '["lemon", "green apple", "pear", "almond", "honey"]', '["ginger", "stone fruit"]', 'drink-now', '["light seafood", "salads", "light pasta", "aperitif"]', '2026-02-01 16:59:36'),
(20, 'Gewürztraminer', NULL, 'white', 'medium-full', NULL, 'medium-low', 'dry', '["lychee", "rose", "ginger", "grapefruit", "mango"]', '["honey", "spice", "smoke"]', 'medium', '["Asian cuisine", "spicy food", "foie gras", "soft cheese"]', '2026-02-01 16:59:36'),
(21, 'Viognier', NULL, 'white', 'full', NULL, 'medium-low', 'dry', '["peach", "apricot", "tangerine", "honeysuckle", "mango"]', '["vanilla", "cream", "spice"]', 'short', '["rich seafood", "cream sauces", "Thai food", "roast chicken"]', '2026-02-01 16:59:36'),
(22, 'Chenin Blanc', NULL, 'white', 'medium', NULL, 'high', 'dry', '["apple", "quince", "honey", "chamomile", "ginger"]', '["lanolin", "straw", "beeswax"]', 'very-long', '["pork", "Thai cuisine", "soft cheese", "fruit-based dishes"]', '2026-02-01 16:59:36'),
(23, 'Albariño', '["Alvarinho"]', 'white', 'light', NULL, 'high', 'dry', '["lemon", "grapefruit", "peach", "apricot", "saline"]', '["almond", "herbs"]', 'drink-now', '["seafood", "shellfish", "ceviche", "light fish"]', '2026-02-01 16:59:36'),
(24, 'Grüner Veltliner', NULL, 'white', 'light', NULL, 'high', 'dry', '["green apple", "lime", "white pepper", "radish", "herbs"]', '["lentil", "citrus zest"]', 'medium', '["Wiener Schnitzel", "Asian fusion", "salads", "vegetables"]', '2026-02-01 16:59:36'),
(25, 'Muscadet', '["Melon de Bourgogne"]', 'white', 'light', NULL, 'high', 'dry', '["lemon", "green apple", "pear", "saline", "chalk"]', '["yeast", "brioche"]', 'drink-now', '["oysters", "mussels", "seafood", "light fish"]', '2026-02-01 16:59:36'),
(26, 'Torrontés', NULL, 'white', 'light', NULL, 'medium', 'dry', '["peach", "rose", "geranium", "citrus", "lychee"]', NULL, 'drink-now', '["spicy food", "ceviche", "Asian cuisine", "appetizers"]', '2026-02-01 16:59:36'),
(27, 'Semillon', '["Sémillon"]', 'white', 'medium-full', NULL, 'medium-low', 'dry', '["lemon", "apple", "papaya", "fig", "honey"]', '["lanolin", "toast", "waxy"]', 'long', '["rich fish", "chicken", "cream sauces", "foie gras"]', '2026-02-01 16:59:36'),
(28, 'Vermentino', '["Rolle", "Pigato"]', 'white', 'light', NULL, 'medium-high', 'dry', '["lime", "grapefruit", "green apple", "almond", "herbs"]', '["saline", "fennel"]', 'drink-now', '["Mediterranean seafood", "pesto", "light appetizers"]', '2026-02-01 16:59:36'),
(29, 'Grenache Rosé', NULL, 'pink', 'light', NULL, 'medium', 'dry', '["strawberry", "watermelon", "rose petal", "citrus"]', '["herbs", "white pepper"]', 'drink-now', '["salads", "grilled fish", "Mediterranean cuisine", "appetizers"]', '2026-02-01 16:59:36');

-- =====================================================
-- Appellations (47 key wine regions)
-- =====================================================

INSERT INTO `refAppellations` (`id`, `appellationName`, `normalizedName`, `country`, `region`, `subRegion`, `wineTypes`, `primaryGrapes`, `classificationLevel`, `parentAppellation`, `createdAt`) VALUES
(1, 'Bordeaux', 'bordeaux', 'France', 'Bordeaux', NULL, '["Red", "White"]', '["Cabernet Sauvignon", "Merlot", "Sauvignon Blanc"]', 'AOC', NULL, '2026-02-01 16:59:36'),
(2, 'Margaux', 'margaux', 'France', 'Bordeaux', 'Médoc', '["Red"]', '["Cabernet Sauvignon", "Merlot"]', 'AOC', NULL, '2026-02-01 16:59:36'),
(3, 'Pauillac', 'pauillac', 'France', 'Bordeaux', 'Médoc', '["Red"]', '["Cabernet Sauvignon", "Merlot"]', 'AOC', NULL, '2026-02-01 16:59:36'),
(4, 'Saint-Émilion', 'saintémilion', 'France', 'Bordeaux', 'Right Bank', '["Red"]', '["Merlot", "Cabernet Franc"]', 'AOC', NULL, '2026-02-01 16:59:36'),
(5, 'Pomerol', 'pomerol', 'France', 'Bordeaux', 'Right Bank', '["Red"]', '["Merlot", "Cabernet Franc"]', 'AOC', NULL, '2026-02-01 16:59:36'),
(6, 'Sauternes', 'sauternes', 'France', 'Bordeaux', NULL, '["Dessert"]', '["Semillon", "Sauvignon Blanc"]', 'AOC', NULL, '2026-02-01 16:59:36'),
(7, 'Champagne', 'champagne', 'France', 'Champagne', NULL, '["Sparkling"]', '["Chardonnay", "Pinot Noir", "Pinot Meunier"]', 'AOC', NULL, '2026-02-01 16:59:36'),
(8, 'Burgundy', 'burgundy', 'France', 'Burgundy', NULL, '["Red", "White"]', '["Pinot Noir", "Chardonnay"]', 'AOC', NULL, '2026-02-01 16:59:36'),
(9, 'Chablis', 'chablis', 'France', 'Burgundy', 'Chablis', '["White"]', '["Chardonnay"]', 'AOC', NULL, '2026-02-01 16:59:36'),
(10, 'Côte de Nuits', 'côtedenuits', 'France', 'Burgundy', NULL, '["Red"]', '["Pinot Noir"]', 'AOC', NULL, '2026-02-01 16:59:36'),
(11, 'Côte de Beaune', 'côtedebeaune', 'France', 'Burgundy', NULL, '["Red", "White"]', '["Pinot Noir", "Chardonnay"]', 'AOC', NULL, '2026-02-01 16:59:36'),
(12, 'Northern Rhône', 'northernrhône', 'France', 'Rhône Valley', NULL, '["Red", "White"]', '["Syrah", "Viognier"]', 'AOC', NULL, '2026-02-01 16:59:36'),
(13, 'Côte-Rôtie', 'côterôtie', 'France', 'Rhône Valley', 'Northern Rhône', '["Red"]', '["Syrah", "Viognier"]', 'AOC', NULL, '2026-02-01 16:59:36'),
(14, 'Hermitage', 'hermitage', 'France', 'Rhône Valley', 'Northern Rhône', '["Red", "White"]', '["Syrah", "Marsanne", "Roussanne"]', 'AOC', NULL, '2026-02-01 16:59:36'),
(15, 'Châteauneuf-du-Pape', 'châteauneufdupape', 'France', 'Rhône Valley', 'Southern Rhône', '["Red", "White"]', '["Grenache", "Syrah", "Mourvèdre"]', 'AOC', NULL, '2026-02-01 16:59:36'),
(16, 'Loire Valley', 'loirevalley', 'France', 'Loire Valley', NULL, '["White", "Red", "Rosé", "Sparkling"]', '["Sauvignon Blanc", "Chenin Blanc", "Cabernet Franc"]', 'AOC', NULL, '2026-02-01 16:59:36'),
(17, 'Sancerre', 'sancerre', 'France', 'Loire Valley', 'Central Loire', '["White", "Red"]', '["Sauvignon Blanc", "Pinot Noir"]', 'AOC', NULL, '2026-02-01 16:59:36'),
(18, 'Vouvray', 'vouvray', 'France', 'Loire Valley', 'Touraine', '["White", "Sparkling"]', '["Chenin Blanc"]', 'AOC', NULL, '2026-02-01 16:59:36'),
(19, 'Alsace', 'alsace', 'France', 'Alsace', NULL, '["White"]', '["Riesling", "Gewürztraminer", "Pinot Gris"]', 'AOC', NULL, '2026-02-01 16:59:36'),
(20, 'Provence', 'provence', 'France', 'Provence', NULL, '["Rosé", "Red", "White"]', '["Grenache", "Cinsault", "Mourvèdre"]', 'AOC', NULL, '2026-02-01 16:59:36'),
(21, 'Piedmont', 'piedmont', 'Italy', 'Piedmont', NULL, '["Red", "White", "Sparkling"]', '["Nebbiolo", "Barbera", "Moscato"]', 'DOCG', NULL, '2026-02-01 16:59:36'),
(22, 'Barolo', 'barolo', 'Italy', 'Piedmont', NULL, '["Red"]', '["Nebbiolo"]', 'DOCG', NULL, '2026-02-01 16:59:36'),
(23, 'Barbaresco', 'barbaresco', 'Italy', 'Piedmont', NULL, '["Red"]', '["Nebbiolo"]', 'DOCG', NULL, '2026-02-01 16:59:36'),
(24, 'Tuscany', 'tuscany', 'Italy', 'Tuscany', NULL, '["Red", "White"]', '["Sangiovese", "Trebbiano"]', 'DOC', NULL, '2026-02-01 16:59:36'),
(25, 'Chianti Classico', 'chianticlassico', 'Italy', 'Tuscany', 'Chianti', '["Red"]', '["Sangiovese"]', 'DOCG', NULL, '2026-02-01 16:59:36'),
(26, 'Brunello di Montalcino', 'brunellodimontalcino', 'Italy', 'Tuscany', 'Montalcino', '["Red"]', '["Sangiovese"]', 'DOCG', NULL, '2026-02-01 16:59:36'),
(27, 'Bolgheri', 'bolgheri', 'Italy', 'Tuscany', NULL, '["Red"]', '["Cabernet Sauvignon", "Merlot", "Sangiovese"]', 'DOC', NULL, '2026-02-01 16:59:36'),
(28, 'Veneto', 'veneto', 'Italy', 'Veneto', NULL, '["Red", "White", "Sparkling"]', '["Corvina", "Garganega", "Glera"]', 'DOC', NULL, '2026-02-01 16:59:36'),
(29, 'Prosecco', 'prosecco', 'Italy', 'Veneto', NULL, '["Sparkling"]', '["Glera"]', 'DOC', NULL, '2026-02-01 16:59:36'),
(30, 'Amarone della Valpolicella', 'amaronedellavalpolicella', 'Italy', 'Veneto', 'Valpolicella', '["Red"]', '["Corvina", "Rondinella", "Molinara"]', 'DOCG', NULL, '2026-02-01 16:59:36'),
(31, 'Rioja', 'rioja', 'Spain', 'Rioja', NULL, '["Red", "White"]', '["Tempranillo", "Garnacha", "Viura"]', 'DOCa', NULL, '2026-02-01 16:59:36'),
(32, 'Ribera del Duero', 'riberadelduero', 'Spain', 'Castilla y León', NULL, '["Red"]', '["Tempranillo"]', 'DO', NULL, '2026-02-01 16:59:36'),
(33, 'Priorat', 'priorat', 'Spain', 'Catalonia', NULL, '["Red"]', '["Garnacha", "Cariñena"]', 'DOCa', NULL, '2026-02-01 16:59:36'),
(34, 'Rías Baixas', 'ríasbaixas', 'Spain', 'Galicia', NULL, '["White"]', '["Albariño"]', 'DO', NULL, '2026-02-01 16:59:36'),
(35, 'Jerez', 'jerez', 'Spain', 'Andalusia', NULL, '["Fortified"]', '["Palomino", "Pedro Ximénez"]', 'DO', NULL, '2026-02-01 16:59:36'),
(36, 'Napa Valley', 'napavalley', 'USA', 'California', NULL, '["Red", "White"]', '["Cabernet Sauvignon", "Chardonnay"]', 'AVA', NULL, '2026-02-01 16:59:36'),
(37, 'Sonoma County', 'sonomacounty', 'USA', 'California', NULL, '["Red", "White"]', '["Pinot Noir", "Chardonnay", "Zinfandel"]', 'AVA', NULL, '2026-02-01 16:59:36'),
(38, 'Willamette Valley', 'willamettevalley', 'USA', 'Oregon', NULL, '["Red", "White"]', '["Pinot Noir", "Pinot Gris"]', 'AVA', NULL, '2026-02-01 16:59:36'),
(39, 'Barossa Valley', 'barossavalley', 'Australia', 'South Australia', NULL, '["Red", "White"]', '["Shiraz", "Grenache", "Riesling"]', 'GI', NULL, '2026-02-01 16:59:36'),
(40, 'McLaren Vale', 'mclarenvale', 'Australia', 'South Australia', NULL, '["Red"]', '["Shiraz", "Grenache"]', 'GI', NULL, '2026-02-01 16:59:36'),
(41, 'Margaret River', 'margaretriver', 'Australia', 'Western Australia', NULL, '["Red", "White"]', '["Cabernet Sauvignon", "Chardonnay"]', 'GI', NULL, '2026-02-01 16:59:36'),
(42, 'Marlborough', 'marlborough', 'New Zealand', 'South Island', NULL, '["White"]', '["Sauvignon Blanc", "Pinot Noir"]', 'GI', NULL, '2026-02-01 16:59:36'),
(43, 'Central Otago', 'centralotago', 'New Zealand', 'South Island', NULL, '["Red"]', '["Pinot Noir"]', 'GI', NULL, '2026-02-01 16:59:36'),
(44, 'Mendoza', 'mendoza', 'Argentina', 'Mendoza', NULL, '["Red", "White"]', '["Malbec", "Torrontés"]', NULL, NULL, '2026-02-01 16:59:36'),
(45, 'Douro', 'douro', 'Portugal', 'Douro', NULL, '["Red", "Fortified"]', '["Touriga Nacional", "Tinta Roriz"]', 'DOC', NULL, '2026-02-01 16:59:36'),
(46, 'Mosel', 'mosel', 'Germany', 'Mosel', NULL, '["White"]', '["Riesling"]', 'QbA', NULL, '2026-02-01 16:59:36'),
(47, 'Rheingau', 'rheingau', 'Germany', 'Rheingau', NULL, '["White"]', '["Riesling"]', 'QbA', NULL, '2026-02-01 16:59:36');

-- =====================================================
-- Intensity Profiles (25 entries)
-- =====================================================

INSERT INTO `refIntensityProfiles` (`id`, `entityType`, `entityName`, `weight`, `richness`, `acidityNeed`, `tanninTolerance`, `sweetnessAffinity`, `createdAt`) VALUES
(1, 'food', 'Oysters', 0.15, 0.20, 0.90, 0.05, 0.10, '2026-02-01 16:59:36'),
(2, 'food', 'Grilled Steak', 0.85, 0.80, 0.40, 0.90, 0.05, '2026-02-01 16:59:36'),
(3, 'food', 'Roast Chicken', 0.50, 0.45, 0.60, 0.40, 0.15, '2026-02-01 16:59:36'),
(4, 'food', 'Salmon', 0.55, 0.60, 0.55, 0.30, 0.10, '2026-02-01 16:59:36'),
(5, 'food', 'Lobster', 0.45, 0.70, 0.65, 0.10, 0.15, '2026-02-01 16:59:36'),
(6, 'food', 'Lamb Chops', 0.75, 0.70, 0.50, 0.80, 0.05, '2026-02-01 16:59:36'),
(7, 'food', 'Duck Confit', 0.70, 0.85, 0.70, 0.50, 0.10, '2026-02-01 16:59:36'),
(8, 'food', 'Pork Belly', 0.65, 0.90, 0.80, 0.30, 0.20, '2026-02-01 16:59:36'),
(9, 'food', 'Mushroom Risotto', 0.55, 0.65, 0.50, 0.40, 0.10, '2026-02-01 16:59:36'),
(10, 'food', 'Grilled Vegetables', 0.35, 0.30, 0.60, 0.25, 0.15, '2026-02-01 16:59:36'),
(11, 'food', 'Foie Gras', 0.60, 0.95, 0.70, 0.10, 0.80, '2026-02-01 16:59:36'),
(12, 'food', 'Dark Chocolate', 0.50, 0.75, 0.30, 0.40, 0.90, '2026-02-01 16:59:36'),
(13, 'wine_type', 'Sparkling', 0.20, 0.25, NULL, NULL, NULL, '2026-02-01 16:59:36'),
(14, 'wine_type', 'White', 0.35, 0.40, NULL, NULL, NULL, '2026-02-01 16:59:36'),
(15, 'wine_type', 'Rosé', 0.40, 0.35, NULL, NULL, NULL, '2026-02-01 16:59:36'),
(16, 'wine_type', 'Red', 0.70, 0.65, NULL, NULL, NULL, '2026-02-01 16:59:36'),
(17, 'wine_type', 'Dessert', 0.55, 0.80, NULL, NULL, NULL, '2026-02-01 16:59:36'),
(18, 'wine_type', 'Fortified', 0.75, 0.85, NULL, NULL, NULL, '2026-02-01 16:59:36'),
(19, 'grape', 'Cabernet Sauvignon', 0.85, 0.75, NULL, NULL, NULL, '2026-02-01 16:59:36'),
(20, 'grape', 'Pinot Noir', 0.40, 0.45, NULL, NULL, NULL, '2026-02-01 16:59:36'),
(21, 'grape', 'Merlot', 0.65, 0.60, NULL, NULL, NULL, '2026-02-01 16:59:36'),
(22, 'grape', 'Syrah', 0.80, 0.70, NULL, NULL, NULL, '2026-02-01 16:59:36'),
(23, 'grape', 'Chardonnay', 0.55, 0.55, NULL, NULL, NULL, '2026-02-01 16:59:36'),
(24, 'grape', 'Sauvignon Blanc', 0.30, 0.25, NULL, NULL, NULL, '2026-02-01 16:59:36'),
(25, 'grape', 'Riesling', 0.25, 0.30, NULL, NULL, NULL, '2026-02-01 16:59:36');

-- =====================================================
-- Pairing Rules (58 hierarchical rules)
-- =====================================================

INSERT INTO `refPairingRules` (`id`, `foodCategory`, `foodSubcategory`, `foodItem`, `preparationMethod`, `wineTypes`, `wineStyles`, `grapeVarieties`, `avoidTypes`, `avoidStyles`, `specificity`, `reasoning`, `source`, `isActive`, `createdAt`) VALUES
(1, 'Seafood', NULL, NULL, NULL, '["Sparkling", "White"]', NULL, NULL, '["Red"]', NULL, 1, 'Light wines complement delicate seafood; tannins clash with fish oils', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(2, 'Red Meat', NULL, NULL, NULL, '["Red"]', NULL, NULL, NULL, NULL, 1, 'Tannins cut through fat and protein; fuller body matches meat weight', 'CMS', 1, '2026-02-01 16:59:36'),
(3, 'Poultry', NULL, NULL, NULL, '["White", "Rosé", "Red"]', NULL, NULL, NULL, NULL, 1, 'Versatile protein pairs widely depending on preparation', 'The Flavor Bible', 1, '2026-02-01 16:59:36'),
(4, 'Pork', NULL, NULL, NULL, '["White", "Rosé", "Red"]', NULL, NULL, NULL, NULL, 1, 'Medium weight protein pairs with lighter reds and fuller whites', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(5, 'Vegetarian', NULL, NULL, NULL, '["White", "Rosé", "Red"]', NULL, NULL, NULL, NULL, 1, 'Pair based on preparation method and dominant flavors', 'The Flavor Bible', 1, '2026-02-01 16:59:36'),
(6, 'Cheese', NULL, NULL, NULL, '["Red", "White", "Sparkling", "Dessert", "Fortified"]', NULL, NULL, NULL, NULL, 1, 'Match intensity of cheese with wine; contrast or complement flavors', 'CMS', 1, '2026-02-01 16:59:36'),
(7, 'Pasta', NULL, NULL, NULL, '["Red", "White"]', NULL, NULL, NULL, NULL, 1, 'Pair with sauce, not pasta itself', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(8, 'Desserts', NULL, NULL, NULL, '["Dessert", "Sparkling", "Fortified"]', NULL, NULL, '["Red"]', NULL, 1, 'Wine should be sweeter than the dessert', 'CMS', 1, '2026-02-01 16:59:36'),
(9, 'Seafood', 'Shellfish', NULL, NULL, '["Sparkling", "White"]', '["Brut", "Blanc de Blancs"]', '["Chardonnay", "Muscadet"]', '["Red"]', NULL, 2, 'High acid and mineral whites complement briny shellfish', 'CMS', 1, '2026-02-01 16:59:36'),
(10, 'Seafood', 'Shellfish', 'Oysters', 'raw', '["Sparkling", "White"]', '["Blanc de Blancs", "Muscadet", "Chablis"]', '["Chardonnay", "Melon de Bourgogne"]', '["Red"]', NULL, 4, 'Mineral, crisp wines echo ocean brininess; champagne bubbles cleanse', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(11, 'Seafood', 'Shellfish', 'Lobster', 'butter-poached', '["White", "Sparkling"]', '["Oaked Chardonnay"]', '["Chardonnay"]', NULL, NULL, 4, 'Rich buttery lobster matches rich buttery Chardonnay', 'CMS', 1, '2026-02-01 16:59:36'),
(12, 'Seafood', 'Shellfish', 'Crab', NULL, '["White", "Sparkling"]', '["Blanc de Blancs"]', '["Chardonnay", "Sauvignon Blanc"]', NULL, NULL, 3, 'Delicate sweet meat pairs with elegant whites', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(13, 'Seafood', 'Fish', 'Salmon', 'grilled', '["White", "Rosé", "Red"]', NULL, '["Pinot Noir", "Chardonnay"]', NULL, NULL, 3, 'Rich fatty fish handles medium-bodied Pinot Noir', 'CMS', 1, '2026-02-01 16:59:36'),
(14, 'Seafood', 'Fish', 'Salmon', 'smoked', '["Sparkling", "White"]', '["Brut Rosé"]', '["Chardonnay", "Pinot Noir"]', NULL, NULL, 4, 'Smoky richness pairs with toasty champagne', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(15, 'Seafood', 'Fish', 'Tuna', 'seared', '["Red", "Rosé"]', NULL, '["Pinot Noir", "Grenache"]', NULL, NULL, 3, 'Meaty tuna handles light reds served slightly cool', 'CMS', 1, '2026-02-01 16:59:36'),
(16, 'Seafood', 'Fish', NULL, 'fried', '["Sparkling", "White"]', '["Brut"]', '["Chardonnay", "Albariño"]', NULL, NULL, 3, 'High acid and bubbles cut through fried coating', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(17, 'Seafood', 'Fish', NULL, 'grilled', '["White"]', NULL, '["Sauvignon Blanc", "Vermentino", "Albariño"]', NULL, NULL, 2, 'Char notes pair with herbaceous whites', 'The Flavor Bible', 1, '2026-02-01 16:59:36'),
(18, 'Red Meat', 'Beef', NULL, NULL, '["Red"]', NULL, '["Cabernet Sauvignon", "Malbec", "Syrah"]', NULL, NULL, 2, 'Bold tannins and dark fruit complement beef richness', 'CMS', 1, '2026-02-01 16:59:36'),
(19, 'Red Meat', 'Beef', 'Steak', 'grilled', '["Red"]', NULL, '["Cabernet Sauvignon", "Malbec", "Syrah"]', NULL, NULL, 3, 'High tannin cuts through char and fat; dark fruit echoes Maillard', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(20, 'Red Meat', 'Beef', 'Filet Mignon', NULL, '["Red"]', NULL, '["Pinot Noir", "Merlot"]', NULL, NULL, 4, 'Leaner cut pairs with softer, more elegant reds', 'CMS', 1, '2026-02-01 16:59:36'),
(21, 'Red Meat', 'Beef', 'Ribeye', NULL, '["Red"]', NULL, '["Cabernet Sauvignon", "Malbec"]', NULL, NULL, 4, 'Fatty marbled cut needs high tannin wines', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(22, 'Red Meat', 'Beef', NULL, 'braised', '["Red"]', NULL, '["Nebbiolo", "Sangiovese", "Syrah"]', NULL, NULL, 3, 'Long-cooked beef pairs with structured, earthy wines', 'The Flavor Bible', 1, '2026-02-01 16:59:36'),
(23, 'Red Meat', 'Lamb', NULL, NULL, '["Red"]', NULL, '["Cabernet Sauvignon", "Syrah", "Tempranillo"]', NULL, NULL, 2, 'Lamb''s gaminess matches with structured, herbal reds', 'CMS', 1, '2026-02-01 16:59:36'),
(24, 'Red Meat', 'Lamb', 'Lamb Chops', 'herb-crusted', '["Red"]', NULL, '["Cabernet Sauvignon", "Syrah", "Tempranillo"]', NULL, NULL, 4, 'Herbal notes in wine complement herb crust', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(25, 'Red Meat', 'Lamb', 'Rack of Lamb', NULL, '["Red"]', '["Bordeaux", "Rioja"]', '["Cabernet Sauvignon", "Tempranillo"]', NULL, NULL, 4, 'Classic pairing with classic wine regions', 'CMS', 1, '2026-02-01 16:59:36'),
(26, 'Red Meat', 'Venison', NULL, NULL, '["Red"]', NULL, '["Pinot Noir", "Syrah"]', NULL, NULL, 2, 'Game meat pairs with earthy, forest-floor notes', 'The Flavor Bible', 1, '2026-02-01 16:59:36'),
(27, 'Poultry', 'Chicken', NULL, 'roasted', '["White", "Red"]', NULL, '["Chardonnay", "Pinot Noir"]', NULL, NULL, 2, 'Roast chicken is a bridge wine - works with both colors', 'CMS', 1, '2026-02-01 16:59:36'),
(28, 'Poultry', 'Chicken', NULL, 'fried', '["Sparkling", "Rosé"]', '["Brut"]', '["Chardonnay"]', NULL, NULL, 3, 'Bubbles and acid cut through crispy fried coating', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(29, 'Poultry', 'Chicken', NULL, 'grilled', '["White", "Rosé"]', NULL, '["Chardonnay", "Viognier"]', NULL, NULL, 2, 'Char complements fuller bodied whites', 'The Flavor Bible', 1, '2026-02-01 16:59:36'),
(30, 'Poultry', 'Duck', NULL, NULL, '["Red"]', '["Burgundy"]', '["Pinot Noir"]', NULL, NULL, 2, 'Rich duck fat pairs perfectly with Pinot Noir acidity', 'CMS', 1, '2026-02-01 16:59:36'),
(31, 'Poultry', 'Duck', 'Duck Confit', NULL, '["Red"]', NULL, '["Pinot Noir", "Grenache"]', NULL, NULL, 4, 'Fat-rich confit needs high acid red wines', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(32, 'Poultry', 'Turkey', NULL, NULL, '["White", "Red", "Rosé"]', NULL, '["Pinot Noir", "Zinfandel", "Riesling"]', NULL, NULL, 2, 'Thanksgiving turkey pairs with fruit-forward wines', 'The Flavor Bible', 1, '2026-02-01 16:59:36'),
(33, 'Pork', 'Pork', 'Pork Chops', 'grilled', '["White", "Red"]', NULL, '["Chardonnay", "Pinot Noir"]', NULL, NULL, 3, 'Grilled pork matches oaked Chardonnay or light reds', 'CMS', 1, '2026-02-01 16:59:36'),
(34, 'Pork', 'Pork', 'Pork Belly', NULL, '["White", "Sparkling"]', NULL, '["Riesling", "Gewürztraminer"]', NULL, NULL, 4, 'Fat-rich belly needs high acid to cut through', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(35, 'Pork', 'Pork', 'Prosciutto', NULL, '["Sparkling", "White"]', '["Prosecco"]', '["Glera", "Pinot Grigio"]', NULL, NULL, 4, 'Salty cured ham pairs with light bubbles', 'CMS', 1, '2026-02-01 16:59:36'),
(36, 'Pork', 'Pork', 'Bacon', NULL, '["Red", "Sparkling"]', NULL, '["Pinot Noir", "Chardonnay"]', NULL, NULL, 3, 'Smoky bacon pairs with earthy Pinot or toasty sparkling', 'The Flavor Bible', 1, '2026-02-01 16:59:36'),
(37, 'Cheese', 'Soft', NULL, NULL, '["Sparkling", "White"]', '["Champagne"]', '["Chardonnay"]', NULL, NULL, 2, 'Creamy cheeses pair with high-acid wines', 'CMS', 1, '2026-02-01 16:59:36'),
(38, 'Cheese', 'Soft', 'Brie', NULL, '["Sparkling", "White"]', '["Champagne", "Blanc de Blancs"]', '["Chardonnay"]', NULL, NULL, 3, 'Bubbles cut through creamy Brie texture', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(39, 'Cheese', 'Soft', 'Camembert', NULL, '["Sparkling", "Red"]', '["Champagne"]', '["Chardonnay", "Pinot Noir"]', NULL, NULL, 3, 'Earthy Camembert pairs with earthy Pinot', 'The Flavor Bible', 1, '2026-02-01 16:59:36'),
(40, 'Cheese', 'Hard', NULL, NULL, '["Red"]', NULL, '["Cabernet Sauvignon", "Tempranillo"]', NULL, NULL, 2, 'Aged hard cheeses match tannic reds', 'CMS', 1, '2026-02-01 16:59:36'),
(41, 'Cheese', 'Hard', 'Parmigiano-Reggiano', NULL, '["Red", "Sparkling"]', '["Lambrusco"]', '["Sangiovese"]', NULL, NULL, 4, 'Italian cheese with Italian wine - classic pairing', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(42, 'Cheese', 'Hard', 'Manchego', NULL, '["Red"]', '["Rioja"]', '["Tempranillo"]', NULL, NULL, 4, 'Spanish cheese with Spanish wine', 'CMS', 1, '2026-02-01 16:59:36'),
(43, 'Cheese', 'Blue', NULL, NULL, '["Dessert", "Fortified"]', '["Sauternes", "Port"]', NULL, NULL, NULL, 2, 'Sweet wines balance salty, pungent blue cheese', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(44, 'Cheese', 'Blue', 'Roquefort', NULL, '["Dessert"]', '["Sauternes"]', '["Semillon", "Sauvignon Blanc"]', NULL, NULL, 4, 'Classic French pairing: sweet Sauternes with salty Roquefort', 'CMS', 1, '2026-02-01 16:59:36'),
(45, 'Cheese', 'Blue', 'Stilton', NULL, '["Fortified"]', '["Vintage Port"]', NULL, NULL, NULL, 4, 'Classic British pairing after dinner', 'The Flavor Bible', 1, '2026-02-01 16:59:36'),
(46, 'Cheese', 'Goat', NULL, NULL, '["White"]', NULL, '["Sauvignon Blanc"]', NULL, NULL, 2, 'High acid wine matches tangy goat cheese', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(47, 'Cheese', 'Goat', 'Chèvre', NULL, '["White"]', '["Sancerre", "Pouilly-Fumé"]', '["Sauvignon Blanc"]', NULL, NULL, 4, 'Loire Valley classic - local cheese with local wine', 'CMS', 1, '2026-02-01 16:59:36'),
(48, 'Pasta', NULL, NULL, 'tomato-based', '["Red"]', NULL, '["Sangiovese", "Barbera"]', NULL, NULL, 2, 'Italian wines with Italian food; acidity matches tomato', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(49, 'Pasta', NULL, NULL, 'cream-based', '["White"]', NULL, '["Chardonnay"]', NULL, NULL, 2, 'Rich cream sauce matches rich buttery Chardonnay', 'CMS', 1, '2026-02-01 16:59:36'),
(50, 'Pasta', NULL, NULL, 'pesto', '["White"]', NULL, '["Vermentino", "Sauvignon Blanc"]', NULL, NULL, 3, 'Herbaceous wine matches herbaceous pesto', 'The Flavor Bible', 1, '2026-02-01 16:59:36'),
(51, 'Pasta', NULL, 'Carbonara', NULL, '["White"]', NULL, '["Chardonnay", "Pinot Grigio"]', NULL, NULL, 4, 'Egg and cheese richness needs crisp white', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(52, 'Pasta', NULL, 'Bolognese', NULL, '["Red"]', NULL, '["Sangiovese"]', NULL, NULL, 4, 'Classic ragù pairs with Chianti Classico', 'CMS', 1, '2026-02-01 16:59:36'),
(53, 'Desserts', 'Chocolate', NULL, NULL, '["Fortified", "Red"]', '["Port", "Banyuls"]', NULL, NULL, NULL, 2, 'Dark chocolate needs sweet fortified wines', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(54, 'Desserts', 'Chocolate', 'Dark Chocolate', NULL, '["Fortified"]', '["Vintage Port", "Banyuls"]', NULL, NULL, NULL, 4, 'Intense cocoa matches intense Port', 'CMS', 1, '2026-02-01 16:59:36'),
(55, 'Desserts', 'Fruit', NULL, NULL, '["Dessert", "Sparkling"]', '["Moscato d''Asti"]', '["Muscat"]', NULL, NULL, 2, 'Light fruity desserts pair with light sweet wines', 'The Flavor Bible', 1, '2026-02-01 16:59:36'),
(56, 'Desserts', 'Fruit', 'Apple Tart', NULL, '["Dessert"]', '["Late Harvest Riesling"]', '["Riesling"]', NULL, NULL, 4, 'Apple in wine mirrors apple in tart', 'Wine Folly', 1, '2026-02-01 16:59:36'),
(57, 'Desserts', 'Custard', NULL, NULL, '["Dessert"]', '["Sauternes", "Tokaji"]', '["Semillon"]', NULL, NULL, 3, 'Rich custard matches rich botrytis wines', 'CMS', 1, '2026-02-01 16:59:36'),
(58, 'Desserts', 'Custard', 'Crème Brûlée', NULL, '["Dessert"]', '["Sauternes"]', '["Semillon", "Sauvignon Blanc"]', NULL, NULL, 4, 'Caramelized sugar pairs with honeyed Sauternes', 'Wine Folly', 1, '2026-02-01 16:59:36');

-- =====================================================
-- Wine Styles (30 styles)
-- =====================================================

INSERT INTO `refWineStyles` (`id`, `styleName`, `wineType`, `description`, `characteristics`, `typicalGrapes`, `typicalRegions`, `servingTemp`, `createdAt`) VALUES
(1, 'Blanc de Blancs', 'Sparkling', 'White sparkling wine made exclusively from white grapes, typically Chardonnay', '{"body": "light", "acidity": "high", "sweetness": "dry", "bubbles": "fine"}', '["Chardonnay"]', '["Champagne", "California", "England"]', '6-8°C', '2026-02-01 16:59:36'),
(2, 'Blanc de Noirs', 'Sparkling', 'White sparkling wine made from red grapes (Pinot Noir and/or Pinot Meunier)', '{"body": "medium", "acidity": "high", "sweetness": "dry", "bubbles": "fine"}', '["Pinot Noir", "Pinot Meunier"]', '["Champagne"]', '6-8°C', '2026-02-01 16:59:36'),
(3, 'Brut', 'Sparkling', 'Dry sparkling wine with minimal residual sugar (less than 12g/L)', '{"body": "light", "acidity": "high", "sweetness": "dry", "bubbles": "fine"}', '["Chardonnay", "Pinot Noir", "Pinot Meunier"]', '["Champagne", "Cava", "Franciacorta"]', '6-8°C', '2026-02-01 16:59:36'),
(4, 'Brut Nature', 'Sparkling', 'Bone-dry sparkling wine with no dosage added (less than 3g/L sugar)', '{"body": "light", "acidity": "very high", "sweetness": "bone-dry", "bubbles": "fine"}', '["Chardonnay", "Pinot Noir"]', '["Champagne"]', '6-8°C', '2026-02-01 16:59:36'),
(5, 'Brut Rosé', 'Sparkling', 'Dry pink sparkling wine, made by blending or maceration', '{"body": "light", "acidity": "high", "sweetness": "dry", "bubbles": "fine"}', '["Pinot Noir", "Chardonnay"]', '["Champagne", "Franciacorta"]', '6-8°C', '2026-02-01 16:59:36'),
(6, 'Prosecco', 'Sparkling', 'Italian sparkling wine made from Glera grape using tank method', '{"body": "light", "acidity": "medium", "sweetness": "off-dry", "bubbles": "frothy"}', '["Glera"]', '["Veneto", "Friuli"]', '6-8°C', '2026-02-01 16:59:36'),
(7, 'Cava', 'Sparkling', 'Spanish sparkling wine made using traditional method', '{"body": "light", "acidity": "high", "sweetness": "dry", "bubbles": "fine"}', '["Macabeo", "Parellada", "Xarel-lo"]', '["Penedès", "Catalunya"]', '6-8°C', '2026-02-01 16:59:36'),
(8, 'Oaked Chardonnay', 'White', 'Full-bodied white wine aged in oak barrels with MLF', '{"body": "full", "acidity": "medium", "sweetness": "dry", "oak": "heavy"}', '["Chardonnay"]', '["Burgundy", "California", "Australia"]', '10-13°C', '2026-02-01 16:59:36'),
(9, 'Unoaked Chardonnay', 'White', 'Crisp, fruit-forward white without oak influence', '{"body": "medium", "acidity": "medium-high", "sweetness": "dry", "oak": "none"}', '["Chardonnay"]', '["Chablis", "Chile", "New Zealand"]', '8-10°C', '2026-02-01 16:59:36'),
(10, 'Crisp White', 'White', 'High-acid, refreshing white wine with citrus and green notes', '{"body": "light", "acidity": "high", "sweetness": "dry"}', '["Sauvignon Blanc", "Albariño", "Muscadet"]', '["Loire Valley", "New Zealand", "Galicia"]', '6-8°C', '2026-02-01 16:59:36'),
(11, 'Aromatic White', 'White', 'Intensely perfumed white wine with floral and fruit aromas', '{"body": "light to medium", "acidity": "medium", "sweetness": "off-dry to sweet"}', '["Gewürztraminer", "Muscat", "Torrontés"]', '["Alsace", "Germany", "Argentina"]', '8-10°C', '2026-02-01 16:59:36'),
(12, 'Rich White', 'White', 'Full-bodied white with weight and texture', '{"body": "full", "acidity": "medium-low", "sweetness": "dry"}', '["Viognier", "Marsanne", "Roussanne"]', '["Rhône Valley", "California"]', '10-12°C', '2026-02-01 16:59:36'),
(13, 'Light Red', 'Red', 'Delicate red wine with soft tannins and bright fruit', '{"body": "light", "tannin": "low", "acidity": "high", "sweetness": "dry"}', '["Pinot Noir", "Gamay", "Schiava"]', '["Burgundy", "Beaujolais", "Alto Adige"]', '14-16°C', '2026-02-01 16:59:36'),
(14, 'Medium Red', 'Red', 'Balanced red with moderate tannins and fruit', '{"body": "medium", "tannin": "medium", "acidity": "medium", "sweetness": "dry"}', '["Merlot", "Sangiovese", "Grenache"]', '["Bordeaux", "Tuscany", "Rhône"]', '16-18°C', '2026-02-01 16:59:36'),
(15, 'Full-Bodied Red', 'Red', 'Powerful red with firm tannins and concentrated fruit', '{"body": "full", "tannin": "high", "acidity": "medium", "sweetness": "dry"}', '["Cabernet Sauvignon", "Syrah", "Nebbiolo"]', '["Napa Valley", "Barossa", "Piedmont"]', '17-19°C', '2026-02-01 16:59:36'),
(16, 'Bordeaux Blend', 'Red', 'Classic blend dominated by Cabernet Sauvignon or Merlot', '{"body": "full", "tannin": "high", "acidity": "medium", "sweetness": "dry"}', '["Cabernet Sauvignon", "Merlot", "Cabernet Franc"]', '["Bordeaux", "Napa Valley", "Chile"]', '17-18°C', '2026-02-01 16:59:36'),
(17, 'Rhône Blend', 'Red', 'Southern Rhône style blend based on Grenache', '{"body": "medium-full", "tannin": "medium", "acidity": "medium", "sweetness": "dry"}', '["Grenache", "Syrah", "Mourvèdre"]', '["Châteauneuf-du-Pape", "Gigondas", "Australia"]', '16-18°C', '2026-02-01 16:59:36'),
(18, 'Super Tuscan', 'Red', 'Tuscan wine blending Italian and international varieties', '{"body": "full", "tannin": "high", "acidity": "medium-high", "sweetness": "dry"}', '["Sangiovese", "Cabernet Sauvignon", "Merlot"]', '["Tuscany"]', '17-18°C', '2026-02-01 16:59:36'),
(19, 'Provence Rosé', 'Rosé', 'Pale, dry rosé with delicate flavors', '{"body": "light", "acidity": "high", "sweetness": "dry"}', '["Grenache", "Cinsault", "Mourvèdre"]', '["Provence"]', '8-10°C', '2026-02-01 16:59:36'),
(20, 'Tavel', 'Rosé', 'Fuller-bodied, more structured rosé', '{"body": "medium", "acidity": "medium", "sweetness": "dry"}', '["Grenache", "Cinsault"]', '["Tavel", "Rhône"]', '10-12°C', '2026-02-01 16:59:36'),
(21, 'Late Harvest', 'Dessert', 'Sweet wine from late-picked grapes with concentrated sugar', '{"body": "medium", "acidity": "high", "sweetness": "sweet"}', '["Riesling", "Gewürztraminer", "Semillon"]', '["Alsace", "Germany", "California"]', '6-8°C', '2026-02-01 16:59:36'),
(22, 'Botrytis', 'Dessert', 'Sweet wine from grapes affected by noble rot', '{"body": "full", "acidity": "high", "sweetness": "very sweet"}', '["Semillon", "Sauvignon Blanc", "Furmint"]', '["Sauternes", "Tokaji", "Loire"]', '6-8°C', '2026-02-01 16:59:36'),
(23, 'Ice Wine', 'Dessert', 'Sweet wine from grapes frozen on the vine', '{"body": "medium", "acidity": "very high", "sweetness": "very sweet"}', '["Riesling", "Vidal"]', '["Canada", "Germany"]', '6-8°C', '2026-02-01 16:59:36'),
(24, 'Vintage Port', 'Fortified', 'Aged vintage port from a single year', '{"body": "full", "tannin": "high", "sweetness": "sweet", "fortified": true}', '["Touriga Nacional", "Tinta Roriz", "Touriga Franca"]', '["Douro"]', '16-18°C', '2026-02-01 16:59:36'),
(25, 'Tawny Port', 'Fortified', 'Barrel-aged port with oxidative character', '{"body": "medium", "sweetness": "sweet", "fortified": true}', '["Touriga Nacional", "Tinta Roriz"]', '["Douro"]', '12-14°C', '2026-02-01 16:59:36'),
(26, 'Fino Sherry', 'Fortified', 'Dry, pale sherry aged under flor', '{"body": "light", "acidity": "high", "sweetness": "dry", "fortified": true}', '["Palomino"]', '["Jerez"]', '7-9°C', '2026-02-01 16:59:36'),
(27, 'Amontillado', 'Fortified', 'Sherry aged under flor then oxidatively', '{"body": "medium", "acidity": "medium", "sweetness": "dry", "fortified": true}', '["Palomino"]', '["Jerez"]', '12-14°C', '2026-02-01 16:59:36'),
(28, 'Oloroso', 'Fortified', 'Rich, oxidatively aged dry sherry', '{"body": "full", "acidity": "medium", "sweetness": "dry", "fortified": true}', '["Palomino"]', '["Jerez"]', '12-14°C', '2026-02-01 16:59:36'),
(29, 'PX Sherry', 'Fortified', 'Intensely sweet sherry from dried Pedro Ximénez grapes', '{"body": "full", "sweetness": "very sweet", "fortified": true}', '["Pedro Ximénez"]', '["Jerez", "Montilla-Moriles"]', '12-14°C', '2026-02-01 16:59:36'),
(30, 'Moscato d''Asti', 'Sparkling', 'Lightly sparkling, low-alcohol sweet wine from Piedmont', '{"body": "light", "acidity": "medium", "sweetness": "sweet", "bubbles": "gentle"}', '["Muscat"]', '["Piedmont"]', '5-7°C', '2026-02-01 16:59:36');

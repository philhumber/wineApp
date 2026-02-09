-- Seed Data Expansion: Grapes, Countries, Regions
-- Adds wine-context columns to country table and populates reference data
--
-- NOTE: This migration is designed for an EXISTING database with populated
-- country/region tables. For fresh installs, use agent_seed_data.sql instead.
--
-- Verification:
--   SELECT COUNT(*) FROM grapes;                       -- expect ~42+
--   SELECT COUNT(*) FROM country WHERE wineHistory IS NOT NULL;  -- expect 33
--   SELECT COUNT(*) FROM region;                       -- expect 46+ (existing + new)

SET NAMES utf8mb4;

-- =====================================================
-- Step 1: ALTER country table - add wine-context columns
-- =====================================================

ALTER TABLE `country`
  ADD COLUMN `wineHistory` text DEFAULT NULL COMMENT 'Brief history of winemaking in this country',
  ADD COLUMN `classificationSystem` text DEFAULT NULL COMMENT 'Wine classification system (AOC, DOC, AVA, etc.)',
  ADD COLUMN `keyGrapes` json DEFAULT NULL COMMENT 'Primary grape varieties JSON array',
  ADD COLUMN `totalVineyardHectares` int DEFAULT NULL COMMENT 'Total vineyard area (OIV data)',
  ADD COLUMN `wineRankingWorld` tinyint DEFAULT NULL COMMENT 'Global production ranking';

-- =====================================================
-- Step 2: Grape varieties (39 new, no explicit IDs)
-- INSERT IGNORE skips on UNIQUE grapeName constraint
-- =====================================================

INSERT IGNORE INTO `grapes` (`grapeName`, `description`, `picture`) VALUES
('Cabernet Sauvignon', 'Cabernet Sauvignon is the world''s most widely planted red grape variety, producing full-bodied wines with firm tannins, deep color, and aromas of blackcurrant, cedar, and tobacco. A natural cross of Cabernet Franc and Sauvignon Blanc, it thrives in warm climates and is the backbone of Bordeaux''s Left Bank blends, as well as iconic wines from Napa Valley, Chile, and Australia.', 'https://upload.wikimedia.org/wikipedia/commons/3/36/Cabernet_Sauvignon_Gaillac.jpg'),
('Merlot', 'Merlot is a soft, plummy red grape that produces approachable, medium to full-bodied wines with velvety tannins and flavors of plum, cherry, chocolate, and herbs. It is the dominant grape in Bordeaux''s Right Bank appellations like Pomerol and Saint-Émilion, and is widely planted worldwide for both single-varietal wines and blends.', 'https://upload.wikimedia.org/wikipedia/commons/0/0d/Merlot_grape_cluster.jpg'),
('Syrah', 'Syrah (known as Shiraz in Australia) produces bold, deeply colored red wines with flavors of blackberry, pepper, smoke, and meat. It is the sole red grape of the Northern Rhône''s prestigious appellations like Hermitage and Côte-Rôtie, and in Australia''s Barossa Valley it produces rich, fruit-forward wines with chocolate and spice notes.', 'https://upload.wikimedia.org/wikipedia/commons/5/5d/Syrah_grape.jpg'),
('Tempranillo', 'Tempranillo is Spain''s most important red grape, producing medium to full-bodied wines with flavors of cherry, leather, tobacco, and dried fig. Known as Tinto Fino in Ribera del Duero and Tinta Roriz in Portugal, it is the backbone of Rioja and ages exceptionally well in both American and French oak, developing complex vanilla and spice notes.', 'https://upload.wikimedia.org/wikipedia/commons/0/03/Tempranillo.jpg'),
('Sangiovese', 'Sangiovese is Italy''s most planted red grape and the soul of Tuscan winemaking, producing wines with bright cherry, tomato leaf, tea, and herbal flavors alongside firm acidity. Known as Brunello in Montalcino and Prugnolo Gentile in Montepulciano, it is the primary grape in Chianti Classico, Brunello di Montalcino, and Vino Nobile.', 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Sangiovese_di_Romagna.jpg'),
('Nebbiolo', 'Nebbiolo is a noble Italian red grape that produces powerful, long-lived wines with high tannins, high acidity, and complex aromas of cherry, rose, tar, and truffle. Despite its pale garnet color, it is intensely structured and is the sole grape behind Barolo and Barbaresco, two of Italy''s most celebrated and age-worthy wines.', 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Nebbiolo.jpg'),
('Grenache', 'Grenache (Garnacha in Spain, Cannonau in Sardinia) is a heat-loving red grape that produces generous, fruit-forward wines with flavors of raspberry, strawberry, white pepper, and herbs. It is the most planted grape in the Southern Rhône and a key component of Châteauneuf-du-Pape blends, and in Spain it excels in Priorat''s old-vine bottlings.', 'https://upload.wikimedia.org/wikipedia/commons/5/58/Grenache_noir.jpg'),
('Malbec', 'Malbec is a deeply colored red grape originally from Cahors, France, that found its modern identity in Argentina''s Mendoza region, where it produces plush, velvety wines with intense flavors of plum, blackberry, violet, and cocoa. It thrives at high altitude where UV intensity concentrates color and flavor, making Argentine Malbec one of the world''s most recognizable wine styles.', 'https://upload.wikimedia.org/wikipedia/commons/8/87/Malbec_-_C%C3%B4t.jpg'),
('Zinfandel', 'Zinfandel (known as Primitivo in southern Italy) is a versatile red grape that produces bold, jammy wines with flavors of blackberry, raspberry, pepper, and licorice. It is California''s heritage grape, with some old vines dating back over 100 years, producing concentrated, high-alcohol wines that range from fruit-forward everyday reds to complex, age-worthy bottlings.', 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Zinfandel_grapes.jpg'),
('Cabernet Franc', 'Cabernet Franc is an aromatic red grape that produces medium-bodied wines with flavors of raspberry, bell pepper, violet, and graphite alongside moderate tannins. A parent of Cabernet Sauvignon, it shines as a varietal wine in the Loire Valley''s Chinon and Bourgueil, and plays a crucial blending role in Bordeaux, particularly on the Right Bank in Saint-Émilion.', 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Cabernet_Franc_Grape.jpg'),
('Mourvèdre', 'Mourvèdre (Monastrell in Spain, Mataro in Australia) is a thick-skinned, late-ripening red grape that produces deeply colored, tannic wines with flavors of blackberry, earth, game, and black pepper. It requires significant heat to ripen fully and is a key blending partner in Southern Rhône GSM blends and Bandol, where it contributes structure and meaty complexity.', 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Mourvedre_grapevine.jpg'),
('Petit Verdot', 'Petit Verdot is a late-ripening red grape used primarily as a seasoning grape in Bordeaux blends, contributing deep color, firm tannins, and violet, blueberry, and sage aromatics. While rarely bottled as a varietal in France due to ripening difficulties, it excels in warmer New World climates like Spain, Australia, and Virginia, where it can fully mature.', 'https://upload.wikimedia.org/wikipedia/commons/3/31/Petit_Verdot.jpg'),
('Barbera', 'Barbera is a high-acid, low-tannin red grape from Piedmont that produces vibrant, food-friendly wines with flavors of cherry, plum, herbs, and dried flowers. It is Italy''s third most planted red grape and thrives in the Asti and Alba zones, where modern winemaking and oak aging have elevated it from a simple everyday wine to a serious, age-worthy bottling.', 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Barbera_grapes.jpg'),
('Dolcetto', 'Dolcetto is an early-ripening Piedmontese red grape that produces soft, fruity wines with flavors of black cherry, licorice, prune, and almond. Its name means "little sweet one" referring to the grape''s sweetness at harvest, though the wines ferment dry with gentle tannins and low acidity, making them ideal everyday drinking companions to Italian cuisine.', 'https://upload.wikimedia.org/wikipedia/commons/d/dc/Dolcetto_Vitigno.jpg'),
('Sauvignon Blanc', 'Sauvignon Blanc is an aromatic white grape known for its pungent, refreshing wines with flavors of grapefruit, grass, green apple, and gooseberry. It is the signature grape of the Loire Valley''s Sancerre and Pouilly-Fumé as well as New Zealand''s Marlborough region, and contributes crisp acidity and herbaceous character to both varietal wines and Bordeaux white blends.', 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Sauvignon_blanc_grapes.jpg'),
('Riesling', 'Riesling is one of the world''s great aromatic white grapes, capable of producing wines across the entire sweetness spectrum from bone-dry to lusciously sweet. It is defined by its piercing acidity, floral and stone fruit aromatics, and remarkable ability to reflect terroir, excelling in cool-climate regions like Germany''s Mosel, Alsace, and Australia''s Clare Valley, where it develops characteristic petrol and slate notes with age.', 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Riesling_grapes_leaves.jpg'),
('Pinot Grigio', 'Pinot Grigio (Pinot Gris in Alsace) is a mutation of Pinot Noir with grayish-pink skins that produces wines ranging from light and crisp (Italian style) to rich and honeyed (Alsatian style). In northern Italy, it is vinified for freshness with lemon, green apple, and almond flavors, while in Alsace it produces fuller-bodied wines with stone fruit, honey, and ginger notes.', 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Pinot_gris_leaves_and_grape_cluster.jpg'),
('Gewürztraminer', 'Gewürztraminer is an intensely aromatic white grape with distinctive pink-hued skins, producing full-bodied, low-acid wines with exotic flavors of lychee, rose, ginger, and tropical fruit. It is the signature grape of Alsace, where it reaches its fullest expression, and is also grown successfully in Germany, northern Italy, and New Zealand.', 'https://upload.wikimedia.org/wikipedia/commons/f/fe/Gewuerztraminer_Weinsberg_20070925.jpg'),
('Viognier', 'Viognier is a richly perfumed white grape producing full-bodied wines with heady aromas of peach, apricot, tangerine, and honeysuckle. Once nearly extinct and confined to the Northern Rhône''s tiny Condrieu appellation, it has been widely replanted worldwide and is sometimes co-fermented with Syrah to add aromatics and stabilize color.', 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Viognier.jpg'),
('Chenin Blanc', 'Chenin Blanc is an extraordinarily versatile white grape with naturally high acidity, capable of producing everything from bone-dry minerally wines to rich botrytized dessert wines and fine sparkling wines. It is the star of the Loire Valley''s Vouvray and Savennières appellations, and in South Africa (where it is called Steen) it is the most widely planted variety.', 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Chenin_Blanc_grapes.jpg'),
('Albariño', 'Albariño (Alvarinho in Portugal) is a thick-skinned, aromatic white grape from the Atlantic coast of Iberia that produces refreshing wines with flavors of lemon, grapefruit, peach, and a distinctive saline minerality. It is the premier grape of Spain''s Rías Baixas region and Portugal''s Vinho Verde, where the maritime climate preserves its vibrant acidity and seafood-friendly character.', 'https://upload.wikimedia.org/wikipedia/commons/e/e2/Albari%C3%B1o_grape.jpg'),
('Grüner Veltliner', 'Grüner Veltliner is Austria''s signature white grape, covering roughly a third of the country''s vineyards and producing wines that range from light, peppery everyday wines to concentrated, age-worthy grand cru bottlings. Its distinctive white pepper spice, green apple crunch, and herbal character make it one of the most food-versatile white wines in the world.', 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Gr%C3%BCner_Veltliner_Traube.jpg'),
('Muscadet', 'Muscadet, properly known as Melon de Bourgogne, is a neutral white grape that produces lean, mineral-driven wines with flavors of lemon, green apple, and chalk. Grown almost exclusively around the city of Nantes at the western end of the Loire Valley, it undergoes sur lie aging (on its yeast lees) which adds a creamy texture and subtle brioche notes that perfectly complement oysters and shellfish.', 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Melon_de_Bourgogne.jpg'),
('Torrontés', 'Torrontés is Argentina''s signature white grape, producing highly aromatic wines with perfumed flavors of peach, rose, geranium, and citrus that evoke Muscat-like intensity while finishing dry and refreshing. It thrives at high altitude in the northwestern Salta and Cafayate regions, where dramatic day-night temperature swings preserve its natural acidity and aromatic purity.', 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Torront%C3%A9s_grape.jpg'),
('Sémillon', 'Sémillon is a golden-skinned white grape that produces both dry and sweet wines of remarkable complexity and longevity. It is the primary grape in Sauternes'' legendary botrytized dessert wines and, in Australia''s Hunter Valley, it produces uniquely lean, unoaked dry wines that develop extraordinary honey, toast, and citrus complexity with decades of bottle age.', 'https://upload.wikimedia.org/wikipedia/commons/f/f8/Semillon_blanc.jpg'),
('Vermentino', 'Vermentino (known as Rolle in Provence and Pigato in Liguria) is a Mediterranean white grape producing crisp, refreshing wines with flavors of lime, grapefruit, green apple, and a distinctive herbal, saline character. It thrives in coastal regions of Sardinia, Corsica, Provence, and Liguria, where sea breezes and poor soils concentrate its bright, mineral-driven personality.', 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Vermentino_grape.jpg'),
('Grenache Rosé', 'Grenache Rosé is a pink-berried mutation of Grenache Noir that is particularly prized for producing high-quality rosé wines with delicate flavors of strawberry, watermelon, rose petal, and citrus. It is a key component of Provence rosé blends and is also used as a varietal wine, where its light body and moderate acidity create elegant, refreshing wines.', ''),
('Gamay', 'Gamay is a fruity, light-bodied red grape that is the sole variety behind Beaujolais and its famous cru wines. It thrives on the granite soils of Beaujolais, where it produces juicy, aromatic wines with bright cherry, raspberry, and floral flavors, low tannins, and a distinctive pepperiness, often vinified using carbonic maceration for immediate, exuberant drinkability.', 'https://upload.wikimedia.org/wikipedia/commons/4/40/Gamay.png'),
('Cinsault', 'Cinsault (sometimes spelled Cinsaut) is a heat-resistant red grape widely grown in southern France and South Africa, producing light, aromatic wines with soft tannins and flavors of red berries, herbs, and spice. It is a key blending grape in Provence rosé and Southern Rhône reds, and in South Africa it was crossed with Pinot Noir to create the Pinotage variety.', 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Cinsaut_grapevine.jpg'),
('Corvina', 'Corvina is the principal red grape of the Veneto''s Valpolicella zone, producing wines with distinctive sour cherry, almond, and herbal flavors alongside moderate tannins. It is the backbone of both fresh Valpolicella and the dried-grape Amarone della Valpolicella, where the appassimento process concentrates its fruit into rich, raisiny, high-alcohol wines of remarkable depth.', 'https://upload.wikimedia.org/wikipedia/commons/7/72/Corvina_Veronese.jpg'),
('Rondinella', 'Rondinella is a red blending grape from the Veneto used alongside Corvina in Valpolicella and Amarone wines. It contributes color, body, and neutral fruit character to the blend, and its thick skins make it well-suited to the appassimento drying process used in Amarone production.', ''),
('Molinara', 'Molinara is a light-skinned red grape traditionally used in small amounts in Valpolicella and Amarone blends from the Veneto. Named for its flour-dusted appearance (from the Italian ''mulino'' meaning mill), it contributes acidity and lightness to blends, though its role has diminished in favor of Corvina and Rondinella.', ''),
('Garganega', 'Garganega is the principal white grape of the Veneto, best known as the primary variety in Soave, where it produces elegant wines with flavors of white peach, almond, citrus, and a distinctive mineral undertone. It is a vigorous, late-ripening variety that benefits from careful yield management, with the best examples from volcanic soils showing fine texture and excellent aging potential.', 'https://upload.wikimedia.org/wikipedia/commons/7/72/Garganega.jpg'),
('Glera', 'Glera is the grape behind Prosecco, Italy''s beloved sparkling wine from the Veneto and Friuli regions. It produces light, aromatic wines with flavors of green apple, pear, white flowers, and a gentle frothy sparkle, vinified using the Charmat (tank) method to preserve its fresh, fruity character rather than the yeasty complexity of bottle-fermented sparkling wines.', 'https://upload.wikimedia.org/wikipedia/commons/7/7d/Glera_grapes.jpg'),
('Touriga Nacional', 'Touriga Nacional is Portugal''s most prestigious red grape, producing deeply colored, intensely aromatic wines with concentrated flavors of blackberry, violet, dark chocolate, and resinous herbs. It is the finest component in Port blends from the Douro Valley and increasingly valued as a dry table wine grape, producing structured, age-worthy wines throughout Portugal.', 'https://upload.wikimedia.org/wikipedia/commons/e/e9/Touriga_Nacional.jpg'),
('Touriga Franca', 'Touriga Franca is the most widely planted red grape in Portugal''s Douro Valley, valued for its consistency, generous fruit, and aromatic contribution to Port and dry table wine blends. It produces perfumed wines with flavors of wild berries, rose petals, and spice, with softer tannins than Touriga Nacional, making it an essential blending partner.', ''),
('Macabeo', 'Macabeo (known as Viura in Rioja) is a white grape widely planted across Spain, where it is the primary variety in Cava sparkling wine and white Rioja. It produces neutral, mild wines with moderate acidity and flavors of green apple, chamomile, and light floral notes, serving as an excellent base for both sparkling wine production and oak-aged white styles.', 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Macabeo.jpg'),
('Parellada', 'Parellada is a delicate, high-altitude white grape from Catalonia that is one of the three traditional Cava grapes alongside Macabeo and Xarel-lo. It contributes floral aromatics, light body, and refreshing acidity to Cava blends, and is the most altitude-sensitive of the trio, producing its finest fruit above 500 meters in Penedès.', ''),
('Xarel-lo', 'Xarel-lo is a robust, characterful white grape native to Catalonia and one of the three traditional Cava grapes, where it contributes body, structure, and earthy, herbal complexity to blends. Increasingly bottled as a varietal still wine, it produces textured whites with flavors of apple, fennel, and Mediterranean herbs, reflecting its warm-climate coastal terroir.', '');

-- =====================================================
-- Step 3: UPDATE existing countries with wine data
-- Uses ISO country code for reliable matching
-- =====================================================

UPDATE `country` SET
  wineHistory = 'France has been at the centre of the wine world since Roman times, establishing the appellation system that became the global model for quality classification. Its diverse terroirs from the cool north (Champagne, Burgundy) to the warm south (Rhône, Provence) produce the world''s most iconic wines, and French grape varieties — Cabernet Sauvignon, Merlot, Chardonnay, Pinot Noir — are now planted worldwide.',
  classificationSystem = 'The AOC/AOP (Appellation d''Origine Contrôlée/Protégée) system classifies wines by geographic origin and production rules, from broad regional appellations to single-vineyard Grand Crus. Below AOP sits IGP (Indication Géographique Protégée) for country wines, and Vin de France for table wines.',
  keyGrapes = '["Cabernet Sauvignon", "Merlot", "Pinot Noir", "Chardonnay", "Syrah", "Sauvignon Blanc", "Grenache", "Chenin Blanc"]',
  totalVineyardHectares = 789000, wineRankingWorld = 2
WHERE code = 'FR';

UPDATE `country` SET
  wineHistory = 'Italy has been producing wine for over 4,000 years and is consistently the world''s largest or second-largest producer by volume. With over 500 native grape varieties cultivated across 20 regions from the Alps to Sicily, Italy offers unparalleled diversity.',
  classificationSystem = 'The Italian system has four tiers: DOCG at the top for the most prestigious wines, DOC for quality regional wines, IGT for innovative wines like Super Tuscans, and Vino da Tavola for table wines.',
  keyGrapes = '["Sangiovese", "Nebbiolo", "Barbera", "Corvina", "Glera", "Pinot Grigio", "Garganega", "Vermentino"]',
  totalVineyardHectares = 718000, wineRankingWorld = 1
WHERE code = 'IT';

UPDATE `country` SET
  wineHistory = 'Spain has the largest vineyard area in the world, with a winemaking tradition stretching back to the Phoenicians around 1100 BC. Prestige regions like Rioja, Ribera del Duero, and Priorat craft world-class wines from native varieties like Tempranillo and Garnacha.',
  classificationSystem = 'Spain''s classification system is headed by DOCa/DOQ for the two top regions (Rioja and Priorat), followed by DO for quality regions, Vino de la Tierra for country wines, and Vino de Mesa for table wines. Aging classifications include Joven, Crianza, Reserva, and Gran Reserva.',
  keyGrapes = '["Tempranillo", "Garnacha", "Albariño", "Macabeo", "Cariñena", "Xarel-lo", "Parellada"]',
  totalVineyardHectares = 941000, wineRankingWorld = 3
WHERE code = 'ES';

UPDATE `country` SET
  wineHistory = 'Portugal''s wine heritage dates back over 2,000 years, best known for Port wine from the Douro Valley, one of the world''s oldest demarcated wine regions (1756). Beyond Port, Portugal has emerged as a source of exceptional dry reds and whites from indigenous grape varieties.',
  classificationSystem = 'The DOC (Denominação de Origem Controlada) system classifies Portugal''s top wine regions, with Vinho Regional (equivalent to IGP) below it for broader regional wines.',
  keyGrapes = '["Touriga Nacional", "Touriga Franca", "Tinta Roriz", "Alvarinho", "Fernão Pires"]',
  totalVineyardHectares = 194000, wineRankingWorld = 11
WHERE code = 'PT';

UPDATE `country` SET
  wineHistory = 'Germany is one of the world''s greatest white wine producers, with a winemaking tradition dating to Roman settlements along the Rhine and Mosel rivers. Its cool climate produces Rieslings of extraordinary purity and longevity.',
  classificationSystem = 'Germany''s classification is based on grape ripeness levels (Prädikat): Kabinett, Spätlese, Auslese, Beerenauslese, Eiswein, and Trockenbeerenauslese. The VDP uses a Burgundy-inspired site classification: Gutswein, Ortswein, Erste Lage, and Grosse Lage.',
  keyGrapes = '["Riesling", "Spätburgunder", "Müller-Thurgau", "Silvaner", "Grauburgunder"]',
  totalVineyardHectares = 103000, wineRankingWorld = 9
WHERE code = 'DE';

UPDATE `country` SET
  wineHistory = 'Austria has a distinctive wine culture centred on Grüner Veltliner, which accounts for roughly a third of all plantings. The country rebuilt its reputation after a 1985 wine scandal led to some of the world''s strictest wine laws.',
  classificationSystem = 'Austria''s DAC (Districtus Austriae Controllatus) system classifies wines by region and style. The Wachau has its own system: Steinfeder (light), Federspiel (medium), and Smaragd (full-bodied).',
  keyGrapes = '["Grüner Veltliner", "Riesling", "Zweigelt", "Blaufränkisch", "St. Laurent"]',
  totalVineyardHectares = 48000, wineRankingWorld = 17
WHERE code = 'AT';

UPDATE `country` SET
  wineHistory = 'Greece is one of the oldest wine-producing countries in the world, with a viticultural history spanning over 6,500 years. Ancient Greeks spread vine cultivation across the Mediterranean. Today, Greece is championing indigenous varieties like Assyrtiko from Santorini.',
  classificationSystem = 'The Greek system uses PDO (Protected Designation of Origin) for quality wines from defined regions and PGI for regional wines. Notable PDO regions include Naoussa, Nemea, and Santorini.',
  keyGrapes = '["Assyrtiko", "Xinomavro", "Agiorgitiko", "Moschofilero", "Mavrodaphne"]',
  totalVineyardHectares = 63000, wineRankingWorld = 15
WHERE code = 'GR';

UPDATE `country` SET
  wineHistory = 'Hungary has one of Europe''s oldest wine traditions, with the Tokaj region producing sweet wines prized by European royalty since the 17th century — Louis XIV called Tokaji "the wine of kings, the king of wines."',
  classificationSystem = 'Hungary uses an OEM system equivalent to PDO. Tokaj wines have their own classification: Szamorodni (dry or sweet) and Aszú (3-6 puttonyos, indicating sweetness level).',
  keyGrapes = '["Furmint", "Hárslevelű", "Kadarka", "Kékfrankos", "Juhfark"]',
  totalVineyardHectares = 65000, wineRankingWorld = 16
WHERE code = 'HU';

UPDATE `country` SET
  wineHistory = 'Switzerland produces excellent wines that are rarely seen abroad because the Swiss consume virtually all of their own production. The steep terraced vineyards of the Valais and the shores of Lake Geneva (Lavaux, a UNESCO World Heritage site) produce distinctive wines from Chasselas.',
  classificationSystem = 'Swiss wine uses AOC at the cantonal level. The three main wine regions are French-speaking Romandie (Valais, Vaud, Geneva), Italian-speaking Ticino, and the German-speaking eastern cantons.',
  keyGrapes = '["Chasselas", "Pinot Noir", "Merlot", "Gamay", "Petite Arvine"]',
  totalVineyardHectares = 15000, wineRankingWorld = 20
WHERE code = 'CH';

UPDATE `country` SET
  wineHistory = 'Georgia is widely regarded as the cradle of wine, with archaeological evidence of winemaking dating back 8,000 years to around 6000 BC. The traditional qvevri method was inscribed on UNESCO''s Intangible Cultural Heritage list in 2013. Georgia boasts over 500 indigenous grape varieties.',
  classificationSystem = 'Georgia uses a PDO system with appellations such as Kakheti, Kartli, and Imereti. Wines are also classified by production method: European-style conventional and traditional qvevri (amber/orange) winemaking.',
  keyGrapes = '["Saperavi", "Rkatsiteli", "Mtsvane", "Kisi", "Chinuri"]',
  totalVineyardHectares = 55000, wineRankingWorld = 19
WHERE code = 'GE';

UPDATE `country` SET
  wineHistory = 'Croatia has a wine history dating to the ancient Greeks and Romans. Its most famous contribution is Tribidrag, which DNA profiling confirmed as the ancestor of California''s Zinfandel.',
  classificationSystem = 'Croatia''s wine regions are classified under EU PDO/PGI regulations, with four main regions: Slavonia and the Danube, Croatian Uplands, Istria and Kvarner, and Dalmatia.',
  keyGrapes = '["Graševina", "Plavac Mali", "Malvazija Istarska", "Pošip", "Tribidrag"]',
  totalVineyardHectares = 21000, wineRankingWorld = NULL
WHERE code = 'HR';

UPDATE `country` SET
  wineHistory = 'Romania is one of Europe''s largest wine producers with a history stretching back to the Dacians and Romans. It grows both indigenous varieties like Fetească Neagră and international grapes, and has been modernizing rapidly with EU investment.',
  classificationSystem = 'Romania uses the DOC system with sub-classifications: DOC-CMD (late harvest), DOC-CT (selected harvest), and DOC-CIB (noble harvest). Below DOC are IG for regional wines and Vin de Masă for table wines.',
  keyGrapes = '["Fetească Neagră", "Fetească Albă", "Fetească Regală", "Tămâioasă Românească"]',
  totalVineyardHectares = 191000, wineRankingWorld = 12
WHERE code = 'RO';

UPDATE `country` SET
  wineHistory = 'Slovenia sits at the crossroads of Alpine, Mediterranean, and Pannonian climates. The Goriška Brda region bordering Italy is renowned for orange wines and skin-contact whites, earning a cult following among natural wine enthusiasts.',
  classificationSystem = 'Slovenia uses a ZGP system with three wine regions: Podravje, Posavje, and Primorska. Quality classifications range from namizno vino (table wine) to vrhunsko vino (premium quality).',
  keyGrapes = '["Rebula", "Malvazija", "Šipon", "Refošk", "Zelen"]',
  totalVineyardHectares = 16000, wineRankingWorld = NULL
WHERE code = 'SI';

UPDATE `country` SET
  wineHistory = 'English and Welsh wine production has grown dramatically since the 2000s, driven by climate change making southern England ideal for sparkling wine. The chalk soils of Sussex and Kent are geologically identical to Champagne, and English sparkling wines now regularly beat Champagne in blind tastings.',
  classificationSystem = 'The UK uses the PDO system with designations such as Sussex PDO (awarded 2022) and English Quality Sparkling Wine. There is also PGI English Regional Wine and PGI Welsh Regional Wine.',
  keyGrapes = '["Chardonnay", "Pinot Noir", "Pinot Meunier", "Bacchus"]',
  totalVineyardHectares = 4000, wineRankingWorld = NULL
WHERE code = 'GB';

UPDATE `country` SET
  wineHistory = 'The Czech Republic has a wine tradition centred in southern Moravia, which produces around 96% of the country''s wine. Czech wines have been improving steadily with modern investment while remaining largely unknown outside Central Europe.',
  classificationSystem = 'Czech wines use the VOC (Vína Originální Certifikace) system for regional designation. Quality levels include stolní víno (table wine) through přívlastkové víno (Prädikat equivalent).',
  keyGrapes = '["Grüner Veltliner", "Riesling", "Müller-Thurgau", "Frankovka", "Svatovavřinecké"]',
  totalVineyardHectares = 18000, wineRankingWorld = NULL
WHERE code = 'CZ';

UPDATE `country` SET
  wineHistory = 'Bulgaria has ancient winemaking roots dating to the Thracians around 3000 BC and was the world''s fourth-largest wine exporter during the communist era. A new generation of producers is investing in modern winemaking with distinctive indigenous grapes like Mavrud and Melnik.',
  classificationSystem = 'Bulgaria uses GI and PDO systems under EU regulations. The two main Thracian and Danubian wine regions encompass over 50 sub-regions.',
  keyGrapes = '["Mavrud", "Melnik", "Rubin", "Dimyat", "Misket"]',
  totalVineyardHectares = 63000, wineRankingWorld = NULL
WHERE code = 'BG';

UPDATE `country` SET
  wineHistory = 'Moldova is one of the most wine-dependent economies in the world, with vineyards covering roughly 4% of the country''s total area. It houses the Mileștii Mici wine collection, certified by Guinness as the world''s largest.',
  classificationSystem = 'Moldova uses an IG and DOP system. Four main wine regions: Valul lui Traian, Codru, Ștefan Vodă, and Divin.',
  keyGrapes = '["Fetească Neagră", "Fetească Albă", "Rară Neagră", "Viorica"]',
  totalVineyardHectares = 136000, wineRankingWorld = 18
WHERE code = 'MD';

UPDATE `country` SET
  wineHistory = 'Anatolia is one of the birthplaces of viticulture, with evidence of winemaking dating back to 7000 BC. Turkey has the world''s fourth-largest vineyard area, though most grapes are consumed as table grapes or raisins. A small but growing wine industry produces interesting wines from indigenous varieties.',
  classificationSystem = 'Turkey uses a GI system recognizing wine regions. Key regions include Thrace, the Aegean coast, Cappadocia, and Eastern Anatolia.',
  keyGrapes = '["Öküzgözü", "Boğazkere", "Narince", "Emir", "Kalecik Karası"]',
  totalVineyardHectares = 410000, wineRankingWorld = NULL
WHERE code = 'TR';

UPDATE `country` SET
  wineHistory = 'Lebanon has one of the world''s oldest continuously producing wine cultures, with Phoenician merchants spreading viticulture across the Mediterranean from around 3000 BC. The Bekaa Valley is the heart of Lebanese winemaking. Château Musar put Lebanese wine on the global map.',
  classificationSystem = 'Lebanon has no formal classification system. Wines are labelled by producer, variety, and region. The Bekaa Valley is the primary recognized region.',
  keyGrapes = '["Cabernet Sauvignon", "Cinsault", "Carignan", "Obaideh", "Merwah"]',
  totalVineyardHectares = 3000, wineRankingWorld = NULL
WHERE code = 'LB';

UPDATE `country` SET
  wineHistory = 'Israel is one of the birthplaces of winemaking with a 5,000-year history, though modern quality production only revived in the 1980s. Today, Israel produces world-class wines from high-altitude vineyards in the Golan Heights and Upper Galilee.',
  classificationSystem = 'Israel does not have a formal appellation system. Five recognized wine regions: Galilee, Shomron, Samson, Negev, and Judean Hills. Many wines carry kosher certification.',
  keyGrapes = '["Cabernet Sauvignon", "Syrah", "Merlot", "Carignan", "Chardonnay"]',
  totalVineyardHectares = 5500, wineRankingWorld = NULL
WHERE code = 'IL';

UPDATE `country` SET
  wineHistory = 'The United States is the world''s fourth-largest wine producer, with California accounting for over 80% of production. The 1976 "Judgment of Paris" blind tasting catalyzed the modern American wine industry when California wines bested top French wines.',
  classificationSystem = 'The AVA (American Viticultural Area) system designates geographic regions based on climate, soil, and elevation, but does not regulate grape varieties or winemaking methods. There are over 270 AVAs.',
  keyGrapes = '["Cabernet Sauvignon", "Chardonnay", "Pinot Noir", "Zinfandel", "Merlot"]',
  totalVineyardHectares = 390000, wineRankingWorld = 4
WHERE code = 'US';

UPDATE `country` SET
  wineHistory = 'Australian wine production began with European settlement in the late 18th century and has grown into one of the world''s most innovative industries. Australian winemakers pioneered screw cap closures, precision viticulture, and bold, fruit-forward styles that redefined New World wine.',
  classificationSystem = 'Australia uses a GI (Geographical Indication) system defining wine zones, regions, and sub-regions. There are over 65 GI regions. Langton''s Classification provides an unofficial quality ranking.',
  keyGrapes = '["Shiraz", "Chardonnay", "Cabernet Sauvignon", "Riesling", "Grenache", "Sémillon"]',
  totalVineyardHectares = 146000, wineRankingWorld = 5
WHERE code = 'AU';

UPDATE `country` SET
  wineHistory = 'New Zealand''s wine industry is remarkably young — commercial production only began in the 1970s — yet it has achieved global recognition, particularly for Marlborough Sauvignon Blanc, which redefined the grape with its intensely pungent, tropical style.',
  classificationSystem = 'New Zealand uses a GI system. Main regions include Marlborough, Hawke''s Bay, Central Otago, Martinborough, and Gisborne. No formal quality classification beyond regional designations.',
  keyGrapes = '["Sauvignon Blanc", "Pinot Noir", "Chardonnay", "Syrah", "Pinot Gris"]',
  totalVineyardHectares = 42000, wineRankingWorld = 13
WHERE code = 'NZ';

UPDATE `country` SET
  wineHistory = 'Argentina is the world''s fifth-largest wine producer. Malbec, which struggled in its native France, became Argentina''s flagship variety in Mendoza, where high-altitude vineyards (up to 3,000m) produce intense, concentrated wines.',
  classificationSystem = 'Argentina uses a DOC system (limited adoption) and IG for broader regions. Mendoza is subdivided into Luján de Cuyo, Valle de Uco, and Maipú, with increasing focus on altitude designation.',
  keyGrapes = '["Malbec", "Torrontés", "Cabernet Sauvignon", "Bonarda", "Criolla"]',
  totalVineyardHectares = 215000, wineRankingWorld = 7
WHERE code = 'AR';

UPDATE `country` SET
  wineHistory = 'Chile''s unique geography creates natural barriers that have kept its vineyards phylloxera-free, meaning many vines grow on their own rootstock. The country has championed Carmenère, a grape long thought extinct in its native Bordeaux, as its signature variety.',
  classificationSystem = 'Chile uses a DO system. Key regions include Maipo, Colchagua, Casablanca, and Leyda. A Costa/Entre Cordilleras/Andes designation was added in 2011 for east-west terroir differences.',
  keyGrapes = '["Cabernet Sauvignon", "Carmenère", "Sauvignon Blanc", "Merlot", "País"]',
  totalVineyardHectares = 200000, wineRankingWorld = 6
WHERE code = 'CL';

UPDATE `country` SET
  wineHistory = 'South Africa has been producing wine since 1659. The Western Cape''s Mediterranean climate, influenced by the cold Benguela Current, creates ideal conditions. Chenin Blanc (locally Steen) accounts for nearly 20% of plantings, and Pinotage is its most distinctive red variety.',
  classificationSystem = 'South Africa''s Wine of Origin (WO) system classifies wines by geographic units, regions, districts, and wards. Main districts include Stellenbosch, Paarl, Franschhoek, Swartland, and Constantia.',
  keyGrapes = '["Chenin Blanc", "Pinotage", "Cabernet Sauvignon", "Shiraz", "Chardonnay"]',
  totalVineyardHectares = 125000, wineRankingWorld = 8
WHERE code = 'ZA';

UPDATE `country` SET
  wineHistory = 'Brazil is South America''s third-largest wine producer, centred in Rio Grande do Sul''s Serra Gaúcha highlands. The Vale dos Vinhedos region has gained international recognition and DOC status.',
  classificationSystem = 'Brazil uses an IG and DO system. Vale dos Vinhedos was the first region to receive DO status.',
  keyGrapes = '["Merlot", "Cabernet Sauvignon", "Chardonnay", "Moscato", "Tannat"]',
  totalVineyardHectares = 82000, wineRankingWorld = 14
WHERE code = 'BR';

UPDATE `country` SET
  wineHistory = 'Uruguay is a small but quality-focused wine producer, with Tannat — originally from southwestern France — as its signature grape, producing robust, tannic reds with remarkable depth.',
  classificationSystem = 'Uruguay uses a wine origin system recognizing major regions: Canelones, Montevideo, Colonia, and Maldonado. No formal appellation hierarchy.',
  keyGrapes = '["Tannat", "Merlot", "Cabernet Sauvignon", "Sauvignon Blanc", "Albariño"]',
  totalVineyardHectares = 6000, wineRankingWorld = NULL
WHERE code = 'UY';

UPDATE `country` SET
  wineHistory = 'Canada''s wine industry has grown significantly since the 1990s, with Ontario''s Niagara Peninsula and British Columbia''s Okanagan Valley as the two main regions. Canada is the world''s largest producer of ice wine.',
  classificationSystem = 'Canada uses the VQA (Vintners Quality Alliance) system in Ontario and British Columbia. Sub-appellations like Niagara-on-the-Lake and the Golden Mile Bench provide specificity.',
  keyGrapes = '["Riesling", "Chardonnay", "Pinot Noir", "Cabernet Franc", "Vidal"]',
  totalVineyardHectares = 13000, wineRankingWorld = NULL
WHERE code = 'CA';

UPDATE `country` SET
  wineHistory = 'Mexico is the oldest wine-producing country in the Americas, with vines planted by Spanish missionaries in the 16th century. The Valle de Guadalupe in Baja California has emerged as the flagship wine region.',
  classificationSystem = 'Mexico does not have a formal wine classification system. The Valle de Guadalupe is the main recognized region, with emerging areas in Querétaro and Coahuila.',
  keyGrapes = '["Cabernet Sauvignon", "Tempranillo", "Nebbiolo", "Grenache", "Chenin Blanc"]',
  totalVineyardHectares = 35000, wineRankingWorld = NULL
WHERE code = 'MX';

UPDATE `country` SET
  wineHistory = 'China has rapidly become a major wine nation, with Ningxia at the edge of the Gobi Desert emerging as China''s most promising fine wine region, producing Bordeaux-style reds that have won international blind tastings.',
  classificationSystem = 'China uses a GI system recognizing regions including Ningxia, Xinjiang, Hebei, Shandong, and Yunnan. Ningxia has developed its own winery classification modeled on the Bordeaux system.',
  keyGrapes = '["Cabernet Sauvignon", "Merlot", "Cabernet Gernischt", "Marselan", "Chardonnay"]',
  totalVineyardHectares = 785000, wineRankingWorld = 10
WHERE code = 'CN';

UPDATE `country` SET
  wineHistory = 'India''s modern wine industry is centered in Maharashtra, particularly around Nashik, where high-altitude vineyards benefit from a tropical climate moderated by elevation. The industry has grown from a handful of producers in the 1990s to over 100 wineries.',
  classificationSystem = 'India does not have a formal wine appellation system. Primary regions are Nashik and Pune in Maharashtra, and Bangalore in Karnataka.',
  keyGrapes = '["Cabernet Sauvignon", "Shiraz", "Sauvignon Blanc", "Chenin Blanc", "Zinfandel"]',
  totalVineyardHectares = 155000, wineRankingWorld = NULL
WHERE code = 'IN';

UPDATE `country` SET
  wineHistory = 'Japan''s wine industry has a distinctive character built around Koshu, an indigenous grape cultivated for over 1,000 years. The primary region is Yamanashi Prefecture, where volcanic soils and a cool climate produce delicate, refined wines.',
  classificationSystem = 'Japan introduced a wine labeling standard in 2018 requiring "Japanese wine" (Nihon Wine) to be made from domestically grown grapes. The GI system recognizes Yamanashi as the primary region.',
  keyGrapes = '["Koshu", "Muscat Bailey A", "Merlot", "Chardonnay", "Cabernet Sauvignon"]',
  totalVineyardHectares = 17000, wineRankingWorld = NULL
WHERE code = 'JP';

-- =====================================================
-- Step 4: New regions (only those not already present)
-- Uses INSERT ... SELECT to resolve countryID dynamically
-- UNIQUE constraint on (regionName, deletedAt) prevents duplicates
-- =====================================================

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'Loire Valley', countryID, 'France''s longest river valley wine region, stretching 1,000 km from the Atlantic to central France, producing diverse styles from Muscadet to Sancerre to sweet Vouvray.', 'Maritime influence in the west, transitioning to continental in the east, with moderating river influence throughout.', 'Highly varied: schist in Muscadet, tuffeau limestone in Touraine, flint and Kimmeridgian clay in Sancerre.', '' FROM `country` WHERE code = 'FR';

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'Provence', countryID, 'The oldest wine region in France, founded by Greek colonists around 600 BC, now world-famous for its pale, elegant rosé wines.', 'Mediterranean with hot, dry summers, mild winters, abundant sunshine, and the cooling Mistral wind.', 'Limestone, schist, and clay, with the best rosé vineyards on well-drained, calcareous soils.', '' FROM `country` WHERE code = 'FR';

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'Tuscany', countryID, 'Central Italy''s most famous wine region, home to Chianti, Brunello di Montalcino, and the innovative Super Tuscan wines.', 'Mediterranean in coastal areas, transitioning to continental inland; warm days and cool nights in the central hills.', 'Galestro (friable shale) and alberese (compact limestone) in Chianti; clay and limestone in Montalcino.', '' FROM `country` WHERE code = 'IT';

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'Piedmont', countryID, 'Northwestern Italy''s premier wine region, home to Barolo and Barbaresco from Nebbiolo, as well as Barbera d''Asti and Moscato d''Asti.', 'Continental with cold, foggy winters and warm summers; significant diurnal temperature variation aids aromatic development.', 'Calcareous marl and clay, with the best Nebbiolo vineyards on south-facing hillside exposures.', '' FROM `country` WHERE code = 'IT';

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'Castilla y León', countryID, 'Spain''s vast central plateau, home to Ribera del Duero (powerful Tempranillo reds at 800m+), Rueda (crisp Verdejo whites), and Toro.', 'Extreme continental with very hot summers, cold winters, and wide diurnal temperature swings of up to 20°C.', 'Sandy, limestone, and chalky soils over clay; Ribera del Duero''s thin, poor soils naturally limit yields.', '' FROM `country` WHERE code = 'ES';

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'Catalonia', countryID, 'Spain''s northeastern Mediterranean region, home to Cava sparkling wine and the intense old-vine reds of Priorat.', 'Mediterranean with warm, dry summers; Priorat interior is hotter and drier with extreme terroir conditions.', 'Penedès: limestone and clay; Priorat: distinctive llicorella (black slate and quartz).', '' FROM `country` WHERE code = 'ES';

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'Galicia', countryID, 'Spain''s green, Atlantic northwestern corner, producing the country''s finest white wines — particularly Albariño from Rías Baixas.', 'Cool, wet Atlantic climate with high rainfall and maritime influence.', 'Granite and sandy soils with good drainage; decomposed granite contributes mineral character.', '' FROM `country` WHERE code = 'ES';

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'Andalusia', countryID, 'Spain''s southernmost region, home to the Sherry Triangle, producing the world''s greatest fortified wines in a unique solera aging system.', 'Hot Mediterranean with intense sunshine, moderated by Atlantic breezes crucial for flor yeast development.', 'Albariza — brilliant white, chalky, calcium-rich soil that retains moisture through the scorching summer.', '' FROM `country` WHERE code = 'ES';

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'Douro', countryID, 'One of the world''s oldest demarcated wine regions (1756), famous for Port wine and increasingly acclaimed for complex dry red table wines.', 'Continental with extreme temperatures: brutally hot summers and cold winters, moderated by the Douro River.', 'Schist that splits into layers, allowing vine roots to penetrate deep; steep terraced hillsides are among the world''s most dramatic.', '' FROM `country` WHERE code = 'PT';

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'Mosel', countryID, 'Germany''s most iconic wine region, producing ethereal Rieslings from impossibly steep slate-covered slopes along the winding Mosel River.', 'Cool continental at the northern limit of viticulture; steep south-facing slopes essential for ripening.', 'Devonian blue, grey, and red slate that absorbs and radiates heat; gives Mosel Riesling its flinty minerality.', '' FROM `country` WHERE code = 'DE';

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'Rheingau', countryID, 'A compact, prestigious region on the north bank of the Rhine, producing fuller, more structured Rieslings than the Mosel.', 'Moderate continental, warmed by the Rhine''s reflected heat and protected by the Taunus Mountains.', 'Deep, weathered slate, quartzite, and loess over limestone.', '' FROM `country` WHERE code = 'DE';

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'California', countryID, 'The dominant American wine region producing over 80% of US wine, from Napa Cabernet Sauvignon to Sonoma Pinot Noir and old-vine Zinfandels.', 'Mediterranean with enormous climatic diversity from the fog-cooled coast to the hot inland Central Valley.', 'Diverse: volcanic soils in Napa, sandy loam in Sonoma, limestone in Paso Robles, alluvial deposits in the Central Valley.', '' FROM `country` WHERE code = 'US';

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'Oregon', countryID, 'A cool-climate wine region that has established itself as one of the world''s premier Pinot Noir regions, with the Willamette Valley at its heart.', 'Cool maritime with warm, dry summers and cool, wet winters; similar latitude and climate to Burgundy.', 'Volcanic basalt (Jory) and marine sedimentary (Willakenzie) soils, providing mineral-rich conditions for Pinot Noir.', '' FROM `country` WHERE code = 'US';

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'South Australia', countryID, 'Australia''s most important wine state: Barossa Valley (Shiraz), McLaren Vale, Adelaide Hills, Clare Valley (Riesling), and Coonawarra (Cabernet).', 'Mediterranean to continental; ranges from cool Adelaide Hills to warm Barossa Valley floor.', 'Red-brown earth in the Barossa, terra rossa in Coonawarra, slate and schist in Clare Valley.', '' FROM `country` WHERE code = 'AU';

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'Western Australia', countryID, 'A premium region anchored by Margaret River, producing world-class Cabernet Sauvignon-Merlot blends and Chardonnay.', 'Mediterranean maritime with warm, dry summers moderated by Indian Ocean breezes; remarkably consistent climate.', 'Ancient granitic and gneissic soils (laterite gravel over clay) providing excellent drainage.', '' FROM `country` WHERE code = 'AU';

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'South Island', countryID, 'Home to Marlborough (the world''s most recognized Sauvignon Blanc region) and Central Otago (famous for Pinot Noir).', 'Cool maritime in Marlborough; Central Otago is continental with the most extreme temperature range in New Zealand.', 'Marlborough: stony alluvial greywacke; Central Otago: schist, loess, and mica.', '' FROM `country` WHERE code = 'NZ';

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'Hawke''s Bay', countryID, 'New Zealand''s second-largest wine region, known for Bordeaux-style reds from the Gimblett Gravels and rich Chardonnay.', 'Warm maritime, one of New Zealand''s sunniest regions with more heat units than Marlborough.', 'Gimblett Gravels: deep, free-draining alluvial greywacke shingle providing exceptional warmth and drainage.', '' FROM `country` WHERE code = 'NZ';

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'Mendoza', countryID, 'Argentina''s most important wine region, with vineyards at extraordinary altitudes from 600m to over 1,500m in the Andean foothills.', 'Arid continental desert with less than 200mm annual rainfall and dramatic diurnal temperature swings of 15-20°C.', 'Alluvial soils from Andean snowmelt: sandy, rocky, and calcareous with excellent drainage.', '' FROM `country` WHERE code = 'AR';

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'Central Valley', countryID, 'Chile''s most productive wine region, encompassing Maipo, Rapel, Curicó, and Maule sub-valleys.', 'Mediterranean with warm, dry summers; Andes and Pacific create varying cooling influences across the valley.', 'Alluvial soils from Andean rivers with clay, sand, and gravel; best sites on well-drained valley sides.', '' FROM `country` WHERE code = 'CL';

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'Stellenbosch', countryID, 'South Africa''s most prestigious wine district, producing world-class Cabernet Sauvignon, Bordeaux-style blends, and Chenin Blanc.', 'Mediterranean moderated by the cold Benguela Current; cooling afternoon "Cape Doctor" breezes and varied mountain aspects.', 'Decomposed granite, sandstone, and ancient weathered Table Mountain sandstone, providing well-drained, mineral-rich soils.', '' FROM `country` WHERE code = 'ZA';

INSERT IGNORE INTO `region` (`regionName`, `countryID`, `description`, `climate`, `soil`, `map`)
SELECT 'Niagara Peninsula', countryID, 'Ontario''s premier wine region, producing exceptional Riesling, Chardonnay, and Pinot Noir, as well as Canada''s renowned ice wines.', 'Cool continental moderated by Lake Ontario; reliably cold winters enable consistent ice wine production.', 'Glacial till and lacustrine clay; the Beamsville Bench offers well-drained, elevated conditions for premium wines.', '' FROM `country` WHERE code = 'CA';

-- =====================================================
-- AI Agent Phase 1 - Seed Data
-- Wine AI Sommelier Reference Data
-- =====================================================

SET NAMES utf8mb4;

-- =====================================================
-- Grape Characteristics (~50 common varieties)
-- =====================================================

INSERT INTO refGrapeCharacteristics
(grapeName, alternateNames, color, body, tannin, acidity, primaryFlavors, secondaryFlavors, agingPotential, classicPairings) VALUES

-- RED GRAPES
('Cabernet Sauvignon', NULL, 'red', 'full', 'high', 'medium',
 '["blackcurrant", "cedar", "tobacco", "dark cherry", "graphite"]',
 '["vanilla", "chocolate", "leather"]', 'very-long',
 '["lamb", "beef", "hard cheese", "grilled meats"]'),

('Pinot Noir', NULL, 'red', 'light', 'low', 'medium-high',
 '["red cherry", "raspberry", "strawberry", "earth", "mushroom"]',
 '["cola", "clove", "forest floor"]', 'medium',
 '["duck", "salmon", "pork", "mushroom dishes", "chicken"]'),

('Merlot', NULL, 'red', 'medium-full', 'medium', 'medium',
 '["plum", "cherry", "chocolate", "herbs", "bay leaf"]',
 '["vanilla", "mocha", "tobacco"]', 'medium',
 '["roast chicken", "pasta", "mushrooms", "pork tenderloin"]'),

('Syrah', '["Shiraz"]', 'red', 'full', 'medium-high', 'medium',
 '["blackberry", "pepper", "smoke", "meat", "olive"]',
 '["bacon", "tar", "violet"]', 'long',
 '["grilled meats", "stews", "game", "barbecue", "lamb"]'),

('Tempranillo', '["Tinto Fino", "Tinta Roriz", "Aragonez"]', 'red', 'medium-full', 'medium-high', 'medium',
 '["cherry", "leather", "tobacco", "tomato", "dried fig"]',
 '["vanilla", "dill", "coconut"]', 'long',
 '["lamb", "cured meats", "tapas", "chorizo", "manchego"]'),

('Sangiovese', '["Brunello", "Prugnolo Gentile"]', 'red', 'medium', 'medium-high', 'high',
 '["cherry", "tomato", "herbs", "tea", "rose"]',
 '["tobacco", "leather", "earth"]', 'long',
 '["tomato-based pasta", "pizza", "grilled vegetables", "hard Italian cheese"]'),

('Nebbiolo', NULL, 'red', 'full', 'high', 'high',
 '["cherry", "rose", "tar", "truffle", "dried herbs"]',
 '["leather", "licorice", "menthol"]', 'very-long',
 '["truffle dishes", "braised meats", "aged cheese", "risotto"]'),

('Grenache', '["Garnacha", "Cannonau"]', 'red', 'medium-full', 'medium-low', 'medium',
 '["raspberry", "strawberry", "orange peel", "white pepper", "herbs"]',
 '["leather", "tar", "licorice"]', 'medium',
 '["grilled lamb", "Mediterranean cuisine", "roasted vegetables"]'),

('Malbec', '["Côt"]', 'red', 'full', 'medium-high', 'medium',
 '["plum", "blackberry", "black cherry", "cocoa", "violet"]',
 '["vanilla", "tobacco", "leather"]', 'medium',
 '["grilled steak", "barbecue", "empanadas", "hard cheese"]'),

('Zinfandel', '["Primitivo"]', 'red', 'full', 'medium', 'medium',
 '["blackberry", "raspberry", "black pepper", "licorice", "jam"]',
 '["vanilla", "tobacco", "cinnamon"]', 'medium',
 '["barbecue", "pizza", "grilled sausages", "spicy food"]'),

('Cabernet Franc', NULL, 'red', 'medium', 'medium', 'medium-high',
 '["raspberry", "bell pepper", "violet", "graphite", "herbs"]',
 '["tobacco", "cedar"]', 'medium',
 '["roast chicken", "pork", "vegetable dishes", "goat cheese"]'),

('Mourvèdre', '["Monastrell", "Mataro"]', 'red', 'full', 'high', 'medium',
 '["blackberry", "meat", "earth", "game", "black pepper"]',
 '["leather", "herbs"]', 'long',
 '["game", "lamb", "hearty stews", "aged cheese"]'),

('Petit Verdot', NULL, 'red', 'full', 'high', 'medium',
 '["violet", "blueberry", "plum", "sage", "pencil lead"]',
 '["leather", "smoke"]', 'long',
 '["beef", "lamb", "hard aged cheese"]'),

('Barbera', NULL, 'red', 'medium', 'low', 'high',
 '["cherry", "plum", "herbs", "licorice", "dried flowers"]',
 '["vanilla", "spice"]', 'medium',
 '["tomato-based dishes", "pizza", "pasta", "cured meats"]'),

('Dolcetto', NULL, 'red', 'medium', 'medium', 'medium-low',
 '["black cherry", "licorice", "prune", "cocoa", "almond"]',
 NULL, 'drink-now',
 '["pasta", "pizza", "antipasti", "cured meats"]'),

-- WHITE GRAPES
('Chardonnay', NULL, 'white', 'medium-full', NULL, 'medium',
 '["apple", "citrus", "pear", "melon"]',
 '["butter", "vanilla", "toast", "hazelnut"]', 'medium',
 '["lobster", "chicken", "cream sauces", "rich fish", "soft cheese"]'),

('Sauvignon Blanc', NULL, 'white', 'light', NULL, 'high',
 '["grapefruit", "grass", "green apple", "gooseberry", "lime"]',
 '["jalapeño", "passionfruit", "boxwood"]', 'drink-now',
 '["goat cheese", "seafood", "salads", "asparagus", "sushi"]'),

('Riesling', NULL, 'white', 'light', NULL, 'high',
 '["lime", "green apple", "peach", "apricot", "honey"]',
 '["petrol", "slate", "ginger"]', 'very-long',
 '["spicy food", "pork", "shellfish", "Asian cuisine", "duck"]'),

('Pinot Grigio', '["Pinot Gris"]', 'white', 'light', NULL, 'medium-high',
 '["lemon", "green apple", "pear", "almond", "honey"]',
 '["ginger", "stone fruit"]', 'drink-now',
 '["light seafood", "salads", "light pasta", "aperitif"]'),

('Gewürztraminer', NULL, 'white', 'medium-full', NULL, 'medium-low',
 '["lychee", "rose", "ginger", "grapefruit", "mango"]',
 '["honey", "spice", "smoke"]', 'medium',
 '["Asian cuisine", "spicy food", "foie gras", "soft cheese"]'),

('Viognier', NULL, 'white', 'full', NULL, 'medium-low',
 '["peach", "apricot", "tangerine", "honeysuckle", "mango"]',
 '["vanilla", "cream", "spice"]', 'short',
 '["rich seafood", "cream sauces", "Thai food", "roast chicken"]'),

('Chenin Blanc', NULL, 'white', 'medium', NULL, 'high',
 '["apple", "quince", "honey", "chamomile", "ginger"]',
 '["lanolin", "straw", "beeswax"]', 'very-long',
 '["pork", "Thai cuisine", "soft cheese", "fruit-based dishes"]'),

('Albariño', '["Alvarinho"]', 'white', 'light', NULL, 'high',
 '["lemon", "grapefruit", "peach", "apricot", "saline"]',
 '["almond", "herbs"]', 'drink-now',
 '["seafood", "shellfish", "ceviche", "light fish"]'),

('Grüner Veltliner', NULL, 'white', 'light', NULL, 'high',
 '["green apple", "lime", "white pepper", "radish", "herbs"]',
 '["lentil", "citrus zest"]', 'medium',
 '["Wiener Schnitzel", "Asian fusion", "salads", "vegetables"]'),

('Muscadet', '["Melon de Bourgogne"]', 'white', 'light', NULL, 'high',
 '["lemon", "green apple", "pear", "saline", "chalk"]',
 '["yeast", "brioche"]', 'drink-now',
 '["oysters", "mussels", "seafood", "light fish"]'),

('Torrontés', NULL, 'white', 'light', NULL, 'medium',
 '["peach", "rose", "geranium", "citrus", "lychee"]',
 NULL, 'drink-now',
 '["spicy food", "ceviche", "Asian cuisine", "appetizers"]'),

('Semillon', '["Sémillon"]', 'white', 'medium-full', NULL, 'medium-low',
 '["lemon", "apple", "papaya", "fig", "honey"]',
 '["lanolin", "toast", "waxy"]', 'long',
 '["rich fish", "chicken", "cream sauces", "foie gras"]'),

('Vermentino', '["Rolle", "Pigato"]', 'white', 'light', NULL, 'medium-high',
 '["lime", "grapefruit", "green apple", "almond", "herbs"]',
 '["saline", "fennel"]', 'drink-now',
 '["Mediterranean seafood", "pesto", "light appetizers"]'),

-- ROSÉ/PINK GRAPES
('Grenache Rosé', NULL, 'pink', 'light', NULL, 'medium',
 '["strawberry", "watermelon", "rose petal", "citrus"]',
 '["herbs", "white pepper"]', 'drink-now',
 '["salads", "grilled fish", "Mediterranean cuisine", "appetizers"]');

-- =====================================================
-- Pairing Rules (Hierarchical - ~100 rules)
-- =====================================================

INSERT INTO refPairingRules
(foodCategory, foodSubcategory, foodItem, preparationMethod, wineTypes, wineStyles, grapeVarieties, avoidTypes, specificity, reasoning, source) VALUES

-- GENERAL RULES (specificity 1)
('Seafood', NULL, NULL, NULL, '["Sparkling", "White"]', NULL, NULL, '["Red"]', 1,
 'Light wines complement delicate seafood; tannins clash with fish oils', 'Wine Folly'),

('Red Meat', NULL, NULL, NULL, '["Red"]', NULL, NULL, NULL, 1,
 'Tannins cut through fat and protein; fuller body matches meat weight', 'CMS'),

('Poultry', NULL, NULL, NULL, '["White", "Rosé", "Red"]', NULL, NULL, NULL, 1,
 'Versatile protein pairs widely depending on preparation', 'The Flavor Bible'),

('Pork', NULL, NULL, NULL, '["White", "Rosé", "Red"]', NULL, NULL, NULL, 1,
 'Medium weight protein pairs with lighter reds and fuller whites', 'Wine Folly'),

('Vegetarian', NULL, NULL, NULL, '["White", "Rosé", "Red"]', NULL, NULL, NULL, 1,
 'Pair based on preparation method and dominant flavors', 'The Flavor Bible'),

('Cheese', NULL, NULL, NULL, '["Red", "White", "Sparkling", "Dessert", "Fortified"]', NULL, NULL, NULL, 1,
 'Match intensity of cheese with wine; contrast or complement flavors', 'CMS'),

('Pasta', NULL, NULL, NULL, '["Red", "White"]', NULL, NULL, NULL, 1,
 'Pair with sauce, not pasta itself', 'Wine Folly'),

('Desserts', NULL, NULL, NULL, '["Dessert", "Sparkling", "Fortified"]', NULL, NULL, '["Red"]', 1,
 'Wine should be sweeter than the dessert', 'CMS'),

-- SEAFOOD RULES (specificity 2-4)
('Seafood', 'Shellfish', NULL, NULL, '["Sparkling", "White"]', '["Brut", "Blanc de Blancs"]', '["Chardonnay", "Muscadet"]', '["Red"]', 2,
 'High acid and mineral whites complement briny shellfish', 'CMS'),

('Seafood', 'Shellfish', 'Oysters', 'raw', '["Sparkling", "White"]', '["Blanc de Blancs", "Muscadet", "Chablis"]', '["Chardonnay", "Melon de Bourgogne"]', '["Red"]', 4,
 'Mineral, crisp wines echo ocean brininess; champagne bubbles cleanse', 'Wine Folly'),

('Seafood', 'Shellfish', 'Lobster', 'butter-poached', '["White", "Sparkling"]', '["Oaked Chardonnay"]', '["Chardonnay"]', NULL, 4,
 'Rich buttery lobster matches rich buttery Chardonnay', 'CMS'),

('Seafood', 'Shellfish', 'Crab', NULL, '["White", "Sparkling"]', '["Blanc de Blancs"]', '["Chardonnay", "Sauvignon Blanc"]', NULL, 3,
 'Delicate sweet meat pairs with elegant whites', 'Wine Folly'),

('Seafood', 'Fish', 'Salmon', 'grilled', '["White", "Rosé", "Red"]', NULL, '["Pinot Noir", "Chardonnay"]', NULL, 3,
 'Rich fatty fish handles medium-bodied Pinot Noir', 'CMS'),

('Seafood', 'Fish', 'Salmon', 'smoked', '["Sparkling", "White"]', '["Brut Rosé"]', '["Chardonnay", "Pinot Noir"]', NULL, 4,
 'Smoky richness pairs with toasty champagne', 'Wine Folly'),

('Seafood', 'Fish', 'Tuna', 'seared', '["Red", "Rosé"]', NULL, '["Pinot Noir", "Grenache"]', NULL, 3,
 'Meaty tuna handles light reds served slightly cool', 'CMS'),

('Seafood', 'Fish', NULL, 'fried', '["Sparkling", "White"]', '["Brut"]', '["Chardonnay", "Albariño"]', NULL, 3,
 'High acid and bubbles cut through fried coating', 'Wine Folly'),

('Seafood', 'Fish', NULL, 'grilled', '["White"]', NULL, '["Sauvignon Blanc", "Vermentino", "Albariño"]', NULL, 2,
 'Char notes pair with herbaceous whites', 'The Flavor Bible'),

-- RED MEAT RULES (specificity 2-4)
('Red Meat', 'Beef', NULL, NULL, '["Red"]', NULL, '["Cabernet Sauvignon", "Malbec", "Syrah"]', NULL, 2,
 'Bold tannins and dark fruit complement beef richness', 'CMS'),

('Red Meat', 'Beef', 'Steak', 'grilled', '["Red"]', NULL, '["Cabernet Sauvignon", "Malbec", "Syrah"]', NULL, 3,
 'High tannin cuts through char and fat; dark fruit echoes Maillard', 'Wine Folly'),

('Red Meat', 'Beef', 'Filet Mignon', NULL, '["Red"]', NULL, '["Pinot Noir", "Merlot"]', NULL, 4,
 'Leaner cut pairs with softer, more elegant reds', 'CMS'),

('Red Meat', 'Beef', 'Ribeye', NULL, '["Red"]', NULL, '["Cabernet Sauvignon", "Malbec"]', NULL, 4,
 'Fatty marbled cut needs high tannin wines', 'Wine Folly'),

('Red Meat', 'Beef', NULL, 'braised', '["Red"]', NULL, '["Nebbiolo", "Sangiovese", "Syrah"]', NULL, 3,
 'Long-cooked beef pairs with structured, earthy wines', 'The Flavor Bible'),

('Red Meat', 'Lamb', NULL, NULL, '["Red"]', NULL, '["Cabernet Sauvignon", "Syrah", "Tempranillo"]', NULL, 2,
 'Lamb''s gaminess matches with structured, herbal reds', 'CMS'),

('Red Meat', 'Lamb', 'Lamb Chops', 'herb-crusted', '["Red"]', NULL, '["Cabernet Sauvignon", "Syrah", "Tempranillo"]', NULL, 4,
 'Herbal notes in wine complement herb crust', 'Wine Folly'),

('Red Meat', 'Lamb', 'Rack of Lamb', NULL, '["Red"]', '["Bordeaux", "Rioja"]', '["Cabernet Sauvignon", "Tempranillo"]', NULL, 4,
 'Classic pairing with classic wine regions', 'CMS'),

('Red Meat', 'Venison', NULL, NULL, '["Red"]', NULL, '["Pinot Noir", "Syrah"]', NULL, 2,
 'Game meat pairs with earthy, forest-floor notes', 'The Flavor Bible'),

-- POULTRY RULES (specificity 2-4)
('Poultry', 'Chicken', NULL, 'roasted', '["White", "Red"]', NULL, '["Chardonnay", "Pinot Noir"]', NULL, 2,
 'Roast chicken is a bridge wine - works with both colors', 'CMS'),

('Poultry', 'Chicken', NULL, 'fried', '["Sparkling", "Rosé"]', '["Brut"]', '["Chardonnay"]', NULL, 3,
 'Bubbles and acid cut through crispy fried coating', 'Wine Folly'),

('Poultry', 'Chicken', NULL, 'grilled', '["White", "Rosé"]', NULL, '["Chardonnay", "Viognier"]', NULL, 2,
 'Char complements fuller bodied whites', 'The Flavor Bible'),

('Poultry', 'Duck', NULL, NULL, '["Red"]', '["Burgundy"]', '["Pinot Noir"]', NULL, 2,
 'Rich duck fat pairs perfectly with Pinot Noir acidity', 'CMS'),

('Poultry', 'Duck', 'Duck Confit', NULL, '["Red"]', NULL, '["Pinot Noir", "Grenache"]', NULL, 4,
 'Fat-rich confit needs high acid red wines', 'Wine Folly'),

('Poultry', 'Turkey', NULL, NULL, '["White", "Red", "Rosé"]', NULL, '["Pinot Noir", "Zinfandel", "Riesling"]', NULL, 2,
 'Thanksgiving turkey pairs with fruit-forward wines', 'The Flavor Bible'),

-- PORK RULES (specificity 2-4)
('Pork', 'Pork', 'Pork Chops', 'grilled', '["White", "Red"]', NULL, '["Chardonnay", "Pinot Noir"]', NULL, 3,
 'Grilled pork matches oaked Chardonnay or light reds', 'CMS'),

('Pork', 'Pork', 'Pork Belly', NULL, '["White", "Sparkling"]', NULL, '["Riesling", "Gewürztraminer"]', NULL, 4,
 'Fat-rich belly needs high acid to cut through', 'Wine Folly'),

('Pork', 'Pork', 'Prosciutto', NULL, '["Sparkling", "White"]', '["Prosecco"]', '["Glera", "Pinot Grigio"]', NULL, 4,
 'Salty cured ham pairs with light bubbles', 'CMS'),

('Pork', 'Pork', 'Bacon', NULL, '["Red", "Sparkling"]', NULL, '["Pinot Noir", "Chardonnay"]', NULL, 3,
 'Smoky bacon pairs with earthy Pinot or toasty sparkling', 'The Flavor Bible'),

-- CHEESE RULES (specificity 2-4)
('Cheese', 'Soft', NULL, NULL, '["Sparkling", "White"]', '["Champagne"]', '["Chardonnay"]', NULL, 2,
 'Creamy cheeses pair with high-acid wines', 'CMS'),

('Cheese', 'Soft', 'Brie', NULL, '["Sparkling", "White"]', '["Champagne", "Blanc de Blancs"]', '["Chardonnay"]', NULL, 3,
 'Bubbles cut through creamy Brie texture', 'Wine Folly'),

('Cheese', 'Soft', 'Camembert', NULL, '["Sparkling", "Red"]', '["Champagne"]', '["Chardonnay", "Pinot Noir"]', NULL, 3,
 'Earthy Camembert pairs with earthy Pinot', 'The Flavor Bible'),

('Cheese', 'Hard', NULL, NULL, '["Red"]', NULL, '["Cabernet Sauvignon", "Tempranillo"]', NULL, 2,
 'Aged hard cheeses match tannic reds', 'CMS'),

('Cheese', 'Hard', 'Parmigiano-Reggiano', NULL, '["Red", "Sparkling"]', '["Lambrusco"]', '["Sangiovese"]', NULL, 4,
 'Italian cheese with Italian wine - classic pairing', 'Wine Folly'),

('Cheese', 'Hard', 'Manchego', NULL, '["Red"]', '["Rioja"]', '["Tempranillo"]', NULL, 4,
 'Spanish cheese with Spanish wine', 'CMS'),

('Cheese', 'Blue', NULL, NULL, '["Dessert", "Fortified"]', '["Sauternes", "Port"]', NULL, NULL, 2,
 'Sweet wines balance salty, pungent blue cheese', 'Wine Folly'),

('Cheese', 'Blue', 'Roquefort', NULL, '["Dessert"]', '["Sauternes"]', '["Semillon", "Sauvignon Blanc"]', NULL, 4,
 'Classic French pairing: sweet Sauternes with salty Roquefort', 'CMS'),

('Cheese', 'Blue', 'Stilton', NULL, '["Fortified"]', '["Vintage Port"]', NULL, NULL, 4,
 'Classic British pairing after dinner', 'The Flavor Bible'),

('Cheese', 'Goat', NULL, NULL, '["White"]', NULL, '["Sauvignon Blanc"]', NULL, 2,
 'High acid wine matches tangy goat cheese', 'Wine Folly'),

('Cheese', 'Goat', 'Chèvre', NULL, '["White"]', '["Sancerre", "Pouilly-Fumé"]', '["Sauvignon Blanc"]', NULL, 4,
 'Loire Valley classic - local cheese with local wine', 'CMS'),

-- PASTA RULES (specificity 2-4)
('Pasta', NULL, NULL, 'tomato-based', '["Red"]', NULL, '["Sangiovese", "Barbera"]', NULL, 2,
 'Italian wines with Italian food; acidity matches tomato', 'Wine Folly'),

('Pasta', NULL, NULL, 'cream-based', '["White"]', NULL, '["Chardonnay"]', NULL, 2,
 'Rich cream sauce matches rich buttery Chardonnay', 'CMS'),

('Pasta', NULL, NULL, 'pesto', '["White"]', NULL, '["Vermentino", "Sauvignon Blanc"]', NULL, 3,
 'Herbaceous wine matches herbaceous pesto', 'The Flavor Bible'),

('Pasta', NULL, 'Carbonara', NULL, '["White"]', NULL, '["Chardonnay", "Pinot Grigio"]', NULL, 4,
 'Egg and cheese richness needs crisp white', 'Wine Folly'),

('Pasta', NULL, 'Bolognese', NULL, '["Red"]', NULL, '["Sangiovese"]', NULL, 4,
 'Classic ragù pairs with Chianti Classico', 'CMS'),

-- DESSERT RULES (specificity 2-4)
('Desserts', 'Chocolate', NULL, NULL, '["Fortified", "Red"]', '["Port", "Banyuls"]', NULL, NULL, 2,
 'Dark chocolate needs sweet fortified wines', 'Wine Folly'),

('Desserts', 'Chocolate', 'Dark Chocolate', NULL, '["Fortified"]', '["Vintage Port", "Banyuls"]', NULL, NULL, 4,
 'Intense cocoa matches intense Port', 'CMS'),

('Desserts', 'Fruit', NULL, NULL, '["Dessert", "Sparkling"]', '["Moscato d''Asti"]', '["Muscat"]', NULL, 2,
 'Light fruity desserts pair with light sweet wines', 'The Flavor Bible'),

('Desserts', 'Fruit', 'Apple Tart', NULL, '["Dessert"]', '["Late Harvest Riesling"]', '["Riesling"]', NULL, 4,
 'Apple in wine mirrors apple in tart', 'Wine Folly'),

('Desserts', 'Custard', NULL, NULL, '["Dessert"]', '["Sauternes", "Tokaji"]', '["Semillon"]', NULL, 3,
 'Rich custard matches rich botrytis wines', 'CMS'),

('Desserts', 'Custard', 'Crème Brûlée', NULL, '["Dessert"]', '["Sauternes"]', '["Semillon", "Sauvignon Blanc"]', NULL, 4,
 'Caramelized sugar pairs with honeyed Sauternes', 'Wine Folly');

-- =====================================================
-- Intensity Profiles
-- =====================================================

INSERT INTO refIntensityProfiles
(entityType, entityName, weight, richness, acidityNeed, tanninTolerance, sweetnessAffinity) VALUES

-- FOODS
('food', 'Oysters', 0.15, 0.20, 0.90, 0.05, 0.10),
('food', 'Grilled Steak', 0.85, 0.80, 0.40, 0.90, 0.05),
('food', 'Roast Chicken', 0.50, 0.45, 0.60, 0.40, 0.15),
('food', 'Salmon', 0.55, 0.60, 0.55, 0.30, 0.10),
('food', 'Lobster', 0.45, 0.70, 0.65, 0.10, 0.15),
('food', 'Lamb Chops', 0.75, 0.70, 0.50, 0.80, 0.05),
('food', 'Duck Confit', 0.70, 0.85, 0.70, 0.50, 0.10),
('food', 'Pork Belly', 0.65, 0.90, 0.80, 0.30, 0.20),
('food', 'Mushroom Risotto', 0.55, 0.65, 0.50, 0.40, 0.10),
('food', 'Grilled Vegetables', 0.35, 0.30, 0.60, 0.25, 0.15),
('food', 'Foie Gras', 0.60, 0.95, 0.70, 0.10, 0.80),
('food', 'Dark Chocolate', 0.50, 0.75, 0.30, 0.40, 0.90),

-- WINE TYPES
('wine_type', 'Sparkling', 0.20, 0.25, NULL, NULL, NULL),
('wine_type', 'White', 0.35, 0.40, NULL, NULL, NULL),
('wine_type', 'Rosé', 0.40, 0.35, NULL, NULL, NULL),
('wine_type', 'Red', 0.70, 0.65, NULL, NULL, NULL),
('wine_type', 'Dessert', 0.55, 0.80, NULL, NULL, NULL),
('wine_type', 'Fortified', 0.75, 0.85, NULL, NULL, NULL),

-- GRAPES
('grape', 'Cabernet Sauvignon', 0.85, 0.75, NULL, NULL, NULL),
('grape', 'Pinot Noir', 0.40, 0.45, NULL, NULL, NULL),
('grape', 'Merlot', 0.65, 0.60, NULL, NULL, NULL),
('grape', 'Syrah', 0.80, 0.70, NULL, NULL, NULL),
('grape', 'Chardonnay', 0.55, 0.55, NULL, NULL, NULL),
('grape', 'Sauvignon Blanc', 0.30, 0.25, NULL, NULL, NULL),
('grape', 'Riesling', 0.25, 0.30, NULL, NULL, NULL);

-- =====================================================
-- Wine Styles (~40 styles)
-- =====================================================

INSERT INTO refWineStyles
(styleName, wineType, description, characteristics, typicalGrapes, typicalRegions, servingTemp) VALUES

-- SPARKLING STYLES
('Blanc de Blancs', 'Sparkling', 'White sparkling wine made exclusively from white grapes, typically Chardonnay',
 '{"body": "light", "acidity": "high", "sweetness": "dry", "bubbles": "fine"}',
 '["Chardonnay"]', '["Champagne", "California", "England"]', '6-8°C'),

('Blanc de Noirs', 'Sparkling', 'White sparkling wine made from red grapes (Pinot Noir and/or Pinot Meunier)',
 '{"body": "medium", "acidity": "high", "sweetness": "dry", "bubbles": "fine"}',
 '["Pinot Noir", "Pinot Meunier"]', '["Champagne"]', '6-8°C'),

('Brut', 'Sparkling', 'Dry sparkling wine with minimal residual sugar (less than 12g/L)',
 '{"body": "light", "acidity": "high", "sweetness": "dry", "bubbles": "fine"}',
 '["Chardonnay", "Pinot Noir", "Pinot Meunier"]', '["Champagne", "Cava", "Franciacorta"]', '6-8°C'),

('Brut Nature', 'Sparkling', 'Bone-dry sparkling wine with no dosage added (less than 3g/L sugar)',
 '{"body": "light", "acidity": "very high", "sweetness": "bone-dry", "bubbles": "fine"}',
 '["Chardonnay", "Pinot Noir"]', '["Champagne"]', '6-8°C'),

('Brut Rosé', 'Sparkling', 'Dry pink sparkling wine, made by blending or maceration',
 '{"body": "light", "acidity": "high", "sweetness": "dry", "bubbles": "fine"}',
 '["Pinot Noir", "Chardonnay"]', '["Champagne", "Franciacorta"]', '6-8°C'),

('Prosecco', 'Sparkling', 'Italian sparkling wine made from Glera grape using tank method',
 '{"body": "light", "acidity": "medium", "sweetness": "off-dry", "bubbles": "frothy"}',
 '["Glera"]', '["Veneto", "Friuli"]', '6-8°C'),

('Cava', 'Sparkling', 'Spanish sparkling wine made using traditional method',
 '{"body": "light", "acidity": "high", "sweetness": "dry", "bubbles": "fine"}',
 '["Macabeo", "Parellada", "Xarel-lo"]', '["Penedès", "Catalunya"]', '6-8°C'),

-- WHITE STYLES
('Oaked Chardonnay', 'White', 'Full-bodied white wine aged in oak barrels with MLF',
 '{"body": "full", "acidity": "medium", "sweetness": "dry", "oak": "heavy"}',
 '["Chardonnay"]', '["Burgundy", "California", "Australia"]', '10-13°C'),

('Unoaked Chardonnay', 'White', 'Crisp, fruit-forward white without oak influence',
 '{"body": "medium", "acidity": "medium-high", "sweetness": "dry", "oak": "none"}',
 '["Chardonnay"]', '["Chablis", "Chile", "New Zealand"]', '8-10°C'),

('Crisp White', 'White', 'High-acid, refreshing white wine with citrus and green notes',
 '{"body": "light", "acidity": "high", "sweetness": "dry"}',
 '["Sauvignon Blanc", "Albariño", "Muscadet"]', '["Loire Valley", "New Zealand", "Galicia"]', '6-8°C'),

('Aromatic White', 'White', 'Intensely perfumed white wine with floral and fruit aromas',
 '{"body": "light to medium", "acidity": "medium", "sweetness": "off-dry to sweet"}',
 '["Gewürztraminer", "Muscat", "Torrontés"]', '["Alsace", "Germany", "Argentina"]', '8-10°C'),

('Rich White', 'White', 'Full-bodied white with weight and texture',
 '{"body": "full", "acidity": "medium-low", "sweetness": "dry"}',
 '["Viognier", "Marsanne", "Roussanne"]', '["Rhône Valley", "California"]', '10-12°C'),

-- RED STYLES
('Light Red', 'Red', 'Delicate red wine with soft tannins and bright fruit',
 '{"body": "light", "tannin": "low", "acidity": "high", "sweetness": "dry"}',
 '["Pinot Noir", "Gamay", "Schiava"]', '["Burgundy", "Beaujolais", "Alto Adige"]', '14-16°C'),

('Medium Red', 'Red', 'Balanced red with moderate tannins and fruit',
 '{"body": "medium", "tannin": "medium", "acidity": "medium", "sweetness": "dry"}',
 '["Merlot", "Sangiovese", "Grenache"]', '["Bordeaux", "Tuscany", "Rhône"]', '16-18°C'),

('Full-Bodied Red', 'Red', 'Powerful red with firm tannins and concentrated fruit',
 '{"body": "full", "tannin": "high", "acidity": "medium", "sweetness": "dry"}',
 '["Cabernet Sauvignon", "Syrah", "Nebbiolo"]', '["Napa Valley", "Barossa", "Piedmont"]', '17-19°C'),

('Bordeaux Blend', 'Red', 'Classic blend dominated by Cabernet Sauvignon or Merlot',
 '{"body": "full", "tannin": "high", "acidity": "medium", "sweetness": "dry"}',
 '["Cabernet Sauvignon", "Merlot", "Cabernet Franc"]', '["Bordeaux", "Napa Valley", "Chile"]', '17-18°C'),

('Rhône Blend', 'Red', 'Southern Rhône style blend based on Grenache',
 '{"body": "medium-full", "tannin": "medium", "acidity": "medium", "sweetness": "dry"}',
 '["Grenache", "Syrah", "Mourvèdre"]', '["Châteauneuf-du-Pape", "Gigondas", "Australia"]', '16-18°C'),

('Super Tuscan', 'Red', 'Tuscan wine blending Italian and international varieties',
 '{"body": "full", "tannin": "high", "acidity": "medium-high", "sweetness": "dry"}',
 '["Sangiovese", "Cabernet Sauvignon", "Merlot"]', '["Tuscany"]', '17-18°C'),

-- ROSÉ STYLES
('Provence Rosé', 'Rosé', 'Pale, dry rosé with delicate flavors',
 '{"body": "light", "acidity": "high", "sweetness": "dry"}',
 '["Grenache", "Cinsault", "Mourvèdre"]', '["Provence"]', '8-10°C'),

('Tavel', 'Rosé', 'Fuller-bodied, more structured rosé',
 '{"body": "medium", "acidity": "medium", "sweetness": "dry"}',
 '["Grenache", "Cinsault"]', '["Tavel", "Rhône"]', '10-12°C'),

-- DESSERT STYLES
('Late Harvest', 'Dessert', 'Sweet wine from late-picked grapes with concentrated sugar',
 '{"body": "medium", "acidity": "high", "sweetness": "sweet"}',
 '["Riesling", "Gewürztraminer", "Semillon"]', '["Alsace", "Germany", "California"]', '6-8°C'),

('Botrytis', 'Dessert', 'Sweet wine from grapes affected by noble rot',
 '{"body": "full", "acidity": "high", "sweetness": "very sweet"}',
 '["Semillon", "Sauvignon Blanc", "Furmint"]', '["Sauternes", "Tokaji", "Loire"]', '6-8°C'),

('Ice Wine', 'Dessert', 'Sweet wine from grapes frozen on the vine',
 '{"body": "medium", "acidity": "very high", "sweetness": "very sweet"}',
 '["Riesling", "Vidal"]', '["Canada", "Germany"]', '6-8°C'),

-- FORTIFIED STYLES
('Vintage Port', 'Fortified', 'Aged vintage port from a single year',
 '{"body": "full", "tannin": "high", "sweetness": "sweet", "fortified": true}',
 '["Touriga Nacional", "Tinta Roriz", "Touriga Franca"]', '["Douro"]', '16-18°C'),

('Tawny Port', 'Fortified', 'Barrel-aged port with oxidative character',
 '{"body": "medium", "sweetness": "sweet", "fortified": true}',
 '["Touriga Nacional", "Tinta Roriz"]', '["Douro"]', '12-14°C'),

('Fino Sherry', 'Fortified', 'Dry, pale sherry aged under flor',
 '{"body": "light", "acidity": "high", "sweetness": "dry", "fortified": true}',
 '["Palomino"]', '["Jerez"]', '7-9°C'),

('Amontillado', 'Fortified', 'Sherry aged under flor then oxidatively',
 '{"body": "medium", "acidity": "medium", "sweetness": "dry", "fortified": true}',
 '["Palomino"]', '["Jerez"]', '12-14°C'),

('Oloroso', 'Fortified', 'Rich, oxidatively aged dry sherry',
 '{"body": "full", "acidity": "medium", "sweetness": "dry", "fortified": true}',
 '["Palomino"]', '["Jerez"]', '12-14°C'),

('PX Sherry', 'Fortified', 'Intensely sweet sherry from dried Pedro Ximénez grapes',
 '{"body": "full", "sweetness": "very sweet", "fortified": true}',
 '["Pedro Ximénez"]', '["Jerez", "Montilla-Moriles"]', '12-14°C');

-- =====================================================
-- Appellations (Key wine regions)
-- =====================================================

INSERT INTO refAppellations
(appellationName, country, region, subRegion, wineTypes, primaryGrapes, classificationLevel) VALUES

-- FRANCE
('Bordeaux', 'France', 'Bordeaux', NULL, '["Red", "White"]', '["Cabernet Sauvignon", "Merlot", "Sauvignon Blanc"]', 'AOC'),
('Margaux', 'France', 'Bordeaux', 'Médoc', '["Red"]', '["Cabernet Sauvignon", "Merlot"]', 'AOC'),
('Pauillac', 'France', 'Bordeaux', 'Médoc', '["Red"]', '["Cabernet Sauvignon", "Merlot"]', 'AOC'),
('Saint-Émilion', 'France', 'Bordeaux', 'Right Bank', '["Red"]', '["Merlot", "Cabernet Franc"]', 'AOC'),
('Pomerol', 'France', 'Bordeaux', 'Right Bank', '["Red"]', '["Merlot", "Cabernet Franc"]', 'AOC'),
('Sauternes', 'France', 'Bordeaux', NULL, '["Dessert"]', '["Semillon", "Sauvignon Blanc"]', 'AOC'),

('Champagne', 'France', 'Champagne', NULL, '["Sparkling"]', '["Chardonnay", "Pinot Noir", "Pinot Meunier"]', 'AOC'),

('Burgundy', 'France', 'Burgundy', NULL, '["Red", "White"]', '["Pinot Noir", "Chardonnay"]', 'AOC'),
('Chablis', 'France', 'Burgundy', 'Chablis', '["White"]', '["Chardonnay"]', 'AOC'),
('Côte de Nuits', 'France', 'Burgundy', NULL, '["Red"]', '["Pinot Noir"]', 'AOC'),
('Côte de Beaune', 'France', 'Burgundy', NULL, '["Red", "White"]', '["Pinot Noir", "Chardonnay"]', 'AOC'),

('Northern Rhône', 'France', 'Rhône Valley', NULL, '["Red", "White"]', '["Syrah", "Viognier"]', 'AOC'),
('Côte-Rôtie', 'France', 'Rhône Valley', 'Northern Rhône', '["Red"]', '["Syrah", "Viognier"]', 'AOC'),
('Hermitage', 'France', 'Rhône Valley', 'Northern Rhône', '["Red", "White"]', '["Syrah", "Marsanne", "Roussanne"]', 'AOC'),
('Châteauneuf-du-Pape', 'France', 'Rhône Valley', 'Southern Rhône', '["Red", "White"]', '["Grenache", "Syrah", "Mourvèdre"]', 'AOC'),

('Loire Valley', 'France', 'Loire Valley', NULL, '["White", "Red", "Rosé", "Sparkling"]', '["Sauvignon Blanc", "Chenin Blanc", "Cabernet Franc"]', 'AOC'),
('Sancerre', 'France', 'Loire Valley', 'Central Loire', '["White", "Red"]', '["Sauvignon Blanc", "Pinot Noir"]', 'AOC'),
('Vouvray', 'France', 'Loire Valley', 'Touraine', '["White", "Sparkling"]', '["Chenin Blanc"]', 'AOC'),

('Alsace', 'France', 'Alsace', NULL, '["White"]', '["Riesling", "Gewürztraminer", "Pinot Gris"]', 'AOC'),
('Provence', 'France', 'Provence', NULL, '["Rosé", "Red", "White"]', '["Grenache", "Cinsault", "Mourvèdre"]', 'AOC'),

-- ITALY
('Piedmont', 'Italy', 'Piedmont', NULL, '["Red", "White", "Sparkling"]', '["Nebbiolo", "Barbera", "Moscato"]', 'DOCG'),
('Barolo', 'Italy', 'Piedmont', NULL, '["Red"]', '["Nebbiolo"]', 'DOCG'),
('Barbaresco', 'Italy', 'Piedmont', NULL, '["Red"]', '["Nebbiolo"]', 'DOCG'),

('Tuscany', 'Italy', 'Tuscany', NULL, '["Red", "White"]', '["Sangiovese", "Trebbiano"]', 'DOC'),
('Chianti Classico', 'Italy', 'Tuscany', 'Chianti', '["Red"]', '["Sangiovese"]', 'DOCG'),
('Brunello di Montalcino', 'Italy', 'Tuscany', 'Montalcino', '["Red"]', '["Sangiovese"]', 'DOCG'),
('Bolgheri', 'Italy', 'Tuscany', NULL, '["Red"]', '["Cabernet Sauvignon", "Merlot", "Sangiovese"]', 'DOC'),

('Veneto', 'Italy', 'Veneto', NULL, '["Red", "White", "Sparkling"]', '["Corvina", "Garganega", "Glera"]', 'DOC'),
('Prosecco', 'Italy', 'Veneto', NULL, '["Sparkling"]', '["Glera"]', 'DOC'),
('Amarone della Valpolicella', 'Italy', 'Veneto', 'Valpolicella', '["Red"]', '["Corvina", "Rondinella", "Molinara"]', 'DOCG'),

-- SPAIN
('Rioja', 'Spain', 'Rioja', NULL, '["Red", "White"]', '["Tempranillo", "Garnacha", "Viura"]', 'DOCa'),
('Ribera del Duero', 'Spain', 'Castilla y León', NULL, '["Red"]', '["Tempranillo"]', 'DO'),
('Priorat', 'Spain', 'Catalonia', NULL, '["Red"]', '["Garnacha", "Cariñena"]', 'DOCa'),
('Rías Baixas', 'Spain', 'Galicia', NULL, '["White"]', '["Albariño"]', 'DO'),
('Jerez', 'Spain', 'Andalusia', NULL, '["Fortified"]', '["Palomino", "Pedro Ximénez"]', 'DO'),

-- USA
('Napa Valley', 'USA', 'California', NULL, '["Red", "White"]', '["Cabernet Sauvignon", "Chardonnay"]', 'AVA'),
('Sonoma County', 'USA', 'California', NULL, '["Red", "White"]', '["Pinot Noir", "Chardonnay", "Zinfandel"]', 'AVA'),
('Willamette Valley', 'USA', 'Oregon', NULL, '["Red", "White"]', '["Pinot Noir", "Pinot Gris"]', 'AVA'),

-- AUSTRALIA
('Barossa Valley', 'Australia', 'South Australia', NULL, '["Red", "White"]', '["Shiraz", "Grenache", "Riesling"]', 'GI'),
('McLaren Vale', 'Australia', 'South Australia', NULL, '["Red"]', '["Shiraz", "Grenache"]', 'GI'),
('Margaret River', 'Australia', 'Western Australia', NULL, '["Red", "White"]', '["Cabernet Sauvignon", "Chardonnay"]', 'GI'),

-- NEW ZEALAND
('Marlborough', 'New Zealand', 'South Island', NULL, '["White"]', '["Sauvignon Blanc", "Pinot Noir"]', 'GI'),
('Central Otago', 'New Zealand', 'South Island', NULL, '["Red"]', '["Pinot Noir"]', 'GI'),

-- ARGENTINA
('Mendoza', 'Argentina', 'Mendoza', NULL, '["Red", "White"]', '["Malbec", "Torrontés"]', NULL),

-- PORTUGAL
('Douro', 'Portugal', 'Douro', NULL, '["Red", "Fortified"]', '["Touriga Nacional", "Tinta Roriz"]', 'DOC'),

-- GERMANY
('Mosel', 'Germany', 'Mosel', NULL, '["White"]', '["Riesling"]', 'QbA'),
('Rheingau', 'Germany', 'Rheingau', NULL, '["White"]', '["Riesling"]', 'QbA');

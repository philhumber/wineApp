# Wine Education Content Strategy

**Last Updated**: 2026-02-09
**Author**: Wine Teacher (Content Strategist)
**Status**: Design Document

---

## 1. Philosophy: The Qve Approach to Wine Education

Wine education fails when it becomes homework. The best wine knowledge is absorbed the way you learn about music -- by listening, by caring about what you like, by following threads of curiosity until you realize you know more than you thought.

Qve's Learn feature should feel like sitting at a wine bar next to someone who has been everywhere, tasted everything, and is genuinely interested in what *you* think. Not a lecture hall. Not a textbook. Not a certification prep course. A conversation.

**Three principles:**

1. **Personal first, general second.** Every piece of education should connect to the user's actual cellar, drinking history, or taste preferences. "You have three Nebbiolos in your cellar -- here's what makes them tick" lands differently than "Nebbiolo is a grape from Piedmont."

2. **Curiosity over completeness.** We are not building a wine encyclopedia. We are building a trail of breadcrumbs that makes people want to know more. A great "Did you know?" is worth more than a thorough chapter.

3. **Respect the drinker.** No gatekeeping. No "you should know this." Whether someone drinks exclusively natural wine or exclusively supermarket Pinot Grigio, they deserve the same quality of attention. Quentin's dry wit sets the tone: knowledgeable without being insufferable.

---

## 2. Existing Data Assets

The app already holds a remarkable educational dataset that most wine apps would envy. Everything below exists in the database and can be surfaced without any new API calls.

### Reference Tables (Immediate Content)

| Table | Records | Educational Use |
|-------|---------|-----------------|
| `refGrapeCharacteristics` | 29 varieties | Flavor profiles, body, tannin, acidity, pairings, aging potential |
| `refAppellations` | 47 appellations | Region deep-dives, classification systems, grape associations |
| `refWineStyles` | 30 styles | Style guides, serving temps, typical regions & grapes |
| `refPairingRules` | 58 rules | Food pairing engine, reasoning explanations |
| `refIntensityProfiles` | 25 entries | Weight/richness matching, interactive pairing tool |
| `country` | 33 countries | Wine history, classification systems, key grapes, vineyard area, world ranking |
| `grapes` | 42 varieties | Rich descriptions with origin stories and growing characteristics |
| `refAbbreviations` | 22 entries | "What does Ch. mean?" decode-the-label tool |

### User-Specific Data (Personalization Hooks)

| Source | Personalization |
|--------|-----------------|
| `wine` + `grapemix` | "Your cellar is 60% Bordeaux blends -- here's why that matters" |
| `ratings` (overall, value, complexity, drinkability, surprise, food pairing) | Taste profile construction |
| `bottles` (source, price, currency) | Price bracket insights, value scoring |
| `cacheWineEnrichment` | Style profiles, critic scores, drink windows, overviews, tasting notes |
| `agentUserTasteProfile` | Computed preferences for grapes, countries, styles |
| `ratings.buyAgain` | "You'd buy this again -- here's what it has in common with your other favorites" |

### Enrichment Data (AI-Generated, Cached)

The `EnrichmentData` object already provides per-wine:
- Grape varieties with percentages
- Appellation context
- Critic scores (WS, RP, JS, Decanter)
- Drink window (start/end year)
- Style profile (body, tannin, acidity, sweetness)
- Production method notes
- Overview narrative, tasting notes, and pairing suggestions

This is an enormous head start. Most of the "deep dive" content for any individual wine is already being generated and cached.

---

## 3. Full Curriculum Outline

### Module 1: The Foundations (Beginner)

| Topic | Content | Data Source |
|-------|---------|-------------|
| 1.1 The Six Styles | Sparkling, White, Rose, Red, Dessert, Fortified -- what makes each one | `refWineStyles`, `winetype` |
| 1.2 How to Taste | See, Swirl, Sniff, Sip, Savor -- with guided exercises | New content |
| 1.3 The Big Six Grapes | Cab Sav, Merlot, Pinot Noir, Chardonnay, Sauvignon Blanc, Riesling | `refGrapeCharacteristics`, `grapes` |
| 1.4 Reading a Label | What the words actually mean (Reserva, Grand Cru, Estate) | `refAbbreviations`, `refAppellations` |
| 1.5 Temperature & Glassware | Serving fundamentals that actually matter | `refWineStyles.servingTemp` |
| 1.6 Basic Food Pairing | The 4 principles: weight, acid, tannin, sweetness | `refPairingRules` (specificity=1) |

### Module 2: The Grapes (Intermediate)

| Topic | Content | Data Source |
|-------|---------|-------------|
| 2.1 Red Grapes Deep Dive | 15 red varieties: flavors, regions, aging, pairings | `refGrapeCharacteristics` (color=red) |
| 2.2 White Grapes Deep Dive | 13 white varieties plus Grenache Rose | `refGrapeCharacteristics` (color=white/pink) |
| 2.3 The Chameleon Grapes | How Chardonnay, Pinot Grigio, Grenache change with climate | Cross-ref `refGrapeCharacteristics` + `refAppellations` |
| 2.4 Blending: Why Mix? | Bordeaux blends, GSM, Amarone assemblage | `refWineStyles` (Bordeaux Blend, Rhone Blend, etc.) |
| 2.5 Indigenous & Rare | Assyrtiko, Xinomavro, Tribidrag, Tannat, Furmint | `country.keyGrapes` for non-major nations |
| 2.6 Same Grape, Different Name | Syrah/Shiraz, Pinot Grigio/Gris, Grenache/Garnacha | `refGrapeCharacteristics.alternateNames` |

### Module 3: The Regions (Intermediate)

| Topic | Content | Data Source |
|-------|---------|-------------|
| 3.1 Old World Essentials | France, Italy, Spain -- why they matter | `country` (FR, IT, ES) + `refAppellations` |
| 3.2 Beyond the Big Three | Portugal, Germany, Austria, Greece, Hungary | `country` wine history & classification |
| 3.3 New World Rising | USA, Australia, NZ, Argentina, Chile, South Africa | `country` (New World entries) |
| 3.4 The Frontier | Georgia (qvevri!), Croatia (Zinfandel origins), Lebanon, Slovenia | `country` (emerging) |
| 3.5 Classification Decoded | AOC vs DOC vs AVA vs GI -- what it all means | `country.classificationSystem` |
| 3.6 Terroir: Beyond Buzzword | Climate, soil, altitude, aspect -- how place shapes taste | New content + `region` (climate, soil) |

### Module 4: The Craft (Advanced)

| Topic | Content | Data Source |
|-------|---------|-------------|
| 4.1 Winemaking Decisions | Skin contact, oak, MLF, lees aging, carbonic maceration | `cacheWineEnrichment.productionMethod` |
| 4.2 Aging & Cellaring | When to drink, how to store, what improves | `refGrapeCharacteristics.agingPotential`, enrichment drink windows |
| 4.3 Vintage Variation | Why year matters (and when it doesn't) | `wine.year`, `wine.isNonVintage` |
| 4.4 Understanding Critics | What scores mean, who the critics are, why they disagree | `cacheWineEnrichment.criticScores` |
| 4.5 Buying Smart | Value vs price, when to splurge, finding hidden gems | User's `bottles.price` + `ratings` data |
| 4.6 Advanced Pairing | Intensity matching, bridging, contrasting, regional pairing | `refIntensityProfiles`, `refPairingRules` (specificity 3-5) |

### Module 5: The Culture (Expert / Ongoing)

| Topic | Content | Data Source |
|-------|---------|-------------|
| 5.1 Wine & History | Phylloxera, Prohibition, Judgment of Paris, the 1985 Austrian scandal | `country.wineHistory` + curated stories |
| 5.2 Natural, Organic, Biodynamic | What the terms actually mean | `cacheProducers.certifications` |
| 5.3 Wine Scandals & Mysteries | Rudy Kurniawan, Jefferson bottles, Brunellopoli | Curated editorial content |
| 5.4 The Business of Wine | How pricing works, en primeur, auction markets | Contextual + `cacheWineEnrichment.averagePrice` |
| 5.5 Climate & the Future | How warming changes wine maps | `country.totalVineyardHectares` + trends |

---

## 4. Learning Paths

Five curated journeys for different user types, each unlockable from the Learn landing page.

### Path A: "The Confident Beginner"
**For**: Someone who drinks wine regularly but wants to sound less uncertain at a restaurant.
**Duration**: 10 sessions, 5 min each
**Covers**: Module 1 in full + key parts of Module 2 (Big Six grapes)
**Outcome**: Can describe what they like, read a label, and order with confidence.

### Path B: "The Explorer"
**For**: Intermediate drinker stuck in a rut (always buys the same thing).
**Duration**: 12 sessions, 5-7 min each
**Covers**: Module 2 (indigenous grapes, blending) + Module 3 (regions beyond France)
**Outcome**: Knows 5 new grapes, 3 new regions, and has added something unexpected to their cellar.
**Personalization**: Analyzes their cellar to identify blind spots. "You've never tried a white from the Rhone. Let's fix that."

### Path C: "The Dinner Party Host"
**For**: Someone who wants to pair wine with food confidently.
**Duration**: 8 sessions, 5 min each
**Covers**: Module 1.6 (basics), Module 4.6 (advanced), plus dedicated pairing scenarios
**Outcome**: Can pair wine to any meal, explain why, and impress guests without being pretentious.
**Personalization**: Uses their actual cellar to suggest pairings for common meals.

### Path D: "The Collector"
**For**: Someone building a serious cellar who wants to understand aging, vintages, and value.
**Duration**: 10 sessions, 7-10 min each
**Covers**: Module 4 in full + Module 5.4 (business)
**Outcome**: Understands drink windows, vintage variation, critic scores, and when a wine is "worth it."
**Personalization**: Drink window alerts for their actual bottles. "Your 2018 Barolo enters its window in 2028."

### Path E: "The Storyteller"
**For**: Someone who wants the *culture* -- the history, scandals, personalities, and weirdness of wine.
**Duration**: Ongoing weekly drops
**Covers**: Module 5 + curated stories from across all modules
**Outcome**: Becomes the person at the dinner table with the fascinating wine fact.
**No prerequisites**: Can start here even as a beginner.

---

## 5. Content Formats

### 5.1 Quick Fact Cards (30-60 seconds)
Single-screen, swipeable cards with one surprising fact and a visual.

**Examples:**
- "Champagne pressure is roughly 3x the pressure in your car tires."
- "Nebbiolo gets its name from 'nebbia' (fog) because it ripens late, when autumn mist rolls through Piedmont."
- "The 'legs' on your glass? They tell you about alcohol content, not quality. Stop swirling so dramatically."

**Source**: Can be auto-generated from `grapes.description`, `country.wineHistory`, `refGrapeCharacteristics.primaryFlavors`.

### 5.2 Deep Dives (5-10 minutes)
Scrollable long-form articles with embedded images, maps, and interactive elements.

**Examples:**
- "The Loire Valley: France's Secret Weapon" -- covers Sancerre, Vouvray, Muscadet with map
- "Nebbiolo: The Diva Grape" -- why it's difficult, where it thrives, Barolo vs Barbaresco
- "Understanding Bordeaux Classifications" -- 1855, why it still matters, who got snubbed

### 5.3 Comparison Cards ("This vs That")
Side-by-side comparisons that clarify confusing pairs.

**Examples:**
- **Pinot Grigio vs Pinot Gris** -- Same grape, different philosophy (data from `refGrapeCharacteristics` id=19, `alternateNames`)
- **Barolo vs Barbaresco** -- Same grape (Nebbiolo), different personality (from `refAppellations` ids 22, 23)
- **Champagne vs Prosecco vs Cava** -- Method matters (from `refWineStyles` ids 3, 6, 7)
- **Old World vs New World Chardonnay** -- Climate shapes everything (from `refWineStyles` ids 8, 9)

### 5.4 Tasting Challenges
Guided exercises users can do at home.

**Examples:**
- "The Acid Test": Squeeze lemon into water at 3 concentrations. Taste each. Now taste your wine. Where does it fall? Now you can talk about acidity.
- "The Tannin Test": Brew black tea for 1 min, 3 min, 10 min. Taste the progression. That drying sensation? That's tannin.
- "Blind Taste Your Cellar": Pick 2 wines from your collection. Pour without looking at labels. Can you identify them? (pulls from `wine` table)
- "The Temperature Experiment": Pour the same wine at fridge-cold, cool, and room temp. Notice how flavors change. (references `refWineStyles.servingTemp`)

### 5.5 Stories & Scandals
Narrative-driven content that reads like a magazine feature.

**Examples:**
- "The Judgment of Paris, 1976" -- How two California wines changed everything (linked to `country` US entry)
- "Rudy Kurniawan: The Wine Counterfeiter" -- The con artist who fooled billionaires
- "The Austrian Antifreeze Scandal" -- How disaster led to the strictest wine laws in the world (linked to `country` AT entry: "rebuilt its reputation after a 1985 wine scandal")
- "The 8,000-Year-Old Winery" -- Georgia's qvevri and why clay pots are back (linked to `country` GE entry)
- "Phylloxera: The Bug That Almost Killed Wine" -- And the American roots that saved it

### 5.6 Interactive Maps
Region-level maps with tap-to-explore appellations, grapes, and climate data.

**Data source**: `refAppellations` (47 regions with country, sub-region, grapes, classification) + `country` (33 nations with vineyard hectares, ranking, key grapes)

**Interaction pattern**: Country > Region > Appellation > Key wines in user's cellar from that appellation

### 5.7 Flavor Wheels
Interactive radial diagrams showing flavor relationships.

**Data source**: `refGrapeCharacteristics.primaryFlavors` and `secondaryFlavors` (JSON arrays)

**Example**: Tap Cabernet Sauvignon > see primary flavors (blackcurrant, cedar, tobacco, dark cherry, graphite) radiating out > tap "cedar" > see which other grapes share cedar notes > discover connections.

### 5.8 Pairing Scenarios
"What should I drink with...?" interactive tool.

**Data source**: Full `refPairingRules` hierarchy (58 rules, specificity 1-5) + `refIntensityProfiles`

**Example flow**:
1. User selects: "Seafood" > "Shellfish" > "Oysters" > "raw"
2. App shows: Champagne, Chablis, Muscadet -- with reasoning ("Mineral, crisp wines echo ocean brininess")
3. Cross-references user's cellar: "You have a Sancerre that would work beautifully here"

### 5.9 Quizzes
Short, personality-driven quizzes that teach through testing.

**Examples:**
- "Name That Grape" -- Given flavor descriptors, identify the grape (data from `refGrapeCharacteristics.primaryFlavors`)
- "Old World or New World?" -- Given wine characteristics, guess the origin
- "What's the Pairing?" -- Given a dish, pick the best wine match (data from `refPairingRules`)
- "Decode the Label" -- Given abbreviations, expand them (data from `refAbbreviations`)

### 5.10 Timeline / History Cards
Chronological narratives that bring wine history to life.

**Data source**: `country.wineHistory` across 33 nations provides rich timeline material:
- 6000 BC: Georgia begins fermenting in qvevri
- 3000 BC: Phoenicians plant vines in Lebanon
- 1756: Portugal demarcates the Douro -- world's first appellation
- 1855: Bordeaux classification (still used today)
- 1976: Judgment of Paris
- 1985: Austrian wine scandal
- 2013: UNESCO inscribes Georgian qvevri method
- 2022: Sussex PDO awarded (English sparkling arrives)

### 5.11 Cellar Insights (Data-Driven)
Personalized analytics cards generated from the user's own collection.

**Examples:**
- "Your Cellar Profile": Pie charts of types, countries, grapes, price ranges
- "Your Taste DNA": Based on ratings -- what you consistently love (high acidity? full body? buy-again patterns?)
- "Diversity Score": How varied is your collection? Suggestions to explore gaps
- "Drink Window Dashboard": Which bottles are in their window now, approaching, or past peak
- "Value Map": Your best-rated wines plotted against price -- where's the sweet spot?

---

## 6. "Wine Moments" -- Contextual Micro-Learning

The most powerful learning happens at the point of curiosity. Wine Moments are small educational nudges triggered by user actions.

### Trigger: User Views a Wine
- **Grape spotlight**: "This wine is 100% Nebbiolo -- the 'fog grape' of Piedmont. [Learn about Nebbiolo]"
- **Region intro**: "Barolo DOCG is one of Italy's strictest appellations. Only Nebbiolo, only here. [Explore Barolo]"
- **Drink window**: "This 2019 vintage enters its ideal window in 2027. [Why drink windows matter]"
- **Style context**: "Body: Full | Tannin: High | Acidity: High -- the hallmarks of a wine built for decades. [Understanding structure]"

**Data sources**: `cacheWineEnrichment`, `refAppellations`, `refGrapeCharacteristics`

### Trigger: User Rates a Wine
- **After high rating (8+)**: "You gave this a 9. Looking at your top-rated wines, you seem to love [high acidity / full body / X]. [Discover your palate]"
- **After low rating**: "Not every bottle is a winner. Here's how to identify what you don't like -- and avoid it next time. [Understanding your preferences]"
- **After "Buy Again = Yes"**: "Your buy-again wines share something interesting: [pattern]. [See your taste profile]"
- **After rating complexity/drinkability**: "You rated complexity 5/5. You might be ready for [recommendation]. [What is complexity?]"

**Data source**: `ratings` table, `agentUserTasteProfile`

### Trigger: User Adds a Wine from a New Country
- **Welcome card**: "Welcome to [Country]! [wineHistory excerpt]. You now have wines from [N] countries. [Explore country]"
- **Classification hint**: "In [Country], the classification system works like this: [classificationSystem excerpt]"

**Data source**: `country` table (wineHistory, classificationSystem, keyGrapes)

### Trigger: User Opens the App at Mealtime
- **Dinner prompt** (6-9 PM): "Planning dinner? Tell me what you're cooking and I'll find the perfect bottle from your cellar."
- **Weekend browse** (Saturday afternoon): "Weekend browsing? Here's a grape you haven't tried yet from your wishlist region."

### Trigger: User Drinks Their Last Bottle of a Wine
- **Scarcity moment**: "That was your last bottle of [wine]. Before it fades from memory -- what made it special? [Rate it]"

### Trigger: Seasonal
- **Summer**: "Rose season is here. Your cellar has [N] bottles ready for warm weather."
- **Harvest** (September): "Right now, grapes are being picked across the Northern Hemisphere. Here's what harvest looks like."
- **Holidays** (December): "Champagne isn't just for celebrations. Here's how to make it an everyday pleasure."

---

## 7. Personalization Hooks

Every education feature should feel like it was written for *this* user. Here's how we connect learning to their actual data.

### 7.1 Cellar-Aware Content
- Deep dives reference wines the user actually owns: "You have 3 wines from this region"
- Comparisons use their bottles when possible: "Your 2019 Barolo vs your 2018 Barbaresco"
- Grape guides highlight: "Sangiovese makes up 35% of your cellar" vs showing grapes they've never encountered

### 7.2 Taste Profile Matching
- `agentUserTasteProfile` stores computed preferences for types, countries, grapes, styles
- `ratings` data (especially `buyAgain`, `complexityRating`, `drinkabilityRating`) reveals hidden preferences
- "Based on your ratings, you tend to prefer wines with high acidity and medium body -- you might love Barbera"

### 7.3 Knowledge Level Inference
- **No ratings + small cellar**: Beginner content, more explanation
- **Many ratings + diverse cellar**: Intermediate, skip basics
- **High complexity ratings + broad regions**: Advanced, deep technical content
- Users can self-declare level or let the app infer it

### 7.4 Gap Analysis
Compare user's cellar against the full `refGrapeCharacteristics` and `refAppellations` tables:
- "You've explored 8 of 29 grape varieties we track. Here are 5 that match your taste."
- "Your cellar spans 4 countries. Here are 3 more regions that grow what you love."

---

## 8. Engagement Mechanics

### 8.1 Daily Wine Fact
One Quick Fact Card per day, shown on the home screen or as a notification.
- Rotates through grape facts, region history, pairing tips, cultural stories
- Drawn from seed data (42 grape descriptions, 33 country histories, 58 pairing rules = months of content without repeating)

### 8.2 Weekly Deep Dive
One longer article per week, published on a consistent day.
- "This Week in Wine": Seasonal, topical, connected to what's happening in the wine world
- "From Your Cellar": Deep dive on a grape or region the user actually owns

### 8.3 Learning Streaks
Optional (not annoying) streak tracking for users on a Learning Path.
- "You've learned something new 5 days in a row"
- Gentle reminders, not guilt trips
- Streak freezes available (this isn't Duolingo)

### 8.4 Achievements / Badges
Tied to actual knowledge milestones and cellar exploration:

| Badge | Trigger |
|-------|---------|
| **First Sip** | Complete first learning module |
| **Grape Detective** | Learn about 10 different grapes |
| **World Traveler** | Own wines from 5+ countries |
| **The Nose Knows** | Complete a blind tasting challenge |
| **Pairing Pro** | Use the pairing tool 10 times |
| **Deep Cellar** | Own 50+ bottles |
| **Vintage Collector** | Own wines spanning 10+ vintages |
| **Classification Scholar** | Read about 5 classification systems |
| **Buy Again Champion** | Have 10+ "buy again" wines |
| **The Critic** | Rate 25+ wines with detailed sub-ratings |

### 8.5 Seasonal Content Calendar

| Month | Theme | Content Ideas |
|-------|-------|---------------|
| January | "New Year, New Grapes" | Explore unfamiliar varieties from your taste profile |
| February | "Love & Wine" | Romantic pairing scenarios, heart of the cellar |
| March | "Spring Awakening" | Light whites, fresh roses, transitional drinking |
| April | "Terroir Month" | Soil, climate, altitude -- why place matters |
| May | "Rose Season Begins" | Provence rose deep dive, your rose collection |
| June | "BBQ & Wine" | Summer pairing guide, grilled food matches |
| July | "The World Cup of Wine" | Country-by-country exploration tied to user's cellar |
| August | "Sparkling Summer" | Champagne, Cava, Prosecco, English sparkling |
| September | "Harvest Festival" | What's happening in vineyards right now |
| October | "Cellar Check-In" | Drink windows, aging updates, what to open |
| November | "Thanksgiving / Holiday Prep" | Pairing guides for big meals |
| December | "Year in Review" | Your Cellar Wrapped -- stats, top wines, growth |

---

## 9. Agent Integration

The sommelier personality is the connective tissue of the Learn experience. Quentin (or whichever personality is active) should be the *narrator* of education, not a separate feature.

### 9.1 "Ask the Sommelier" -- Open-Ended Learning
Expand the agent's conversational capability to handle educational queries:
- "What's the difference between Barolo and Barbaresco?"
- "Why is Champagne so expensive?"
- "What should I drink with Thai food?"
- "Tell me about Nebbiolo"

The agent already has access to `refGrapeCharacteristics`, `refAppellations`, `refPairingRules`, and `country` data. Adding a "learn" intent to the router would allow Quentin to pull from these tables and respond in character.

**Quentin example**: "Ah, Barolo and Barbaresco -- the eternal Piedmontese siblings. Same grape, different temperament. Barolo is the one who arrives late, demands attention, and rewards patience. Barbaresco is slightly more approachable -- elegant where Barolo is monumental. Both are 100% Nebbiolo. Both are magnificent. Both require a certain... commitment."

### 9.2 Conversational Learning Paths
The agent guides users through a topic over multiple exchanges:

**Example flow**:
1. Agent: "You've added a lot of Italian reds lately. Want to explore why Italian wines taste the way they do?"
2. User: "Sure"
3. Agent: "It starts with the grape. Your Chianti is Sangiovese -- bright cherry, high acid, medium tannin. But here's the thing: Sangiovese in Montalcino becomes Brunello, and the personality shifts completely. [Continue] [Quiz me]"
4. User: "Quiz me"
5. Agent: "Quick one: what's the other name for Sangiovese in Montepulciano?"
   - Chips: "Brunello" / "Prugnolo Gentile" / "Nero d'Avola"

### 9.3 Quiz Mode
Agent-driven quizzes with personality:
- Quentin: "Let's test that palate of yours. I'll describe a wine -- you tell me the grape."
- Wrong answer: "A noble effort, but no. The pepper should have been your clue. Syrah, not Cabernet."
- Right answer: "Precisely. You're developing a rather dangerous level of competence."

### 9.4 Personality-Aware Teaching Styles

Each sommelier personality would teach differently:

| Personality | Teaching Style |
|-------------|---------------|
| **Quentin** (Sommelier) | Dry wit, subtle corrections, literary references. Teaches through elegant observations. |
| **Nadi** (Friendly) | Enthusiastic, encouraging, uses personal anecdotes. "Oh, I love this topic!" |
| **Concise** | Bullet points, no fluff, maximum information density. For users who just want facts. |
| **Enthusiast** | Excitable, uses exclamation marks, shares obscure facts. "Wait until you hear this!" |

---

## 10. Creative / Out-of-the-Box Ideas

### 10.1 Wine & Music Pairings
"If this wine were a playlist, what would it sound like?"

Map wine characteristics to musical qualities:
- **Full body, high tannin, dark fruit** (Barolo): Late Beethoven string quartets -- intense, structured, rewards patience
- **Light, crisp, citrus** (Sancerre): Debussy's piano preludes -- delicate, bright, effortless
- **Bold, jammy, high alcohol** (Barossa Shiraz): Led Zeppelin -- loud, unapologetic, memorable
- **Elegant, earthy, subtle** (Burgundy Pinot Noir): Miles Davis' *Kind of Blue* -- understated brilliance

Could be generated per-wine using style profile data (`body`, `tannin`, `acidity`) from `cacheWineEnrichment`.

### 10.2 "If This Wine Were a Person..."
Personality profiles for wines and grapes:

- **Nebbiolo**: "The kind of person who shows up 20 minutes late, doesn't apologize, and somehow makes the evening better for it. High-maintenance but worth every minute. Wears well-tailored clothes that look uncomfortable. Has opinions about architecture."
- **Sauvignon Blanc**: "The friend who always wants to go for a hike. Impossibly energetic. Eats salad for pleasure. Makes you feel slightly lazy by comparison, but you're glad they're around."
- **Malbec**: "Gives great hugs. Probably has a motorcycle. Brought homemade empanadas to the party. Everyone likes them immediately."

### 10.3 Historical Wine Scandals: A Series
Episodic content delivered weekly, like a true crime podcast but for wine:

1. **The Great French Wine Blight** (1860s-1890s): A microscopic American louse nearly destroyed European wine forever
2. **The Austrian Antifreeze Affair** (1985): Why some Austrian winemakers added diethylene glycol to their wine
3. **Rudy Kurniawan: The Master Forger** (2000s-2012): How a young Indonesian fooled the world's richest collectors
4. **The Jefferson Bottles** (1985-present): Did Thomas Jefferson really own these wines? Probably not.
5. **Brunellopoli** (2008): When Montalcino's greatest wine was caught cheating on its own rules
6. **The Judgment of Paris** (1976): Not a scandal, but a shock -- California beats France, and the world changes

### 10.4 Wine Olympics: Your Cellar Edition
Gamified country-vs-country competition using the user's own collection:

- Each country in their cellar "competes" based on average ratings, value scores, buy-again rates
- "Gold Medal: France (avg rating 8.2) | Silver: Italy (7.9) | Bronze: Spain (7.6)"
- Leaderboard updates as they rate more wines
- "Underdog Alert: Your single Portuguese wine rated 9/10. Time to explore the Douro?"

Data source: Cross-reference `wine` > `producers` > `region` > `country` with `ratings`

### 10.5 Sensory Training with Household Items
Guided exercises to train your nose and palate using things already in your kitchen:

**The Nose Kit:**
- Blackcurrant: Buy a jar of cassis jam. Sniff it. That's what wine people mean by "cassis" in Cabernet Sauvignon.
- Leather: Find an old leather belt or bag. That slightly musty, warm smell? That's aged Tempranillo.
- Petrol/Kerosene: Controversial, but a tiny whiff of lighter fluid (carefully!) is exactly what aged Riesling smells like.
- Rose: Actual rose petals. Crush them. Now you understand Nebbiolo's floral side.
- Wet stone/Mineral: Lick a clean pebble (yes, really). That's "minerality" in Chablis.
- Butter: Melt butter in a pan. The aroma is malolactic fermentation in Chardonnay.
- Toast: Make toast. Char it slightly. That's new French oak.

**The Tongue Map Myth Buster:**
- "Your tongue doesn't have zones for sweet/sour/bitter. That's a myth from a badly translated German thesis from 1901. Every taste bud detects every taste."

### 10.6 "Wine Ancestor" -- Grape Family Trees
Interactive visualizations showing grape genealogy:

- Cabernet Sauvignon = Cabernet Franc x Sauvignon Blanc (a natural crossing!)
- Pinotage = Pinot Noir x Cinsault (deliberate, South Africa, 1925)
- Zinfandel = Tribidrag from Croatia (DNA confirmed 2001)
- Meunier is a mutation of Pinot Noir
- Pinot Grigio is a color mutation of Pinot Noir

Data from `grapes.description` which already contains origin stories, plus `refGrapeCharacteristics.alternateNames`.

### 10.7 The "Sommelier's Dilemma" Scenarios
Scenario-based learning with no right answer -- just interesting trade-offs:

- "Your friend brings a $200 Burgundy to dinner. You're serving pizza. Do you open it or suggest saving it?"
- "A restaurant has your favorite wine marked up 4x. Do you order it or try something new?"
- "You taste a wine you hate at a tasting. The winemaker is standing right there. What do you say?"
- "You have one slot left in your cellar. A 2019 Barolo that needs 10 years, or a 2022 Beaujolais that's perfect now?"

---

## 11. Priority Ranking

### Phase 1: Foundation (Build First)
**Effort**: Medium | **Impact**: High | **Data dependency**: Mostly existing

1. **Wine Moments** (contextual micro-learning)
   - Highest ROI. Uses existing data. Triggers naturally during app use. No new UI screens needed, just cards within existing flows.
   - Start with: wine-view triggers (grape spotlight, region intro, drink window)

2. **Quick Fact Cards**
   - Low effort to generate from seed data. Can be A/B tested. Daily engagement driver.
   - 42 grape descriptions + 33 country histories + 58 pairing rules = 130+ unique cards with no authoring needed.

3. **Cellar Insights**
   - Pure data visualization. Users love seeing their own data reflected back. "Your Cellar Wrapped" is the anchor feature.
   - Uses existing `wine`, `ratings`, `bottles`, `country` data.

### Phase 2: Engagement (Build Second)
**Effort**: Medium-High | **Impact**: High | **Data dependency**: Mix of existing and new

4. **Comparison Cards** ("This vs That")
   - Extremely shareable format. Data-rich from `refGrapeCharacteristics` and `refWineStyles`.
   - Start with 10 high-value comparisons (Barolo/Barbaresco, Champagne/Prosecco, etc.)

5. **Pairing Scenarios** (interactive tool)
   - `refPairingRules` has 58 entries with hierarchical specificity -- this is a ready-made pairing engine.
   - Cross-reference with user's cellar for "you already own the perfect match."

6. **Agent "Ask the Sommelier"** (educational queries)
   - Extends existing agent infrastructure. Quentin already has the voice. Data already exists in reference tables.
   - Needs new intent detection in router + reference table query logic.

### Phase 3: Depth (Build Third)
**Effort**: High | **Impact**: Medium-High | **Data dependency**: New content needed

7. **Learning Paths** (structured curriculum)
   - Requires content authoring beyond seed data. Start with Path A ("Confident Beginner") as the template.
   - Most replayable, most "educational product" feeling.

8. **Deep Dives** (long-form articles)
   - Higher authoring cost, but region/grape deep dives can be partially generated from existing data.
   - Agent-assisted generation from `country.wineHistory` + `refAppellations` + `refGrapeCharacteristics`.

9. **Quizzes** (agent-driven or standalone)
   - Fun, engaging, but requires question bank authoring. `refGrapeCharacteristics` flavors make excellent quiz material.

### Phase 4: Delight (Build When Ready)
**Effort**: Variable | **Impact**: Medium (but high delight factor)

10. **Interactive Maps** -- High development effort, but visually impressive
11. **Flavor Wheels** -- Technically interesting, needs good UX design
12. **Wine & Music Pairings** -- Low effort, high novelty, very shareable
13. **Sensory Training Exercises** -- Low effort, high educational value
14. **Wine Scandals Series** -- Pure content, can be dripped weekly
15. **Wine Olympics** -- Gamification layer on existing data
16. **Grape Family Trees** -- Visual, educational, unique

---

## 12. Content Voice Guidelines

All Learn content should follow the Qve voice:

| Do | Don't |
|----|-------|
| Make it personal: "Your cellar suggests..." | Make it generic: "Wine is..." |
| Use vivid language: "Nebbiolo arrives late but stays longest" | Use textbook language: "Nebbiolo is a late-ripening cultivar" |
| Acknowledge uncertainty: "Critics disagree on this one" | Present opinions as fact: "This is the best wine from..." |
| Respect all price points: "A great Tuesday night wine" | Be snobby: "You should be drinking better" |
| Use humor sparingly and dryly | Force jokes or use puns |
| Connect to experience: "Next time you taste cherry in a red..." | Stay abstract: "The phenolic compounds..." |
| Be concise: one idea per card | Overload: three concepts crammed together |

**The Quentin Test**: Before publishing any piece of content, ask: "Would Quentin say this?" If it sounds like a Wikipedia article, rewrite it. If it sounds like a sommelier showing off, cut it in half. If it sounds like a smart friend sharing something interesting over a glass, publish it.

---

## 13. Content Generation Strategy

### Automated (from existing data)
- Quick Fact Cards from `grapes.description`, `country.wineHistory`
- Comparison Cards from `refGrapeCharacteristics` pairs
- Pairing Scenarios from `refPairingRules`
- Cellar Insights from user data aggregation
- Wine Moments from `cacheWineEnrichment` + reference tables

### Semi-Automated (AI-assisted with editorial review)
- Deep Dive articles seeded from database data, expanded by LLM, edited for voice
- Quiz questions generated from `refGrapeCharacteristics.primaryFlavors`
- Wine personality profiles generated from style data

### Curated (requires authoring)
- Wine Scandals series
- Historical timelines
- Sensory training exercises
- The Sommelier's Dilemma scenarios
- Learning Path lesson structure

### User-Generated (future)
- Tasting notes from high-engagement users
- "What I learned" community stories
- Pairing recommendations from actual meals

---

## 14. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Learn feature adoption | 40% of active users visit Learn within first month | Page views |
| Content engagement | Average 2+ cards viewed per session | Card impressions |
| Wine Moment tap-through | 15% of Wine Moments lead to Learn content | Click tracking |
| Learning Path completion | 25% of started paths completed | Progress tracking |
| Quiz participation | 30% of Learn visitors try a quiz | Quiz starts |
| Cellar diversity increase | Users who engage with Learn add wines from 1+ new country/grape within 60 days | Cellar data delta |
| Agent educational queries | 10% of agent interactions are educational ("ask the sommelier") | Intent classification |
| Retention impact | Learn-engaged users have 20% higher 30-day retention | Cohort analysis |

---

## 15. Summary

The Qve Learn feature sits on a foundation of remarkably rich data: 42 grape varieties with full descriptions, 33 countries with wine histories and classification systems, 47 appellations, 30 wine styles, 58 pairing rules, and per-wine enrichment data including critic scores, drink windows, and style profiles. Most wine education apps start from scratch. We start from a database that already knows more than most sommeliers.

The strategy is: **start contextual, go deep gradually, always stay personal.** Wine Moments cost almost nothing to build and create immediate value by surfacing existing data at the right time. Quick Fact Cards turn seed data into daily engagement. Cellar Insights turn the user's own collection into a mirror. And the sommelier agent -- already built, already voiced, already loved -- becomes the most natural wine teacher imaginable.

The wild ideas (Wine & Music, Grape Family Trees, Scandals series, Sensory Training) are what make this more than a reference guide. They are what make it something people actually want to open. Because nobody ever learned to love wine from a textbook. They learned from someone who made them curious.

---

*"Wine is bottled poetry." -- Robert Louis Stevenson*

*"Yes, but poetry benefits from a knowledgeable reader." -- Quentin Verre-Epais*

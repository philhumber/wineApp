# Persona: The Obsessive Wine Scrapbooker

**Author**: Scrapbooker persona ideation
**Date**: 2026-02-12
**Purpose**: Feature ideas, user stories, and workflows for the Remember feature from the perspective of a meticulous wine cataloguer.

---

## Who I Am

I photograph every wine label before the cork comes out. I keep a shoebox of corks with dates written on them in Sharpie. I have a folder of screenshots from wine menus, blurry photos of bottles across restaurant tables, and saved articles about producers I want to visit. I remember that the 2015 Barolo I had at that trattoria near Piazza Navona was life-changing, but I can never find the photo when I need it. My Notes app has fragments like "the Chablis at Sarah's wedding - ask sommelier" that I will never follow up on because the context is gone.

I am the person this feature is for. My wine memories are scattered across seven different apps, a physical notebook, and the bottom of my bag. Qvé already tracks what's in my cellar and what I've drunk. What it doesn't capture is the *everything else* -- the wines I loved at restaurants, the bottles friends brought to dinner, the recommendations from that wine bar owner in Barcelona, the wines I read about and want to try someday. The stuff between "identify" and "add to cellar."

---

## My Pain Points with Current Methods

### What Exists Today Fails Me

1. **Photos vanish into the camera roll** -- I have 200+ wine label photos mixed in with everything else. No metadata, no notes, no way to find "that Gruner Veltliner from Vienna" without scrolling through months of photos.

2. **Notes apps lack structure** -- "Domaine Leflaive Puligny-Montrachet 2018 - incredible minerality, had with oysters at Le Comptoir" is useful text, but it's just a string. I can't filter by region, sort by rating, or see all my Burgundy memories together.

3. **Vivino/Delectable are social, not personal** -- I don't want to "check in" a wine. I want to capture a *moment*. The wine is part of it, but so is the place, the people, the food, the weather, the occasion. These apps reduce wine to a rating.

4. **My cellar app (Qvé today) only tracks inventory** -- The drink history is great for bottles I owned. But 70% of my memorable wine experiences are wines I *didn't* own -- restaurant pours, tastings, friend's bottles, wine bar discoveries.

5. **Context decays fast** -- If I don't capture it within 24 hours, the details fade. The producer name gets fuzzy, the vintage becomes "maybe 2017 or 2018," and the pairing becomes "some fish thing."

6. **No connections between memories** -- I had a Priorat at a tasting in 2022 that reminded me of a Barossa Shiraz from 2019, but there's no way to link those experiences. Wine appreciation is built on comparisons and connections.

---

## Must-Have Features (Non-Negotiable)

### 1. Quick Capture ("Just Get It Down")

**The most critical feature.** When I'm at a restaurant with friends, I have about 30 seconds before the conversation makes it awkward to be on my phone. I need:

- **Photo + one tap** -- Snap the label, tap "Remember," done. Everything else can be added later.
- **Voice note option** -- "2019 Chateau Musar, amazing with the lamb, earthy and complex" whispered into my phone under the table.
- **Text shorthand** -- Type "musar 2019 restaurant amazing" and have the AI parse it.
- **Capture from identification** -- After the agent identifies a wine (the existing flow), "Remember" should save the full identification result plus let me add context.

**User Story**: *As a scrapbooker, I want to capture a wine memory in under 10 seconds so I don't miss the moment or seem antisocial.*

### 2. Rich Context Capture (Add Later)

After the quick capture, I want to come back and flesh it out:

- **Occasion** -- dinner party, restaurant, tasting, gift, travel, wine bar, picnic
- **People** -- who was there (free text or saved contacts)
- **Place** -- restaurant name, city, country (with optional map pin)
- **Food pairing** -- what we ate with it
- **My impression** -- free text, not constrained to a rating scale (though a personal rating is nice too)
- **Photos** -- multiple: label, bottle, setting, menu, food
- **Price/value** -- what I paid (or approximate), and whether it felt worth it
- **Would I buy this?** -- a simple flag: "Yes, actively seeking" / "Yes, if I see it" / "Nice memory, don't need to own it"
- **Connections** -- "This reminded me of..." linking to other memories

**User Story**: *As a scrapbooker, I want to add rich context to a quick capture within 48 hours so the memory is complete before details fade.*

### 3. The Memory Feed (Browsing My History)

I want a beautiful, chronological feed of my wine memories -- like a personal wine Instagram that's just for me. Not a table. Not a spreadsheet. A *scrapbook*.

- **Timeline view** -- scrollable, visual, date-grouped
- **Card-based** -- each memory is a card with photo, wine name, date, a snippet of my notes
- **Expandable** -- tap to see the full memory with all context
- **Filter by everything** -- occasion, people, place, wine type, region, rating, "would buy" flag, date range
- **Search** -- full-text search across all fields, including my free-text notes

**User Story**: *As a scrapbooker, I want to browse my wine memories as a visual timeline so I can relive experiences and spot patterns in my taste.*

### 4. Integration with Existing Qvé Features

This is where Remember becomes powerful rather than just another notes feature:

- **Remember from identification** -- The agent identifies a wine; I tap "Remember" instead of "Add to Cellar." The identification data (producer, wine, vintage, region, type) is pre-filled.
- **Remember from enrichment** -- After "Learn More," I can "Remember" with the enrichment data (critic scores, grape composition, tasting notes) attached.
- **Remember to cellar** -- I remembered a wine last month; now I found it at a shop. One tap to start the "Add to Cellar" flow with all the data pre-filled from the memory.
- **Cellar to memory** -- When I drink a bottle from my cellar, the "Rate" flow should optionally create a memory entry with the cellar data pre-filled.
- **Memory on wine detail** -- If I'm looking at a wine in my cellar, show related memories (other vintages I've tried, restaurant experiences with the same producer).

**User Story**: *As a scrapbooker, I want my remembered wines to connect with my cellar so a restaurant discovery can become a purchase and a bottle can become a memory.*

### 5. The Wish List Dimension

Some memories are aspirational. "Remember" should handle:

- **"Want to try"** -- wines I've read about, been recommended, or seen on a list but haven't tasted
- **"Want to buy"** -- wines I've tried and want to own
- **"Want to revisit"** -- wines I've had once and want to experience again

These are distinct from cellar inventory. They're intentions, not possessions.

**User Story**: *As a scrapbooker, I want to track wines I want to try or buy so my wine journey has direction, not just history.*

---

## Dream Scenarios

### Scenario 1: The Restaurant Discovery

I'm at a restaurant in Lyon. The sommelier recommends a Condrieu I've never heard of. I love it.

1. I snap a photo of the label under the table.
2. I tap "Remember" -- the agent identifies it as "Domaine Georges Vernay Condrieu Les Chaillees de l'Enfer 2020."
3. I add: occasion = restaurant, place = "La Mere Brazier, Lyon", food = "Quenelles de brochet", impression = "Incredible texture, like liquid silk. Peach and apricot but not sweet. The best white wine moment of this trip."
4. I mark "Would buy: Yes, actively seeking."
5. A week later, back home, I search my memories for "Condrieu" and find it. I tap "Add to Cellar" and the data flows through -- I just need to add bottle details.
6. A year later, I'm browsing my timeline and see "Lyon Trip 2026" with three wine memories, each with their restaurant and meal context. It's a story, not a data point.

### Scenario 2: The Tasting Event

I attend a Barolo tasting with 12 wines. I want to capture all of them quickly.

1. For each wine, I snap the label and give a quick rating (personal 1-10) and one-word impression.
2. The next day, I open my memories from yesterday and flesh out the top 4: full tasting notes, which ones I'd buy, how they compared to each other.
3. I can tag all 12 as "Barolo Tasting Feb 2026" -- a collection/event grouping.
4. Later, when someone asks "Have you had Giacomo Conterno?", I can search and show them my tasting notes with comparisons.

### Scenario 3: The Friend's Recommendation

My friend texts me: "You HAVE to try Raul Perez Ultreia Saint Jacques 2019. Changed my life."

1. I open Qvé, type "Raul Perez Ultreia Saint Jacques 2019" and the agent identifies it.
2. I tap "Remember" with occasion = "recommendation" and people = "James."
3. I mark "Would buy: Yes, if I see it."
4. Six months later, I'm at a wine shop and I browse my wish list. There it is. I buy it, add to cellar, and the memory updates to show "Recommended by James -> Purchased -> In Cellar."

### Scenario 4: The "What Was That Wine?" Rescue

At a dinner party three weeks ago, someone brought an incredible Cotes du Rhone but I didn't capture anything. I vaguely remember the label had a tree on it, it was maybe 2018, and it was from "something Plan."

1. I tell the agent: "Cotes du Rhone, 2018ish, tree on label, Plan something."
2. The agent suggests "Chateau Rayas? Domaine du Vieux Telegraphe? Clos des Papes?" -- no, none of those.
3. I say "the producer had Plan in the name" and the agent finds "Plan Pegau, Lot #2018."
4. I "Remember" it with what I can recall, knowing the identification is solid even if my personal notes are fuzzy.

### Scenario 5: The Annual Review

It's December 31st. I want to look back at my wine year.

1. I filter my memories to 2026.
2. I can see stats: 47 wines remembered, top regions (Burgundy x12, Rhone x8, Barolo x7), most common occasion (restaurant x20, dinner party x11).
3. I can see my "top rated" memories and relive those moments.
4. I notice I tried 6 different Chablis producers this year and can compare my notes side by side.
5. This is my wine scrapbook. It tells the story of my year in wine.

---

## Organization and Taxonomy

### Tags and Categories

I want flexible, user-defined tagging, not rigid categories:

- **Auto-tags from identification**: region, country, grape, type, vintage, producer -- these come free from the AI
- **Occasion tags**: restaurant, home, dinner party, tasting, travel, gift, wine bar, picnic, wedding, anniversary
- **Custom tags**: user-created, reusable across memories (e.g., "Summer 2026 Italy Trip", "Wines for Dad", "Natural Wine Exploration")
- **People tags**: free text, with autocomplete from previously entered names
- **Place tags**: restaurant/bar name + city, with autocomplete

### Collections / Event Grouping

Multiple memories should be groupable:

- "Barolo Tasting Feb 2026" (event)
- "Italy Trip 2026" (travel)
- "Wines That Changed My Mind About Riesling" (thematic)
- "Date Night Wines" (occasion-based)

Collections can overlap -- a wine can be in "Italy Trip 2026" AND "Wines That Changed My Mind."

### Smart Collections (Auto-Generated)

The app should surface patterns I don't explicitly create:

- "Your Burgundy Journey" (all Burgundy memories chronologically)
- "Wines You Loved" (rated 8+)
- "Wish List" (marked "want to buy" or "want to try")
- "This Month Last Year" (nostalgia trigger)
- "Frequent Companions" (people who appear in 3+ memories)

---

## Agent Interaction

### Talking to the Agent About Memories

The agent already identifies and enriches wines. For Remember, I want it to also:

1. **"What was that wine at [place]?"** -- Search my memories by context, not just wine name. "What did I drink at Noma?" should work.

2. **"Show me all the Barolos I've tried"** -- Cross-reference memories + cellar + drink history for a complete picture.

3. **"Compare my notes on X and Y"** -- Pull up two memories side by side.

4. **"What should I order here?"** -- Given a wine list (photo), cross-reference against my memories: "You've had the Chateau Musar before and loved it. The Priorat is from a region you've been exploring."

5. **"What haven't I tried from [region]?"** -- Based on my memories and cellar, identify gaps in my experience.

6. **"Remind me about [wine]"** -- Pull up the memory with full context: when, where, with whom, what I thought.

---

## Edge Cases and Considerations

### Data Quality Spectrum

Not every memory will be complete. The system must gracefully handle:

- **Minimal**: Just a photo, no notes, no rating -- still valuable
- **Partial**: Wine identified but no context added -- that's fine, context can come later (or never)
- **Rich**: Full context, multiple photos, detailed notes -- the ideal
- **Fuzzy**: "Some Malbec at an Argentinian place in Soho, maybe 2019?" -- unidentified wine, just context

The system should never force structure. Capture first, organize later (or never).

### Multiple Experiences of the Same Wine

I might remember the same wine three times:

- Tasted at a winery in 2022
- Had at a restaurant in 2023
- Bought a bottle and drank at home in 2024

These are three separate memories that should be linkable but distinct. The wine is the thread; the memories are the beads.

### Privacy and Sharing

My scrapbook is intensely personal. But occasionally I want to:

- **Show a friend**: "Here's my note on that wine" -- shareable card/link
- **Export**: Year-end PDF of my wine memories (the dream)
- **Never**: Public profiles, social feeds, leaderboards

### Offline Capture

At a wine cave in rural France, I might have no signal. Quick capture (photo + text note) must work offline and sync later when connected.

---

## What Existing Apps Get Wrong

1. **Vivino**: Reduces wine to a crowd-sourced rating. My 3.8 Vivino wine might be my personal 10 because of the context.
2. **CellarTracker**: Inventory-focused. Memories are an afterthought.
3. **Delectable**: Social first. I don't want to broadcast; I want to remember.
4. **Instagram/Photos**: No wine-specific metadata. Pure chaos after 100 photos.
5. **Physical notebooks**: Can't search, can't link to identification data, get lost, get stained (by wine, ironically).
6. **Notes apps**: No structure, no visuals, no integration with wine data.

Qvé has the *identification engine* and the *wine data layer*. What it lacks is the *personal narrative layer*. Remember is that layer.

---

## Priority Ranking

If I had to choose features in order of implementation:

1. **Quick capture from identification flow** ("Remember" chip that actually works)
2. **Memory feed/timeline** (browsable, filterable view of all memories)
3. **Rich context editing** (add occasion, people, place, notes after capture)
4. **Wish list / "would buy" tracking** (the aspirational dimension)
5. **Memory-to-cellar flow** (convert a remembered wine to a cellar entry)
6. **Collections/event grouping** (organize memories into narratives)
7. **Agent memory queries** ("What did I drink at...")
8. **Smart collections** (auto-generated pattern surfacing)
9. **Connections between memories** ("This reminded me of...")
10. **Annual review / stats** (year-in-wine summary)

---

## Summary

The Remember feature transforms Qvé from a cellar management tool into a wine life companion. It captures the 70% of wine experiences that happen outside your cellar -- the restaurant discoveries, the friend's recommendations, the tasting events, the travel moments. It's a personal wine journal with the intelligence of AI identification, the richness of contextual metadata, and the beauty of a visual scrapbook.

The key insight: **the wine is never the whole story.** The memory is about the wine AND the moment. Capture both, connect them to your cellar, and you have something no other app offers.

---

## Addendum: Cross-Persona Consensus

*After discussion with the casual wine-lover persona, we converged on these shared design principles. Items marked with an asterisk (*) represent where I updated my original position.*

### Agreed Design Principles

1. **One capture flow, two depths.** Quick capture = 2-3 taps max (photo, optional vibe, optional one-line note). Rich context (occasion, people, place, food, detailed notes, 1-10 rating, multiple photos) available via "Add More Details" but never required upfront.

2. **No empty-state guilt.** A memory with just a photo and timestamp is complete. A memory with 15 fields is also complete. The card renders gracefully at any fill level. Never show greyed-out "missing" fields or progress bars.

3. **AI fills facts, humans fill feelings.** The identification engine auto-populates producer, wine name, vintage, region, type. The user adds the personal narrative: who, where, why, what it meant.

4. **Vibe rating primary, numeric optional.** 4 vibes (loved/liked/meh/nope) as the quick-capture rating with visual icons. Optional 1-10 numeric rating in the expanded edit view for power users. Two layers, one system.

5. **(*)  AI-surfaced connections, not user-built links.** Originally I wanted manual "this reminded me of..." linking. The wine-lover convinced me: most users won't use it. If the agent says "This is similar to the Malbec you loved at Sarah's" via grape/region/style matching, that's more powerful than manual links. The agent IS the connection engine. Manual linking is V2 power-user territory.

6. **(*) Auto-suggested organization, not manual taxonomy.** Originally I wanted user-created tags and collections. Revised: collections should be auto-detected (same-evening grouping, same-region grouping) and offered as suggestions. Smart collections ("Your Italian Reds") are auto-generated. Manual "Create Collection" is V2.

7. **Share = pretty card via messaging.** No profiles, no followers, no public feed. A shareable image card (wine photo, name, vibe icon, user note) for iMessage/WhatsApp.

8. **Wish list is first-class.** "Want to try" and "want to buy" are capture intents alongside "experienced." The feed is filterable by intent. Wish list items may have no photo.

9. **Occasion chips at capture time (skippable).** 4-5 tappable chips (restaurant, dinner party, tasting, travel, date night) shown after quick capture. All skippable in one gesture. Essential for recall ("What should I bring to a BBQ?") but never blocking.

### Sleeper Feature: Cellar-to-Memory Bridge

The wine-lover identified what may be the highest-volume memory creation path: when a user drinks a bottle from their cellar and rates it through the existing flow, offer "Save as memory?" with pre-filled wine data + date + rating. Just add occasion chips and an optional photo. This requires near-zero friction because all the structured data already exists. The architect should prioritize this integration point.

### Updated Priority Ranking (Post-Consensus)

1. Quick capture from identification flow ("Remember" chip)
2. Memory feed/timeline (visual, chronological, filterable)
3. **Cellar-to-memory bridge** (auto-suggest memory from drink/rate flow) -- moved up
4. Rich context editing (occasion, people, place, notes -- add later flow)
5. Wish list / intent tracking (want to try, want to buy)
6. Agent memory queries ("What did I drink at...")
7. Memory-to-cellar conversion (remembered wine to cellar entry)
8. Smart auto-generated collections (retention hooks)
9. Shareable wine cards (pretty card via messaging)
10. Annual review / stats (year-in-wine summary)

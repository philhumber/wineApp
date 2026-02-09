# User Perspective: The Learn Feature

> Written from the perspective of a real wine enthusiast using Qve daily. This document captures what users actually want, what would excite them, what would bore them, and how a Learn feature should feel when it works.

---

## Table of Contents

1. [Where the App Is Today](#1-where-the-app-is-today)
2. [User Personas](#2-user-personas)
3. [Pain Points: Learning Wine Today](#3-pain-points-learning-wine-today)
4. [User Stories (Prioritized)](#4-user-stories-prioritized)
5. [Interaction Scenarios](#5-interaction-scenarios)
6. [Dream Features](#6-dream-features)
7. [Wild Ideas](#7-wild-ideas)
8. [UX Preferences](#8-ux-preferences)
9. [What Would Make Me NOT Use It](#9-what-would-make-me-not-use-it)
10. [Must-Have vs Nice-to-Have](#10-must-have-vs-nice-to-have)

---

## 1. Where the App Is Today

Walking through Qve as a user, here is what I experience:

**Cellar view** (`/qve/`): A grid of wine cards with images, names, vintages, producers, ratings, bottle counts, and price indicators. I can filter by country, region, type, producer, and year. I can sort by 12 different criteria. I can toggle between "Cellar" (bottles I own) and "All Wines" (everything I have ever logged). The header shows my collection name and an estimated cellar value.

**History** (`/qve/history`): A paginated grid of wines I have drunk, with drink dates, ratings (overall, value, complexity, drinkability, surprise, food pairing), tasting notes, buy-again indicators. Same filter/sort model as the cellar.

**Add Wine** (`/qve/add`): A 4-step wizard (Region, Producer, Wine, Bottle) with AI-assisted identification. The agent panel lets me photograph a label or type a description, and the sommelier AI identifies the wine, enriches it with grape composition, critic scores, drink windows, style profiles, tasting notes, food pairings, and an overview.

**Edit/Drink flows**: Edit wine and bottle details, rate a wine when drinking it.

**What is missing**: There is no way to *learn* from my collection. The enrichment data (grapes, regions, critics, style profiles) is shown once during the add flow and then effectively vanishes. I cannot browse it, revisit it, compare it, or use it to understand patterns in what I like. The app is a great *tracker* but not yet a *teacher*.

---

## 2. User Personas

### The Casual Drinker (Anna)
- **Profile**: Buys 2-3 bottles a week, whatever catches her eye at the shop
- **Wine knowledge**: Knows she prefers "smooth reds" but cannot articulate why
- **Motivation**: Wants to stop buying disappointments. Wants to remember what she liked.
- **Tech comfort**: Uses Instagram daily, comfortable with apps but impatient with complexity
- **Key need**: Quick answers. "Is this good?" "What should I buy for dinner tonight?"

### The Dinner Party Host (Marcus)
- **Profile**: Has a collection of 40-60 bottles, entertains regularly
- **Wine knowledge**: Can talk about a few regions confidently, bluffs the rest
- **Motivation**: Wants to match wines to food and impress guests. Hates the anxiety of choosing wrong.
- **Tech comfort**: Uses apps purposefully, not for browsing
- **Key need**: Practical pairing advice. "I am making lamb. Which of MY wines goes best?"

### The Collector (Catherine)
- **Profile**: 200+ bottles, buys systematically, tracks everything
- **Wine knowledge**: Solid intermediate. Reads Wine Spectator, knows most major regions.
- **Motivation**: Wants to understand her collection at a higher level. Spot gaps. Optimize.
- **Tech comfort**: Power user. Will dig into features.
- **Key need**: Analytics and insights. "Am I too concentrated in Bordeaux?" "What is my average price by region?"

### The Explorer (James)
- **Profile**: 30-50 bottles, deliberately buys outside his comfort zone
- **Wine knowledge**: Enthusiastic beginner. Knows enough to be dangerous.
- **Motivation**: Wants to discover new things. Gets bored with the same producers.
- **Tech comfort**: Likes interactive, visual experiences. Loves maps and infographics.
- **Key need**: Discovery. "What Georgian wines are like the Rhone reds I enjoy?" "Show me something I have never tried."

### The Student (Priya)
- **Profile**: Studying for WSET Level 2, 15-20 bottles for tasting practice
- **Wine knowledge**: Actively building. Knows theory, needs to connect it to experience.
- **Motivation**: Wants to pass the exam but also genuinely loves wine. Wants her collection to reinforce what she is studying.
- **Tech comfort**: Studies with flashcards and apps. Loves structured learning.
- **Key need**: Structured knowledge tied to her own wines. "The WSET says Marlborough Sauvignon Blanc has gooseberry. Do my notes agree?"

---

## 3. Pain Points: Learning Wine Today

### The Information Overload Problem
Wine Folly, Vivino, Jancis Robinson, Wine Spectator, CellarTracker -- there are dozens of resources and each one assumes you already know a certain amount. Wine Folly is brilliant for visual learners but generic (it teaches Pinot Noir, not *your* Pinot Noir). Vivino has community ratings but the "learning" is just a score and some flavour tags. Jancis Robinson is authoritative but intimidating and paywalled.

**The core problem**: None of these resources know what wines *I* own and what *I* have tasted. They teach wine in the abstract. I want to learn wine through my own experience.

### The Memory Problem
I drank an incredible Barolo six months ago. I gave it a 9. But I cannot remember *why* it was so good. Was it the tannin structure? The acidity? The age? My tasting notes say "incredible, earthy, long finish" which tells me very little now. I need the app to help me build a richer vocabulary and connect my reactions to wine characteristics I can recognize again.

### The Connection Problem
I know I like Syrah from the Northern Rhone. But I do not know what else I might like based on that preference. Is Mouvedre similar? What about Xinomavro from Greece? The knowledge exists, but I have no way to bridge from "things I know I like" to "things I would probably like."

### The Pretentiousness Barrier
Wine culture has a gatekeeping problem. Terms like "herbaceous" and "tertiary aromas" make beginners feel stupid. I want to learn these terms eventually, but I need them introduced gently, in context, connected to wines I have actually tasted -- not thrown at me like a vocabulary exam.

### The Timing Problem
I want to learn about wine at very specific moments: standing in a wine shop, planning dinner, just after tasting something amazing, or when I am bored on a commute. Not at a scheduled time. The learning has to fit into these micro-moments, which means bite-sized content that loads instantly.

### The "So What?" Problem
Reading that Burgundy uses Pinot Noir is useless trivia unless it helps me appreciate the next Burgundy I drink. Every piece of knowledge needs to answer: "What does this mean for me and my wines?"

---

## 4. User Stories (Prioritized)

### Tier 1: Core (Would use daily/weekly)

1. **As Anna**, I want to tap on a wine in my cellar and see a simple "What makes this wine special?" summary so that I appreciate what I am about to drink, not just consume it.

2. **As Marcus**, I want to ask "What should I open tonight with roast chicken?" and get a recommendation FROM MY CELLAR so that I do not have to guess or google generic pairing charts.

3. **As Catherine**, I want to see my collection on a map, coloured by country and region, so that I instantly understand where my wines come from and where the gaps are.

4. **As James**, I want to tap on a grape variety (e.g., Syrah) and see all my wines that contain it, plus a short explanation of what Syrah tastes like and why I might enjoy it, so that I can connect the grape to my personal experience.

5. **As Priya**, I want to see a "Taste Profile" that shows what styles I gravitate toward (bold reds, crisp whites, etc.) based on my ratings, so that I understand my own palate instead of just guessing.

6. **As Anna**, I want short, jargon-free explanations when I encounter a wine term I do not know (e.g., "tannin", "malolactic fermentation") so that I learn naturally without feeling lectured.

7. **As Marcus**, I want to see food pairing suggestions for each wine I own, using language I understand ("great with grilled meats" not "pairs with charcuterie of moderate unctuosity") so that I can plan meals confidently.

### Tier 2: Engagement (Would use weekly/monthly)

8. **As James**, I want a "You might also enjoy..." suggestion based on wines I have rated highly, ideally wines from regions or grapes I have not tried, so that I keep exploring.

9. **As Catherine**, I want collection insights like "Your highest-rated wines tend to be medium-bodied reds from 10-15 EUR" so that I can buy smarter.

10. **As Priya**, I want to compare two wines side-by-side (grape, region, style, my ratings) so that I can train my palate to spot differences.

11. **As all users**, I want a "Today I Learned" style nugget that relates to a wine I own -- one short fact that makes me see my cellar differently.

12. **As Anna**, I want to understand the difference between wine types (Merlot vs Cabernet, Chablis vs Chardonnay) using my own wines as examples, so that the learning sticks.

13. **As Marcus**, I want to know the ideal serving temperature and decanting time for wines in my cellar so that I serve them at their best.

14. **As James**, I want to explore a region visually -- a map with major sub-regions, grapes, and which of my wines come from there -- so that geography becomes concrete.

### Tier 3: Depth (Would use monthly/occasionally)

15. **As Catherine**, I want to see trends in my drinking over time -- am I diversifying? Is my average rating going up? Am I spending more or less? -- so that I can track my growth as a collector.

16. **As Priya**, I want quizzes or flashcards built from my own collection ("Which grape is dominant in your 2019 Chateauneuf-du-Pape?") so that I study with personal relevance.

17. **As all users**, I want to understand what critics said about a specific vintage and whether my rating agreed or disagreed, so that I develop confidence in my own palate.

18. **As James**, I want to understand wine styles as a spectrum (light-bodied to full-bodied, dry to sweet) and see where my wines fall on it, so that abstract concepts become visual.

19. **As Catherine**, I want to know which wines in my cellar are approaching or past their optimal drink window so that I do not waste good bottles.

---

## 5. Interaction Scenarios

### Scenario 1: "Saturday afternoon at the wine shop"
> I am standing in front of the Italian section. I see a Barolo for 35 EUR and a Barbaresco for 28 EUR. I open Qve, tap Learn, and search "Barolo vs Barbaresco." I get a concise comparison: both use Nebbiolo, Barolo is more structured and needs more aging, Barbaresco is approachable sooner. It shows me that I already own a Barolo (rated 8) and no Barbaresco. It suggests: "Try the Barbaresco -- it is the same grape you loved in your Barolo but a different expression. You might drink it sooner." I buy it. I feel smart. I learned something that will make the wine taste better when I open it.

### Scenario 2: "Tuesday evening planning dinner"
> I am making salmon tonight. I open Qve, tap Learn, and type "What goes with salmon?" Instead of a generic Google result, the app looks at MY cellar and says: "Salmon loves acidity and light tannins. From your cellar, your 2022 Sancerre (Sauvignon Blanc, Loire Valley) would be ideal -- its citrus acidity cuts through the richness. Your 2020 Pinot Noir (Burgundy) would also work if you prefer red -- Pinot's silky texture complements fish." I pick the Sancerre. When I open it, the app shows a card: "Fun fact: Sancerre was almost forgotten in the 1950s. It was the Parisian bistro scene that revived it." I enjoy the wine and the story.

### Scenario 3: "Weekend boredom -- I want to learn something fun"
> It is Sunday afternoon. I have no particular goal. I open Qve, tap Learn, and see a personalized dashboard. At the top: "Your collection spans 8 countries and 14 grape varieties." Below that, a map shows dots for every wine origin. I notice I have nothing from Spain and tap on Spain. It shows me: "Spain is the world's third largest wine producer. Tempranillo is the signature grape -- similar in body to your Merlots but with more earthy, leathery notes. Rioja is the most famous region, but Ribera del Duero is gaining cult status." I think, "I should try a Tempranillo." This whole interaction took 90 seconds.

### Scenario 4: "Just rated a wine 9/10"
> I just finished an incredible Cotes du Rhone and rated it 9. The app says: "Great score! Here is why this wine might have impressed you." It shows the grape blend (Grenache 60%, Syrah 30%, Mourvedre 10%), the warm climate of the Southern Rhone, and the wine's style profile (full-bodied, fruit-forward, spicy). It then says: "Your top-rated wines tend to be full-bodied reds with spice. You might also enjoy: Priorat (Spain) -- similar warmth and intensity, or Barossa Valley Shiraz (Australia) -- bold and peppery." I feel like the app understands me. I did not just rate a wine; I learned something about myself.

### Scenario 5: "Hosting a dinner party on Friday"
> I have 6 guests coming and I am serving three courses: goat cheese salad, braised short ribs, and chocolate tart. I open Qve, tap Learn, and use a "Dinner Party Planner." I enter my menu. The app scans my cellar and suggests: "Starter: Your 2021 Vouvray (Chenin Blanc) -- its honey notes complement goat cheese. Main: Your 2018 Cahors (Malbec) -- the dark fruit and tannin can stand up to braised beef. Dessert: Your 2019 Banyuls (fortified Grenache) -- its sweetness matches chocolate without overwhelming it." For each, it gives a one-liner I can say at the table: "This Cahors is from southwest France -- they have been making Malbec here since before Argentina made it famous." I feel prepared and knowledgeable.

---

## 6. Dream Features

### 6.1 Collection Map
An interactive map showing where my wines come from. Dots or heat zones for each country/region. Tap a region to see my wines from there, plus a short primer on the region. Visual, instantly understandable, makes the abstract concrete. This is the single feature that would make me open Learn regularly.

### 6.2 Wine DNA / Taste Profile
Analyze my ratings, tasting notes, and the enrichment data to build a profile: "You prefer full-bodied reds with moderate tannin and fruit-forward profiles. Your sweet spot is 15-25 EUR from France and Italy." Show this as a visual radar chart or style spectrum. Update it as I rate more wines. This is deeply personal and no other app does it well.

### 6.3 Smart Cellar Suggestions
"Tonight with your steak, try..." recommendations based on what I own, what I am eating, and what is at optimal drinking age. Combines pairing knowledge with my actual cellar inventory and drink windows. This is the killer use case for people who own more than 20 bottles.

### 6.4 Grape Explorer
Tap any grape variety to see: what it tastes like, where it grows, which of my wines contain it, how I have rated those wines, and what other grapes are similar. A personal grape encyclopedia built from my own experience.

### 6.5 Side-by-Side Comparison
Pick any two wines and see them compared: grape, region, style profile, my ratings, critic scores, drink windows. Like a spec sheet for wine. Great for learning to distinguish similar styles.

### 6.6 "Explain It Like I'm..." Depth Slider
Every knowledge card has a depth toggle: Beginner / Intermediate / Expert. Beginner says "This wine is made from Pinot Noir, a grape that makes light, fruity reds." Expert says "This Volnay exemplifies the structured, mineral-driven expression of Pinot Noir in the Cote de Beaune, with characteristically higher acidity than neighbouring Pommard." Same content, different depth. Let ME choose how deep to go.

### 6.7 Drink Window Alerts
A timeline or calendar showing when each wine in my cellar enters and exits its ideal drinking window. "3 wines are at peak now. 2 are approaching their window. 1 is past its prime -- drink soon!" Practical, actionable, prevents waste.

### 6.8 Personal Sommelier Insights
After enough data, the app generates insights: "Your 5 highest-rated wines are all from the Rhone Valley -- consider exploring this region further." Or: "You consistently rate oaky Chardonnays lower than unoaked ones. You might prefer Chablis over Meursault." These are the moments that make a user feel *known*.

---

## 7. Wild Ideas

### Wine Weather
"It is cold and rainy. Open something warm and comforting." Seasonal/mood-based suggestions tied to my cellar. Playful, low-effort to use, and surprisingly useful. Could use actual weather API data for location-aware suggestions.

### Dinner Party Mode
Full dinner party planning: enter your guest count and menu, the app selects wines from your cellar, tells you how many bottles you need, suggests serving order, and gives you one talking point per wine. Export to a printed menu card.

### "Surprise Me"
A random wine fact or piece of trivia connected to something in my collection. "Did you know? The oldest known bottle of wine (Speyer wine, ~325 AD) is from Germany -- you have 3 German wines in your cellar." Delight factor. Opens the app to something unexpected each time.

### Wine Journal
A diary-like view where each tasting generates a journal entry with the wine's story, my notes, the enrichment data, and a prompt like "What did you notice about the finish?" Over time, this becomes a personal wine memoir.

### "Wine Twin"
If the platform ever supports multiple users: find other collectors whose taste profile overlaps with yours. "Users with similar taste also enjoy..." Social proof meets recommendation engine.

### AR Label Reading (Future)
Point your camera at a wine label in a shop. The app reads it, identifies the wine, and immediately shows: "You own 2 bottles of this." or "New to you -- here is what you should know." This extends the existing agent image identification into a real-time discovery tool.

### Vintage Comparison
"How does the 2019 vintage compare to 2020 for Barolo?" Show weather data, critic consensus, and how it affects what I should expect from my bottles.

### Region Deep Dives
Structured mini-courses: "Burgundy in 5 Minutes." A short, visual tour: map, key grapes, key villages, price spectrum, food culture. Connected to whichever of my wines come from that region.

---

## 8. UX Preferences

### Browse vs Search vs Guided
Users want all three, but in different moments:
- **Browse**: The default. Open Learn and see something interesting immediately. No effort required. This is the "Sunday afternoon" mode.
- **Search**: For specific questions. "What is Nebbiolo?" "What goes with fish?" Must be fast and direct.
- **Guided**: For deeper engagement. "Explore Bordeaux," "Understand your palate." Multi-screen, but short (5 screens max, not 20).

### Long-form vs Bite-sized
**Bite-sized wins.** The average user will spend 30-90 seconds in Learn per visit. Everything should be scannable: title, key fact, visual, personal connection to MY wine. Long-form is fine as optional depth (the "Explain It Like I'm Expert" mode) but must never be the default.

### Visual vs Text-heavy
**Visual first.** Maps, charts, grape composition wheels, style radar charts, color-coded type badges. Text should support visuals, not replace them. A user should be able to understand the gist without reading a word.

### Passive vs Interactive
**Passive by default, interactive on demand.** Show me information I can absorb at a glance. Let me tap to go deeper, compare, quiz myself. Do not make me work to get the first layer of value.

### When and Where Users Engage
| Moment | Duration | Mood | Best format |
|--------|----------|------|-------------|
| At the wine shop | 30 sec | Urgent, decisive | Quick lookup, comparison |
| Planning dinner | 1-2 min | Purposeful | Pairing search, cellar scan |
| Just rated a wine | 1 min | Curious, satisfied | "Why you liked it" card |
| Bored / commute | 3-5 min | Exploratory | Map browse, trivia, insights |
| Before a dinner party | 5-10 min | Anxious, preparation | Dinner planner, talking points |
| Studying (WSET) | 10-20 min | Focused | Quizzes, structured content |

---

## 9. What Would Make Me NOT Use It

### The Dealbreakers

**Too academic.** If Learn feels like a textbook, I will not open it twice. Wine Folly works because it is visual and fun. Wikipedia is comprehensive but dead. I want Wine Folly's energy with personal relevance.

**Too much reading.** If I have to scroll through paragraphs to find the useful bit, I am gone. Everything must be scannable. Lead with the insight, provide depth on demand.

**Not connected to my wines.** If Learn is a generic wine encyclopedia, I already have Google. The entire value proposition is: "This is about YOUR wines, YOUR palate, YOUR collection." Every screen should reference my data. If it cannot, it should not exist.

**Slow to load.** If it takes more than 2 seconds to show me something useful, I will close it. The enrichment data should be pre-cached after the add flow, not fetched on demand. The map should feel instant.

**Hidden behind too many taps.** If I have to navigate Menu > Learn > Categories > Grapes > Red Grapes > Syrah to find information about Syrah, I will never bother. Two taps maximum from the home screen to any piece of knowledge.

**Patronizing tone.** "Did you know that wine comes from grapes?" No. Respect my intelligence. Even beginners know the basics. Start from "you are smart but curious" not "you know nothing."

**Requires me to do homework.** If the feature asks me to fill out surveys, tag my wines manually, or complete lessons before it shows me anything useful, I will abandon it immediately. It should work from day one with whatever data I already have.

### The Turn-offs

- Gamification that feels forced (badges, streaks, XP)
- Social features before the solo experience is solid
- Content that is clearly auto-generated filler
- Notifications pushing me to "learn" when I did not ask
- Paywalling basic information (premium tiers for knowledge)
- Content that contradicts itself (different sources, conflicting advice)

---

## 10. Must-Have vs Nice-to-Have

### Must-Have (Launch with these)

| # | Feature | Persona served | Why essential |
|---|---------|---------------|---------------|
| 1 | **Wine knowledge cards** (tap any wine to see its story, grapes, region, style) | All | This is the minimum viable Learn -- surface existing enrichment data in a browsable way |
| 2 | **Food pairing from MY cellar** ("What goes with X?") | Marcus, Anna | Most common real-world question. Immediate practical value. |
| 3 | **Collection map** (interactive map of wine origins) | James, Catherine | The "wow" moment. Visual, instantly engaging, deeply personal. |
| 4 | **Taste profile** (what styles I prefer based on ratings) | All | Unique value no other app provides. Makes the user feel understood. |
| 5 | **Grape explorer** (tap a grape, see your wines + explanation) | Anna, James, Priya | Bridges the gap between "I like this wine" and "I understand why." |
| 6 | **Jargon-free glossary** (inline term explanations) | Anna | Removes the pretentiousness barrier. Must be contextual, not a dictionary page. |
| 7 | **Drink window dashboard** (which wines to drink when) | Catherine, Marcus | Prevents waste, provides urgency. Practical and data-driven. |

### Nice-to-Have (Phase 2)

| # | Feature | Persona served | Why deferred |
|---|---------|---------------|--------------|
| 8 | Side-by-side comparison | Priya, Catherine | Valuable but needs good data in both wines |
| 9 | "You might also enjoy..." recommendations | James | Requires taste profile to be solid first |
| 10 | Collection insights / analytics | Catherine | Power user feature, not core engagement |
| 11 | Depth slider (Beginner/Intermediate/Expert) | All | Great UX but content needs to exist first at all levels |
| 12 | "Today I Learned" daily nugget | All | Engagement driver but not a standalone reason to open Learn |
| 13 | Dinner party planner | Marcus | Complex feature, needs pairing engine to be proven first |
| 14 | Quiz / flashcard mode | Priya | Niche audience, lower priority than browse-first experience |

### Explicitly Out of Scope (For Now)

- AR label reading (requires native app capabilities)
- Wine twin / social features (single user first)
- Full region courses (content production burden too high)
- Purchase recommendations from external retailers
- Price tracking / market value features

---

## Summary

The Learn feature should feel like a **knowledgeable friend who has memorized everything about my wine collection.** Not a professor. Not a database. A friend who says: "Oh, you are opening that tonight? Let me tell you something cool about it." And: "You know what? Based on everything you have told me you like, you should really try a Nerello Mascalese from Etna."

The single most important design principle: **Every piece of knowledge must connect to the user's own wines, ratings, or preferences.** If it does not, it belongs on Wikipedia, not in Qve.

The single most important technical principle: **Content must be pre-loaded and instant.** A Learn feature that makes the user wait is a Learn feature nobody uses.

The single most important emotional principle: **The user should feel smarter after every interaction, not dumber.** Wine intimidates people. Qve should be the antidote.

# Remember Feature: Strategy Summary

**Date**: 2026-02-12
**Status**: Brainstorming Complete - Ready for Direction Decision
**Team**: System Architect, Data Architect, Designer, Obsessive Scrapbooker, Casual Wine Lover

---

## Executive Summary

The Remember feature transforms Qvé from a wine *inventory* app into a wine *life* app. After an intensive brainstorming session with five perspectives (system architecture, data modelling, frontend design, power user, casual user), a clear consensus emerged:

**70% of memorable wine experiences happen outside the cellar.** Restaurant discoveries, friend recommendations, tasting events, travel moments, social media finds, magazine articles -- none of these are captured today. The cellar tracks what you *own*; Remember tracks what you *experience*.

**The single design principle every team member agreed on**: The wine is never the whole story. A memory is about the wine AND the moment -- the people, the place, the food, the occasion. Capture both, connect them to the cellar and the agent, and you have something no other wine app offers.

**The critical UX constraint** (from the casual wine lover): The entire capture flow must complete in under 5 seconds with zero mandatory fields. AI identifies asynchronously. If it takes longer, users will just take a regular photo and forget about it.

---

## Team Deliverables

| Document | Author | Location | Content |
|----------|--------|----------|---------|
| Architecture Proposal | System Architect | `docs/remember/ARCHITECTURE_PROPOSAL.md` | Endpoints, stores, routes, agent integration, phased roadmap |
| Data Model Proposal | Data Architect | `docs/remember/DATA_MODEL_PROPOSAL.md` | 3-tier schema options, unified canonical DDL, sample data, queries |
| Scrapbooker Persona | Scrapbooker | `docs/remember/PERSONA_SCRAPBOOKER.md` | Power user stories, dream scenarios, organization taxonomy |
| Wine Lover Persona | Wine Lover | `docs/remember/PERSONA_WINE_LOVER.md` | Casual user stories, adoption drivers, friction analysis |
| Timeline Mockup | Designer | `docs/remember/mockups/timeline.html` | 3 variations: journal, scrapbook, social feed |
| Add Memory Mockup | Designer | `docs/remember/mockups/add-memory.html` | Quick capture, full entry, memory type selection |
| Memory Detail Mockup | Designer | `docs/remember/mockups/memory-detail.html` | Expanded view with gallery, tags, enrichment |
| Agent Integration Mockup | Designer | `docs/remember/mockups/agent-integration.html` | Save after ID, recall, natural language search |

---

## Areas of Consensus (All 5 Team Members Agree)

### 1. "Save First, Identify Later" -- Async Capture

Every team member independently identified capture speed as the make-or-break factor. The system architect designed a two-phase flow: instant save (photo + timestamp + GPS), then background AI identification that updates the record asynchronously. The casual user demanded "under 5 seconds." The scrapbooker acknowledged even power users need quick capture at restaurants. The data architect added a `status` column (`draft` / `identified` / `enriched`) to track AI processing state.

### 2. One Capture Flow, Two Depths

Quick capture = 2-3 taps (photo, optional vibe rating, optional occasion chip). Rich context (people, place, food, detailed notes, 1-10 rating, multiple photos) available via "Add More Details" but never required upfront. A memory with just a photo and timestamp is *complete*. No empty-state guilt -- cards render gracefully at any fill level.

### 3. AI Does Cataloguing, Humans Do Remembering

The identification engine auto-populates producer, wine name, vintage, region, and type. The user adds the personal narrative: who, where, why, what it meant. This principle resolves most "should we add field X?" decisions -- if it's a fact about the wine, the AI fills it. If it's a feeling about the moment, the user fills it.

### 4. VibeRating Over Numeric Scores

4 vibes (Loved / Liked / Meh / Nope) mapped to numeric values (9/7/5/3) for database compatibility. The casual user won't rate tannins on a 1-10 scale. The scrapbooker gets an optional full 1-10 rating in the expanded edit view. Two layers, one system.

### 5. Cellar-to-Memory Bridge

Identified as potentially the highest-volume memory creation path. After the existing DrinkRateModal completes, offer "Save as memory?" with wine data, date, and rating pre-filled. Just add occasion chips and an optional photo. Near-zero friction because all structured data already exists.

### 6. Agent-Native Integration

The existing "Remember" chip (currently "coming soon") becomes the primary entry point. Post-identification: save the full result as a memory. Post-enrichment: attach critic scores, grape data, and tasting notes. The agent also powers natural language recall ("what was that wine from Sarah's dinner?") -- this is the killer differentiator over a camera roll.

### 7. CRUD MVP with Graph Extensibility

The system architect recommended simple CRUD for MVP (the app is single-user), with the schema designed to support graph-based connections later via a `memoryConnections` table. Event sourcing was rejected as over-engineered. The data architect aligned with a 4-table unified schema.

---

## Areas of Creative Divergence (Good Options to Choose From)

### Timeline Design: Journal vs Scrapbook vs Social Feed

| Variation | Champion | Feel | Best For |
|-----------|----------|------|----------|
| **A: Journal** | Scrapbooker | Text-heavy, chronological diary with date headers | Power users who write detailed notes |
| **B: Scrapbook/Pinterest** | Both | Visual masonry grid, card-based, mood board feel | Photo-heavy users, browsing aesthetic |
| **C: Social Feed** | Wine Lover | Rich media timeline, avatar + action text, interaction-focused | Casual users, Instagram-familiar UX |

**See**: `docs/remember/mockups/timeline.html` -- all 3 variations are switchable in-browser.

**Recommendation**: Start with **Variation B (Scrapbook)** -- it balances visual appeal (casual user) with information density (power user). Journal elements can surface in the detail view; social feed elements inform the agent integration cards.

### Data Model Depth: Minimal vs Medium vs Full

| Option | Tables | Tags | Media | Locations | Collections | Search |
|--------|--------|------|-------|-----------|-------------|--------|
| **A: Minimal** | 1 | JSON column | JSON column | Free text | None | LIKE queries |
| **B: Medium** (Rec.) | 3 | Normalized join | Normalized table | Free text | Via tags | LIKE + FULLTEXT |
| **C: Full** | 6 | Normalized | Normalized + metadata | Normalized entity | Dedicated tables | FULLTEXT |

**Recommendation**: **Option B** -- normalized tags and media from day one (avoids painful JSON→table migration later), but defers locations and collections entities to V2+. The unified canonical schema in the data model proposal already reflects this choice, extended with flat wine columns and a FULLTEXT index.

### Organization: Manual Tags vs Auto-Suggested

| Approach | Champion | Example |
|----------|----------|---------|
| **Manual tags + collections** | Scrapbooker (original) | User creates "Italy Trip 2026" collection |
| **Auto-suggested only** | Wine Lover | Agent detects 3 memories from same evening, offers "Group as event?" |
| **Hybrid** (consensus) | Both | Free-form tags at capture, smart collections auto-generated, manual collection creation in V2 |

**Recommendation**: **Hybrid** -- free-form tags with autocomplete from existing tags (V1), auto-generated smart collections like "Your Italian Reds" (V2), manual "Create Collection" (V2+).

### Wish List: Tags vs First-Class Entity

| Approach | Champion | Implementation |
|----------|----------|---------------|
| **Tags** ("want-to-try") | Data Architect | Use the existing tag system, filter by tag |
| **Intent field** | System Architect | ENUM: `experienced`, `want_to_try`, `want_to_buy`, `want_to_revisit` |
| **Both** (consensus) | Both personas | Intent field for primary categorization, tags for additional nuance |

**Recommendation**: The `intent` field is simpler and more queryable than relying on tag conventions. Both personas agreed wish list is first-class.

---

## Three Strategic Options

### Option A: "The Capture" (MVP -- Recommended to Start)

**Philosophy**: Make the "Remember" chip work. Quick capture, beautiful feed, agent recall.

**What ships**:
- "Remember" chip after identification → saves memory with pre-filled wine data
- Quick capture from FAB (floating action button) on Remember page
- Cellar-to-memory bridge after DrinkRateModal
- Memory timeline feed (scrapbook/card layout)
- Memory detail view with photo gallery
- VibeRating component (4 levels)
- Occasion chips (restaurant, dinner party, tasting, travel, other)
- Free-form tags with autocomplete
- Basic search (FULLTEXT on title, producer, wineName, notes, location)
- Filter by occasion, country, wine type, tag, date range
- SideMenu navigation link

**Data changes**: 4 new tables (`memories`, `memoryMedia`, `memoryTags`, `memoryConnections`). No changes to existing tables.

**New files**: ~20 (7 PHP endpoints, 1 store, 8 components, 2 routes, 1 agent handler, 1 migration)

**Modified files**: ~15 (API client, types, agent router, enrichment handler, chip configs, SideMenu, deploy script)

**Effort**: 2-3 sprints

**What it feels like**: Snapping a wine label at dinner, tapping "Remember," and finding it three weeks later when you're at the wine shop. The moment you realize your wine memories are searchable, not scattered.

### Option B: "The Journal" (Rich Discovery)

**Everything in Option A, plus**:
- MemoryTimeline grouped-by-month view with section headers
- Tag cloud component for visual browsing
- Agent `recall_memories` action with LLM-powered natural language → SQL filter conversion
- "On This Day" widget surfacing memories from previous years
- Memory statistics for Learn module integration ("You've tried 6 Italian reds")
- Swipeable photo gallery component
- Compact list view mode
- Date range filter UI
- `memoryConnections` populated by agent (related wines, same occasion)
- Memory-to-cellar conversion flow ("Buy this wine" → Add to Cellar with pre-filled data)
- Intent tracking (want to try / want to buy / want to revisit)

**Data changes**: Populate `memoryConnections` table. Add `intent` and `status` columns if not in MVP.

**Effort**: 2 additional sprints (4-5 total)

**What it feels like**: Asking the agent "what was that wine from Sarah's party?" and getting an answer. Browsing your Burgundy memories chronologically and seeing your palate evolve. A notification-free "This time last year" moment.

### Option C: "The Companion" (AI-Powered Memory Intelligence)

**Everything in Option B, plus**:
- Map view with memory pins (Leaflet/Mapbox)
- Geolocation capture with reverse geocoding
- Offline quick capture with Background Sync API
- AI-generated memory suggestions ("You've been exploring Barolo -- here's a producer you haven't tried")
- Auto-detected event grouping ("You saved 3 wines on Feb 14 -- group as 'Valentine's Dinner'?")
- Shareable wine memory cards (pretty image for iMessage/WhatsApp)
- Annual wine review / year-in-wine summary
- Wine journey visualization (timeline + map combined)
- Smart collections (auto-generated: "Wines You Loved", "Your Burgundy Journey", "Frequent Companions")
- Export memory as PDF
- Learn module cross-referencing ("Today we're learning about Merlot -- you tried one last August!")

**Data changes**: Add `memoryLocations` table, `memoryCollections` + `memoryCollectionItems`. Extend agent router with recall intent.

**Effort**: 4-6 additional sprints (8-10 total)

**What it feels like**: A personal wine companion that knows every wine you've ever encountered, connects your experiences into narratives, and surfaces forgotten memories at exactly the right moment.

---

## Recommended Phased Roadmap

```
Phase 1: The Capture (Sprint 15-17)
├── "Remember" chip functional (from identification + enrichment)
├── Quick capture FAB on /qve/remember
├── Cellar-to-memory bridge (post-DrinkRateModal prompt)
├── saveMemory.php transaction endpoint
├── getMemories.php with pagination + filters
├── memory store (Svelte)
├── MemoryCard + MemoryGrid components
├── MemoryForm + MemoryQuickCapture
├── VibeRating component
├── OccasionPicker chips
├── MemoryFilterBar
├── /qve/remember route
├── /qve/remember/[id] detail route
├── SideMenu link
├── Deploy script update (images/memories/)
└── 4 DB tables (memories, memoryMedia, memoryTags, memoryConnections)

Phase 2: The Journal (Sprint 18-19)
├── MemoryTimeline grouped-by-month view
├── Tag cloud component
├── Agent recall_memories action
├── LLM-powered natural language → SQL filters
├── "On This Day" memories widget
├── Swipeable photo gallery
├── Memory-to-cellar conversion
├── Intent tracking (want to try/buy/revisit)
├── memoryConnections populated by agent
├── Memory statistics API for Learn module
└── Date range filter UI

Phase 3: The Companion (Sprint 20+)
├── Map view with memory pins
├── Geolocation + reverse geocoding
├── Shareable wine memory cards
├── Auto-detected event grouping
├── Smart collections (auto-generated)
├── Annual wine review / year-in-wine
├── Learn module cross-referencing
├── Offline quick capture (Service Worker)
├── AI memory suggestions
└── Export as PDF
```

---

## Decision Matrix

| Criteria | Option A (Capture) | Option B (Journal) | Option C (Companion) |
|----------|:---:|:---:|:---:|
| Time to first value | **2-3 sprints** | 4-5 sprints | 8-10 sprints |
| Capture friction | Very low | Very low | Very low |
| Discovery / browsing | Basic (filter + search) | Rich (timeline + tags + agent) | Full (map + smart collections) |
| Agent integration | Save only | Save + recall | Save + recall + suggest |
| Learn module connection | None | Statistics API | Full cross-referencing |
| Schema complexity | 4 tables | 4 tables + populated connections | 7 tables |
| Frontend components | ~8 new | ~14 new | ~20 new |
| User wow factor | High (capture speed) | Very High (agent recall) | Exceptional (memory intelligence) |
| Maintenance burden | Low | Low-Medium | Medium-High |
| Risk | Low | Low | Medium |

**Recommendation**: Start with **Option A** (The Capture). It delivers the core value proposition -- quick capture, beautiful feed, agent integration -- in 2-3 sprints. The "Remember" chip going from "coming soon" to fully functional is a tangible milestone. Then layer in Option B features based on what users actually use most (agent recall is the likely V2 priority based on both personas).

---

## Mockup Guide

Open these in a browser to see the designs. Each has a light/dark theme toggle and is mobile-responsive (375px primary viewport).

| Mockup | File | Shows |
|--------|------|-------|
| **Memory Timeline** | `docs/remember/mockups/timeline.html` | 3 switchable variations: journal (text-heavy), scrapbook (masonry cards), social feed (rich media) |
| **Add Memory** | `docs/remember/mockups/add-memory.html` | Quick capture (3-step), full entry form, memory type selector |
| **Memory Detail** | `docs/remember/mockups/memory-detail.html` | Photo gallery, notes, tags, context card, linked wine, enrichment suggestions, related memories |
| **Agent Integration** | `docs/remember/mockups/agent-integration.html` | Save after identification, proactive recall ("You spotted this exact wine last week"), natural language search |

**Design language**: All mockups use the exact Qvé token palette (Cormorant Garamond + Outfit fonts, warm neutral colors). Type-specific colour coding: Tasted (wine/rose), Spotted (blue), Recommended (green), Travel (gold), Event (accent).

---

## Key Quotes from the Team

> **System Architect**: "Start with Approach A (CRUD) for MVP, with the schema designed to support graph extensions later. The app is single-user -- event sourcing adds complexity without clear benefit."

> **Data Architect**: "Option B (normalized tags and media) avoids a painful JSON-to-table migration later. The incremental complexity of 2 extra tables with CASCADE deletes is minimal compared to the query flexibility gained."

> **Scrapbooker**: "The wine is never the whole story. The memory is about the wine AND the moment. Capture both, connect them to your cellar, and you have something no other app offers."

> **Wine Lover**: "Under 5 seconds to capture or I'm out. I am not going to rate tannins on a 1-10 scale. Ever. AI does the heavy lifting -- I snap a photo, the app tells ME what wine it is."

> **Wine Lover**: "The conversational recall is massively more useful than filter dropdowns. It's how I actually think about wine -- in stories and contexts, not in SKUs."

> **Scrapbooker**: "AI fills facts, humans fill feelings. That test resolves most 'should we add field X?' decisions."

---

## Cross-Persona Consensus: 7 Design Principles

These emerged from direct negotiation between the obsessive scrapbooker and the casual wine lover. They represent agreement across the full user spectrum:

1. **One capture flow, two depths.** Quick = 2-3 taps. Rich = expand on demand, never by default.
2. **No empty-state guilt.** Photo-only memory = complete. 15-field memory = complete. Cards render gracefully at any fill level.
3. **AI does cataloguing, humans do remembering.** Facts (producer, vintage, region) = AI. Feelings (who, where, why) = human.
4. **Connections are AI-surfaced, not user-built.** No manual "this reminded me of..." buttons. The agent IS the connection engine.
5. **Auto-suggested organization, not manual taxonomy.** Smart collections offered, not demanded. Manual creation is V2.
6. **Share = pretty card via messaging.** No profiles, no followers, no public feed. Just a shareable image card.
7. **Wish list is first-class.** "Want to try" is as easy to capture as a memory. Filterable by intent.

---

## Next Steps

1. **Review mockups** -- Open all 4 HTML files in a browser, try light/dark mode, check mobile view
2. **Pick a timeline variation** -- Journal (A), Scrapbook (B), or Social Feed (C)?
3. **Pick a direction** -- Option A (fast capture MVP), B (rich journal), or C (full companion)?
4. **Create JIRA sprint** -- Break Phase 1 into sprint-ready tickets
5. **Start with the "Remember" chip** -- The architect recommends making the existing "coming soon" chip functional as the first deliverable, since it touches every layer (agent handler, store, API, PHP endpoint, database)
6. **Create migration SQL** -- The unified canonical schema in `DATA_MODEL_PROPOSAL.md` Section 10 is implementation-ready

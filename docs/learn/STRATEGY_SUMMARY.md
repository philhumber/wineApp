# Learn Feature: Strategy Summary

**Date**: 2026-02-09
**Status**: Brainstorming Complete - Ready for Direction Decision
**Team**: Architect, Data Expert, Wine Teacher, Wine Student, Designer

---

## Executive Summary

The Learn feature transforms Qvé from a wine *tracking* app into a wine *knowledge* app. After an intensive brainstorming session with five perspectives (architecture, data, content, user, design), a clear consensus emerged:

**The app already sits on a goldmine of educational data that is invisible to users.** 42 grape varieties, 33 countries with wine histories, 47 appellations, 30 wine styles, 58 pairing rules, and 500+ cached enrichments -- all collected but never surfaced outside the add-wine flow. The MVP strategy is to **reveal what's hidden before creating anything new**.

**The single design principle every team member agreed on**: Every piece of knowledge must connect to the user's own wines, ratings, or preferences. A generic wine encyclopedia belongs on Wikipedia. Qvé's Learn is personal.

---

## Team Deliverables

| Document | Author | Location | Lines |
|----------|--------|----------|-------|
| System Architecture | Architect | `docs/learn/ARCHITECTURE.md` | ~1300 |
| Data Strategy | Data Expert | `docs/learn/DATA_STRATEGY.md` | ~1000 |
| Content Strategy | Wine Teacher | `docs/learn/CONTENT_STRATEGY.md` | ~650 |
| User Perspective | Wine Student | `docs/learn/USER_PERSPECTIVE.md` | ~330 |
| Frontend Mockups (6) | Designer | `docs/learn/mockups/*.html` | ~145KB |

---

## Areas of Consensus (All 5 Team Members Agree)

### 1. Personal First, General Second
Every team member independently arrived at the same conclusion: the Learn feature only works if it's about **your** wines. The architect designed "Your [Topic] Wines" sections on every detail page. The data expert wrote personalization queries blending reference + collection data. The wine teacher made it principle #1. The wine student called it the dealbreaker. The designer put "Your Collection" sections prominently in every mockup.

### 2. Surface Existing Data First
The data expert's key finding: the database already contains months of educational content that's never been shown to users. The wine teacher confirmed: 42 grape descriptions + 33 country histories + 58 pairing rules = 130+ unique content cards without writing a single new article. The architect designed a zero-schema Phase 1 that leverages all existing reference tables.

### 3. Hybrid Navigation
The architect's Option C (top-level `/qve/learn` route + contextual deep-links from wine cards) was the unanimous favourite. The wine student required "two taps max" to any knowledge. The designer created nav-patterns.html showing both approaches working together -- LearnChips on wine cards for contextual entry, plus a dedicated Learn hub for browsing.

### 4. Bite-Sized by Default
The wine student stressed 30-90 second visits. The wine teacher designed "Wine Moments" (contextual micro-learning). The architect used progressive disclosure (headline → expandable detail → deep-dive). The designer created scannable cards with visual indicators, not walls of text.

### 5. Speed is Non-Negotiable
The wine student set a 2-second threshold. The architect designed code-split routes adding only 0.5KB to the initial bundle. The data expert recommended pre-computing taste insights. All reference data is static and highly cacheable.

---

## Areas of Creative Divergence (Good Options to Choose From)

### Content Depth: Reference vs. Education vs. Entertainment

| Approach | Champion | Example | Effort |
|----------|----------|---------|--------|
| **Reference** (data cards) | Architect, Data Expert | Grape detail with body/tannin/acidity scales + your wines | Low |
| **Education** (learning paths) | Wine Teacher | "The Confident Beginner" -- 10 sessions, 5 min each | Medium-High |
| **Entertainment** (stories/scandals) | Wine Teacher | "Rudy Kurniawan: The Wine Counterfeiter" series | Medium |

**Recommendation**: Start with Reference (Phase 1), add Education + Entertainment (Phase 2+). The reference layer needs to work perfectly before layering curriculum on top.

### Engagement Model: Pull vs. Push

| Approach | Champion | Example |
|----------|----------|---------|
| **Pull** (user browses) | Wine Student, Architect | Learn hub, grape explorer, pairing tool |
| **Push** (app surfaces) | Wine Teacher | "Wine Moments" -- contextual cards triggered by user actions |
| **Conversational** (agent teaches) | Wine Teacher | "Ask the Sommelier" about any topic |

**Recommendation**: All three, phased. Pull first (the hub and detail pages). Push second (Wine Moments during existing flows). Conversational third (agent learn intent).

### Gamification: Subtle vs. None

| View | Champion | Reasoning |
|------|----------|-----------|
| **Yes, subtly** | Wine Teacher | Badges, achievements, exploration progress ("8 of 42 grapes explored") |
| **Careful, optional** | Wine Student | "Gamification that feels forced" is a turn-off. No streaks, no guilt. |

**Recommendation**: Exploration progress (counters, not streaks). Achievements as delightful surprises, never as obligations. No Duolingo guilt. The designer's wine-journey.html mockup shows a tasteful "Adventurousness Score" (62/100) that feels fun, not forced.

---

## Three Strategic Options

### Option A: "The Revealer" (MVP -- Recommended to Start)

**Philosophy**: Surface the hidden data goldmine. Zero new content creation.

**What ships**:
- Learn hub with category cards (Grapes, Regions, Styles, Pairings)
- Grape detail pages with flavor profiles + "Your wines with this grape"
- Region detail pages with terroir + "Your wines from here"
- Food pairing explorer from existing 58 rules + cellar matching
- Personal taste profile (computed from ratings)
- LearnChips on wine cards for contextual deep-linking
- Collection map (countries/regions you've explored)

**Data changes**: 2 new tables (exploration log, bookmarks). Complete 13 missing grape profiles. Add pronunciation guides + fun facts.

**Effort**: 2 sprints (Phase 1 + Grapes vertical, then remaining categories)

**What it feels like**: Opening the app and discovering your wines have stories you never knew. Tapping "Pinot Noir" and seeing all 12 of your Pinot Noirs with an explanation of why you love them.

### Option B: "The Teacher" (Full Platform)

**Everything in Option A, plus**:
- Wine Moments (contextual micro-learning during existing flows)
- Learning paths (Confident Beginner, Explorer, Dinner Party Host, Collector, Storyteller)
- Comparison cards (Barolo vs Barbaresco, Champagne vs Prosecco)
- Quiz mode (driven by sommelier personality)
- Knowledge graph connecting grapes ↔ regions ↔ styles ↔ pairings
- Winemaking processes reference (12 entries from terroir to fortification)
- Agent "Ask the Sommelier" for educational queries
- Daily wine fact, weekly deep dive, seasonal content calendar

**Data changes**: 6 new tables, expanded grape characteristics, knowledge graph auto-population, winemaking process seed data.

**Effort**: 4-6 sprints total

**What it feels like**: A personal wine school that knows your cellar. Quentin teaching you about Nebbiolo because you just opened a Barolo.

### Option C: "The Companion" (AI-Powered Learning)

**Everything in Option B, plus**:
- Conversational learning paths via the agent
- AI-generated deep-dive articles (with human review)
- Wine embeddings for similarity-based discovery ("wines like this but cheaper")
- Dinner party planner (enter menu, get cellar recommendations + talking points)
- Taste profile evolution over time
- "Wine Weather" mood-based suggestions
- Vintage comparison tools

**Data changes**: Populate `agentUserTasteProfile` and `agentWineEmbeddings`. Extend agent router with learn intent. Content generation pipeline.

**Effort**: 6-10 sprints total

**What it feels like**: A knowledgeable friend who remembers everything about your wines, teaches you something new every day, and helps you plan dinner parties.

---

## Recommended Phased Roadmap

```
Phase 1: The Revealer (Sprint 14-15)
├── Learn hub + SideMenu entry
├── Grape detail pages (29 with full profiles)
├── Region detail pages (30+ with terroir)
├── LearnChips on WineCard
├── Complete 13 missing grape profiles
├── Add pronunciation guides + fun facts
├── Personal collection overlay on every page
└── Exploration tracking (learnExplorationLog)

Phase 2: The Explorer (Sprint 16-17)
├── Food pairing explorer (from 58 rules)
├── Wine style pages (30 styles)
├── Appellation pages (47 appellations)
├── Collection map visualization
├── Taste profile / Wine DNA page
├── Cross-category search
├── Wine Moments (contextual micro-learning)
└── Comparison cards (10 high-value pairs)

Phase 3: The Teacher (Sprint 18-19)
├── Agent "Ask the Sommelier" learn intent
├── Post-enrichment Learn suggestion chips
├── Winemaking processes reference (12 entries)
├── Knowledge graph (auto-populated)
├── Quiz mode via agent personality
├── Learning paths (start with "Confident Beginner")
└── Daily wine fact / weekly deep dive

Phase 4: The Companion (Sprint 20+)
├── Taste profile evolution tracking
├── Wine embeddings + similarity discovery
├── AI-generated deep-dive articles
├── Dinner party planner
├── Drink window dashboard
├── Collection insights / analytics
└── Achievements + exploration milestones
```

---

## Decision Matrix

| Criteria | Option A (Revealer) | Option B (Teacher) | Option C (Companion) |
|----------|:---:|:---:|:---:|
| Time to first value | **2 sprints** | 4-6 sprints | 6-10 sprints |
| New content creation needed | None | Medium | High |
| Schema complexity | 2 tables | 6 tables | 6 tables + embeddings |
| User wow factor | High (personal connection) | Very High (education + personality) | Exceptional (AI companion) |
| Maintenance burden | Low (static data) | Medium (content calendar) | High (AI pipeline + review) |
| Risk | Low | Medium | Medium-High |
| Reuse of existing data | Excellent | Excellent | Excellent |
| Agent integration | Minimal | Deep | Full |
| Engagement ceiling | Medium | High | Very High |

**Recommendation**: Start with **Option A** (The Revealer) as your foundation. It ships fast, has zero content creation dependency, and proves the core concept: personal wine knowledge. Then layer in Option B features sprint by sprint based on what users engage with most.

---

## Mockup Guide

Open these in a browser to see the designs. Each has a light/dark theme toggle and is mobile-responsive.

| Mockup | File | Shows |
|--------|------|-------|
| **Learn Hub** | `docs/learn/mockups/learn-hub.html` | Two layout variations: category-grid vs personal-journey-first |
| **Grape Detail** | `docs/learn/mockups/grape-detail.html` | Pinot Noir page with flavor bars, your wines, pairings, fun facts |
| **Region Detail** | `docs/learn/mockups/region-detail.html` | Burgundy page with terroir, classification, appellations, your wines |
| **Pairing Explorer** | `docs/learn/mockups/pairing-explorer.html` | Food category browser, intensity matching, cellar recommendations |
| **Wine Journey** | `docs/learn/mockups/wine-journey.html` | Taste radar chart, country map, top grapes, adventurousness score |
| **Nav Patterns** | `docs/learn/mockups/nav-patterns.html` | 6 patterns: side menu, LearnChips, bottom tab, breadcrumbs, filter pills, history cards |

---

## Key Quotes from the Team

> **Architect**: "The user's own collection is the best curriculum. A bottle of Barolo in the cellar is the perfect entry point to learn about Nebbiolo, Piedmont, and Italian wine classification."

> **Data Expert**: "The Learn feature can ship an MVP that primarily surfaces existing hidden data before needing significant new content creation."

> **Wine Teacher**: "We are not building a wine encyclopedia. We are building a trail of breadcrumbs that makes people want to know more."

> **Wine Student**: "Every piece of knowledge must connect to the user's own wines, ratings, or preferences. If it does not, it belongs on Wikipedia, not in Qvé."

> **Wine Teacher**: "If Nebbiolo were a person: shows up late, doesn't apologize, makes the evening better anyway."

---

## Next Steps

1. **Review mockups** -- Open all 6 HTML files in a browser, try light/dark mode, check mobile view
2. **Pick a direction** -- Option A (fast), B (rich), or C (ambitious)?
3. **Create JIRA issues** -- Break Phase 1 into sprint-ready tickets
4. **Start with Grapes** -- The architect recommends one complete vertical (Grapes) first as the template for all other categories
5. **Fill data gaps** -- Complete the 13 missing grape characteristic profiles before building UI

# Wine Agent Rearchitecture Review
**Date:** 2026-02-03
**Branch:** claude/agent-rearchitecture-review-EXUD5
**Reviewer:** Claude Code Agent (4 specialized sub-agents)

---

## Executive Summary

The comprehensive agent architecture plan is **well-designed but only ~60% implemented**. The wine identification flow is production-ready and the backend exceeds expectations, but the frontend has **critical maintainability issues** that must be addressed before adding new features.

### Key Findings at a Glance

| Area | Grade | Status |
|------|-------|--------|
| **Backend (PHP)** | **B+** | Production-ready, sophisticated architecture |
| **Frontend (Svelte)** | **C** | Working but critically unmaintainable |
| **Database Schema** | **B+** | 75% complete, 7 missing tables |
| **Plan vs Reality** | **60%** | Wine flow done, pairing/preferences missing |

### The #1 Priority

**AgentPanel.svelte is 4,037 lines** (worse than the 3,794 lines documented in the analysis!). This monolithic component makes testing impossible, maintenance risky, and new features dangerous. **Refactoring must start immediately.**

---

## Consolidated Gap Analysis

### What's Implemented ✅

| Feature | Status | Notes |
|---------|--------|-------|
| Wine Input Flow | 100% | classify → identify → verify → enrich |
| LLM Tiered Escalation | 100% | Gemini → Claude Opus with circuit breakers |
| Caching Strategy | 120% | 4-tier canonical resolution (exceeds plan!) |
| Streaming SSE | 100% | Progressive field arrival with typewriter UX |
| Add-to-Cellar Flow | 100% | Duplicate detection, entity matching |
| Cost Tracking | 100% | Per-model tracking, daily limits |
| Circuit Breakers | 100% | Per-provider isolation |
| Universal Card Architecture | 60% | DataCard exists, duplicates remain |

### What's Missing ❌

| Feature | Status | Impact |
|---------|--------|--------|
| Meal Pairing Flow | 0% | 30% of planned functionality |
| User Preferences | 0% | No personalization |
| Conversation Manager | 40% | Single-turn only, no multi-turn |
| Observability (tracing/metrics) | 30% | Cost tracking yes, tracing no |
| AgentPanel Refactoring | 0% | CRITICAL - 4,037 lines |
| Agent Store Split | 0% | 2,010 lines, 30+ derived stores |
| Phase Simplification | 0% | 20+ phases vs planned 8-10 |

---

## Critical Gotchas Found

### Backend Gotchas

1. **Streaming + Escalation Interaction** - Escalated responses are buffered then fake-streamed with artificial delays. If escalation fails, already-displayed Tier 1 fields aren't cleared.

2. **Gemini Model Silent Fallback** - If gemini-3-flash-preview returns 404, adapter silently falls back to gemini-2.0-flash. Logs show wrong model.

3. **Circuit Breaker DB Dependency** - Every LLM request queries the database for circuit state. Adds latency, creates dependency.

4. **Duplicate Endpoints** - `identifyText.php` and `identifyTextStream.php` share 80% code (~450 lines duplication).

5. **SSL Certificate Disabled in Dev** - Falls back to `CURLOPT_SSL_VERIFYPEER = false` if cert not found. Security risk.

### Frontend Gotchas

1. **Streaming State Cleanup Timing** - If panel closed during streaming, state preserved. On reopen, streaming card re-appears even though stream completed.

2. **Add-Wine Form State Validation** - `AgentAddState` has 10+ nested fields. Validation logic is separate from state updates, easy to get into invalid state.

3. **Message `isNew` Flag Lifecycle** - On page refresh, chips become enabled again because `disabled` state isn't persisted.

4. **Enrichment vs Identification Conflicts** - Both use same `streamingFields` Map. Can't stream both simultaneously.

5. **30+ Reactive Statements** - AgentPanel subscribes to 30+ stores, causing full re-render on any change.

### Database Gotchas

1. **Region vs Appellation Conflation** - `refAppellations` mixes regions and appellations. Need separate `refRegions` table.

2. **No TTL Indexes** - Cache tables have field-level TTLs but no indexes on timestamp fields. Cleanup queries will full-scan.

3. **Only 3 Foreign Keys** - Missing FK constraints on critical tables (wineId relationships).

4. **Embedding JSON Column** - Storing 1536-dimensional vectors as JSON. Won't scale beyond ~500 wines.

---

## Priority Recommendations

### 🔴 Priority 1: Critical (Start Immediately)

#### 1.1 Refactor AgentPanel (7-10 days)

**Why:** 4,037 lines is unmaintainable and GROWING (+243 lines in 2 days!)

**Action:**
```
Follow PHASE_1_IMPLEMENTATION_PLAN.md:
1. Create visual regression tests FIRST
2. Extract ConversationContainer.svelte (200 lines)
3. Extract IdentificationFlow.svelte (300 lines)
4. Extract AddWineFlow.svelte (500 lines)
5. Extract EnrichmentFlow.svelte (200 lines)
6. Reduce AgentPanel to <300 lines
```

**Success Metric:** AgentPanel < 400 lines, all tests passing

#### 1.2 Delete Duplicate Card Components (2 hours)

**Why:** 1,100+ lines of duplicate code

**Action:**
```
DELETE:
- qve/src/lib/components/agent/WineCardStreaming.svelte (399 lines)
- qve/src/lib/components/agent/WineIdentificationCard.svelte (200 lines)
- qve/src/lib/components/agent/EnrichmentCardStreaming.svelte
- qve/src/lib/components/agent/EnrichmentSkeleton.svelte

KEEP:
- WineCard.svelte (128 lines, uses DataCard)
- EnrichmentCard.svelte (uses DataCard)
```

#### 1.3 Fix Streaming + Escalation UX

**Why:** Risk of showing wrong data after escalation fails

**Action:** Buffer Tier 1 response, decide on escalation, then stream final tier OR stream Tier 1, show "refining..." overlay, replace fields on escalation.

### 🟡 Priority 2: High (Week 2)

#### 2.1 Split Agent Store

**Why:** 2,010 lines mixing 5 different concerns

**Action:**
```typescript
// Create 4 focused stores:
- agentIdentification.ts (identification + streaming)
- agentEnrichment.ts (enrichment data + cache confirmation)
- agentConversation.ts (phase, messages)
- agentAddWine.ts (add-to-cellar flow)
```

#### 2.2 Add Database Missing Indexes

**Why:** Cache cleanup queries will full-scan without indexes

**Action:**
```sql
-- Cache TTL indexes
ALTER TABLE cacheProducers ADD INDEX idx_static_ttl (staticFetchedAt);
ALTER TABLE cacheWineEnrichment ADD INDEX idx_dynamic_ttl (dynamicFetchedAt);

-- Session cleanup
ALTER TABLE agentSessions ADD INDEX idx_lastActivity (lastActivityAt);

-- Usage tracking
ALTER TABLE agentUsageLog ADD INDEX idx_requestHash (requestHash);
```

#### 2.3 Add Missing Foreign Keys

**Action:**
```sql
ALTER TABLE cacheWineEnrichment
    ADD CONSTRAINT fk_enrichment_wine
    FOREIGN KEY (wineId) REFERENCES wine(wineID) ON DELETE CASCADE;

ALTER TABLE agentWineEmbeddings
    ADD CONSTRAINT fk_embedding_wine
    FOREIGN KEY (wineId) REFERENCES wine(wineID) ON DELETE CASCADE;
```

### 🟢 Priority 3: Medium (Week 3-4)

#### 3.1 Add Observability

**Why:** Can't debug production without traces, can't optimize without metrics

**Action:**
- Create TraceService.php with unique trace IDs
- Add trace IDs to all API responses
- Log decision points (classification, confidence, escalation)
- Expose `/api/agent/metrics` endpoint
- Track cache hit rate, escalation rate, avg latency

#### 3.2 Simplify Phase Model

**Action:** Reduce 20+ phases to 8 core phases with sub-states:
```typescript
type AgentPhase =
  | 'greeting' | 'awaiting_input' | 'identifying' | 'confirming'
  | 'adding_wine' | 'enriching' | 'error' | 'complete';

type AddWineStep = 'confirm' | 'entity_matching' | 'bottle_details' | 'enrichment';
```

#### 3.3 Create Missing Database Tables

**Action:**
```sql
-- User behavior tracking (HIGH impact)
CREATE TABLE agentInteractions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    userId INT NOT NULL,
    wineId INT NOT NULL,
    interactionType ENUM('view', 'pair', 'rate', 'purchase', 'drink'),
    context JSON NULL,
    rating INT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Multi-turn conversations (MEDIUM impact)
CREATE TABLE agentConversationMessages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    sessionId INT NOT NULL,
    role ENUM('user', 'assistant', 'system'),
    content TEXT NOT NULL,
    metadata JSON NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Debugging traces (MEDIUM impact)
CREATE TABLE agentTraces (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    traceId VARCHAR(64) NOT NULL,
    userId INT NOT NULL,
    step VARCHAR(100) NOT NULL,
    action VARCHAR(255) NOT NULL,
    inputData JSON NULL,
    outputData JSON NULL,
    duration_ms INT NULL,
    success BOOLEAN DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### ⚪ Priority 4: Future (Month 2+)

#### 4.1 Implement Meal Pairing Flow

**Prerequisites:**
- AgentPanel refactored
- Agent store split
- OpenAI embeddings integration

**Scope:**
- PairingService.php
- Meal analysis endpoint
- Collection search with semantic ranking
- Pairing recommendation endpoint

**Effort:** 2-3 weeks

#### 4.2 Implement User Preferences

**Prerequisites:**
- Meal pairing working
- Observability in place

**Scope:**
- PreferencesService.php
- Taste profile computation
- Interaction tracking
- Personalized recommendations

**Effort:** 1-2 weeks

---

## Implementation Timeline

### Week 1: Critical Refactoring
| Day | Task | Hours |
|-----|------|-------|
| 1 | Create visual regression tests | 4 |
| 1-2 | Extract ConversationContainer | 3 |
| 2 | Extract IdentificationFlow | 4 |
| 3 | Extract AddWineFlow | 5 |
| 3-4 | Extract EnrichmentFlow | 2 |
| 4-5 | Refactor AgentPanel to <300 lines | 4 |
| 5 | Delete duplicate card components | 2 |

**Deliverable:** AgentPanel refactored, all tests passing

### Week 2: Store Split + Database Fixes
| Day | Task | Hours |
|-----|------|-------|
| 1-2 | Create 4 focused stores | 8 |
| 3 | Update components to use new stores | 4 |
| 4 | Add missing indexes and FKs | 2 |
| 5 | Integration testing | 4 |

**Deliverable:** 4 focused stores, database performance fixed

### Week 3: Observability + Polish
| Day | Task | Hours |
|-----|------|-------|
| 1 | Create TraceService.php | 4 |
| 2 | Add trace IDs to all endpoints | 2 |
| 2-3 | Create metrics endpoint | 4 |
| 3-4 | Simplify phase model | 6 |
| 5 | Documentation updates | 2 |

**Deliverable:** Full observability, simplified state machine

### Week 4: Testing + Stabilization
| Day | Task | Hours |
|-----|------|-------|
| 1-2 | Unit tests for stores | 6 |
| 3 | Component tests | 4 |
| 4 | E2E tests for critical flows | 4 |
| 5 | Bug fixes, performance tuning | 4 |

**Deliverable:** >80% test coverage, production-ready

---

## Success Metrics (Post-Refactoring)

| Metric | Before | Target |
|--------|--------|--------|
| AgentPanel.svelte lines | 4,037 | <400 |
| agent.ts lines | 2,010 | 4 stores × ~400 each |
| Conversation phases | 20+ | 8-10 |
| Message types | 18 | 5 categories |
| Duplicate card code | 1,100+ lines | 0 lines |
| Test coverage | 0% | >80% |
| New feature time | 2-3 days | 1 day |
| Bug fix time | 1-2 days | 1-2 hours |

---

## Risk Assessment

### High Risk
- **AgentPanel refactor:** 4,000 lines of coupled code. Mitigate with visual regression tests, incremental extraction.

### Medium Risk
- **Store split:** Breaking store into 4 pieces could cause state inconsistencies. Mitigate with unit tests.

### Low Risk
- **Card cleanup:** WineCard/EnrichmentCard already work. Just delete duplicates.
- **Database indexes:** Non-breaking changes.

---

## Documents Reference

| Document | Purpose | Relevance |
|----------|---------|-----------|
| `00_wine-agent-architecture.md` | Master architecture | Vision/target state |
| `AGENT_FLOW_ANALYSIS.md` | Current state analysis | Issues identified |
| `PHASE_1_IMPLEMENTATION_PLAN.md` | Refactoring plan | Step-by-step guide |
| `WINE_CARD_UNIFICATION_PROPOSAL.md` | Card consolidation | 60% complete |
| `UNIVERSAL_CARD_ARCHITECTURE.md` | Universal card system | Implemented |
| `ENRICHMENT_CARD_UNIFICATION_PROPOSAL.md` | Enrichment consolidation | Pending |
| `qve/docs/AGENT_FLOW.md` | Flow documentation | Phase transitions |

---

## Conclusion

The wine agent has a **solid backend foundation that exceeds the original plan**, with sophisticated caching, multi-provider LLM integration, and production-ready identification flow. However, the frontend is in **critical condition** with a 4,037-line monolithic component that blocks all progress.

**The path forward is clear:**

1. **Immediately:** Refactor AgentPanel (4,037 → <400 lines)
2. **Week 2:** Split agent store, fix database
3. **Week 3:** Add observability, simplify phases
4. **Week 4:** Testing and stabilization
5. **Month 2+:** Meal pairing, user preferences

**Don't add new features until AgentPanel is refactored.** Every day of delay makes the problem worse.

---

**Report Generated By:**
- Backend Review Agent
- Frontend Review Agent
- Database Review Agent
- Gap Analysis Agent

**Consolidated By:** Claude Code Agent

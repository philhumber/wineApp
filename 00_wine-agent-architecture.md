# Wine Recommendation Agent: Architectural Overview

**Version:** 1.0  
**Date:** January 2026  
**Status:** Design Phase

---

## 1. Executive Summary

This document describes the architecture for an AI-powered wine recommendation agent integrated into an existing wine collection PWA. The agent supports two primary workflows:

1. **Wine Input Flow**: Identify wines from images, text, or barcodes; enrich with external data; return structured data (for collection management) or natural language advice (for user guidance)

2. **Meal Pairing Flow**: Accept meal descriptions and recommend wines from the user's collection with explanations

The system prioritises accuracy over speed, uses caching extensively to control costs, and degrades gracefully when external services are unavailable.

---

## 2. System Context

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL SYSTEMS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Claude    │  │   OpenAI    │  │  Web Search │  │  Barcode    │        │
│  │   API       │  │  Embeddings │  │   (via LLM) │  │  Databases  │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────┘
          │                │                │                │
          └────────────────┴────────────────┴────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WINE AGENT SERVICE                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Agent Orchestrator                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │  │Identification│  │ Enrichment  │  │  Pairing    │  │Conversation│  │   │
│  │  │  Service    │  │  Service    │  │  Service    │  │  Manager   │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────┴───────────────────────────────────┐   │
│  │                         Data Layer                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │  │  Reference  │  │   Cache     │  │  Embeddings │  │   User     │  │   │
│  │  │    Data     │  │   Store     │  │    Store    │  │   Data     │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXISTING WINE APP                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                         │
│  │   PWA UI    │  │  PHP API    │  │   MySQL     │                         │
│  │  (Svelte)   │  │  Backend    │  │  Database   │                         │
│  └─────────────┘  └─────────────┘  └─────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Integration Approach

The agent operates as a service layer between the existing PWA and external AI services. It exposes a simple API that the PWA consumes, abstracting all LLM orchestration, caching, and data enrichment.

**Key Integration Points:**
- PWA calls agent API with user input (image, text, or meal description)
- Agent returns structured JSON (add mode) or formatted text (advice mode)
- Agent reads/writes to shared MySQL database for collection data
- Agent maintains its own tables for caching and reference data

---

## 3. Core Workflows

### 3.1 Wine Input Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          WINE INPUT FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

  INPUT                           PROCESSING                         OUTPUT
  ─────                           ──────────                         ──────

  ┌─────────┐
  │  Image  │───┐
  └─────────┘   │
                │    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
  ┌─────────┐   │    │   CLASSIFY   │    │   IDENTIFY   │    │   VERIFY     │
  │  Text   │───┼───▶│   & ROUTE    │───▶│    WINE      │───▶│   & ENRICH   │
  └─────────┘   │    │              │    │              │    │              │
                │    └──────────────┘    └──────────────┘    └──────────────┘
  ┌─────────┐   │           │                   │                   │
  │ Barcode │───┘           │                   │                   │
  └─────────┘               ▼                   ▼                   ▼
                     ┌────────────┐      ┌────────────┐      ┌────────────┐
                     │ Input type │      │ Confidence │      │ Cache hit? │
                     │ Quality    │      │ Ambiguity  │      │ Web search │
                     │ assessment │      │ flags      │      │ needed?    │
                     └────────────┘      └────────────┘      └────────────┘
                                                                    │
                           ┌────────────────────────────────────────┤
                           │                                        │
                           ▼                                        ▼
                    ┌─────────────┐                          ┌─────────────┐
                    │  ADD MODE   │                          │ ADVICE MODE │
                    │             │                          │             │
                    │ Structured  │                          │ Natural     │
                    │ JSON for    │                          │ language    │
                    │ app to      │                          │ about wine, │
                    │ process     │                          │ pairings,   │
                    │             │                          │ value       │
                    └─────────────┘                          └─────────────┘
```

**Decision Points:**

| Stage | Decision | Criteria |
|-------|----------|----------|
| Classify | Route to vision vs text processing | Input type detection |
| Classify | Reject poor quality | Image readability < threshold |
| Identify | Request clarification | Confidence < 0.6 or multiple matches |
| Identify | Proceed to enrichment | Confidence ≥ 0.6 |
| Verify | Skip web search | High confidence + cache hit |
| Verify | Perform web search | Medium confidence OR cache miss |
| Output | Add vs Advice | Explicit mode parameter from caller |


### 3.2 Meal Pairing Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MEAL PAIRING FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

  INPUT                           PROCESSING                         OUTPUT
  ─────                           ──────────                         ──────

  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
  │    Meal     │    │   ANALYSE    │    │   SEARCH     │    │    RANK      │
  │ Description │───▶│    MEAL      │───▶│  COLLECTION  │───▶│  & EXPLAIN   │
  │             │    │              │    │              │    │              │
  └─────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                            │                   │                   │
                            ▼                   ▼                   ▼
                     ┌────────────┐      ┌────────────┐      ┌────────────┐
                     │ Key flavors│      │ Attribute  │      │ Top 3-5    │
                     │ Weight     │      │ filter     │      │ with       │
                     │ Cooking    │      │ then       │      │ rationale  │
                     │ method     │      │ semantic   │      │            │
                     │ Constraints│      │ ranking    │      │            │
                     └────────────┘      └────────────┘      └────────────┘
                                                                    │
                                                                    ▼
                                                            ┌─────────────┐
                                                            │ PAIRING     │
                                                            │ RESPONSE    │
                                                            │             │
                                                            │ Ranked list │
                                                            │ Explanations│
                                                            │ Serving tips│
                                                            │ Gap notes   │
                                                            └─────────────┘
```

**Search Strategy:**

1. **Hard filters** (non-negotiable): Wine colour, sweetness level for the dish type
2. **Soft filters** (preferences): Body, tannin, acidity ranges
3. **Semantic search**: Embed meal-to-wine description, find nearest wines
4. **LLM ranking**: Final intelligence pass with full context

---

## 4. Component Architecture

### 4.1 Component Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AGENT COMPONENTS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                      API LAYER (PHP)                                   │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │ │
│  │  │ /identify   │  │ /enrich     │  │ /pair       │  │ /conversation│  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └──────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                      │                                      │
│  ┌───────────────────────────────────┴───────────────────────────────────┐ │
│  │                      ORCHESTRATION LAYER                               │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │                    Agent Orchestrator                             │ │ │
│  │  │  - Request routing          - Conversation state                  │ │ │
│  │  │  - Multi-step coordination  - Error handling                      │ │ │
│  │  │  - Response formatting      - Cost tracking                       │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                      │                                      │
│  ┌───────────────────────────────────┴───────────────────────────────────┐ │
│  │                       SERVICE LAYER                                    │ │
│  │                                                                        │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │ │
│  │  │ Identification  │  │   Enrichment    │  │    Pairing      │        │ │
│  │  │    Service      │  │    Service      │  │    Service      │        │ │
│  │  │                 │  │                 │  │                 │        │ │
│  │  │ - Vision/OCR    │  │ - Web search    │  │ - Meal analysis │        │ │
│  │  │ - Text parsing  │  │ - Cache lookup  │  │ - Collection    │        │ │
│  │  │ - Barcode lookup│  │ - Data merge    │  │   search        │        │ │
│  │  │ - Disambiguation│  │ - Validation    │  │ - Ranking       │        │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │ │
│  │                                                                        │ │
│  │  ┌─────────────────┐  ┌─────────────────┐                             │ │
│  │  │  Conversation   │  │   Preferences   │                             │ │
│  │  │    Manager      │  │    Service      │                             │ │
│  │  │                 │  │                 │                             │ │
│  │  │ - State tracking│  │ - Taste profile │                             │ │
│  │  │ - Context build │  │ - Learning      │                             │ │
│  │  │ - Corrections   │  │ - Personalise   │                             │ │
│  │  └─────────────────┘  └─────────────────┘                             │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                      │                                      │
│  ┌───────────────────────────────────┴───────────────────────────────────┐ │
│  │                      INFRASTRUCTURE LAYER                              │ │
│  │                                                                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │ │
│  │  │  LLM Client  │  │   Embedding  │  │    Cache     │  │  Observ-   │ │ │
│  │  │              │  │    Client    │  │   Manager    │  │  ability   │ │ │
│  │  │ - Claude API │  │              │  │              │  │            │ │ │
│  │  │ - Tool use   │  │ - OpenAI API │  │ - TTL mgmt   │  │ - Tracing  │ │ │
│  │  │ - Retries    │  │ - Batch      │  │ - Reference  │  │ - Metrics  │ │ │
│  │  │ - Circuit    │  │              │  │   data       │  │ - Logging  │ │ │
│  │  │   breaker    │  │              │  │              │  │            │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Component Responsibilities

| Component | Responsibility | Key Interfaces |
|-----------|---------------|----------------|
| **API Layer** | HTTP endpoints, request validation, authentication | REST JSON API |
| **Agent Orchestrator** | Multi-step flow coordination, decision routing | Internal service calls |
| **Identification Service** | Wine recognition from any input type | LLM Client, Cache |
| **Enrichment Service** | Data gathering and structuring | Web Search, Cache |
| **Pairing Service** | Meal analysis and wine matching | Embeddings, Collection |
| **Conversation Manager** | Multi-turn state, corrections, context | Session storage |
| **Preferences Service** | User taste learning and application | User data store |
| **LLM Client** | Claude API abstraction with resilience | Claude API |
| **Embedding Client** | Vector generation and similarity | OpenAI Embeddings API |
| **Cache Manager** | TTL-based caching, reference data access | MySQL |
| **Observability** | Tracing, metrics, cost tracking | Logging infrastructure |

---

## 5. Data Architecture

### 5.1 Data Categories

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATA TAXONOMY                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  REFERENCE DATA (Static, Pre-populated)                                     │
│  ──────────────────────────────────────                                     │
│  │                                                                          │
│  ├── Countries          Geographic entities with wine context               │
│  ├── Regions            Hierarchical wine regions and appellations          │
│  ├── Grape Varieties    Characteristics, typical profiles, affinities       │
│  ├── Appellations       Rules, allowed grapes, quality levels               │
│  └── Pairing Rules      Classic food-wine pairing wisdom                    │
│                                                                             │
│  CACHED DATA (TTL-based, Populated on-demand)                               │
│  ─────────────────────────────────────────────                              │
│  │                                                                          │
│  ├── Producer Cache     Producer info fetched from web (30-day TTL)         │
│  └── Wine Enrichment    Specific wine data: scores, prices (7-day TTL)      │
│                                                                             │
│  USER DATA (Per-user, Application-managed)                                  │
│  ─────────────────────────────────────────                                  │
│  │                                                                          │
│  ├── Wine Collection    User's stored wines (existing app tables)           │
│  ├── Wine Embeddings    Vector representations for semantic search          │
│  ├── Interactions       Consumption, ratings, pairings history              │
│  ├── Taste Profile      Computed preferences from behaviour                 │
│  └── Conversations      Session state for multi-turn interactions           │
│                                                                             │
│  OPERATIONAL DATA (System-managed)                                          │
│  ─────────────────────────────────────                                      │
│  │                                                                          │
│  ├── Usage Tracking     API calls, tokens, costs per user                   │
│  ├── Agent Traces       Request traces for debugging                        │
│  └── Error Logs         Failures and edge cases for improvement             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Data Model (Key Entities)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ENTITY RELATIONSHIPS                               │
└─────────────────────────────────────────────────────────────────────────────┘

  REFERENCE DATA                    USER DATA                    CACHED DATA
  ──────────────                    ─────────                    ───────────

  ┌─────────────┐                 ┌─────────────┐
  │  countries  │                 │    users    │
  │─────────────│                 │─────────────│
  │ id          │                 │ id          │
  │ name        │                 │ ...         │
  │ iso_code    │                 └──────┬──────┘
  └──────┬──────┘                        │
         │                               │
         │ 1:N                           │ 1:N
         ▼                               ▼
  ┌─────────────┐                 ┌─────────────┐            ┌─────────────┐
  │   regions   │                 │   wines     │◄───────────│producer_    │
  │─────────────│                 │ (collection)│  lookup    │   cache     │
  │ id          │                 │─────────────│            │─────────────│
  │ country_id  │◄────────────────│ id          │            │ id          │
  │ parent_id   │─┐               │ user_id     │            │ canonical_  │
  │ name        │ │               │ name        │            │   name      │
  │ type        │ │ self-ref      │ producer    │            │ region_id   │
  │ description │ │ (hierarchy)   │ vintage     │            │ founded     │
  │ climate     │ │               │ region_id   │            │ description │
  │ typical_    │◄┘               │ ...         │            │ expires_at  │
  │   grapes    │                 └──────┬──────┘            └─────────────┘
  │ wine_styles │                        │
  │ food_       │                        │ 1:1
  │   pairings  │                        ▼
  └──────┬──────┘                 ┌─────────────┐            ┌─────────────┐
         │                        │   wine_     │            │wine_enrich_ │
         │ 1:N                    │ embeddings  │            │   ment_cache│
         ▼                        │─────────────│            │─────────────│
  ┌─────────────┐                 │ wine_id     │            │ producer    │
  │appellations │                 │ embedding   │            │ wine_name   │
  │─────────────│                 │ embed_text  │            │ vintage     │
  │ id          │                 └─────────────┘            │ grape_vars  │
  │ region_id   │                                            │ style       │
  │ name        │                 ┌─────────────┐            │ scores      │
  │ allowed_    │                 │   user_     │            │ drink_window│
  │   grapes    │                 │interactions │            │ expires_at  │
  │ rules       │                 │─────────────│            └─────────────┘
  └─────────────┘                 │ user_id     │
                                  │ wine_id     │
  ┌─────────────┐                 │ type        │
  │   grape_    │                 │ rating      │
  │  varieties  │                 │ paired_with │
  │─────────────│                 │ context     │
  │ id          │                 └──────┬──────┘
  │ name        │                        │
  │ color       │                        │ computed
  │ body        │                        ▼
  │ tannin      │                 ┌─────────────┐
  │ acidity     │                 │  user_      │
  │ flavors     │                 │taste_profile│
  │ food_       │                 │─────────────│
  │   affinities│                 │ user_id     │
  └─────────────┘                 │ pref_grapes │
                                  │ pref_body   │
  ┌─────────────┐                 │ pref_regions│
  │  pairing_   │                 │ price_range │
  │    rules    │                 │ last_compute│
  │─────────────│                 └─────────────┘
  │ id          │
  │ food_cat    │
  │ wine_reqs   │
  │ ideal_match │
  │ rationale   │
  └─────────────┘
```

### 5.3 Caching Strategy

| Data Type | Storage | TTL | Population | Fallback on Miss |
|-----------|---------|-----|------------|------------------|
| Regions | Reference table | Never expires | Pre-warmed | LLM inference |
| Grape varieties | Reference table | Never expires | Pre-warmed | LLM inference |
| Pairing rules | Reference table | Never expires | Pre-warmed | LLM reasoning |
| Producers | Cache table | 30 days | On-demand | Web search |
| Wine enrichment | Cache table | 7 days | On-demand | Web search |
| Critic scores | Cache table | 90 days | On-demand | Web search |
| Current prices | Not cached | — | Always fetch | Skip or estimate |

---

## 6. LLM Integration

### 6.1 Model Selection Strategy

#### 6.1.1 Model Profiles

**Claude Models (Anthropic)**

| Model | Input/Output Cost | Strengths | Best For |
|-------|-------------------|-----------|----------|
| Haiku 3.5 | $0.25/$1.25 per 1M | Fastest, cheapest, reliable tool use | Classification, simple extraction |
| Sonnet 4 | $3/$15 per 1M | Best prose quality, strong vision, reliable structured output | User-facing responses, balanced tasks |
| Opus 4.5 | $15/$75 per 1M | Superior reasoning, handles ambiguity, premium prose | Edge cases, complex reasoning |

**Gemini Models (Google)**

| Model | Input/Output Cost | Strengths | Best For |
|-------|-------------------|-----------|----------|
| Gemini 3 Flash | $0.50/$3 per 1M | Pro-level capability at Flash speed, dynamic thinking, native search grounding | Vision, search, most balanced tasks |
| Gemini 3 Pro | $2/$12 per 1M | Broad world knowledge, advanced reasoning, 1M context | Complex synthesis, multi-wine comparison |
| Gemini 3 Deep Think | TBD | Extended reasoning mode | Hardest problems, second opinions |

**Embeddings (OpenAI)**

| Model | Cost | Dimensions | Use Case |
|-------|------|------------|----------|
| text-embedding-3-small | $0.02/1M tokens | 1536 | Default - sufficient for <1000 wines |
| text-embedding-3-large | $0.13/1M tokens | 3072 | If subtle distinctions needed |

#### 6.1.2 Tiered Model Selection by Task

**Input Classification & Routing**

| Tier | Model | Rationale |
|------|-------|-----------|
| Fast | Haiku 3.5 | Classification is trivial for modern LLMs. Sub-500ms response. |
| — | — | No escalation needed - if classification fails, the input is the problem. |

**Vision/OCR (Wine Label Reading)**

| Tier | Model | Rationale |
|------|-------|-----------|
| Fast | Gemini 3 Flash (thinking: minimal) | Strong vision, fast, handles clear labels. Dynamic thinking allows retry without model switch. |
| Balanced | Gemini 3 Flash (thinking: high) | Same model, more reasoning effort for degraded/artistic text. |
| Accurate | Claude Sonnet 4 | Superior at degraded text, unusual typography, contextual inference from partial labels. |
| Premium | Claude Opus 4.5 | Handwritten labels, damaged/aged labels, complex multi-wine images. |

*Escalation trigger*: Confidence < 0.7 or incomplete fields

**Structured Extraction (Wine Data → Schema)**

| Tier | Model | Rationale |
|------|-------|-----------|
| Fast | Haiku 3.5 | Excellent tool use for straightforward extraction. Cheapest option. |
| Balanced | Gemini 3 Flash | 78% SWE-bench indicates strong structured output. Handles inference (region from producer). |
| Accurate | Claude Sonnet 4 | Wine domain knowledge, complex schema mapping, validation rules. |

*Escalation trigger*: Required fields missing or inference needed

**Web Search & Enrichment**

| Tier | Model | Rationale |
|------|-------|-----------|
| Fast | Gemini 3 Flash + Search | Native Google Search grounding - single-call search+synthesis. No external search API needed. |
| Balanced | Gemini 3 Pro | Complex synthesis, conflicting sources, sparse information. "Broad world knowledge" advantage. |
| Accurate | Claude Sonnet 4 | Cross-check Gemini findings, more reliable structured output. |

*Escalation trigger*: Conflicting information or wine is obscure

**Meal Analysis (Pairing Input)**

| Tier | Model | Rationale |
|------|-------|-----------|
| Fast | Haiku 3.5 | Simple Western dishes. Quick classification into pairing attributes. |
| Balanced | Gemini 3 Flash | Complex dishes, fusion cuisine, multi-course. Dynamic thinking for harder analysis. |
| Accurate | Claude Sonnet 4 | Understanding user intent, dietary restrictions, cultural context. |

*Escalation trigger*: Multi-component dishes or non-Western cuisine

**Collection Search & Ranking**

| Tier | Model | Rationale |
|------|-------|-----------|
| Fast | Embeddings + attribute filter | No LLM needed for initial search. Pure computation. |
| Balanced | Haiku 3.5 | Re-rank top 10-15 candidates, generate brief rationales. |
| Accurate | Claude Sonnet 4 | Nuanced differentiation, taste profile influence, detailed explanations. |

*Escalation trigger*: Multiple close matches or user wants detailed explanation

**Natural Language Response (Advice Mode)**

| Tier | Model | Rationale |
|------|-------|-----------|
| Fast | Gemini 3 Flash | Improved prose over 2.0. Acceptable for quick confirmations. |
| Balanced | Claude Sonnet 4 | **Default for user-facing prose.** Best personality, natural writing, avoids "assistant" tone. |
| Premium | Claude Opus 4.5 | Sommelier-quality prose. Use when response quality is a differentiator. |

*Default*: Sonnet 4 (user experience priority)

**Complex Reasoning & Disambiguation**

| Tier | Model | Rationale |
|------|-------|-----------|
| Fast | Gemini 3 Flash (thinking: high) | High thinking mode for moderate ambiguity. |
| Balanced | Gemini 3 Pro | Purpose-built for complex reasoning. 1M context for multi-wine comparison. |
| Accurate | Claude Opus 4.5 | Best at nuanced reasoning, explaining uncertainty, high-stakes identifications. |
| Cross-check | Gemini 3 Deep Think | Second opinion for valuable/rare wines. |

*Escalation trigger*: Confidence < 0.7 or multiple plausible interpretations

#### 6.1.3 Escalation Strategy

```
Request arrives
     │
     ▼
┌─────────────┐
│   Tier 1    │  Cheapest model with minimal thinking
│   (Fast)    │
└──────┬──────┘
       │
  Confidence ≥ 0.8? ──── YES ──▶ Return result
       │
       NO
       │
       ▼
┌─────────────┐
│  Tier 1.5   │  Same model, increase thinking level (Gemini only)
│  (Retry)    │
└──────┬──────┘
       │
  Confidence ≥ 0.7? ──── YES ──▶ Return result
       │
       NO
       │
       ▼
┌─────────────┐
│   Tier 2    │  Balanced model
│ (Balanced)  │
└──────┬──────┘
       │
  Confidence ≥ 0.6? ──── YES ──▶ Return result
       │
       NO
       │
       ▼
┌─────────────┐
│   Tier 3    │  Most capable model
│ (Accurate)  │
└──────┬──────┘
       │
       ▼
  Return result (flag low confidence if < 0.6)
```

#### 6.1.4 Cost Estimates

| Request Type | Typical Path | Est. Cost |
|--------------|--------------|-----------|
| Wine ID (text, easy) | Haiku only | ~$0.001 |
| Wine ID (image, clear) | Flash (minimal) | ~$0.002 |
| Wine ID (image, moderate) | Flash (high) | ~$0.003 |
| Wine ID (image, difficult) | Flash → Sonnet | ~$0.01 |
| Enrichment (cache hit) | None | $0 |
| Enrichment (cache miss) | Flash + search | ~$0.005 |
| Pairing (simple) | Haiku + embeddings | ~$0.003 |
| Pairing (complex) | Sonnet + embeddings | ~$0.015 |
| Advice response | Sonnet | ~$0.01 |

**Target average**: $0.01-0.02 per request

#### 6.1.5 Dynamic Thinking (Gemini 3)

Gemini 3 models support adjustable thinking levels:

| Level | Use Case | Latency Impact |
|-------|----------|----------------|
| `minimal` | Simple classification, clear inputs | Fastest |
| `low` | Standard extraction, moderate complexity | +20% |
| `medium` | Inference required, some ambiguity | +50% |
| `high` | Complex reasoning, disambiguation | +100% |

**Strategy**: Start with `minimal`, increment on retry before switching models. This keeps costs low while maximising single-provider simplicity.

#### 6.1.6 Provider Strategy

| Provider | Primary Use | Rationale |
|----------|-------------|-----------|
| **Google (Gemini)** | Vision, search, first-tier processing | Native search grounding, dynamic thinking, competitive vision |
| **Anthropic (Claude)** | User-facing prose, complex reasoning, fallback | Superior prose quality, more reliable structured output |
| **OpenAI** | Embeddings only | Best price/quality for vector generation |

This dual-provider approach balances cost, capability, and reliability while avoiding over-dependence on any single vendor.

### 6.2 Model Integration Roadmap

#### Phase 1: Foundation (Sprint 10)
- [ ] Implement LLM client abstraction supporting Claude and Gemini
- [ ] Add model configuration with per-task defaults
- [ ] Implement confidence scoring interface
- [ ] Set up cost tracking per model/task

#### Phase 2: Tiered Escalation (Sprint 11)
- [ ] Implement escalation logic with confidence thresholds
- [ ] Add Gemini dynamic thinking level support
- [ ] Build retry-with-escalation wrapper
- [ ] Add circuit breakers per provider

#### Phase 3: Optimisation (Sprint 12)
- [ ] Analyse real-world confidence distributions
- [ ] Tune escalation thresholds based on data
- [ ] A/B test model combinations
- [ ] Implement cost alerting

#### Phase 4: Monitoring (Ongoing)
- [ ] Track escalation rates per task type
- [ ] Monitor cost per request trends
- [ ] Alert on unusual model distribution shifts
- [ ] Quarterly model evaluation against new releases

### 6.3 Tool Definitions

The agent uses Claude's tool use capability with these defined tools:

**identify_wine**
- Purpose: Extract wine identification from input
- Inputs: Raw extraction from vision/text
- Outputs: Structured wine identity with confidence scores

**enrich_wine_data**
- Purpose: Structure enrichment data after web search
- Inputs: Search results, partial wine data
- Outputs: Complete wine profile with source attribution

**search_wine_collection**
- Purpose: Query user's collection for pairing candidates
- Inputs: Query type, filters, semantic query
- Outputs: Ranked list of matching wines

**recommend_pairing**
- Purpose: Format final pairing recommendations
- Inputs: Meal context, candidate wines
- Outputs: Ranked recommendations with explanations

### 6.4 Prompt Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PROMPT STRUCTURE                                   │
└─────────────────────────────────────────────────────────────────────────────┘

  SYSTEM PROMPT (static)
  ├── Role definition (wine expert assistant)
  ├── Output format requirements
  ├── Confidence scoring guidelines
  └── Hallucination avoidance instructions

  CONTEXT INJECTION (dynamic)
  ├── Conversation history (if multi-turn)
  ├── User taste profile (if available)
  ├── Current wine under discussion (if any)
  └── Relevant cached reference data

  USER MESSAGE (per-request)
  ├── Input data (image/text/meal description)
  ├── Mode indicator (add/advice/pair)
  └── Any user-specified constraints

  TOOL RESULTS (during execution)
  ├── Cache lookup results
  ├── Web search results
  └── Collection search results
```

---

## 7. API Design

### 7.1 Endpoints

```
POST /api/agent/identify
────────────────────────
Request:
{
  "input": "<base64 image | text | barcode>",
  "input_type": "image" | "text" | "barcode",
  "mode": "add" | "advice",
  "conversation_id": "optional-for-multi-turn"
}

Response (add mode):
{
  "success": true,
  "wine": {
    "name": "Château Margaux",
    "vintage": 2015,
    "producer": "Château Margaux",
    "region_id": 123,
    "confidence": 0.92
  },
  "enrichment": {
    "grapes": ["Cabernet Sauvignon", "Merlot"],
    "style": { "body": "full", "tannin": "high" },
    "drink_window": { "start": 2025, "end": 2060 },
    "scores": [{ "critic": "Wine Advocate", "score": 99 }]
  },
  "flags": {
    "needs_verification": false,
    "ambiguous": false
  },
  "trace_id": "trace_abc123"
}

Response (advice mode):
{
  "success": true,
  "advice": "This is Château Margaux 2015, one of Bordeaux's...",
  "wine_summary": { ... },
  "trace_id": "trace_abc123"
}


POST /api/agent/pair
────────────────────
Request:
{
  "meal_description": "Grilled lamb with rosemary and roasted vegetables",
  "constraints": {
    "max_price": 50,
    "color_preference": null
  },
  "user_id": 123
}

Response:
{
  "success": true,
  "recommendations": [
    {
      "wine_id": 456,
      "wine_name": "Château Gloria 2018",
      "match_quality": "excellent",
      "rationale": "The structured tannins and herbal notes...",
      "serving_suggestion": "Decant 1 hour, serve at 17°C"
    },
    ...
  ],
  "collection_gaps": ["A Côtes du Rhône would be ideal if you had one"],
  "trace_id": "trace_def456"
}


POST /api/agent/conversation
────────────────────────────
Request:
{
  "conversation_id": "conv_123",
  "message": "What should I pair it with?",
  "attachments": []
}

Response:
{
  "response": "For the 2015 Margaux, I'd suggest...",
  "conversation_id": "conv_123",
  "state": {
    "current_wine": { ... },
    "mode": "pairing"
  }
}
```

### 7.2 Error Responses

```json
{
  "success": false,
  "error": {
    "code": "LOW_CONFIDENCE",
    "message": "I can see this is a Burgundy wine but can't read the producer clearly",
    "partial_data": { "region": "Burgundy", "color": "red" },
    "suggestions": ["Please provide the producer name", "Try a clearer photo"]
  },
  "trace_id": "trace_xyz789"
}
```

Error codes: `LOW_CONFIDENCE`, `AMBIGUOUS_MATCH`, `NOT_WINE`, `SERVICE_UNAVAILABLE`, `RATE_LIMITED`, `INVALID_INPUT`

---

## 8. Resilience & Degradation

### 8.1 Failure Modes and Responses

| Failure | Detection | Response | User Impact |
|---------|-----------|----------|-------------|
| LLM API timeout | HTTP timeout | Retry with backoff (3x) | Delayed response |
| LLM API down | Circuit breaker open | Rule-based fallback | Degraded recommendations |
| Vision unreadable | Confidence < 0.4 | Request text input | Extra step required |
| Web search empty | No results | Use cached/reference data | Less enrichment |
| Embedding service down | API error | Attribute-only search | Less precise matching |
| Rate limit hit | 429 response | Queue + notify | Delayed response |

### 8.2 Circuit Breaker Configuration

```
LLM Client Circuit Breaker:
├── Failure threshold: 5 failures in 60 seconds
├── Open duration: 30 seconds
├── Half-open test: 1 request
└── Fallback: Rule-based processing

Embedding Client Circuit Breaker:
├── Failure threshold: 3 failures in 60 seconds
├── Open duration: 60 seconds
├── Half-open test: 1 request
└── Fallback: Attribute-only collection search
```

### 8.3 Degraded Mode Capabilities

When LLM services are unavailable:

| Feature | Normal Mode | Degraded Mode |
|---------|-------------|---------------|
| Wine identification | Vision + LLM | Text parsing only |
| Enrichment | Web search + LLM synthesis | Cache lookup only |
| Pairing | Semantic search + LLM ranking | Rule-based matching |
| Advice generation | Natural language | Structured data display |

---

## 9. Observability

### 9.1 Tracing

Every agent request generates a trace with:
- Unique trace ID (returned to client)
- Step-by-step execution log
- Decision points with reasoning
- Cache hits/misses
- LLM calls with token counts
- Total latency and cost

### 9.2 Metrics

| Metric | Type | Purpose |
|--------|------|---------|
| `agent.request.count` | Counter | Traffic volume |
| `agent.request.latency` | Histogram | Performance monitoring |
| `agent.llm.tokens` | Counter | Cost tracking |
| `agent.cache.hit_rate` | Gauge | Cache effectiveness |
| `agent.identification.confidence` | Histogram | Quality monitoring |
| `agent.errors` | Counter | Reliability tracking |

### 9.3 Logging Levels

- **ERROR**: Failures requiring investigation
- **WARN**: Degraded operation, edge cases
- **INFO**: Request summaries, cache events
- **DEBUG**: Full traces (development only)

---

## 10. Security Considerations

### 10.1 Input Validation

- Image size limits (max 10MB)
- Text input sanitisation (prompt injection patterns)
- Barcode format validation
- Wine data sanity checks (vintage range, price range, alcohol %)

### 10.2 Data Protection

- User collection data isolated by user_id
- No PII stored in caches
- Trace data retention: 30 days
- API authentication via existing app auth

### 10.3 Cost Protection

- Per-user daily/monthly usage limits
- Request rate limiting (10/minute sustained)
- Circuit breakers prevent runaway costs during outages

---

## 11. Technical Decisions

### 11.1 Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM provider | Claude (Anthropic) | Best vision quality, reliable tool use |
| Embedding provider | OpenAI | Cost-effective, high quality |
| Vector storage | MySQL JSON + PHP similarity | Fits existing stack, adequate for <1000 wines |
| Caching | MySQL tables with TTL | No new infrastructure, familiar tooling |
| Agent orchestration | Custom PHP | Simpler than framework, full control |
| Structured output | Tool use (not JSON mode) | Better schema enforcement, confidence fields |

### 11.2 Decisions Deferred

| Decision | Options | Defer Until |
|----------|---------|-------------|
| Vector database migration | Pinecone, pgvector, Milvus | Collection size > 1000 |
| Async processing | Queue system for batch | Batch feature implementation |
| Multi-language support | Translation layer | International user demand |
| Offline mode | Local model fallback | Mobile app requirements clarified |

---

## 12. Constraints & Assumptions

### 12.1 Constraints

- Must integrate with existing PHP/MySQL stack
- No build step (aligns with PWA architecture)
- Budget-conscious (optimise for cost)
- Single-developer maintenance

### 12.2 Assumptions

- Typical collection size: 50-500 wines
- Typical requests: 5-20 per user per week
- Users have reasonable quality phone cameras
- English-language primary (wine terms multi-language)

---

## 13. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LLM hallucination of wine data | Medium | High | Web search verification, confidence scoring, source attribution |
| Label recognition failures | Medium | Medium | Fallback to text input, user correction flow |
| Cost overruns | Low | Medium | Usage tracking, limits, caching |
| API provider outage | Low | High | Circuit breakers, degraded mode, multi-provider option |
| Embedding drift over time | Low | Low | Periodic re-embedding, version tracking |
| Prompt injection via labels | Low | Medium | Input sanitisation, output validation |

---

## 14. Implementation Phases

### Phase 1: Foundation (Weeks 1-3)
- [ ] Reference data schema and seed data
- [ ] Cache schema and manager
- [ ] LLM client with circuit breaker
- [ ] Basic identification flow (text input only)
- [ ] Structured output via tool use

### Phase 2: Core Features (Weeks 4-6)
- [ ] Vision/image identification
- [ ] Web search enrichment
- [ ] Add mode complete flow
- [ ] Advice mode complete flow
- [ ] API endpoints

### Phase 3: Pairing (Weeks 7-9)
- [ ] Embedding generation for collection
- [ ] Collection search (attribute + semantic)
- [ ] Meal analysis
- [ ] Pairing recommendations
- [ ] Pairing API endpoint

### Phase 4: Polish (Weeks 10-12)
- [ ] Conversation state management
- [ ] Error handling and degraded mode
- [ ] Observability and tracing
- [ ] Cost tracking
- [ ] User preferences (basic)

### Phase 5: Enhancement (Future)
- [ ] Batch operations
- [ ] Advanced personalisation
- [ ] Barcode support
- [ ] Multi-language labels

---

## 15. Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Identification accuracy | >85% correct | Evaluation test set |
| Pairing relevance | >75% "good" or better | User feedback / sommelier review |
| Response latency (P95) | <5 seconds | Observability metrics |
| Cost per request | <$0.02 average | Usage tracking |
| Cache hit rate | >60% | Cache metrics |
| Availability | >99% | Uptime monitoring |

---

## Appendices

### A. Glossary

| Term | Definition |
|------|------------|
| Appellation | Legally defined wine-growing region with specific rules |
| Enrichment | Process of gathering additional data about an identified wine |
| Pairing | Matching wine to food for complementary flavours |
| Tool use | LLM capability to call defined functions with structured I/O |
| TTL | Time-to-live; duration before cached data expires |

### B. Reference Data Sources

- Wine regions: Wine Folly, Jancis Robinson
- Grape varieties: Wine Grapes (Robinson/Harding/Vouillamoz)
- Pairing rules: Classic sommelier training, The Food Bible
- Producer data: Web search, official websites

### C. Related Documents

- Detailed Design Specification (to be created)
- API Documentation (to be created)
- Reference Data Schema (to be created)
- Test Plan (to be created)

---

*Document version 1.0 - For review and refinement*

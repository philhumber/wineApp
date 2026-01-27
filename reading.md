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
  │ country_id  │◄────────────────│ id       
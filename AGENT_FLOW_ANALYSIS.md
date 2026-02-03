# Agent Flow Analysis & Optimization Report
**Date:** 2026-02-03
**Branch:** develop
**Reviewer:** Claude Code Agent

---

## Executive Summary

The AI Agent system is a **sophisticated but overly complex** implementation with significant technical debt. The architecture shows strong design patterns (multi-tier escalation, streaming SSE, state machines) but suffers from:

- **Massive UI complexity**: AgentPanel.svelte is **3,794 lines** (should be <500)
- **Bloated state management**: agent.ts is **2,010 lines** with 30+ derived stores
- **Unclear flow**: 25 conversation phases create intricate state transitions
- **Hard to test**: Coupled components and stateful flows make unit testing difficult
- **Performance concerns**: Excessive re-renders, complex persistence logic
- **Maintenance burden**: Changes require touching multiple files across 67 total files

**Bottom Line:** The agent works but is becoming unmaintainable. Refactoring is critical before adding new features.

---

## Current Architecture Overview

### File Count
- **Frontend:** 24 Svelte components + 1 store (agent.ts 2,010 lines)
- **Backend:** 43 PHP files across 4 directories
- **Total:** ~67 files, ~25,000+ lines of agent-specific code

### Major Components

| Component | Lines | Issues |
|-----------|-------|--------|
| `AgentPanel.svelte` | 3,794 | **CRITICAL**: Monolithic component, massive DOM, hard to test |
| `agent.ts` | 2,010 | Complex state management, 30+ derived stores, session persistence |
| `IdentificationService.php` | ~2,000 | Multi-tier logic, escalation, inference engine coordination |
| `InferenceEngine.php` | ~1,900 | Complex scoring logic, country/region/type inference |
| `StreamingFieldDetector.php` | 382 | Incremental JSON parsing (well-designed, keep as-is) |

### Data Flow

```
User Input → CommandInput.svelte
            ↓
API Client (client.ts) → identifyTextStream.php / identifyImageStream.php
            ↓
IdentificationService.php → LLMClient (Gemini 3 Flash Tier 1)
            ↓
StreamingFieldDetector → Emit SSE events (field, result, escalating, done)
            ↓
API Client processSSEStream() → Update agent store
            ↓
AgentPanel.svelte → WineCardStreaming.svelte → FieldTypewriter.svelte
            ↓
User Action (Correct/Not Correct) → AgentPanel handles 25 phase transitions
            ↓
Add Wine Flow (8 phases) → Match fuzzy duplicates → Submit to backend
```

---

## Complexity Analysis

### 1. AgentPanel.svelte (3,794 lines) 🔴 CRITICAL

**Problems:**
- **Monolithic**: Handles conversation, phase transitions, streaming, add-flow, enrichment, error recovery
- **Massive template**: Conditionally renders ~20 different message types
- **Tight coupling**: Direct store mutations, inline event handlers, complex reactive statements
- **Hard to navigate**: Finding specific functionality requires searching 3,000+ lines
- **Performance**: Entire component re-renders on any state change
- **Testing nightmare**: Unit tests would require mocking 10+ stores and simulating 25 phases

**Evidence:**
```svelte
<!-- AgentPanel.svelte structure (simplified) -->
<script>
  // 500+ lines of script logic
  // - Phase transition handlers
  // - Streaming callbacks
  // - Add-flow orchestration
  // - Error recovery
  // - Message rendering logic
  // - Enrichment handling
</script>

<!-- 3,000+ lines of template -->
{#each messages as message}
  {#if message.type === 'greeting'}...
  {:else if message.type === 'chips'}...
  {:else if message.type === 'wine_result'}...
  {:else if message.type === 'wine_enrichment'}...
  {:else if message.type === 'cache_match_confirm'}...
  {:else if message.type === 'add_confirm'}...
  {:else if message.type === 'match_selection'}...
  <!-- ...18 more message types... -->
{/each}

<!-- Streaming card logic -->
{#if $agentIsStreaming}...
{#if $agentStreamingFields.size > 0}...
{#if $agentEnrichmentStreamingChips}...
```

**Recommendation:** **Split into 8-10 smaller components** (see Section 6)

---

### 2. Agent Store (agent.ts, 2,010 lines) 🟡 MODERATE

**Problems:**
- **Bloated state**: 30+ fields in AgentState, many rarely used simultaneously
- **30+ derived stores**: Most are trivial wrappers (`agentLoading`, `agentHasResult`, etc.)
- **Complex persistence**: Debounced writes, quota handling, version migration, immediate vs delayed
- **Mixed concerns**: Identification, enrichment, conversation, add-flow, streaming all in one store
- **Hard to reason about**: Changes to one field can trigger cascade of derived store updates

**State Fields (30+):**
```typescript
interface AgentState {
  // Core identification (5)
  isLoading, lastResult, error, currentInputType, imageQuality,

  // Panel state (1)
  isPanelOpen,

  // Enrichment (3)
  isEnriching, enrichmentError, enrichmentData,

  // Conversation (7)
  phase, messages, augmentationContext, isTyping,
  pendingNewSearch, pendingCacheMatch, enrichmentForWine,

  // Session persistence (2)
  lastImageData, lastImageMimeType,

  // Add flow (1 but large)
  addState: { /* 10+ nested fields */ },

  // Streaming (5)
  isStreaming, streamingFields, streamingChips,
  enrichmentStreamingChips, pendingEnrichmentResult
}
```

**Derived Stores (30+):** Most just extract a single field:
```typescript
export const agentParsed = derived(agent, $a => $a.lastResult?.parsed ?? null);
export const agentAction = derived(agent, $a => $a.lastResult?.action ?? null);
export const agentConfidence = derived(agent, $a => $a.lastResult?.confidence ?? null);
export const agentLoading = derived(agent, $a => $a.isLoading || $a.isEnriching);
// ...26 more
```

**Recommendation:** **Split into 3-4 focused stores** (see Section 6)

---

### 3. Conversation Phases (25 phases) 🟡 MODERATE

**Current Phases:**
```typescript
type AgentPhase =
  | 'greeting'              // Initial greeting
  | 'path_selection'        // Choose Identify/Recommend
  | 'await_input'           // Ready for text/image
  | 'identifying'           // Processing
  | 'result_confirm'        // Show result, await confirmation
  | 'action_select'         // Wine confirmed, choose action
  | 'handle_incorrect'      // User said wrong
  | 'augment_input'         // Collecting more details
  | 'escalation_choice'     // Try harder or conversational
  | 'confirm_new_search'    // User typed during active result
  | 'confirm_cache_match'   // Confirm non-exact cache match
  | 'complete'              // Done
  // Add wine flow (8 phases)
  | 'add_confirm'           // "Add to cellar?"
  | 'add_region'            // Region matching
  | 'add_producer'          // Producer matching
  | 'add_wine'              // Wine matching
  | 'add_bottle_part1'      // Bottle details part 1
  | 'add_bottle_part2'      // Bottle details part 2
  | 'add_enrichment'        // Enrichment choice
  | 'add_complete'          // Success
  | 'add_manual_entry'      // Fill missing fields
  // Others
  | 'coming_soon'           // Placeholder
  | 'wine_enrichment';      // Displaying enrichment
```

**Problems:**
- **Too granular**: 8 phases just for add-wine flow (should be 2-3)
- **Unclear transitions**: No explicit state machine, transitions scattered across AgentPanel
- **Hard to visualize**: Documentation exists (AGENT_FLOW.md) but actual code doesn't match
- **Debugging nightmare**: "What phase am I in and how did I get here?"

**Recommendation:** **Reduce to 8-10 core phases** with sub-states (see Section 6)

---

### 4. Message Types (18 types) 🟡 MODERATE

**Current Message Types:**
```typescript
type AgentMessageType =
  | 'greeting' | 'text' | 'divider' | 'chips' | 'image_preview'
  | 'wine_result' | 'wine_enrichment' | 'cache_match_confirm'
  | 'low_confidence' | 'partial_match' | 'disambiguation'
  | 'error' | 'coming_soon'
  // Add-flow types (8)
  | 'add_confirm' | 'match_selection' | 'match_confirmed'
  | 'existing_wine_choice' | 'manual_entry' | 'bottle_form'
  | 'enrichment_choice' | 'add_complete';
```

**Problems:**
- **Tight coupling**: Each message type requires dedicated rendering logic in AgentPanel
- **Hard to extend**: Adding a new message type = touching AgentPanel template
- **Inconsistent patterns**: Some types just show text, others render complex forms

**Recommendation:** **Group into 5 categories** with polymorphic rendering (see Section 6)

---

### 5. Add Wine Flow (8 phases, 10+ components) 🟠 MODERATE-HIGH

**Current Flow:**
```
add_confirm → add_region → add_producer → add_wine
           → add_bottle_part1 → add_bottle_part2
           → add_enrichment → add_complete
```

**Problems:**
- **Too granular**: Each entity (region/producer/wine) gets its own phase
- **Duplicate logic**: Search vs Create mode duplicated 3 times
- **Form complexity**: BottleDetailsForm split into 2 parts for no clear reason
- **State bloat**: `AgentAddState` has 10+ nested fields

**Recommendation:** **Combine into 3 phases** (see Section 6)

---

### 6. Streaming Implementation (WIN-181) ✅ WELL-DESIGNED

**What's Good:**
- **Clean separation**: `StreamingFieldDetector.php` is focused and well-tested
- **Progressive UX**: Fields appear as they arrive, typewriter animation
- **Fallback handling**: Graceful degradation to non-streaming
- **SSE parsing**: Clean event-driven architecture

**Minor Issues:**
- **Too many streaming states**: `isStreaming`, `streamingFields`, `streamingChips`, `enrichmentStreamingChips`, `pendingEnrichmentResult`
- **Cleanup confusion**: When to clear streaming fields?

**Recommendation:** **Keep mostly as-is**, simplify state tracking

---

### 7. Backend Services (43 PHP files) 🟢 ACCEPTABLE

**Well-Structured:**
- **Separation of concerns**: Clear service boundaries (Identification, Enrichment, LLM)
- **LLM abstraction**: `LLMClient` with adapter pattern (Gemini, Claude)
- **Cost tracking**: `CostTracker` tracks spend by model
- **Circuit breaker**: Prevents cascading failures

**Issues:**
- **IdentificationService.php**: ~2,000 lines, handles identification + escalation + streaming
- **InferenceEngine.php**: ~1,900 lines, complex scoring logic
- **Duplicate code**: Streaming vs non-streaming endpoints share 80% logic

**Recommendation:** **Reduce duplication**, extract escalation logic (see Section 7)

---

## Testing Challenges

### Current State
**No unit tests found** for agent functionality. Testing is manual and time-consuming.

### Why Testing is Hard

1. **AgentPanel.svelte (3,794 lines)**
   - Requires mocking 10+ stores
   - Simulating 25 phases
   - Testing reactive statements that trigger cascading updates

2. **Agent Store**
   - State persistence logic (sessionStorage, localStorage)
   - Async operations (identify, enrich)
   - Debounced writes
   - Session restoration

3. **Backend Services**
   - LLM API calls (slow, expensive, non-deterministic)
   - Streaming SSE responses
   - Multi-tier escalation logic

### Recommendation
**Refactor for testability FIRST**, then add comprehensive test suite:
- **Unit tests**: Each component, each store method, each service method
- **Integration tests**: Full identification flow (with mocked LLM)
- **E2E tests**: Real browser interaction (Playwright)

---

## Specific Bottlenecks

### 1. Performance Issues

**Problem:** AgentPanel re-renders on every store update
```svelte
<!-- AgentPanel.svelte -->
<script>
  $: phase = $agentPhase;
  $: messages = $agentMessages;
  $: isLoading = $agentLoading;
  $: streamingFields = $agentStreamingFields;
  $: enrichmentData = $agentEnrichmentData;
  // ...10+ reactive statements
</script>

<!-- Entire DOM re-renders when ANY store updates -->
```

**Impact:**
- Laggy UI when streaming (field updates trigger full re-render)
- Scroll position jumps
- Animation glitches

**Recommendation:**
- **Split AgentPanel** so each sub-component only subscribes to needed stores
- Use `{#key}` blocks to prevent unnecessary re-renders
- Memoize expensive computations

---

### 2. Session Persistence Overhead

**Problem:** Debounced writes + quota handling + version migration
```typescript
function storeSessionState(state: AgentSessionState, immediate = false): void {
  const doPersist = () => {
    try {
      // Strip transient UI state
      const cleanState = { ...state, messages: state.messages.map(...) };
      const serialized = JSON.stringify(cleanState);

      // Check size (~5MB limit)
      if (serialized.length > 4 * 1024 * 1024) {
        // Try without image data
        const stateWithoutImage = { ...cleanState, lastImageData: null };
        sessionStorage.setItem(KEY, JSON.stringify(stateWithoutImage));
      } else {
        sessionStorage.setItem(KEY, serialized);
      }
    } catch {
      // Quota exceeded - try minimal state
      const minimalState = { /* only critical fields */ };
      sessionStorage.setItem(KEY, JSON.stringify(minimalState));
    }
  };

  if (immediate) {
    doPersist();
  } else {
    // Debounce 500ms
    clearTimeout(persistenceTimeout);
    persistenceTimeout = setTimeout(doPersist, 500);
  }
}
```

**Impact:**
- Complex error handling
- Hard to debug (which fields were dropped?)
- Performance overhead (JSON serialization on every update)

**Recommendation:**
- **Don't persist everything**: Only persist critical state (lastResult, phase, addState)
- **Use IndexedDB** for large data (images, full messages)
- **Simpler quota handling**: Drop oldest messages first

---

### 3. Unclear Error Handling

**Problem:** Errors can occur at 5+ points in the flow
```typescript
// 1. API call fails
try {
  const result = await api.identifyTextStream(text, onField);
} catch (error) {
  // Fallback to non-streaming
  return agent.identify(text);
}

// 2. Streaming fails mid-stream
sendSSE('error', { type: 'timeout', message: '...', retryable: true });

// 3. Escalation fails
const escalatedResult = $service->identify($input);
if (!$escalatedResult['success']) { /* ... */ }

// 4. LLM API fails (circuit breaker, rate limit, etc.)

// 5. Frontend error display
{#if $agentError}
  <ErrorMessage error={$agentError} />
{/if}
```

**Impact:**
- User sees generic "Something went wrong"
- Hard to debug (which layer failed?)
- Retryable vs non-retryable errors unclear

**Recommendation:**
- **Structured error codes**: Map backend errors to user-friendly messages
- **Error context**: Include retry count, error source (LLM, cache, validation)
- **Explicit retry UI**: "Try again" button with clear action

---

## Optimization Recommendations

### Priority 1: Refactor AgentPanel (🔴 CRITICAL)

**Current:** 3,794-line monolith
**Target:** 8-10 focused components (<300 lines each)

**Proposed Split:**

```
AgentPanel.svelte (200 lines)
  ├─ AgentConversation.svelte (300 lines)
  │   ├─ AgentMessage.svelte (150 lines)
  │   │   ├─ MessageGreeting.svelte
  │   │   ├─ MessageText.svelte
  │   │   ├─ MessageWineResult.svelte
  │   │   ├─ MessageEnrichment.svelte
  │   │   └─ MessageError.svelte
  │   └─ AgentTypingIndicator.svelte
  │
  ├─ AgentIdentificationFlow.svelte (400 lines)
  │   ├─ WineCardStreaming.svelte (existing)
  │   ├─ EnrichmentCardStreaming.svelte (existing)
  │   └─ ActionChips.svelte (existing)
  │
  ├─ AgentAddWineFlow.svelte (500 lines)
  │   ├─ AddEntityStep.svelte (200 lines)
  │   │   └─ MatchSelectionList.svelte (existing)
  │   ├─ AddBottleStep.svelte (200 lines)
  │   └─ AddEnrichmentStep.svelte (100 lines)
  │
  └─ AgentInput.svelte (200 lines)
      └─ CommandInput.svelte (existing)
```

**Benefits:**
- Each component is **focused and testable**
- Changes to add-flow don't touch identification logic
- Easier to onboard new developers
- Performance: Components only re-render when their props change

---

### Priority 2: Split Agent Store (🟡 MODERATE)

**Current:** 2,010-line store with 30+ fields
**Target:** 3-4 focused stores

**Proposed Split:**

```typescript
// 1. agentIdentification.ts (500 lines)
//    - isLoading, lastResult, error, confidence
//    - identify(), identifyWithStreaming()
//    - Derived: agentParsed, agentConfidence, agentAction

// 2. agentEnrichment.ts (300 lines)
//    - isEnriching, enrichmentData, enrichmentError
//    - enrichWine(), enrichWineWithStreaming()
//    - Derived: agentEnrichmentData

// 3. agentConversation.ts (600 lines)
//    - phase, messages, augmentationContext
//    - addMessage(), setPhase(), startSession()
//    - Derived: agentMessages, agentPhase

// 4. agentAddWine.ts (400 lines)
//    - addState
//    - initializeAddFlow(), setAddSelection(), updateAddFormData()
//    - Derived: agentAddState

// 5. agentStreaming.ts (200 lines)
//    - isStreaming, streamingFields, streamingChips
//    - markFieldTypingComplete(), clearStreamingResult()
//    - Derived: agentIsStreaming, agentStreamingFields
```

**Benefits:**
- **Clear boundaries**: Identification store doesn't know about add-flow
- **Simpler testing**: Mock only the store you need
- **Better performance**: Subscribing to `agentIdentification` doesn't trigger updates from `agentAddWine`
- **Easier to understand**: Each store has a single responsibility

---

### Priority 3: Simplify Phases (🟡 MODERATE)

**Current:** 25 phases
**Target:** 8-10 core phases with sub-states

**Proposed Phase Model:**

```typescript
type AgentPhase =
  | 'greeting'           // Initial greeting
  | 'awaiting_input'     // Ready for input
  | 'identifying'        // Processing (includes escalation)
  | 'confirming'         // User confirms/rejects result
  | 'adding_wine'        // Add-to-cellar flow (all steps)
  | 'enriching'          // Fetching enrichment
  | 'error'              // Error recovery
  | 'complete';          // Done

// Add-flow sub-states (not phases)
type AddWineStep =
  | 'confirm'            // "Add to cellar?"
  | 'entity_matching'    // Match region/producer/wine
  | 'bottle_details'     // Bottle form
  | 'enrichment'         // Enrich choice
  | 'complete';          // Success
```

**Benefits:**
- **Fewer transitions**: 8 phases × 3 actions = 24 transitions (vs 25 phases × 5+ actions = 100+ transitions)
- **Clearer flow**: "We're in add-flow, at the entity matching step"
- **Easier to visualize**: Simple state machine diagram

---

### Priority 4: Group Message Types (🟠 LOW-MODERATE)

**Current:** 18 message types with dedicated rendering
**Target:** 5 categories with polymorphic rendering

**Proposed Message Model:**

```typescript
type AgentMessage = {
  id: string;
  role: 'agent' | 'user';
  timestamp: number;
  isNew?: boolean;
} & (
  | { category: 'text'; content: string; }
  | { category: 'result'; result: WineResult; confidence: number; }
  | { category: 'enrichment'; data: EnrichmentData; }
  | { category: 'form'; formType: 'bottle' | 'entity_match'; formData: any; }
  | { category: 'action'; chips: AgentChip[]; }
);
```

**Rendering:**
```svelte
{#each messages as message}
  {#if message.category === 'text'}
    <MessageText {message} />
  {:else if message.category === 'result'}
    <MessageWineResult {message} />
  {:else if message.category === 'enrichment'}
    <MessageEnrichment {message} />
  {:else if message.category === 'form'}
    <MessageForm {message} />
  {:else if message.category === 'action'}
    <MessageAction {message} />
  {/if}
{/each}
```

**Benefits:**
- **5 conditional branches** instead of 18
- **Polymorphic rendering**: Each category has a dedicated component
- **Easier to extend**: New form types don't require new message types

---

### Priority 5: Consolidate Add-Flow (🟠 LOW-MODERATE)

**Current:** 8 phases, 10+ components
**Target:** 3 steps in single flow component

**Proposed Flow:**

```typescript
type AddWineStep = 'entity_matching' | 'bottle_details' | 'enrichment';

// Single phase: 'adding_wine' with step tracking
agentConversation.setPhase('adding_wine', { step: 'entity_matching' });

// AgentAddWineFlow.svelte (500 lines)
<script>
  $: currentStep = $agentAddState?.step ?? 'entity_matching';
</script>

{#if currentStep === 'entity_matching'}
  <AddEntityStep /> <!-- Handles region/producer/wine in one form -->
{:else if currentStep === 'bottle_details'}
  <AddBottleStep /> <!-- Single form, not 2 parts -->
{:else if currentStep === 'enrichment'}
  <AddEnrichmentStep />
{/if}
```

**Benefits:**
- **Fewer transitions**: 3 steps vs 8 phases
- **Unified form**: Entity matching in one component
- **Simpler state**: No need to track which entity we're on

---

### Priority 6: Backend Cleanup (🟢 LOW)

**Current:** 43 PHP files with duplication
**Target:** Consolidate streaming + non-streaming

**Proposed Changes:**

1. **Merge streaming endpoints:**
   ```php
   // identifyText.php (single endpoint)
   if ($streaming) {
       initSSE();
       $result = $service->identifyStreaming($input, $onField);
       sendSSE('result', $result);
   } else {
       $result = $service->identify($input);
       sendJSON($result);
   }
   ```

2. **Extract escalation logic:**
   ```php
   // IdentificationService.php
   public function identify($input) {
       $tier1 = $this->runTier1($input);
       if ($tier1['confidence'] < 85) {
           return $this->escalate($tier1, $input);
       }
       return $tier1;
   }

   private function escalate($priorResult, $input) {
       // Tier 1.5 → Tier 2 → Tier 3 (if user-triggered)
   }
   ```

3. **Reduce IdentificationService.php:**
   - Extract inference logic to InferenceEngine
   - Extract parsing logic to separate class
   - Target: <1,000 lines

**Benefits:**
- **Less duplication**: Single code path for identification
- **Easier to maintain**: Changes apply to both streaming + non-streaming
- **Better testing**: Mock escalation logic independently

---

## Implementation Roadmap

### Phase 1: Refactor UI (2-3 days)
**Goal:** Break AgentPanel into 8-10 components

1. Extract message rendering:
   - `MessageText.svelte`
   - `MessageWineResult.svelte`
   - `MessageEnrichment.svelte`
   - `MessageError.svelte`
   - `MessageForm.svelte`

2. Extract flows:
   - `AgentIdentificationFlow.svelte`
   - `AgentAddWineFlow.svelte`

3. Refactor AgentPanel:
   - Remove inline logic
   - Delegate to child components
   - Target: <300 lines

4. **Test:** Visual regression tests (Playwright)

---

### Phase 2: Split Agent Store (1-2 days)
**Goal:** Create 4 focused stores

1. Create new stores:
   - `agentIdentification.ts`
   - `agentEnrichment.ts`
   - `agentConversation.ts`
   - `agentAddWine.ts`
   - `agentStreaming.ts`

2. Migrate methods:
   - Move `identify()` → `agentIdentification`
   - Move `enrichWine()` → `agentEnrichment`
   - Move `addMessage()` → `agentConversation`
   - Move `initializeAddFlow()` → `agentAddWine`

3. Update components:
   - Import specific stores instead of `agent`
   - Update reactive statements

4. **Test:** Unit tests for each store method

---

### Phase 3: Simplify Phase Model (1 day)
**Goal:** Reduce to 8 core phases

1. Define new phase model:
   - `AgentPhase` enum with 8 values
   - `AddWineStep` sub-state

2. Update phase transitions:
   - Map old phases to new phases
   - Update AgentPanel logic

3. Update documentation:
   - Update AGENT_FLOW.md
   - Create state machine diagram

4. **Test:** Integration tests for phase transitions

---

### Phase 4: Backend Cleanup (1-2 days)
**Goal:** Consolidate endpoints, reduce duplication

1. Merge streaming endpoints:
   - Single `identifyText.php` with streaming flag
   - Single `enrichWine.php` with streaming flag

2. Extract escalation logic:
   - `EscalationService.php`

3. Reduce IdentificationService.php:
   - Extract parsing logic
   - Target: <1,000 lines

4. **Test:** Unit tests for services

---

### Phase 5: Add Test Suite (2-3 days)
**Goal:** Comprehensive test coverage

1. **Unit tests:**
   - All store methods
   - All service methods
   - Streaming field detector

2. **Integration tests:**
   - Full identification flow (mocked LLM)
   - Add-wine flow
   - Error recovery

3. **E2E tests:**
   - Real browser interaction (Playwright)
   - Streaming UX
   - Session restoration

4. **Test coverage target:** >80%

---

## Success Metrics

### Before Refactoring
- **AgentPanel.svelte:** 3,794 lines
- **agent.ts:** 2,010 lines
- **Phases:** 25
- **Message types:** 18
- **Test coverage:** 0%
- **New feature time:** 2-3 days
- **Bug fix time:** 1-2 days

### After Refactoring
- **AgentPanel.svelte:** <300 lines
- **Largest component:** <500 lines
- **Store files:** 4 focused stores (<600 lines each)
- **Phases:** 8-10
- **Message categories:** 5
- **Test coverage:** >80%
- **New feature time:** 1 day (50% faster)
- **Bug fix time:** 1-2 hours (80% faster)

---

## Risks & Mitigations

### Risk 1: Regressions during refactoring
**Mitigation:**
- Write visual regression tests FIRST (Playwright)
- Refactor incrementally (1 component at a time)
- Keep old code until new code is tested

### Risk 2: Breaking existing functionality
**Mitigation:**
- Comprehensive integration tests
- Manual QA checklist
- Beta testing with real users

### Risk 3: Time overrun (estimated 7-10 days)
**Mitigation:**
- Prioritize Phase 1 (UI refactor) as it has the biggest impact
- Phase 2-4 can be done incrementally
- Phase 5 (tests) can be done alongside development

---

## Conclusion

The agent architecture is **functional but unmaintainable**. The 3,794-line AgentPanel and 2,010-line agent store are the primary bottlenecks. Refactoring these will:

1. **Improve testability**: Smaller, focused components and stores
2. **Reduce bugs**: Clear boundaries, simpler logic
3. **Speed up development**: New features don't touch entire codebase
4. **Better performance**: Components only re-render when needed
5. **Easier onboarding**: New developers can understand each component independently

**Recommended approach:** Start with Phase 1 (UI refactor) as it has the **biggest impact** and can be done **incrementally** without breaking existing functionality.

**Timeline:** 7-10 days of focused work, or 2-3 weeks if done alongside other tasks.

---

## Appendix: Code Metrics

### Component Sizes
```
AgentPanel.svelte              3,794 lines  🔴 CRITICAL
agent.ts                       2,010 lines  🟡 MODERATE
IdentificationService.php     ~2,000 lines  🟡 MODERATE
InferenceEngine.php           ~1,900 lines  🟡 MODERATE
WineCardStreaming.svelte        ~300 lines  🟢 ACCEPTABLE
EnrichmentCardStreaming.svelte  ~250 lines  🟢 ACCEPTABLE
StreamingFieldDetector.php       382 lines  🟢 ACCEPTABLE
```

### File Counts
```
Frontend Components:  24 Svelte files
Backend Services:     43 PHP files
Total Agent Code:    ~25,000+ lines
```

### State Complexity
```
Agent Store Fields:      30+
Derived Stores:          30+
Conversation Phases:     25
Message Types:           18
Add-Flow Phases:          8
Session Storage Keys:     2
```

### API Endpoints
```
Identification:     4 endpoints (streaming + non-streaming × text/image)
Enrichment:         2 endpoints (streaming + non-streaming)
Clarification:      1 endpoint
Upload:             1 endpoint
Total:              8 endpoints
```

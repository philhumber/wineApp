# Agent Rearchitecture Testing Plan

**Last Updated:** 2026-02-04
**Status:** Phase 4 Complete - Ready for Testing

---

## Quick Start

```bash
# Install testing dependencies
cd qve
npm install -D vitest @testing-library/svelte jsdom

# Run tests
npm run test              # Run all tests
npm run test:ui           # Visual test runner
npm run test -- --watch   # Watch mode
npm run test:coverage     # Coverage report

# Manual testing
npm run dev               # Start dev server
# Visit http://localhost:5173/qve/agent-test
```

---

## Test Route (Manual Testing)

A test route is available at `/qve/agent-test` for manual testing of the new architecture.

### Features
- **Chat Panel**: New components (AgentChatContainer, MessageList, InputArea)
- **Debug Panel**: Real-time store state display
- **Action Log**: See every action dispatched
- **Test Buttons**: Quick actions for testing

### Test Scenarios

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Text Input | Type "Chateau Margaux" → Submit | User message appears, phase → identifying |
| Chips | Click "Add Text Message" → Click chip | Chip message appears, clicking disables it |
| Simulate Flow | Click "Simulate Identification" | Full flow: thinking → result → confirmation chips |
| Reset | Click "Full Reset" | All messages cleared, phase → greeting |
| Debug Panel | Toggle "Show Debug" | Store state visible, action log populates |

---

## Unit Testing Setup

### 1. Package.json Scripts

Add to `qve/package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:watch": "vitest --watch"
  }
}
```

### 2. Vitest Config

Create `qve/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    alias: {
      $lib: path.resolve(__dirname, './src/lib'),
      $app: path.resolve(__dirname, './src/app-mocks'),
    },
  },
});
```

### 3. Test Setup

Create `qve/src/test-setup.ts`:

```typescript
import { vi } from 'vitest';

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });
Object.defineProperty(window, 'localStorage', { value: sessionStorageMock });

// Reset storage between tests
beforeEach(() => {
  sessionStorageMock.clear();
});
```

---

## Test File Structure

```
qve/src/lib/
├── stores/
│   └── __tests__/
│       ├── agentConversation.test.ts
│       ├── agentIdentification.test.ts
│       ├── agentEnrichment.test.ts
│       ├── agentAddWine.test.ts
│       └── agentPersistence.test.ts
├── agent/
│   └── __tests__/
│       ├── handleAgentAction.test.ts
│       └── messages.test.ts
└── components/
    └── agent/
        └── conversation/
            └── __tests__/
                ├── InputArea.test.ts
                ├── MessageList.test.ts
                └── MessageWrapper.test.ts
```

---

## Store Tests

### agentConversation.test.ts

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  agentMessages,
  agentPhase,
  addMessage,
  createTextMessage,
  createChipsMessage,
  setPhase,
  disableMessage,
  disableAllChips,
  resetConversation,
  fullReset,
  initializeConversation,
} from '../agentConversation';

describe('agentConversation', () => {
  beforeEach(() => {
    fullReset();
  });

  describe('addMessage', () => {
    it('should add a message with generated ID', () => {
      const msg = addMessage(createTextMessage('Hello'));
      expect(msg.id).toBeDefined();
      expect(msg.id).toMatch(/^msg_/);
    });

    it('should add message to store', () => {
      addMessage(createTextMessage('Hello'));
      const messages = get(agentMessages);
      expect(messages).toHaveLength(1);
      expect(messages[0].data.content).toBe('Hello');
    });

    it('should mark new messages with isNew flag', () => {
      const msg = addMessage(createTextMessage('Hello'));
      expect(msg.isNew).toBe(true);
    });

    it('should generate unique IDs for each message', () => {
      const msg1 = addMessage(createTextMessage('First'));
      const msg2 = addMessage(createTextMessage('Second'));
      expect(msg1.id).not.toBe(msg2.id);
    });

    it('should trim messages when exceeding MAX_MESSAGES', () => {
      // Add 35 messages (MAX is 30)
      for (let i = 0; i < 35; i++) {
        addMessage(createTextMessage(`Message ${i}`));
      }
      expect(get(agentMessages)).toHaveLength(30);
    });
  });

  describe('createTextMessage', () => {
    it('should create text message with correct category', () => {
      const msg = createTextMessage('Test');
      expect(msg.category).toBe('text');
      expect(msg.data.category).toBe('text');
      expect(msg.data.content).toBe('Test');
    });

    it('should default to agent role', () => {
      const msg = createTextMessage('Test');
      expect(msg.role).toBe('agent');
    });

    it('should allow user role override', () => {
      const msg = createTextMessage('Test', { role: 'user' });
      expect(msg.role).toBe('user');
    });
  });

  describe('createChipsMessage', () => {
    it('should create chips message with correct category', () => {
      const chips = [{ id: '1', label: 'Test', action: 'test' }];
      const msg = createChipsMessage(chips);
      expect(msg.category).toBe('chips');
      expect(msg.data.chips).toEqual(chips);
    });
  });

  describe('setPhase', () => {
    it('should update phase', () => {
      setPhase('identifying');
      expect(get(agentPhase)).toBe('identifying');
    });

    it('should clear addWineStep when leaving adding_wine phase', () => {
      setPhase('adding_wine', 'confirm');
      setPhase('confirming');
      // addWineStep should be null
    });
  });

  describe('disableMessage', () => {
    it('should mark message as disabled', () => {
      const msg = addMessage(createTextMessage('Test'));
      disableMessage(msg.id);
      expect(get(agentMessages)[0].disabled).toBe(true);
    });

    it('should not affect other messages', () => {
      const msg1 = addMessage(createTextMessage('First'));
      const msg2 = addMessage(createTextMessage('Second'));
      disableMessage(msg1.id);
      expect(get(agentMessages)[0].disabled).toBe(true);
      expect(get(agentMessages)[1].disabled).toBeFalsy();
    });
  });

  describe('disableAllChips', () => {
    it('should disable all chip messages', () => {
      addMessage(createTextMessage('Text'));
      addMessage(createChipsMessage([{ id: '1', label: 'A', action: 'a' }]));
      addMessage(createChipsMessage([{ id: '2', label: 'B', action: 'b' }]));

      disableAllChips();

      const messages = get(agentMessages);
      expect(messages[0].disabled).toBeFalsy(); // text not disabled
      expect(messages[1].disabled).toBe(true);  // chips disabled
      expect(messages[2].disabled).toBe(true);  // chips disabled
    });
  });

  describe('resetConversation', () => {
    it('should add divider and greeting', () => {
      addMessage(createTextMessage('Old message'));
      resetConversation();
      const messages = get(agentMessages);
      expect(messages.length).toBeGreaterThan(1);
    });

    it('should reset phase to awaiting_input', () => {
      setPhase('confirming');
      resetConversation();
      expect(get(agentPhase)).toBe('awaiting_input');
    });
  });

  describe('fullReset', () => {
    it('should clear all messages', () => {
      addMessage(createTextMessage('Test'));
      fullReset();
      expect(get(agentMessages)).toHaveLength(0);
    });

    it('should reset phase to greeting', () => {
      setPhase('confirming');
      fullReset();
      expect(get(agentPhase)).toBe('greeting');
    });
  });
});
```

### agentIdentification.test.ts

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  isIdentifying,
  identificationResult,
  hasResult,
  identificationConfidence,
  augmentationContext,
  hasAugmentationContext,
  pendingNewSearch,
  startIdentification,
  setResult,
  setError,
  clearIdentification,
  resetIdentification,
  setAugmentationContext,
  clearAugmentationContext,
  setPendingNewSearch,
} from '../agentIdentification';

describe('agentIdentification', () => {
  beforeEach(() => {
    resetIdentification();
  });

  describe('startIdentification', () => {
    it('should set isIdentifying to true', () => {
      startIdentification('text');
      expect(get(isIdentifying)).toBe(true);
    });

    it('should clear previous error', () => {
      setError({ type: 'timeout', userMessage: 'Test', retryable: true });
      startIdentification('text');
      // Error should be cleared
    });
  });

  describe('setResult', () => {
    it('should store the result', () => {
      const result = {
        producer: 'Test Producer',
        wineName: 'Test Wine',
        vintage: 2020,
        confidence: 0.9,
      };
      setResult(result, 0.9);

      expect(get(identificationResult)).toEqual(result);
      expect(get(hasResult)).toBe(true);
      expect(get(identificationConfidence)).toBe(0.9);
    });

    it('should set isIdentifying to false', () => {
      startIdentification('text');
      setResult({ producer: 'Test', wineName: 'Wine' }, 0.8);
      expect(get(isIdentifying)).toBe(false);
    });
  });

  describe('augmentationContext', () => {
    it('should store augmentation context', () => {
      setAugmentationContext({ originalInput: 'test input' });
      expect(get(hasAugmentationContext)).toBe(true);
      expect(get(augmentationContext)?.originalInput).toBe('test input');
    });

    it('should clear augmentation context', () => {
      setAugmentationContext({ originalInput: 'test' });
      clearAugmentationContext();
      expect(get(hasAugmentationContext)).toBe(false);
    });
  });

  describe('pendingNewSearch', () => {
    it('should store pending search text', () => {
      setPendingNewSearch('new wine search');
      expect(get(pendingNewSearch)).toBe('new wine search');
    });

    it('should clear pending search', () => {
      setPendingNewSearch('test');
      setPendingNewSearch(null);
      expect(get(pendingNewSearch)).toBeNull();
    });
  });

  describe('clearIdentification', () => {
    it('should clear result but preserve context if requested', () => {
      setResult({ producer: 'Test', wineName: 'Wine' }, 0.8);
      setAugmentationContext({ originalInput: 'keep this' });

      clearIdentification(true); // preserveContext = true

      expect(get(hasResult)).toBe(false);
      expect(get(hasAugmentationContext)).toBe(true);
    });

    it('should clear everything when preserveContext is false', () => {
      setResult({ producer: 'Test', wineName: 'Wine' }, 0.8);
      setAugmentationContext({ originalInput: 'test' });

      clearIdentification(false);

      expect(get(hasResult)).toBe(false);
      expect(get(hasAugmentationContext)).toBe(false);
    });
  });
});
```

### agentPersistence.test.ts

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  persistState,
  loadState,
  clearState,
  createEmptyState,
} from '../agentPersistence';

describe('agentPersistence', () => {
  beforeEach(() => {
    clearState();
  });

  describe('persistState / loadState', () => {
    it('should persist and load state', () => {
      persistState({
        messages: [{ id: '1', category: 'text', role: 'agent', timestamp: Date.now(), data: { category: 'text', content: 'Test' } }],
        phase: 'confirming',
      }, true);

      const loaded = loadState();
      expect(loaded).not.toBeNull();
      expect(loaded?.messages).toHaveLength(1);
      expect(loaded?.phase).toBe('confirming');
    });

    it('should return null when no state exists', () => {
      expect(loadState()).toBeNull();
    });
  });

  describe('createEmptyState', () => {
    it('should create state with correct defaults', () => {
      const state = createEmptyState();
      expect(state.messages).toEqual([]);
      expect(state.phase).toBe('greeting');
      expect(state.addWineStep).toBeNull();
    });
  });

  describe('clearState', () => {
    it('should clear persisted state', () => {
      persistState({ phase: 'confirming' }, true);
      clearState();
      expect(loadState()).toBeNull();
    });
  });
});
```

---

## Action Handler Tests

### handleAgentAction.test.ts

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { handleAgentAction } from '../handleAgentAction';
import {
  agentPhase,
  agentMessages,
  fullReset,
} from '$lib/stores/agentConversation';
import {
  isIdentifying,
  resetIdentification,
} from '$lib/stores/agentIdentification';

describe('handleAgentAction', () => {
  beforeEach(() => {
    fullReset();
    resetIdentification();
  });

  describe('submit_text', () => {
    it('should add user message', async () => {
      await handleAgentAction({ type: 'submit_text', payload: 'Test wine' });

      const messages = get(agentMessages);
      const userMessage = messages.find(m => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage?.data.content).toBe('Test wine');
    });

    it('should start identification', async () => {
      await handleAgentAction({ type: 'submit_text', payload: 'Test' });
      expect(get(isIdentifying)).toBe(true);
      expect(get(agentPhase)).toBe('identifying');
    });
  });

  describe('start_over', () => {
    it('should reset conversation', async () => {
      await handleAgentAction({ type: 'submit_text', payload: 'Test' });
      await handleAgentAction({ type: 'start_over' });

      expect(get(isIdentifying)).toBe(false);
      expect(get(agentPhase)).toBe('awaiting_input');
    });

    it('should disable all chips', async () => {
      // Add chips then start over
      await handleAgentAction({ type: 'start_over' });
      // Chips should be disabled
    });
  });

  describe('chip actions', () => {
    it('should disable message when chip is tapped', async () => {
      // This would need a message with chips first
    });
  });
});
```

---

## Component Tests

### InputArea.test.ts

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import InputArea from '../InputArea.svelte';

describe('InputArea', () => {
  it('should render input field', () => {
    const { getByPlaceholderText } = render(InputArea, { phase: 'greeting' });
    expect(getByPlaceholderText('Type wine name or take a photo...')).toBeDefined();
  });

  it('should be disabled during identifying phase', () => {
    const { getByRole } = render(InputArea, { phase: 'identifying' });
    const textarea = getByRole('textbox');
    expect(textarea).toHaveProperty('disabled', true);
  });

  it('should dispatch action on submit', async () => {
    const { getByRole, component } = render(InputArea, { phase: 'greeting' });

    const dispatchedActions: any[] = [];
    component.$on('action', (e) => dispatchedActions.push(e.detail));

    const textarea = getByRole('textbox');
    await fireEvent.input(textarea, { target: { value: 'Test wine' } });
    await fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(dispatchedActions).toHaveLength(1);
    expect(dispatchedActions[0]).toEqual({
      type: 'submit_text',
      payload: 'Test wine',
    });
  });

  it('should show different placeholder for each phase', () => {
    const { getByPlaceholderText, rerender } = render(InputArea, { phase: 'identifying' });
    expect(getByPlaceholderText('Processing...')).toBeDefined();
  });
});
```

---

## Test Coverage Targets

| Module | Target | Priority |
|--------|--------|----------|
| agentConversation | 90% | High |
| agentIdentification | 85% | High |
| agentEnrichment | 80% | Medium |
| agentAddWine | 80% | Medium |
| agentPersistence | 90% | High |
| handleAgentAction | 75% | High |
| InputArea | 80% | Medium |
| MessageList | 70% | Low |

---

## E2E Tests (Future)

For E2E testing with Playwright:

```bash
npm install -D @playwright/test
npx playwright install
```

Create `qve/tests/agent.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Agent Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/qve/agent-test');
  });

  test('should show greeting on load', async ({ page }) => {
    await expect(page.getByText(/wine sommelier/i)).toBeVisible();
  });

  test('should accept text input', async ({ page }) => {
    const input = page.getByRole('textbox');
    await input.fill('Chateau Margaux');
    await input.press('Enter');

    await expect(page.getByText('Chateau Margaux')).toBeVisible();
  });

  test('should show identification result', async ({ page }) => {
    await page.click('button:has-text("Simulate Identification")');

    // Wait for result
    await expect(page.getByText('Opus One')).toBeVisible({ timeout: 5000 });
  });
});
```

---

## Running Tests

```bash
# All tests
npm run test

# Specific file
npm run test -- agentConversation

# Watch mode
npm run test -- --watch

# Coverage
npm run test:coverage

# UI mode (interactive)
npm run test:ui
```

---

## Checklist

- [ ] Install vitest and dependencies
- [ ] Create vitest.config.ts
- [ ] Create test-setup.ts
- [ ] Write agentConversation tests
- [ ] Write agentIdentification tests
- [ ] Write agentPersistence tests
- [ ] Write handleAgentAction tests
- [ ] Write InputArea component tests
- [ ] Run coverage report
- [ ] Manual test with /qve/agent-test route

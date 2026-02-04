<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  // New architecture components
  import AgentChatContainer from '$lib/components/agent/conversation/AgentChatContainer.svelte';
  import MessageList from '$lib/components/agent/conversation/MessageList.svelte';
  import InputArea from '$lib/components/agent/conversation/InputArea.svelte';

  // New slim panel
  import AgentPanelNew from '$lib/components/agent/AgentPanelNew.svelte';

  // Panel open state for testing slim panel
  import { agent, agentPanelOpen } from '$lib/stores';

  // New stores
  import {
    agentMessages,
    agentPhase,
    addWineStep,
    initializeConversation,
    addMessage,
    createTextMessage,
    createChipsMessage,
    setPhase,
    resetConversation,
    fullReset,
  } from '$lib/stores/agentConversation';

  import {
    isIdentifying,
    identificationResult,
    identificationError,
    identificationConfidence,
    hasResult,
    startIdentification,
    setResult,
    clearIdentification,
  } from '$lib/stores/agentIdentification';

  import {
    isEnriching,
    enrichmentData,
    hasEnrichmentData,
    startEnrichment,
    setEnrichmentData,
    clearEnrichment,
  } from '$lib/stores/agentEnrichment';

  import {
    addWineFlow,
    isInAddWineFlow,
    addWineStep as addWineStepStore,
    startAddFlow,
    cancelAddFlow,
  } from '$lib/stores/agentAddWine';

  // Action handler
  import { handleAgentAction } from '$lib/agent';
  import type { AgentAction, AgentChip } from '$lib/agent/types';

  // Debug state
  let showDebug = true;
  let actionLog: Array<{ timestamp: Date; action: AgentAction }> = [];
  let showSlimPanel = false;

  function toggleSlimPanel() {
    agent.togglePanel();
    showSlimPanel = !showSlimPanel;
  }

  // Handle actions with logging
  async function handleAction(event: CustomEvent<AgentAction>) {
    const action = event.detail;
    actionLog = [...actionLog.slice(-9), { timestamp: new Date(), action }];

    try {
      await handleAgentAction(action);
    } catch (error) {
      console.error('Action failed:', error);
    }
  }

  // Test functions
  function addTestTextMessage() {
    addMessage(createTextMessage("Hello! I'm testing the new architecture."));
  }

  function addTestChipsMessage() {
    const chips: AgentChip[] = [
      { id: 'test1', label: 'Option A', action: 'test_a' },
      { id: 'test2', label: 'Option B', action: 'test_b' },
      { id: 'test3', label: 'Option C', action: 'test_c', variant: 'primary' },
    ];
    addMessage(createChipsMessage(chips));
  }

  function addTestWineResult() {
    addMessage({
      category: 'wine_result',
      role: 'agent',
      data: {
        category: 'wine_result',
        result: {
          producer: 'Château Margaux',
          wineName: 'Grand Vin',
          vintage: 2018,
          region: 'Margaux',
          country: 'France',
          type: 'Red',
          grapes: ['Cabernet Sauvignon', 'Merlot'],
          confidence: 0.95,
        },
      },
    });
  }

  function addTestErrorMessage() {
    addMessage({
      category: 'error',
      role: 'agent',
      data: {
        category: 'error',
        error: {
          type: 'server_error',
          userMessage: 'Something went wrong. Please try again.',
          retryable: true,
        },
        retryable: true,
      },
    });
  }

  function simulateIdentification() {
    startIdentification('text');
    setPhase('identifying');
    addMessage(createTextMessage('Let me identify that wine...'));

    // Simulate API delay
    setTimeout(() => {
      setResult(
        {
          producer: 'Opus One',
          wineName: 'Opus One',
          vintage: 2019,
          region: 'Napa Valley',
          country: 'USA',
          type: 'Red',
          grapes: ['Cabernet Sauvignon', 'Merlot', 'Cabernet Franc'],
          confidence: 0.92,
        },
        0.92
      );
      setPhase('confirming');
      addTestWineResult();
      addMessage(
        createChipsMessage([
          { id: 'correct', label: 'Correct', action: 'correct' },
          { id: 'not_correct', label: 'Not Correct', action: 'not_correct' },
        ])
      );
    }, 1500);
  }

  function goBack() {
    goto('/qve/');
  }

  onMount(() => {
    initializeConversation();
  });
</script>

<svelte:head>
  <title>Agent Test - New Architecture</title>
</svelte:head>

<div class="test-page">
  <!-- Header -->
  <header class="test-header">
    <button class="back-btn" on:click={goBack}>Back</button>
    <h1>Agent Architecture Test</h1>
    <button class="slim-panel-toggle" on:click={toggleSlimPanel}>
      {$agentPanelOpen ? 'Close' : 'Open'} Slim Panel
    </button>
    <button class="debug-toggle" on:click={() => (showDebug = !showDebug)}>
      {showDebug ? 'Hide' : 'Show'} Debug
    </button>
  </header>

  <div class="test-content" class:with-debug={showDebug}>
    <!-- Chat Panel -->
    <div class="chat-panel">
      <AgentChatContainer messages={$agentMessages} on:action={handleAction}>
        <svelte:fragment slot="messages" let:messages let:handleAction>
          <MessageList {messages} on:action={handleAction} />
        </svelte:fragment>

        <svelte:fragment slot="input" let:handleAction>
          <InputArea phase={$agentPhase} on:action={handleAction} />
        </svelte:fragment>
      </AgentChatContainer>
    </div>

    <!-- Debug Panel -->
    {#if showDebug}
      <div class="debug-panel">
        <div class="debug-section">
          <h3>Test Actions</h3>
          <div class="test-buttons">
            <button on:click={addTestTextMessage}>Add Text Message</button>
            <button on:click={addTestChipsMessage}>Add Chips Message</button>
            <button on:click={addTestWineResult}>Add Wine Result</button>
            <button on:click={addTestErrorMessage}>Add Error Message</button>
            <button on:click={simulateIdentification} class="primary">
              Simulate Identification
            </button>
            <button on:click={() => resetConversation()}>Reset Conversation</button>
            <button on:click={() => fullReset()} class="danger">Full Reset</button>
          </div>
        </div>

        <div class="debug-section">
          <h3>Conversation State</h3>
          <div class="debug-value">
            <span class="label">Phase:</span>
            <span class="value phase-badge">{$agentPhase}</span>
          </div>
          <div class="debug-value">
            <span class="label">Add Wine Step:</span>
            <span class="value">{$addWineStep ?? 'none'}</span>
          </div>
          <div class="debug-value">
            <span class="label">Message Count:</span>
            <span class="value">{$agentMessages.length}</span>
          </div>
        </div>

        <div class="debug-section">
          <h3>Identification State</h3>
          <div class="debug-value">
            <span class="label">Is Identifying:</span>
            <span class="value" class:active={$isIdentifying}>{$isIdentifying}</span>
          </div>
          <div class="debug-value">
            <span class="label">Has Result:</span>
            <span class="value" class:active={$hasResult}>{$hasResult}</span>
          </div>
          <div class="debug-value">
            <span class="label">Confidence:</span>
            <span class="value">{$identificationConfidence ?? '-'}</span>
          </div>
          {#if $identificationResult}
            <div class="debug-value">
              <span class="label">Wine:</span>
              <span class="value"
                >{$identificationResult.producer} - {$identificationResult.wineName}</span
              >
            </div>
          {/if}
        </div>

        <div class="debug-section">
          <h3>Enrichment State</h3>
          <div class="debug-value">
            <span class="label">Is Enriching:</span>
            <span class="value" class:active={$isEnriching}>{$isEnriching}</span>
          </div>
          <div class="debug-value">
            <span class="label">Has Data:</span>
            <span class="value" class:active={$hasEnrichmentData}>{$hasEnrichmentData}</span>
          </div>
        </div>

        <div class="debug-section">
          <h3>Add Wine State</h3>
          <div class="debug-value">
            <span class="label">In Flow:</span>
            <span class="value" class:active={$isInAddWineFlow}>{$isInAddWineFlow}</span>
          </div>
          {#if $addWineFlow}
            <div class="debug-value">
              <span class="label">Step:</span>
              <span class="value">{$addWineFlow.step}</span>
            </div>
          {/if}
        </div>

        <div class="debug-section">
          <h3>Action Log</h3>
          <div class="action-log">
            {#each actionLog as entry (entry.timestamp.getTime())}
              <div class="log-entry">
                <span class="log-time"
                  >{entry.timestamp.toLocaleTimeString()}</span
                >
                <span class="log-action">{entry.action.type}</span>
                {#if 'payload' in entry.action}
                  <span class="log-payload"
                    >{JSON.stringify(entry.action.payload).slice(0, 50)}</span
                  >
                {/if}
              </div>
            {/each}
          </div>
        </div>

        <div class="debug-section">
          <h3>Messages</h3>
          <div class="messages-debug">
            {#each $agentMessages as msg, i (msg.id)}
              <div class="msg-entry" class:disabled={msg.disabled}>
                <span class="msg-index">{i + 1}</span>
                <span class="msg-category">{msg.category}</span>
                <span class="msg-role">{msg.role}</span>
                {#if msg.disabled}
                  <span class="msg-disabled">disabled</span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- New Slim Panel (for comparison testing) -->
  <AgentPanelNew />
</div>

<style>
  .test-page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--color-background, #f9fafb);
  }

  .test-header {
    display: flex;
    align-items: center;
    gap: var(--space-md, 16px);
    padding: var(--space-sm, 8px) var(--space-md, 16px);
    background: var(--color-surface, #fff);
    border-bottom: 1px solid var(--color-border, #e5e7eb);
  }

  .test-header h1 {
    flex: 1;
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }

  .back-btn,
  .debug-toggle,
  .slim-panel-toggle {
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-md, 8px);
    background: var(--color-surface, #fff);
    font-size: 0.875rem;
    cursor: pointer;
  }

  .back-btn:hover,
  .debug-toggle:hover,
  .slim-panel-toggle:hover {
    background: var(--color-surface-hover, #f3f4f6);
  }

  .slim-panel-toggle {
    background: var(--color-primary, #6366f1);
    color: white;
    border-color: var(--color-primary, #6366f1);
  }

  .slim-panel-toggle:hover {
    background: var(--color-primary-dark, #4f46e5);
  }

  .test-content {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .chat-panel {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .test-content.with-debug .chat-panel {
    max-width: 50%;
  }

  .debug-panel {
    width: 400px;
    overflow-y: auto;
    padding: var(--space-md, 16px);
    background: var(--color-surface, #fff);
    border-left: 1px solid var(--color-border, #e5e7eb);
  }

  .debug-section {
    margin-bottom: var(--space-lg, 24px);
  }

  .debug-section h3 {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b7280);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 var(--space-sm, 8px) 0;
    padding-bottom: var(--space-xs, 4px);
    border-bottom: 1px solid var(--color-border, #e5e7eb);
  }

  .test-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs, 4px);
  }

  .test-buttons button {
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-sm, 4px);
    background: var(--color-surface, #fff);
    font-size: 0.75rem;
    cursor: pointer;
  }

  .test-buttons button:hover {
    background: var(--color-surface-hover, #f3f4f6);
  }

  .test-buttons button.primary {
    background: var(--color-primary, #6366f1);
    color: white;
    border-color: var(--color-primary, #6366f1);
  }

  .test-buttons button.primary:hover {
    background: var(--color-primary-dark, #4f46e5);
  }

  .test-buttons button.danger {
    background: var(--color-error, #ef4444);
    color: white;
    border-color: var(--color-error, #ef4444);
  }

  .test-buttons button.danger:hover {
    background: #dc2626;
  }

  .debug-value {
    display: flex;
    align-items: center;
    gap: var(--space-sm, 8px);
    padding: var(--space-xs, 4px) 0;
    font-size: 0.8125rem;
  }

  .debug-value .label {
    color: var(--color-text-muted, #6b7280);
    min-width: 100px;
  }

  .debug-value .value {
    font-family: ui-monospace, monospace;
    color: var(--color-text, #374151);
  }

  .debug-value .value.active {
    color: var(--color-success, #10b981);
    font-weight: 600;
  }

  .phase-badge {
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm, 4px);
    background: var(--color-primary-subtle, #e0e7ff);
    color: var(--color-primary, #6366f1);
  }

  .action-log {
    max-height: 150px;
    overflow-y: auto;
    font-size: 0.75rem;
    font-family: ui-monospace, monospace;
  }

  .log-entry {
    display: flex;
    gap: var(--space-xs, 4px);
    padding: 2px 0;
    border-bottom: 1px solid var(--color-border-light, #f3f4f6);
  }

  .log-time {
    color: var(--color-text-muted, #9ca3af);
    min-width: 70px;
  }

  .log-action {
    color: var(--color-primary, #6366f1);
    font-weight: 500;
  }

  .log-payload {
    color: var(--color-text-muted, #6b7280);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .messages-debug {
    max-height: 200px;
    overflow-y: auto;
    font-size: 0.75rem;
  }

  .msg-entry {
    display: flex;
    gap: var(--space-sm, 8px);
    padding: 4px;
    border-radius: var(--radius-sm, 4px);
    margin-bottom: 2px;
  }

  .msg-entry:nth-child(odd) {
    background: var(--color-surface-hover, #f9fafb);
  }

  .msg-entry.disabled {
    opacity: 0.5;
  }

  .msg-index {
    color: var(--color-text-muted, #9ca3af);
    min-width: 20px;
  }

  .msg-category {
    font-weight: 500;
    color: var(--color-primary, #6366f1);
    min-width: 80px;
  }

  .msg-role {
    color: var(--color-text-muted, #6b7280);
  }

  .msg-disabled {
    color: var(--color-error, #ef4444);
    font-size: 0.6875rem;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .test-content.with-debug {
      flex-direction: column;
    }

    .test-content.with-debug .chat-panel {
      max-width: 100%;
      height: 50%;
    }

    .debug-panel {
      width: 100%;
      height: 50%;
    }
  }
</style>

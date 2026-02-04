<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AgentAction } from '$lib/agent/types';

  export let phase: string = 'greeting';
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher<{ action: AgentAction }>();

  let inputValue = '';
  let fileInput: HTMLInputElement;

  // Phases where input is disabled
  const disabledPhases = ['identifying', 'complete', 'confirm_new_search'];
  $: isDisabled = disabled || disabledPhases.includes(phase);

  // Dynamic placeholder based on phase
  const placeholders: Record<string, string> = {
    greeting: 'Type wine name or take a photo...',
    awaiting_input: 'Type wine name or take a photo...',
    identifying: 'Processing...',
    confirming: 'Or type to search again...',
    adding_wine: 'Continue with current wine...',
    enriching: 'Loading details...',
    error: 'Try again or start over...',
    complete: 'Processing...',
  };
  $: placeholder = placeholders[phase] ?? 'Type a message...';

  function handleSubmit() {
    const text = inputValue.trim();
    if (!text || isDisabled) return;

    dispatch('action', { type: 'submit_text', payload: text });
    inputValue = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleImageSelect(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      dispatch('action', {
        type: 'submit_image',
        payload: {
          data: reader.result as string,
          mimeType: file.type,
        },
      });
    };
    reader.readAsDataURL(file);

    // Reset file input
    if (fileInput) fileInput.value = '';
  }

  function openCamera() {
    fileInput?.click();
  }
</script>

<div class="input-area" class:disabled={isDisabled}>
  <div class="input-wrapper">
    <textarea
      bind:value={inputValue}
      {placeholder}
      disabled={isDisabled}
      on:keydown={handleKeydown}
      rows="1"
      class="input-field"
    ></textarea>
  </div>

  <div class="input-actions">
    <button
      type="button"
      class="action-btn camera-btn"
      on:click={openCamera}
      disabled={isDisabled}
      aria-label="Take photo or upload image"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
    </button>

    <button
      type="button"
      class="action-btn send-btn"
      on:click={handleSubmit}
      disabled={isDisabled || !inputValue.trim()}
      aria-label="Send message"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    </button>
  </div>

  <input
    type="file"
    accept="image/*"
    capture="environment"
    bind:this={fileInput}
    on:change={handleImageSelect}
    hidden
  />
</div>

<style>
  .input-area {
    display: flex;
    align-items: flex-end;
    gap: var(--space-sm, 8px);
    padding: var(--space-md, 16px);
    background: var(--color-surface, #fff);
  }

  .input-area.disabled {
    opacity: 0.6;
  }

  .input-wrapper {
    flex: 1;
  }

  .input-field {
    width: 100%;
    min-height: 40px;
    max-height: 120px;
    padding: var(--space-sm, 8px) var(--space-md, 12px);
    border: 1px solid var(--color-border, #e0e0e0);
    border-radius: var(--radius-md, 8px);
    background: var(--color-background, #fff);
    font-size: var(--font-size-md, 16px);
    font-family: inherit;
    resize: none;
    outline: none;
    transition: border-color 0.2s;
  }

  .input-field:focus {
    border-color: var(--color-primary, #6366f1);
  }

  .input-field:disabled {
    background: var(--color-surface-disabled, #f5f5f5);
    cursor: not-allowed;
  }

  .input-field::placeholder {
    color: var(--color-text-muted, #9ca3af);
  }

  .input-actions {
    display: flex;
    gap: var(--space-xs, 4px);
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: none;
    border-radius: var(--radius-md, 8px);
    background: var(--color-surface-hover, #f3f4f6);
    color: var(--color-text, #374151);
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover:not(:disabled) {
    background: var(--color-primary-subtle, #e0e7ff);
    color: var(--color-primary, #6366f1);
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .send-btn:not(:disabled) {
    background: var(--color-primary, #6366f1);
    color: white;
  }

  .send-btn:hover:not(:disabled) {
    background: var(--color-primary-dark, #4f46e5);
  }
</style>

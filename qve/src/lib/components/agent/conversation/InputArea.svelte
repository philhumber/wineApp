<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AgentAction } from '$lib/agent/types';

  export let phase: string = 'greeting';
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher<{ action: AgentAction }>();

  let inputValue = '';
  let fileInput: HTMLInputElement;
  let textareaEl: HTMLTextAreaElement;

  // Auto-resize textarea on input (no reactive statement to avoid loops)
  function autoResize() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    textareaEl.style.height = `${textareaEl.scrollHeight}px`;
  }

  // Phases where input is disabled
  const disabledPhases = ['identifying', 'complete', 'confirm_new_search'];
  $: isDisabled = disabled || disabledPhases.includes(phase);

  // Dynamic placeholder based on phase (kept concise to avoid wrapping)
  const placeholders: Record<string, string> = {
    greeting: 'Wine name or photo...',
    awaiting_input: 'Wine name or photo...',
    identifying: 'Processing...',
    confirming: 'Search again...',
    adding_wine: 'Continue...',
    enriching: 'Loading...',
    error: 'Try again...',
    complete: 'Processing...',
  };
  $: placeholder = placeholders[phase] ?? 'Type a message...';

  function handleSubmit() {
    const text = inputValue.trim();
    if (!text || isDisabled) return;

    dispatch('action', { type: 'submit_text', payload: text });
    inputValue = '';
    // Reset height after clearing
    if (textareaEl) textareaEl.style.height = 'auto';
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
      bind:this={textareaEl}
      {placeholder}
      disabled={isDisabled}
      on:keydown={handleKeydown}
      on:input={autoResize}
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
    gap: var(--space-2);
    padding: var(--space-4);
    background: var(--surface);
    border-top: 1px solid var(--divider);
  }

  .input-area.disabled {
    opacity: 0.6;
  }

  .input-wrapper {
    flex: 1;
  }

  .input-field {
    width: 100%;
    min-height: 44px;
    max-height: 120px;
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--divider);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--text-primary);
    font-size: 1rem;
    font-family: var(--font-sans);
    resize: none;
    outline: none;
    transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
  }

  .input-field:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-muted);
  }

  .input-field:disabled {
    background: var(--bg-subtle);
    color: var(--text-tertiary);
    cursor: not-allowed;
  }

  .input-field::placeholder {
    color: var(--text-tertiary);
  }

  .input-actions {
    display: flex;
    gap: var(--space-1);
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1px solid var(--divider-subtle);
    border-radius: var(--radius-lg);
    background: var(--bg-subtle);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s var(--ease-out);
  }

  .action-btn:hover:not(:disabled) {
    background: var(--accent-muted);
    border-color: var(--accent);
    color: var(--text-primary);
  }

  .action-btn:active:not(:disabled) {
    transform: scale(0.96);
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Send button - prominent accent style */
  .send-btn:not(:disabled) {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--bg);
  }

  .send-btn:hover:not(:disabled) {
    background: var(--accent-subtle);
    border-color: var(--accent-subtle);
  }
</style>

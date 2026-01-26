<script lang="ts">
  /**
   * FilterPill Component
   * Individual filter button with active state styling
   */
  import { createEventDispatcher } from 'svelte';
  import { Icon } from '$lib/components';

  export let label: string;
  export let active: boolean = false;
  export let hasDropdown: boolean = false;
  export let disabled: boolean = false;
  export let expanded: boolean = false;

  const dispatch = createEventDispatcher<{
    click: void;
  }>();

  // Track if touch already handled (prevents double-fire on iOS)
  let touchHandled = false;

  function handleClick() {
    // Ignore click if already handled by touch
    if (touchHandled) {
      touchHandled = false;
      return;
    }

    if (!disabled) {
      dispatch('click');
    }
  }

  // iOS fast tap handler - fires immediately without 300ms delay
  function handleTouchEnd(event: TouchEvent) {
    if (disabled || touchHandled) return; // Prevent double-tap race condition

    event.preventDefault(); // Prevent delayed click
    event.stopImmediatePropagation(); // Stop all other handlers
    touchHandled = true;
    dispatch('click');

    // Reset flag after potential click event (iOS can have up to 300ms delay)
    setTimeout(() => {
      touchHandled = false;
    }, 500);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }
</script>

<button
  class="filter-pill"
  class:active
  class:expanded
  {disabled}
  on:click={handleClick}
  on:touchend={handleTouchEnd}
  on:keydown={handleKeydown}
  aria-pressed={active}
  aria-expanded={hasDropdown ? expanded : undefined}
  aria-haspopup={hasDropdown ? 'listbox' : undefined}
>
  {label}
  {#if hasDropdown}
    <Icon name="chevron-down" size={8} />
  {/if}
</button>

<style>
  .filter-pill {
    flex-shrink: 0;
    white-space: nowrap;
    padding: 4px 10px;
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    background: transparent;
    border: 1px solid var(--divider);
    border-radius: 100px;
    cursor: pointer;
    transition: all 0.2s var(--ease-out);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .filter-pill:hover:not(:disabled) {
    border-color: var(--accent-subtle);
    color: var(--text-secondary);
  }

  .filter-pill:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .filter-pill.active {
    background: var(--text-primary);
    border-color: var(--text-primary);
    color: var(--bg);
  }

  .filter-pill.active:hover:not(:disabled) {
    background: var(--text-secondary);
    border-color: var(--text-secondary);
  }

  .filter-pill:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Chevron icon styling */
  .filter-pill :global(.icon) {
    transition: transform 0.2s var(--ease-out);
  }

  /* Rotate chevron when dropdown is expanded */
  .filter-pill.expanded :global(.icon) {
    transform: rotate(180deg);
  }
</style>

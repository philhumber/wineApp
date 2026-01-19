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

  const dispatch = createEventDispatcher<{
    click: void;
  }>();

  function handleClick() {
    if (!disabled) {
      dispatch('click');
    }
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
  {disabled}
  on:click={handleClick}
  aria-pressed={active}
>
  {label}
  {#if hasDropdown}
    <Icon name="chevron-down" size={10} />
  {/if}
</button>

<style>
  .filter-pill {
    flex-shrink: 0;
    white-space: nowrap;
    padding: var(--space-2) var(--space-4);
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 400;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    background: transparent;
    border: 1px solid var(--divider);
    border-radius: 100px;
    cursor: pointer;
    transition: all 0.2s var(--ease-out);
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
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

  .filter-pill.active :global(.icon) {
    transform: rotate(180deg);
  }
</style>

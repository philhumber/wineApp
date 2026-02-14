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

  // Track touch for tap detection (iOS Chrome iPhone workaround)
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let touchTriggered = false;
  const TAP_THRESHOLD = 10; // pixels
  const TAP_TIMEOUT = 300; // ms

  function handleClick() {
    // Skip if already handled by touch
    if (touchTriggered) {
      touchTriggered = false;
      return;
    }
    if (!disabled) {
      dispatch('click');
    }
  }

  function handleTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
  }

  function handleTouchEnd(event: TouchEvent) {
    if (disabled) return;

    const touch = event.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStartX);
    const deltaY = Math.abs(touch.clientY - touchStartY);
    const elapsed = Date.now() - touchStartTime;

    // Only trigger if it was a quick tap without much movement
    if (deltaX < TAP_THRESHOLD && deltaY < TAP_THRESHOLD && elapsed < TAP_TIMEOUT) {
      event.preventDefault();
      touchTriggered = true;
      dispatch('click');

      // Reset flag after a delay
      setTimeout(() => {
        touchTriggered = false;
      }, 500);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!disabled) {
        dispatch('click');
      }
    }
  }
</script>

<button
  class="filter-pill"
  class:active
  class:expanded
  {disabled}
  on:click={handleClick}
  on:touchstart|passive={handleTouchStart}
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
    /* Ensure taps are handled as clicks, not scroll gestures (iOS) */
    touch-action: manipulation;
  }

  /* Only apply hover styles on devices with actual hover capability (not touch) */
  @media (hover: hover) {
    .filter-pill:hover:not(:disabled) {
      border-color: var(--accent-subtle);
      color: var(--text-secondary);
    }
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

  @media (hover: hover) {
    .filter-pill.active:hover:not(:disabled) {
      background: var(--text-secondary);
      border-color: var(--text-secondary);
    }
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

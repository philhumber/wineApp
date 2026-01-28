<script lang="ts">
  /**
   * FilterDropdown Component
   * Dropdown menu for filter options (Region, Producer, Vintage)
   * Positioned below the filter pill that triggered it
   * Automatically adjusts position to stay within viewport bounds
   */
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import { Icon } from '$lib/components';
  import type { FilterOption } from '$lib/stores/filterOptions';

  export let items: FilterOption[] = [];
  export let loading: boolean = false;
  export let selectedValue: string | undefined = undefined;
  export let label: string = 'Filter';
  export let position: { top: number; left: number } = { top: 0, left: 0 };

  let containerElement: HTMLDivElement;
  let highlightedIndex = -1;
  let adjustedPosition = { ...position };
  let positionReady = false;
  let backdropReady = false; // Prevents backdrop from capturing pill click on iOS
  let backdropTouched = false; // Track if backdrop received its own touch (not ghost click)

  const dispatch = createEventDispatcher<{
    select: { value: string };
    clear: void;
    close: void;
  }>();

  // Adjust position to keep dropdown within viewport bounds
  async function adjustPositionForViewport() {
    await tick(); // Wait for DOM to update

    // iOS Safari timing: containerElement may not be bound yet
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      if (!containerElement) {
        // Fallback: use initial position and show anyway
        adjustedPosition = { ...position };
        positionReady = true;
        return;
      }

      const rect = containerElement.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 16; // Minimum distance from edge

      let newLeft = position.left;
      let newTop = position.top;

      // Check right edge overflow
      if (newLeft + rect.width > viewportWidth - padding) {
        newLeft = viewportWidth - rect.width - padding;
      }

      // Check left edge (don't go off left side)
      if (newLeft < padding) {
        newLeft = padding;
      }

      // Check bottom edge overflow
      if (newTop + rect.height > viewportHeight - padding) {
        // Position above the trigger instead
        newTop = position.top - rect.height - 16;
      }

      // Check top edge (don't go off top)
      if (newTop < padding) {
        newTop = padding;
      }

      adjustedPosition = { top: newTop, left: newLeft };
      positionReady = true;
    });
  }

  function handleSelect(value: string) {
    dispatch('select', { value });
  }

  function handleClear() {
    dispatch('clear');
  }

  function handleClose() {
    dispatch('close');
  }

  function handleBackdropTouchStart() {
    // Mark that backdrop received its own touch event (not a ghost click from pill)
    if (backdropReady) {
      backdropTouched = true;
    }
  }

  function handleBackdropTouchEnd(event: TouchEvent) {
    // Only close if backdrop is ready AND received its own touch
    if (!backdropReady || !backdropTouched) return;
    event.preventDefault(); // Prevent click from also firing
    handleClose();
  }

  function handleBackdropClick() {
    // Only close if backdrop is ready AND either:
    // 1. Backdrop was touched (touch devices), or
    // 2. This is a non-touch click (mouse devices - backdropTouched will be false but that's ok)
    // On iOS, ghost clicks won't have backdropTouched=true, so they'll be ignored
    if (!backdropReady) return;
    // For touch devices, require an explicit touch on backdrop
    // For mouse, allow click directly (backdropTouched stays false)
    if ('ontouchstart' in window && !backdropTouched) return;
    handleClose();
  }

  function handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        handleClose();
        break;
      case 'ArrowDown':
        event.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
        scrollToHighlighted();
        break;
      case 'ArrowUp':
        event.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, selectedValue ? -1 : 0);
        scrollToHighlighted();
        break;
      case 'Enter':
        event.preventDefault();
        if (highlightedIndex === -1 && selectedValue) {
          handleClear();
        } else if (highlightedIndex >= 0 && highlightedIndex < items.length) {
          handleSelect(items[highlightedIndex].value);
        }
        break;
    }
  }

  function scrollToHighlighted() {
    const list = containerElement?.querySelector('.dropdown-list');
    const item = list?.children[selectedValue ? highlightedIndex + 1 : highlightedIndex] as HTMLElement;
    if (item && list) {
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  // Adjust position on mount
  onMount(() => {
    adjustPositionForViewport();
    // Don't auto-focus on iOS - it can interfere with touch handling

    // Delay backdrop interaction to prevent capturing pill click on iOS
    // 300ms to ensure all touch events from pill tap have completed
    setTimeout(() => {
      backdropReady = true;
    }, 300);
  });

  // Check if an item is the currently selected value
  function isSelected(value: string): boolean {
    return selectedValue === value;
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Backdrop overlay (transitions removed for iOS compatibility) -->
<div
  class="dropdown-backdrop"
  class:backdrop-ready={backdropReady}
  on:touchstart={handleBackdropTouchStart}
  on:touchend={handleBackdropTouchEnd}
  on:click={handleBackdropClick}
  on:keydown={handleKeydown}
  role="button"
  tabindex="-1"
  aria-label="Close dropdown"
></div>

<!-- Dropdown container (transitions removed for iOS compatibility) -->
<div
  class="dropdown-container"
  class:position-ready={positionReady}
  bind:this={containerElement}
  role="listbox"
  aria-label="{label} options"
  tabindex="-1"
  style="top: {adjustedPosition.top}px; left: {adjustedPosition.left}px;"
>
  <!-- Header -->
  <div class="dropdown-header">
    <span class="dropdown-label">{label}</span>
    <button
      type="button"
      class="close-btn"
      on:click={handleClose}
      aria-label="Close dropdown"
    >
      <Icon name="x" size={16} />
    </button>
  </div>

  <!-- Loading state -->
  {#if loading}
    <div class="dropdown-loading">
      <span class="loading-text">Loading...</span>
    </div>
  {:else}
    <!-- Options list -->
    <div class="dropdown-list">
      <!-- Clear option (only when filter is active) -->
      {#if selectedValue}
        <button
          type="button"
          class="dropdown-item clear-item"
          class:highlighted={highlightedIndex === -1}
          on:click={handleClear}
          on:mouseenter={() => (highlightedIndex = -1)}
          role="option"
          aria-selected={false}
        >
          <Icon name="x" size={14} />
          <span>Clear filter</span>
        </button>
        <div class="dropdown-divider"></div>
      {/if}

      <!-- Option items -->
      {#if items.length > 0}
        {#each items as item, index}
          <button
            type="button"
            class="dropdown-item"
            class:selected={isSelected(item.value)}
            class:highlighted={highlightedIndex === index}
            on:click={() => handleSelect(item.value)}
            on:mouseenter={() => (highlightedIndex = index)}
            role="option"
            aria-selected={isSelected(item.value)}
          >
            <div class="item-content">
              <span class="item-label">{item.label}</span>
              {#if item.meta}
                <span class="item-meta">{item.meta}</span>
              {/if}
            </div>
            {#if item.count !== undefined}
              <span class="item-count">{item.count}</span>
            {/if}
          </button>
        {/each}
      {:else}
        <div class="dropdown-empty">
          <span>No options available</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Backdrop overlay - z-index above header (100) */
  .dropdown-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.2);
    z-index: 9998;
    cursor: pointer; /* Required for iOS tap detection */
    /* Force new compositing layer to escape header stacking context on iOS Safari */
    transform: translateZ(0);
    -webkit-transform: translateZ(0);
    /* Disable pointer events initially to prevent iOS ghost clicks */
    pointer-events: none;
  }

  .dropdown-backdrop.backdrop-ready {
    pointer-events: auto;
  }

  /* Dropdown container - uses fixed positioning to escape header overflow */
  .dropdown-container {
    position: fixed;
    min-width: 220px;
    max-width: 320px;
    background: var(--surface);
    border: 1px solid var(--divider);
    border-radius: 8px;
    box-shadow: var(--shadow-lg);
    z-index: 9999;
    overflow: hidden;
    outline: none;
    opacity: 0;
    visibility: hidden;
    /* Force new compositing layer to escape header stacking context on iOS Safari */
    transform: translateZ(0);
    -webkit-transform: translateZ(0);
  }

  .dropdown-container.position-ready {
    opacity: 1;
    visibility: visible;
  }

  /* Header */
  .dropdown-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--divider-subtle);
    background: var(--bg-subtle);
  }

  .dropdown-label {
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-tertiary);
  }

  .close-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-tertiary);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s var(--ease-out);
  }


  /* Loading state */
  .dropdown-loading {
    padding: var(--space-6) var(--space-4);
    text-align: center;
  }

  .loading-text {
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-style: italic;
    color: var(--text-tertiary);
  }

  /* Options list */
  .dropdown-list {
    max-height: 280px;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch; /* iOS momentum scrolling */
  }

  /* Dropdown item */
  .dropdown-item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s var(--ease-out);
  }

  /* Highlighted state for keyboard/touch selection */
  .dropdown-item.highlighted {
    background: var(--bg-subtle);
  }

  .dropdown-item.selected {
    background: var(--accent-subtle);
  }

  .dropdown-item.selected.highlighted {
    background: var(--accent-subtle);
  }

  /* Clear item styling */
  .clear-item {
    color: var(--text-tertiary);
    gap: var(--space-2);
    justify-content: flex-start;
  }

  .clear-item span {
    font-family: var(--font-sans);
    font-size: 0.8125rem;
  }


  /* Item content */
  .item-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .item-label {
    font-family: var(--font-sans);
    font-size: 0.875rem;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-meta {
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Bottle count badge */
  .item-count {
    flex-shrink: 0;
    min-width: 24px;
    padding: 2px 6px;
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--text-tertiary);
    background: var(--bg-subtle);
    border-radius: 10px;
    text-align: center;
  }

  .dropdown-item.selected .item-count {
    background: var(--surface);
    color: var(--accent);
  }

  /* Divider */
  .dropdown-divider {
    height: 1px;
    background: var(--divider-subtle);
    margin: var(--space-1) 0;
  }

  /* Empty state */
  .dropdown-empty {
    padding: var(--space-6) var(--space-4);
    text-align: center;
  }

  .dropdown-empty span {
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-style: italic;
    color: var(--text-tertiary);
  }

  /* Hover styles - only on devices that support hover (not touch) */
  @media (hover: hover) {
    .dropdown-item:hover {
      background: var(--bg-subtle);
    }

    .dropdown-item.selected:hover {
      background: var(--accent-subtle);
    }

    .clear-item:hover {
      color: var(--text-secondary);
    }

    .close-btn:hover {
      background: var(--surface);
      color: var(--text-secondary);
    }
  }

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .dropdown-container {
      min-width: 200px;
      max-width: calc(100vw - var(--space-8));
    }
  }
</style>

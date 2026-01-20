<!--
  MiniRatingDots Component
  5-dot rating input for optional ratings (smaller, muted)

  Usage:
  <MiniRatingDots
    label="Complexity"
    icon="🎭"
    value={complexityRating}
    on:change={(e) => setRating('complexity', e.detail)}
  />
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let label: string = 'Rating';
  export let icon: string = '🎭';
  export let value: number = 0;
  export let maxDots: number = 5;
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher<{ change: number }>();

  let hoverValue: number | null = null;

  function handleClick(rating: number) {
    if (disabled) return;
    // Allow deselecting by clicking the same value
    if (value === rating) {
      value = 0;
      dispatch('change', 0);
    } else {
      value = rating;
      dispatch('change', rating);
    }
  }

  function handleMouseEnter(rating: number) {
    if (disabled) return;
    hoverValue = rating;
  }

  function handleMouseLeave() {
    hoverValue = null;
  }

  function handleKeyDown(event: KeyboardEvent, rating: number) {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick(rating);
    }
  }

  $: displayValue = value > 0 ? value.toString() : '—';
</script>

<div class="mini-rating-row" class:disabled>
  <span class="mini-rating-icon">{icon}</span>
  <span class="mini-rating-label">{label}</span>
  <div
    class="mini-dots"
    role="radiogroup"
    aria-label="{label} rating"
    on:mouseleave={handleMouseLeave}
  >
    {#each Array(maxDots) as _, i}
      {@const rating = i + 1}
      {@const isSelected = rating <= value}
      {@const isPreview = hoverValue !== null && rating <= hoverValue && !isSelected}
      <button
        type="button"
        class="mini-dot"
        class:selected={isSelected}
        class:preview={isPreview}
        role="radio"
        aria-checked={rating === value}
        aria-label="Rate {rating} out of {maxDots}"
        tabindex={rating === 1 ? 0 : -1}
        {disabled}
        on:click={() => handleClick(rating)}
        on:mouseenter={() => handleMouseEnter(rating)}
        on:keydown={(e) => handleKeyDown(e, rating)}
      />
    {/each}
  </div>
  <span class="mini-rating-value">{displayValue}</span>
</div>

<style>
  .mini-rating-row {
    display: flex;
    align-items: center;
    gap: var(--space-3, 0.75rem);
    padding: var(--space-2, 0.5rem) 0;
  }

  .mini-rating-row.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .mini-rating-icon {
    font-size: 0.875rem;
    width: 1.25rem;
    text-align: center;
  }

  .mini-rating-label {
    font-family: var(--font-sans, system-ui);
    font-size: 0.8125rem;
    color: var(--text-tertiary, #8A847D);
    min-width: 80px;
  }

  .mini-dots {
    display: flex;
    align-items: center;
    gap: var(--space-1, 0.25rem);
    margin-left: auto;
  }

  .mini-dot {
    width: 8px;
    height: 8px;
    padding: 0;
    background: transparent;
    border: 1px solid var(--divider, #E8E4DE);
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.15s var(--ease-out, ease-out);
  }

  .mini-dot:hover {
    transform: scale(1.3);
    border-color: var(--accent-subtle, #C4BAA9);
  }

  .mini-dot:focus-visible {
    outline: 2px solid var(--accent, #A69B8A);
    outline-offset: 2px;
  }

  .mini-dot.preview {
    border-color: var(--accent-subtle, #C4BAA9);
    background: var(--accent-muted, #D9D2C6);
  }

  .mini-dot.selected {
    border-color: transparent;
    background: var(--accent-subtle, #C4BAA9);
  }

  .mini-rating-value {
    font-family: var(--font-sans, system-ui);
    font-size: 0.75rem;
    color: var(--text-tertiary, #8A847D);
    min-width: 1rem;
    text-align: right;
  }

  /* Responsive */
  @media (max-width: 520px) {
    .mini-rating-label {
      min-width: 70px;
      font-size: 0.75rem;
    }

    .mini-dot {
      width: 6px;
      height: 6px;
    }
  }
</style>

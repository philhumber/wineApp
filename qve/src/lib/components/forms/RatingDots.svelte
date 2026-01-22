<!--
  RatingDots Component
  10-dot rating input for main ratings (Overall/Value)

  Usage:
  <RatingDots
    label="Overall"
    icon="🍷"
    value={overallRating}
    variant="wine"
    on:change={(e) => setRating(e.detail)}
  />
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let label: string = 'Rating';
  export let icon: string = '🍷';
  export let value: number = 0;
  export let variant: 'wine' | 'value' = 'wine';
  export let maxDots: number = 10;
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher<{ change: number }>();

  let hoverValue: number | null = null;

  function handleClick(rating: number) {
    if (disabled) return;
    value = rating;
    dispatch('change', rating);
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
  $: isActive = value > 0;
</script>

<div class="rating-section rating-{variant}" class:disabled>
  <div class="rating-header">
    <span class="rating-icon">{icon}</span>
    <span class="rating-title">{label}</span>
    <span class="rating-value-display" class:active={isActive}>{displayValue}</span>
  </div>
  <div
    class="rating-row"
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
        class="rating-dot"
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
</div>

<style>
  .rating-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
  }

  .rating-section.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .rating-header {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .rating-icon {
    font-size: 1rem;
  }

  .rating-title {
    font-family: var(--font-sans, system-ui);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary, #5C5652);
  }

  .rating-value-display {
    margin-left: auto;
    font-family: var(--font-serif, Georgia);
    font-size: 1.25rem;
    font-weight: 400;
    color: var(--text-tertiary, #8A847D);
    transition: color 0.2s var(--ease-out, ease-out);
  }

  .rating-value-display.active {
    color: var(--text-primary, #2D2926);
  }

  .rating-row {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .rating-dot {
    width: 10px;
    height: 10px;
    padding: 0;
    background: transparent;
    border: 1.5px solid var(--divider, #E8E4DE);
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.15s var(--ease-out, ease-out);
  }

  .rating-dot:hover {
    transform: scale(1.2);
    border-color: var(--accent-subtle, #C4BAA9);
  }

  .rating-dot:focus-visible {
    outline: 2px solid var(--accent, #A69B8A);
    outline-offset: 2px;
  }

  .rating-dot.preview {
    border-color: var(--accent-subtle, #C4BAA9);
    background: var(--accent-muted, #D9D2C6);
  }

  .rating-dot.selected {
    border-color: transparent;
  }

  /* Wine rating color (burgundy) */
  .rating-wine .rating-dot.selected {
    background: var(--rating-wine, #8B4A5C);
  }

  /* Value rating color (olive green) */
  .rating-value .rating-dot.selected {
    background: var(--rating-value, #7A8B6B);
  }

  /* Responsive */
  @media (max-width: 520px) {
    .rating-row {
      gap: var(--space-2, 0.5rem);
    }

    .rating-dot {
      width: 8px;
      height: 8px;
    }
  }
</style>

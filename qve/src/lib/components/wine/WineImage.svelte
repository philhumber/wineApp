<script lang="ts">
  /**
   * WineImage component
   * Displays wine bottle image with graceful fallback to placeholder SVG
   * Optionally clickable for fullscreen lightbox viewing
   */
  import { createEventDispatcher } from 'svelte';

  export let src: string | null = null;
  export let alt: string = 'Wine bottle';
  export let compact: boolean = false;
  export let clickable: boolean = false;

  const dispatch = createEventDispatcher<{ click: void }>();

  let hasError = false;

  function handleError() {
    hasError = true;
  }

  function handleClick() {
    if (clickable && src && !hasError) {
      dispatch('click');
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (clickable && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      handleClick();
    }
  }

  // Reset error state when src changes
  $: if (src) hasError = false;

  $: showPlaceholder = !src || hasError;
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_no_noninteractive_tabindex -->
<div
  class="wine-image-container"
  class:compact
  class:clickable
  on:click={handleClick}
  on:keydown={handleKeydown}
  role={clickable ? 'button' : undefined}
  tabindex={clickable ? 0 : undefined}
  aria-label={clickable ? `View ${alt} fullscreen` : undefined}
>
  {#if showPlaceholder}
    <div class="wine-image-placeholder">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 2h8l1 8c0 3.5-2.5 6-5 6s-5-2.5-5-6l1-8z"/>
        <line x1="12" y1="16" x2="12" y2="22"/>
        <line x1="8" y1="22" x2="16" y2="22"/>
      </svg>
    </div>
  {:else}
    <img
      class="wine-image"
      {src}
      {alt}
      on:error={handleError}
      loading="lazy"
    />
  {/if}
</div>

<style>
  .wine-image-container {
    flex-shrink: 0;
    width: 120px;
    height: 120px;
    border-radius: 4px;
    border: 1px solid var(--divider);
    overflow: hidden;
    background: var(--bg-subtle);
    transition: width 0.3s var(--ease-out), height 0.3s var(--ease-out), box-shadow 0.2s var(--ease-out);
  }

  .wine-image-container.clickable {
    cursor: zoom-in;
  }

  .wine-image-container.clickable:hover {
    box-shadow: var(--shadow-md);
  }

  .wine-image-container.clickable:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .wine-image-container.compact {
    width: 100%;
    height: auto;
    aspect-ratio: 1;
  }

  .wine-image-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
      135deg,
      var(--bg-subtle) 0%,
      var(--surface) 50%,
      var(--bg-subtle) 100%
    );
  }

  .wine-image-placeholder svg {
    width: 40px;
    height: 40px;
    stroke: var(--text-tertiary);
    stroke-width: 1.5;
    fill: none;
    opacity: 0.5;
  }

  .wine-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Mobile adjustments for compact view */
  @media (max-width: 479px) {
    .wine-image-placeholder svg {
      width: 32px;
      height: 32px;
    }
  }
</style>

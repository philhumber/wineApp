<!--
  ImageLightboxModal Component
  Fullscreen image viewer with dark backdrop

  Usage:
    modal.openImageLightbox('/path/to/image.jpg', 'Alt text')
-->
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { Icon } from '$lib/components';

  export let src: string;
  export let alt: string = 'Wine image';

  const dispatch = createEventDispatcher<{ close: void }>();

  let closeButton: HTMLButtonElement;

  onMount(() => {
    // Focus close button for keyboard accessibility
    closeButton?.focus();
  });

  function handleClose() {
    dispatch('close');
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleClose();
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_interactive_supports_focus -->
<div
  class="lightbox-overlay"
  on:click={handleBackdropClick}
  role="dialog"
  aria-modal="true"
  aria-label="Image viewer"
  tabindex="-1"
>
  <button
    type="button"
    class="lightbox-close"
    aria-label="Close image viewer"
    bind:this={closeButton}
    on:click={handleClose}
  >
    <Icon name="close" size={24} />
  </button>

  <div class="lightbox-content" on:click={handleClose}>
    <img
      class="lightbox-image"
      {src}
      {alt}
      loading="eager"
    />
  </div>
</div>

<style>
  .lightbox-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.92);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    animation: fadeIn 0.25s var(--ease-out);
    cursor: zoom-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .lightbox-close {
    position: fixed;
    top: var(--space-5);
    right: var(--space-5);
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1001;
    transition:
      background 0.2s var(--ease-out),
      border-color 0.2s var(--ease-out),
      transform 0.2s var(--ease-out);
  }

  .lightbox-close:hover {
    background: rgba(0, 0, 0, 0.7);
    border-color: rgba(255, 255, 255, 0.4);
    transform: scale(1.05);
  }

  .lightbox-close:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .lightbox-content {
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: zoom-out;
    animation: scaleIn 0.25s var(--ease-out);
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .lightbox-image {
    max-width: 100%;
    max-height: 90vh;
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
  }

  /* Mobile adjustments */
  @media (max-width: 767px) {
    .lightbox-overlay {
      padding: 0;
    }

    .lightbox-close {
      top: var(--space-3);
      right: var(--space-3);
    }

    .lightbox-content {
      max-width: 100%;
      max-height: 100vh;
      max-height: 100dvh;
    }

    .lightbox-image {
      border-radius: 0;
      max-height: 100vh;
      max-height: 100dvh;
    }
  }
</style>

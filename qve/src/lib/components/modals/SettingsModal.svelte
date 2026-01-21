<script lang="ts">
  /**
   * SettingsModal component
   * Modal for app settings: theme toggle and view density toggle
   */
  import { createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { Icon, ThemeToggle, ViewToggle } from '$lib/components';

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  function handleClose() {
    dispatch('close');
  }

  function handleBackdropClick() {
    handleClose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Backdrop -->
<div
  class="modal-backdrop"
  on:click={handleBackdropClick}
  on:keydown={handleKeydown}
  role="button"
  tabindex="-1"
  aria-label="Close settings"
  transition:fade={{ duration: 200 }}
></div>

<!-- Modal -->
<div
  class="modal"
  role="dialog"
  aria-labelledby="settings-title"
  aria-modal="true"
  transition:fly={{ y: 20, duration: 300 }}
>
  <div class="modal-header">
    <h2 id="settings-title" class="modal-title">Settings</h2>
    <button
      class="close-btn"
      on:click={handleClose}
      aria-label="Close settings"
    >
      <Icon name="close" size={20} />
    </button>
  </div>

  <div class="modal-body">
    <div class="setting-row">
      <div class="setting-info">
        <h3 class="setting-label">Theme</h3>
        <p class="setting-description">Switch between light and dark mode</p>
      </div>
      <ThemeToggle />
    </div>

    <div class="setting-row">
      <div class="setting-info">
        <h3 class="setting-label">View Density</h3>
        <p class="setting-description">Compact grid or detailed cards</p>
      </div>
      <ViewToggle />
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 200;
  }

  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 400px;
    background: var(--surface);
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
    z-index: 201;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-5) var(--space-6);
    border-bottom: 1px solid var(--divider-subtle);
  }

  .modal-title {
    font-family: var(--font-serif);
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--text-primary);
    margin: 0;
  }

  .close-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--text-tertiary);
    border-radius: 50%;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
  }

  .close-btn:hover {
    background: var(--bg-subtle);
    color: var(--text-primary);
  }

  .modal-body {
    padding: var(--space-4) var(--space-6) var(--space-6);
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) 0;
    border-bottom: 1px solid var(--divider-subtle);
  }

  .setting-row:last-child {
    border-bottom: none;
  }

  .setting-info {
    flex: 1;
    margin-right: var(--space-4);
  }

  .setting-label {
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-primary);
    margin: 0 0 var(--space-1) 0;
  }

  .setting-description {
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    color: var(--text-tertiary);
    margin: 0;
  }
</style>

<script lang="ts">
  /**
   * SideMenu component
   * Slide-out navigation drawer with backdrop overlay
   */
  import { createEventDispatcher } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { Icon } from '$lib/components';
  import { viewMode, modal } from '$lib/stores';

  export let open = false;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  function close() {
    dispatch('close');
  }

  function handleBackdropClick() {
    close();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      close();
    }
  }

  async function navigateTo(path: string, mode?: 'ourWines' | 'allWines') {
    if (mode) {
      viewMode.set(mode);
    }
    close();
    await goto(`${base}${path}`);
  }

  function openSettings() {
    close();
    modal.openSettings();
  }

  // Determine active state
  $: currentPath = $page.url.pathname;
  $: isHome = currentPath === `${base}/` || currentPath === base;
  $: isAdd = currentPath === `${base}/add`;
  $: isHistory = currentPath === `${base}/history`;
  $: isCellar = isHome && $viewMode === 'ourWines';
  $: isAllWines = isHome && $viewMode === 'allWines';
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <!-- Backdrop overlay -->
  <div
    class="menu-backdrop"
    on:click={handleBackdropClick}
    on:keydown={handleKeydown}
    role="button"
    tabindex="-1"
    aria-label="Close menu"
    transition:fade={{ duration: 200 }}
  ></div>

  <!-- Slide-out drawer -->
  <nav
    class="side-menu"
    transition:fly={{ x: -300, duration: 300 }}
    role="navigation"
    aria-label="Main navigation"
  >
    <div class="menu-header">
      <span class="menu-title">Qvé</span>
      <button
        class="close-btn"
        on:click={close}
        aria-label="Close menu"
      >
        <Icon name="close" size={20} />
      </button>
    </div>

    <ul class="menu-items">
      <li>
        <a
          href="{base}/"
          class="menu-item"
          class:active={isCellar}
          on:click|preventDefault={() => navigateTo('/', 'ourWines')}
        >
          <Icon name="wine-bottle" size={20} />
          <span>Cellar</span>
        </a>
      </li>
      <li>
        <a
          href="{base}/add"
          class="menu-item"
          class:active={isAdd}
          on:click|preventDefault={() => navigateTo('/add')}
        >
          <Icon name="plus" size={20} />
          <span>Add Wine</span>
        </a>
      </li>
      <li>
        <a
          href="{base}/history"
          class="menu-item"
          class:active={isHistory}
          on:click|preventDefault={() => navigateTo('/history')}
        >
          <Icon name="history" size={20} />
          <span>History</span>
        </a>
      </li>
      <li>
        <button
          class="menu-item"
          on:click={openSettings}
        >
          <Icon name="settings" size={20} />
          <span>Settings</span>
        </button>
      </li>
      <li>
        <a
          href="{base}/"
          class="menu-item"
          class:active={isAllWines}
          on:click|preventDefault={() => navigateTo('/', 'allWines')}
        >
          <Icon name="grid" size={20} />
          <span>All Wines</span>
        </a>
      </li>
    </ul>

    <div class="menu-footer">
      <p class="menu-version">Wine Collection</p>
    </div>
  </nav>
{/if}

<style>
  /* Backdrop overlay */
  .menu-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 150;
    cursor: pointer;
  }

  /* Slide-out drawer */
  .side-menu {
    position: fixed;
    top: 0;
    left: 0;
    width: 280px;
    height: 100vh;
    background: var(--surface);
    box-shadow: var(--shadow-lg);
    z-index: 151;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Menu header */
  .menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-6);
    border-bottom: 1px solid var(--divider-subtle);
  }

  .menu-title {
    font-family: var(--font-serif);
    font-size: 1.5rem;
    font-weight: 500;
    color: var(--text-primary);
    letter-spacing: 0.02em;
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

  /* Menu items */
  .menu-items {
    list-style: none;
    margin: 0;
    padding: var(--space-4) 0;
    flex: 1;
  }

  .menu-items li {
    margin: 0;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    width: 100%;
    padding: var(--space-4) var(--space-6);
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
    text-align: left;
  }

  .menu-item:hover {
    background: var(--bg-subtle);
    color: var(--text-primary);
  }

  .menu-item.active {
    background: var(--bg-subtle);
    color: var(--text-primary);
    border-left: 3px solid var(--accent);
    padding-left: calc(var(--space-6) - 3px);
  }

  /* Menu footer */
  .menu-footer {
    padding: var(--space-4) var(--space-6);
    border-top: 1px solid var(--divider-subtle);
  }

  .menu-version {
    font-family: var(--font-sans);
    font-size: 0.75rem;
    color: var(--text-tertiary);
    margin: 0;
  }

  /* Mobile adjustments */
  @media (max-width: 320px) {
    .side-menu {
      width: 100%;
    }
  }
</style>

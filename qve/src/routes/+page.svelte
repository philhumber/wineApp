<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { theme, viewDensity, viewMode } from '$stores';
  import { api } from '$api';

  // Import Wave 1 components
  import { Icon, ThemeToggle, ViewToggle, RatingDisplay, BottleIndicators } from '$lib/components';

  let wineCount = 0;
  let loading = true;
  let error: string | null = null;

  onMount(async () => {
    try {
      const wines = await api.getWines({ bottleCount: '1' });
      wineCount = wines.length;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to connect to API';
      console.error('API Error:', e);
    } finally {
      loading = false;
    }
  });
</script>

<main class="placeholder-page">
  <header class="page-header">
    <h1 class="logo">Qve</h1>
    <p class="tagline">Wine Collection</p>
  </header>

  <section class="status-section">
    <h2 class="section-title">Phase 1: Foundation Status</h2>

    <div class="status-grid">
      <div class="status-card">
        <span class="status-label">API Connection</span>
        <span class="status-value" class:loading class:error={!!error}>
          {#if loading}
            Connecting...
          {:else if error}
            Error: {error}
          {:else}
            Connected - {wineCount} wines
          {/if}
        </span>
      </div>

      <div class="status-card">
        <span class="status-label">Theme</span>
        <span class="status-value">{$theme}</span>
        <div class="component-demo">
          <ThemeToggle />
        </div>
      </div>

      <div class="status-card">
        <span class="status-label">View Density</span>
        <span class="status-value">{$viewDensity}</span>
        <div class="component-demo">
          <ViewToggle />
        </div>
      </div>

      <div class="status-card">
        <span class="status-label">View Mode</span>
        <span class="status-value">{$viewMode}</span>
      </div>
    </div>
  </section>

  <section class="components-section">
    <h2 class="section-title">Wave 1 Components</h2>

    <div class="component-grid">
      <div class="component-card">
        <span class="component-name">Icon</span>
        <div class="icon-showcase">
          <Icon name="sun" size={18} />
          <Icon name="moon" size={18} />
          <Icon name="grid" size={18} />
          <Icon name="list" size={18} />
          <Icon name="search" size={18} />
          <Icon name="menu" size={18} />
          <Icon name="plus" size={18} />
          <Icon name="edit" size={18} />
          <Icon name="drink" size={18} />
          <Icon name="wine-bottle" size={18} />
          <Icon name="check" size={18} />
          <Icon name="x" size={18} />
        </div>
      </div>

      <div class="component-card">
        <span class="component-name">RatingDisplay</span>
        <div class="rating-showcase">
          <RatingDisplay rating={8.5} />
          <RatingDisplay rating={9.2} />
          <RatingDisplay rating={null} />
          <RatingDisplay rating={7.0} compact={true} />
        </div>
      </div>

      <div class="component-card">
        <span class="component-name">BottleIndicators</span>
        <div class="bottle-showcase">
          <BottleIndicators count={3} />
          <BottleIndicators count={1} />
          <BottleIndicators count={5} compact={true} />
        </div>
      </div>
    </div>
  </section>

  <section class="nav-section">
    <h2 class="section-title">Placeholder Routes</h2>

    <nav class="route-list">
      <a href="{base}/add" class="route-link">
        <span class="route-name">/add</span>
        <span class="route-desc">Add Wine (Phase 2)</span>
      </a>
      <a href="{base}/history" class="route-link">
        <span class="route-name">/history</span>
        <span class="route-desc">Drink History (Phase 2)</span>
      </a>
      <a href="{base}/edit/1" class="route-link">
        <span class="route-name">/edit/[id]</span>
        <span class="route-desc">Edit Wine (Phase 2)</span>
      </a>
      <a href="{base}/drink/1" class="route-link">
        <span class="route-name">/drink/[id]</span>
        <span class="route-desc">Drink & Rate (Phase 2)</span>
      </a>
    </nav>
  </section>

  <footer class="page-footer">
    <p>Qvé Phase 2 Wave 1 - Foundation Components</p>
    <p class="subtle">Run <code>npm run dev</code> to start</p>
  </footer>
</main>

<style>
  .placeholder-page {
    max-width: 800px;
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
    min-height: 100vh;
  }

  .page-header {
    text-align: center;
    margin-bottom: var(--space-8);
  }

  .logo {
    font-family: var(--font-serif);
    font-size: 4rem;
    font-weight: 400;
    letter-spacing: 0.04em;
    color: var(--text-primary);
    margin: 0;
  }

  .tagline {
    font-family: var(--font-sans);
    font-size: 0.875rem;
    font-weight: 300;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    margin-top: var(--space-2);
  }

  .status-section,
  .nav-section {
    margin-bottom: var(--space-8);
  }

  .section-title {
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    margin-bottom: var(--space-4);
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--divider);
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4);
  }

  @media (max-width: 600px) {
    .status-grid {
      grid-template-columns: 1fr;
    }
  }

  .status-card {
    background: var(--surface);
    border: 1px solid var(--divider);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .status-label {
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-tertiary);
  }

  .status-value {
    font-size: 1rem;
    color: var(--text-secondary);
  }

  .status-value.loading {
    color: var(--text-tertiary);
  }

  .status-value.error {
    color: var(--error);
    font-size: 0.875rem;
  }

  .route-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .route-link {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4);
    background: var(--surface);
    border: 1px solid var(--divider);
    border-radius: var(--radius-md);
    transition: all 0.2s var(--ease-out);
  }

  .route-link:hover {
    border-color: var(--accent);
    transform: translateX(4px);
  }

  .route-name {
    font-family: monospace;
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  .route-desc {
    font-size: 0.8125rem;
    color: var(--text-tertiary);
  }

  .page-footer {
    text-align: center;
    padding-top: var(--space-8);
    border-top: 1px solid var(--divider);
    color: var(--text-tertiary);
    font-size: 0.875rem;
  }

  .page-footer .subtle {
    margin-top: var(--space-2);
    font-size: 0.8125rem;
  }

  .page-footer code {
    background: var(--bg-subtle);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
  }

  /* Component demo in status cards */
  .component-demo {
    margin-top: var(--space-2);
  }

  /* Component showcase section */
  .components-section {
    margin-bottom: var(--space-8);
  }

  .component-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--space-4);
  }

  .component-card {
    background: var(--surface);
    border: 1px solid var(--divider);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .component-name {
    font-family: monospace;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .icon-showcase {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    color: var(--text-secondary);
  }

  .rating-showcase {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .bottle-showcase {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
</style>

<!--
  CellarValueModal Component (WIN-127 Phase 2)
  Self-fetching modal showing cellar value over time.
  Bottom-sheet on mobile, centered card on desktop.
-->
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { browser } from '$app/environment';
  import { api } from '$lib/api';
  import type { CellarValueHistoryPoint } from '$lib/api/types';
  import { currentCurrency, convertFromEUR } from '$lib/stores/currency';
  import type { Currency } from '$lib/api/types';
  import CellarValueChart from './CellarValueChart.svelte';

  const dispatch = createEventDispatcher<{ close: void }>();

  // ─── State ───
  let loading = true;
  let error: string | null = null;
  let historyData: CellarValueHistoryPoint[] = [];
  let currentValueEUR = 0;
  let currentBottleCount = 0;
  let selectedRange: 'All' | '1Y' | '6M' | '3M' = 'All';
  let closeButton: HTMLButtonElement;
  let isMobile = false;

  // ─── Lifecycle ───
  onMount(async () => {
    if (browser) {
      isMobile = window.matchMedia('(max-width: 480px)').matches;
    }
    try {
      // Sequential fetches — PHP dev server is single-threaded,
      // concurrent requests via Promise.all can deadlock
      const current = await api.getCellarValue();
      const history = await api.getCellarValueHistory();
      currentValueEUR = current.totalValueEUR;
      currentBottleCount = current.bottleCount;
      historyData = history;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load data';
    } finally {
      loading = false;
    }
    closeButton?.focus();
  });

  // ─── Keyboard ───
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') dispatch('close');
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) dispatch('close');
  }

  // ─── Date range filtering ───
  const RANGES: ('All' | '1Y' | '6M' | '3M')[] = ['All', '1Y', '6M', '3M'];

  function filterByRange(data: CellarValueHistoryPoint[], range: typeof selectedRange): CellarValueHistoryPoint[] {
    if (range === 'All' || data.length === 0) return data;

    const cutoff = new Date();
    if (range === '1Y') cutoff.setFullYear(cutoff.getFullYear() - 1);
    else if (range === '6M') cutoff.setMonth(cutoff.getMonth() - 6);
    else cutoff.setMonth(cutoff.getMonth() - 3);

    const cutoffStr = cutoff.toISOString().split('T')[0];
    return data.filter(p => p.date >= cutoffStr);
  }

  $: filteredData = filterByRange(historyData, selectedRange);

  // ─── Currency conversion ───
  $: displayData = filteredData.map(p => ({
    date: p.date,
    displayValue: convertFromEUR(p.totalValueEUR, $currentCurrency),
    bottleCount: p.bottleCount
  }));

  // ─── Hero value (current cellar value, full formatted) ───
  function formatHeroValue(eurValue: number, currency: Currency): string {
    const converted = convertFromEUR(eurValue, currency);
    const formatted = new Intl.NumberFormat('en-GB', {
      maximumFractionDigits: 0
    }).format(Math.round(converted));
    return `${currency.symbol}${formatted}`;
  }

  $: heroValue = formatHeroValue(currentValueEUR, $currentCurrency);

  // ─── Compact value formatter for tooltip / stats ───
  function formatDisplayValue(v: number): string {
    const formatted = new Intl.NumberFormat('en-GB', {
      maximumFractionDigits: 0
    }).format(Math.round(v));
    return `${$currentCurrency.symbol}${formatted}`;
  }

  // ─── Summary stats (scoped to visible range) ───
  function computeSummary(pts: typeof displayData) {
    if (pts.length === 0) return null;

    const values = pts.map(p => p.displayValue);
    const high = Math.max(...values);
    const low = Math.min(...values) < 0 ? 0: Math.min(...values);
    const first = values[0];
    const last = values[values.length - 1];
    const change = last - first;
    const changePercent = first !== 0 ? Math.round((change / Math.abs(first)) * 100) : 0;

    return { high, low, change, changePercent };
  }

  $: summary = computeSummary(displayData);
</script>

<svelte:window on:keydown={handleKeyDown} />

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  class="cellar-value-backdrop"
  on:click={handleBackdropClick}
  transition:fade={{ duration: 200 }}
></div>

<div
  class="cellar-value-modal"
  role="dialog"
  aria-modal="true"
  aria-labelledby="cellar-value-title"
  transition:fly={{ y: isMobile ? 300 : 20, duration: 300 }}
>
    <!-- Close button -->
    <button
      bind:this={closeButton}
      class="close-btn"
      on:click={() => dispatch('close')}
      aria-label="Close"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>

    {#if loading}
      <!-- Loading shimmer -->
      <div class="modal-body">
        <div class="shimmer-label animate-shimmer"></div>
        <div class="shimmer-hero animate-shimmer"></div>
        <div class="shimmer-subtitle animate-shimmer"></div>
        <div class="shimmer-chart animate-shimmer"></div>
      </div>
    {:else if error}
      <!-- Error state -->
      <div class="modal-body error-body">
        <p class="error-message">{error}</p>
        <button class="retry-btn" on:click={() => dispatch('close')}>Close</button>
      </div>
    {:else}
      <div class="modal-body">
        <!-- Section 1: Hero value -->
        <div class="hero-section">
          <span class="hero-label" id="cellar-value-title">OVERALL CELLAR VALUE</span>
          <span class="hero-value">{heroValue}</span>
          <span class="hero-subtitle">{currentBottleCount} {currentBottleCount === 1 ? 'bottle' : 'bottles'} in cellar</span>
        </div>

        <!-- Section 2: Range selector -->
        <div class="range-selector" role="group" aria-label="Date range">
          {#each RANGES as range}
            <button
              class:active={selectedRange === range}
              on:click={() => selectedRange = range}
              aria-pressed={selectedRange === range}
            >{range}</button>
          {/each}
        </div>

        <!-- Section 3: Chart -->
        {#if displayData.length === 0}
          <div class="empty-state">
            <svg class="empty-icon" width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path d="M20 6h8l2 8h-12l2-8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M14 14h20l-3 24c-.2 1.7-1.6 3-3.3 3H20.3c-1.7 0-3.1-1.3-3.3-3L14 14z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M20 22v10M28 22v10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span class="empty-title">No history yet</span>
            <span class="empty-subtitle">Value tracking begins when you add your first bottle</span>
          </div>
        {:else}
          <CellarValueChart
            data={displayData}
            currencySymbol={$currentCurrency.symbol}
            formatValue={formatDisplayValue}
          />
        {/if}

        <!-- Section 4: Summary stats -->
        {#if summary && displayData.length > 1}
          <div class="summary-stats" aria-live="polite" aria-atomic="true">
            <div class="stat-row">
              <span>High: <strong>{formatDisplayValue(summary.high)}</strong></span>
              <span class="stat-dot">&middot;</span>
              <span>Low: <strong>{formatDisplayValue(summary.low)}</strong></span>
            </div>
            <div class="stat-row">
              <span>Change: <strong class:positive={summary.change >= 0} class:negative={summary.change < 0}>
                {summary.change >= 0 ? '' : ''}{formatDisplayValue(summary.change)} ({summary.change >= 0 ? '' : ''}{summary.changePercent.toLocaleString('en-GB', { maximumFractionDigits: 0 })}%)
              </strong></span>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

<style>
  /* ─── Backdrop ─── */
  .cellar-value-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(45, 41, 38, 0.6);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 1000;
  }

  :global([data-theme='dark']) .cellar-value-backdrop {
    background: rgba(12, 11, 10, 0.8);
  }

  /* ─── Modal card (desktop) ─── */
  .cellar-value-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    width: 90%;
    max-width: 560px;
    max-height: 80vh;
    overflow-y: auto;
    z-index: 1001;
  }

  /* ─── Mobile: bottom sheet ─── */
  @media (max-width: 480px) {
    .cellar-value-modal {
      top: auto;
      left: 0;
      right: 0;
      bottom: 0;
      transform: none;
      width: 100%;
      max-width: none;
      border-radius: 12px 12px 0 0;
      max-height: 85vh;
      padding-bottom: env(safe-area-inset-bottom);
    }
  }

  /* ─── Close button ─── */
  .close-btn {
    position: absolute;
    top: var(--space-4);
    right: var(--space-4);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-tertiary);
    border-radius: 50%;
    transition: all 0.2s var(--ease-out);
    z-index: 2;
  }

  .close-btn:hover {
    color: var(--text-primary);
    background: var(--bg-subtle);
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* ─── Modal body ─── */
  .modal-body {
    padding: var(--space-6);
  }

  @media (max-width: 480px) {
    .modal-body {
      padding: var(--space-5) var(--space-4);
    }
  }

  /* ─── Hero section ─── */
  .hero-section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-bottom: var(--space-5);
  }

  .hero-label {
    font-family: var(--font-sans);
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--text-tertiary);
    margin-bottom: var(--space-1);
  }

  .hero-value {
    font-family: var(--font-serif);
    font-size: 2.5rem;
    font-weight: 300;
    color: var(--text-primary);
    letter-spacing: 0.02em;
    line-height: 1.1;
  }

  @media (max-width: 480px) {
    .hero-value {
      font-size: 2rem;
    }
  }

  .hero-subtitle {
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    color: var(--text-tertiary);
    margin-top: var(--space-1);
  }

  /* ─── Range selector ─── */
  .range-selector {
    display: flex;
    background: var(--bg-subtle);
    border-radius: var(--radius-sm);
    padding: 2px;
    margin-bottom: var(--space-4);
    width: fit-content;
  }

  .range-selector button {
    padding: 4px 12px;
    font-family: var(--font-sans);
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border: none;
    background: transparent;
    color: var(--text-tertiary);
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.2s var(--ease-out);
    white-space: nowrap;
  }

  .range-selector button.active {
    background: var(--surface);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
  }

  .range-selector button:hover:not(.active) {
    color: var(--text-secondary);
  }

  .range-selector button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
    border-radius: 3px;
  }

  /* ─── Summary stats ─── */
  .summary-stats {
    border-top: 1px solid var(--divider-subtle);
    padding-top: var(--space-4);
    margin-top: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .stat-row {
    font-family: var(--font-sans);
    font-size: 0.75rem;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .stat-dot {
    color: var(--text-tertiary);
  }

  .stat-row strong {
    font-weight: 600;
    color: var(--text-primary);
  }

  .stat-row strong.positive {
    color: var(--success);
  }

  .stat-row strong.negative {
    color: var(--error);
  }

  /* ─── Loading shimmer ─── */
  .shimmer-label {
    width: 100px;
    height: 10px;
    border-radius: var(--radius-sm);
    margin-bottom: var(--space-2);
  }

  .shimmer-hero {
    width: 200px;
    height: 36px;
    border-radius: var(--radius-sm);
    margin-bottom: var(--space-2);
  }

  .shimmer-subtitle {
    width: 140px;
    height: 12px;
    border-radius: var(--radius-sm);
    margin-bottom: var(--space-6);
  }

  .shimmer-chart {
    width: 100%;
    height: 160px;
    border-radius: var(--radius-md);
  }

  @media (min-width: 481px) {
    .shimmer-chart {
      height: 200px;
    }
  }

  /* ─── Empty state ─── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-8) 0;
    text-align: center;
  }

  .empty-icon {
    color: var(--text-tertiary);
    opacity: 0.3;
    margin-bottom: var(--space-4);
  }

  .empty-title {
    font-family: var(--font-serif);
    font-size: 1rem;
    color: var(--text-secondary);
    margin-bottom: var(--space-1);
  }

  .empty-subtitle {
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    color: var(--text-tertiary);
    max-width: 240px;
  }

  /* ─── Error state ─── */
  .error-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-8) var(--space-6);
  }

  .error-message {
    font-family: var(--font-sans);
    font-size: 0.875rem;
    color: var(--error);
    text-align: center;
  }

  .retry-btn {
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: var(--space-2) var(--space-5);
    border: 1px solid var(--divider);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s var(--ease-out);
  }

  .retry-btn:hover {
    border-color: var(--text-tertiary);
    color: var(--text-primary);
  }
</style>

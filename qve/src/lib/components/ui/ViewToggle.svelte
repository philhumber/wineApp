<script lang="ts">
  /**
   * View density toggle (compact grid / medium list)
   * Uses the viewDensity store for state management
   */
  import { viewDensity } from '$lib/stores';
  import Icon from './Icon.svelte';

  function setView(view: 'compact' | 'medium') {
    viewDensity.set(view);
  }
</script>

<div class="view-toggle" role="group" aria-label="View density">
  <button
    class="view-btn"
    class:active={$viewDensity === 'compact'}
    data-view="compact"
    on:click={() => setView('compact')}
    title="Grid view"
    aria-pressed={$viewDensity === 'compact'}
  >
    <Icon name="grid" size={16} />
  </button>
  <button
    class="view-btn"
    class:active={$viewDensity === 'medium'}
    data-view="medium"
    on:click={() => setView('medium')}
    title="List view"
    aria-pressed={$viewDensity === 'medium'}
  >
    <Icon name="list" size={16} />
  </button>
</div>

<style>
  .view-toggle {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px;
    background: var(--bg-subtle);
    border-radius: 10px;
    border: 1px solid var(--divider);
  }

  .view-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s var(--ease-out);
  }

  .view-btn :global(svg) {
    color: var(--text-tertiary);
    transition: all 0.2s var(--ease-out);
  }

  .view-btn:hover {
    background: var(--surface);
  }

  .view-btn:hover :global(svg) {
    color: var(--text-secondary);
  }

  .view-btn.active {
    background: var(--surface);
    box-shadow: var(--shadow-sm);
  }

  .view-btn.active :global(svg) {
    color: var(--text-primary);
  }
</style>

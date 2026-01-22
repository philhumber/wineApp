<script lang="ts">
  import { page } from '$app/stores';
  import { base } from '$app/paths';
</script>

<svelte:head>
  <title>Drink & Rate | Qvé</title>
</svelte:head>

<main class="placeholder">
  <h1>Drink & Rate</h1>
  <p class="subtitle">Wine ID: {$page.params.id}</p>
  <p class="phase">Phase 2 - Coming Soon</p>

  <div class="info">
    <p>This page will contain:</p>
    <ul>
      <li>Bottle selector dropdown</li>
      <li>10-point rating scale (overall + value)</li>
      <li>Drink date picker</li>
      <li>Tasting notes text area</li>
      <li>Buy again toggle</li>
    </ul>
  </div>

  <div class="rating-preview">
    <p class="preview-label">Rating Preview (10-dot scale)</p>
    <div class="dots">
      {#each Array(10) as _, i}
        <span class="dot" class:filled={i < 7}></span>
      {/each}
    </div>
  </div>

  <a href="{base}/" class="back-link">Back to Home</a>
</main>

<style>
  .placeholder {
    max-width: 600px;
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
    text-align: center;
  }

  h1 {
    font-family: var(--font-serif);
    font-size: 2.5rem;
    font-weight: 400;
    color: var(--text-primary);
    margin-bottom: var(--space-2);
  }

  .subtitle {
    font-family: monospace;
    color: var(--text-secondary);
    margin-bottom: var(--space-2);
  }

  .phase {
    color: var(--text-tertiary);
    margin-bottom: var(--space-6);
  }

  .info {
    text-align: left;
    background: var(--surface);
    border: 1px solid var(--divider);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    margin-bottom: var(--space-6);
  }

  .info p {
    color: var(--text-secondary);
    margin-bottom: var(--space-3);
  }

  .info ul {
    list-style: disc inside;
    color: var(--text-tertiary);
  }

  .info li {
    padding: var(--space-2) 0;
  }

  .rating-preview {
    background: var(--surface);
    border: 1px solid var(--divider);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    margin-bottom: var(--space-6);
  }

  .preview-label {
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-tertiary);
    margin-bottom: var(--space-3);
  }

  .dots {
    display: flex;
    justify-content: center;
    gap: var(--space-2);
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1.5px solid var(--divider);
    background: transparent;
    transition: all 0.2s var(--ease-out);
  }

  .dot.filled {
    background: var(--rating-wine);
    border-color: var(--rating-wine);
  }

  .back-link {
    display: inline-block;
    padding: var(--space-3) var(--space-5);
    background: var(--text-primary);
    color: var(--bg);
    border-radius: var(--radius-pill);
    font-size: 0.875rem;
    transition: all 0.2s var(--ease-out);
  }

  .back-link:hover {
    background: var(--accent);
  }
</style>

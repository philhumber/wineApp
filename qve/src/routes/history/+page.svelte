<script lang="ts">
  import { base } from '$app/paths';
</script>

<main class="placeholder">
  <h1>Drink History</h1>
  <p class="subtitle">Phase 2 - Coming Soon</p>

  <div class="info">
    <p>This page will show:</p>
    <ul>
      <li>List of consumed wines with ratings</li>
      <li>Date drunk, overall rating, value rating</li>
      <li>Tasting notes and buy-again status</li>
      <li>Sorting and filtering options</li>
    </ul>
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

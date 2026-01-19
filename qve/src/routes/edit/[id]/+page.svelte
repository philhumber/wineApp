<script lang="ts">
  import { page } from '$app/stores';
  import { base } from '$app/paths';
</script>

<main class="placeholder">
  <h1>Edit Wine</h1>
  <p class="subtitle">Wine ID: {$page.params.id}</p>
  <p class="phase">Phase 2 - Coming Soon</p>

  <div class="info">
    <p>This page will contain:</p>
    <ul>
      <li>Two-tab form (Wine Details / Bottle Details)</li>
      <li>Edit wine name, year, type, description</li>
      <li>Edit tasting notes, pairing suggestions</li>
      <li>Update or replace wine image</li>
      <li>Edit bottle location, price, purchase date</li>
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

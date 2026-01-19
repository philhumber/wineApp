<script lang="ts">
  import { base } from '$app/paths';
</script>

<main class="placeholder">
  <h1>Add Wine</h1>
  <p class="subtitle">Phase 2 - Coming Soon</p>

  <div class="info">
    <p>This page will contain the 4-step Add Wine wizard:</p>
    <ol>
      <li>Region (search existing or create new)</li>
      <li>Producer (search existing or create new)</li>
      <li>Wine (details + AI generation + image upload)</li>
      <li>Bottle (size, location, source, price)</li>
    </ol>
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

  .info ol {
    list-style: decimal inside;
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

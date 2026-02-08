<script lang="ts">
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { dev } from '$app/environment';
</script>

<svelte:head>
  <title>Error {$page.status} | Qvé</title>
</svelte:head>

<main class="error-page">
  <div class="error-content">
    <span class="error-code">{$page.status}</span>
    <h1 class="error-title">
      {#if $page.status === 404}
        Page not found
      {:else if $page.status === 500}
        Something went wrong
      {:else}
        An error occurred
      {/if}
    </h1>
    <p class="error-message">
      {#if $page.status === 404}
        The page you're looking for doesn't exist or has been moved.
      {:else}
        {$page.error?.message || 'An unexpected error occurred.'}
      {/if}
    </p>

    <a href="{base}/" class="home-link">Back to Cellar</a>

    {#if dev && $page.error?.message}
      <details class="error-details">
        <summary>Technical Details</summary>
        <pre>{$page.error.message}</pre>
      </details>
    {/if}
  </div>
</main>

<style>
  .error-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 80vh;
    padding: var(--space-6);
    text-align: center;
  }

  .error-content {
    max-width: 420px;
  }

  .error-code {
    display: block;
    font-family: var(--font-serif);
    font-size: 5rem;
    font-weight: 300;
    color: var(--accent-muted);
    line-height: 1;
    margin-bottom: var(--space-2);
  }

  .error-title {
    font-family: var(--font-serif);
    font-size: 1.5rem;
    font-weight: 400;
    color: var(--text-primary);
    margin-bottom: var(--space-3);
  }

  .error-message {
    font-size: 0.9375rem;
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: var(--space-6);
  }

  .home-link {
    display: inline-block;
    padding: var(--space-3) var(--space-5);
    background: var(--text-primary);
    color: var(--bg);
    border-radius: var(--radius-pill);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition: background 0.2s var(--ease-out);
  }

  .home-link:hover {
    background: var(--accent);
  }

  .error-details {
    margin-top: var(--space-6);
    text-align: left;
    background: var(--bg-subtle);
    border: 1px solid var(--divider);
    border-radius: var(--radius-md);
    padding: var(--space-4);
  }

  .error-details summary {
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-tertiary);
    cursor: pointer;
    margin-bottom: var(--space-3);
  }

  .error-details pre {
    font-size: 0.8125rem;
    color: var(--error);
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
  }
</style>

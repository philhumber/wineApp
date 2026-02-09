<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { auth, isAuthenticated, isAuthChecking } from '$stores';
  import { theme } from '$stores';

  let password = '';
  let passwordInput: HTMLInputElement;
  let errorMessage = '';
  let showShake = false;
  let isLockedOut = false;

  onMount(() => {
    theme.initialize();
    passwordInput?.focus();

    // If already authenticated, redirect home
    if ($isAuthenticated) {
      goto(`${base}/`);
    }
  });

  async function handleSubmit() {
    if (!password || $isAuthChecking || isLockedOut) return;

    errorMessage = '';
    const success = await auth.login(password);

    if (success) {
      // Redirect to original destination or home
      const redirect = $page.url.searchParams.get('redirect');
      const destination = (redirect && redirect.startsWith(`${base}/`) && !redirect.includes('://'))
        ? redirect
        : `${base}/`;
      goto(destination);
    } else {
      // Read error from store
      const storeState = $auth;
      errorMessage = storeState.error || 'Invalid password';

      // Check if rate limited
      if (errorMessage.includes('Too many attempts')) {
        isLockedOut = true;
      }

      // Trigger shake (not on lockout)
      if (!isLockedOut) {
        showShake = true;
        password = '';
        setTimeout(() => {
          showShake = false;
          passwordInput?.focus();
        }, 400);
      }
    }
  }
</script>

<svelte:head>
  <title>Sign In — Qvé</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="login-page">
  <div class="login-container">
    <!-- Wordmark -->
    <h1 class="login-wordmark">Qvé</h1>

    <!-- Decorative rule -->
    <div class="login-rule" aria-hidden="true"></div>

    <!-- Form -->
    <form
      class="login-form"
      class:shake={showShake}
      on:submit|preventDefault={handleSubmit}
    >
      <label for="password" class="sr-only">Password</label>
      <input
        id="password"
        type="password"
        autocomplete="current-password"
        placeholder="Password"
        bind:value={password}
        bind:this={passwordInput}
        disabled={$isAuthChecking || isLockedOut}
        required
      />

      <button
        type="submit"
        class="login-button"
        disabled={$isAuthChecking || !password || isLockedOut}
      >
        {#if $isAuthChecking}
          <span class="login-dots" aria-label="Signing in"></span>
        {:else}
          Enter
        {/if}
      </button>

      {#if errorMessage}
        <p class="login-error" role="alert" aria-live="polite">
          {errorMessage}
        </p>
      {/if}
    </form>
  </div>
</div>

<style>
  /* ─── Page Layout ─── */

  .login-page {
    min-height: 100dvh;
    min-height: 100vh; /* fallback */
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
  }

  .login-container {
    max-width: 320px;
    width: 100%;
    padding: 0 var(--space-5);
    text-align: center;
  }

  /* ─── Wordmark ─── */

  .login-wordmark {
    font-family: var(--font-serif);
    font-size: 3.5rem;
    font-weight: 300;
    letter-spacing: 0.06em;
    color: var(--text-primary);
    margin: 0 0 var(--space-4);
    opacity: 0;
    animation: loginReveal 0.6s var(--ease-out, ease-out) 0s forwards;
    --reveal-distance: 12px;
  }

  /* ─── Decorative Rule ─── */

  .login-rule {
    width: 40px;
    height: 1px;
    background: var(--accent-subtle);
    margin: 0 auto var(--space-6);
    opacity: 0;
    transform-origin: center;
    animation: ruleExpand 0.5s var(--ease-out, ease-out) 0.2s forwards;
  }

  /* ─── Form ─── */

  .login-form {
    opacity: 0;
    animation: loginReveal 0.7s var(--ease-out, ease-out) 0.5s forwards;
    --reveal-distance: 16px;
  }

  /* ─── Input ─── */

  .login-page input[type="password"] {
    width: 100%;
    padding: var(--space-3) var(--space-4);
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    color: var(--text-primary);
    background: var(--bg-subtle);
    border: 1px solid var(--divider);
    border-radius: var(--radius-md);
    outline: none;
    transition: border-color 0.2s var(--ease-out, ease-out),
                background 0.2s var(--ease-out, ease-out),
                box-shadow 0.2s var(--ease-out, ease-out);
    box-sizing: border-box;
  }

  .login-page input[type="password"]:focus {
    border-color: var(--accent);
    background: var(--surface);
    box-shadow: 0 0 0 3px rgba(166, 155, 138, 0.15);
  }

  .login-page input[type="password"]::placeholder {
    color: var(--text-tertiary);
  }

  .login-page input[type="password"]:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ─── Button ─── */

  .login-button {
    width: 100%;
    padding: var(--space-3) var(--space-5);
    margin-top: var(--space-3);
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--bg);
    background: var(--text-primary);
    border: 1px solid var(--text-primary);
    border-radius: var(--radius-pill);
    cursor: pointer;
    transition: background 0.2s var(--ease-out, ease-out),
                border-color 0.2s var(--ease-out, ease-out),
                opacity 0.2s var(--ease-out, ease-out);
  }

  .login-button:hover:not(:disabled) {
    background: var(--text-secondary);
    border-color: var(--text-secondary);
  }

  .login-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .login-button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* ─── Loading Dots ─── */

  .login-dots::after {
    content: '···';
    letter-spacing: 0.3em;
    animation: pulse 1.2s ease-in-out infinite;
  }

  /* ─── Error Message ─── */

  .login-error {
    color: var(--error);
    font-family: var(--font-sans);
    font-size: 0.8125rem;
    text-align: center;
    margin-top: var(--space-3);
    opacity: 0;
    animation: loginReveal 0.3s var(--ease-out, ease-out) forwards;
    --reveal-distance: 4px;
  }

  /* ─── Animations ─── */

  @keyframes loginReveal {
    from {
      opacity: 0;
      transform: translateY(var(--reveal-distance, 12px));
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes ruleExpand {
    from {
      transform: scaleX(0);
      opacity: 0;
    }
    to {
      transform: scaleX(1);
      opacity: 1;
    }
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    15%, 45%, 75% { transform: translateX(-6px); }
    30%, 60%, 90% { transform: translateX(6px); }
  }

  .login-form.shake {
    animation: shake 0.4s ease-in-out;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* ─── Screen-reader only ─── */

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  /* ─── Responsive ─── */

  @media (max-width: 480px) {
    .login-wordmark {
      font-size: 2.75rem;
    }
    .login-rule {
      width: 32px;
    }
  }

  /* ─── Reduced Motion ─── */

  @media (prefers-reduced-motion: reduce) {
    .login-wordmark,
    .login-rule,
    .login-form,
    .login-error {
      animation: none;
      opacity: 1;
      transform: none;
    }
    .login-form.shake {
      animation: none;
    }
    .login-dots::after {
      animation: none;
    }
  }
</style>

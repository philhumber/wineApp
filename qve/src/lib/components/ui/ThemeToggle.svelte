<script lang="ts">
  /**
   * Theme toggle button with sun/moon crossfade animation
   * Uses the theme store for state management
   */
  import { theme } from '$lib/stores';
  import Icon from './Icon.svelte';
</script>

<button
  class="theme-toggle"
  on:click={theme.toggle}
  title="Toggle theme"
  aria-label="Toggle between light and dark theme"
>
  <span class="icon-sun">
    <Icon name="sun" size={18} />
  </span>
  <span class="icon-moon">
    <Icon name="moon" size={18} />
  </span>
</button>

<style>
  .theme-toggle {
    position: relative;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--divider);
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    overflow: hidden;
    transition: all 0.2s var(--ease-out);
  }

  .theme-toggle:hover {
    border-color: var(--accent-subtle);
    background: var(--surface);
  }

  .theme-toggle :global(svg) {
    color: var(--text-tertiary);
    transition: color 0.2s var(--ease-out);
  }

  .theme-toggle:hover :global(svg) {
    color: var(--text-secondary);
  }

  /* Icon positioning and animation */
  .icon-sun,
  .icon-moon {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s var(--ease-out), opacity 0.3s var(--ease-out);
  }

  /* Light mode: sun visible, moon hidden below */
  .icon-sun {
    transform: translateY(0);
    opacity: 1;
  }

  .icon-moon {
    transform: translateY(100%);
    opacity: 0;
  }

  /* Dark mode: moon visible, sun hidden above */
  :global([data-theme="dark"]) .icon-sun {
    transform: translateY(-100%);
    opacity: 0;
  }

  :global([data-theme="dark"]) .icon-moon {
    transform: translateY(0);
    opacity: 1;
  }
</style>

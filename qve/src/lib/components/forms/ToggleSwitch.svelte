<!--
  ToggleSwitch Component
  Pill-shaped toggle switch for boolean values

  Usage:
  <ToggleSwitch
    checked={buyAgain}
    label={buyAgain ? 'Yes' : 'No'}
    on:change={(e) => toggleBuyAgain()}
  />
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let checked: boolean = false;
  export let label: string = '';
  export let disabled: boolean = false;
  export let id: string = `toggle-${Math.random().toString(36).slice(2, 9)}`;

  const dispatch = createEventDispatcher<{ change: boolean }>();

  function toggle() {
    if (disabled) return;
    checked = !checked;
    dispatch('change', checked);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    }
  }
</script>

<div class="toggle-container" class:disabled>
  <button
    type="button"
    role="switch"
    {id}
    class="toggle-switch"
    class:active={checked}
    aria-checked={checked}
    aria-label={label || (checked ? 'On' : 'Off')}
    tabindex={disabled ? -1 : 0}
    {disabled}
    on:click={toggle}
    on:keydown={handleKeyDown}
  >
    <span class="toggle-knob"></span>
  </button>
  {#if label}
    <label for={id} class="toggle-label">{label}</label>
  {/if}
</div>

<style>
  .toggle-container {
    display: flex;
    align-items: center;
    gap: var(--space-3, 0.75rem);
  }

  .toggle-container.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .toggle-switch {
    position: relative;
    width: 48px;
    height: 28px;
    background: var(--divider, #E8E4DE);
    border: none;
    border-radius: 100px;
    cursor: pointer;
    transition: background 0.2s var(--ease-out, ease-out);
    padding: 0;
  }

  .toggle-switch:focus-visible {
    outline: 2px solid var(--accent, #A69B8A);
    outline-offset: 2px;
  }

  .toggle-switch.active {
    background: var(--accent, #A69B8A);
  }

  .toggle-knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 22px;
    height: 22px;
    background: var(--surface, #FFFFFF);
    border-radius: 50%;
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(45, 41, 38, 0.03));
    transition: transform 0.2s var(--ease-out, ease-out);
  }

  .toggle-switch.active .toggle-knob {
    transform: translateX(20px);
  }

  .toggle-label {
    font-family: var(--font-sans, system-ui);
    font-size: 0.875rem;
    color: var(--text-secondary, #5C5652);
    cursor: pointer;
    user-select: none;
  }

  /* Responsive */
  @media (max-width: 520px) {
    .toggle-switch {
      width: 40px;
      height: 24px;
    }

    .toggle-knob {
      width: 18px;
      height: 18px;
    }

    .toggle-switch.active .toggle-knob {
      transform: translateX(16px);
    }
  }
</style>

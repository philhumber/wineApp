<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AgentMessage, AgentAction } from '$lib/agent/types';

  export let message: AgentMessage;

  const dispatch = createEventDispatcher<{ action: AgentAction }>();

  $: formType = message.data.category === 'form' ? message.data.formType : null;
  $: formData = message.data.category === 'form' ? message.data.formData : null;
  $: isDisabled = message.disabled ?? false;
</script>

<div class="form-message">
  <!-- Form components will be wired up in Phase 3 -->
  <p>Form: {formType}</p>
</div>

<style>
  .form-message {
    padding: var(--space-md, 16px);
    background: var(--color-surface, #fff);
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--color-border, #e0e0e0);
  }
</style>

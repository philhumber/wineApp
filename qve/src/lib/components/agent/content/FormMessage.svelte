<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AgentMessage, AgentAction } from '$lib/agent/types';

  // Form components
  import BottleDetailsForm from '../forms/BottleDetailsForm.svelte';
  import ManualEntryForm from '../forms/ManualEntryForm.svelte';
  import MatchSelectionList from '../forms/MatchSelectionList.svelte';

  export let message: AgentMessage;

  const dispatch = createEventDispatcher<{ action: AgentAction }>();

  $: formType = message.data.category === 'form' ? message.data.formType : null;
  $: formData = message.data.category === 'form' ? message.data.formData : null;
  $: isDisabled = message.disabled ?? false;

  // Map form types to components
  const formComponents: Record<string, any> = {
    bottle_details: BottleDetailsForm,
    manual_entry: ManualEntryForm,
    match_selection: MatchSelectionList,
  };

  $: FormComponent = formType ? formComponents[formType] : null;

  // Map form types to action types
  const actionTypes: Record<string, string> = {
    bottle_details: 'submit_bottle',
    manual_entry: 'manual_entry_submit',
    match_selection: 'select_match',
  };

  function handleFormSubmit(event: CustomEvent) {
    if (!formType) return;

    dispatch('action', {
      type: actionTypes[formType] as AgentAction['type'],
      payload: event.detail,
    } as AgentAction);
  }

  function handleFormAction(event: CustomEvent<{ action: string; data?: unknown }>) {
    dispatch('action', {
      type: 'chip_tap',
      payload: {
        action: event.detail.action,
        messageId: message.id,
        data: event.detail.data,
      },
    });
  }
</script>

<div class="form-message">
  {#if FormComponent}
    <svelte:component
      this={FormComponent}
      data={formData}
      disabled={isDisabled}
      on:submit={handleFormSubmit}
      on:action={handleFormAction}
    />
  {:else}
    <p class="form-placeholder">Form type not recognized: {formType}</p>
  {/if}
</div>

<style>
  .form-message {
    /* Form components handle their own styling */
  }

  .form-placeholder {
    padding: var(--space-md, 16px);
    color: var(--color-text-muted, #9ca3af);
    font-style: italic;
  }
</style>

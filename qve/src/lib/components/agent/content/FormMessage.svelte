<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import type {
    AgentMessage,
    AgentAction,
    BottleFormData,
    BottleDetailsFormData,
    MatchSelectionFormData,
    FormDataUnion,
  } from '$lib/agent/types';
  import { clearNewFlag } from '$lib/stores';

  // Form components
  import BottleDetailsForm from '../forms/BottleDetailsForm.svelte';
  import ManualEntryForm from '../forms/ManualEntryForm.svelte';
  import MatchSelectionList from '../forms/MatchSelectionList.svelte';

  export let message: AgentMessage;

  const dispatch = createEventDispatcher<{ action: AgentAction }>();

  // Signal readiness immediately on mount (no typewriter animation)
  onMount(() => {
    if (message.isNew) {
      clearNewFlag(message.id);
    }
  });

  $: formType = message.data.category === 'form' ? message.data.formType : null;
  $: formData = message.data.category === 'form' ? message.data.formData : null;
  $: isDisabled = message.disabled ?? false;

  // Type guards for form data
  function isBottleDetailsData(data: FormDataUnion | null): data is BottleDetailsFormData {
    return data !== null && formType === 'bottle_details';
  }

  function isMatchSelectionData(data: FormDataUnion | null): data is MatchSelectionFormData {
    return data !== null && formType === 'match_selection' && 'matches' in data;
  }

  // Extract part for bottle form (defaults to 1)
  $: bottlePart = isBottleDetailsData(formData) ? (formData.part ?? formData.step ?? 1) : 1;

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

  function handleFormNext(event: CustomEvent<BottleFormData>) {
    dispatch('action', {
      type: 'bottle_next',
      messageId: message.id,
      payload: event.detail,
    } as AgentAction);
  }
</script>

<div class="form-message">
  {#if FormComponent && formType === 'bottle_details' && isBottleDetailsData(formData)}
    <BottleDetailsForm
      part={bottlePart}
      initialData={formData}
      disabled={isDisabled}
      on:submit={handleFormSubmit}
      on:next={handleFormNext}
    />
  {:else if FormComponent && formType === 'match_selection' && isMatchSelectionData(formData)}
    <MatchSelectionList
      matches={formData.matches}
      type={formData.entityType}
      disabled={isDisabled}
      on:submit={handleFormSubmit}
      on:action={handleFormAction}
    />
  {:else if FormComponent}
    <svelte:component
      this={FormComponent}
      data={formData}
      initialData={formData}
      disabled={isDisabled}
      on:submit={handleFormSubmit}
      on:next={handleFormNext}
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
    padding: var(--space-4);
    color: var(--text-tertiary);
    font-style: italic;
    font-family: var(--font-sans);
  }
</style>

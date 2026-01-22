<!--
  ModalContainer Component
  Global modal container that renders the appropriate modal based on store state

  Add this to +layout.svelte:
  <ModalContainer />
-->
<script lang="ts">
  import { modal } from '$lib/stores';
  import DrinkRateModal from './DrinkRateModal.svelte';
  import AddBottleModal from './AddBottleModal.svelte';
  import ConfirmModal from './ConfirmModal.svelte';
  import SettingsModal from './SettingsModal.svelte';
  import type { Wine } from '$lib/api/types';
  import type { ConfirmModalData } from '$lib/stores';

  function handleClose() {
    modal.close();
  }

  function handleConfirm() {
    const data = $modal.data as ConfirmModalData | undefined;
    if (data?.onConfirm) {
      data.onConfirm();
    }
    modal.close();
  }

  function handleCancel() {
    const data = $modal.data as ConfirmModalData | undefined;
    if (data?.onCancel) {
      data.onCancel();
    }
    modal.close();
  }

  $: modalType = $modal.type;
  $: modalData = $modal.data;
</script>

{#if modalType === 'drink' && modalData?.wine}
  <DrinkRateModal wine={modalData.wine as Wine} on:close={handleClose} />
{:else if modalType === 'addBottle' && modalData?.wineID}
  <AddBottleModal
    wineID={modalData.wineID as number}
    wineName={modalData.wineName as string}
    pictureURL={modalData.pictureURL as string | null | undefined}
    year={modalData.year as unknown as string | null | undefined}
    regionName={modalData.regionName as string | undefined}
    countryName={modalData.countryName as string | undefined}
    on:close={handleClose}
  />
{:else if modalType === 'confirm' && modalData}
  {@const data = modalData as unknown as ConfirmModalData}
  <ConfirmModal
    title={data.title}
    message={data.message}
    confirmLabel={data.confirmLabel}
    cancelLabel={data.cancelLabel}
    variant={data.variant}
    on:confirm={handleConfirm}
    on:cancel={handleCancel}
  />
{:else if modalType === 'settings'}
  <SettingsModal on:close={handleClose} />
{/if}

<!--
  Future modals can be added here:
  {:else if modalType === 'edit' && modalData}
    <EditModal data={modalData} on:close={handleClose} />
-->

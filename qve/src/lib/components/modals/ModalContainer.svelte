<!--
  ModalContainer Component
  Global modal container that renders the appropriate modal based on store state

  Add this to +layout.svelte:
  <ModalContainer />
-->
<script lang="ts">
  import { modal, confirmOverlay, deleteStore, wines } from '$lib/stores';
  import { get } from 'svelte/store';
  import DrinkRateModal from './DrinkRateModal.svelte';
  import AddBottleModal from './AddBottleModal.svelte';
  import ConfirmModal from './ConfirmModal.svelte';
  import DeleteConfirmModal from './DeleteConfirmModal.svelte';
  import SettingsModal from './SettingsModal.svelte';
  import ImageLightboxModal from './ImageLightboxModal.svelte';
  import type { Wine, DrunkWine, DeleteEntityType } from '$lib/api/types';
  import type { ConfirmModalData } from '$lib/stores';

  function handleClose() {
    modal.close();
  }

  // Handlers for standalone confirm modal (type === 'confirm')
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

  // Handlers for delete confirm modal
  function handleDeleteConfirm(event: CustomEvent<{ type: DeleteEntityType; id: number; name: string }>) {
    const { type, id, name } = event.detail;

    // Get the wine snapshot for undo restoration
    const wineList = get(wines);
    const wine = wineList.find(w => w.wineID === id);

    // Start the pending delete with timer
    deleteStore.startDelete(type, id, name, { wine });

    // Close the modal
    modal.close();
  }

  function handleDeleteCancel() {
    modal.close();
  }

  // Handlers for stacked confirm overlay (dirty check confirmations)
  function handleOverlayConfirm() {
    if ($confirmOverlay?.onConfirm) {
      $confirmOverlay.onConfirm();
    }
    // Note: onConfirm callback handles closing the modal
  }

  function handleOverlayCancel() {
    if ($confirmOverlay?.onCancel) {
      $confirmOverlay.onCancel();
    }
    // Note: onCancel callback handles hiding the overlay
  }

  $: modalType = $modal.type;
  $: modalData = $modal.data;
</script>

{#if modalType === 'drink' && modalData?.wine}
  <DrinkRateModal wine={modalData.wine as Wine} on:close={handleClose} />
{:else if modalType === 'editRating' && modalData?.drunkWine}
  <DrinkRateModal
    drunkWine={modalData.drunkWine as DrunkWine}
    isEdit={true}
    on:close={handleClose}
    on:rated={handleClose}
  />
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
{:else if modalType === 'imageLightbox' && modalData?.src}
  <ImageLightboxModal
    src={modalData.src as string}
    alt={(modalData.alt as string) || 'Wine image'}
    on:close={handleClose}
  />
{:else if modalType === 'deleteConfirm' && modalData?.entityType}
  <DeleteConfirmModal
    entityType={modalData.entityType as DeleteEntityType}
    entityId={modalData.entityId as number}
    entityName={modalData.entityName as string}
    on:confirm={handleDeleteConfirm}
    on:cancel={handleDeleteCancel}
  />
{/if}

<!-- Stacked confirmation overlay for dirty checks (renders on top of main modal) -->
{#if $confirmOverlay}
  <ConfirmModal
    title={$confirmOverlay.title}
    message={$confirmOverlay.message}
    confirmLabel={$confirmOverlay.confirmLabel}
    cancelLabel={$confirmOverlay.cancelLabel}
    variant={$confirmOverlay.variant}
    on:confirm={handleOverlayConfirm}
    on:cancel={handleOverlayCancel}
  />
{/if}

<!--
  Future modals can be added here:
  {:else if modalType === 'edit' && modalData}
    <EditModal data={modalData} on:close={handleClose} />
-->

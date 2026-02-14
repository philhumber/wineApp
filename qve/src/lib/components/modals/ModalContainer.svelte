<!--
  ModalContainer Component
  Global modal container that renders the appropriate modal based on store state.

  Uses a two-phase close to prevent mobile repaint flash:
  Phase 1: CSS fades the wrapper to opacity 0 (250ms)
  Phase 2: Svelte destroys the modal component (DOM removal invisible behind opacity 0)

  Add this to +layout.svelte:
  <ModalContainer />
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { modal, confirmOverlay, deleteStore, wines } from '$lib/stores';
  import { get } from 'svelte/store';
  import type { ModalType } from '$lib/stores/modal';
  import DrinkRateModal from './DrinkRateModal.svelte';
  import AddBottleModal from './AddBottleModal.svelte';
  import ConfirmModal from './ConfirmModal.svelte';
  import DeleteConfirmModal from './DeleteConfirmModal.svelte';
  import SettingsModal from './SettingsModal.svelte';
  import ImageLightboxModal from './ImageLightboxModal.svelte';
  import CellarValueModal from './CellarValueModal.svelte';
  import type { Wine, DrunkWine, DeleteEntityType } from '$lib/api/types';
  import type { ConfirmModalData } from '$lib/stores';

  // ─── Two-phase close state ───
  // displayType/displayData lag behind the store to allow CSS fade-out
  // before Svelte destroys the component (prevents mobile repaint flash)
  let displayType: ModalType = null;
  let displayData: Record<string, unknown> | undefined;
  let isClosing = false;
  let closeTimeout: ReturnType<typeof setTimeout>;
  let cleanupTimeout: ReturnType<typeof setTimeout>;

  const FADE_DURATION_MS = 250;
  const OUTRO_BUFFER_MS = 400; // Extra time for Svelte outro transitions

  $: modalType = $modal.type;
  $: modalData = $modal.data;

  // Sync displayType with modalType, with delayed removal on close
  $: {
    if (modalType !== null) {
      // Opening or switching modals — cancel any pending close
      clearTimeout(closeTimeout);
      clearTimeout(cleanupTimeout);
      displayType = modalType;
      displayData = modalData;
      isClosing = false;
    } else if (displayType !== null && !isClosing) {
      // Closing — Phase 1: fade wrapper to opacity 0
      isClosing = true;
      closeTimeout = setTimeout(() => {
        // Phase 2: remove component from DOM (invisible — wrapper is at opacity 0)
        displayType = null;
        displayData = undefined;
        // Keep isClosing true briefly to cover any Svelte outro transitions
        cleanupTimeout = setTimeout(() => {
          isClosing = false;
        }, OUTRO_BUFFER_MS);
      }, FADE_DURATION_MS);
    }
  }

  onDestroy(() => {
    clearTimeout(closeTimeout);
    clearTimeout(cleanupTimeout);
  });

  // ─── Event handlers ───

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
</script>

<!-- Fade wrapper — hides content before DOM removal to prevent mobile repaint flash -->
<div class="modal-fade-wrapper" class:closing={isClosing}>
  {#if displayType === 'drink' && displayData?.wine}
    <DrinkRateModal wine={displayData.wine as Wine} on:close={handleClose} />
  {:else if displayType === 'editRating' && displayData?.drunkWine}
    <DrinkRateModal
      drunkWine={displayData.drunkWine as DrunkWine}
      isEdit={true}
      on:close={handleClose}
      on:rated={handleClose}
    />
  {:else if displayType === 'addBottle' && displayData?.wineID}
    <AddBottleModal
      wineID={displayData.wineID as number}
      wineName={displayData.wineName as string}
      pictureURL={displayData.pictureURL as string | null | undefined}
      year={displayData.year as unknown as string | null | undefined}
      regionName={displayData.regionName as string | undefined}
      countryName={displayData.countryName as string | undefined}
      on:close={handleClose}
    />
  {:else if displayType === 'confirm' && displayData}
    {@const data = displayData as unknown as ConfirmModalData}
    <ConfirmModal
      title={data.title}
      message={data.message}
      confirmLabel={data.confirmLabel}
      cancelLabel={data.cancelLabel}
      variant={data.variant}
      on:confirm={handleConfirm}
      on:cancel={handleCancel}
    />
  {:else if displayType === 'settings'}
    <SettingsModal on:close={handleClose} />
  {:else if displayType === 'imageLightbox' && displayData?.src}
    <ImageLightboxModal
      src={displayData.src as string}
      alt={(displayData.alt as string) || 'Wine image'}
      on:close={handleClose}
    />
  {:else if displayType === 'deleteConfirm' && displayData?.entityType}
    <DeleteConfirmModal
      entityType={displayData.entityType as DeleteEntityType}
      entityId={displayData.entityId as number}
      entityName={displayData.entityName as string}
      on:confirm={handleDeleteConfirm}
      on:cancel={handleDeleteCancel}
    />
  {:else if displayType === 'cellarValue'}
    <CellarValueModal on:close={handleClose} />
  {/if}
</div>

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
  {:else if displayType === 'edit' && displayData}
    <EditModal data={displayData} on:close={handleClose} />
-->

<style>
  .modal-fade-wrapper {
    /* Wrapper stays in DOM — positioned to contain fixed children's stacking context */
    position: fixed;
    inset: 0;
    z-index: 1100; /* Above agent panel (1000), below grain texture (9999) */
    pointer-events: none;
  }

  /* Allow modal children (backdrop, card) to receive pointer events when open */
  .modal-fade-wrapper:not(.closing) > :global(*) {
    pointer-events: auto;
  }

  /* Phase 1 close: fade everything to invisible before DOM removal */
  .modal-fade-wrapper.closing {
    opacity: 0;
    transition: opacity 250ms ease-out;
  }
</style>

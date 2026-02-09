<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { beforeNavigate, afterNavigate } from '$app/navigation';
  import { get } from 'svelte/store';
  import { theme, menuOpen, closeMenu, saveScrollPosition, getScrollPosition, modal, isModalOpen, viewMode, collectionName } from '$stores';
  import { agentPanelOpen } from '$lib/stores/agentPanel';
  import { displayCurrency } from '$lib/stores/currency';
  import { ToastContainer, SideMenu } from '$lib/components';
  import { ModalContainer } from '$lib/components/modals';
  import { AgentBubble } from '$lib/components/agent';
  import '$lib/styles/index.css';

  // WIN-236: Lazy-load AgentPanel on first bubble click
  let AgentPanelComponent: typeof import('$lib/components/agent/AgentPanel.svelte').default | null = null;
  let agentPanelLoadTriggered = false;

  $: if ($agentPanelOpen && !agentPanelLoadTriggered) {
    agentPanelLoadTriggered = true;
    import('$lib/components/agent/AgentPanel.svelte').then(mod => {
      AgentPanelComponent = mod.default;
    });
  }

  // Guard against concurrent popstate handling during async hook execution
  let isHandlingPopstate = false;

  // Handle popstate for modals and view mode (SvelteKit's afterNavigate doesn't fire for same-URL history changes)
  function handlePopstate(event: PopStateEvent) {
    const state = event.state as { _modal?: string; _viewMode?: string } | null;

    // Check if a modal is open that pushed history
    if (get(isModalOpen)) {
      // Prevent concurrent popstate handling (e.g., rapid back clicks)
      if (isHandlingPopstate) {
        return;
      }

      const modalState = get(modal);
      const hook = modalState.beforeCloseHook;

      // If modal has a dirty check hook, run it
      if (hook) {
        isHandlingPopstate = true;

        // Re-push history IMMEDIATELY before async work to keep user on modal
        window.history.pushState({ _modal: modalState.type }, '');

        // Handle async hook execution
        void Promise.resolve(hook()).then((result) => {
          if (result.dirty) {
            // Show stacked confirmation overlay (doesn't replace the modal)
            const confirmation = result.confirmation || {
              title: 'Discard changes?',
              message: 'You have unsaved changes. Are you sure you want to close?',
              confirmLabel: 'Discard',
              cancelLabel: 'Keep editing',
              variant: 'danger' as const
            };

            modal.showConfirmOverlay({
              title: confirmation.title,
              message: confirmation.message,
              confirmLabel: confirmation.confirmLabel || 'Discard',
              cancelLabel: confirmation.cancelLabel || 'Keep editing',
              variant: confirmation.variant || 'danger',
              onConfirm: () => {
                // Execute cleanup callback if provided
                if (result.onConfirm) {
                  result.onConfirm();
                }
                modal.closeFromPopstate();
                // Pop the history entry we pushed above
                window.history.back();
                isHandlingPopstate = false;
              },
              onCancel: () => {
                // User stays on modal - hide overlay, keep the history entry we pushed
                modal.hideConfirmOverlay();
                isHandlingPopstate = false;
              }
            });
          } else {
            // Not dirty - close immediately and pop the history we pushed
            modal.closeFromPopstate();
            window.history.back();
            isHandlingPopstate = false;
          }
        }).catch(() => {
          // On error, allow further popstate handling
          isHandlingPopstate = false;
        });
        return;
      }

      // No hook - close immediately
      modal.closeFromPopstate();
      return;
    }

    // Check if this is a view mode history entry
    if (state?._viewMode) {
      viewMode.restoreFromHistory(state._viewMode as 'ourWines' | 'allWines');
      return;
    }
  }

  onMount(() => {
    theme.initialize();
    displayCurrency.initialize();
    collectionName.initialize();

    // Listen for popstate to handle modal back button
    // Use capture phase to handle before SvelteKit's router
    window.addEventListener('popstate', handlePopstate, true);
  });

  onDestroy(() => {
    window.removeEventListener('popstate', handlePopstate, true);
  });

  // Save scroll position before navigating away
  beforeNavigate(({ from }) => {
    if (from?.url) {
      saveScrollPosition(from.url.pathname);
    }
  });

  // Handle back/forward navigation for scroll restoration
  afterNavigate(({ to, type }) => {
    if (type === 'popstate') {
      // Restore scroll position for normal back/forward navigation
      if (to?.url) {
        const savedPosition = getScrollPosition(to.url.pathname);
        // Use setTimeout to ensure DOM has updated
        setTimeout(() => window.scrollTo(0, savedPosition), 0);
      }
    }
  });

  function handleMenuClose() {
    closeMenu();
  }
</script>

<svelte:head>
  <title>Qvé</title>
</svelte:head>

<!-- Side navigation menu -->
<SideMenu open={$menuOpen} on:close={handleMenuClose} />

<slot />

<!-- Global toast notifications -->
<ToastContainer position="bottom-right" />

<!-- Global modal container -->
<ModalContainer />

<!-- AI Wine Assistant -->
<AgentBubble />
{#if AgentPanelComponent}
  <svelte:component this={AgentPanelComponent} />
{/if}

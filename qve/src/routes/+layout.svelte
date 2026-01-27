<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { beforeNavigate, afterNavigate } from '$app/navigation';
  import { get } from 'svelte/store';
  import { theme, menuOpen, closeMenu, saveScrollPosition, getScrollPosition, modal, isModalOpen, viewMode, isDirtyAddBottle, addBottle } from '$stores';
  import { displayCurrency } from '$lib/stores/currency';
  import { ToastContainer, SideMenu } from '$lib/components';
  import { ModalContainer } from '$lib/components/modals';
  import { AgentBubble, AgentPanel } from '$lib/components/agent';
  import '$lib/styles/index.css';

  // Handle popstate for modals and view mode (SvelteKit's afterNavigate doesn't fire for same-URL history changes)
  function handlePopstate(event: PopStateEvent) {
    const state = event.state as { _modal?: string; _viewMode?: string } | null;

    // Check if a modal is open that pushed history
    if (get(isModalOpen)) {
      const modalState = get(modal);

      // Check for dirty modals that need confirmation
      // Use native confirm() to avoid replacing the modal (which would lose data)
      if (modalState.type === 'addBottle' && get(isDirtyAddBottle)) {
        // Re-push history first to stay on modal if user cancels
        window.history.pushState({ _modal: modalState.type }, '');

        // Use native confirm - synchronous, doesn't affect modal state
        const shouldDiscard = window.confirm('You have unsaved changes. Discard and close?');
        if (shouldDiscard) {
          addBottle.reset();
          modal.closeFromPopstate();
          // Pop the history entry we just pushed
          window.history.back();
        }
        return;
      }

      // Not dirty or doesn't need confirmation - close immediately
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
<AgentPanel />

<script lang="ts">
  import { onMount } from 'svelte';
  import { beforeNavigate, afterNavigate } from '$app/navigation';
  import { theme, menuOpen, closeMenu, saveScrollPosition, getScrollPosition } from '$stores';
  import { ToastContainer, SideMenu } from '$lib/components';
  import { ModalContainer } from '$lib/components/modals';
  import '$lib/styles/index.css';

  onMount(() => {
    theme.initialize();
  });

  // Save scroll position before navigating away
  beforeNavigate(({ from }) => {
    if (from?.url) {
      saveScrollPosition(from.url.pathname);
    }
  });

  // Restore scroll position on back/forward navigation
  afterNavigate(({ to, type }) => {
    if (type === 'popstate' && to?.url) {
      const savedPosition = getScrollPosition(to.url.pathname);
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => window.scrollTo(0, savedPosition), 0);
    }
  });

  function handleMenuClose() {
    closeMenu();
  }
</script>

<!-- Side navigation menu -->
<SideMenu open={$menuOpen} on:close={handleMenuClose} />

<slot />

<!-- Global toast notifications -->
<ToastContainer position="bottom-right" />

<!-- Global modal container -->
<ModalContainer />

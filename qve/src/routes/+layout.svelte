<script lang="ts">
  import { onMount } from 'svelte';
  import { theme } from '$stores';
  import { ToastContainer } from '$lib/components';
  import { ModalContainer } from '$lib/components/modals';
  import '$lib/styles/index.css';

  onMount(() => {
    theme.initialize();
  });
</script>

<slot />

<!-- Global toast notifications -->
<ToastContainer position="bottom-right" />

<!-- Global modal container -->
<ModalContainer />

<script lang="ts">
  import { onMount } from 'svelte';
  import { theme } from '$stores';
  import { ToastContainer } from '$lib/components';
  import '$lib/styles/index.css';

  onMount(() => {
    theme.initialize();
  });
</script>

<slot />

<!-- Global toast notifications -->
<ToastContainer position="bottom-right" />

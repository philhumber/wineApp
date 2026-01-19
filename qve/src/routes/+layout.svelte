<script lang="ts">
  import { onMount } from 'svelte';
  import { theme } from '$stores';
  import '$lib/styles/index.css';

  onMount(() => {
    theme.initialize();
  });
</script>

<slot />

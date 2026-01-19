<script lang="ts" context="module">
  export type IconName =
    | 'sun'
    | 'moon'
    | 'grid'
    | 'list'
    | 'search'
    | 'menu'
    | 'chevron-down'
    | 'plus'
    | 'edit'
    | 'drink'
    | 'wine-bottle'
    | 'check'
    | 'x'
    | 'info';
</script>

<script lang="ts">
  /**
   * Shared SVG icon component
   * All icons from Qvé design system
   */
  export let name: IconName;
  export let size: number = 18;
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  class="icon icon-{name}"
  aria-hidden="true"
>
  {#if name === 'sun'}
    <!-- Sun icon for light mode -->
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  {:else if name === 'moon'}
    <!-- Moon icon for dark mode -->
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  {:else if name === 'grid'}
    <!-- Grid icon for compact view (uses fill) -->
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  {:else if name === 'list'}
    <!-- List icon for medium view -->
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  {:else if name === 'search'}
    <!-- Search icon -->
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  {:else if name === 'menu'}
    <!-- Menu (hamburger) icon -->
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  {:else if name === 'chevron-down'}
    <!-- Chevron down for dropdowns -->
    <polyline points="6 9 12 15 18 9" />
  {:else if name === 'plus'}
    <!-- Plus icon for add actions -->
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  {:else if name === 'edit'}
    <!-- Edit/pencil icon -->
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  {:else if name === 'drink'}
    <!-- Wine glass icon for drink action -->
    <path d="M8 2h8l1 5c.5 4-2 7-5 7s-5.5-3-5-7l1-5z" />
    <line x1="12" y1="14" x2="12" y2="22" />
    <circle cx="12" cy="18" r="3" />
  {:else if name === 'wine-bottle'}
    <!-- Wine bottle placeholder icon -->
    <path d="M8 2h8l1 8c0 3.5-2.5 6-5 6s-5-2.5-5-6l1-8z" />
    <line x1="12" y1="16" x2="12" y2="22" />
    <line x1="8" y1="22" x2="16" y2="22" />
  {:else if name === 'check'}
    <!-- Checkmark icon -->
    <polyline points="20 6 9 17 4 12" />
  {:else if name === 'x'}
    <!-- X/close icon -->
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  {:else if name === 'info'}
    <!-- Info icon -->
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  {/if}
</svg>

<style>
  .icon {
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
    flex-shrink: 0;
  }

  /* Grid icon uses fill instead of stroke */
  .icon-grid {
    stroke: none;
    fill: currentColor;
  }
</style>

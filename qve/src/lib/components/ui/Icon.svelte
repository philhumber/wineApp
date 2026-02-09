<script lang="ts" context="module">
  export type IconName =
    | 'sun'
    | 'moon'
    | 'grid'
    | 'list'
    | 'search'
    | 'menu'
    | 'chevron-down'
    | 'chevron-left'
    | 'chevron-right'
    | 'plus'
    | 'minus'
    | 'edit'
    | 'drink'
    | 'wine-bottle'
    | 'check'
    | 'x'
    | 'info'
    | 'warning'
    | 'close'
    | 'calendar'
    | 'arrow-up'
    | 'arrow-down'
    | 'history'
    | 'settings'
    | 'sparkle'
    | 'bookmark'
    | 'refresh'
    | 'camera'
    | 'gallery'
    | 'trash'
    | 'log-out';
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
  {:else if name === 'chevron-left'}
    <!-- Chevron left for back navigation -->
    <polyline points="15 18 9 12 15 6" />
  {:else if name === 'chevron-right'}
    <!-- Chevron right for forward navigation -->
    <polyline points="9 18 15 12 9 6" />
  {:else if name === 'plus'}
    <!-- Plus icon for add actions -->
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  {:else if name === 'minus'}
    <!-- Minus icon for subtract actions -->
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
  {:else if name === 'warning'}
    <!-- Warning triangle icon -->
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  {:else if name === 'close'}
    <!-- Close icon (same as x) -->
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  {:else if name === 'calendar'}
    <!-- Calendar icon -->
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  {:else if name === 'arrow-up'}
    <!-- Arrow up icon -->
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  {:else if name === 'arrow-down'}
    <!-- Arrow down icon -->
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  {:else if name === 'history'}
    <!-- History/clock icon -->
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  {:else if name === 'settings'}
    <!-- Settings/gear icon -->
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  {:else if name === 'sparkle'}
    <!-- Sparkle/magic icon for recommendations -->
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
    <path d="M19 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
    <path d="M5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5L5 17z" />
  {:else if name === 'bookmark'}
    <!-- Bookmark icon for save/remember -->
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  {:else if name === 'refresh'}
    <!-- Refresh/retry icon -->
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  {:else if name === 'camera'}
    <!-- Camera icon for photo capture -->
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  {:else if name === 'gallery'}
    <!-- Gallery/photo library icon -->
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  {:else if name === 'trash'}
    <!-- Trash icon for delete actions -->
    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  {:else if name === 'log-out'}
    <!-- Log out icon -->
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
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

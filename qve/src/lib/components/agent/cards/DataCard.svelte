<script lang="ts">
	/**
	 * DataCard (Universal Base Component)
	 *
	 * Handles three states for any card type:
	 * - skeleton: Full placeholder (no data yet)
	 * - streaming: Progressive data arrival
	 * - static: Complete data display
	 *
	 * Card types (wine, enrichment, etc.) provide section definitions
	 * and field rendering logic via slot props.
	 */
	import { createEventDispatcher } from 'svelte';
	import type { StreamingFieldState } from '$lib/stores/agent';

	const dispatch = createEventDispatcher();

	// ─────────────────────────────────────────────────────
	// PROPS
	// ─────────────────────────────────────────────────────

	/** Card state: skeleton | streaming | static */
	export let state: 'skeleton' | 'streaming' | 'static' = 'static';

	/** Static state: Complete data object */
	export let data: Record<string, any> | null = null;

	/** Streaming state: Map of field states */
	export let streamingFields: Map<string, StreamingFieldState> = new Map();

	/** Optional header content */
	export let header: { title: string; badge?: string; badgeStreaming?: boolean } | null = null;

	/** Optional CSS class for styling */
	export let cardClass: string = '';

	// ─────────────────────────────────────────────────────
	// FIELD ACCESSORS (exposed via slot props)
	// ─────────────────────────────────────────────────────

	export function getFieldValue(field: string): any {
		if (state === 'static') {
			return data?.[field] ?? null;
		} else if (state === 'streaming') {
			return streamingFields.get(field)?.value ?? null;
		}
		return null;
	}

	export function hasField(field: string): boolean {
		if (state === 'skeleton') return false;
		if (state === 'static') {
			const value = data?.[field];
			return value !== null && value !== undefined;
		}
		return streamingFields.has(field);
	}

	export function isFieldTyping(field: string): boolean {
		if (state !== 'streaming') return false;
		return streamingFields.get(field)?.isTyping ?? false;
	}

	export function handleFieldComplete(field: string) {
		dispatch('fieldComplete', { field });
	}

	// Reactive fields map for section visibility
	$: fieldsMap = streamingFields;
</script>

<div class="data-card {cardClass}" class:skeleton={state === 'skeleton'} data-testid="data-card">
	<!-- Header (optional) -->
	{#if header}
		<div class="card-header">
			<span class="header-title">{header.title}</span>
			{#if header.badge}
				<span class="header-badge" class:streaming={header.badgeStreaming}>
					{header.badge}
				</span>
			{/if}
		</div>
	{/if}

	<!-- Content - exposed via slot with helper functions -->
	<div class="card-content">
		<slot
			{state}
			{data}
			{fieldsMap}
			{getFieldValue}
			{hasField}
			{isFieldTyping}
			{handleFieldComplete}
		/>
	</div>
</div>

<style>
	.data-card {
		background: var(--surface);
		border-radius: var(--radius-lg);
		border: 1px solid var(--divider-subtle);
		animation: slideUp 0.3s var(--ease-out);
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--divider);
	}

	.header-title {
		font-weight: 600;
		color: var(--text-primary);
	}

	.header-badge {
		font-size: 0.75rem;
		padding: var(--space-1) var(--space-2);
		background: var(--bg-subtle);
		border-radius: var(--radius-pill);
		color: var(--text-secondary);
	}

	.header-badge.streaming {
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.card-content {
		padding: var(--space-5);
	}

	/* Respect reduced motion preference */
	@media (prefers-reduced-motion: reduce) {
		.header-badge.streaming {
			animation: none;
		}
	}
</style>

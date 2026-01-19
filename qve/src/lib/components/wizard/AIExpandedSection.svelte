<script lang="ts">
	export let expanded: boolean = false;
	export let showBadge: boolean = true;
	export let badgeText: string = 'AI Generated';
</script>

{#if expanded}
	<div class="ai-expanded">
		{#if showBadge}
			<div class="ai-expanded-header">
				<span class="ai-badge">
					<svg viewBox="0 0 24 24">
						<path d="M12 2L2 7l10 5 10-5-10-5z" />
					</svg>
					{badgeText}
				</span>
			</div>
		{/if}
		<div class="ai-content">
			<slot />
		</div>
	</div>
{/if}

<style>
	.ai-expanded {
		padding-top: var(--space-5);
		border-top: 1px solid var(--divider-subtle);
		margin-top: var(--space-5);
		animation: expandIn 0.35s var(--ease-out);
	}

	@keyframes expandIn {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.ai-expanded-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-4);
	}

	.ai-badge {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-3);
		font-size: 0.6875rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent);
		background: rgba(166, 155, 138, 0.1);
		border-radius: 100px;
	}

	.ai-badge svg {
		width: 12px;
		height: 12px;
		stroke: currentColor;
		stroke-width: 1.5;
		fill: none;
	}

	.ai-content {
		/* Children components handle their own spacing */
	}
</style>

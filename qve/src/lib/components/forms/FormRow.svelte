<script lang="ts">
	export let columns: 2 | 3 = 2;
</script>

<div class="form-row" class:three-col={columns === 3}>
	<slot />
</div>

<style>
	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);
	}

	.form-row.three-col {
		grid-template-columns: 1fr 1fr 1fr;
	}

	/* Remove bottom margin from children inside row */
	.form-row :global(.form-group) {
		margin-bottom: 0;
	}

	/* Add margin to the row itself */
	.form-row {
		margin-bottom: var(--space-5);
	}

	@media (max-width: 768px) {
		.form-row {
			grid-template-columns: 1fr;
		}

		.form-row.three-col {
			grid-template-columns: 1fr;
		}
	}
</style>

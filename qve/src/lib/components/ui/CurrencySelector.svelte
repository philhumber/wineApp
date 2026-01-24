<script lang="ts">
	/**
	 * Currency selector dropdown
	 * Uses the currency store for state management
	 */
	import { displayCurrency, availableCurrencies } from '$lib/stores/currency';
	import type { CurrencyCode } from '$lib/stores/currency';

	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		displayCurrency.set(target.value as CurrencyCode);
	}
</script>

<select class="currency-select" value={$displayCurrency} on:change={handleChange}>
	{#each $availableCurrencies as currency}
		<option value={currency.currencyCode}>
			{currency.symbol} {currency.currencyCode}
		</option>
	{/each}
</select>

<style>
	.currency-select {
		padding: var(--space-2) var(--space-3);
		padding-right: var(--space-6);
		border: 1px solid var(--divider);
		border-radius: 6px;
		background: var(--surface);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s var(--ease-out);
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239a8d82' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right var(--space-2) center;
	}

	.currency-select:hover {
		border-color: var(--accent-subtle);
	}

	.currency-select:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 2px var(--accent-subtle);
	}

	.currency-select option {
		background: var(--surface);
		color: var(--text-primary);
	}
</style>

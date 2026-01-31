<script lang="ts">
	export let body: string | null = null;
	export let tannin: string | null = null;
	export let acidity: string | null = null;

	function levelToPercent(level: string | null): number {
		if (!level) return 0;
		const normalized = level.toLowerCase();
		if (normalized.includes('low') || normalized.includes('light')) return 20;
		if (normalized.includes('medium-low')) return 35;
		if (normalized.includes('medium-high')) return 65;
		if (normalized.includes('medium')) return 50;
		if (normalized.includes('high') || normalized.includes('full')) return 80;
		return 50;
	}

	const profiles = [
		{ label: 'Body', value: body, color: 'var(--rating-wine)' },
		{ label: 'Tannin', value: tannin, color: 'var(--accent)' },
		{ label: 'Acidity', value: acidity, color: 'var(--rating-value)' }
	].filter((p) => p.value);
</script>

<div class="style-profiles">
	{#each profiles as profile}
		<div class="profile-row">
			<span class="profile-label">{profile.label}</span>
			<div
				class="profile-bar-container"
				role="img"
				aria-label="{profile.label}: {profile.value}"
			>
				<div
					class="profile-bar"
					style="width: {levelToPercent(profile.value)}%; background-color: {profile.color};"
				></div>
			</div>
			<span class="profile-value">{profile.value}</span>
		</div>
	{/each}
</div>

<style>
	.style-profiles {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.profile-row {
		display: grid;
		grid-template-columns: 60px 1fr 80px;
		align-items: center;
		gap: var(--space-3);
	}

	.profile-label {
		font-size: 0.8125rem;
		color: var(--text-secondary);
	}

	.profile-bar-container {
		height: 8px;
		background: var(--bg-subtle);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	.profile-bar {
		height: 100%;
		border-radius: var(--radius-pill);
		transition: width 0.5s ease-out;
	}

	.profile-value {
		font-size: 0.8125rem;
		color: var(--text-primary);
		text-transform: capitalize;
	}
</style>

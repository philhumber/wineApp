<script lang="ts">
	export let start: number | null;
	export let end: number | null;
	export let maturity: 'young' | 'ready' | 'peak' | 'declining' | null = null;

	const currentYear = new Date().getFullYear();

	$: windowStart = start ?? currentYear;
	$: windowEnd = end ?? currentYear + 10;

	// Always calculate status from dates - they're the source of truth
	// Only fall back to provided maturity if dates aren't available
	$: status = start && end ? calculateStatus(windowStart, windowEnd, currentYear) : (maturity ?? 'ready');
	$: statusLabel = getStatusLabel(status);
	$: statusClass = getStatusClass(status);

	function calculateStatus(start: number, end: number, current: number): string {
		if (current < start) return 'young';
		if (current > end) return 'declining';

		// Within the drinking window - determine position
		const range = end - start;
		const position = current - start;
		const percentThrough = range > 0 ? position / range : 0.5;

		if (percentThrough < 0.33) return 'ready-young';
		if (percentThrough > 0.66) return 'ready-declining';
		return 'ready';
	}

	function getStatusLabel(status: string): string {
		switch (status) {
			case 'young':
				return 'Hold';
			case 'ready-young':
				return 'Ready (Young)';
			case 'ready':
				return 'Ready';
			case 'peak':
				return 'At Peak';
			case 'ready-declining':
				return 'Ready (Declining)';
			case 'declining':
				return 'Past Peak';
			default:
				return 'Unknown';
		}
	}

	function getStatusClass(status: string): string {
		switch (status) {
			case 'young':
				return 'status-hold';
			case 'ready-young':
			case 'ready':
			case 'peak':
			case 'ready-declining':
				return 'status-ready';
			case 'declining':
				return 'status-past';
			default:
				return '';
		}
	}

	// Calculate marker position (clamped between 0-100)
	// Guard against division by zero when start === end
	$: range = windowEnd - windowStart;
	$: markerPosition =
		range > 0
			? Math.min(100, Math.max(0, ((currentYear - windowStart) / range) * 100))
			: 50; // Single-year window: show marker in middle
</script>

<div class="drink-window">
	<div class="timeline-container">
		<div class="timeline-bar">
			<div class="current-marker" style="left: {markerPosition}%">
				<span class="marker-year">{currentYear}</span>
			</div>
		</div>
		<div class="timeline-labels">
			<span class="year-label">{windowStart}</span>
			<span class="year-label">{windowEnd}</span>
		</div>
	</div>

	<div class="status-container">
		<span class="status-badge {statusClass}">{statusLabel}</span>
		{#if status === 'young' && start}
			<span class="status-detail">Best after {start}</span>
		{:else if (status === 'ready-young' || status === 'ready' || status === 'ready-declining') && end}
			<span class="status-detail">{end - currentYear} years left in window</span>
		{:else if status === 'declining'}
			<span class="status-detail">Consider drinking soon</span>
		{/if}
	</div>
</div>

<style>
	.drink-window {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-top: 20px; /* Space for year marker above timeline */
	}

	.timeline-container {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.timeline-bar {
		position: relative;
		height: 8px;
		background: linear-gradient(
			90deg,
			var(--status-hold) 0%,
			var(--status-ready) 50%,
			var(--status-past) 100%
		);
		border-radius: var(--radius-pill);
		opacity: 0.3;
	}

	.current-marker {
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.marker-year {
		position: absolute;
		top: -20px;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
	}

	.current-marker::after {
		content: '';
		width: 12px;
		height: 12px;
		background: var(--accent);
		border: 2px solid var(--surface);
		border-radius: 50%;
	}

	.timeline-labels {
		display: flex;
		justify-content: space-between;
	}

	.year-label {
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.status-container {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.status-badge {
		font-size: 0.75rem;
		font-weight: 600;
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-sm);
	}

	.status-hold {
		background: var(--status-hold-bg);
		color: var(--status-hold);
	}

	.status-ready {
		background: var(--status-ready-bg);
		color: var(--status-ready);
	}

	.status-past {
		background: var(--status-past-bg);
		color: var(--status-past);
	}

	.status-detail {
		font-size: 0.8125rem;
		color: var(--text-secondary);
	}
</style>

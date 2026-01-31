<script lang="ts">
	// Loading skeleton that matches EnrichmentCard layout
</script>

<div class="enrichment-skeleton">
	<div class="skeleton-header">
		<div class="skeleton-line title"></div>
		<div class="skeleton-badge"></div>
	</div>

	<div class="skeleton-content">
		<!-- Style profile skeleton -->
		<div class="skeleton-section">
			<div class="skeleton-line section-title"></div>
			<div class="skeleton-bars">
				<div class="skeleton-bar"></div>
				<div class="skeleton-bar"></div>
				<div class="skeleton-bar"></div>
			</div>
		</div>

		<!-- Scores skeleton -->
		<div class="skeleton-section">
			<div class="skeleton-line section-title"></div>
			<div class="skeleton-badges">
				<div class="skeleton-score-badge"></div>
				<div class="skeleton-score-badge"></div>
				<div class="skeleton-score-badge"></div>
			</div>
		</div>

		<!-- Narrative skeleton -->
		<div class="skeleton-section">
			<div class="skeleton-line section-title"></div>
			<div class="skeleton-line text long"></div>
			<div class="skeleton-line text"></div>
			<div class="skeleton-line text short"></div>
		</div>
	</div>
</div>

<style>
	.enrichment-skeleton {
		background: var(--surface-raised);
		border-radius: var(--radius-lg);
		overflow: hidden;
		margin-top: var(--space-3);
	}

	.skeleton-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--divider);
	}

	.skeleton-content {
		padding: var(--space-4);
	}

	.skeleton-section {
		margin-bottom: var(--space-5);
	}

	.skeleton-section:last-child {
		margin-bottom: 0;
	}

	.skeleton-line {
		background: var(--bg-subtle);
		border-radius: var(--radius-sm);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-line.title {
		width: 100px;
		height: 18px;
	}

	.skeleton-line.section-title {
		width: 80px;
		height: 14px;
		margin-bottom: var(--space-3);
	}

	.skeleton-line.text {
		height: 14px;
		margin-bottom: var(--space-2);
	}

	.skeleton-line.text.long {
		width: 100%;
	}

	.skeleton-line.text:not(.long):not(.short) {
		width: 85%;
	}

	.skeleton-line.text.short {
		width: 60%;
	}

	.skeleton-badge {
		width: 50px;
		height: 24px;
		background: var(--bg-subtle);
		border-radius: var(--radius-pill);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-bars {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.skeleton-bar {
		height: 8px;
		background: var(--bg-subtle);
		border-radius: var(--radius-pill);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-bar:nth-child(1) {
		width: 65%;
		animation-delay: 0s;
	}
	.skeleton-bar:nth-child(2) {
		width: 45%;
		animation-delay: 0.1s;
	}
	.skeleton-bar:nth-child(3) {
		width: 75%;
		animation-delay: 0.2s;
	}

	.skeleton-badges {
		display: flex;
		gap: var(--space-2);
	}

	.skeleton-score-badge {
		width: 52px;
		height: 48px;
		background: var(--bg-subtle);
		border-radius: var(--radius-md);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-score-badge:nth-child(2) {
		animation-delay: 0.1s;
	}
	.skeleton-score-badge:nth-child(3) {
		animation-delay: 0.2s;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.6;
		}
		50% {
			opacity: 1;
		}
	}
</style>

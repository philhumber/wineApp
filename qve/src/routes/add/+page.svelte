<script lang="ts">
	import { get } from 'svelte/store';
	import { goto, beforeNavigate } from '$app/navigation';
	import { base } from '$app/paths';
	import {
		addWineStore,
		currentStep,
		isSubmitting,
		isAILoading,
		canProceed,
		scrollToWine,
		modal
	} from '$lib/stores';
	import {
		ThemeToggle,
		WizardStepIndicator,
		WizardNav,
		AILoadingOverlay
	} from '$lib/components';
	import { RegionStep, ProducerStep, WineStep, BottleStep } from './steps';

	// Step labels for indicator
	const stepLabels = ['Region', 'Producer', 'Wine', 'Bottle'];

	// Subscribe to store
	$: step = $currentStep;
	$: submitting = $isSubmitting;
	$: aiLoading = $isAILoading;
	$: proceed = $canProceed;

	// Track if user has entered data
	let allowNavigation = false;

	// Check if wizard has unsaved data
	function hasUnsavedData(): boolean {
		const state = get(addWineStore);
		return !!(
			state.region.regionName ||
			state.producer.producerName ||
			state.wine.wineName ||
			state.bottle.price ||
			state.bottle.source
		);
	}

	// Warn before leaving with unsaved data
	beforeNavigate(({ cancel }) => {
		if (!allowNavigation && hasUnsavedData() && !$isSubmitting) {
			cancel();
			modal.confirm({
				title: 'Leave page?',
				message: 'You have unsaved data. Are you sure you want to leave?',
				confirmLabel: 'Leave',
				cancelLabel: 'Stay',
				variant: 'danger',
				onConfirm: () => {
					addWineStore.reset();
					allowNavigation = true;
					history.back();
				}
			});
		}
	});

	// Handle step navigation
	function handleBack() {
		addWineStore.prevStep();
	}

	function handleNext() {
		addWineStore.nextStep();
	}

	// Handle header back button
	function handleHeaderBack() {
		if (hasUnsavedData()) {
			modal.confirm({
				title: 'Leave page?',
				message: 'You have unsaved data. Are you sure you want to leave?',
				confirmLabel: 'Leave',
				cancelLabel: 'Stay',
				variant: 'danger',
				onConfirm: () => {
					addWineStore.reset();
					allowNavigation = true;
					goBack();
				}
			});
		} else {
			goBack();
		}
	}

	// Navigate back (with fallback to home)
	function goBack() {
		allowNavigation = true;
		if (window.history.length > 1) {
			history.back();
		} else {
			goto(`${base}/`);
		}
	}

	// Handle form submission
	async function handleSubmit() {
		const result = await addWineStore.submit();
		if (result.success && result.wineID) {
			// Set target wine for scroll-to effect
			scrollToWine(result.wineID);
			// Reset wizard
			addWineStore.reset();
			// Allow navigation
			allowNavigation = true;
			// Navigate to home
			goto(`${base}/`);
		}
	}

	// Cancel AI loading
	function handleCancelAI() {
		addWineStore.cancelAI();
	}

	// Note: Store is reset in modal onConfirm callbacks when user explicitly
	// confirms leaving. We don't reset here to preserve data for back-button nav.
</script>

<svelte:head>
	<title>Add Wine | Qvé</title>
</svelte:head>

<!-- Header -->
<header class="header">
	<div class="header-inner">
		<button class="header-back" on:click={handleHeaderBack}>
			<svg viewBox="0 0 24 24" width="16" height="16">
				<path d="M19 12H5M12 19l-7-7 7-7" />
			</svg>
			Back
		</button>
		<h1 class="header-title">Add Wine</h1>
		<ThemeToggle />
	</div>
</header>

<!-- Main Content -->
<main class="main">
	<!-- Step Indicator -->
	<WizardStepIndicator
		currentStep={step}
		totalSteps={4}
		labels={stepLabels}
	/>

	<!-- Form Container -->
	<div class="form-container">
		<div class="form-section">
			{#if step === 1}
				<RegionStep />
			{:else if step === 2}
				<ProducerStep />
			{:else if step === 3}
				<WineStep />
			{:else if step === 4}
				<BottleStep />
			{/if}
		</div>

		<!-- Navigation -->
		<WizardNav
			currentStep={step}
			totalSteps={4}
			isSubmitting={submitting}
			canProceed={proceed}
			on:back={handleBack}
			on:next={handleNext}
			on:submit={handleSubmit}
		/>
	</div>
</main>

<!-- AI Loading Overlay -->
<AILoadingOverlay visible={aiLoading} on:cancel={handleCancelAI} />

<style>
	/* Header */
	.header {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 100;
		background: var(--bg);
		border-bottom: 1px solid var(--divider);
		transition: background 0.3s var(--ease-out), border-color 0.3s var(--ease-out);
	}

	:global([data-theme='dark']) .header {
		background: rgba(12, 11, 10, 0.85);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
	}

	.header-inner {
		max-width: 800px;
		margin: 0 auto;
		padding: var(--space-5) var(--space-6);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header-back {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-family: var(--font-sans);
		font-size: 0.875rem;
		color: var(--text-secondary);
		text-decoration: none;
		transition: color 0.2s var(--ease-out);
	}

	.header-back:hover {
		color: var(--text-primary);
	}

	.header-back svg {
		stroke: currentColor;
		stroke-width: 1.5;
		fill: none;
	}

	.header-title {
		font-family: var(--font-serif);
		font-size: 1.25rem;
		font-weight: 400;
		color: var(--text-primary);
	}

	/* Main Content */
	.main {
		position: relative;
		z-index: 1;
		max-width: 800px;
		margin: 0 auto;
		padding: calc(100px + var(--space-6)) var(--space-6) var(--space-12);
	}

	/* Form Container */
	.form-container {
		background: var(--surface);
		border: 1px solid var(--divider-subtle);
		border-radius: 12px;
		box-shadow: var(--shadow-md);
	}

	.form-section {
		padding: var(--space-6);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.main {
			padding: calc(90px + var(--space-4)) var(--space-4) var(--space-8);
		}

		.header-inner {
			padding: var(--space-4);
		}

		.form-section {
			padding: var(--space-5);
		}
	}
</style>

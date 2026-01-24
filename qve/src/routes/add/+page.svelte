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
		Header,
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
<Header variant="add" />

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
	/* Main Content */
	.main {
		position: relative;
		z-index: 1;
		max-width: 800px;
		margin: 0 auto;
		padding: var(--space-6) var(--space-6) var(--space-12);
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
			padding: var(--space-4) var(--space-4) var(--space-8);
		}

		.form-section {
			padding: var(--space-5);
		}
	}
</style>

<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { goto, beforeNavigate } from '$app/navigation';
	import { page } from '$app/stores';
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
	import type { WizardStep } from '$lib/stores/addWine';

	// Step labels for indicator
	const stepLabels = ['Region', 'Producer', 'Wine', 'Bottle'];

	// Get step directly from URL - no step param means step 1
	// This ensures the display always matches the URL
	$: urlStepParam = $page.url.searchParams.get('step');
	$: step = (urlStepParam ? parseInt(urlStepParam, 10) : 1) as WizardStep;

	$: submitting = $isSubmitting;
	$: aiLoading = $isAILoading;
	$: proceed = $canProceed;

	// Track if user has entered data
	let allowNavigation = false;

	// Keep store in sync with URL step (step is always valid 1-4)
	$: if (step !== $currentStep) {
		addWineStore.goToStep(step);
	}

	// On mount: Always start at step 1 (ignore URL params for deep linking)
	onMount(() => {
		addWineStore.goToStep(1);
		// Clear any step param from URL without adding history entry
		if ($page.url.searchParams.has('step')) {
			goto(`${base}/add`, { replaceState: true, noScroll: true });
		}
	});

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
	beforeNavigate(({ cancel, to }) => {
		// Allow navigation within wizard (step changes via query params)
		const isStayingInWizard = to?.url.pathname === `${base}/add`;
		if (isStayingInWizard) {
			return; // Don't block step-to-step navigation
		}

		// Block navigation away from wizard if there's unsaved data
		if (!allowNavigation && hasUnsavedData() && !$isSubmitting) {
			cancel();
			modal.confirm({
				title: 'Leave page?',
				message: 'You have unsaved data. Are you sure you want to leave?',
				confirmLabel: 'Leave',
				cancelLabel: 'Stay',
				variant: 'danger',
				onConfirm: () => {
					modal.close();
					addWineStore.reset();
					allowNavigation = true;
					history.back();
				},
				onCancel: () => {
					modal.close();
				}
			});
		}
	});

	// Handle step navigation
	function handleBack() {
		if ($currentStep > 1) {
			// Use browser history to go back (popstate will sync the step)
			history.back();
		} else {
			// Step 1 - navigate away (dirty check in beforeNavigate will trigger)
			goto(`${base}/`);
		}
	}

	function handleNext() {
		const success = addWineStore.nextStep();
		if (success) {
			// Push new history entry with step in URL
			const newStep = get(currentStep);
			goto(`${base}/add?step=${newStep}`, { noScroll: true, keepFocus: true });
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

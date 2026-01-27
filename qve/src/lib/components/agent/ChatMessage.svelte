<script lang="ts">
	/**
	 * ChatMessage
	 * Displays a single message in the agent conversation
	 * Agent: Editorial serif with accent divider
	 * User: Subtle indented card
	 */
	import { createEventDispatcher } from 'svelte';
	import type { AgentMessage, AgentChip } from '$lib/stores';
	import type { AgentParsedWine, AgentCandidate } from '$lib/api/types';
	import ActionChips from './ActionChips.svelte';
	import WineIdentificationCard from './WineIdentificationCard.svelte';
	import DisambiguationList from './DisambiguationList.svelte';

	const dispatch = createEventDispatcher<{
		chipSelect: { action: string };
		addToCellar: { parsed: AgentParsedWine };
		tryAgain: void;
		confirm: { parsed: AgentParsedWine };
		edit: { parsed: AgentParsedWine };
		selectCandidate: { candidate: AgentCandidate };
	}>();

	export let message: AgentMessage;

	function handleChipSelect(e: CustomEvent<{ action: string }>) {
		dispatch('chipSelect', e.detail);
	}

	function handleAddToCellar(e: CustomEvent<{ parsed: AgentParsedWine }>) {
		dispatch('addToCellar', e.detail);
	}

	function handleTryAgain() {
		dispatch('tryAgain');
	}

	function handleConfirm(e: CustomEvent<{ parsed: AgentParsedWine }>) {
		dispatch('confirm', e.detail);
	}

	function handleEdit(e: CustomEvent<{ parsed: AgentParsedWine }>) {
		dispatch('edit', e.detail);
	}

	function handleSelectCandidate(e: CustomEvent<{ candidate: AgentCandidate }>) {
		dispatch('selectCandidate', e.detail);
	}
</script>

<article
	class="chat-message"
	class:agent={message.role === 'agent'}
	class:user={message.role === 'user'}
	class:has-wine-result={message.type === 'wine_result'}
	class:has-disambiguation={message.type === 'disambiguation'}
>
	{#if message.role === 'agent'}
		<!-- Agent message: Editorial serif with accent divider -->
		{#if message.type === 'wine_result' && message.wineResult}
			<!-- Wine result card -->
			<WineIdentificationCard
				parsed={message.wineResult}
				action="suggest"
				confidence={message.confidence ?? 0}
				on:addToCellar={handleAddToCellar}
				on:tryAgain={handleTryAgain}
				on:confirm={handleConfirm}
				on:edit={handleEdit}
			/>
		{:else if message.type === 'disambiguation' && message.candidates}
			<!-- Disambiguation list -->
			<p class="agent-text">{message.content}</p>
			<DisambiguationList
				candidates={message.candidates}
				on:select={handleSelectCandidate}
			/>
		{:else if message.type === 'error'}
			<!-- Error message -->
			<p class="agent-text error-text">{message.content}</p>
		{:else if message.type === 'coming_soon'}
			<!-- Coming soon message -->
			<p class="agent-text coming-soon-text">{message.content}</p>
			<div class="accent-divider"></div>
		{:else}
			<!-- Standard text message -->
			<p class="agent-text">{message.content}</p>
			<div class="accent-divider"></div>
		{/if}

		{#if message.chips && message.chips.length > 0}
			<ActionChips chips={message.chips} on:select={handleChipSelect} />
		{/if}
	{:else}
		<!-- User message: Subtle indented card -->
		<div class="user-card">
			{#if message.type === 'image_preview' && message.imageUrl}
				<img src={message.imageUrl} alt="Wine label" class="user-image" />
			{:else}
				<p class="user-text">{message.content}</p>
			{/if}
		</div>
	{/if}
</article>

<style>
	.chat-message {
		animation: fadeInUp 0.4s var(--ease-out);
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Agent messages */
	.chat-message.agent {
		padding-right: var(--space-4);
	}

	.agent-text {
		font-family: var(--font-serif);
		font-size: 1rem;
		font-style: italic;
		color: var(--text-secondary);
		line-height: 1.6;
		margin: 0;
	}

	.agent-text.error-text {
		color: var(--error);
		font-style: normal;
	}

	.agent-text.coming-soon-text {
		color: var(--text-tertiary);
	}

	.accent-divider {
		width: 40px;
		height: 1px;
		background: var(--accent);
		margin-top: var(--space-3);
	}

	/* User messages */
	.chat-message.user {
		display: flex;
		justify-content: flex-end;
	}

	.user-card {
		font-family: var(--font-sans);
		font-size: 0.9375rem;
		color: var(--text-primary);
		background: var(--bg-subtle);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-lg);
		margin-left: var(--space-4);
		max-width: 85%;
		box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.02);
	}

	.user-text {
		margin: 0;
		line-height: 1.5;
	}

	.user-image {
		max-width: 200px;
		max-height: 200px;
		border-radius: var(--radius-md);
		object-fit: cover;
	}

	/* Wine result and disambiguation don't need extra padding */
	.chat-message.has-wine-result,
	.chat-message.has-disambiguation {
		padding-right: 0;
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.chat-message {
			animation: none;
		}
	}
</style>

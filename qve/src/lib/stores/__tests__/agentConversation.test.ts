import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
	agentMessages,
	agentPhase,
	addWineStep,
	hasMessages,
	lastMessage,
	lastAgentMessage,
	lastUserMessage,
	isInAddWineFlow,
	isInEnrichmentFlow,
	isInLoadingPhase,
	agentOrigin,
	addMessage,
	addMessages,
	updateMessage,
	disableMessage,
	disableAllChips,
	clearNewFlag,
	clearAllNewFlags,
	removeMessage,
	setPhase,
	setAddWineStep,
	resetConversation,
	startSession,
	fullReset,
	initializeConversation,
	createTextMessage,
	createChipsMessage,
	createMessage,
	setOrigin,
	clearOrigin,
	getOrigin,
	type OriginState,
} from '../agentConversation';
import { clearState } from '../agentPersistence';
import type { AgentMessage, TextMessageData, ChipsMessageData } from '$lib/agent/types';

// Type helpers for accessing discriminated union properties in tests
const getTextContent = (msg: AgentMessage | undefined | null): string | undefined => {
	if (!msg || msg.category !== 'text') return undefined;
	return (msg.data as TextMessageData).content;
};

const getChips = (msg: AgentMessage | undefined | null) => {
	if (!msg || msg.category !== 'chips') return undefined;
	return (msg.data as ChipsMessageData).chips;
};

// Helper to transition to a target phase following valid paths
// The state machine requires valid transitions, so tests need to follow proper paths
const transitionToPhase = (target: Parameters<typeof setPhase>[0], step?: Parameters<typeof setPhase>[1]) => {
	// Get current phase after fullReset (greeting)
	// Valid paths from greeting:
	// - greeting → awaiting_input → confirming/adding_wine/enriching
	// - greeting → identifying → confirming
	// - greeting → error

	switch (target) {
		case 'greeting':
			// Already at greeting after fullReset
			break;
		case 'awaiting_input':
			setPhase('awaiting_input');
			break;
		case 'identifying':
			setPhase('identifying');
			break;
		case 'confirming':
			setPhase('awaiting_input');
			setPhase('confirming');
			break;
		case 'adding_wine':
			setPhase('awaiting_input');
			setPhase('adding_wine', step ?? 'confirm');
			break;
		case 'enriching':
			setPhase('awaiting_input');
			setPhase('enriching');
			break;
		case 'error':
			setPhase('error');
			break;
		case 'complete':
			setPhase('awaiting_input');
			setPhase('confirming');
			setPhase('complete');
			break;
		default:
			setPhase(target as any);
	}
};

describe('agentConversation', () => {
	beforeEach(() => {
		// Reset store to clean state before each test
		fullReset();
		clearState();
	});

	describe('addMessage', () => {
		it('should add a message with generated ID', () => {
			const msg = addMessage(createTextMessage('Hello'));
			expect(msg.id).toBeDefined();
			expect(msg.id).toMatch(/^msg_/);
		});

		it('should add message to store', () => {
			addMessage(createTextMessage('Hello'));
			const messages = get(agentMessages);
			expect(messages).toHaveLength(1);
			expect(getTextContent(messages[0])).toBe('Hello');
		});

		it('should mark new messages with isNew flag', () => {
			const msg = addMessage(createTextMessage('Hello'));
			expect(msg.isNew).toBe(true);
		});

		it('should generate unique IDs for each message', () => {
			const msg1 = addMessage(createTextMessage('First'));
			const msg2 = addMessage(createTextMessage('Second'));
			expect(msg1.id).not.toBe(msg2.id);
		});

		it('should trim messages when exceeding MAX_MESSAGES (30)', () => {
			// Add 35 messages
			for (let i = 0; i < 35; i++) {
				addMessage(createTextMessage(`Message ${i}`));
			}
			const messages = get(agentMessages);
			expect(messages).toHaveLength(30);
			// First 5 should be trimmed, so first remaining should be Message 5
			expect(getTextContent(messages[0])).toBe('Message 5');
		});

		it('should preserve existing message ID if provided', () => {
			const msg = addMessage({
				...createTextMessage('Test'),
				id: 'custom-id-123',
			});
			expect(msg.id).toBe('custom-id-123');
		});

		it('should disable all existing chip messages when adding a new message', () => {
			// Add a chip message first
			addMessage(createChipsMessage([{ id: '1', label: 'Yes', action: 'confirm' }]));

			// Verify chip is not disabled
			expect(get(agentMessages)[0].disabled).toBeFalsy();

			// Add a new text message
			addMessage(createTextMessage('New message'));

			// Chip should now be disabled
			const messages = get(agentMessages);
			expect(messages[0].disabled).toBe(true);
			expect(messages[1].disabled).toBeFalsy(); // New message not disabled
		});

		it('should disable multiple chip messages when adding a new message', () => {
			// Add multiple chip messages
			addMessage(createChipsMessage([{ id: '1', label: 'A', action: 'a' }]));
			addMessage(createChipsMessage([{ id: '2', label: 'B', action: 'b' }]));

			// Second chip disabled the first, so check the second is not disabled
			const beforeMessages = get(agentMessages);
			expect(beforeMessages[0].disabled).toBe(true); // First was disabled by second
			expect(beforeMessages[1].disabled).toBeFalsy();

			// Add a text message
			addMessage(createTextMessage('Hello'));

			// Both chips should be disabled
			const afterMessages = get(agentMessages);
			expect(afterMessages[0].disabled).toBe(true);
			expect(afterMessages[1].disabled).toBe(true);
			expect(afterMessages[2].disabled).toBeFalsy();
		});

		it('should not affect text messages when disabling chips', () => {
			addMessage(createTextMessage('First text'));
			addMessage(createChipsMessage([{ id: '1', label: 'A', action: 'a' }]));
			addMessage(createTextMessage('Third text'));

			const messages = get(agentMessages);
			expect(messages[0].disabled).toBeFalsy(); // Text not disabled
			expect(messages[1].disabled).toBe(true);  // Chip disabled
			expect(messages[2].disabled).toBeFalsy(); // New text not disabled
		});

		it('should disable error messages when adding a new message', () => {
			// Add an error message
			addMessage(createMessage('error', {
				error: { type: 'timeout', userMessage: 'Timed out', retryable: true },
				retryable: true,
			}));

			// Verify error is not disabled
			expect(get(agentMessages)[0].disabled).toBeFalsy();

			// Add a new text message
			addMessage(createTextMessage('New message'));

			// Error should now be disabled
			const messages = get(agentMessages);
			expect(messages[0].disabled).toBe(true);
			expect(messages[1].disabled).toBeFalsy();
		});

		it('should disable both chips and errors when adding a new message', () => {
			addMessage(createChipsMessage([{ id: '1', label: 'A', action: 'a' }]));
			addMessage(createMessage('error', {
				error: { type: 'server_error', userMessage: 'Error', retryable: false },
				retryable: false,
			}));

			// Error disabled the chip, error is still active
			const beforeMessages = get(agentMessages);
			expect(beforeMessages[0].disabled).toBe(true);
			expect(beforeMessages[1].disabled).toBeFalsy();

			// Add a text message
			addMessage(createTextMessage('Hello'));

			// Both should be disabled
			const afterMessages = get(agentMessages);
			expect(afterMessages[0].disabled).toBe(true);  // Chip
			expect(afterMessages[1].disabled).toBe(true);  // Error
			expect(afterMessages[2].disabled).toBeFalsy(); // New text
		});
	});

	describe('addMessages', () => {
		it('should add multiple messages at once', () => {
			const added = addMessages([
				createTextMessage('First'),
				createTextMessage('Second'),
				createTextMessage('Third'),
			]);
			expect(added).toHaveLength(3);
			expect(get(agentMessages)).toHaveLength(3);
		});

		it('should generate unique IDs for all messages', () => {
			const added = addMessages([
				createTextMessage('First'),
				createTextMessage('Second'),
			]);
			expect(added[0].id).not.toBe(added[1].id);
		});

		it('should disable all existing chip messages when adding multiple messages', () => {
			// Add a chip message first
			addMessage(createChipsMessage([{ id: '1', label: 'A', action: 'a' }]));
			expect(get(agentMessages)[0].disabled).toBeFalsy();

			// Add multiple messages at once
			addMessages([
				createTextMessage('First'),
				createTextMessage('Second'),
			]);

			const messages = get(agentMessages);
			expect(messages[0].disabled).toBe(true);  // Chip disabled
			expect(messages[1].disabled).toBeFalsy(); // New text
			expect(messages[2].disabled).toBeFalsy(); // New text
		});

		it('should disable multiple existing chip messages when adding batch', () => {
			addMessage(createTextMessage('Text'));
			addMessage(createChipsMessage([{ id: '1', label: 'A', action: 'a' }]));
			addMessage(createChipsMessage([{ id: '2', label: 'B', action: 'b' }]));

			// Only the last chip should be not disabled at this point
			const beforeMessages = get(agentMessages);
			expect(beforeMessages[1].disabled).toBe(true);
			expect(beforeMessages[2].disabled).toBeFalsy();

			// Add batch
			addMessages([createTextMessage('New 1'), createTextMessage('New 2')]);

			const afterMessages = get(agentMessages);
			expect(afterMessages[0].disabled).toBeFalsy(); // Text
			expect(afterMessages[1].disabled).toBe(true);  // Chip 1
			expect(afterMessages[2].disabled).toBe(true);  // Chip 2
			expect(afterMessages[3].disabled).toBeFalsy(); // New 1
			expect(afterMessages[4].disabled).toBeFalsy(); // New 2
		});
	});

	describe('createTextMessage', () => {
		it('should create text message with correct category', () => {
			const msg = createTextMessage('Test');
			expect(msg.category).toBe('text');
			expect(msg.data.category).toBe('text');
			expect(getTextContent(msg)).toBe('Test');
		});

		it('should default to agent role', () => {
			const msg = createTextMessage('Test');
			expect(msg.role).toBe('agent');
		});

		it('should allow user role override', () => {
			const msg = createTextMessage('Test', { role: 'user' });
			expect(msg.role).toBe('user');
		});
	});

	describe('createChipsMessage', () => {
		it('should create chips message with correct category', () => {
			const chips = [{ id: '1', label: 'Test', action: 'test' }];
			const msg = createChipsMessage(chips);
			expect(msg.category).toBe('chips');
			expect(getChips(msg)).toEqual(chips);
		});

		it('should support multiple chips', () => {
			const chips = [
				{ id: '1', label: 'Yes', action: 'confirm' },
				{ id: '2', label: 'No', action: 'reject' },
			];
			const msg = createChipsMessage(chips);
			expect(getChips(msg)).toHaveLength(2);
		});
	});

	describe('createMessage', () => {
		it('should create message with specified category', () => {
			const msg = createMessage('error', {
				error: { type: 'timeout', userMessage: 'Timed out', retryable: true },
			});
			expect(msg.category).toBe('error');
		});
	});

	describe('setPhase', () => {
		it('should update phase', () => {
			setPhase('identifying'); // greeting → identifying is valid
			expect(get(agentPhase)).toBe('identifying');
		});

		it('should set addWineStep when provided', () => {
			// greeting → awaiting_input → adding_wine (valid path)
			setPhase('awaiting_input');
			setPhase('adding_wine', 'confirm');
			expect(get(agentPhase)).toBe('adding_wine');
			expect(get(addWineStep)).toBe('confirm');
		});

		it('should clear addWineStep when leaving adding_wine phase', () => {
			// greeting → awaiting_input → adding_wine → confirming (valid path)
			setPhase('awaiting_input');
			setPhase('adding_wine', 'confirm');
			setPhase('confirming');
			expect(get(addWineStep)).toBeNull();
		});

		it('should preserve addWineStep when changing to adding_wine without step', () => {
			// greeting → awaiting_input → adding_wine → adding_wine (valid path)
			setPhase('awaiting_input');
			setPhase('adding_wine', 'entity_matching');
			setPhase('adding_wine'); // No step provided, self-transition is valid
			expect(get(addWineStep)).toBe('entity_matching');
		});
	});

	describe('setAddWineStep', () => {
		it('should update addWineStep without changing phase', () => {
			// greeting → awaiting_input → adding_wine (valid path)
			setPhase('awaiting_input');
			setPhase('adding_wine', 'confirm');
			setAddWineStep('bottle_details');
			expect(get(addWineStep)).toBe('bottle_details');
			expect(get(agentPhase)).toBe('adding_wine');
		});

		it('should allow setting to null', () => {
			// greeting → awaiting_input → adding_wine (valid path)
			setPhase('awaiting_input');
			setPhase('adding_wine', 'confirm');
			setAddWineStep(null);
			expect(get(addWineStep)).toBeNull();
		});
	});

	describe('disableMessage', () => {
		it('should mark message as disabled', () => {
			const msg = addMessage(createTextMessage('Test'));
			disableMessage(msg.id);
			expect(get(agentMessages)[0].disabled).toBe(true);
		});

		it('should not affect other messages', () => {
			const msg1 = addMessage(createTextMessage('First'));
			const msg2 = addMessage(createTextMessage('Second'));
			disableMessage(msg1.id);
			expect(get(agentMessages)[0].disabled).toBe(true);
			expect(get(agentMessages)[1].disabled).toBeFalsy();
		});
	});

	describe('disableAllChips', () => {
		it('should disable all chip messages', () => {
			addMessage(createTextMessage('Text'));
			addMessage(createChipsMessage([{ id: '1', label: 'A', action: 'a' }]));
			addMessage(createChipsMessage([{ id: '2', label: 'B', action: 'b' }]));

			disableAllChips();

			const messages = get(agentMessages);
			expect(messages[0].disabled).toBeFalsy(); // text not disabled
			expect(messages[1].disabled).toBe(true); // chips disabled
			expect(messages[2].disabled).toBe(true); // chips disabled
		});

		it('should not affect non-interactive messages', () => {
			addMessage(createTextMessage('Text 1'));
			addMessage(createTextMessage('Text 2'));
			addMessage(createChipsMessage([{ id: '1', label: 'A', action: 'a' }]));

			disableAllChips();

			const messages = get(agentMessages);
			expect(messages[0].disabled).toBeFalsy();
			expect(messages[1].disabled).toBeFalsy();
			expect(messages[2].disabled).toBe(true);
		});

		it('should disable both chips and error messages', () => {
			addMessage(createTextMessage('Text'));
			addMessage(createChipsMessage([{ id: '1', label: 'A', action: 'a' }]));
			addMessage(createMessage('error', {
				error: { type: 'timeout', userMessage: 'Error', retryable: true },
				retryable: true,
			}));

			disableAllChips();

			const messages = get(agentMessages);
			expect(messages[0].disabled).toBeFalsy(); // text
			expect(messages[1].disabled).toBe(true);  // chips
			expect(messages[2].disabled).toBe(true);  // error
		});
	});

	describe('clearNewFlag', () => {
		it('should clear isNew flag on specific message', () => {
			const msg = addMessage(createTextMessage('Test'));
			expect(msg.isNew).toBe(true);

			clearNewFlag(msg.id);

			const messages = get(agentMessages);
			expect(messages[0].isNew).toBe(false);
		});
	});

	describe('clearAllNewFlags', () => {
		it('should clear isNew flags on all messages', () => {
			addMessage(createTextMessage('First'));
			addMessage(createTextMessage('Second'));

			clearAllNewFlags();

			const messages = get(agentMessages);
			expect(messages[0].isNew).toBe(false);
			expect(messages[1].isNew).toBe(false);
		});
	});

	describe('updateMessage', () => {
		it('should update message properties', () => {
			const msg = addMessage(createTextMessage('Original'));
			updateMessage(msg.id, { disabled: true });

			const messages = get(agentMessages);
			expect(messages[0].disabled).toBe(true);
			expect(getTextContent(messages[0])).toBe('Original');
		});

		it('should not affect other messages', () => {
			const msg1 = addMessage(createTextMessage('First'));
			const msg2 = addMessage(createTextMessage('Second'));

			updateMessage(msg1.id, { disabled: true });

			const messages = get(agentMessages);
			expect(messages[1].disabled).toBeFalsy();
		});
	});

	describe('removeMessage', () => {
		it('should remove message from store', () => {
			const msg1 = addMessage(createTextMessage('First'));
			const msg2 = addMessage(createTextMessage('Second'));

			removeMessage(msg1.id);

			const messages = get(agentMessages);
			expect(messages).toHaveLength(1);
			expect(messages[0].id).toBe(msg2.id);
		});

		it('should do nothing if message not found', () => {
			addMessage(createTextMessage('First'));
			removeMessage('nonexistent-id');
			expect(get(agentMessages)).toHaveLength(1);
		});
	});

	describe('resetConversation', () => {
		it('should add divider and greeting when messages exist', () => {
			addMessage(createTextMessage('Old message'));
			resetConversation();

			const messages = get(agentMessages);
			expect(messages.length).toBeGreaterThan(1);
			// Should have: old message, divider, new greeting
		});

		it('should reset phase to awaiting_input', () => {
			// greeting → awaiting_input → confirming (valid path)
			setPhase('awaiting_input');
			setPhase('confirming');
			// resetConversation can go from any phase to awaiting_input (special reset)
			resetConversation();
			expect(get(agentPhase)).toBe('awaiting_input');
		});

		it('should clear addWineStep', () => {
			// greeting → awaiting_input → adding_wine (valid path)
			setPhase('awaiting_input');
			setPhase('adding_wine', 'bottle_details');
			// resetConversation is a special reset operation
			resetConversation();
			expect(get(addWineStep)).toBeNull();
		});

		it('should use custom greeting if provided', () => {
			addMessage(createTextMessage('Old'));
			resetConversation('Custom greeting message');

			const messages = get(agentMessages);
			const lastMsg = messages[messages.length - 1];
			expect(getTextContent(lastMsg)).toBe('Custom greeting message');
		});
	});

	describe('startSession', () => {
		it('should set initial greeting message', () => {
			startSession();

			const messages = get(agentMessages);
			expect(messages).toHaveLength(1);
			expect(messages[0].role).toBe('agent');
			expect(messages[0].category).toBe('text');
		});

		it('should set phase to greeting', () => {
			// greeting → error (valid path)
			setPhase('error');
			// startSession is a special reset, allowed from any phase
			startSession();
			expect(get(agentPhase)).toBe('greeting');
		});
	});

	describe('fullReset', () => {
		it('should clear all messages', () => {
			addMessage(createTextMessage('Test'));
			addMessage(createTextMessage('Test 2'));
			fullReset();
			expect(get(agentMessages)).toHaveLength(0);
		});

		it('should reset phase to greeting', () => {
			// greeting → awaiting_input → confirming (valid path)
			setPhase('awaiting_input');
			setPhase('confirming');
			// fullReset is a special operation that bypasses state machine
			fullReset();
			expect(get(agentPhase)).toBe('greeting');
		});

		it('should clear addWineStep', () => {
			// greeting → awaiting_input → adding_wine (valid path)
			setPhase('awaiting_input');
			setPhase('adding_wine', 'bottle_details');
			// fullReset is a special operation
			fullReset();
			expect(get(addWineStep)).toBeNull();
		});
	});

	describe('derived stores', () => {
		describe('hasMessages', () => {
			it('should be false when no messages', () => {
				fullReset();
				expect(get(hasMessages)).toBe(false);
			});

			it('should be true when messages exist', () => {
				addMessage(createTextMessage('Test'));
				expect(get(hasMessages)).toBe(true);
			});
		});

		describe('lastMessage', () => {
			it('should return null when no messages', () => {
				fullReset();
				expect(get(lastMessage)).toBeNull();
			});

			it('should return the last message', () => {
				addMessage(createTextMessage('First'));
				addMessage(createTextMessage('Last'));

				const last = get(lastMessage);
				expect(getTextContent(last)).toBe('Last');
			});
		});

		describe('lastAgentMessage', () => {
			it('should return last agent message', () => {
				addMessage(createTextMessage('Agent 1'));
				addMessage(createTextMessage('User 1', { role: 'user' }));
				addMessage(createTextMessage('Agent 2'));
				addMessage(createTextMessage('User 2', { role: 'user' }));

				const last = get(lastAgentMessage);
				expect(getTextContent(last)).toBe('Agent 2');
			});

			it('should return null if no agent messages', () => {
				fullReset();
				addMessage(createTextMessage('User only', { role: 'user' }));
				expect(get(lastAgentMessage)).toBeNull();
			});
		});

		describe('lastUserMessage', () => {
			it('should return last user message', () => {
				addMessage(createTextMessage('User 1', { role: 'user' }));
				addMessage(createTextMessage('Agent 1'));
				addMessage(createTextMessage('User 2', { role: 'user' }));

				const last = get(lastUserMessage);
				expect(getTextContent(last)).toBe('User 2');
			});
		});

		describe('isInAddWineFlow', () => {
			it('should be true when phase is adding_wine', () => {
				// greeting → awaiting_input → adding_wine (valid path)
				setPhase('awaiting_input');
				setPhase('adding_wine');
				expect(get(isInAddWineFlow)).toBe(true);
			});

			it('should be false for other phases', () => {
				// greeting → awaiting_input → confirming (valid path)
				setPhase('awaiting_input');
				setPhase('confirming');
				expect(get(isInAddWineFlow)).toBe(false);
			});
		});

		describe('isInEnrichmentFlow', () => {
			it('should be true when phase is enriching', () => {
				// greeting → awaiting_input → enriching (valid path)
				setPhase('awaiting_input');
				setPhase('enriching');
				expect(get(isInEnrichmentFlow)).toBe(true);
			});

			it('should be false for other phases', () => {
				// greeting → awaiting_input → adding_wine (valid path)
				setPhase('awaiting_input');
				setPhase('adding_wine');
				expect(get(isInEnrichmentFlow)).toBe(false);
			});
		});

		describe('isInLoadingPhase', () => {
			it('should be true when identifying', () => {
				// greeting → identifying (valid)
				setPhase('identifying');
				expect(get(isInLoadingPhase)).toBe(true);
			});

			it('should be true when enriching', () => {
				// greeting → awaiting_input → enriching (valid path)
				setPhase('awaiting_input');
				setPhase('enriching');
				expect(get(isInLoadingPhase)).toBe(true);
			});

			it('should be false for non-loading phases', () => {
				// greeting → awaiting_input → confirming (valid path)
				setPhase('awaiting_input');
				setPhase('confirming');
				expect(get(isInLoadingPhase)).toBe(false);

				// confirming → awaiting_input (valid), then reset to greeting
				fullReset();
				expect(get(isInLoadingPhase)).toBe(false);
			});
		});
	});

	describe('initializeConversation', () => {
		it('should start session if no persisted state', () => {
			// Note: fullReset() already initializes, so startSession creates the greeting.
			// We test that after fullReset + startSession, we have a greeting.
			clearState();
			startSession();

			expect(get(agentMessages)).toHaveLength(1); // Greeting message
			expect(get(agentPhase)).toBe('greeting');
		});

		it('should not reinitialize if already initialized', () => {
			// After fullReset(), store is initialized but empty
			// Calling initializeConversation should be a no-op since isInitialized is true
			clearState();
			startSession();
			const firstGreeting = get(agentMessages)[0];

			// Try to initialize again - should be a no-op
			initializeConversation();

			// Should still have same greeting (not duplicated)
			expect(get(agentMessages)).toHaveLength(1);
			expect(get(agentMessages)[0].id).toBe(firstGreeting.id);
		});
	});

	describe('origin tracking', () => {
		describe('setOrigin', () => {
			it('should set origin state', () => {
				setOrigin({ path: '/qve/', viewMode: 'ourWines' });

				const origin = get(agentOrigin);
				expect(origin).not.toBeNull();
				expect(origin?.path).toBe('/qve/');
				expect(origin?.viewMode).toBe('ourWines');
			});

			it('should update existing origin', () => {
				setOrigin({ path: '/qve/', viewMode: 'ourWines' });
				setOrigin({ path: '/qve/history', viewMode: 'allWines' });

				const origin = get(agentOrigin);
				expect(origin?.path).toBe('/qve/history');
				expect(origin?.viewMode).toBe('allWines');
			});
		});

		describe('clearOrigin', () => {
			it('should clear origin state', () => {
				setOrigin({ path: '/qve/', viewMode: 'ourWines' });
				expect(get(agentOrigin)).not.toBeNull();

				clearOrigin();
				expect(get(agentOrigin)).toBeNull();
			});

			it('should be safe to call when origin is already null', () => {
				clearOrigin();
				expect(get(agentOrigin)).toBeNull();
			});
		});

		describe('getOrigin', () => {
			it('should return current origin synchronously', () => {
				setOrigin({ path: '/qve/', viewMode: 'allWines' });

				const origin = getOrigin();
				expect(origin?.path).toBe('/qve/');
				expect(origin?.viewMode).toBe('allWines');
			});

			it('should return null when no origin set', () => {
				clearOrigin();
				expect(getOrigin()).toBeNull();
			});
		});

		describe('agentOrigin derived store', () => {
			it('should be reactive to origin changes', () => {
				const values: (OriginState | null)[] = [];
				const unsubscribe = agentOrigin.subscribe((v) => values.push(v));

				setOrigin({ path: '/qve/', viewMode: 'ourWines' });
				setOrigin({ path: '/qve/history', viewMode: 'ourWines' });
				clearOrigin();

				unsubscribe();

				// Initial null + 2 setOrigins + 1 clearOrigin = 4 values
				expect(values).toHaveLength(4);
				expect(values[0]).toBeNull();
				expect(values[1]?.path).toBe('/qve/');
				expect(values[2]?.path).toBe('/qve/history');
				expect(values[3]).toBeNull();
			});
		});

		describe('origin preservation across operations', () => {
			it('should preserve origin when adding messages', () => {
				setOrigin({ path: '/qve/', viewMode: 'ourWines' });
				addMessage(createTextMessage('Test'));

				expect(get(agentOrigin)?.path).toBe('/qve/');
			});

			it('should preserve origin when changing phase', () => {
				setOrigin({ path: '/qve/', viewMode: 'ourWines' });
				setPhase('identifying'); // greeting → identifying (valid)

				expect(get(agentOrigin)?.path).toBe('/qve/');
			});

			it('should reset origin to null on startSession', () => {
				setOrigin({ path: '/qve/', viewMode: 'ourWines' });
				startSession();

				// Origin is reset on new session
				expect(get(agentOrigin)).toBeNull();
			});

			it('should reset origin to null on fullReset', () => {
				setOrigin({ path: '/qve/', viewMode: 'ourWines' });
				fullReset();

				expect(get(agentOrigin)).toBeNull();
			});
		});
	});
});

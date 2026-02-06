/**
 * Camera Handlers
 *
 * Handles camera-related actions that delegate to UI layer:
 * - take_photo: Opens camera via UI component
 * - choose_photo: Opens photo picker via UI component
 *
 * These handlers only disable the chip message. The actual camera/picker
 * interaction is handled by AgentPanel.svelte component which listens
 * to chip clicks and triggers the appropriate native functionality.
 *
 * Sprint 6 extraction - Final router migration.
 */

import type { AgentAction } from '../types';
import * as conversation from '$lib/stores/agentConversation';

// ===========================================
// Action Types
// ===========================================

type CameraActionType = 'take_photo' | 'choose_photo';

// ===========================================
// Handlers
// ===========================================

/**
 * Handle take_photo action.
 * Disables the chip message. Camera opening handled by UI layer.
 */
function handleTakePhoto(messageId: string): void {
  console.log('[Camera] take_photo - delegating to UI');
  conversation.disableMessage(messageId);
  // Camera opening triggered by AgentPanel.svelte
}

/**
 * Handle choose_photo action.
 * Disables the chip message. Photo picker handled by UI layer.
 */
function handleChoosePhoto(messageId: string): void {
  console.log('[Camera] choose_photo - delegating to UI');
  conversation.disableMessage(messageId);
  // Photo picker triggered by AgentPanel.svelte
}

// ===========================================
// Type Guard & Router
// ===========================================

/**
 * Check if an action type is a camera action.
 */
export function isCameraAction(type: string): type is CameraActionType {
  return ['take_photo', 'choose_photo'].includes(type);
}

/**
 * Handle a camera action.
 */
export function handleCameraAction(action: AgentAction): void {
  switch (action.type) {
    case 'take_photo':
      handleTakePhoto(action.messageId ?? '');
      break;

    case 'choose_photo':
      handleChoosePhoto(action.messageId ?? '');
      break;
  }
}

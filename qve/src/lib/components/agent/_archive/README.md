# Archived Agent Components

This folder contains legacy Svelte components replaced by the Phase 2 rearchitecture.

## Archived Files

### AgentPanel.legacy.txt
- **Original**: `AgentPanel.svelte` (4,037 lines / 133KB)
- **Archived**: 2026-02-05
- **Replaced by**: New `AgentPanel.svelte` (300 lines / 11KB)
- **Reason**: Monolithic component with embedded business logic

### ChatMessage.legacy.txt
- **Original**: `ChatMessage.svelte` (16KB)
- **Archived**: 2026-02-05
- **Replaced by**: `conversation/MessageList.svelte` + `content/*.svelte`
- **Reason**: Only used by legacy AgentPanel

### CommandInput.legacy.txt
- **Original**: `CommandInput.svelte` (5.6KB)
- **Archived**: 2026-02-05
- **Replaced by**: `conversation/InputArea.svelte`
- **Reason**: Only used by legacy AgentPanel

### ActionChips.legacy.txt
- **Original**: `ActionChips.svelte` (3.5KB)
- **Archived**: 2026-02-05
- **Replaced by**: `content/ChipsMessage.svelte`
- **Reason**: Only used by legacy ChatMessage

## New Architecture

```
AgentPanel.svelte           - Slim shell (300 lines)
conversation/
├── AgentChatContainer.svelte  - Chat layout with auto-scroll
├── MessageList.svelte         - Message rendering
├── InputArea.svelte           - Text/image input
└── MessageWrapper.svelte      - Individual message wrapper
content/
├── TextMessage.svelte
├── ChipsMessage.svelte        - Action chips (replaces ActionChips)
├── WineCardMessage.svelte
├── EnrichmentMessage.svelte
├── FormMessage.svelte
├── ErrorMessage.svelte
└── ImageMessage.svelte
```

All business logic now lives in `$lib/agent/router.ts` and handlers.

# Archived Agent Code

This folder contains legacy code that has been replaced by the Phase 2 rearchitecture.

## Archived Files

### handleAgentAction.legacy.txt
- **Original**: `handleAgentAction.ts` (2,831 lines)
- **Archived**: 2026-02-05
- **Reason**: Replaced by modular router + handler system

## Replacement Architecture

The monolithic handler has been replaced with:

```
router.ts              - Central action router with middleware
handlers/
├── conversation.ts    - Navigation & session (start_over, go_back, cancel, retry)
├── identification.ts  - Wine identification (submit_text, submit_image, correct)
├── enrichment.ts      - Wine enrichment (learn, remember, recommend)
├── addWine.ts         - Add wine flow (add_to_cellar, add_bottle_existing)
├── forms.ts           - Form submissions (submit_bottle, manual_entry_submit)
├── camera.ts          - Camera actions (take_photo, choose_photo)
└── index.ts           - Barrel exports
middleware/
├── errorHandler.ts    - Unified error handling
├── retryTracker.ts    - Action tracking for retry
├── validator.ts       - Phase/state validation
└── types.ts           - Middleware types
```

## Migration Reference

- Sprint 1: Middleware system & router shell
- Sprint 2: Conversation & identification handlers
- Sprint 3: Enrichment handlers
- Sprint 4: AddWine handlers
- Sprint 5: Forms handlers & test expansion
- Sprint 6: Final migration & legacy removal

See `docs/PHASE_2_REARCHITECTURE.md` for full details.

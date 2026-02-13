/**
 * Message Key Enum
 *
 * Type-safe message identifiers for the agent message registry.
 * All agent messages are defined using these keys.
 *
 * @example
 * import { MessageKey } from '$lib/agent/messageKeys';
 * import { getMessageByKey } from '$lib/agent/messages';
 *
 * const greeting = getMessageByKey(MessageKey.GREETING_MORNING);
 * const found = getMessageByKey(MessageKey.ID_FOUND, { wineName: 'Margaux' });
 */

export enum MessageKey {
  // ===========================================
  // GREETINGS (time-based)
  // ===========================================
  GREETING_MORNING = 'greeting.morning',
  GREETING_AFTERNOON = 'greeting.afternoon',
  GREETING_EVENING = 'greeting.evening',
  GREETING_DEFAULT = 'greeting.default',

  // ===========================================
  // IDENTIFICATION
  // ===========================================
  ID_THINKING = 'identification.thinking',
  ID_ANALYZING = 'identification.analyzing',
  ID_FOUND = 'identification.found',
  ID_NOT_FOUND = 'identification.notFound',
  ID_LOW_CONFIDENCE = 'identification.lowConfidence',
  ID_ESCALATING = 'identification.escalating',
  ID_VERIFYING = 'identification.verifying',
  ID_MULTIPLE_MATCHES = 'identification.multipleMatches',
  ID_NEEDS_MORE_INFO = 'identification.needMoreInfo',
  ID_MISSING_WINE_NAME = 'identification.missingWineName',
  ID_MISSING_VINTAGE = 'identification.missingVintage',
  ID_MISSING_PRODUCER = 'identification.missingProducer',
  ID_INCOMPLETE = 'identification.incomplete',
  ID_SUGGEST_REIDENTIFY = 'identification.suggestReidentify',

  // ===========================================
  // IDENTIFICATION - Extended
  // ===========================================
  /** "I detected {grape} as the grape variety..." - grape only, no producer/wine */
  ID_GRAPE_ONLY = 'identification.grapeOnly',
  /** "Just '{text}'? Adding more detail will improve..." */
  ID_BRIEF_INPUT_CONFIRM = 'identification.briefInputConfirm',
  /** "I'm not sure what you wanted to search..." */
  ID_SEARCH_UNCLEAR = 'identification.searchUnclear',
  /** "I don't have enough information to search..." */
  ID_INSUFFICIENT_INFO = 'identification.insufficientInfo',
  /** "Let me try to find a better match..." */
  ID_REIDENTIFYING = 'identification.reidentifying',
  /** "I've gathered the details for {wineName}. Try matching or add manually?" */
  ID_LOW_CONFIDENCE_COMPLETE = 'identification.lowConfidenceComplete',
  /** Detailed producer prompt with instructions */
  ID_PROMPT_PRODUCER = 'identification.promptProducer',
  /** Detailed wine name prompt with instructions */
  ID_PROMPT_WINE_NAME = 'identification.promptWineName',
  /** Detailed vintage prompt with instructions */
  ID_PROMPT_VINTAGE = 'identification.promptVintage',
  /** Generic details prompt */
  ID_PROMPT_DETAILS = 'identification.promptDetails',
  /** "Tell me what's different about this wine..." */
  ID_PROVIDE_MORE_CONTEXT = 'identification.provideMoreContext',
  /** Grape with producer: "I found {producer} and detected {grape}..." */
  ID_INCOMPLETE_GRAPES_WITH_PRODUCER = 'identification.incompleteGrapesWithProducer',
  /** Grape without producer: "I detected {grape} but couldn't identify producer..." */
  ID_INCOMPLETE_GRAPES_NO_PRODUCER = 'identification.incompleteGrapesNoProducer',

  // ===========================================
  // CONFIRMATION
  // ===========================================
  CONFIRM_CORRECT = 'confirm.correct',
  CONFIRM_INCORRECT = 'confirm.incorrect',
  CONFIRM_NEW_SEARCH = 'confirm.newSearch',
  CONFIRM_KEEP_CURRENT = 'confirm.keepCurrent',
  /** "Excellent. What would you like to do with {wineName}?" */
  CONFIRM_ACTION_PROMPT = 'confirm.actionPrompt',

  // ===========================================
  // CONVERSATION FLOW
  // ===========================================
  /** "Let me know what wine you'd like to identify." */
  CONV_AWAITING_INPUT = 'conversation.awaitingInput',
  /** "What would you like to do with this wine?" */
  CONV_ACTION_PROMPT = 'conversation.actionPrompt',
  /** "Nothing to retry. What would you like to identify?" */
  CONV_NOTHING_TO_RETRY = 'conversation.nothingToRetry',

  // ===========================================
  // ADD WINE FLOW
  // ===========================================
  ADD_START = 'addFlow.start',
  ADD_REGION_PROMPT = 'addFlow.regionPrompt',
  ADD_PRODUCER_PROMPT = 'addFlow.producerPrompt',
  ADD_WINE_PROMPT = 'addFlow.winePrompt',
  ADD_DUPLICATE_FOUND = 'addFlow.duplicateFound',
  ADD_BOTTLE_PROMPT = 'addFlow.bottlePrompt',
  ADD_ENRICHMENT_PROMPT = 'addFlow.enrichmentPrompt',
  ADD_COMPLETE = 'addFlow.addComplete',
  ADD_FAILED = 'addFlow.addFailed',
  /** "Adding to your cellar..." */
  ADD_SUBMITTING = 'addFlow.submitting',
  /** "Adding bottle to your cellar..." */
  ADD_BOTTLE_SUBMITTING = 'addFlow.bottleSubmitting',
  /** "Added another bottle of {wineName} to your cellar!" */
  ADD_BOTTLE_COMPLETE = 'addFlow.bottleComplete',
  /** "Something went wrong adding the bottle." */
  ADD_BOTTLE_FAILED = 'addFlow.bottleFailed',
  /** "I'll create this as a new wine entry." */
  ADD_CREATE_NEW_WINE = 'addFlow.createNewWine',

  // ===========================================
  // ENTITY MATCHING
  // ===========================================
  /** "I'll create a new {entityType} entry." */
  ENTITY_AUTO_CREATE = 'entity.autoCreate',
  /** "No existing {entityType}s match '{searchTerm}'. I'll create new." */
  ENTITY_NO_MATCH = 'entity.noMatch',
  /** "Found existing {entityType}: {name}" */
  ENTITY_FOUND = 'entity.found',
  /** "I found {count} {entityType}s that might match '{searchTerm}'." */
  ENTITY_MULTIPLE = 'entity.multiple',
  /** "Selected: {name}" */
  ENTITY_SELECTED = 'entity.selected',
  /** "Creating new {entityType}: {name}" */
  ENTITY_CREATING = 'entity.creating',
  /** "Let me help you decide..." */
  ENTITY_CLARIFYING = 'entity.clarifying',
  /** "I couldn't get more details. Please select or create new." */
  ENTITY_CLARIFY_FAILED = 'entity.clarifyFailed',
  /** "No matches to clarify. Creating new entry." */
  ENTITY_NO_CLARIFY_MATCHES = 'entity.noClarifyMatches',

  // ===========================================
  // BOTTLE & FORM FLOW
  // ===========================================
  /** "Great! Now let's add the bottle details." */
  BOTTLE_DETAILS_PROMPT = 'bottle.detailsPrompt',
  /** "Almost done! Would you like to add enrichment data?" */
  BOTTLE_ENRICHMENT_OFFER = 'bottle.enrichmentOffer',
  /** "Continuing with your wine details..." */
  BOTTLE_CONTINUING = 'bottle.continuing',
  /** "Unable to retry. Please start over." */
  BOTTLE_RETRY_FAILED = 'bottle.retryFailed',

  // ===========================================
  // ENRICHMENT
  // ===========================================
  ENRICH_LOADING = 'enrichment.loading',
  ENRICH_COMPLETE = 'enrichment.complete',
  ENRICH_NO_DATA = 'enrichment.noData',
  ENRICH_CACHED = 'enrichment.cached',
  /** "Here's what I found about {wineName}. What would you like to do next?" */
  ENRICH_FOUND_DETAILS = 'enrichment.foundDetails',
  /** "I found cached data for {wineName}. Is this the wine you're looking for?" */
  ENRICH_CACHE_CONFIRM = 'enrichment.cacheConfirm',
  /** "Using cached data..." */
  ENRICH_USING_CACHE = 'enrichment.usingCache',
  /** "Searching for fresh data..." */
  ENRICH_REFRESHING = 'enrichment.refreshing',
  /** "Recommendations coming soon!" */
  ENRICH_RECOMMEND_SOON = 'enrichment.recommendSoon',
  /** "Memories are a function coming later..." */
  ENRICH_REMEMBER_SOON = 'enrichment.rememberSoon',

  // ===========================================
  // ERRORS
  // ===========================================
  ERROR_TIMEOUT = 'errors.timeout',
  ERROR_RATE_LIMIT = 'errors.rateLimit',
  ERROR_LIMIT_EXCEEDED = 'errors.limitExceeded',
  ERROR_GENERIC = 'errors.generic',
  ERROR_IMAGE_UNCLEAR = 'errors.imageUnclear',
  ERROR_NETWORK = 'errors.network',
  ERROR_NO_RESULT = 'errors.noResult',

  // ===========================================
  // CHIP LABELS
  // ===========================================
  CHIP_ADD_TO_CELLAR = 'chips.addToCellar',
  CHIP_LEARN_MORE = 'chips.learnMore',
  CHIP_REMEMBER = 'chips.remember',
  CHIP_CORRECT = 'chips.correct',
  CHIP_NOT_CORRECT = 'chips.notCorrect',
  CHIP_TRY_AGAIN = 'chips.tryAgain',
  CHIP_START_OVER = 'chips.startOver',
  CHIP_CANCEL = 'chips.cancel',
  CHIP_YES = 'chips.yes',
  CHIP_NO = 'chips.no',
  CHIP_ADD_DETAILS = 'chips.addDetails',
  CHIP_TRY_HARDER = 'chips.tryHarder',
  CHIP_START_FRESH = 'chips.startFresh',
  CHIP_PROVIDE_MORE = 'chips.provideMore',
  CHIP_USE_PRODUCER_NAME = 'chips.useProducerName',
  CHIP_USE_GRAPE_NAME = 'chips.useGrapeName',
  CHIP_NON_VINTAGE = 'chips.nonVintage',
  CHIP_SPECIFY_VINTAGE = 'chips.specifyVintage',
  CHIP_LOOKS_GOOD = 'chips.looksGood',
  CHIP_REIDENTIFY = 'chips.reidentify',
  CHIP_CONTINUE_AS_IS = 'chips.continueAsIs',
  CHIP_SEARCH_ANYWAY = 'chips.searchAnyway',
  CHIP_ADD_MORE = 'chips.addMore',
  CHIP_SEARCH_NEW = 'chips.searchNew',
  CHIP_KEEP_CURRENT = 'chips.keepCurrent',
  CHIP_ENRICH_NOW = 'chips.enrichNow',
  CHIP_ADD_QUICKLY = 'chips.addQuickly',
  CHIP_USE_CACHED = 'chips.useCached',
  CHIP_SEARCH_ONLINE = 'chips.searchOnline',
  CHIP_ADD_BOTTLE = 'chips.addBottle',
  CHIP_CREATE_NEW = 'chips.createNew',
  CHIP_TAKE_PHOTO = 'chips.takePhoto',
  CHIP_CHOOSE_PHOTO = 'chips.choosePhoto',
  CHIP_IDENTIFY_ANOTHER = 'chips.identifyAnother',
  CHIP_ADD_WITHOUT_DETAILS = 'chips.addWithoutDetails',
  CHIP_USE_THIS_RESULT = 'chips.useThisResult',
  CHIP_SEARCH_AGAIN = 'chips.searchAgain',
  CHIP_CORRECT_FIELD = 'chips.correctField',
  CHIP_CONFIRM_CORRECTIONS = 'chips.confirmCorrections',
  CHIP_VERIFY = 'chips.verify',
}

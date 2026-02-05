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
  ID_MULTIPLE_MATCHES = 'identification.multipleMatches',
  ID_NEEDS_MORE_INFO = 'identification.needMoreInfo',
  ID_MISSING_WINE_NAME = 'identification.missingWineName',
  ID_MISSING_VINTAGE = 'identification.missingVintage',
  ID_MISSING_PRODUCER = 'identification.missingProducer',
  ID_INCOMPLETE = 'identification.incomplete',
  ID_SUGGEST_REIDENTIFY = 'identification.suggestReidentify',

  // ===========================================
  // CONFIRMATION
  // ===========================================
  CONFIRM_CORRECT = 'confirm.correct',
  CONFIRM_INCORRECT = 'confirm.incorrect',
  CONFIRM_NEW_SEARCH = 'confirm.newSearch',
  CONFIRM_KEEP_CURRENT = 'confirm.keepCurrent',

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

  // ===========================================
  // ENRICHMENT
  // ===========================================
  ENRICH_LOADING = 'enrichment.loading',
  ENRICH_COMPLETE = 'enrichment.complete',
  ENRICH_NO_DATA = 'enrichment.noData',
  ENRICH_CACHED = 'enrichment.cached',

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
}

/**
 * Neutral Personality Messages
 *
 * Clear, functional, personality-free messages.
 * Used as the universal fallback when a personality-specific
 * message is not defined.
 *
 * These are the "safe default" — no character, no wit, just
 * clear communication. Every MessageKey should have an entry here.
 */

import { MessageKey } from '../messageKeys';
import { type PersonalityMessages, type MessageContext, wn } from '../personalities';

export const neutralMessages: PersonalityMessages = {
  // ===========================================
  // GREETINGS
  // ===========================================
  [MessageKey.GREETING_MORNING]: [
    "Good morning! I'm your wine sommelier. What can I help you with today?",
    'Morning! Ready to add some wines to your collection?',
    'Good morning! What wine adventure shall we start today?',
    "Rise and shine! Let's find your next great bottle.",
    "Good morning! I'm here to help with your cellar.",
  ],

  [MessageKey.GREETING_AFTERNOON]: [
    'Good afternoon! Ready to explore some wines?',
    'Afternoon! What wine can I help you discover?',
    'Good afternoon! Looking to add to your collection?',
    'Hello there! What brings you to the cellar today?',
    "Good afternoon! Let's find something special.",
  ],

  [MessageKey.GREETING_EVENING]: [
    "Good evening! Let's find the perfect wine for you.",
    'Evening! Time to explore some wines?',
    'Good evening! What can I help you uncork tonight?',
    'Good evening! Ready to discover something special?',
    "Evening! Let's find the perfect bottle for tonight.",
  ],

  [MessageKey.GREETING_DEFAULT]: "Hello! I'm your wine sommelier. How can I help you today?",

  // ===========================================
  // IDENTIFICATION
  // ===========================================
  [MessageKey.ID_THINKING]: 'Let me identify that wine...',
  [MessageKey.ID_ANALYZING]: 'Analyzing the label...',

  [MessageKey.ID_FOUND]: (ctx: MessageContext) =>
    `I found ${wn(ctx.wineName || 'this wine')}. Is this correct?`,

  [MessageKey.ID_NOT_FOUND]: "I couldn't identify that wine. Could you tell me more about it?",

  [MessageKey.ID_LOW_CONFIDENCE]: (ctx: MessageContext) =>
    `I'm not entirely sure, but this might be ${wn(ctx.wineName || 'the wine you\'re looking for')}.`,

  [MessageKey.ID_ESCALATING]: 'Let me take a closer look at this...',
  [MessageKey.ID_VERIFYING]: 'Let me verify this with a web search...',

  [MessageKey.ID_MULTIPLE_MATCHES]: 'I found a few possibilities. Which one looks right?',

  [MessageKey.ID_NEEDS_MORE_INFO]: 'I need a bit more information to identify this wine.',

  [MessageKey.ID_MISSING_WINE_NAME]:
    "I found the producer but couldn't identify the specific wine. Would you like to add details or use a suggestion?",

  [MessageKey.ID_MISSING_VINTAGE]:
    "I couldn't determine the vintage. Is this a non-vintage wine, or would you like to specify?",

  [MessageKey.ID_MISSING_PRODUCER]:
    "I identified the wine but couldn't determine the producer. Who makes this wine?",

  [MessageKey.ID_INCOMPLETE]: 'This result is missing some details. How would you like to proceed?',

  [MessageKey.ID_SUGGEST_REIDENTIFY]:
    "Thanks for filling in the gaps! I can try to identify this wine again with the complete information - I might find a better match. Or you can continue with your manually entered details.",

  // ===========================================
  // CONFIRMATION
  // ===========================================
  [MessageKey.CONFIRM_CORRECT]: 'Great! What would you like to do next?',
  [MessageKey.CONFIRM_INCORRECT]: 'No problem. What did I get wrong?',
  [MessageKey.CONFIRM_NEW_SEARCH]: 'Did you want to search for something new instead?',
  [MessageKey.CONFIRM_KEEP_CURRENT]: "Alright, let's continue with the current wine.",

  // ===========================================
  // ADD WINE FLOW
  // ===========================================
  [MessageKey.ADD_START]: "Let's add this to your cellar.",
  [MessageKey.ADD_REGION_PROMPT]: 'Which region is this wine from?',
  [MessageKey.ADD_PRODUCER_PROMPT]: 'Who makes this wine?',
  [MessageKey.ADD_WINE_PROMPT]: 'Which wine is this?',

  [MessageKey.ADD_DUPLICATE_FOUND]: (ctx: MessageContext) => {
    const s = ctx.bottleCount !== 1 ? 's' : '';
    return `I found ${wn(ctx.wineName || 'this wine')} already in your cellar with ${ctx.bottleCount} bottle${s}.`;
  },

  [MessageKey.ADD_BOTTLE_PROMPT]: 'Tell me about this bottle.',
  [MessageKey.ADD_ENRICHMENT_PROMPT]:
    'Would you like me to gather more details about this wine?',

  [MessageKey.ADD_COMPLETE]: (ctx: MessageContext) =>
    `Added ${wn(ctx.wineName || 'the wine')} to your cellar!`,

  [MessageKey.ADD_FAILED]: "I couldn't add this wine to your cellar. Please try again.",

  // ===========================================
  // ENRICHMENT
  // ===========================================
  [MessageKey.ENRICH_LOADING]: 'Gathering details about this wine...',
  [MessageKey.ENRICH_COMPLETE]: "Here's what I found.",
  [MessageKey.ENRICH_NO_DATA]: "I couldn't find additional details for this wine.",
  [MessageKey.ENRICH_CACHED]: 'I have some details saved for this wine.',

  // ===========================================
  // ERRORS
  // ===========================================
  [MessageKey.ERROR_TIMEOUT]: 'Our sommelier is taking longer than expected. Please try again.',
  [MessageKey.ERROR_RATE_LIMIT]:
    'Our sommelier is quite busy at the moment. Please wait a moment.',
  [MessageKey.ERROR_LIMIT_EXCEEDED]:
    "We've reached our tasting limit for today. Please try again tomorrow.",
  [MessageKey.ERROR_GENERIC]: 'Something went wrong. Please try again.',
  [MessageKey.ERROR_IMAGE_UNCLEAR]:
    "That image is a bit unclear. Could you try a clearer photo?",
  [MessageKey.ERROR_NETWORK]: 'Connection issue. Please check your network and try again.',
  [MessageKey.ERROR_NO_RESULT]:
    "I don't have a wine to work with. Please identify a wine first.",

  // ===========================================
  // CHIP LABELS
  // ===========================================
  [MessageKey.CHIP_ADD_TO_CELLAR]: 'Add to Cellar',
  [MessageKey.CHIP_LEARN_MORE]: 'Learn More',
  [MessageKey.CHIP_REMEMBER]: 'Remember',
  [MessageKey.CHIP_CORRECT]: 'Correct',
  [MessageKey.CHIP_NOT_CORRECT]: 'Not Correct',
  [MessageKey.CHIP_TRY_AGAIN]: 'Try Again',
  [MessageKey.CHIP_START_OVER]: 'Start Over',
  [MessageKey.CHIP_CANCEL]: 'Cancel',
  [MessageKey.CHIP_YES]: 'Yes',
  [MessageKey.CHIP_NO]: 'No',
  [MessageKey.CHIP_ADD_DETAILS]: 'Add More Details',
  [MessageKey.CHIP_TRY_HARDER]: 'Try Harder',
  [MessageKey.CHIP_START_FRESH]: 'Start Fresh',
  [MessageKey.CHIP_PROVIDE_MORE]: 'Provide More',
  [MessageKey.CHIP_USE_PRODUCER_NAME]: 'Use Producer Name',
  [MessageKey.CHIP_USE_GRAPE_NAME]: 'Use Grape Name',
  [MessageKey.CHIP_NON_VINTAGE]: 'Non-Vintage',
  [MessageKey.CHIP_SPECIFY_VINTAGE]: 'Specify Vintage',
  [MessageKey.CHIP_LOOKS_GOOD]: 'Looks Good',
  [MessageKey.CHIP_REIDENTIFY]: 'Re-identify',
  [MessageKey.CHIP_CONTINUE_AS_IS]: 'Continue As-Is',
  [MessageKey.CHIP_SEARCH_ANYWAY]: 'Search Anyway',
  [MessageKey.CHIP_ADD_MORE]: "I'll Add More",
  [MessageKey.CHIP_SEARCH_NEW]: 'Search New',
  [MessageKey.CHIP_KEEP_CURRENT]: 'Keep Current',
  [MessageKey.CHIP_ENRICH_NOW]: 'Yes, Enrich Now',
  [MessageKey.CHIP_ADD_QUICKLY]: 'No, Add Quickly',
  [MessageKey.CHIP_USE_CACHED]: 'Yes, use cached data',
  [MessageKey.CHIP_SEARCH_ONLINE]: 'No, search online',
  [MessageKey.CHIP_ADD_BOTTLE]: 'Add Another Bottle',
  [MessageKey.CHIP_CREATE_NEW]: 'Create New Wine',
  [MessageKey.CHIP_TAKE_PHOTO]: 'Take Photo',
  [MessageKey.CHIP_CHOOSE_PHOTO]: 'Choose Photo',
  [MessageKey.CHIP_IDENTIFY_ANOTHER]: 'Identify Another',
  [MessageKey.CHIP_ADD_WITHOUT_DETAILS]: 'Add Without Details',
  [MessageKey.CHIP_USE_THIS_RESULT]: 'Use This Result',
  [MessageKey.CHIP_SEARCH_AGAIN]: 'Search Again',
  [MessageKey.CHIP_CORRECT_FIELD]: 'Correct Field',
  [MessageKey.CHIP_CONFIRM_CORRECTIONS]: 'Looks Good',
  [MessageKey.CHIP_VERIFY]: 'Verify',

  // ===========================================
  // IDENTIFICATION - Extended
  // ===========================================
  [MessageKey.ID_GRAPE_ONLY]: (ctx: MessageContext) =>
    `I detected ${ctx.grape || 'a grape variety'} as the grape variety, but couldn't identify the wine or producer. You can use the grape name as the wine name, add details manually, or try searching again.`,

  [MessageKey.ID_BRIEF_INPUT_CONFIRM]: (ctx: MessageContext) =>
    `Just '${ctx.text}'? Adding more detail will improve the match.`,

  [MessageKey.ID_SEARCH_UNCLEAR]:
    "I'm not sure what you wanted to search. Please try again.",

  [MessageKey.ID_INSUFFICIENT_INFO]:
    "I don't have enough information to search. Please provide more details.",

  [MessageKey.ID_REIDENTIFYING]:
    'Searching for a better match...',

  [MessageKey.ID_LOW_CONFIDENCE_COMPLETE]: (ctx: MessageContext) =>
    `I'm not very confident in this match for ${ctx.wineName || 'this wine'}. I can try searching again with these details, or you can add it as-is.`,

  [MessageKey.ID_PROMPT_PRODUCER]:
    'Who makes this wine?',

  [MessageKey.ID_PROMPT_WINE_NAME]:
    "What's the name of this wine?",

  [MessageKey.ID_PROMPT_VINTAGE]:
    "What year is this wine? Enter the vintage or 'NV' for non-vintage.",

  [MessageKey.ID_PROMPT_DETAILS]:
    'What details would you like to add or correct?',

  [MessageKey.ID_PROVIDE_MORE_CONTEXT]:
    "Tell me what's different, and I'll try again. Producer, country, region, or grape variety would help.",

  [MessageKey.ID_NOT_CORRECT_PROMPT]:
    'What needs fixing? Tap a field to correct it, or provide more details.',

  [MessageKey.ID_INCOMPLETE_GRAPES_WITH_PRODUCER]: (ctx: MessageContext) =>
    `I found ${ctx.producer || 'the producer'} and detected ${ctx.grape || 'a grape'} as the grape variety. Should I use this as the wine name?`,

  [MessageKey.ID_INCOMPLETE_GRAPES_NO_PRODUCER]: (ctx: MessageContext) =>
    `I detected ${ctx.grape || 'a grape'} as the grape variety but couldn't identify the producer. Should I use the grape as the wine name?`,

  [MessageKey.ID_CORRECTION_ACKNOWLEDGED]: "Got it. Here's the updated result:",

  [MessageKey.ID_FIELD_CORRECTION_PROMPT]: (ctx: MessageContext) =>
    `Enter the correct ${ctx.text || 'value'}:`,

  // ===========================================
  // LOADING STATES
  // ===========================================
  [MessageKey.LOADING_NORMAL]: [
    'Analyzing wine...',
    'Reading the label...',
    'Consulting the cellar...',
    'Almost there...',
  ],

  [MessageKey.LOADING_DEEP_SEARCH]: [
    'Consulting sommelier...',
    'Cross-referencing vintages...',
    'Searching wine archives...',
    'Deep analysis in progress...',
    'Examining fine details...',
  ],

  [MessageKey.LOADING_DEEP_SEARCH_HINT]: 'Taking a closer look...',
  [MessageKey.LOADING_REFINING_BADGE]: 'Refining...',
  [MessageKey.LOADING_DEFAULT]: 'Consulting the cellar...',

  // ===========================================
  // CONFIRMATION - Extended
  // ===========================================
  [MessageKey.CONFIRM_ACTION_PROMPT]: (ctx: MessageContext) =>
    `Great! What would you like to do with ${ctx.wineName || 'this wine'}?`,

  // ===========================================
  // CONVERSATION FLOW
  // ===========================================
  [MessageKey.CONV_AWAITING_INPUT]:
    'What wine would you like to identify?',

  [MessageKey.CONV_ACTION_PROMPT]:
    'What would you like to do with this wine?',

  [MessageKey.CONV_NOTHING_TO_RETRY]:
    'Nothing to retry. What would you like to identify?',

  [MessageKey.CONV_CANCEL_REQUEST]:
    "Stopped. What would you like to do?",

  // ===========================================
  // ADD WINE FLOW - Extended
  // ===========================================
  [MessageKey.ADD_SUBMITTING]:
    'Adding to your cellar...',

  [MessageKey.ADD_BOTTLE_SUBMITTING]:
    'Adding bottle to your cellar...',

  [MessageKey.ADD_BOTTLE_COMPLETE]: (ctx: MessageContext) =>
    `Added another bottle of ${ctx.wineName || 'the wine'} to your cellar!`,

  [MessageKey.ADD_BOTTLE_FAILED]:
    'Something went wrong adding the bottle.',

  [MessageKey.ADD_CREATE_NEW_WINE]:
    'Creating this as a new wine entry.',

  // ===========================================
  // ENTITY MATCHING
  // ===========================================
  [MessageKey.ENTITY_AUTO_CREATE]: (ctx: MessageContext) =>
    `Creating new ${ctx.entityType}.`,

  [MessageKey.ENTITY_NO_MATCH]: (ctx: MessageContext) =>
    `No matches for "${ctx.searchTerm}". Creating new ${ctx.entityType}.`,

  [MessageKey.ENTITY_FOUND]: (ctx: MessageContext) =>
    `Found existing ${ctx.entityType}: ${ctx.wineName || ctx.displayName || 'match'}`,

  [MessageKey.ENTITY_MULTIPLE]: (ctx: MessageContext) => {
    const plural = ctx.matchCount !== 1 ? 's' : '';
    return `Found ${ctx.matchCount} ${ctx.entityType}${plural} matching "${ctx.searchTerm}".`;
  },

  [MessageKey.ENTITY_SELECTED]: (ctx: MessageContext) =>
    `Selected: ${ctx.wineName || ctx.displayName || 'item'}`,

  [MessageKey.ENTITY_CREATING]: (ctx: MessageContext) =>
    `Creating ${ctx.entityType}: ${ctx.wineName || ctx.displayName || 'entry'}`,

  [MessageKey.ENTITY_CLARIFYING]:
    'Analyzing options...',

  [MessageKey.ENTITY_CLARIFY_FAILED]:
    "Couldn't get more details. Please select or create new.",

  [MessageKey.ENTITY_NO_CLARIFY_MATCHES]:
    'No matches. Creating new entry.',

  // ===========================================
  // BOTTLE & FORM FLOW
  // ===========================================
  [MessageKey.BOTTLE_DETAILS_PROMPT]:
    "Now let's add the bottle details.",

  [MessageKey.BOTTLE_ENRICHMENT_OFFER]:
    'Would you like to add enrichment data (grape info, critic scores)?',

  [MessageKey.BOTTLE_CONTINUING]:
    'Continuing...',

  [MessageKey.BOTTLE_RETRY_FAILED]:
    'Unable to retry. Please start over.',

  // ===========================================
  // ENRICHMENT - Extended
  // ===========================================
  [MessageKey.ENRICH_FOUND_DETAILS]: (ctx: MessageContext) =>
    `Here's what I found about ${ctx.wineName || 'this wine'}. What next?`,

  [MessageKey.ENRICH_CACHE_CONFIRM]: (ctx: MessageContext) =>
    ctx.searchedForName
      ? `Found cached data for ${ctx.wineName || 'a similar wine'}, but you searched for ${String(ctx.searchedForName)}. Use what's available?`
      : `I found cached data for ${ctx.wineName || 'a similar wine'}. Is this the right wine?`,

  [MessageKey.ENRICH_USING_CACHE]:
    'Using cached data...',

  [MessageKey.ENRICH_REFRESHING]:
    'Searching for fresh data...',

  [MessageKey.ENRICH_RECOMMEND_SOON]:
    'Recommendations coming soon!',

  [MessageKey.ENRICH_REMEMBER_SOON]: (ctx: MessageContext) =>
    `Remember feature coming later. You'll need to save ${ctx.wineName || 'this wine'} manually for now.`,
};

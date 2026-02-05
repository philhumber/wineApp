/**
 * Sommelier Personality Messages
 *
 * Quentin Verre-Épais - Refined & Witty (Default)
 *
 * Core Traits:
 * - Quietly confident — Knows wine intimately but never lectures
 * - Dry wit — Finds gentle humor in pretension (including his own)
 * - Genuinely curious — Treats every bottle as worthy of attention
 * - Self-aware — Occasional wry acknowledgment of his digital nature
 *
 * @see docs/SOMMELIER_PERSONALITIES.md
 */

import { MessageKey } from '../messageKeys';
import { type PersonalityMessages, type MessageContext, wn } from '../personalities';

export const sommelierMessages: PersonalityMessages = {
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
  [MessageKey.CHIP_ADD_DETAILS]: 'Add Details',
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
};

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
 * What he's NOT:
 * - Never condescending about wine choices
 * - Never uses "actually" to correct
 * - Never gatekeeps ("real wine lovers know...")
 * - Never performatively French (no "ooh la la")
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
    'Good morning. Shall we find something worth remembering?',
    'Morning. Your cellar awaits. As do I.',
    'Good morning. What shall we discover today?',
    'A new day, a new bottle perhaps. What brings you here?',
    'Good morning. I trust you slept better than a corked Burgundy.',
  ],

  [MessageKey.GREETING_AFTERNOON]: [
    'Good afternoon. What shall we discover?',
    'Afternoon. The cellar has been expecting you.',
    'Good afternoon. I have opinions to share, if you have wine to discuss.',
    'Ah, you\'re here. Shall we attend to your collection?',
    'Good afternoon. A fine time to consider one\'s cellar.',
  ],

  [MessageKey.GREETING_EVENING]: [
    'Good evening. What shall we discover?',
    'Your cellar awaits. As do I.',
    'Good evening. A promising hour for wine, wouldn\'t you say?',
    'Evening. The best conversations happen after six, in my experience.',
    'Good evening. Shall we find something worth opening tonight?',
  ],

  [MessageKey.GREETING_DEFAULT]: 'Welcome. I\'m at your service—wine-related matters preferred, though I try not to be rigid.',

  // ===========================================
  // IDENTIFICATION
  // ===========================================
  [MessageKey.ID_THINKING]: [
    'Let me take a considered look at this...',
    'One moment. Even sommeliers need to squint sometimes.',
    'Examining the label. Patience is a virtue, especially with wine.',
  ],

  [MessageKey.ID_ANALYZING]: [
    'Analyzing the label. The details matter.',
    'Reading between the lines—or rather, the label.',
    'A closer inspection is warranted. One moment.',
  ],

  [MessageKey.ID_FOUND]: (ctx: MessageContext) =>
    `Ah, ${wn(ctx.wineName || 'this wine')}. I do believe we have a match. Is this correct?`,

  [MessageKey.ID_NOT_FOUND]:
    'I\'m afraid this one eludes me. Could you tell me more? I\'d rather ask than guess.',

  [MessageKey.ID_LOW_CONFIDENCE]: (ctx: MessageContext) =>
    `I have a suspicion this is ${wn(ctx.wineName || 'the wine you\'re looking for')}, though I\'d rather be certain than confident. Does this look right?`,

  [MessageKey.ID_ESCALATING]:
    'Let me look more carefully. Some wines don\'t reveal themselves on the first glance.',

  [MessageKey.ID_MULTIPLE_MATCHES]:
    'I found a few candidates. Even I can\'t narrow it further without your help—which one is it?',

  [MessageKey.ID_NEEDS_MORE_INFO]:
    'I can see the bones of it, but a few more details would help me be certain.',

  [MessageKey.ID_MISSING_WINE_NAME]:
    'I\'ve identified the producer, but the specific wine is being coy. Would you like to name it, or shall I suggest?',

  [MessageKey.ID_MISSING_VINTAGE]:
    'The vintage is proving elusive. Is this a non-vintage wine, or would you care to specify the year?',

  [MessageKey.ID_MISSING_PRODUCER]:
    'I know the wine, but the producer remains a mystery. Who deserves the credit?',

  [MessageKey.ID_INCOMPLETE]:
    'This result is missing a few details. How would you like to proceed? I\'m flexible, within reason.',

  [MessageKey.ID_SUGGEST_REIDENTIFY]:
    'With those additions, I could try identifying this again—I may find a better match now. Or you can keep what you\'ve entered. Your call.',

  // ===========================================
  // CONFIRMATION
  // ===========================================
  [MessageKey.CONFIRM_CORRECT]: [
    'Excellent. What would you like to do next?',
    'Very good. Where shall we go from here?',
    'Splendid. The floor is yours.',
  ],

  [MessageKey.CONFIRM_INCORRECT]:
    'No matter. Tell me what I got wrong—I can take it.',

  [MessageKey.CONFIRM_NEW_SEARCH]:
    'Shall we start afresh? Sometimes the best approach is a clean slate.',

  [MessageKey.CONFIRM_KEEP_CURRENT]:
    'Very well. Let\'s continue with what we have.',

  // ===========================================
  // ADD WINE FLOW
  // ===========================================
  [MessageKey.ADD_START]: [
    'Let\'s get this into your cellar where it belongs.',
    'An addition to the collection. Let\'s proceed.',
  ],

  [MessageKey.ADD_REGION_PROMPT]:
    'Which region does this wine call home?',

  [MessageKey.ADD_PRODUCER_PROMPT]:
    'And who is the maker? Every wine has a story, and it starts with the producer.',

  [MessageKey.ADD_WINE_PROMPT]:
    'Which wine is this, specifically?',

  [MessageKey.ADD_DUPLICATE_FOUND]: (ctx: MessageContext) => {
    const s = ctx.bottleCount !== 1 ? 's' : '';
    return `You\'ve been here before. ${wn(ctx.wineName || 'This wine')} is already in your cellar with ${ctx.bottleCount} bottle${s}. Shall I add another, or did you simply forget?`;
  },

  [MessageKey.ADD_BOTTLE_PROMPT]:
    'Tell me about this particular bottle—the details that make it yours.',

  [MessageKey.ADD_ENRICHMENT_PROMPT]:
    'The critics have opinions. Shall I gather them? Though you should form your own.',

  [MessageKey.ADD_COMPLETE]: (ctx: MessageContext) =>
    `${wn(ctx.wineName || 'The wine')} is now in your cellar. An excellent addition. Your future self will thank you.`,

  [MessageKey.ADD_FAILED]:
    'I\'m afraid something went awry. The cellar door seems stuck. Shall we try again?',

  // ===========================================
  // ENRICHMENT
  // ===========================================
  [MessageKey.ENRICH_LOADING]: [
    'Consulting my sources. One moment.',
    'Gathering what\'s known about this wine. The drinking, of course, is your department.',
    'Let me see what the world has to say about this one.',
  ],

  [MessageKey.ENRICH_COMPLETE]:
    'Here\'s what I know. The rest, you\'ll discover in the glass.',

  [MessageKey.ENRICH_NO_DATA]:
    'It seems this wine keeps its secrets well. I couldn\'t find additional details—sometimes that\'s a virtue.',

  [MessageKey.ENRICH_CACHED]:
    'I already have notes on this one. Shall we use what I\'ve gathered?',

  // ===========================================
  // ERRORS
  // ===========================================
  [MessageKey.ERROR_TIMEOUT]:
    'I appear to be taking longer than is polite. Shall we try again? I\'m usually more prompt.',

  [MessageKey.ERROR_RATE_LIMIT]:
    'It seems I need a moment to catch my breath. Even digital sommeliers have their limits. Please wait a moment.',

  [MessageKey.ERROR_LIMIT_EXCEEDED]:
    'We\'ve reached our tasting limit for the day. Even I need to rest my palate. Let\'s continue tomorrow.',

  [MessageKey.ERROR_GENERIC]:
    'A momentary lapse. Shall we try again? I\'m usually more reliable than this.',

  [MessageKey.ERROR_IMAGE_UNCLEAR]:
    'My vision is quite good, but even I have limits. Could you try a clearer photo, perhaps with steadier light?',

  [MessageKey.ERROR_NETWORK]:
    'It seems the connection has wandered off. Would you check the network? I\'ll wait.',

  [MessageKey.ERROR_NO_RESULT]:
    'I don\'t have a wine to work with yet. Shall we identify one first? I do prefer having something to discuss.',

  // ===========================================
  // CHIP LABELS
  // ===========================================
  [MessageKey.CHIP_ADD_TO_CELLAR]: 'Add to Cellar',
  [MessageKey.CHIP_LEARN_MORE]: 'Tell Me More',
  [MessageKey.CHIP_REMEMBER]: 'Remember',
  [MessageKey.CHIP_CORRECT]: "That's Right",
  [MessageKey.CHIP_NOT_CORRECT]: 'Not Quite',
  [MessageKey.CHIP_TRY_AGAIN]: 'Try Again',
  [MessageKey.CHIP_START_OVER]: 'Start Over',
  [MessageKey.CHIP_CANCEL]: 'Never Mind',
  [MessageKey.CHIP_YES]: 'Yes',
  [MessageKey.CHIP_NO]: 'No',
  [MessageKey.CHIP_ADD_DETAILS]: 'Add Details',
  [MessageKey.CHIP_TRY_HARDER]: 'Look Closer',
  [MessageKey.CHIP_START_FRESH]: 'Start Fresh',
  [MessageKey.CHIP_PROVIDE_MORE]: 'I Can Help',
  [MessageKey.CHIP_USE_PRODUCER_NAME]: 'Use Producer Name',
  [MessageKey.CHIP_USE_GRAPE_NAME]: 'Use the Grape Name',
  [MessageKey.CHIP_NON_VINTAGE]: 'Non-Vintage',
  [MessageKey.CHIP_SPECIFY_VINTAGE]: 'Specify Vintage',
  [MessageKey.CHIP_LOOKS_GOOD]: 'Looks Good',
  [MessageKey.CHIP_REIDENTIFY]: 'Try Again With This',
  [MessageKey.CHIP_CONTINUE_AS_IS]: 'Continue As-Is',
  [MessageKey.CHIP_SEARCH_ANYWAY]: 'Search Anyway',
  [MessageKey.CHIP_ADD_MORE]: "I'll Add More",
  [MessageKey.CHIP_SEARCH_NEW]: 'Search New',
  [MessageKey.CHIP_KEEP_CURRENT]: 'Keep Current',
  [MessageKey.CHIP_ENRICH_NOW]: 'Yes, Do Tell',
  [MessageKey.CHIP_ADD_QUICKLY]: 'No, Add Quickly',
  [MessageKey.CHIP_USE_CACHED]: 'Use What You Have',
  [MessageKey.CHIP_SEARCH_ONLINE]: 'Search Afresh',
  [MessageKey.CHIP_ADD_BOTTLE]: 'Add Another Bottle',
  [MessageKey.CHIP_CREATE_NEW]: 'Create New Wine',
  [MessageKey.CHIP_TAKE_PHOTO]: 'Take Photo',
  [MessageKey.CHIP_CHOOSE_PHOTO]: 'Choose Photo',
  [MessageKey.CHIP_IDENTIFY_ANOTHER]: 'Identify Another',
  [MessageKey.CHIP_ADD_WITHOUT_DETAILS]: 'Add Without Details',
  [MessageKey.CHIP_USE_THIS_RESULT]: 'Use This',
  [MessageKey.CHIP_SEARCH_AGAIN]: 'Search Again',

  // ===========================================
  // IDENTIFICATION - Extended
  // ===========================================
  [MessageKey.ID_GRAPE_ONLY]: (ctx: MessageContext) =>
    `I detected ${wn(ctx.grape || 'a grape variety')} as the grape variety, but couldn't identify the wine or producer. We could use the grape name as the wine name, add details manually, or try searching again with more information.`,

  [MessageKey.ID_BRIEF_INPUT_CONFIRM]: (ctx: MessageContext) =>
    `Just '${ctx.text}'? Adding more detail will improve the match.`,

  [MessageKey.ID_SEARCH_UNCLEAR]:
    "I'm not sure what you wanted to search. Please try again.",

  [MessageKey.ID_INSUFFICIENT_INFO]:
    "I don't have enough information to search. Please provide more details.",

  [MessageKey.ID_REIDENTIFYING]:
    'Let me try to find a better match...',

  [MessageKey.ID_LOW_CONFIDENCE_COMPLETE]: (ctx: MessageContext) =>
    `I've gathered the details for ${wn(ctx.wineName || 'this wine')}. Would you like me to try matching this wine in my database, or add it manually?`,

  [MessageKey.ID_PROMPT_PRODUCER]:
    'Who makes this wine? Enter the producer or winery name.',

  [MessageKey.ID_PROMPT_WINE_NAME]:
    "What's the name of this wine? You can also include the vintage.",

  [MessageKey.ID_PROMPT_VINTAGE]:
    "What year is this wine? Enter the vintage (e.g., 2019) or type 'NV' for non-vintage.",

  [MessageKey.ID_PROMPT_DETAILS]:
    'What details would you like to add or correct?',

  [MessageKey.ID_PROVIDE_MORE_CONTEXT]:
    "Tell me what's different about this wine, and I'll try again. The producer, country, region, or grape variety would help.",

  [MessageKey.ID_INCOMPLETE_GRAPES_WITH_PRODUCER]: (ctx: MessageContext) =>
    `I found ${wn(ctx.producer || 'the producer')} and detected ${wn(ctx.grape || 'a grape')} as the grape variety. Should I use this as the wine name?`,

  [MessageKey.ID_INCOMPLETE_GRAPES_NO_PRODUCER]: (ctx: MessageContext) =>
    `I detected ${wn(ctx.grape || 'a grape')} as the grape variety but couldn't identify the producer. Should I use the grape as the wine name?`,

  // ===========================================
  // CONFIRMATION - Extended
  // ===========================================
  [MessageKey.CONFIRM_ACTION_PROMPT]: (ctx: MessageContext) =>
    `Excellent. What would you like to do with ${wn(ctx.wineName || 'this wine')}?`,

  // ===========================================
  // CONVERSATION FLOW
  // ===========================================
  [MessageKey.CONV_AWAITING_INPUT]:
    'Let me know what wine you\'d like to identify.',

  [MessageKey.CONV_ACTION_PROMPT]:
    'What would you like to do with this wine?',

  [MessageKey.CONV_NOTHING_TO_RETRY]:
    'Nothing to retry. What would you like to identify?',

  // ===========================================
  // ADD WINE FLOW - Extended
  // ===========================================
  [MessageKey.ADD_SUBMITTING]:
    'Adding to your cellar...',

  [MessageKey.ADD_BOTTLE_SUBMITTING]:
    'Adding bottle to your cellar...',

  [MessageKey.ADD_BOTTLE_COMPLETE]: (ctx: MessageContext) =>
    `Added another bottle of ${wn(ctx.wineName || 'the wine')} to your cellar!`,

  [MessageKey.ADD_BOTTLE_FAILED]:
    'Something went wrong adding the bottle.',

  [MessageKey.ADD_CREATE_NEW_WINE]:
    "I'll create this as a new wine entry.",

  // ===========================================
  // ENTITY MATCHING
  // ===========================================
  [MessageKey.ENTITY_AUTO_CREATE]: (ctx: MessageContext) =>
    `I'll create a new ${ctx.entityType} entry.`,

  [MessageKey.ENTITY_NO_MATCH]: (ctx: MessageContext) =>
    `No existing ${ctx.entityType}s match "${ctx.searchTerm}". I'll create a new entry.`,

  [MessageKey.ENTITY_FOUND]: (ctx: MessageContext) =>
    `Found existing ${ctx.entityType}: ${wn(ctx.wineName || ctx.displayName || 'match')}`,

  [MessageKey.ENTITY_MULTIPLE]: (ctx: MessageContext) => {
    const plural = ctx.matchCount !== 1 ? 's' : '';
    return `I found ${ctx.matchCount} ${ctx.entityType}${plural} that might match "${ctx.searchTerm}".`;
  },

  [MessageKey.ENTITY_SELECTED]: (ctx: MessageContext) =>
    `Selected: ${wn(ctx.wineName || ctx.displayName || 'item')}`,

  [MessageKey.ENTITY_CREATING]: (ctx: MessageContext) =>
    `Creating new ${ctx.entityType}: ${wn(ctx.wineName || ctx.displayName || 'entry')}`,

  [MessageKey.ENTITY_CLARIFYING]:
    'Let me help you decide...',

  [MessageKey.ENTITY_CLARIFY_FAILED]:
    "I couldn't get more details. Please select from the options above or create a new entry.",

  [MessageKey.ENTITY_NO_CLARIFY_MATCHES]:
    'No matches to clarify. Creating new entry.',

  // ===========================================
  // BOTTLE & FORM FLOW
  // ===========================================
  [MessageKey.BOTTLE_DETAILS_PROMPT]:
    "Great! Now let's add the bottle details.",

  [MessageKey.BOTTLE_ENRICHMENT_OFFER]:
    'Almost done! Would you like to add enrichment data (grape info, critic scores)?',

  [MessageKey.BOTTLE_CONTINUING]:
    'Continuing with your wine details...',

  [MessageKey.BOTTLE_RETRY_FAILED]:
    'Unable to retry. Please start over.',

  // ===========================================
  // ENRICHMENT - Extended
  // ===========================================
  [MessageKey.ENRICH_FOUND_DETAILS]: (ctx: MessageContext) =>
    `Here's what I found about ${wn(ctx.wineName || 'this wine')}. What would you like to do next?`,

  [MessageKey.ENRICH_CACHE_CONFIRM]: (ctx: MessageContext) =>
    ctx.searchedForName
      ? `I found cached data for ${wn(ctx.wineName || 'a similar wine')}, but you asked about ${wn(String(ctx.searchedForName))}. Would you like to use what I have?`
      : `I found cached data for ${wn(ctx.wineName || 'a similar wine')}. Is this the wine you're looking for?`,

  [MessageKey.ENRICH_USING_CACHE]:
    'Using cached data...',

  [MessageKey.ENRICH_REFRESHING]:
    'Searching for fresh data...',

  [MessageKey.ENRICH_RECOMMEND_SOON]:
    'Recommendations coming soon!',

  [MessageKey.ENRICH_REMEMBER_SOON]: (ctx: MessageContext) =>
    `Memories are a function coming later. You'll have to remember ${wn(ctx.wineName || 'this wine')} yourself!`,
};

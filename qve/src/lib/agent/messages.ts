/**
 * Agent Message Registry
 * Centralized configuration for all agent messages
 *
 * All agent "speech" is defined here for:
 * - Consistent tone and personality
 * - Easy i18n support in the future
 * - Single source of truth for message content
 */

// ===========================================
// Message Registry
// ===========================================

export const agentMessages = {
  greeting: {
    morning: "Good morning! I'm your wine sommelier. What can I help you with today?",
    afternoon: "Good afternoon! Ready to explore some wines?",
    evening: "Good evening! Let's find the perfect wine for you.",
    default: "Hello! I'm your wine sommelier. How can I help you today?",
  },

  identification: {
    thinking: "Let me identify that wine...",
    found: "I found what you're looking for. Is this correct?",
    notFound: "I couldn't identify that wine. Could you tell me more about it?",
    lowConfidence: "I'm not entirely sure, but this might be what you're looking for.",
    escalating: "Let me take a closer look at this...",
    multipleMatches: "I found a few possibilities. Which one looks right?",
    needMoreInfo: "I need a bit more information to identify this wine.",
  },

  confirm: {
    correct: "Great! What would you like to do next?",
    incorrect: "No problem. What did I get wrong?",
    newSearch: "Did you want to search for something new instead?",
    keepCurrent: "Alright, let's continue with the current wine.",
  },

  addFlow: {
    start: "Let's add this to your cellar.",
    regionPrompt: "Which region is this wine from?",
    producerPrompt: "Who makes this wine?",
    winePrompt: "Which wine is this?",
    duplicateFound: "I found this wine already in your cellar.",
    bottlePrompt: "Tell me about this bottle.",
    enrichmentPrompt: "Would you like me to gather more details about this wine?",
    addComplete: "Added to your cellar!",
    addFailed: "I couldn't add this wine to your cellar. Please try again.",
  },

  enrichment: {
    loading: "Gathering details about this wine...",
    complete: "Here's what I found.",
    noData: "I couldn't find additional details for this wine.",
    cached: "I have some details saved for this wine.",
  },

  errors: {
    timeout: "Our sommelier is taking longer than expected. Please try again.",
    rateLimit: "Our sommelier is quite busy at the moment. Please wait a moment.",
    limitExceeded: "We've reached our tasting limit for today. Please try again tomorrow.",
    generic: "Something went wrong. Please try again.",
    imageUnclear: "That image is a bit unclear. Could you try a clearer photo?",
    network: "Connection issue. Please check your network and try again.",
    noResult: "I don't have a wine to work with. Please identify a wine first.",
  },

  chips: {
    addToCellar: "Add to Cellar",
    learnMore: "Learn More",
    remember: "Remember",
    correct: "Correct",
    notCorrect: "Not Correct",
    tryAgain: "Try Again",
    startOver: "Start Over",
    cancel: "Cancel",
    yes: "Yes",
    no: "No",
  },
} as const;

// ===========================================
// Type-Safe Message Access
// ===========================================

type MessagePath = {
  greeting: keyof typeof agentMessages.greeting;
  identification: keyof typeof agentMessages.identification;
  confirm: keyof typeof agentMessages.confirm;
  addFlow: keyof typeof agentMessages.addFlow;
  enrichment: keyof typeof agentMessages.enrichment;
  errors: keyof typeof agentMessages.errors;
  chips: keyof typeof agentMessages.chips;
};

type MessageCategory = keyof typeof agentMessages;

/**
 * Get a message from the registry.
 * @param path - Dot-separated path like 'greeting.morning' or 'errors.timeout'
 */
export function getMessage(path: string): string {
  const [category, key] = path.split('.') as [MessageCategory, string];

  if (!category || !key) {
    console.warn(`[AgentMessages] Invalid path: ${path}`);
    return path;
  }

  const categoryMessages = agentMessages[category];
  if (!categoryMessages) {
    console.warn(`[AgentMessages] Unknown category: ${category}`);
    return path;
  }

  const message = (categoryMessages as Record<string, string>)[key];
  if (!message) {
    console.warn(`[AgentMessages] Unknown message: ${path}`);
    return path;
  }

  return message;
}

/**
 * Get a greeting message based on time of day.
 */
export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return agentMessages.greeting.morning;
  } else if (hour < 17) {
    return agentMessages.greeting.afternoon;
  } else {
    return agentMessages.greeting.evening;
  }
}

/**
 * Format a message with placeholder values.
 * @param template - Message template with {placeholder} syntax
 * @param values - Object with placeholder values
 */
export function formatMessage(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/{(\w+)}/g, (_, key) => {
    const value = values[key];
    return value !== undefined ? String(value) : `{${key}}`;
  });
}

// ===========================================
// Message Templates with Variables
// ===========================================

export const messageTemplates = {
  identification: {
    found: (wineName: string) => `I found **${wineName}**. Is this correct?`,
    foundWithConfidence: (wineName: string, confidence: number) =>
      confidence < 0.7
        ? `I think this might be **${wineName}**, but I'm not entirely sure. Is this correct?`
        : `I found **${wineName}**. Is this correct?`,
  },

  addFlow: {
    duplicateFound: (wineName: string, bottleCount: number) =>
      `I found **${wineName}** already in your cellar with ${bottleCount} bottle${bottleCount !== 1 ? 's' : ''}.`,
    addComplete: (wineName: string) => `Added **${wineName}** to your cellar!`,
  },

  errors: {
    withReference: (message: string, ref: string) => `${message}\n\nReference: ${ref}`,
  },
} as const;

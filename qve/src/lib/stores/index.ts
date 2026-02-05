/**
 * Stores Module Barrel Export
 */

// Theme
export { theme } from './theme';
export type { Theme } from './theme';

// View settings
export { viewDensity, viewMode, bottleCountParam } from './view';
export type { ViewDensity, ViewMode } from './view';

// Wines
export {
  wines,
  winesLoading,
  winesError,
  targetWineID,
  expandedWineIDs,
  toggleWineExpanded,
  collapseWine,
  collapseAllWines,
  totalBottles,
  wineCount,
  winesByCountry,
  winesByType,
  getWineById,
  updateWineInList,
  removeWineFromList,
  decrementBottleCount,
  incrementBottleCount,
  scrollToWine
} from './wines';

// Filters
export {
  filters,
  hasActiveFilters,
  activeFilterCount,
  activeFilterList,
  setFilter,
  setFilters,
  clearFilter,
  clearAllFilters,
  resetFilters
} from './filters';

// Filter Options (cached dropdown options)
export { filterOptions } from './filterOptions';
export type { FilterOption } from './filterOptions';

// Toasts
export { toasts, hasToasts, latestToast } from './toast';
export type { Toast, ToastType, ToastAction } from './toast';

// Modal
export { modal, isModalOpen, isModalType, modalData, confirmOverlay } from './modal';
export type { ModalState, ModalType, ConfirmModalData, BeforeCloseResult, BeforeCloseHook } from './modal';

// Add Wine Wizard
export {
  addWineStore,
  currentStep,
  isSubmitting,
  isAILoading,
  canProceed,
  aiLoadingMessages
} from './addWine';
export type {
  WizardStep,
  SelectionMode,
  RegionFormData,
  ProducerFormData,
  WineFormData,
  BottleFormData
} from './addWine';

// Drink Wine Modal
export {
  drinkWine,
  isDirty,
  canSubmit,
  selectedBottle
} from './drinkWine';
export type { DrinkWineState, OptionalRatingType } from './drinkWine';

// Add Bottle Modal
export {
  addBottle,
  isDirtyAddBottle,
  canSubmitAddBottle,
  storageOptions
} from './addBottle';
export type { AddBottleState } from './addBottle';

// History (Drunk Wines)
export {
  drunkWines,
  historyLoading,
  historyError,
  historySortKey,
  historySortDir,
  historyFilters,
  expandedHistoryKey,
  hasHistoryFilters,
  activeHistoryFilterCount,
  sortedDrunkWines,
  drunkWineCount,
  filteredDrunkWineCount,
  setHistorySort,
  toggleHistorySortDir,
  setHistoryFilter,
  clearHistoryFilters,
  getDrunkWineKey
} from './history';
export type { HistorySortKey, HistorySortDir, HistoryFilters } from './history';

// Edit Wine
export {
  editWine,
  isWineDirty,
  isBottleDirty,
  isEditDirty,
  canSubmitWine,
  canSubmitBottle,
  hasBottles,
  wineTypeOptions
} from './editWine';
export type { EditWineState, EditWineFormData, EditBottleFormData } from './editWine';

// Navigation Menu
export { menuOpen, openMenu, closeMenu, toggleMenu } from './menu';

// Scroll Position (for back/forward navigation)
export { saveScrollPosition, getScrollPosition, clearScrollPositions } from './scrollPosition';

// Cellar Sort
export {
  cellarSortKey,
  cellarSortDir,
  setCellarSort,
  toggleCellarSortDir,
  sortWines
} from './cellarSort';
export type { CellarSortKey, CellarSortDir } from './cellarSort';

// Currency
export {
  displayCurrency,
  availableCurrencies,
  availableBottleSizes,
  currentCurrency,
  bottleSizeSelectOptions,
  currencySelectOptions,
  convertFromEUR,
  convertToEUR,
  convertCurrency,
  formatPrice,
  formatPriceFromEUR,
  formatPriceConverted,
  getCurrencyByCode,
  formatCompactValue
} from './currency';
export type { CurrencyCode } from './currency';

// Settings (Collection Name, Cellar Value)
export { collectionName, cellarValue } from './settings';

// Agent (AI Wine Identification)
export {
  agent,
  agentParsed,
  agentAction,
  agentCandidates,
  agentConfidence,
  agentLoading,
  agentIdentifying,
  agentEnriching,
  agentError,
  agentErrorMessage,
  agentErrorRetryable,
  agentErrorSupportRef,
  agentPanelOpen,
  agentInputType,
  agentImageQuality,
  agentHasResult,
  // Conversation stores
  agentPhase,
  agentMessages,
  agentIsTyping,
  agentHasAugmentationContext,
  agentAugmentationContext,
  agentHasStarted,
  agentPendingNewSearch,
  // Add wine flow
  agentAddState,
  // Streaming (WIN-181)
  agentIsStreaming,
  agentStreamingFields,
  agentStreamingChips,
  agentEnrichmentStreamingChips,
  agentPendingEnrichmentResult
} from './agent';
export type {
  AgentState,
  AgentPhase,
  AgentMessageType,
  AgentChip,
  AgentMessage,
  AgentAugmentationContext,
  PendingNewSearch,
  // Add wine flow types
  AgentAddState,
  AgentAddSelectionMode,
  AgentAddRegionData,
  AgentAddProducerData,
  AgentAddWineData,
  AgentAddBottleData,
  // Streaming types (WIN-181)
  StreamingFieldState
} from './agent';

// ─────────────────────────────────────────────
// NEW ARCHITECTURE STORES (Phase 4)
// ─────────────────────────────────────────────

// Agent Conversation (new)
export {
  agentMessages as agentMessages2,
  agentPhase as agentPhase2,
  addWineStep,
  isConversationInitialized,
  hasMessages,
  lastMessage,
  lastAgentMessage,
  lastUserMessage,
  isInAddWineFlow as isInAddWineFlow2,
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
  restoreFromCallbacks as restoreConversationFromCallbacks,
  createMessage,
  createTextMessage,
  createChipsMessage,
  setOrigin,
  clearOrigin,
  getOrigin,
} from './agentConversation';
export type { OriginState, OriginViewMode } from './agentConversation';

// Agent Identification (new)
export {
  isIdentifying,
  identificationResult,
  identificationError,
  identificationConfidence,
  streamingFields,
  augmentationContext,
  hasAugmentationContext as hasAugmentationContext2,
  pendingNewSearch as pendingNewSearch2,
  lastImageData,
  inputType,
  isEscalating,
  escalationTier,
  hasResult,
  isStreaming as isStreaming2,
  isLowConfidence,
  startIdentification,
  setResult,
  setError as setIdentificationError,
  clearError as clearIdentificationError,
  updateStreamingField,
  completeStreamingField,
  clearStreamingFields,
  setAugmentationContext,
  clearAugmentationContext,
  setPendingNewSearch,
  setLastImageData,
  clearLastImageData,
  startEscalation,
  completeEscalation,
  clearIdentification,
  resetIdentification,
  restoreFromPersistence as restoreIdentificationFromPersistence,
  getCurrentState as getIdentificationState,
  getResult,
  getAugmentationContext,
} from './agentIdentification';

// Agent Enrichment (new)
export {
  isEnriching,
  enrichmentData as enrichmentData2,
  enrichmentError,
  enrichmentSource,
  enrichmentStreamingFields,
  enrichmentForWine,
  hasEnrichmentData,
  isEnrichmentStreaming,
  hasOverview,
  hasGrapeComposition,
  hasTastingNotes,
  hasCriticScores,
  hasDrinkWindow,
  hasFoodPairings,
  startEnrichment,
  setEnrichmentData,
  setEnrichmentError,
  clearEnrichmentError,
  updateEnrichmentStreamingField,
  completeEnrichmentStreamingField,
  clearEnrichmentStreamingFields,
  setPendingEnrichmentResult,
  commitPendingEnrichmentResult,
  clearEnrichment,
  resetEnrichment,
  restoreFromPersistence as restoreEnrichmentFromPersistence,
  getCurrentState as getEnrichmentState,
  getData as getEnrichmentData,
  getForWine,
} from './agentEnrichment';

// Agent Add Wine (new)
export {
  addWineFlow,
  isInAddWineFlow,
  isAddingWine,
  addWineStep as addWineFlowStep,
  currentEntityType,
  entityMatches,
  selectedEntities,
  existingWineId,
  existingBottleCount,
  hasDuplicate,
  bottleFormData,
  bottleFormStep,
  addWineError,
  addedWineId,
  startAddFlow,
  setAddWineStep as setAddWineFlowStep,
  setEntityMatches,
  selectMatch,
  selectMatchById,
  createNewEntity,
  setExistingWine,
  clearExistingWine,
  updateBottleFormData,
  setBottleFormStep,
  setEnrichNow,
  startSubmission,
  completeSubmission,
  setSubmissionError,
  cancelAddFlow,
  resetAddWine,
  restoreFromPersistence as restoreAddWineFromPersistence,
  getCurrentFlow,
  getWineResult,
  getSelectedEntities,
  getBottleFormData,
} from './agentAddWine';

// Agent Persistence (new)
export {
  persistState,
  loadState,
  clearState,
  createEmptyState,
  loadPanelState,
  persistPanelState,
  createRestoreCallbacks,
  isPersisting,
  lastPersistError,
} from './agentPersistence';
export type {
  PersistedState,
  AugmentationContext as PersistedAugmentationContext,
  AddWineStateSlice,
  ImageDataSlice,
  PanelState,
  RestoreCallbacks,
} from './agentPersistence';

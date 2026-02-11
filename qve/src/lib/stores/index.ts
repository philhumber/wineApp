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
  getWineById,
  updateWineInList,
  removeWineFromList,
  decrementBottleCount,
  incrementBottleCount,
  scrollToWine,
  // WIN-206: Debounced fetch with abort
  fetchWines,
  cancelFetchWines
} from './wines';

// Filters
export {
  filters,
  hasActiveFilters,
  activeFilterCount,
  activeFilterList,
  hasSearchQuery,
  searchQuery,
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
  getDrunkWineKey,
  // WIN-205: Server-side pagination
  historyPagination,
  historyFilterOptions,
  unfilteredDrunkWineCount,
  fetchHistory,
  // WIN-206: Cancel helper
  cancelFetchHistory
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

// ─────────────────────────────────────────────
// AGENT STORES
// ─────────────────────────────────────────────

// Agent Panel
export {
  agentPanelOpen,
  openPanel,
  closePanel,
  togglePanel
} from './agentPanel';

// Agent Conversation
export {
  agentMessages,
  agentPhase,
  addWineStep,
  isConversationInitialized,
  hasMessages,
  lastMessage,
  lastAgentMessage,
  lastUserMessage,
  isInEnrichmentFlow,
  isInLoadingPhase,
  hasAnimatingMessages,
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

// Agent Identification
export {
  isIdentifying,
  identificationResult,
  identificationError,
  identificationConfidence,
  streamingFields,
  augmentationContext,
  hasAugmentationContext,
  pendingNewSearch,
  lastImageData,
  inputType,
  isEscalating,
  escalationTier,
  hasResult,
  isStreaming,
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

// Agent Enrichment
export {
  isEnriching,
  enrichmentData,
  enrichmentError,
  enrichmentSource,
  enrichmentForWine,
  hasEnrichmentData,
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
  clearEnrichment,
  resetEnrichment,
  restoreFromPersistence as restoreEnrichmentFromPersistence,
  getCurrentState as getEnrichmentState,
  getData as getEnrichmentData,
  getForWine,
} from './agentEnrichment';

// Agent Add Wine
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

// Agent Persistence
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

// Agent Settings
export { agentSettings, getPersonality } from './agentSettings';
export type { AgentSettings } from './agentSettings';

// ─────────────────────────────────────────────
// AUTHENTICATION (WIN-254)
// ─────────────────────────────────────────────

export { auth, isAuthenticated, isAuthChecking, isAuthLoggingOut, authError } from './auth';

// ─────────────────────────────────────────────
// SOFT DELETE (WIN-80)
// ─────────────────────────────────────────────

export {
  deleteStore,
  hasPendingDeletes,
  pendingDeleteCount,
  deleteLoading,
  deleteError,
  UNDO_DURATION_MS
} from './delete';
export type {
  DeleteEntityType,
  DeleteImpact,
  DeleteImpactResponse,
  PendingDelete
} from './delete';

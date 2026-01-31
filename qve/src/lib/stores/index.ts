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
export { modal, isModalOpen, isModalType, modalData } from './modal';
export type { ModalState, ModalType, ConfirmModalData } from './modal';

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
  agentPendingNewSearch
} from './agent';
export type {
  AgentState,
  AgentPhase,
  AgentMessageType,
  AgentChip,
  AgentMessage,
  AgentAugmentationContext,
  PendingNewSearch
} from './agent';

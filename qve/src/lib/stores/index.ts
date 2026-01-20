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
  expandedWineID,
  totalBottles,
  wineCount,
  winesByCountry,
  winesByType,
  getWineById,
  updateWineInList,
  removeWineFromList,
  decrementBottleCount,
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

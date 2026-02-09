/**
 * Qvé UI Components
 * Barrel export for all components
 */

// Form Components
export { FormInput, FormSelect, FormTextarea, FormRow, RatingDots, MiniRatingDots, ToggleSwitch } from './forms';

// Wizard Components
export {
  WizardStepIndicator,
  WizardNav,
  SearchDropdown,
  AIGenerateButton,
  AIExpandedSection,
  AILoadingOverlay,
  ImageUploadZone
} from './wizard';

// UI Components
export { default as Icon, type IconName } from './ui/Icon.svelte';
export { default as ThemeToggle } from './ui/ThemeToggle.svelte';
export { default as ViewToggle } from './ui/ViewToggle.svelte';
export { default as CurrencySelector } from './ui/CurrencySelector.svelte';
export { default as RatingDisplay } from './ui/RatingDisplay.svelte';
export { default as BottleIndicators } from './ui/BottleIndicators.svelte';
export { default as PriceScale } from './ui/PriceScale.svelte';
export { default as BuyAgainIndicator } from './ui/BuyAgainIndicator.svelte';
export { default as Toast } from './ui/Toast.svelte';
export { default as ToastContainer } from './ui/ToastContainer.svelte';

// Layout Components
export { default as Header } from './layout/Header.svelte';
export { default as FilterBar } from './layout/FilterBar.svelte';
export { default as FilterPill } from './layout/FilterPill.svelte';
export { default as FilterDropdown } from './layout/FilterDropdown.svelte';
export { default as CollectionRow } from './layout/CollectionRow.svelte';
export { default as CellarSortBar } from './layout/CellarSortBar.svelte';
export { default as HistoryFilterBar } from './layout/HistoryFilterBar.svelte';
export { default as HistorySortBar } from './layout/HistorySortBar.svelte';
export { default as SideMenu } from './layout/SideMenu.svelte';
export { default as SearchInput } from './layout/SearchInput.svelte';

// Wine Components
export { default as WineImage } from './wine/WineImage.svelte';
export { default as WineCard } from './wine/WineCard.svelte';
export { default as WineGrid } from './wine/WineGrid.svelte';
export { default as HistoryCard } from './wine/HistoryCard.svelte';
export { default as HistoryGrid } from './wine/HistoryGrid.svelte';

// Edit Components
export { default as BottleSelector } from './edit/BottleSelector.svelte';
export { default as WineForm } from './edit/WineForm.svelte';
export { default as BottleForm } from './edit/BottleForm.svelte';

// Modal Components
export {
  ModalContainer,
  DrinkRateModal,
  ConfirmModal,
  DeleteConfirmModal,
  DuplicateWarningModal,
  SettingsModal,
  AddBottleModal,
  CellarValueModal,
  CellarValueChart
} from './modals';


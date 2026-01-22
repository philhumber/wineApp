# Component Reference

All components are in `qve/src/lib/components/` organized by category.

## UI Components (`ui/`)

### Icon
SVG icon component with consistent sizing.

```svelte
<Icon name="wine" size={24} />
<Icon name="star" class="text-gold" />
```

**Props:**
- `name`: Icon name (wine, star, plus, edit, trash, etc.)
- `size`: Pixel size (default: 20)
- `class`: Additional CSS classes

### ThemeToggle
Toggle between light and dark themes.

```svelte
<ThemeToggle />
```

### ViewToggle
Toggle between Cellar and All Wines views.

```svelte
<ViewToggle />
```

### RatingDisplay
Display star rating (read-only).

```svelte
<RatingDisplay rating={8.5} />
<RatingDisplay rating={7} showValue />
```

**Props:**
- `rating`: Number 0-10
- `showValue`: Show numeric value

### BottleIndicators
Visual bottle count with size breakdown.

```svelte
<BottleIndicators bottles={wine.bottles} />
```

### Toast / ToastContainer
Notification system.

```svelte
<!-- In layout -->
<ToastContainer />

<!-- Show toast from anywhere -->
import { toastStore } from '$lib/stores';
toastStore.success('Wine added!');
toastStore.error('Failed to save');
```

## Wine Components (`wine/`)

### WineCard
Expandable wine card with actions.

```svelte
<WineCard
  {wine}
  on:drink={() => handleDrink(wine)}
  on:edit={() => handleEdit(wine)}
  on:addBottle={() => handleAddBottle(wine)}
/>
```

**Events:**
- `drink`: User wants to drink a bottle
- `edit`: User wants to edit wine
- `addBottle`: User wants to add bottles

### WineGrid
Grid of wine cards with stagger animation.

```svelte
<WineGrid
  {wines}
  on:drink
  on:edit
  on:addBottle
/>
```

### WineImage
Wine bottle image with fallback.

```svelte
<WineImage src={wine.pictureURL} alt={wine.wineName} />
```

### HistoryCard
Card for drink history with ratings.

```svelte
<HistoryCard
  {drunkWine}
  on:addBottle={() => handleAddBottle(drunkWine)}
/>
```

### HistoryGrid
Grid of history cards.

```svelte
<HistoryGrid {drunkWines} on:addBottle />
```

## Layout Components (`layout/`)

### Header
App header with title, menu button, theme toggle.

```svelte
<Header />
```

### SideMenu
Slide-out navigation drawer.

```svelte
<SideMenu />
```

Menu items: Cellar, Add Wine, History, Settings, All Wines

### FilterBar
Filter dropdowns container.

```svelte
<FilterBar />
```

### FilterDropdown
Individual filter dropdown with keyboard navigation.

```svelte
<FilterDropdown
  label="Type"
  options={typeOptions}
  bind:value={selectedType}
/>
```

### FilterPill
Removable filter indicator.

```svelte
<FilterPill label="Red" on:remove={clearTypeFilter} />
```

### HistorySortBar
Sort controls for history page.

```svelte
<HistorySortBar bind:sortBy bind:sortOrder />
```

## Form Components (`forms/`)

### FormInput
Text input with label and validation.

```svelte
<FormInput
  bind:value={name}
  label="Wine Name"
  required
  error={errors.name}
/>
```

### FormSelect
Dropdown select with options.

```svelte
<FormSelect
  bind:value={type}
  options={typeOptions}
  label="Wine Type"
/>
```

### FormTextarea
Multi-line text input.

```svelte
<FormTextarea
  bind:value={notes}
  label="Tasting Notes"
  rows={4}
/>
```

### FormRow
Horizontal layout for form fields.

```svelte
<FormRow>
  <FormInput bind:value={price} label="Price" />
  <FormSelect bind:value={currency} options={currencies} label="Currency" />
</FormRow>
```

### RatingDots
10-dot interactive rating input.

```svelte
<RatingDots bind:value={rating} />
```

### MiniRatingDots
5-dot rating for optional scores.

```svelte
<MiniRatingDots bind:value={complexity} label="Complexity" />
```

### ToggleSwitch
Boolean toggle with label.

```svelte
<ToggleSwitch bind:checked={buyAgain} label="Would buy again" />
```

## Wizard Components (`wizard/`)

### WizardStepIndicator
Step progress indicator.

```svelte
<WizardStepIndicator steps={4} currentStep={2} />
```

### WizardNav
Previous/Next navigation buttons.

```svelte
<WizardNav
  {currentStep}
  {totalSteps}
  canProceed={isValid}
  on:prev={goBack}
  on:next={goForward}
/>
```

### SearchDropdown
Searchable dropdown for region/producer/wine selection.

```svelte
<SearchDropdown
  bind:value={selectedRegion}
  options={regionOptions}
  placeholder="Search regions..."
  on:select={handleSelect}
/>
```

### AIGenerateButton
Button to trigger AI data generation.

```svelte
<AIGenerateButton on:click={generateWithAI} loading={isGenerating} />
```

### AIExpandedSection
Expandable section for AI-generated content.

```svelte
<AIExpandedSection expanded={showAI}>
  <AILoadingOverlay />
  <!-- AI content -->
</AIExpandedSection>
```

### AILoadingOverlay
Wine-themed loading animation.

```svelte
<AILoadingOverlay />
```

### ImageUploadZone
Drag-and-drop image upload.

```svelte
<ImageUploadZone
  bind:imageFile
  previewUrl={existingImage}
  on:upload={handleUpload}
/>
```

## Modal Components (`modals/`)

### ModalContainer
Container for modal overlays.

```svelte
<!-- In layout -->
<ModalContainer />
```

### DrinkRateModal
Drink and rate a wine bottle.

```svelte
<DrinkRateModal
  {wineId}
  on:close={handleClose}
  on:rated={handleRated}
/>
```

### AddBottleModal
Add bottles to existing wine.

```svelte
<AddBottleModal
  {wine}
  on:close={handleClose}
  on:added={handleAdded}
/>
```

### ConfirmModal
Confirmation dialog.

```svelte
<ConfirmModal
  title="Discard Changes?"
  message="You have unsaved changes."
  on:confirm={discard}
  on:cancel={stay}
/>
```

### SettingsModal
App settings (theme, view density).

```svelte
<SettingsModal on:close={handleClose} />
```

## Edit Components (`edit/`)

### WineForm
Edit wine details form.

```svelte
<WineForm bind:wine on:change={markDirty} />
```

### BottleForm
Edit bottle details form.

```svelte
<BottleForm bind:bottle on:change={markDirty} />
```

### BottleSelector
Pill-based bottle selection.

```svelte
<BottleSelector
  bottles={wine.bottles}
  bind:selectedId
/>
```

# Stores Reference

All stores are in `qve/src/lib/stores/`. Import from `$lib/stores`.

```typescript
import { wines, filters, theme } from '$lib/stores';
```

## Core Stores

### wines
Wine list and loading state.

```typescript
// State
$wines.list        // Wine[] - current wine list
$wines.loading     // boolean - fetching in progress
$wines.error       // string | null - error message

// Actions
wines.fetchWines()                    // Fetch with current filters
wines.setWines(wineArray)             // Set wines directly
wines.incrementBottleCount(wineId, n) // Update bottle count locally
```

### filters
Active filter values.

```typescript
// State
$filters.type      // string | null
$filters.region    // string | null
$filters.producer  // string | null
$filters.year      // number | null

// Actions
filters.setType('Red')
filters.setRegion('Bordeaux')
filters.setProducer('Château Margaux')
filters.setYear(2019)
filters.clear()           // Clear all filters
filters.clearFilter('type') // Clear specific filter
```

### filterOptions
Available filter options (context-aware).

```typescript
// State
$filterOptions.types      // { label, value, count }[]
$filterOptions.regions    // { label, value, count }[]
$filterOptions.producers  // { label, value, count }[]
$filterOptions.years      // { label, value, count }[]
$filterOptions.loading    // boolean

// Actions
filterOptions.refresh()   // Refresh all options
filterOptions.invalidate() // Mark cache as stale
```

Options automatically update based on:
- Current view mode (Cellar vs All Wines)
- Other active filters (context-aware)

### view
View mode state.

```typescript
// State
$view.mode         // 'cellar' | 'all'
$view.cellarOnly   // boolean (derived from mode)

// Actions
view.setCellar()   // Show only wines with bottles
view.setAll()      // Show all wines including 0 bottles
view.toggle()      // Toggle between modes
```

### theme
Light/dark theme.

```typescript
// State
$theme             // 'light' | 'dark'

// Actions
theme.toggle()
theme.set('dark')
```

Theme persists to localStorage and syncs with system preference.

## Feature Stores

### addWine
Add Wine wizard state.

```typescript
// State
$addWine.step           // 1-4
$addWine.region         // { id, name, countryId, ... }
$addWine.producer       // { id, name, ... }
$addWine.wine           // { name, year, type, ... }
$addWine.bottle         // { size, location, price, ... }
$addWine.isValid        // boolean - current step valid
$addWine.isSubmitting   // boolean

// Actions
addWine.setStep(2)
addWine.setRegion(region)
addWine.setProducer(producer)
addWine.setWine(wineData)
addWine.setBottle(bottleData)
addWine.submit()        // Submit to API
addWine.reset()         // Clear all state
```

### drinkWine
Drink/Rate modal state.

```typescript
// State
$drinkWine.wine         // Wine being rated
$drinkWine.bottle       // Selected bottle
$drinkWine.rating       // 0-10
$drinkWine.valueRating  // 0-10
$drinkWine.notes        // string
$drinkWine.complexity   // 0-5 (optional)
$drinkWine.drinkability // 0-5 (optional)
$drinkWine.surprise     // 0-5 (optional)
$drinkWine.foodPairing  // string (optional)
$drinkWine.isDirty      // boolean - has changes
$drinkWine.isSubmitting // boolean

// Actions
drinkWine.init(wine)
drinkWine.selectBottle(bottle)
drinkWine.setRating(8)
drinkWine.submit()
drinkWine.reset()
```

### editWine
Edit Wine/Bottle page state.

```typescript
// State
$editWine.wine          // Wine data
$editWine.bottles       // Bottle[]
$editWine.selectedBottle // Currently editing bottle
$editWine.activeTab     // 'wine' | 'bottle'
$editWine.isDirty       // boolean
$editWine.isSubmitting  // boolean

// Actions
editWine.init(wineId)   // Load wine data
editWine.setTab('bottle')
editWine.selectBottle(bottle)
editWine.updateWine(changes)
editWine.updateBottle(changes)
editWine.save()         // Save changes
editWine.reset()
```

### addBottle
Add Bottle modal state.

```typescript
// State
$addBottle.wine         // Wine to add bottle to
$addBottle.quantity     // 1-24
$addBottle.size         // '750ml', '375ml', etc.
$addBottle.location     // string
$addBottle.source       // string
$addBottle.price        // number
$addBottle.currency     // 'EUR', 'USD', etc.
$addBottle.purchaseDate // string (ISO date)
$addBottle.isSubmitting // boolean

// Actions
addBottle.init(wine)
addBottle.setQuantity(3)
addBottle.submit()      // Add bottles
addBottle.reset()
```

### history
Drink history state.

```typescript
// State
$history.items          // DrunkWine[]
$history.loading        // boolean
$history.sortBy         // 'date' | 'rating' | 'value' | 'name' | 'type'
$history.sortOrder      // 'asc' | 'desc'
$history.filtered       // DrunkWine[] (sorted/filtered)

// Actions
history.fetch()         // Load history
history.setSortBy('rating')
history.setSortOrder('desc')
history.toggleSort('date')
```

## UI Stores

### toast
Toast notifications.

```typescript
// Actions
toast.success('Wine added!')
toast.error('Failed to save')
toast.info('Loading...')
toast.warning('Unsaved changes')
toast.dismiss(id)       // Dismiss specific toast
toast.clear()           // Clear all
```

### modal
Modal container state.

```typescript
// State
$modal.active           // 'drink' | 'addBottle' | 'confirm' | 'settings' | null
$modal.props            // Modal-specific props

// Actions
modal.open('drink', { wineId: 123 })
modal.open('confirm', { message: 'Delete?' })
modal.close()
```

### menu
Side menu state.

```typescript
// State
$menu.isOpen            // boolean

// Actions
menu.open()
menu.close()
menu.toggle()
```

### scrollPosition
Scroll restoration for back/forward navigation.

```typescript
// State
$scrollPosition         // number (Y position)

// Actions
scrollPosition.save()
scrollPosition.restore()
```

## Usage Patterns

### Reactive Subscriptions
```svelte
<script>
  import { wines, filters } from '$lib/stores';

  // Auto-subscribes with $
  $: wineCount = $wines.list.length;
  $: isFiltered = $filters.type || $filters.region;
</script>
```

### Store Actions
```svelte
<script>
  import { filters, toast } from '$lib/stores';

  function handleFilter(type) {
    filters.setType(type);
    toast.info(`Filtered by ${type}`);
  }
</script>
```

### Cross-Store Updates
```typescript
// In a store
import { wines, filters } from './index';

export function refreshAll() {
  filters.clear();
  wines.fetchWines();
}
```

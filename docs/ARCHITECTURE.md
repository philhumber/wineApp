# Architecture Overview

Qvé is built with SvelteKit 2 and uses a PHP backend for data persistence.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (PWA)                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              SvelteKit App (qve/)                     │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐ │  │
│  │  │ Routes  │ │ Stores  │ │Components│ │ API Client  │ │  │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └──────┬──────┘ │  │
│  └───────┼──────────┼──────────┼──────────────┼────────┘  │
│          │          │          │              │            │
└──────────┼──────────┼──────────┼──────────────┼────────────┘
           │          │          │              │
           ▼          ▼          ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Vite Dev Server (5173)                     │
│                        │                                    │
│                        │ proxy /resources/php               │
│                        ▼                                    │
│ ┌─────────────────────────────────────────────────────────┐│
│ │              PHP Backend (8000)                         ││
│ │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ ││
│ │  │   REST API  │  │  Gemini AI  │  │  Image Upload   │ ││
│ │  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ ││
│ └─────────┼────────────────┼──────────────────┼──────────┘│
└───────────┼────────────────┼──────────────────┼────────────┘
            │                │                  │
            ▼                ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                     MySQL Database                          │
│         wine | bottles | ratings | producers | region       │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Read Flow (Loading Wines)
```
1. Route loads (+page.svelte)
2. onMount() calls wineStore.fetchWines()
3. wineStore calls api.getWines(filters)
4. API client makes fetch() to /resources/php/getWines.php
5. Vite proxy forwards to PHP backend
6. PHP queries MySQL, returns JSON
7. wineStore updates, components react
```

### Write Flow (Adding Wine)
```
1. User completes Add Wine wizard
2. addWineStore.submit() called
3. api.addWine(data) - POST to addWine.php
4. PHP starts transaction, inserts into 4 tables
5. On success: commit, return wineId
6. wineStore.fetchWines() refreshes list
7. Navigation to home with scroll-to-wine
```

## State Management

Svelte stores provide reactive state:

```typescript
// Reading state
$wines           // Current wine list
$filters.type    // Active type filter
$theme           // 'light' | 'dark'

// Writing state
filters.setType('Red')
wineStore.fetchWines()
theme.toggle()
```

### Store Dependencies

```
view ────────┐
             ├──► filterOptions (recalculates on view change)
filters ─────┘

wines ◄────── filters (wines filtered by active filters)
```

## Component Architecture

### Composition Pattern
```svelte
<!-- Page composes layout and feature components -->
<Header />
<FilterBar />
<WineGrid {wines} on:drink on:edit />
<ToastContainer />
<ModalContainer />
```

### Event Flow
```svelte
<!-- Child emits event -->
<WineCard on:drink={() => dispatch('drink', wine)} />

<!-- Parent handles -->
<WineGrid on:drink={handleDrink} />
```

## File Organization

```
qve/src/
├── lib/
│   ├── api/          # Backend communication
│   ├── components/   # Reusable UI (by category)
│   ├── stores/       # State management
│   └── styles/       # Design tokens
└── routes/           # Pages (file-based routing)
```

## Key Design Decisions

1. **Stores over props drilling** - Global state for cross-cutting concerns
2. **API client abstraction** - Single point for all backend calls
3. **Component categories** - Organized by function (ui, wine, forms, etc.)
4. **CSS custom properties** - Design tokens for theming
5. **File-based routing** - SvelteKit convention for pages

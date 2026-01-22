# Qvé UI Components

**Version**: 1.1
**Last Updated**: 2026-01-19

---

## Table of Contents

1. [Header](#header)
2. [Wine Card](#wine-card)
3. [View Toggle](#view-toggle)
4. [Theme Toggle](#theme-toggle)
5. [Filter Pills](#filter-pills)
6. [Bottle Indicators](#bottle-indicators)
7. [Rating Display](#rating-display)
8. [Action Buttons](#action-buttons)
9. [Rating Modal](#rating-modal) *(Phase 0)*
10. [Multi-Step Form](#multi-step-form) *(Phase 0)*
11. [Toast Notifications](#toast-notifications) *(Phase 0)*
12. [Modal Dialogs](#modal-dialogs) *(Phase 0)*
13. [Empty & Error States](#empty--error-states) *(Phase 0)*
14. [AI Loading Overlay](#ai-loading-overlay) *(Phase 0)*

---

## Header

### Structure

```html
<header class="header" id="header">
    <div class="header-content">
        <div class="header-left">
            <button class="header-icon"><!-- Menu icon --></button>
            <a class="logo" href="#">Qvé</a>
        </div>
        <div class="header-actions">
            <button class="theme-toggle"><!-- Sun/Moon icons --></button>
            <div class="view-toggle"><!-- View buttons --></div>
            <button class="header-icon"><!-- Search icon --></button>
            <button class="header-icon"><!-- Menu icon --></button>
        </div>
    </div>
</header>
```

### Behavior

- Fixed position at top
- Adds `.scrolled` class when page scrolls > 10px
- Scrolled state: adds bottom border and subtle shadow

### CSS Classes

| Class | Description |
|-------|-------------|
| `.header` | Main container, fixed positioning |
| `.header.scrolled` | Scrolled state with border |
| `.header-content` | Inner flex container |
| `.header-left` | Logo and menu button group |
| `.header-actions` | Right-side action buttons |
| `.header-icon` | Icon button styling |
| `.logo` | Brand text styling |

---

## Wine Card

### Structure (Medium View)

```html
<article class="wine-card" onclick="toggleExpand(this)">
    <span class="wine-type">Red</span>

    <div class="wine-image-container">
        <div class="wine-image-placeholder"><!-- SVG placeholder --></div>
        <!-- OR -->
        <img class="wine-image" src="..." alt="Wine label">
    </div>

    <div class="wine-details">
        <div class="wine-header">
            <h2 class="wine-name">Wine Name</h2>
            <span class="wine-year">2019</span>
        </div>

        <p class="wine-producer">Producer Name</p>
        <p class="wine-location">
            <span>Region, Country</span>
            <span class="wine-flag">🇫🇷</span>
        </p>

        <div class="wine-divider"></div>

        <div class="wine-meta">
            <div class="bottle-indicators"><!-- Bottle SVGs --></div>
            <span class="bottle-count">3</span>
            <div class="wine-rating">
                <span class="rating-dot"></span>
                <span class="rating-value">8.5</span>
            </div>
        </div>
    </div>

    <div class="wine-actions">
        <button class="action-btn" title="Drink"><!-- Icon --></button>
        <button class="action-btn" title="Add"><!-- Icon --></button>
        <button class="action-btn" title="Edit"><!-- Icon --></button>
    </div>

    <div class="wine-expanded">
        <div class="wine-section">
            <h3 class="wine-section-title">Description</h3>
            <p class="wine-description">...</p>
        </div>
        <!-- More sections... -->
    </div>
</article>
```

### States

| State | Description |
|-------|-------------|
| Default | Collapsed, actions hidden |
| Hover | Subtle shadow lift, actions appear |
| Expanded | Full details visible, max-height animated |

### Interaction

- Click anywhere on card to toggle expand/collapse
- Action buttons intercept click (stopPropagation)
- Smooth height transition on expand

### Compact View Differences

In compact view (`.view-compact`):

- Card direction: column (stacked)
- Hidden: producer, location, actions, bottle indicators, expanded section
- Shown: bottle count (numeric)
- Image: smaller (100px height)
- Name: truncated to 2 lines
- Click expands inline, spanning all grid columns

---

## View Toggle

### Structure

```html
<div class="view-toggle" role="group" aria-label="View density">
    <button class="view-btn" data-view="compact" title="Grid view">
        <svg><!-- 4-square grid icon --></svg>
    </button>
    <button class="view-btn active" data-view="medium" title="List view">
        <svg><!-- 3-line list icon --></svg>
    </button>
</div>
```

### Behavior

- Toggle between `compact` and `medium` views
- Saves preference to `localStorage` key: `qve-view-mode`
- Active button has elevated background
- Grid icon uses `fill`, list icon uses `stroke`

### JavaScript Controller

```javascript
const ViewModeController = {
    STORAGE_KEY: 'qve-view-mode',
    DEFAULT_VIEW: 'medium',

    init() { /* Load saved, bind handlers */ },
    setView(viewMode, animate) { /* Apply class, update buttons */ }
};
```

---

## Theme Toggle

### Structure

```html
<button class="theme-toggle" title="Toggle theme" aria-label="Toggle theme">
    <svg class="icon-sun"><!-- Sun icon --></svg>
    <svg class="icon-moon"><!-- Moon icon --></svg>
</button>
```

### Behavior

- Toggles `data-theme` attribute on `<html>` element
- Values: `light` (default) or `dark`
- Saves to `localStorage` key: `qve-theme`
- Sun visible in light mode, moon visible in dark mode
- Smooth crossfade animation between icons

### CSS

```css
.theme-toggle .icon-sun { opacity: 1; }
.theme-toggle .icon-moon { opacity: 0; position: absolute; }

[data-theme="dark"] .theme-toggle .icon-sun { opacity: 0; }
[data-theme="dark"] .theme-toggle .icon-moon { opacity: 1; }
```

---

## Filter Pills

### Structure

```html
<div class="filter-bar">
    <button class="filter-pill active">All</button>
    <button class="filter-pill">Red</button>
    <button class="filter-pill">White</button>
    <button class="filter-pill">Sparkling</button>
</div>
```

### States

| State | Appearance |
|-------|------------|
| Default | Transparent background, tertiary text |
| Hover | Subtle background |
| Active | Surface background, primary text, shadow |

### Behavior

- Single selection (radio-like)
- Click toggles active state
- Filters wine list by type

---

## Bottle Indicators

### Structure

```html
<div class="bottle-indicators" title="2 Standard, 1 Magnum">
    <svg class="bottle-icon standard" viewBox="0 0 8 24">
        <path d="M2.5 0h3v2.5c1.5 0.8 2.5 2 2.5 4.5v14c0 1.5-1 3-2.5 3h-3c-1.5 0-2.5-1.5-2.5-3V7c0-2.5 1-3.7 2.5-4.5V0z"/>
    </svg>
    <svg class="bottle-icon standard"><!-- Same path --></svg>
    <svg class="bottle-icon large" viewBox="0 0 10 32">
        <path d="M3 0h4v3c2 1 3 3 3 6v20c0 2-1 3-3 3H3c-2 0-3-1-3-3V9c0-3 1-5 3-6V0z"/>
    </svg>
</div>
```

### Size Classes

| Class | Height | Bottle Types |
|-------|--------|--------------|
| `.small` | 16px | Piccolo, Quarter, Demi |
| `.standard` | 24px | 750ml (standard) |
| `.large` | 32px | Magnum, Jeroboam, etc. |

### Compact View Alternative

In compact view, bottle indicators are hidden and replaced with numeric count:

```html
<span class="bottle-count">3</span>
<!-- Renders as "3 btl" via ::after pseudo-element -->
```

---

## Rating Display

### Structure

```html
<div class="wine-rating">
    <span class="rating-dot"></span>
    <span class="rating-value">8.5</span>
</div>
```

### Unrated State

```html
<div class="wine-rating">
    <span style="color: var(--text-tertiary); font-style: italic;">Unrated</span>
</div>
```

### Styling

- Dot: 3px circle in accent color
- Value: Sans-serif, secondary text color
- Compact view: Smaller dot (2px), smaller text

---

## Action Buttons

### Structure

```html
<div class="wine-actions">
    <button class="action-btn" title="Drink">
        <svg viewBox="0 0 24 24"><!-- Wine bottle icon --></svg>
    </button>
    <button class="action-btn" title="Add">
        <svg viewBox="0 0 24 24"><!-- Plus icon --></svg>
    </button>
    <button class="action-btn" title="Edit">
        <svg viewBox="0 0 24 24"><!-- Pencil icon --></svg>
    </button>
</div>
```

### Behavior

- Hidden by default (opacity: 0)
- Appear on card hover (opacity: 1)
- Always visible when card expanded
- Click handlers use `event.stopPropagation()` to prevent card toggle

### CSS

```css
.wine-actions {
    opacity: 0;
    transition: opacity 0.2s ease;
}

.wine-card:hover .wine-actions,
.wine-card.expanded .wine-actions {
    opacity: 1;
}

.action-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--bg-subtle);
}

.action-btn:hover {
    background: var(--surface);
    transform: scale(1.05);
}
```

---

## Grid Layouts

### Medium View (List)

```css
.wine-grid.view-medium {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
}
```

### Compact View (Grid)

```css
.wine-grid.view-compact {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--space-4);
}
```

### Responsive Columns

| Screen Width | Columns |
|--------------|---------|
| ≥1200px | 6 |
| 992-1199px | 5 |
| 768-991px | 4 |
| 480-767px | 3 |
| <480px | 2 |

### Expanded Card in Grid

```css
.view-compact .wine-card.expanded {
    grid-column: 1 / -1;  /* Span all columns */
    flex-direction: row;
}
```

---

## Animation Reference

### Card Expand/Collapse

```css
.wine-card {
    transition: all 0.3s var(--ease-out);
}

.wine-expanded {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.4s var(--ease-out),
                opacity 0.3s var(--ease-out),
                padding 0.3s var(--ease-out);
}

.wine-card.expanded .wine-expanded {
    max-height: 500px;
}
```

### View Mode Transition

```css
.wine-grid {
    transition: gap 0.3s var(--ease-out);
}

.wine-image-container {
    transition: width 0.3s var(--ease-out),
                height 0.3s var(--ease-out);
}
```

---

## Rating Modal

**Mockup**: `qve-drink-rate-mockup.html`

### Structure

```html
<div class="modal-backdrop">
    <div class="modal rating-modal">
        <div class="modal-header">
            <h2>Rate that wine!</h2>
            <button class="modal-close">×</button>
        </div>

        <div class="modal-body">
            <!-- Wine Info (read-only) -->
            <div class="wine-info-header">
                <span class="wine-name">Wine Name 2019</span>
                <span class="producer">Producer Name</span>
            </div>

            <!-- Bottle Selector -->
            <div class="form-group">
                <label>Bottle</label>
                <select class="bottle-select">
                    <option>750ml - Cellar - $45 - Jan 2024</option>
                </select>
            </div>

            <!-- Rating Row -->
            <div class="rating-row">
                <div class="rating-group rating-overall">
                    <label>Overall<span class="rating-value">: 8</span></label>
                    <div class="rating-dots">
                        <!-- 10 dots, filled cumulatively -->
                        <span class="rating-dot filled"></span>
                        <!-- ... -->
                    </div>
                </div>
                <div class="rating-group rating-value">
                    <label>Value<span class="rating-value">: 7</span></label>
                    <div class="rating-dots">
                        <!-- 10 dots -->
                    </div>
                </div>
            </div>

            <!-- Additional Fields -->
            <div class="form-group">
                <label>Drink Date</label>
                <input type="date" value="2026-01-19">
            </div>

            <div class="form-group toggle-group">
                <label>Buy Again?</label>
                <button class="toggle-switch active">Yes</button>
            </div>

            <div class="form-group">
                <label>Tasting Notes</label>
                <textarea class="auto-expand"></textarea>
            </div>
        </div>

        <div class="modal-footer">
            <button class="btn-secondary">Cancel</button>
            <button class="btn-primary" disabled>Rate!</button>
        </div>
    </div>
</div>
```

### Rating Dots Behavior

| Action | Effect |
|--------|--------|
| Click dot N | Fill dots 1 through N |
| Hover dot N | Preview fill state |
| Click filled dot | Deselect (unfill all) |

### CSS Classes

| Class | Description |
|-------|-------------|
| `.rating-modal` | Modal container with max-width |
| `.rating-row` | Flex row for both ratings (stacks on mobile) |
| `.rating-group` | Container for label + dots |
| `.rating-dots` | Flex container for 10 dots |
| `.rating-dot` | Individual 10px circle |
| `.rating-dot.filled` | Filled state (color varies by group) |
| `.rating-overall .filled` | Burgundy `#8B4A5C` |
| `.rating-value .filled` | Green `#7A8B6B` |

### States

| State | Description |
|-------|-------------|
| Initial | No ratings selected, Rate button disabled |
| Partial | One rating selected, button still disabled |
| Complete | Both ratings selected, button enabled |
| Submitting | Button shows loading state |

---

## Multi-Step Form

**Mockup**: `qve-add-wine-mockup.html`

### Structure

```html
<div class="form-wizard">
    <!-- Step Indicator -->
    <div class="step-indicator">
        <span class="step completed">1</span>
        <span class="step active">2</span>
        <span class="step">3</span>
        <span class="step">4</span>
    </div>

    <!-- Step Content -->
    <div class="step-content" data-step="1">
        <h2>Region</h2>
        <!-- Form fields -->
    </div>

    <!-- Navigation -->
    <div class="form-nav">
        <button class="btn-secondary">Back</button>
        <button class="btn-primary">Next</button>
    </div>
</div>
```

### Step Indicator

```css
.step-indicator {
    display: flex;
    justify-content: center;
    gap: var(--space-3);
    margin-bottom: var(--space-6);
}

.step {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    border: 1px solid var(--divider);
    color: var(--text-tertiary);
}

.step.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
}

.step.completed {
    background: var(--bg-subtle);
    border-color: var(--accent);
    color: var(--accent);
}
```

### AI Button

Button to trigger AI data generation:

```html
<button class="ai-button">
    <svg><!-- Sparkle icon --></svg>
    Get More Info
</button>
```

```css
.ai-button {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border-radius: 100px;
    background: transparent;
    border: 1px solid var(--accent);
    color: var(--accent);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    cursor: pointer;
    transition: all 0.2s ease;
}

.ai-button:hover {
    background: var(--accent);
    color: white;
}

.ai-button.loading {
    pointer-events: none;
    opacity: 0.7;
}
```

### Form Steps

| Step | Fields | AI Button Reveals |
|------|--------|-------------------|
| 1. Region | Name, Country, Drink Type | Description, Climate, Soil |
| 2. Producer | Name | Town, Founded, Ownership, Description |
| 3. Wine | Name, Year, Type, Image | Description, Tasting Notes, Pairing Notes |
| 4. Bottle | Size, Location, Source, Price, Currency | - |

---

## Toast Notifications

**Mockup**: `qve-toasts-mockup.html`

### Structure

```html
<div class="toast-container">
    <div class="toast toast-success">
        <svg class="toast-icon"><!-- Check icon --></svg>
        <span class="toast-message">Wine added successfully!</span>
        <button class="toast-close">×</button>
        <div class="toast-progress"></div>
    </div>
</div>
```

### Toast Types

| Type | Class | Icon | Accent Color |
|------|-------|------|--------------|
| Success | `.toast-success` | Checkmark | `#4A7C59` |
| Error | `.toast-error` | X | `#A63D40` |
| Info | `.toast-info` | Info circle | `var(--accent)` |
| Undo | `.toast-undo` | Undo arrow | `var(--accent)` |

### Positioning

```css
.toast-container {
    position: fixed;
    bottom: var(--space-5);
    right: var(--space-5);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
}

/* Mobile: center bottom */
@media (max-width: 520px) {
    .toast-container {
        left: var(--space-4);
        right: var(--space-4);
        bottom: var(--space-4);
    }
}
```

### Behavior

| Feature | Description |
|---------|-------------|
| Auto-dismiss | 5 seconds default, progress bar shows remaining time |
| Swipe-to-dismiss | Touch gesture support on mobile |
| Undo action | Optional button that triggers callback |
| Stacking | Multiple toasts stack vertically |

---

## Modal Dialogs

**Mockups**: `qve-add-bottle-mockup.html`, `qve-edit-mockup.html`

### Base Modal Structure

```html
<div class="modal-backdrop">
    <div class="modal">
        <div class="modal-header">
            <h2 class="modal-title">Modal Title</h2>
            <button class="modal-close" aria-label="Close">
                <svg><!-- X icon --></svg>
            </button>
        </div>
        <div class="modal-body">
            <!-- Content -->
        </div>
        <div class="modal-footer">
            <button class="btn-secondary">Cancel</button>
            <button class="btn-primary">Confirm</button>
        </div>
    </div>
</div>
```

### Modal Sizes

| Size | Class | Max Width |
|------|-------|-----------|
| Small | `.modal-sm` | 400px |
| Default | `.modal` | 500px |
| Large | `.modal-lg` | 700px |

### Add Bottle Modal

Read-only wine header + bottle form fields:

```html
<div class="modal add-bottle-modal">
    <div class="wine-info-readonly">
        <span class="wine-name">Château Example 2019</span>
        <span class="producer">Producer Name • Region</span>
    </div>
    <!-- Bottle form fields -->
</div>
```

### Edit Modal (Tabbed)

Two-tab interface for editing wine or bottle:

```html
<div class="modal edit-modal">
    <div class="tab-bar">
        <button class="tab active">Wine Details</button>
        <button class="tab">Bottle Details</button>
    </div>
    <div class="tab-content" data-tab="wine">
        <!-- Wine fields -->
    </div>
    <div class="tab-content" data-tab="bottle" hidden>
        <!-- Bottle selector + fields -->
    </div>
</div>
```

### Tab Bar Styling

```css
.tab-bar {
    display: flex;
    border-bottom: 1px solid var(--divider);
    margin-bottom: var(--space-5);
}

.tab {
    padding: var(--space-3) var(--space-4);
    border: none;
    background: none;
    color: var(--text-secondary);
    font-size: 0.875rem;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
}

.tab.active {
    color: var(--text-primary);
    border-bottom-color: var(--accent);
}
```

---

## Empty & Error States

**Mockup**: `qve-states-mockup.html`

### Empty Collection

```html
<div class="empty-state">
    <svg class="empty-illustration"><!-- Wine bottle outline --></svg>
    <h2>Your collection is empty</h2>
    <p>Start by adding your first wine to the cellar.</p>
    <button class="btn-primary">Add Wine</button>
</div>
```

### No Search Results

```html
<div class="empty-state">
    <svg class="search-illustration"><!-- Magnifying glass --></svg>
    <h2>No wines match your filters</h2>
    <p>Try adjusting your search or filters.</p>
    <button class="btn-link">Clear filters</button>
</div>
```

### Loading State (Skeleton)

```html
<div class="wine-card skeleton">
    <div class="skeleton-image"></div>
    <div class="skeleton-content">
        <div class="skeleton-line title"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
    </div>
</div>
```

```css
.skeleton-line {
    height: 16px;
    background: linear-gradient(
        90deg,
        var(--bg-subtle) 25%,
        var(--surface) 50%,
        var(--bg-subtle) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
}

@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
```

### Network Error

```html
<div class="error-state">
    <svg class="error-icon"><!-- Cloud with X --></svg>
    <h2>Unable to connect</h2>
    <p>Check your connection and try again.</p>
    <button class="btn-primary">Retry</button>
</div>
```

### Server Error

```html
<div class="error-state">
    <svg class="error-icon"><!-- Warning triangle --></svg>
    <h2>Something went wrong</h2>
    <p>We're working on it. Please try again later.</p>
    <button class="btn-secondary">Go Back</button>
</div>
```

---

## AI Loading Overlay

**Mockup**: `qve-states-mockup.html`

### Structure

```html
<div class="ai-loading-overlay">
    <div class="ai-loading-content">
        <button class="ai-loading-close" aria-label="Cancel">
            <svg><!-- X icon --></svg>
        </button>

        <!-- Animation container -->
        <div class="loading-animation decanting">
            <div class="loading-bar"></div>
            <div class="loading-bar"></div>
            <div class="loading-bar"></div>
        </div>

        <!-- Cycling message -->
        <p class="loading-message">Searching the cellars...</p>
    </div>
</div>
```

### Animation Styles

| Style | Class | Description |
|-------|-------|-------------|
| Basic | `.loading-basic` | Opacity pulse on horizontal bars |
| Decanting | `.loading-decanting` | Width-breathing horizontal bars |
| Vineyard | `.loading-vineyard` | Height-varying vertical bars |

### Behavior

| Feature | Description |
|---------|-------------|
| Backdrop | 50% black with 4px blur |
| Close button | Top-right X, cancels AI request |
| Message cycling | Changes every 2-3 seconds |
| Cancelable | User can dismiss at any time |

### CSS

```css
.ai-loading-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.ai-loading-content {
    position: relative;
    background: var(--surface);
    padding: var(--space-8) var(--space-6);
    border-radius: 16px;
    text-align: center;
    min-width: 280px;
    max-width: 320px;
}

.ai-loading-close {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: var(--bg-subtle);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.loading-message {
    margin-top: var(--space-4);
    color: var(--text-secondary);
    font-style: italic;
}
```

---

*Component specifications for implementing Qvé in the production app. Phase 0 components are marked and documented based on the mockup review session of 2026-01-19.*

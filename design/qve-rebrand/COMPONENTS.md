# Qvé UI Components

**Version**: 1.0
**Last Updated**: 2026-01-13

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

*Component specifications for implementing Qvé in the production app.*

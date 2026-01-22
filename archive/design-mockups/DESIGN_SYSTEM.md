# Qvé Design System

**Version**: 1.1
**Last Updated**: 2026-01-19

---

## Color Palette

### Light Mode - "Morning in the Tasting Room"

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#FAF9F7` | Page background |
| `--bg-subtle` | `#F5F3F0` | Subtle backgrounds, input fields |
| `--surface` | `#FFFFFF` | Cards, elevated surfaces |
| `--surface-raised` | `#FFFFFF` | Popovers, modals |
| `--text-primary` | `#2D2926` | Headings, body text |
| `--text-secondary` | `#5C5652` | Supporting text |
| `--text-tertiary` | `#8A847D` | Captions, metadata |
| `--accent` | `#A69B8A` | Interactive elements (muted taupe) |
| `--accent-subtle` | `#C4BAA9` | Hover states |
| `--accent-muted` | `#D9D2C6` | Backgrounds, selections |
| `--divider` | `#E8E4DE` | Borders, separators |
| `--divider-subtle` | `#F0EDE8` | Subtle separators |

### Dark Mode - "Penthouse at Night"

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#0C0B0A` | Page background (warm black) |
| `--bg-subtle` | `#141312` | Subtle backgrounds |
| `--surface` | `#1A1918` | Cards, elevated surfaces |
| `--surface-raised` | `#222120` | Popovers, modals |
| `--text-primary` | `#F0EDE6` | Headings, body text |
| `--text-secondary` | `#A8A29A` | Supporting text |
| `--text-tertiary` | `#6B665F` | Captions, metadata |
| `--accent` | `#B8AFA0` | Interactive elements |
| `--accent-subtle` | `#7A756C` | Hover states |
| `--accent-muted` | `#4A4640` | Backgrounds, selections |
| `--divider` | `#2A2826` | Borders, separators |
| `--divider-subtle` | `#1F1E1C` | Subtle separators |

### Semantic Colors

| Purpose | Light | Dark |
|---------|-------|------|
| Wine Red | `#722F37` | `#A64D55` |
| Success | `#4A7C59` | `#6B9B7A` |
| Warning | `#C4A35A` | `#D4B86A` |
| Error | `#A63D40` | `#C45D60` |

### Rating Colors (Phase 0 Addition)

| Rating Type | Color | Usage |
|-------------|-------|-------|
| Overall Rating | `#8B4A5C` | Burgundy - wine/quality association |
| Value Rating | `#7A8B6B` | Sage green - money/value association |

These colors are used for the cumulative dot-fill rating interface. They work in both light and dark modes without modification.

---

## Typography

### Font Families

```css
--font-serif: 'Cormorant Garamond', 'Didot', 'Bodoni MT', Georgia, serif;
--font-sans: 'Outfit', 'Avenir Next', system-ui, sans-serif;
```

### Type Scale

| Element | Font | Size | Weight | Line Height |
|---------|------|------|--------|-------------|
| Logo | Serif | 1.25rem | 500 | 1 |
| Page Title | Serif | 1.75rem | 400 | 1.2 |
| Wine Name | Serif | 1.5rem | 400 | 1.25 |
| Wine Name (compact) | Serif | 0.875rem | 400 | 1.3 |
| Body | Sans | 0.875rem | 400 | 1.5 |
| Caption | Sans | 0.8125rem | 400 | 1.4 |
| Metadata | Sans | 0.75rem | 400 | 1.4 |
| Tiny | Sans | 0.6875rem | 400 | 1.3 |

### Letter Spacing

| Context | Value |
|---------|-------|
| Headings | `-0.01em` |
| Body | `0` |
| Uppercase labels | `0.08em` |
| Metadata | `0.02em` |

---

## Spacing

### Scale

```css
--space-1:  0.25rem   /* 4px */
--space-2:  0.5rem    /* 8px */
--space-3:  0.75rem   /* 12px */
--space-4:  1rem      /* 16px */
--space-5:  1.5rem    /* 24px */
--space-6:  2rem      /* 32px */
--space-8:  3rem      /* 48px */
--space-10: 4rem      /* 64px */
--space-12: 6rem      /* 96px */
```

### Usage Guidelines

| Context | Spacing |
|---------|---------|
| Component internal padding | `space-3` to `space-5` |
| Between related items | `space-2` to `space-3` |
| Between sections | `space-6` to `space-8` |
| Page margins | `space-5` (mobile) to `space-6` (desktop) |
| Card padding | `space-5` |
| Card gap | `space-4` |

---

## Shadows

### Elevation Scale

```css
/* Barely there - cards at rest */
--shadow-sm: 0 1px 2px rgba(45, 41, 38, 0.03);

/* Subtle lift - cards on hover */
--shadow-md: 0 2px 8px rgba(45, 41, 38, 0.04),
             0 1px 2px rgba(45, 41, 38, 0.03);

/* Prominent - modals, popovers */
--shadow-lg: 0 8px 24px rgba(45, 41, 38, 0.06),
             0 2px 4px rgba(45, 41, 38, 0.03);
```

### Dark Mode Shadows

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);

--shadow-md: 0 2px 8px rgba(0, 0, 0, 0.3),
             0 0 1px rgba(255, 255, 255, 0.03);

--shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.4),
             0 0 1px rgba(255, 255, 255, 0.05);
```

---

## Border Radius

| Element | Radius |
|---------|--------|
| Cards | `16px` |
| Buttons | `8px` |
| Small buttons | `6px` |
| Pills/Tags | `20px` |
| Inputs | `8px` |
| Images | `12px` |

---

## Transitions

### Easing Functions

```css
--ease-out: cubic-bezier(0.33, 1, 0.68, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

### Duration Guidelines

| Interaction | Duration |
|-------------|----------|
| Micro (hover, focus) | `0.15s` |
| Standard | `0.2s` to `0.3s` |
| Expand/collapse | `0.4s` |
| Theme transition | `0.5s` |
| Page transitions | `0.6s` |

### Theme Transition

```css
--theme-transition: background 0.5s var(--ease-out),
                   color 0.3s var(--ease-out),
                   border-color 0.3s var(--ease-out),
                   box-shadow 0.3s var(--ease-out);
```

---

## Iconography

### Style Guidelines

- Stroke width: `1.5px`
- Corner radius: Rounded
- Size: `18px` to `24px` (contextual)
- Color: Inherit from text color

### Icon Set (SVG)

| Icon | Usage |
|------|-------|
| Wine bottle | Drink action, bottle indicators |
| Plus | Add action |
| Edit/Pencil | Edit action |
| Grid (4 squares) | Compact view toggle |
| Lines (3 horizontal) | List view toggle |
| Sun | Light mode |
| Moon | Dark mode |
| Search | Search action |
| Menu (3 lines) | Navigation |
| Chevron | Expand/collapse indicator |

---

## Bottle Indicators

### Size Classes

```css
.bottle-icon.small {
    height: 16px;    /* Piccolo, Quarter, Demi */
}

.bottle-icon.standard {
    height: 24px;    /* 750ml */
}

.bottle-icon.large {
    height: 32px;    /* Magnum, Jeroboam+ */
}
```

### Visual Representation

Each bottle is an SVG silhouette. The height difference communicates bottle size at a glance.

---

## Responsive Breakpoints

| Breakpoint | Width | Compact Columns |
|------------|-------|-----------------|
| XL | `≥1200px` | 6 |
| LG | `992-1199px` | 5 |
| MD | `768-991px` | 4 |
| SM | `480-767px` | 3 |
| XS | `<480px` | 2 |

---

## Rating Interface (Phase 0 Addition)

The rating system uses a minimal dot-based approach for selecting scores on a 10-point scale.

### Dot Specifications

```css
.rating-dot {
    width: 10px;
    height: 10px;
    border: 1.5px solid var(--divider);
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.15s ease;
}

.rating-dot:hover {
    transform: scale(1.2);
    border-color: var(--accent);
}

.rating-dot.filled {
    /* Filled by cumulative selection */
}

/* Overall rating - burgundy */
.rating-overall .rating-dot.filled {
    background: #8B4A5C;
    border-color: #8B4A5C;
}

/* Value rating - sage green */
.rating-value .rating-dot.filled {
    background: #7A8B6B;
    border-color: #7A8B6B;
}
```

### Behavior

- **Cumulative fill**: Clicking dot 7 fills dots 1-7
- **Hover preview**: Shows fill state before click
- **Both ratings required**: Submit button disabled until both selected
- **Numeric display**: Selected value shows in header (e.g., "Overall: 8")

### Layout

```
Desktop (>520px):        Mobile (<520px):
┌──────────────────┐     ┌──────────────────┐
│ Overall  ○○○○○○○○○○│     │ Overall          │
│ Value    ○○○○○○○○○○│     │ ○○○○○○○○○○       │
└──────────────────┘     │ Value            │
                         │ ○○○○○○○○○○       │
                         └──────────────────┘
```

---

## AI Loading Animations (Phase 0 Addition)

Three animation styles are available for AI loading states. Each maintains the quiet luxury aesthetic.

### Style 1: Basic (Default)

Simple opacity cycling on horizontal bars:

```css
.loading-bar {
    height: 2px;
    background: var(--accent);
    animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
}
```

### Style 2: Decanting

Horizontal bars that "breathe" (width pulses), suggesting wine being poured:

```css
.loading-bar-decanting {
    height: 2px;
    background: var(--accent);
    animation: decant 2s ease-in-out infinite;
}

@keyframes decant {
    0%, 100% { width: 20%; }
    50% { width: 80%; }
}

/* Stagger each bar */
.bar-1 { animation-delay: 0s; }
.bar-2 { animation-delay: 0.3s; }
.bar-3 { animation-delay: 0.6s; }
```

### Style 3: Vineyard Rows

Vertical bars at staggered heights, representing grape vines:

```css
.loading-bar-vineyard {
    width: 3px;
    background: var(--accent);
    animation: grow 1.2s ease-in-out infinite;
}

@keyframes grow {
    0%, 100% { height: 8px; }
    50% { height: 24px; }
}

/* Stagger each bar with different timing */
.vine-1 { animation-delay: 0s; animation-duration: 1.0s; }
.vine-2 { animation-delay: 0.2s; animation-duration: 1.4s; }
.vine-3 { animation-delay: 0.1s; animation-duration: 1.2s; }
```

### Loading Messages

Wine-themed messages cycle during AI operations (2-3 second intervals):

```javascript
const loadingMessages = [
    "Searching the cellars...",
    "Consulting the sommelier...",
    "Uncorking knowledge...",
    "Checking the vintages...",
    "Reading the terroir...",
    "Decanting information...",
    "Inspecting the cork...",
    "Swirling the glass...",
    "Examining the legs...",
    "Nosing the bouquet...",
    "Assessing the finish...",
    "Conferring with the maître d'...",
    "Perusing the carte des vins..."
];
```

### AI Loading Overlay

Full-screen overlay with centered loading animation:

```css
.ai-loading-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.ai-loading-content {
    background: var(--surface);
    padding: var(--space-6);
    border-radius: 16px;
    text-align: center;
    max-width: 300px;
}

.ai-loading-close {
    position: absolute;
    top: var(--space-4);
    right: var(--space-4);
    /* X button styling */
}
```

---

## Implementation Notes

### CSS Custom Properties

All design tokens are defined as CSS custom properties on `:root` and `[data-theme="dark"]`. This enables:

1. Easy theme switching via `data-theme` attribute
2. JavaScript access via `getComputedStyle()`
3. Future extensibility (additional themes)

### Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- CSS Grid and Flexbox
- CSS Custom Properties
- `prefers-color-scheme` media query (future)

---

*This design system is the source of truth for the Qvé visual language.*

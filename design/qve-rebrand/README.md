# Qvé Rebrand - UI Mockup

**Status**: Complete (Phase 1 - Visual Design)
**Created**: 2026-01-13
**File**: `qve-mockup.html`

---

## Overview

Qvé (pronounced "koo-VAY") is a proposed rebrand for the Wine Collection App. The name derives from "cuvée" - the champagne-making term for a blend or batch of wine.

The design embodies **quiet luxury** - the aesthetic of small grower champagne producers rather than ostentatious grand châteaux.

## Design Philosophy

> "Penthouse, 60th floor, champagne and canapés with soft jazz, floor-to-ceiling windows"

### Key Principles

1. **Understated Excellence** - Quality speaks for itself; no need for flashy embellishments
2. **Warm Sophistication** - Natural materials: aged paper, cork, linen, candlelight
3. **Functional Beauty** - Every element serves a purpose
4. **Respectful of Content** - The wines are the stars; UI stays in the background

## Features Implemented

### Dual Theme System
- **Light Mode**: Morning in the tasting room - soft natural light, aged paper tones
- **Dark Mode**: Evening penthouse - warm blacks, ambient glow, city lights

### Multi-View Density
- **Medium/List View**: Full wine cards with all details (2-3 per screen)
- **Compact/Grid View**: Tile layout for large collections (4-6 per row)
- View preference persists via localStorage

### Wine Cards
- Bottle size indicators (small/standard/large silhouettes)
- Rating display with subtle dot accent
- Expand/collapse with smooth animations
- Contextual action buttons (drink, add, edit)

### Responsive Design
- Desktop: 6 columns in compact view
- Tablet: 4-5 columns
- Mobile: 2-3 columns
- Cards stack vertically on narrow screens

## File Structure

```
design/qve-rebrand/
├── README.md              # This file
├── DESIGN_SYSTEM.md       # Colors, typography, spacing tokens
├── COMPONENTS.md          # UI component specifications
├── CHANGELOG.md           # Design iteration history
└── qve-mockup.html        # Live mockup (single-file, self-contained)
```

## How to View

1. Open `qve-mockup.html` in any modern browser
2. Click the sun/moon icon to toggle dark mode
3. Click the grid/list icons to toggle view density
4. Click any wine card to expand/collapse details

## Next Steps (Future Phases)

- [ ] Add Wine modal design
- [ ] Rating interface design
- [ ] Search and filter UI
- [ ] Navigation/sidebar design
- [ ] Empty state designs
- [ ] Loading state animations
- [ ] Error state designs
- [ ] Mobile-specific interactions

## Integration Notes

When ready to integrate with the live app:

1. Extract CSS variables to `resources/wineapp.css`
2. Update `resources/js/ui/cards.js` with new card template
3. Add view toggle to `resources/header.html`
4. Update `resources/js/app.js` with ViewModeController
5. Test with real wine data from database

---

*This mockup represents the visual direction for Qvé. Implementation into the production app is a separate phase.*

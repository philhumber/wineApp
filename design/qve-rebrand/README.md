# Qvé Rebrand - Design Mockups

**Status**: Phase 0 Complete ✅ (All mockups delivered)
**Created**: 2026-01-13
**Updated**: 2026-01-19

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

## Mockup Inventory

All mockups are complete and ready to serve as design specifications for the SvelteKit implementation.

| Mockup | File | Description | Status |
|--------|------|-------------|--------|
| Wine List | `qve-mockup.html` | Main collection view with cards, filters, view modes | ✅ Complete |
| Add Wine | `qve-add-wine-mockup.html` | 4-step wizard (Region → Producer → Wine → Bottle) | ✅ Complete |
| Drink/Rate | `qve-drink-rate-mockup.html` | Rating modal with 10-dot scale | ✅ Complete |
| Add Bottle | `qve-add-bottle-mockup.html` | Modal for adding bottle to existing wine | ✅ Complete |
| Edit Wine/Bottle | `qve-edit-mockup.html` | 2-tab form for editing wine or bottle details | ✅ Complete |
| Toast Notifications | `qve-toasts-mockup.html` | Success/error/info/undo notification styles | ✅ Complete |
| Empty/Error States | `qve-states-mockup.html` | Loading, empty, error states + AI loading overlay | ✅ Complete |

## Key Design Decisions (Phase 0)

### Rating Interface
- **10-point scale** using minimal dots (10px circles)
- Dots fill **cumulatively** (not individual selections)
- **Thematic colors**:
  - Overall rating: Burgundy `#8B4A5C`
  - Value rating: Green `#7A8B6B`
- Both ratings on **single row** with shortened labels ("Overall" / "Value")
- Responsive: stacks vertically on mobile (<520px)

### AI Loading Animations
Three animation styles available:
1. **Basic**: Simple progress bars with opacity cycling
2. **Decanting**: Horizontal bars that "breathe" (width pulses)
3. **Vineyard Rows**: Staggered vertical bars representing grape vines

**Wine-themed loading messages** (13 total):
- "Searching the cellars..."
- "Consulting the sommelier..."
- "Uncorking knowledge..."
- "Checking the vintages..."
- "Reading the terroir..."
- "Decanting information..."
- "Inspecting the cork..."
- "Swirling the glass..."
- "Examining the legs..."
- "Nosing the bouquet..."
- "Assessing the finish..."
- "Conferring with the maître d'..."
- "Perusing the carte des vins..."

### Form Patterns
- **Multi-step wizard** with dot indicators (active state highlighted)
- **Search-first dropdowns** for existing regions/producers/wines
- **AI enrichment buttons** reveal additional fields on click
- **Image upload** with drag-drop zone and preview states
- **Pill buttons** with uppercase labels, 100px border-radius

### Toast Notifications
- Bottom-right positioning (desktop), bottom-center (mobile)
- Auto-dismiss with progress indicator
- Swipe-to-dismiss gesture hint
- Undo action button variant

## File Structure

```
design/qve-rebrand/
├── README.md                      # This file (overview)
├── DESIGN_SYSTEM.md               # Colors, typography, spacing tokens
├── COMPONENTS.md                  # UI component specifications
├── CHANGELOG.md                   # Design iteration history
├── QVE_MIGRATION_PLAN.md          # Full migration roadmap
│
├── qve-mockup.html                # Wine list (main view)
├── qve-add-wine-mockup.html       # Add wine wizard (4 steps)
├── qve-drink-rate-mockup.html     # Rating modal
├── qve-add-bottle-mockup.html     # Add bottle modal
├── qve-edit-mockup.html           # Edit wine/bottle (2 tabs)
├── qve-toasts-mockup.html         # Toast notifications
└── qve-states-mockup.html         # Empty/error/loading states
```

## How to View Mockups

1. Open any `.html` file in a modern browser
2. Click the sun/moon icon to toggle dark mode (where available)
3. Interactive elements work for preview (tabs, steps, dropdowns)
4. Resize viewport to test responsive behavior (1200px → 375px)

## Design System Reference

### Quick Reference (Full details in DESIGN_SYSTEM.md)

| Token | Light | Dark |
|-------|-------|------|
| Background | `#FAF9F7` | `#0C0B0A` |
| Surface | `#FFFFFF` | `#1A1918` |
| Accent | `#A69B8A` | `#B8AFA0` |
| Text Primary | `#2D2926` | `#F0EDE6` |
| Divider | `#E8E4DE` | `#2A2826` |

### Typography
- **Headings**: Cormorant Garamond (400, 500)
- **Body/UI**: Outfit (300, 400, 500)

### Component Patterns
- Border radius: 8px (inputs, buttons), 16px (cards)
- Pill buttons: 100px radius, uppercase labels
- Shadows: Barely visible in light, subtle glow in dark

## Next Steps (Phase 1)

Phase 0 mockups are complete. Ready to proceed with:

1. **Initialize SvelteKit project** in `/qve/` folder
2. **Extract design tokens** from mockup CSS into Svelte styles
3. **Build core components** matching mockup specifications
4. **Implement routes** using mockups as visual spec

See [QVE_MIGRATION_PLAN.md](QVE_MIGRATION_PLAN.md) for full implementation roadmap.

---

*These mockups serve as the design specification for the Qvé SvelteKit implementation.*

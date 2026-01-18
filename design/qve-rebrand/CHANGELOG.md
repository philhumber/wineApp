# Qvé Design Changelog

Track design iterations and decisions for the Qvé rebrand.

---

## Version 1.0 - 2026-01-13

### Initial Mockup Complete

**Features Implemented:**
- Dual theme system (light/dark modes)
- Multi-view density (compact grid / medium list)
- Wine card component with expand/collapse
- Bottle size indicators (small/standard/large)
- Rating display
- View toggle with localStorage persistence
- Theme toggle with localStorage persistence
- Responsive grid layout (2-6 columns)

---

## Design Evolution

### Iteration 1: Name Selection

**Options Explored:**
- Cellar-themed: CellarBook, VinVault
- French/Italian: Sommelier, Enoteca
- Casual: Uncorked, Pour Decisions
- Champagne process: Riddler, Dosage, Disgorgement

**Decision:** "Cuvée" → stylized as **"Qvé"**

**Rationale:**
- Pronunciation retained: "koo-VAY"
- Visual distinction with Q replacing C
- Subtle, memorable, sophisticated

---

### Iteration 2: Color Direction

**Initial Approach:** Champagne gold accents (#C9A227)

**User Feedback:** "Too ostentatious" - wanted quiet luxury like grower champagne producers, not grand châteaux.

**Revision:** Muted taupe accent (#A69B8A)

**Rationale:**
- Aged cork, soft candlelight aesthetic
- Quality speaks for itself
- Understated > flashy

---

### Iteration 3: Dark Mode

**Brief:** "Penthouse, 60th floor, champagne and canapés with soft jazz, floor-to-ceiling windows"

**Implementation:**
- Warm black background (#0C0B0A) not pure black
- Subtle ambient glow on elevated elements
- Film grain texture overlay (subtle)
- Accent becomes softer (#B8AFA0)

**Result:** Evening sophistication without harshness

---

### Iteration 4: View Density

**Problem:** Large collections (50+ wines) showed only 2-3 cards per screen.

**Options Considered:**
1. Compact tiles only
2. Slider/carousel approach
3. Toggle between views
4. Three-tier zoom (tiles → cards → detail)

**Decision:** Two-view toggle (compact/medium)

**Rationale:**
- Simple to understand
- Covers most use cases
- Click tile to expand for details
- localStorage remembers preference

**Compact View Details:**
- Shows: Image, Name, Year, Bottle count, Rating
- Hides: Producer, region, actions, bottle silhouettes
- 4-6 tiles per row on desktop
- Expands inline (spans all columns)

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-13 | Name: Qvé | Distinctive, sophisticated, champagne connection |
| 2026-01-13 | Accent: Muted taupe | Quiet luxury aesthetic |
| 2026-01-13 | Dark mode: Warm blacks | Penthouse evening vibe |
| 2026-01-13 | Two view modes | Balance density vs. detail |
| 2026-01-13 | Inline expansion | Maintains grid context |
| 2026-01-13 | Bottle count in compact | Silhouettes too detailed for small tiles |

---

## Future Considerations

### Potential Additions
- Three-tier zoom (add "focus" mode for single wine)
- Keyboard navigation (arrow keys to browse)
- Gesture support (pinch to zoom view density)
- `prefers-color-scheme` auto-detection
- Transition animations between views
- Custom theme colors

### Technical Debt
- `-webkit-line-clamp` lacks standard fallback
- Grid `auto-fill` vs `auto-fit` consideration
- Consider CSS container queries for true component responsiveness

---

## Version History

| Version | Date | Summary |
|---------|------|---------|
| 1.0 | 2026-01-13 | Initial mockup complete |

---

*This changelog captures design thinking for future reference.*

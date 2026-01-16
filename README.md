# Wine Collection App

A personal wine collection management system built with vanilla JavaScript ES6+ and PHP.

**Status**: Phase 1 Complete, Sprint 3 In Progress
**JIRA**: https://philhumber.atlassian.net/jira/software/projects/WIN

---

## Quick Links

- **[CLAUDE.md](CLAUDE.md)** - Complete development guide (START HERE!)
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - How to contribute and PR workflow
- **[docs/](docs/)** - Complete documentation library

---

## Tech Stack

- **Frontend**: Vanilla JavaScript ES6+ (17 modular files)
- **Backend**: PHP 7+ with PDO
- **Database**: MySQL 8.0 on 10.0.0.16 (database: `winelist`)
- **AI**: Google Gemini AI API
- **Build**: None - pure vanilla, direct file serving

---

## Branching Strategy

We use a **four-tier branching strategy** to support both ongoing development and a parallel Svelte rewrite:

```
main (production)
  │
  └── staging (QA / integration testing)
        │
        ├── develop (ongoing fixes & features)
        │     ├── feature/WINE-*
        │     └── bugfix/WINE-*
        │
        └── svelte-rewrite (long-lived Qvé migration)
              ├── rewrite/component-library
              ├── rewrite/wine-list-page
              └── rewrite/api-integration
```

### Workflow

**For current app features/fixes:**
```
feature/WINE-42 → develop → staging → main
```

**For Svelte/Qvé rewrite:**
```
rewrite/wine-list-page → svelte-rewrite → staging → main
```

**For emergency hotfixes:**
```
hotfix/critical-bug → main (then backport to develop + svelte-rewrite)
```

### Documentation

- **[GitHub Setup Plan](docs/06-reference/GITHUB_SETUP_PLAN.md)** - Complete setup instructions
- **[GitHub Quick Reference](docs/06-reference/GITHUB_QUICK_REFERENCE.md)** - Common commands and workflows
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - PR guidelines and code style

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/philhumber/wineApp.git
cd wineApp
```

### 2. Start Development

**For current app work:**
```bash
git checkout develop
git pull origin develop
git checkout -b feature/WINE-XX-description
```

**For rewrite work:**
```bash
git checkout svelte-rewrite
git pull origin svelte-rewrite
git checkout -b rewrite/component-name
```

### 3. Run Local Server

```bash
php -S localhost:8000
```

Open http://localhost:8000 in your browser.

### 4. Make Changes & Open PR

See [CONTRIBUTING.md](CONTRIBUTING.md) for complete workflow.

---

## Project Structure

```
wineapp/
├── index.html                 # Main entry (SPA)
├── addwine.html              # 4-step wine add form
├── addBottle.html            # Add bottle to existing wine
├── editWine.html             # Edit wine details
├── rating.html               # Rating interface
├── drunkList.html            # Consumed wines history
├── CLAUDE.md                 # Complete dev guide
├── CONTRIBUTING.md           # PR workflow & code style
├── design/                   # UI/UX design mockups
│   └── qve-rebrand/          # Qvé rebrand mockup
├── docs/                     # Complete documentation
│   ├── 01-overview/          # Architecture, system design
│   ├── 02-development/       # Module guides, migration
│   ├── 03-testing/           # Testing guides
│   ├── 04-sprints/           # Sprint reports
│   ├── 05-issues/            # JIRA investigations
│   └── 06-reference/         # Quick refs, GitHub setup
├── resources/
│   ├── wineapp.css           # Main styles
│   ├── js/                   # 17 ES6 modules (NEW!)
│   │   ├── app.js           # Main entry
│   │   ├── core/            # API, State, Router, Modals
│   │   ├── ui/              # Cards, Forms, Dropdowns, Toast
│   │   ├── features/        # Rating, Wine Mgmt, Bottles, AI
│   │   └── utils/           # Helpers, Validation
│   ├── php/                 # 17 backend endpoints
│   └── sql/
│       └── DBStructure.sql  # Complete schema
└── images/                  # Wine photos, flags
```

---

## Key Features

### Current App (Production)
- ✅ Wine collection management (add, edit, drink, rate)
- ✅ 4-step wine add form with AI generation
- ✅ Smart filtering (country, region, type, producer, year)
- ✅ View mode toggle (Our Wines / All Wines)
- ✅ Toast notifications with scroll-to-wine
- ✅ 10-star rating system (overall + value)
- ✅ Bottle tracking with soft deletes
- ✅ Comprehensive audit logging
- ✅ Mobile-responsive design

### Qvé Migration (In Progress)
- 🚧 Svelte/SvelteKit PWA rebuild
- 🚧 "Quiet luxury" design theme (light/dark modes)
- 🚧 Multi-view density (compact grid / full cards)
- 🚧 Installable PWA for mobile
- 🚧 Offline support
- 🚧 Reuses existing PHP backend

**Status**: Design mockup complete, development planned after Sprint 3

---

## Current Sprint

**Sprint 3** (In Progress):
- [x] WIN-27: Right-click context menu
- [x] WIN-95: Picture upload enhancement (800x800 squares)
- [x] WIN-96: Card collapse scroll behavior
- [ ] WIN-88: Price scale display
- [ ] WIN-84: Purchase date picker
- [ ] WIN-38: Upload button UI
- [ ] WIN-43: Fun loading messages

**Next**: Qvé Migration (17-24 days)

---

## Testing

### Run Regression Tests

See [CLAUDE.md Testing Guide](CLAUDE.md#testing-guide) for complete test suite:

1. Initial page load & initialization
2. Navigation - sidebar open/close
3. Filter wines with dropdowns
4. Add wine workflow (4 tabs)
5. Drink bottle & rate wine
6. Add bottle to existing wine
7. Edit wine details
8. Wine card expand/collapse
9. AI data generation
10. View drunk wines history

### Sprint-Specific Tests

- **Sprint 1**: Critical bug verification (WIN-87, WIN-86, WIN-66, WIN-93)
- **Sprint 2**: Toast notifications, scroll-to-wine, filter persistence
- **Sprint 3**: Image upload, scroll behavior, right-click menu

---

## Database

**MySQL 8.0** on `10.0.0.16` (database: `winelist`)

### Core Tables
- `wine` - Wine details with soft deletes
- `bottles` - Individual bottles with tracking
- `ratings` - 10-star rating system
- `producers` - Wine producers
- `region` - Wine regions
- `country` - Countries with world classification
- `winetype` - Red, White, Rosé, Sparkling, Dessert, Fortified
- `audit_log` - Comprehensive change tracking

See [resources/sql/DBStructure.sql](resources/sql/DBStructure.sql) for complete schema.

---

## Documentation

### Core Guides
- **[CLAUDE.md](CLAUDE.md)** - Main development guide (single source of truth)
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - PR workflow, code style, testing
- **[docs/README.md](docs/README.md)** - Documentation navigation hub

### Architecture & Development
- [Architecture Overview](docs/01-overview/ARCHITECTURE.md)
- [Module API Reference](docs/02-development/MODULE_GUIDE.md)
- [Migration Guide](docs/02-development/MIGRATION_GUIDE.md)

### Testing
- [Testing Guide](docs/03-testing/TESTING_GUIDE.md)
- [Verification Guide](docs/03-testing/VERIFICATION_GUIDE.md)

### Sprints & Issues
- [Sprint Index](docs/04-sprints/README.md)
- [Phase 1 Report](docs/04-sprints/phase1/PHASE1_TESTING_REPORT.md)
- [Sprint 1 Summary](docs/04-sprints/sprint-01/SPRINT1_SUMMARY.md)

### GitHub & Contributing
- [GitHub Setup Plan](docs/06-reference/GITHUB_SETUP_PLAN.md)
- [GitHub Quick Reference](docs/06-reference/GITHUB_QUICK_REFERENCE.md)
- [Documentation Organization](docs/06-reference/DOCUMENTATION_ORGANIZATION_GUIDE.md)

### Design
- [Qvé Rebrand Overview](design/qve-rebrand/README.md)
- [Design System](design/qve-rebrand/DESIGN_SYSTEM.md)
- [Component Specs](design/qve-rebrand/COMPONENTS.md)
- [Live Mockup](design/qve-rebrand/qve-mockup.html)

---

## Contact

**Developer**: Phil Humber
**Email**: phil.humber@gmail.com
**JIRA**: https://philhumber.atlassian.net

---

## License

Private project - not open source.

---

*Last updated: 2026-01-16*

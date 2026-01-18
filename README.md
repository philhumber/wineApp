# Wine Collection App

A personal wine collection management application with AI-powered data entry, bottle tracking, and rating system.

**Last Updated**: 2026-01-18
**Status**: Phase 1 Complete ✅ | Sprint 1-2 Complete ✅ | Sprint 3 In Progress 🟡
**JIRA**: https://philhumber.atlassian.net/jira/software/projects/WIN

---

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
- [Development Guide](#development-guide)
- [Testing](#testing)
- [Current Status](#current-status)
- [Roadmap](#roadmap)
- [Documentation](#documentation)
- [Resources](#resources)

---

## Overview

The Wine Collection App is a comprehensive personal wine management system that helps track wine purchases, consumption, and ratings. It features:

- **Bottle Tracking**: Monitor inventory, locations, and purchase details
- **AI-Powered Entry**: Auto-populate wine, producer, and region data using Google Gemini AI
- **Rating System**: 10-point scale for overall quality and value
- **Filter & Search**: Multi-dimensional filtering by country, region, type, producer, year
- **View Modes**: Toggle between "Our Wines" (bottles > 0) and "All Wines"
- **History**: Complete consumption history with ratings and notes
- **Audit Trail**: Full change logging for data integrity

### Key Features

- **ES6 Modular Architecture**: 16 well-organized JavaScript modules
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Image Upload**: Automatic 800x800px square format with intelligent background
- **Soft Deletes**: Data preservation with audit logging
- **Transaction Safety**: Database operations with proper rollback handling

---

## Technology Stack

### Frontend
- **JavaScript**: Vanilla ES6+ modules (no frameworks)
- **HTML5**: Semantic markup with template cloning
- **CSS3**: Custom styles with animations and transitions
- **Architecture**: Observable state pattern, event delegation

### Backend
- **PHP**: 7+ with PDO for database operations
- **API Style**: JSON responses from 17 endpoint files
- **Image Processing**: GD library for upload/resize

### Database
- **MySQL**: 8.0 hosted on 10.0.0.16
- **Database Name**: `winelist`
- **Tables**: 11 tables with referential integrity
- **Features**: Soft deletes, audit logging, transaction support

### External Services
- **Google Gemini AI**: For intelligent data generation
- **API Key**: Configured in `resources/js/features/ai-integration.js`

---

## Project Structure

```
wineapp/
├── README.md                  # This file
├── CLAUDE.md                  # Quick-start guide for new sessions
├── index.html                 # Main SPA entry point
├── addwine.html              # 4-step wine addition form
├── addBottle.html            # Add bottle to existing wine
├── editWine.html             # Edit wine/bottle details
├── rating.html               # Rating interface
├── drunkList.html            # Consumed wines history
├── design/                   # UI/UX design mockups
│   └── qve-rebrand/          # Qvé rebrand design system
├── docs/                     # Complete documentation (see below)
├── images/                   # Wine photos, flags
└── resources/
    ├── wineapp.css           # Main styles (967 lines)
    ├── js/                   # JavaScript modules
    │   ├── app.js           # Main entry & initialization
    │   ├── core/            # API, State, Router, Modals
    │   ├── ui/              # Cards, Forms, Dropdowns, Navigation, Toast
    │   ├── features/        # Rating, Wine Mgmt, Bottles, AI
    │   └── utils/           # DOM helpers, Validation, Helpers
    ├── php/                 # Backend endpoints
    │   ├── getWines.php
    │   ├── addWine.php
    │   ├── drinkBottle.php
    │   ├── updateWine.php
    │   ├── addBottle.php
    │   ├── updateBottle.php
    │   ├── upload.php
    │   ├── callGeminiAI.php
    │   ├── audit_log.php
    │   └── ... (10 more)
    └── sql/
        └── DBStructure.sql  # Complete schema
```

### JavaScript Module Architecture

**17 ES6 Modules** organized in 4 layers:

#### Core Layer (Foundation)
- `core/api.js` - WineAPI class, all backend communication
- `core/state.js` - AppState with observable pattern
- `core/router.js` - Hash-based routing (future)
- `core/modals.js` - Modal overlay management

#### UI Layer (Interface)
- `ui/cards.js` - WineCardRenderer with template cloning
- `ui/forms.js` - FormManager for multi-step forms
- `ui/dropdowns.js` - DropdownManager for filters
- `ui/navigation.js` - NavigationManager for sidebar
- `ui/toast.js` - ToastManager for notifications
- `ui/loading.js` - LoadingTextCycler for AI loading states

#### Features Layer (Business Logic)
- `features/rating.js` - RatingManager (10-star system)
- `features/wine-management.js` - Add/edit wines
- `features/bottle-tracking.js` - Add/drink bottles
- `features/ai-integration.js` - Gemini AI integration

#### Utils Layer (Helpers)
- `utils/dom-helpers.js` - DOM manipulation utilities
- `utils/validation.js` - Form validation
- `utils/helpers.js` - Date formatting, utilities

---

## Database Schema

### Core Tables

#### wine
Primary entity for wine records.
```sql
wineID (PK), wineName, wineTypeID (FK), producerID (FK), year,
description, tastingNotes, pairing, pictureURL, ABV, drinkDate,
rating, bottlesDrunk, deleted, deletedAt, deletedBy
```

#### bottles
Inventory tracking for individual bottles.
```sql
bottleID (PK), wineID (FK), bottleSize, location, source,
price, currency, dateAdded, bottleDrunk, deleted, deletedAt, deletedBy
```

#### ratings
Consumption ratings and notes.
```sql
ratingID (PK), wineID (FK), bottleID (FK), overallRating,
valueRating, drinkDate, buyAgain, Notes, avgRating
```

#### producers
Wine producers/wineries.
```sql
producerID (PK), producerName, regionID (FK), town, founded,
ownership, description
```

#### region
Wine regions.
```sql
regionID (PK), regionName, countryID (FK), description,
climate, soil, map
```

#### country
Countries with world association.
```sql
countryID (PK), countryName, code, world_code, full_name,
iso3, number, continent
```

#### winetype
Wine type classifications.
```sql
wineTypeID (PK), wineType (Red, White, Rosé, Sparkling, Dessert, Fortified)
```

#### grapes
Grape varieties (not yet used in UI).
```sql
grapeID (PK), grapeName, description, picture
```

#### grapemix
Wine-to-grape relationships (not yet used in UI).
```sql
mixID (PK), wineID (FK), grapeID (FK), mixPercent
```

#### worlds
Old World vs New World classification (partial integration).
```sql
name (Old World, New World)
```

#### audit_log
Complete change tracking.
```sql
auditID (PK), tableName, recordID, action, columnName,
oldValue, newValue, changedBy, changedAt, ipAddress
```

### Relationships

```
worlds (1) → (N) country
country (1) → (N) region
region (1) → (N) producers
producers (1) → (N) wine
wine (1) → (N) bottles
wine (1) → (N) ratings ← (1) bottles
wine (1) → (N) grapemix ← (N) grapes
winetype (1) → (N) wine
```

All foreign keys use `ON DELETE RESTRICT` to prevent data loss.

---

## Getting Started

### Prerequisites

- PHP 7.4+ with GD library
- MySQL 8.0+
- Web server (Apache/Nginx) or `php -S` for local development
- Google Gemini AI API key

### Installation

1. **Clone or download the repository**
   ```bash
   cd /path/to/wineapp
   ```

2. **Database Setup**
   ```bash
   mysql -u root -p < resources/sql/DBStructure.sql
   ```

3. **Configure Database Connection**
   Edit `resources/php/databaseConnection.php`:
   ```php
   $host = "10.0.0.16";  // Your MySQL host
   $dbname = "winelist";
   $username = "your_user";
   $password = "your_password";
   ```

4. **Configure AI API Key**
   Edit `resources/js/features/ai-integration.js`:
   ```javascript
   const GEMINI_API_KEY = 'your-gemini-api-key';
   ```

5. **Start Development Server**
   ```bash
   php -S localhost:8000
   ```

6. **Open in Browser**
   Navigate to `http://localhost:8000`

### Verification

Run through the 10-point regression test checklist (see [Testing](#testing) below).

---

## Development Guide

### Quick Start for New Sessions

1. **Read CLAUDE.md** - Concise session guide
2. **Check current sprint** - See [Current Status](#current-status)
3. **Review JIRA board** - https://philhumber.atlassian.net/jira/software/projects/WIN
4. **Read relevant docs** - See [Documentation](#documentation)

### Development Workflow

#### One-Time Setup

1. **Clone the repository** (if not already done)
   ```bash
   git clone https://github.com/philhumber/wineApp.git
   cd wineApp
   ```

2. **Set up credentials** - Copy config example and add your credentials
   ```bash
   cp resources/php/config.local.php.example ../wineapp-config/config.local.php
   # Edit the file with your database and API credentials
   ```

#### Starting Work on a Feature

1. **Check JIRA** - Pick an issue from the current sprint
   - Board: https://philhumber.atlassian.net/jira/software/projects/WIN

2. **Create a feature branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/WIN-XX-short-description
   ```

3. **Your local files now match your branch**
   - When you switch branches, Git updates your working directory
   - The branch name in VSCode's bottom-left shows which code version you have

4. **Read relevant code** - Never modify files you haven't read first

5. **Start the dev server and test as you work**
   ```bash
   php -S localhost:8000
   ```
   Open http://localhost:8000 - this runs your current branch's code

6. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add feature description

   Refs: WIN-XX"
   ```

7. **Push and create a Pull Request**
   ```bash
   git push -u origin feature/WIN-XX-short-description
   ```
   - Open PR on GitHub targeting `develop`
   - Use **Squash and merge**

8. **Update JIRA** - Mark issue as Done after merge

### Git Branching Strategy

We use a **three-tier branching strategy**:

```
main (QA / testing - manual deploy to prod)
  │
  ├── develop (ongoing fixes & features)
  │     ├── feature/WIN-*
  │     └── bugfix/WIN-*
  │
  └── svelte-rewrite (long-lived Qvé migration)
        └── rewrite/*
```

**Production deployment**: Use `deploy.ps1` script to deploy to `V:\html\wineApp` with automatic backup.

**Flow for features/fixes:** `feature/WIN-XX` → `develop` → `main` → manual deploy

**Flow for Svelte rewrite:** `rewrite/*` → `svelte-rewrite` → `main` → manual deploy

**Flow for hotfixes:** `hotfix/*` → `main` (then backport to `develop` + `svelte-rewrite`)

See [CONTRIBUTING.md](CONTRIBUTING.md) for complete PR workflow and merge strategies.

---

### Design Patterns Used

- **Observable State**: Centralized AppState with subscriber pattern
- **Event Delegation**: Single listener on content area for performance
- **Template Cloning**: Fast DOM manipulation using HTML templates
- **Module Pattern**: ES6 modules with clear exports
- **Soft Deletes**: Data preservation with `deleted` flags
- **Transaction Safety**: PDO transactions with proper rollback

### Common Pitfalls to Avoid

1. **Don't load old `wineapp.js`** - Causes conflicts with modular system
2. **Use correct modal close** - `modalManager.hideAll()` not `ratingManager.closeModal()`
3. **Parse JSON in API responses** - Avoid double-nesting
4. **Refresh dropdowns after mutations** - Call `dropdownManager.refreshAllDropdowns()`
5. **Use transactions for multi-table operations** - Always rollback on error
6. **Check element existence** - Use `if (element)` before accessing

### Key Files Reference

**JavaScript Modules**:
- `resources/js/app.js` - Main entry, event delegation, init
- `resources/js/core/api.js` - WineAPI class
- `resources/js/core/state.js` - AppState, viewMode, filters
- `resources/js/ui/cards.js` - Card rendering, scrollToCard
- `resources/js/ui/toast.js` - Toast notifications
- `resources/js/features/wine-management.js` - Add/edit wines
- `resources/js/features/rating.js` - Rating system

**PHP Backend**:
- `resources/php/getWines.php` - Complex JOIN query with filters
- `resources/php/addWine.php` - Transaction-based insert (4 tables)
- `resources/php/drinkBottle.php` - Mark drunk, add rating
- `resources/php/upload.php` - 800x800px image processing
- `resources/php/audit_log.php` - Change tracking

**HTML Pages**:
- `index.html` - Main SPA entry
- `addwine.html` - 4-tab wine add form
- `rating.html` - Rating interface (has `#wineToRate`)
- `addBottle.html` - Add bottle form (has `#wineToAdd`)

---

## Testing

### Regression Test Suite (10 Tests)

Run after each sprint or major change:

1. **Initial Page Load** - Check console, verify wine list loads
2. **Sidebar Navigation** - Open/close sidebar, click links
3. **Filter Dropdowns** - Test all 5 filters (country, region, type, producer, year)
4. **Add Wine Workflow** - Complete 4-tab form with AI generation
5. **Drink Bottle & Rate** - Select bottle, rate (10-star), add notes
6. **Add Bottle** - Add bottle to existing wine
7. **Edit Wine** - Right-click card, modify fields
8. **Card Expand/Collapse** - Test smooth animations, scroll behavior
9. **AI Data Generation** - Test wine/producer/region AI calls
10. **Drunk Wines History** - Verify list displays with ratings

### Bug-Specific Testing

For each fixed JIRA issue:
1. Reproduce original bug
2. Apply fix
3. Verify bug resolved
4. Test related functionality
5. Check console for errors
6. Update JIRA status

### Sprint Testing Guides

Detailed testing procedures for each sprint:
- **Sprint 1**: Critical bug fixes (WIN-87, WIN-86, WIN-66, WIN-93)
- **Sprint 2**: UX improvements (WIN-90, WIN-92 toast, scroll, filters)
- **Sprint 3**: Feature enhancements (WIN-95, WIN-27, WIN-96)

See `CLAUDE.md` or sprint docs for detailed test cases.

---

## Current Status

### Phase 1: ES6 Modular Refactoring ✅ COMPLETE
**Completed**: January 2026

- Refactored 1,642-line monolith into 17 ES6 modules
- 100% feature parity maintained
- All regression tests passing
- Old `wineapp.js` deprecated (do not load)

### Sprint 1: Critical Bug Fixes ✅ COMPLETE
**Completed**: 2026-01-12

Fixed 4 critical bugs affecting core functionality:
- ✅ **WIN-93**: closeModal error (fixed in Phase 1)
- ✅ **WIN-87**: Response nesting (JSON parsing)
- ✅ **WIN-66**: SQL rollback verification
- ✅ **WIN-86**: Audit array serialization

### Sprint 2: High Priority UX ✅ COMPLETE
**Completed**: 2026-01-12

Implemented major UX improvements:
- ✅ **WIN-90**: Toast notifications, scroll-to-wine, filter persistence
- ✅ **WIN-92**: View mode filtering (OURS/ALL/CLEAR buttons)
- ✅ **WIN-83**: Modal state preservation
- ✅ **WIN-94**: Navigate to new wine after add
- ✅ **WIN-XX**: Button ID collision fix

### Sprint 3: Feature Enhancements ✅ COMPLETE

All Issues Completed (9 total):
- ✅ **WIN-84**: Add purchase date field
- ✅ **WIN-38**: Upload button UI - Modern drag & drop zone with responsive thumbnail
- ✅ **WIN-43**: Loading UI improvements (cycling wine-themed messages)
- ✅ **WIN-88**: Price scale on wine cards ($ to $$$$$, per-liter normalized, by bottle size)
- ✅ **WIN-95**: Picture upload (800x800px, edge-sampled backgrounds)
- ✅ **WIN-27**: Right-click context menu
- ✅ **WIN-96**: Card collapse scroll behavior
- ✅ **WIN-NEW**: avgRating DECIMAL overflow fix
- ✅ **WIN-105**: Price scale uses median instead of average (reduces outlier skew)

### Open JIRA Issues

**Total**: 45 open issues across various priorities

**High Priority** (4 issues):
- WIN-80, WIN-70, WIN-79, WIN-34

**Medium Priority** (12 issues)
**Low Priority** (25 issues)

See JIRA board for complete list: https://philhumber.atlassian.net/jira/software/projects/WIN

---

## Roadmap

### Short Term (Next 2-4 weeks)

1. **Create Qvé mockups** - Design Add Wine and Drink/Rate flows
2. **Begin SvelteKit project** - Initialize Qvé migration
3. **Implement core components** - Routing and base layout

### Medium Term (1-2 months)

**Qvé Migration** - Full Svelte/SvelteKit PWA rebuild

- **Plan**: `C:\Users\Phil\.claude\plans\recursive-petting-cat.md`
- **Timeline**: 17-24 days
- **Approach**: Build new app at `/qve/` alongside existing app
- **Tech Stack**: Svelte/SvelteKit + Melt UI/Bits UI + existing PHP API
- **Features**: PWA installable, offline support, dual themes

**Phases**:
1. Phase 0: Complete mockups
2. Phase 1: Initialize SvelteKit project
3. Phase 2: API client + stores + PWA config
4. Phase 3: Build UI components
5. Phase 4: Implement page routes
6. Phase 5: Port advanced features
7. Phase 6: Testing and polish
8. Phase 7: Deploy

### Long Term (Phase 2+)

- **WIN-42**: Image recognition for wine labels
- **WIN-37**: AI chatbot (winebot)
- **WIN-32/31/30**: Producer and region info pages
- **WIN-78**: Caching layer
- **WIN-64**: Structured output with grounding

---

## Documentation

### Documentation Structure

All documentation is in the `docs/` folder, organized into 6 categories:

```
docs/
├── README.md                  # Documentation hub
├── 01-overview/              # Architecture, system design
├── 02-development/           # Module guides, migration docs
├── 03-testing/               # Testing guides, verification
├── 04-sprints/               # Sprint reports & checklists
├── 05-issues/                # JIRA issue investigations
└── 06-reference/             # Quick refs, glossary
```

### Key Documentation Files

**Must-Read for All Developers**:
- [CLAUDE.md](CLAUDE.md) - Main development guide (single source of truth)
- [CONTRIBUTING.md](CONTRIBUTING.md) - PR workflow, code style, testing
- [docs/README.md](docs/README.md) - Documentation navigation hub
- [docs/01-overview/ARCHITECTURE.md](docs/01-overview/ARCHITECTURE.md) - Complete system architecture
- [docs/02-development/MODULE_GUIDE.md](docs/02-development/MODULE_GUIDE.md) - Module API reference
- [docs/03-testing/TESTING_GUIDE.md](docs/03-testing/TESTING_GUIDE.md) - Testing procedures


**Sprint Work**:
- [docs/04-sprints/README.md](docs/04-sprints/README.md) - Sprint index
- [docs/04-sprints/phase1/PHASE1_TESTING_REPORT.md](docs/04-sprints/phase1/PHASE1_TESTING_REPORT.md) - Phase 1 refactoring
- [docs/04-sprints/sprint-01/SPRINT1_SUMMARY.md](docs/04-sprints/sprint-01/SPRINT1_SUMMARY.md) - Sprint 1 bug fixes
- [docs/04-sprints/sprint-02/SPRINT2_SUMMARY.md](docs/04-sprints/sprint-02/) - Sprint 2 UX improvements

**Design & Migration**:
- [design/qve-rebrand/README.md](design/qve-rebrand/README.md) - Qvé rebrand overview
- [design/qve-rebrand/DESIGN_SYSTEM.md](design/qve-rebrand/DESIGN_SYSTEM.md) - Design tokens
- [design/qve-rebrand/qve-mockup.html](design/qve-rebrand/qve-mockup.html) - Live mockup

**Session Guide**:
- [CLAUDE.md](CLAUDE.md) - Quick-start guide for new AI sessions

**Architecture & Development**
- [Architecture Overview](docs/01-overview/ARCHITECTURE.md)
- [Module API Reference](docs/02-development/MODULE_GUIDE.md)
- [Migration Guide](docs/02-development/MIGRATION_GUIDE.md)

**Testing**
- [Testing Guide](docs/03-testing/TESTING_GUIDE.md)
- [Verification Guide](docs/03-testing/VERIFICATION_GUIDE.md)

**GitHub & Contributing**
- [GitHub Setup Plan](docs/06-reference/GITHUB_SETUP_PLAN.md) - Complete setup instructions
- [GitHub Quick Reference](docs/06-reference/GITHUB_QUICK_REFERENCE.md) - Common commands and workflows
- [Documentation Organization](docs/06-reference/DOCUMENTATION_ORGANIZATION_GUIDE.md)
-  CONTRIBUTING.md](CONTRIBUTING.md - PR guidelines and code style

---

## Resources

### External Links

- **JIRA Board**: https://philhumber.atlassian.net/jira/software/projects/WIN
- **Database**: MySQL 8.0 on 10.0.0.16 (database: `winelist`)
- **AI API**: Google Gemini AI

### Quick Commands

```bash
# Run local server
php -S localhost:8000

# Search for function definition
grep -r "function functionName" resources/js/

# Find all TODOs
grep -r "TODO" resources/

# Count module lines
wc -l resources/js/**/*.js

# Database connection test
mysql -h 10.0.0.16 -u username -p winelist
```

### Deployment

Deploy to production server at `V:\html\wineApp` using PowerShell:

```powershell
# Preview deployment (no changes made)
.\deploy.ps1 -DryRun

# Deploy to production (creates backup first)
.\deploy.ps1

# List available backups
.\deploy.ps1 -ListBackups

# Rollback to a specific backup
.\deploy.ps1 -Rollback "2026-01-18_143022"
```

**Features:**
- Auto-backup before each deployment (kept at `V:\html\wineApp-backups\`)
- Retains 5 most recent backups, auto-cleans older ones
- Excludes config files, docs, design, and dev files
- Wine images use merge mode (adds new, never overwrites existing uploads)

### JIRA API Access

Use the **WebFetch** tool to query JIRA issues:
```
WebFetch URL: https://philhumber.atlassian.net/jira/software/projects/WIN/board
Prompt: "List all open issues in the current sprint"
```

For REST API queries:
```
WebFetch URL: https://philhumber.atlassian.net/rest/api/3/search?jql=project=WIN+AND+status!=Done
Prompt: "Extract issue keys, summaries, and statuses"
```

**Note**: API token stored in `../wineapp-config/jira.config.json`

### File Locations

- **Main App**: `index.html`
- **Config**: `resources/php/databaseConnection.php`
- **AI Key**: `resources/js/features/ai-integration.js`
- **Schema**: `resources/sql/DBStructure.sql`
- **Styles**: `resources/wineapp.css`

---

## Contact & Support

**Developer**: Phil Humber
**Email**: phil.humber@gmail.com
**JIRA**: https://philhumber.atlassian.net

---

## License

Private project - All rights reserved.

---

*Last Updated: 2026-01-16*
*This README serves as the comprehensive reference for the Wine Collection App project.*


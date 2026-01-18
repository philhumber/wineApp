# Wine Collection App - Quick Start Guide

**Last Updated**: 2026-01-18
**Status**: Phase 1 Complete ✅ | Sprint 1-3 Complete ✅ | Fix & Migrate Phase 🔧
**JIRA**: https://philhumber.atlassian.net/jira/software/projects/WIN

> **💡 For comprehensive project information, see [README.md](README.md)**
> **📚 For detailed documentation, see [docs/README.md](docs/README.md)**

---

## Current Session Context

### Sprint Status

| Sprint | Status | Focus |
|--------|--------|-------|
| Sprint 1 | ✅ COMPLETE | Critical bug fixes (WIN-87, WIN-86, WIN-66, WIN-93) |
| Sprint 2 | ✅ COMPLETE | UX improvements (toast, filters, scroll, view mode) |
| Sprint 3 | ✅ COMPLETE | Features (WIN-84 purchase date, WIN-38 upload, etc.) |
| Fix & Migrate | 🔧 ACTIVE | Fix remaining bugs, then start Qvé migration |

### Current Plan: Fix & Migrate (Option A)

**Phase 1: Quick Bug Fixes** (current app)
1. ✅ WIN-104: Edit page tab counter reset - DONE
2. ✅ WIN-105: Median for price scale - DONE
3. ✅ WIN-27: Right-click menu popup - DONE
4. 🔧 WIN-102: Can't edit a wine with no bottles - TO DO

**Phase 2: Qvé Migration**
- Start Svelte/SvelteKit PWA build
- Implement remaining features in new stack
- Defer AI features (WIN-37, WIN-42, WIN-64) to post-migration

### What You Need to Know

1. **✅ Phase 1 Complete** - 17 ES6 modules, old `wineapp.js` deprecated (DO NOT LOAD)
2. **✅ Sprint 1-3 Complete** - Core app stable, ready for migration
3. **✅ GitHub Setup Complete** - Repo at `philhumber/wineApp` with 3-branch workflow
4. **✅ Credentials Secured** - All credentials in `../wineapp-config/` (outside web root)
5. **🔧 Fix & Migrate Active** - Fix WIN-102, then start Qvé migration

### Critical Warnings

⚠️ **DO NOT** load old `resources/wineapp.js` - causes conflicts with modular system
⚠️ **DO NOT** use `ratingManager.closeModal()` - use `modalManager.hideAll()` instead
⚠️ **ALWAYS** refresh dropdowns after mutations - `dropdownManager.refreshAllDropdowns()`
⚠️ **CREDENTIALS** are in `../wineapp-config/` (DB: `config.local.php`, JIRA: `jira.config.json`)

---

## Quick Commands

```bash
# Run local development server
php -S localhost:8000

# Git workflow (always work from develop)
git checkout develop
git pull origin develop
git checkout -b feature/WINE-XX-description

# Database connection
mysql -h 10.0.0.16 -u username -p winelist

# Deploy to production (PowerShell)
.\deploy.ps1 -DryRun    # Preview changes
.\deploy.ps1            # Deploy with auto-backup
.\deploy.ps1 -ListBackups
.\deploy.ps1 -Rollback "2026-01-18_143022"
```

### JIRA API Access

Use **curl with Basic Auth** to query JIRA (the old `/rest/api/3/search` endpoint was deprecated):
```bash
# Get all open issues
curl -s -u "email:token" "https://philhumber.atlassian.net/rest/api/3/search/jql?jql=project=WIN+AND+status!=Done+ORDER+BY+priority+DESC&fields=key,summary,status,priority,issuetype"
```

**Credentials**: Stored in `../wineapp-config/jira.config.json` (email, token, baseUrl)

**Note**: The JIRA board UI requires browser login; use the REST API for programmatic access.

---

## GitHub & Branching

**Repository**: https://github.com/philhumber/wineApp

**Branch Structure**:
```
main (QA / testing - manual deploy to prod)
  │
  ├── develop (ongoing fixes & features)
  │
  └── svelte-rewrite (Qvé migration)
```

**Workflow**: Create feature branches from `develop`, open PRs, squash merge.
See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/06-reference/GITHUB_QUICK_REFERENCE.md](docs/06-reference/GITHUB_QUICK_REFERENCE.md)

**Credentials**: Stored in `../wineapp-config/` (outside repo):
- `config.local.php` - Database credentials
- `jira.config.json` - JIRA API token (email, token, baseUrl)

---

## Technology Stack (Quick Reference)

- **Frontend**: Vanilla JavaScript ES6+ modules (17 modules, no frameworks)
- **Backend**: PHP 7+ with PDO
- **Database**: MySQL 8.0 on 10.0.0.16 (database: `winelist`)
- **AI**: Google Gemini AI API
- **Architecture**: Observable state, event delegation, template cloning

**See [README.md](README.md) for complete stack details and project structure.**

---

## Key Files to Know

### JavaScript Modules (17 total)
```
resources/js/
├── app.js                          # Main entry, event delegation, init
├── core/
│   ├── api.js                      # WineAPI class, all backend calls
│   ├── state.js                    # AppState, viewMode, filters
│   └── modals.js                   # Modal overlay management
├── ui/
│   ├── cards.js                    # Card rendering, scrollToCard
│   ├── toast.js                    # Toast notifications
│   ├── loading.js                  # AI loading text cycler
│   ├── dropdowns.js                # Filter dropdowns
│   └── navigation.js               # Sidebar navigation
├── features/
│   ├── rating.js                   # 10-star rating system
│   ├── wine-management.js          # Add/edit wines
│   └── bottle-tracking.js          # Add/drink bottles
└── utils/                          # DOM helpers, validation
```

### PHP Backend (17 files)
```
resources/php/
├── getWines.php                    # Complex JOIN query with filters
├── addWine.php                     # Transaction-based insert (4 tables)
├── drinkBottle.php                 # Mark drunk, add rating
├── upload.php                      # 800x800px image processing
├── audit_log.php                   # Change tracking
└── ... (12 more)
```

### HTML Pages
- `index.html` - Main SPA entry
- `addwine.html` - 4-tab wine add form
- `rating.html` - Rating interface (has `#wineToRate`)
- `addBottle.html` - Add bottle form (has `#wineToAdd`)

### Database
- `resources/sql/DBStructure.sql` - Complete schema
- 11 tables: wine, bottles, ratings, producers, region, country, winetype, grapes, grapemix, worlds, audit_log
- **See [README.md](README.md) for complete schema and relationships**

---

## Development Workflow

### Starting a New Session

1. **Read this file** (CLAUDE.md) for current context
2. **Check current sprint** - See Sprint Status table above
3. **Check JIRA board** - https://philhumber.atlassian.net/jira/software/projects/WIN
4. **Check Qvé plan** - Ready to begin migration phase
5. **Read relevant docs** if needed:
   - [docs/01-overview/ARCHITECTURE.md](docs/01-overview/ARCHITECTURE.md) - System design
   - [docs/02-development/MODULE_GUIDE.md](docs/02-development/MODULE_GUIDE.md) - Module API reference
   - Recent sprint summaries in [docs/04-sprints/](docs/04-sprints/)

### Making Changes

1. **Create a feature branch** - Always create a branch from `develop` before starting work: `git checkout develop && git pull origin develop && git checkout -b feature/WIN-XX-description`
2. **Read files first** - Never modify code you haven't read
3. **Follow existing patterns** - Maintain consistency with modular architecture
4. **Test thoroughly** - Run 10-point regression test (see [docs/03-testing/TESTING_GUIDE.md](docs/03-testing/TESTING_GUIDE.md))
5. **Update JIRA** - Mark issues as Done when complete
6. **Update docs** - Update CLAUDE.md or relevant sprint docs if needed

### Common Pitfalls to Avoid

1. **Loading old wineapp.js** → Causes conflicts
2. **Wrong modal close function** → Use `modalManager.hideAll()` not `ratingManager.closeModal()`
3. **Not parsing JSON** → Always parse JSON in API responses
4. **Forgetting dropdown refresh** → Call `dropdownManager.refreshAllDropdowns()` after mutations
5. **No transactions** → Always use PDO transactions for multi-table operations
6. **No element checks** → Always check `if (element)` before accessing

**See [README.md](README.md) for detailed pitfall descriptions and solutions.**

---

## Sprint 3 Summary (Complete ✅)

### All Issues Completed (8 issues)
- WIN-84: Add purchase date field ✅
- WIN-38: Upload button UI - drag & drop zone with responsive thumbnail ✅
- WIN-43: Loading UI improvements (cycling wine-themed messages during AI loading) ✅
- WIN-88: Price scale on wine cards ($ to $$$$$, per-liter comparison, by bottle size) ✅
- WIN-95: Picture upload (800x800px, edge-sampled backgrounds) ✅
- WIN-27: Right-click context menu ✅
- WIN-96: Card collapse scroll behavior ✅
- WIN-NEW: avgRating DECIMAL overflow fix ✅

### Post-Sprint Cleanup (2026-01-18)
- WIN-104: Edit page tab counter reset ✅
- WIN-105: Median for price scale ✅

**See [README.md](README.md) for complete issue list and JIRA board for full details.**

---

## Testing

### Quick Regression Test (10 tests)

Run after each change:

1. Initial page load & initialization
2. Sidebar navigation
3. Filter dropdowns (5 filters)
4. Add wine workflow (4-tab form + AI)
5. Drink bottle & rate wine
6. Add bottle to existing wine
7. Edit wine details
8. Card expand/collapse
9. AI data generation
10. Drunk wines history

**See [docs/03-testing/TESTING_GUIDE.md](docs/03-testing/TESTING_GUIDE.md) for detailed test procedures.**

---

## Qvé Migration Plan (Phase 2)

**Status**: Ready to start after WIN-102 fix
**Approach**: Build new Svelte/SvelteKit PWA at `/qve/` alongside existing app

**Key Details**:
- Framework: Svelte/SvelteKit + Melt UI/Bits UI
- PWA: Installable, offline support
- Backend: Reuse existing PHP API unchanged
- Design: Complete mockup at `design/qve-rebrand/qve-mockup.html`

**Full plan**: `C:\Users\Phil\.claude\plans\recursive-petting-cat.md`

**Migration Steps**:
1. Fix WIN-102 (can't edit wine with no bottles)
2. Create mockups for Add Wine and Drink/Rate flows
3. Begin SvelteKit project initialization
4. Implement core components and routing
5. Port remaining backlog features to new stack

**See [README.md](README.md) for complete roadmap and migration phases.**

---

## Open Backlog Summary

### Bugs (To Do)
| Key | Summary |
|-----|---------|
| **WIN-102** | Can't edit a wine with no bottles |

### Tasks - Will migrate to Qvé
| Key | Summary |
|-----|---------|
| WIN-106 | Prepopulate wine image when editing |
| WIN-103 | Remove hardcoded currencies and sizes |
| WIN-80 | Delete a bottle (drink with no rating) |
| WIN-70 | Allow cancel 'drink Bottle' |
| WIN-68 | Sort by buttons |
| WIN-24 | Search |
| WIN-34 | Filtering and Sorting |
| WIN-69 | Add drink history |

### Tasks - AI Features (Post-Migration)
| Key | Summary |
|-----|---------|
| WIN-42 | Build Image recognition |
| WIN-37 | Build AI chatbot (winebot) |
| WIN-64 | Use structured output and grounding |

### Tasks - Infrastructure
| Key | Summary |
|-----|---------|
| WIN-97 | Add audit functions to all insert/update |
| WIN-78 | JS/PHP Caching |
| WIN-65 | Limit size of ownership return |

### In Progress (from previous work - review status)
| Key | Summary |
|-----|---------|
| WIN-79 | Check if similar region/producer/wine exists |
| WIN-67 | Add wine dropdowns context aware |
| WIN-57 | Add Wine Search Boxes |

### Epics
- WIN-1: AI
- WIN-21: UX/UI
- WIN-22: Functionality

---

## Documentation

### Quick Links

**Must-Read**:
- [README.md](README.md) - Comprehensive project reference
- [docs/README.md](docs/README.md) - Documentation hub

**Architecture & Development**:
- [docs/01-overview/ARCHITECTURE.md](docs/01-overview/ARCHITECTURE.md) - Complete system architecture
- [docs/02-development/MODULE_GUIDE.md](docs/02-development/MODULE_GUIDE.md) - Module API reference

**Testing**:
- [docs/03-testing/TESTING_GUIDE.md](docs/03-testing/TESTING_GUIDE.md) - Testing procedures

**Sprint Work**:
- [docs/04-sprints/README.md](docs/04-sprints/README.md) - Sprint index
- [docs/04-sprints/sprint-01/SPRINT1_SUMMARY.md](docs/04-sprints/sprint-01/SPRINT1_SUMMARY.md) - Sprint 1 (critical bugs)
- [docs/04-sprints/sprint-02/](docs/04-sprints/sprint-02/) - Sprint 2 (UX improvements)

**Design**:
- [design/qve-rebrand/README.md](design/qve-rebrand/README.md) - Qvé rebrand overview
- [design/qve-rebrand/qve-mockup.html](design/qve-rebrand/qve-mockup.html) - Live mockup

---

## Resources

**GitHub**: https://github.com/philhumber/wineApp
**JIRA Board**: https://philhumber.atlassian.net/jira/software/projects/WIN
**Database**: MySQL 8.0 on 10.0.0.16 (database: `winelist`)
**Developer**: Phil Humber (phil.humber@gmail.com)

---

*This file serves as a concise quick-start guide for new Claude sessions. For detailed information, see [README.md](README.md) and [docs/](docs/).*

# Wine Collection App - Documentation

Welcome to the Wine Collection App documentation! This is your central hub for all project documentation.

**Last Updated**: 2026-01-12
**Project Status**: Phase 1 Complete ✅, Sprint 1 Complete ✅

---

## 📚 Documentation Structure

Documentation is organized into 6 main categories for easy navigation:

### [01-overview/](01-overview/) - System Architecture & Design
High-level project information and system design documentation.

- **[ARCHITECTURE.md](01-overview/ARCHITECTURE.md)** - Complete system architecture
  - Technology stack (Vanilla JS, PHP, MySQL, Gemini AI)
  - Module structure (16 ES6 modules)
  - Database schema (11 tables)
  - Design patterns (Observable state, Event delegation)

### [02-development/](02-development/) - Developer Guides
Implementation guides and module documentation for developers.

- **[MODULE_GUIDE.md](02-development/MODULE_GUIDE.md)** - Detailed API reference for all 16 JavaScript modules
  - Complete API documentation with usage examples
  - Core layer: API, State, Router, Modals
  - UI layer: Cards, Forms, Dropdowns, Navigation
  - Features layer: Rating, Wine Management, Bottle Tracking, AI Integration
  - Utils layer: DOM helpers, Validation, Utilities

- **[MIGRATION_GUIDE.md](02-development/MIGRATION_GUIDE.md)** - Migration from monolithic to modular architecture
  - Before/after comparison
  - Key changes and breaking changes
  - Testing procedures

### [03-testing/](03-testing/) - Testing & Quality Assurance
Testing guides, verification procedures, and QA documentation.

- **[TESTING_GUIDE.md](03-testing/TESTING_GUIDE.md)** - Comprehensive testing workflows
  - 10 regression tests covering all features
  - Bug-specific testing procedures
  - Performance testing guidelines

- **[VERIFICATION_GUIDE.md](03-testing/VERIFICATION_GUIDE.md)** - Verification procedures
  - Code quality checks
  - Manual testing checklists
  - Deployment verification

### [04-sprints/](04-sprints/) - Sprint Execution Reports
Sprint documentation, completion reports, and testing checklists.

- **[Sprint Index](04-sprints/README.md)** - Overview of all sprints
- **[Phase 1](04-sprints/phase1/)** - ES6 Modular Refactoring ✅ Complete
  - [PHASE1_TESTING_REPORT.md](04-sprints/phase1/PHASE1_TESTING_REPORT.md)
  - [REFACTORING_PROGRESS.md](04-sprints/phase1/REFACTORING_PROGRESS.md)
- **[Sprint 1](04-sprints/sprint-01/)** - Critical Bug Fixes ✅ Complete
  - [SPRINT1_SUMMARY.md](04-sprints/sprint-01/SPRINT1_SUMMARY.md)
  - [SPRINT1_COMPLETION_REPORT.md](04-sprints/sprint-01/SPRINT1_COMPLETION_REPORT.md)
  - [SPRINT1_TEST_CHECKLIST.md](04-sprints/sprint-01/SPRINT1_TEST_CHECKLIST.md)

### [05-issues/](05-issues/) - JIRA Issue Deep-Dives
Detailed investigations and documentation for specific JIRA issues.

- **[bugs/](05-issues/bugs/)** - Bug investigation reports
  - [JIRA_WIN-XX_BUTTON_ID_COLLISION.md](05-issues/bugs/JIRA_WIN-XX_BUTTON_ID_COLLISION.md)

### [06-reference/](06-reference/) - Quick References & Meta-Docs
Quick lookup guides, glossary, and documentation about documentation.

- **[DOCUMENTATION_ORGANIZATION_GUIDE.md](06-reference/DOCUMENTATION_ORGANIZATION_GUIDE.md)** - Documentation organization guidelines

---

## 🎯 Quick Start Paths

### New Developer Onboarding
1. Read [ARCHITECTURE.md](01-overview/ARCHITECTURE.md) - Understand system design
2. Read [MODULE_GUIDE.md](02-development/MODULE_GUIDE.md) - Learn the module APIs
3. Read [TESTING_GUIDE.md](03-testing/TESTING_GUIDE.md) - Learn testing procedures
4. Check [Sprint Index](04-sprints/README.md) - See recent sprint work

### Understanding Recent Work
1. Read [SPRINT1_SUMMARY.md](04-sprints/sprint-01/SPRINT1_SUMMARY.md) - Latest bug fixes
2. Read [PHASE1_TESTING_REPORT.md](04-sprints/phase1/PHASE1_TESTING_REPORT.md) - Refactoring results

### Working on a Bug
1. Check [05-issues/bugs/](05-issues/bugs/) for existing investigations
2. Reference [TESTING_GUIDE.md](03-testing/TESTING_GUIDE.md) for testing procedures
3. Update sprint docs when complete

### Contributing Documentation
1. Read [DOCUMENTATION_ORGANIZATION_GUIDE.md](06-reference/DOCUMENTATION_ORGANIZATION_GUIDE.md)
2. Follow folder structure and naming conventions
3. Update this README if adding new top-level docs

---

## 📊 Project Status (2026-01-12)

### Completed Work
- ✅ **Phase 1**: ES6 Modular Refactoring
  - 16 ES6 modules (5,241 lines)
  - 100% feature parity with monolith
  - All regression tests passing

- ✅ **Sprint 1**: Critical Bug Fixes
  - WIN-93: closeModal error (fixed in Phase 1)
  - WIN-87: Response nesting (fixed)
  - WIN-66: SQL rollback (verified)
  - WIN-86: Audit arrays (fixed)

### Current Focus
- **Sprint 2**: High Priority UX fixes (44 JIRA issues remaining)
- **Sprint 3**: Medium priority features
- **Sprint 4**: Architecture review

---

## 🏗️ System Architecture Summary

### Technology Stack
- **Frontend**: Vanilla JavaScript ES6+ (NO frameworks)
- **Backend**: PHP 7+ with PDO
- **Database**: MySQL 8.0 on 10.0.0.16
- **AI**: Google Gemini AI API

### Module Structure
```
resources/js/
├── core/           # API, State, Router, Modals
├── ui/             # Cards, Forms, Dropdowns, Navigation
├── features/       # Rating, Wine Mgmt, Bottles, AI
├── utils/          # DOM helpers, Validation, Helpers
└── app.js          # Main entry & initialization
```

### Database
11 tables: wine, bottles, ratings, producers, region, country, winetype, grapes, grapemix, worlds, audit_log

---

## 🧪 Testing

### Regression Test Suite
10 comprehensive tests covering:
1. Initial page load & initialization
2. Sidebar navigation
3. Filter dropdowns
4. Add wine workflow (4-step form + AI)
5. Drink bottle & rate wine
6. Add bottle to existing wine
7. Edit wine details
8. Card expand/collapse
9. AI data generation
10. Drunk wines history

**Test Status**: ✅ All passing (as of 2026-01-12)

See [TESTING_GUIDE.md](03-testing/TESTING_GUIDE.md) for complete testing procedures.

---

## 📖 Key Documentation Files

### Must-Read for All Developers
- [ARCHITECTURE.md](01-overview/ARCHITECTURE.md) - System design and patterns
- [MODULE_GUIDE.md](02-development/MODULE_GUIDE.md) - Complete module API reference
- [TESTING_GUIDE.md](03-testing/TESTING_GUIDE.md) - Testing procedures

### Sprint Work
- [Sprint Index](04-sprints/README.md) - All sprint reports and completion docs

### Main Project Guide
See [../CLAUDE.md](../CLAUDE.md) for the comprehensive development guide (single source of truth for new sessions)

---

## 🔗 External Resources

- **JIRA Board**: https://philhumber.atlassian.net/jira/software/projects/WIN
- **Database**: MySQL on 10.0.0.16 (database: `winelist`)
- **Repository Root**: `c:\Users\Phil\Google Drive\dev\wineapp`

---

## 📝 Documentation Maintenance

### When to Update Documentation
- **New module created** → Add to [MODULE_GUIDE.md](02-development/MODULE_GUIDE.md)
- **Sprint complete** → Create folder in [04-sprints/](04-sprints/) with reports
- **Architecture changes** → Update [ARCHITECTURE.md](01-overview/ARCHITECTURE.md)
- **Bug investigation** → Create file in [05-issues/](05-issues/)
- **New patterns discovered** → Document in relevant guide

### Documentation Guidelines
- Keep files focused and single-purpose
- Use numbered folder prefixes for ordering (01-, 02-, etc.)
- Update "Last Updated" dates when making changes
- Follow naming conventions (see [DOCUMENTATION_ORGANIZATION_GUIDE.md](06-reference/DOCUMENTATION_ORGANIZATION_GUIDE.md))

---

## ❓ FAQs

**Q: Why organize docs into folders?**
A: Flat structure becomes unwieldy at 20+ files. Folder hierarchy scales to 50+ docs while maintaining clarity.

**Q: Where do sprint reports go?**
A: In `04-sprints/sprint-NN/` with SUMMARY.md, COMPLETION_REPORT.md, and TEST_CHECKLIST.md.

**Q: Where do bug investigations go?**
A: In `05-issues/bugs/` with format `JIRA_WIN-NN_SHORT-TITLE.md`.

**Q: What's the difference between CLAUDE.md and docs/?**
A: CLAUDE.md is the single source of truth for spinning up new sessions. docs/ contains detailed technical documentation.

**Q: Where should I start?**
A: Read [ARCHITECTURE.md](01-overview/ARCHITECTURE.md) first, then [MODULE_GUIDE.md](02-development/MODULE_GUIDE.md), then recent sprint docs.

---

## 📧 Contact & Support

**Developer**: Phil Humber
**Email**: phil.humber@gmail.com
**JIRA**: https://philhumber.atlassian.net

---

*This documentation hub is maintained as the project evolves. Always check file dates for currency.*

**Documentation Organization Status**: ✅ Implemented 2026-01-12

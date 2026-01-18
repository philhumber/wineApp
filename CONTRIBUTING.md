# Contributing to Wine Collection App

Thank you for contributing! This guide will help you understand the workflow for making changes to the codebase.

---

## Branch Strategy

We use a **three-tier branching strategy**:

```
main (QA / testing - manual deploy to prod)
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

**Production deployment**: Files are manually deployed to the webserver when ready.

**For detailed setup instructions**, see [docs/06-reference/GITHUB_SETUP_PLAN.md](docs/06-reference/GITHUB_SETUP_PLAN.md)

---

## Quick Start

### 1. Create a Feature Branch

**For current app features/fixes:**
```bash
git checkout develop
git pull origin develop
git checkout -b feature/WINE-42-short-description
```

**For Svelte rewrite work:**
```bash
git checkout svelte-rewrite
git pull origin svelte-rewrite
git checkout -b rewrite/component-name
```

**Branch Naming:**
- `feature/WINE-XX-description` - New features
- `bugfix/WINE-XX-description` - Bug fixes
- `rewrite/component-name` - Svelte rewrite work
- `hotfix/description` - Emergency production fixes

---

### 2. Make Your Changes

**Before you start coding:**
- [ ] Read [CLAUDE.md](CLAUDE.md) for project context
- [ ] Check JIRA for issue details
- [ ] Read existing code before modifying
- [ ] Follow existing code patterns

**While coding:**
- Write clear, descriptive commit messages
- Keep commits atomic (one logical change per commit)
- Test your changes locally
- Update documentation if needed

**Example commits:**
```bash
git commit -m "Add price scale calculation to wine cards

- Calculate price/mL ratio vs collection average
- Display $ to $$$$$ scale in card header
- Add priceScale to wine card template
- Refs: WINE-42"
```

---

### 3. Push Your Branch

```bash
git push -u origin feature/WINE-42-short-description
```

---

### 4. Open a Pull Request

Go to GitHub and click **"Compare & pull request"**

#### PR Title Format

**Good titles:**
```
WINE-42: Add price scale to wine cards
WINE-88: Implement purchase date picker
Rewrite: Create Svelte component library
Hotfix: Fix avgRating overflow on 10/10 rating
```

**Bad titles:**
```
Updates
Fix stuff
WIP
Testing
```

#### PR Description Template

```markdown
## Summary
Brief description of what this PR does and why.

## Changes Made
- Added price scale calculation in getWines.php
- Updated wine card template with $ to $$$$$ display
- Added CSS styling for price indicators

## Testing
- [ ] Ran full regression test suite
- [ ] Tested on desktop and mobile
- [ ] Verified filter state preservation
- [ ] No console errors

## JIRA Issue
Closes WINE-42

## Screenshots (if UI change)
[Attach screenshots here]
```

---

### 5. Merge Strategy

| Source → Target | Merge Method | Notes |
|----------------|--------------|-------|
| `feature/*` → `develop` | **Squash and merge** | Cleans up WIP commits |
| `bugfix/*` → `develop` | **Squash and merge** | Single logical unit |
| `develop` → `main` | **Merge commit** | Preserve milestone |
| `rewrite/*` → `svelte-rewrite` | **Squash and merge** | Clean rewrite history |
| `svelte-rewrite` → `main` | **Merge commit** | Preserve release point |
| `hotfix/*` → `main` | **Squash and merge** | Emergency fix |

---

## The Complete Workflow

### Normal Feature Development

```
1. Create feature branch from develop
   ↓
2. Make changes, commit, push
   ↓
3. Open PR: feature/WINE-42 → develop
   ↓
4. Review (self-review checkpoint)
   ↓
5. Merge (squash and merge)
   ↓
6. Open PR: develop → main (requires 1 approval)
   ↓
7. Test on main branch
   ↓
8. Merge (merge commit)
   ↓
9. Manually deploy to production webserver when ready
```

### Svelte Rewrite Development

```
1. Create rewrite branch from svelte-rewrite
   ↓
2. Implement Svelte component
   ↓
3. Open PR: rewrite/wine-list → svelte-rewrite
   ↓
4. Review (architecture review)
   ↓
5. Merge (squash and merge)
   ↓
6. When complete → svelte-rewrite → main
```

### Emergency Hotfix

```
1. Create hotfix branch from main
   ↓
2. Fix the bug, test thoroughly
   ↓
3. Open PR: hotfix/description → main
   ↓
4. Fast-track review (admin bypass allowed if critical)
   ↓
5. Merge (squash and merge)
   ↓
6. Backport to develop AND svelte-rewrite
```

---

## Testing Requirements

### Before Opening a PR

Run the appropriate test suite from [CLAUDE.md](CLAUDE.md):

**Phase 1 Regression Tests (10 Core Tests):**
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

**Sprint-Specific Tests:**
- Sprint 1: Critical bug verification (WIN-87, WIN-86, WIN-66, WIN-93)
- Sprint 2: Toast notifications, scroll-to-wine, filter persistence
- Sprint 3: WIN-95 (image upload), WIN-96 (scroll behavior), WIN-27 (right-click menu)

**Mobile Testing:**
- Test on iOS Safari and Android Chrome
- Verify touch gestures (long-press for context menu)
- Check responsive layout (320px - 1920px)

### After Merging to `main`

Run **complete QA suite** before deploying to production:
- All regression tests
- All sprint-specific tests
- Mobile testing
- Performance check (Lighthouse)
- Database integrity check
- Error log review

---

## Code Style Guidelines

### JavaScript (ES6 Modules)

**Good:**
```javascript
// Use descriptive names
async function calculatePriceScale(wine, collectionAverage) {
    const pricePerMl = wine.avgPrice / wine.avgSize;
    const ratio = pricePerMl / collectionAverage;

    if (ratio < 0.5) return 1; // $
    if (ratio < 0.8) return 2; // $$
    if (ratio < 1.2) return 3; // $$$
    if (ratio < 1.8) return 4; // $$$$
    return 5; // $$$$$
}

// Use try/catch for async operations
try {
    const result = await wineAPI.updateWine(wineId, data);
    toastManager.show('Wine updated successfully!', 'success');
} catch (error) {
    console.error('Failed to update wine:', error);
    toastManager.show('Failed to update wine', 'error');
}
```

**Bad:**
```javascript
// Vague names, no error handling
function calc(w, ca) {
    return w.p / w.s / ca < 0.5 ? 1 : 5;
}

wineAPI.updateWine(id, data); // No await, no error handling
```

### PHP

**Good:**
```php
// Use transactions for multi-table operations
try {
    $conn->beginTransaction();

    $stmt1 = $conn->prepare("INSERT INTO wine ...");
    $stmt1->execute($params);

    $stmt2 = $conn->prepare("INSERT INTO bottles ...");
    $stmt2->execute($params);

    $conn->commit();
} catch (PDOException $e) {
    $conn->rollBack();
    error_log("Failed to add wine: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Database error']);
}
```

**Bad:**
```php
// No transaction, poor error handling
$conn->query("INSERT INTO wine ...");
$conn->query("INSERT INTO bottles ...");
```

### CSS

**Follow existing patterns:**
```css
/* Use CSS custom properties for colors */
.price-scale {
    color: var(--wine-red);
    font-size: 0.9rem;
}

/* Mobile-first responsive design */
.wine-card {
    width: 100%;
}

@media (min-width: 768px) {
    .wine-card {
        width: calc(50% - 10px);
    }
}
```

---

## Common Mistakes to Avoid

### ❌ Don't work directly on protected branches
```bash
# BAD
git checkout develop
# ... make changes directly ...

# GOOD
git checkout develop
git checkout -b feature/WINE-42-description
# ... make changes in feature branch ...
```

---

### ❌ Don't bypass branch protection "just because"
Only use admin bypass for true emergencies. See [Admin Bypass Policy](docs/06-reference/GITHUB_SETUP_PLAN.md#admin-bypass-policy).

---

### ❌ Don't merge without testing
Always run at least basic regression tests before merging to `main`.

---

### ❌ Don't forget to sync `svelte-rewrite` weekly
```bash
# EVERY MONDAY (set a calendar reminder!)
git checkout svelte-rewrite
git pull origin svelte-rewrite
git merge main
git push origin svelte-rewrite
```

This prevents mega-merge hell after 6 months of development.

---

### ❌ Don't commit sensitive data
```bash
# Files to NEVER commit:
.env
credentials.json
config/database.php (with passwords)
*.pem / *.key
node_modules/
```

**Already committed secrets?**
1. Rotate the secrets immediately
2. Use `git filter-branch` or BFG Repo-Cleaner to remove from history
3. Force push (only if no one else has cloned)

---

## Weekly Sync Ritual

**Every Monday (or after any release to `main`):**

```bash
# Sync all long-lived branches
git checkout develop
git pull origin develop
git merge main
git push origin develop

git checkout svelte-rewrite
git pull origin svelte-rewrite
git merge main  # CRITICAL: keeps rewrite up-to-date with bug fixes
git push origin svelte-rewrite

git checkout develop  # Return to develop
```

**Why this matters:**
- Prevents merge conflicts from accumulating
- Ensures `svelte-rewrite` has all bug fixes from `main`
- Keeps all branches reasonably in sync
- Makes final merge to production smooth

**Tip:** Save this as a script `scripts/sync-branches.sh` for easy execution.

---

## Release Process

### Minor Release (Sprint Features)

1. **Merge features to develop**
   - Squash merge all `feature/*` branches
   - Delete merged feature branches

2. **Promote to main**
   - Open PR: `develop → main`
   - Title: "Sprint X: Feature A, Feature B, Bug Fix C"
   - Merge commit (preserve milestone)

3. **QA on main**
   - Run complete test suite
   - Test on mobile devices
   - Check performance
   - Verify no regressions

4. **Deploy to production**
   - Manually copy files to webserver
   - Tag: `v1.3.0` (optional)

5. **Sync branches** (Monday ritual)

---

### Major Release (Qvé Migration)

1. **Complete all rewrite features**
   - All `rewrite/*` branches merged to `svelte-rewrite`
   - Feature parity with current app verified
   - Performance testing completed

2. **Final sync with main**
   ```bash
   git checkout svelte-rewrite
   git merge main  # Get latest bug fixes
   git push origin svelte-rewrite
   ```

3. **Promote to main**
   - Open PR: `svelte-rewrite → main`
   - Title: "Qvé Migration: Complete Svelte rewrite"
   - Extensive description with:
     - Feature checklist
     - Breaking changes
     - Migration notes
     - Rollback plan
   - Merge commit

4. **Extended QA on main**
   - Full regression suite (current app)
   - Full rewrite testing
   - Side-by-side comparison
   - Performance benchmarks
   - Mobile testing (PWA features)
   - User acceptance testing

5. **Production release**
   - Manually deploy to webserver
   - Tag: `v2.0.0`

---

## Getting Help

### Documentation
- **[CLAUDE.md](CLAUDE.md)** - Main development guide (READ THIS FIRST!)
- **[docs/01-overview/ARCHITECTURE.md](docs/01-overview/ARCHITECTURE.md)** - System architecture
- **[docs/02-development/MODULE_GUIDE.md](docs/02-development/MODULE_GUIDE.md)** - Module API reference
- **[docs/06-reference/GITHUB_SETUP_PLAN.md](docs/06-reference/GITHUB_SETUP_PLAN.md)** - Complete GitHub setup

### JIRA
- **Board:** https://philhumber.atlassian.net/jira/software/projects/WIN
- All issues should have JIRA ticket (WINE-XX)

### Questions?
- Update documentation with lessons learned
- Add FAQ section if questions repeat
- Document common pitfalls

---

## Project-Specific Notes

### Current Focus (2026-01-16)
- **Sprint 3** is in progress (WIN-88, WIN-84, WIN-38, WIN-43)
- **Qvé Migration** plan is approved, waiting for Sprint 3 completion
- **Phase 1 refactoring** is complete (17 ES6 modules)

### Important Files
- **DO NOT load** `resources/wineapp.js` (old monolith - causes conflicts)
- **USE** modular files in `resources/js/` (new ES6 modules)
- **Toast notifications** replace success overlay (added in Sprint 2)
- **View mode filtering** (OURS/ALL/CLEAR buttons) added in Sprint 2

---

## Code Review Checklist

### Before Requesting Review
- [ ] Code follows existing patterns
- [ ] Tests pass (regression suite)
- [ ] No console errors
- [ ] Mobile tested (if UI change)
- [ ] Documentation updated (if needed)
- [ ] JIRA issue referenced in PR
- [ ] PR description is clear and complete
- [ ] Commits are atomic and well-described

### When Reviewing Your Own PR (Self-Review)
- [ ] Read the diff line-by-line (don't skim!)
- [ ] Check for accidentally committed debug code
- [ ] Verify no commented-out code blocks
- [ ] Ensure no TODOs left unresolved
- [ ] Test the change one more time
- [ ] Think: "Would I approve this if someone else wrote it?"

---

*Thank you for contributing to the Wine Collection App!*

*For questions or suggestions about this process, update this document and submit a PR.*

# GitHub Branching Strategy - Implementation Plan

**Last Updated**: 2026-01-16
**Status**: Ready for Implementation
**Team Size**: Solo developer (Phil Humber)

---

## Overview

This document outlines the complete GitHub setup for the Wine Collection App, including branch structure, protection rules, and workflow policies.

### Branch Hierarchy

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

### The Flow

**For normal work:**
```
feature/WINE-42 → develop → staging → main
```

**For the Svelte/Qvé rewrite:**
```
rewrite/wine-list-page → svelte-rewrite → staging → main
```

---

## Phase 1: Branch Structure Setup

### Current State
```
✅ main (exists - production)
✅ staging (exists - QA gate)
❌ develop (needs creation)
❌ svelte-rewrite (needs creation)
```

### Implementation Commands

**1. Create `develop` branch**
```bash
git checkout main
git pull origin main
git checkout -b develop
git push -u origin develop
```

**2. Create `svelte-rewrite` branch**
```bash
git checkout main
git checkout -b svelte-rewrite
git push -u origin svelte-rewrite
```

**3. Verify all branches exist**
```bash
git branch -a
# Should show: main, staging, develop, svelte-rewrite
```

---

## Phase 2: GitHub Branch Protection Rules

Go to: **Settings → Branches → Add branch protection rule**

### Rule 1: Protect `main` (Production)

| Setting | Value | Reason |
|---------|-------|--------|
| **Branch name pattern** | `main` | Exact match |
| **Require a pull request before merging** | ✅ | Force code review |
| **Require approvals** | **1** | Solo dev - self-review checkpoint |
| **Dismiss stale PR approvals when new commits pushed** | ✅ | Re-review after changes |
| **Require status checks to pass** | ❌ | No CI/CD yet |
| **Require branches to be up to date** | ✅ | Prevent merge conflicts |
| **Require conversation resolution** | ✅ | All comments addressed |
| **Include administrators** | ❌ | **Allow emergency hotfixes** |
| **Restrict who can push** | ❌ | Solo dev |
| **Allow force pushes** | ❌ | Protect history |
| **Allow deletions** | ❌ | Can't delete production |

---

### Rule 2: Protect `staging` (QA Gate)

| Setting | Value | Reason |
|---------|-------|--------|
| **Branch name pattern** | `staging` | Exact match |
| **Require a pull request before merging** | ✅ | Code review |
| **Require approvals** | **1** | QA sign-off (self-review) |
| **Require status checks to pass** | ❌ | No CI yet |
| **Require branches to be up to date** | ✅ | No stale merges |
| **Include administrators** | ❌ | Allow quick fixes |
| **Allow force pushes** | ❌ | Protect QA history |
| **Allow deletions** | ❌ | |

---

### Rule 3: Protect `develop` (Integration)

| Setting | Value | Reason |
|---------|-------|--------|
| **Branch name pattern** | `develop` | Exact match |
| **Require a pull request before merging** | ✅ | Code review |
| **Require approvals** | **0** | Lighter review for integration |
| **Require status checks to pass** | ❌ | No CI yet |
| **Require branches to be up to date** | ⚠️ Optional | Can be relaxed for speed |
| **Include administrators** | ❌ | Allow quick iteration |
| **Allow force pushes** | ❌ | Protect shared branch |
| **Allow deletions** | ❌ | |

---

### Rule 4: Protect `svelte-rewrite` (Long-lived Migration)

| Setting | Value | Reason |
|---------|-------|--------|
| **Branch name pattern** | `svelte-rewrite` | Exact match |
| **Require a pull request before merging** | ✅ | Code review |
| **Require approvals** | **1** | Important architecture decisions |
| **Require status checks to pass** | ❌ | No CI yet |
| **Require branches to be up to date** | ✅ | Avoid conflicts early |
| **Include administrators** | ❌ | |
| **Allow force pushes** | ❌ | Shared rewrite branch |
| **Allow deletions** | ❌ | |

---

## Phase 3: Merge Flow Policies

### Default Branch
Go to: **Settings → General → Default branch**
- Set `main` as default

### Merge Button Settings
Go to: **Settings → General → Pull Requests**

**Configuration:**
- ✅ **Allow squash merging**
- ✅ **Allow merge commits**
- ❌ **Allow rebase merging** (avoid history rewriting)
- ✅ **Automatically delete head branches** (cleanup)
- ✅ **Allow auto-merge** (once approvals met)

### Merge Strategy by Target

| Source → Target | Strategy | Reason |
|----------------|----------|---------|
| `feature/*` → `develop` | **Squash Merge** | Clean up WIP commits |
| `bugfix/*` → `develop` | **Squash Merge** | Single logical unit |
| `rewrite/*` → `svelte-rewrite` | **Squash Merge** | Clean rewrite history |
| `develop` → `staging` | **Merge Commit** | Preserve milestone |
| `staging` → `main` | **Merge Commit** | Preserve release point |
| `svelte-rewrite` → `staging` | **Merge Commit** | Major milestone |
| `hotfix/*` → `main` | **Squash Merge** | Single emergency fix |

---

## Phase 4: Branch Naming Conventions

### Feature Branches (from `develop`)
```
feature/WINE-42-add-price-scale
feature/WINE-88-purchase-date-picker
feature/WINE-43-fun-loading-messages
```

### Bug Fix Branches (from `develop`)
```
bugfix/WINE-93-closemodal-error
bugfix/WINE-87-response-nesting
bugfix/WINE-66-transaction-rollback
```

### Rewrite Branches (from `svelte-rewrite`)
```
rewrite/component-library
rewrite/wine-list-page
rewrite/api-integration
rewrite/rating-flow
rewrite/add-wine-form
```

### Hotfix Branches (from `main`)
```
hotfix/WINE-99-critical-security-fix
hotfix/avgrating-overflow
```

### Naming Rules
- **Always** include JIRA ticket number (WINE-XX)
- Use **kebab-case** for branch names
- Be **descriptive** but concise (max 50 chars)
- Use prefixes: `feature/`, `bugfix/`, `rewrite/`, `hotfix/`

---

## Phase 5: The Complete Merge Flow

### Normal Work (Current App)

```
┌─────────────────────────────────────────────────────────┐
│  1. Create Feature Branch                                │
└─────────────────────────────────────────────────────────┘

$ git checkout develop
$ git pull origin develop
$ git checkout -b feature/WINE-42-add-price-scale

# Work on feature, make commits
$ git add .
$ git commit -m "Add price scale calculation logic"
$ git push -u origin feature/WINE-42-add-price-scale


┌─────────────────────────────────────────────────────────┐
│  2. Open PR: feature/WINE-42 → develop                  │
└─────────────────────────────────────────────────────────┘

Go to GitHub → Pull Requests → New
- Title: "WINE-42: Add price scale to wine cards"
- Description: Implements $ to $$$$$ scale based on collection avg
- Reviewers: (self-review)
- Merge method: **Squash and merge**


┌─────────────────────────────────────────────────────────┐
│  3. Open PR: develop → staging                          │
└─────────────────────────────────────────────────────────┘

After merging feature branch:
- Title: "Sprint 3: Price scale + Purchase date features"
- Description: List all features included
- Reviewers: (self-review)
- Merge method: **Merge commit** (preserve milestone)


┌─────────────────────────────────────────────────────────┐
│  4. QA Testing on staging                                │
└─────────────────────────────────────────────────────────┘

Run complete test suite (see CLAUDE.md Testing Guide)
- Regression tests (10 main tests)
- Sprint-specific tests
- Mobile testing
- Performance check


┌─────────────────────────────────────────────────────────┐
│  5. Open PR: staging → main                             │
└─────────────────────────────────────────────────────────┘

After QA passes:
- Title: "Release: Sprint 3 Features (WINE-42, WINE-88, ...)"
- Description: Full release notes
- Reviewers: (self-review + approval required)
- Merge method: **Merge commit** (preserve release point)
- Tag: v1.3.0 (optional)
```

---

### Rewrite Work (Svelte/Qvé Migration)

```
┌─────────────────────────────────────────────────────────┐
│  1. Create Rewrite Branch                                │
└─────────────────────────────────────────────────────────┘

$ git checkout svelte-rewrite
$ git pull origin svelte-rewrite
$ git checkout -b rewrite/wine-list-page

# Implement Svelte component
$ git add qve/
$ git commit -m "Implement wine list grid with filters"
$ git push -u origin rewrite/wine-list-page


┌─────────────────────────────────────────────────────────┐
│  2. Open PR: rewrite/wine-list-page → svelte-rewrite   │
└─────────────────────────────────────────────────────────┘

- Title: "Rewrite: Wine list page with grid/list views"
- Description: Svelte component + Melt UI + responsive
- Reviewers: (architecture review)
- Merge method: **Squash and merge**


┌─────────────────────────────────────────────────────────┐
│  3. When Rewrite is Ready: svelte-rewrite → staging    │
└─────────────────────────────────────────────────────────┘

Only when /qve/ app is feature-complete:
- Title: "Qvé Migration: Complete Svelte rewrite"
- Description: Full feature parity checklist
- Reviewers: (thorough review + QA)
- Merge method: **Merge commit** (major milestone)


┌─────────────────────────────────────────────────────────┐
│  4. Final Release: staging → main                       │
└─────────────────────────────────────────────────────────┘

After extensive QA on staging:
- Title: "Release: Qvé 2.0 (Svelte Migration)"
- Description: Migration notes, breaking changes, rollback plan
- Merge method: **Merge commit**
- Tag: v2.0.0
```

---

### Hotfix Flow (Emergency Production Fix)

```
┌─────────────────────────────────────────────────────────┐
│  1. Create Hotfix Branch from main                      │
└─────────────────────────────────────────────────────────┘

$ git checkout main
$ git pull origin main
$ git checkout -b hotfix/WINE-99-critical-bug

# Fix the bug
$ git add .
$ git commit -m "Fix critical security vulnerability"
$ git push -u origin hotfix/WINE-99-critical-bug


┌─────────────────────────────────────────────────────────┐
│  2. Fast-track PR: hotfix/WINE-99 → main               │
└─────────────────────────────────────────────────────────┐

**ADMIN BYPASS ALLOWED** - Emergency only!
- Title: "HOTFIX: Critical security vulnerability"
- Description: What broke, what was fixed
- Merge method: **Squash and merge**
- Tag: v1.2.1 (patch version)


┌─────────────────────────────────────────────────────────┐
│  3. Backport to develop and svelte-rewrite              │
└─────────────────────────────────────────────────────────┘

$ git checkout develop
$ git merge main
$ git push origin develop

$ git checkout svelte-rewrite
$ git merge main
$ git push origin svelte-rewrite
```

---

## Phase 6: Weekly Sync Ritual

### Prevent Mega-Merge Hell

**Every Monday (or after every release to `main`):**

```bash
# 1. Sync staging with main
git checkout staging
git pull origin staging
git merge main
git push origin staging

# 2. Sync develop with staging
git checkout develop
git pull origin develop
git merge staging
git push origin develop

# 3. Sync svelte-rewrite with main (CRITICAL!)
git checkout svelte-rewrite
git pull origin svelte-rewrite
git merge main
git push origin svelte-rewrite
```

**Why this matters:**
- `svelte-rewrite` benefits from all bug fixes in `main`
- When rewrite is done, merge will be ~100 commits, not ~1000
- Conflicts are caught early (weekly), not after 6 months
- Ensures rewrite is always built on latest stable code

**Automation Idea** (future):
```bash
# Create a script: scripts/sync-branches.sh
#!/bin/bash
git checkout staging && git pull && git merge main && git push
git checkout develop && git pull && git merge staging && git push
git checkout svelte-rewrite && git pull && git merge main && git push
git checkout develop
echo "✅ All branches synced!"
```

---

## Phase 7: Admin Bypass Policy

### When Admin Bypass is ALLOWED

1. **Critical Production Hotfix**
   - Security vulnerability
   - Data loss prevention
   - Service outage

2. **Time-Sensitive Release**
   - User-facing bug causing support tickets
   - Compliance deadline

3. **Process Blocker**
   - PR approval system temporarily broken
   - GitHub Actions down

### When Admin Bypass is FORBIDDEN

1. **Normal feature development** → Use PR process
2. **"I'm in a hurry"** → Not an emergency
3. **"It's a small change"** → Still needs review
4. **"I'll review it later"** → Review first, merge second

### Admin Bypass Checklist

Before pushing directly to protected branch:

- [ ] Is this truly an emergency?
- [ ] Have I tested the change locally?
- [ ] Have I documented what I'm doing in commit message?
- [ ] Will I create a retroactive PR for review?
- [ ] Can this wait 10 minutes for a proper PR?

**Rule of Thumb:** If you have time to think about whether to bypass, you have time for a PR.

---

## Phase 8: Implementation Checklist

### Week 1: Foundation Setup
- [ ] Create `develop` branch from `main`
- [ ] Create `svelte-rewrite` branch from `main`
- [ ] Set `main` as default branch (Settings → General)
- [ ] Enable branch protection for `main` (1 approval, admin bypass allowed)
- [ ] Enable branch protection for `staging` (1 approval)
- [ ] Enable branch protection for `develop` (0 approvals)
- [ ] Enable branch protection for `svelte-rewrite` (1 approval)
- [ ] Configure merge buttons (allow squash + merge commits, no rebase)
- [ ] Enable auto-delete head branches

### Week 2: Documentation
- [ ] Update CLAUDE.md with branch strategy reference
- [ ] Create CONTRIBUTING.md with PR workflow
- [ ] Add branch diagram to main README.md
- [ ] Document weekly sync ritual

### Week 3: Test the Flow
- [ ] Create test feature: `feature/WINE-TEST-github-setup`
- [ ] Open PR → develop (squash merge)
- [ ] Open PR → staging (merge commit)
- [ ] Open PR → main (verify approval required)
- [ ] Complete full flow end-to-end
- [ ] Delete test branch
- [ ] Verify auto-delete worked

### Ongoing
- [ ] Weekly: Sync `svelte-rewrite` with `main`
- [ ] After releases: Sync `develop` and `staging`
- [ ] Monthly: Review bypass log (did I abuse it?)
- [ ] Quarterly: Review protection rules (adjust if needed)

---

## Common Pitfalls

### ❌ Mistake 1: Not syncing `svelte-rewrite` weekly
**Result:** After 6 months, 500+ merge conflicts
**Solution:** Set Monday calendar reminder for sync ritual

---

### ❌ Mistake 2: Working directly on `develop` or `svelte-rewrite`
**Result:** No code review, mistakes slip through
**Solution:** ALWAYS create feature branches, even for 1-line changes

---

### ❌ Mistake 3: Merging `develop` → `main` directly
**Result:** Untested code in production
**Solution:** ALWAYS merge through `staging` first (QA gate)

---

### ❌ Mistake 4: Using admin bypass too often
**Result:** Defeats the purpose of branch protection
**Solution:** Track bypass usage, aim for <1 per month

---

### ❌ Mistake 5: Forgetting to backport hotfixes
**Result:** Fix in `main`, but not in `develop` or `svelte-rewrite`
**Solution:** After hotfix merge, immediately backport to both branches

---

### ❌ Mistake 6: Too many long-lived feature branches
**Result:** Merge conflicts everywhere
**Solution:** Merge feature branches within 2-3 days max

---

## Quick Reference

### PR Title Templates

```
✅ Good PR Titles:
- "WINE-42: Add price scale to wine cards"
- "WINE-88: Implement purchase date picker"
- "Rewrite: Create Svelte component library"
- "Hotfix: Fix avgRating overflow on 10/10 rating"
- "Release: Sprint 3 Features"

❌ Bad PR Titles:
- "Updates"
- "Fix stuff"
- "WIP" (never merge work-in-progress!)
- "Testing"
- "asdfasdf"
```

### Git Command Cheatsheet

```bash
# Start new feature
git checkout develop && git pull && git checkout -b feature/WINE-XX-description

# Update feature branch with latest develop
git checkout feature/WINE-XX
git fetch origin
git rebase origin/develop

# Push feature branch
git push -u origin feature/WINE-XX

# Sync branches (weekly ritual)
git checkout staging && git pull && git merge main && git push
git checkout develop && git pull && git merge staging && git push
git checkout svelte-rewrite && git pull && git merge main && git push

# Emergency hotfix
git checkout main && git pull && git checkout -b hotfix/description
# ... fix bug ...
git push -u origin hotfix/description
# Create PR → main (fast-track)

# Backport hotfix
git checkout develop && git merge main && git push
git checkout svelte-rewrite && git merge main && git push

# Delete merged branch locally
git branch -d feature/WINE-XX

# Delete merged branch remotely (if auto-delete failed)
git push origin --delete feature/WINE-XX
```

---

## Future Enhancements

### When Team Grows
- Increase approval requirements (1 → 2)
- Add CODEOWNERS file (auto-assign reviewers)
- Restrict push permissions to specific users
- Require linear history (rebase before merge)

### When CI/CD is Added
- Require status checks before merge
- Add automated testing (unit, integration, E2E)
- Add linting checks (ESLint, PHPStan)
- Add security scanning (Snyk, npm audit)
- Add performance testing (Lighthouse CI)

### When Rewrite is Complete
- Archive or delete `svelte-rewrite` branch
- Update branch diagram (remove rewrite branch)
- Consider feature flags for gradual rollout

---

## Support

**Questions or issues with this setup?**
- Update this document with lessons learned
- Review quarterly and adjust rules as needed
- Document bypass usage and reasoning

---

*Last reviewed: 2026-01-16*
*Next review: 2026-04-16*

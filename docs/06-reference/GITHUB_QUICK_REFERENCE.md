# GitHub Quick Reference

**Last Updated**: 2026-01-16

Quick commands and workflows for the Wine Collection App branching strategy.

---

## Branch Hierarchy

```
main → staging → develop → feature/WINE-*
                      └─→ bugfix/WINE-*

       staging → svelte-rewrite → rewrite/*
```

---

## Common Workflows

### Start New Feature (Current App)

```bash
git checkout develop
git pull origin develop
git checkout -b feature/WINE-42-short-description

# Work on feature...
git add .
git commit -m "Add feature X"

git push -u origin feature/WINE-42-short-description
```

**Then**: Open PR on GitHub: `feature/WINE-42 → develop` (squash merge)

---

### Start Rewrite Work (Svelte/Qvé)

```bash
git checkout svelte-rewrite
git pull origin svelte-rewrite
git checkout -b rewrite/component-name

# Implement component...
git add qve/
git commit -m "Implement component X"

git push -u origin rewrite/component-name
```

**Then**: Open PR on GitHub: `rewrite/component-name → svelte-rewrite` (squash merge)

---

### Promote to Staging (After Features Merged)

```bash
# No git commands needed - use GitHub PR
```

**On GitHub**: Open PR `develop → staging` (merge commit)

---

### Release to Production (After QA Pass)

```bash
# No git commands needed - use GitHub PR
```

**On GitHub**: Open PR `staging → main` (merge commit, requires 1 approval)

---

### Emergency Hotfix

```bash
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug

# Fix the bug...
git add .
git commit -m "Fix critical bug X"

git push -u origin hotfix/critical-bug
```

**Then**:
1. Open PR on GitHub: `hotfix/critical-bug → main` (squash merge)
2. After merge, backport to develop and svelte-rewrite

---

### Backport Hotfix

```bash
# After hotfix merged to main, sync other branches:

git checkout develop
git pull origin develop
git merge main
git push origin develop

git checkout svelte-rewrite
git pull origin svelte-rewrite
git merge main
git push origin svelte-rewrite
```

---

## Weekly Sync Ritual (Every Monday)

```bash
# Sync all long-lived branches to prevent conflicts

git checkout staging
git pull origin staging
git merge main
git push origin staging

git checkout develop
git pull origin develop
git merge staging
git push origin develop

git checkout svelte-rewrite
git pull origin svelte-rewrite
git merge main  # CRITICAL: keeps rewrite up-to-date
git push origin svelte-rewrite

git checkout develop  # Return to develop
```

**Why**: Prevents mega-merge conflicts after 6 months. Set a calendar reminder!

---

## Merge Strategies

| Source → Target | Strategy | Button in GitHub UI |
|----------------|----------|---------------------|
| `feature/*` → `develop` | **Squash** | "Squash and merge" |
| `bugfix/*` → `develop` | **Squash** | "Squash and merge" |
| `rewrite/*` → `svelte-rewrite` | **Squash** | "Squash and merge" |
| `develop` → `staging` | **Merge Commit** | "Create a merge commit" |
| `staging` → `main` | **Merge Commit** | "Create a merge commit" |
| `svelte-rewrite` → `staging` | **Merge Commit** | "Create a merge commit" |
| `hotfix/*` → `main` | **Squash** | "Squash and merge" |

---

## Branch Naming

```
✅ Good:
feature/WINE-42-add-price-scale
bugfix/WINE-93-closemodal-error
rewrite/wine-list-page
hotfix/avgrating-overflow

❌ Bad:
my-feature
fix
test-branch
temp
```

**Rules:**
- Use prefix: `feature/`, `bugfix/`, `rewrite/`, `hotfix/`
- Include JIRA ticket: `WINE-XX`
- Use kebab-case
- Be descriptive (max 50 chars)

---

## PR Title Format

```
✅ Good:
WINE-42: Add price scale to wine cards
WINE-88: Implement purchase date picker
Rewrite: Create Svelte component library
Hotfix: Fix avgRating overflow on 10/10 rating
Release: Sprint 3 Features

❌ Bad:
Updates
Fix stuff
WIP
Testing
```

---

## Git Commands Cheatsheet

### Update feature branch with latest develop

```bash
git checkout feature/WINE-42
git fetch origin
git rebase origin/develop
git push --force-with-lease origin feature/WINE-42
```

**OR** (safer for shared branches):

```bash
git checkout feature/WINE-42
git pull origin develop
git push origin feature/WINE-42
```

---

### Delete merged branch

```bash
# Delete locally
git branch -d feature/WINE-42

# Delete remotely (usually auto-deleted by GitHub)
git push origin --delete feature/WINE-42
```

---

### Undo last commit (not yet pushed)

```bash
git reset --soft HEAD~1
# Changes remain staged, ready to re-commit
```

---

### Undo last commit (already pushed)

```bash
# DON'T force push to shared branches!
# Instead, create a new commit that reverts:
git revert HEAD
git push origin branch-name
```

---

### Stash changes temporarily

```bash
# Save work in progress
git stash

# Switch branches, do other work...

# Restore stashed changes
git stash pop
```

---

### View commit history

```bash
# Full history
git log --oneline --graph --all

# Last 10 commits on current branch
git log --oneline -10

# Commits not yet merged to main
git log main..develop --oneline
```

---

### Check what changed

```bash
# Unstaged changes
git diff

# Staged changes
git diff --cached

# Changes between branches
git diff develop..feature/WINE-42

# Files changed in last commit
git show --name-only
```

---

## GitHub Settings Quick Access

### Branch Protection Rules
`Settings → Branches → Branch protection rules`

### Merge Button Settings
`Settings → General → Pull Requests`

### Default Branch
`Settings → General → Default branch`

---

## Protection Rules Summary

| Branch | Require PR | Approvals | Admin Bypass | Force Push |
|--------|-----------|-----------|--------------|------------|
| `main` | ✅ | 1 | ✅ (rare) | ❌ |
| `staging` | ✅ | 1 | ✅ | ❌ |
| `develop` | ✅ | 0 | ✅ | ❌ |
| `svelte-rewrite` | ✅ | 1 | ✅ | ❌ |

---

## Admin Bypass Policy

### ✅ ALLOWED
- Critical production hotfix (security, data loss, outage)
- Time-sensitive release (user-facing bug causing support tickets)
- Process blocker (GitHub temporarily down)

### ❌ FORBIDDEN
- Normal feature development
- "I'm in a hurry" (not an emergency)
- "It's a small change" (still needs review)
- "I'll review it later" (review first, merge second)

**Rule of Thumb**: If you have time to think about bypassing, you have time for a PR.

---

## Testing Checklist

### Before Opening PR
- [ ] Code follows existing patterns
- [ ] Tests pass (regression suite from CLAUDE.md)
- [ ] No console errors
- [ ] Mobile tested (if UI change)
- [ ] Documentation updated (if needed)

### Before Merging to Staging
- [ ] All PRs to develop merged and tested
- [ ] Feature-specific tests pass
- [ ] No known bugs

### Before Merging to Main
- [ ] Complete QA suite on staging
- [ ] Performance check (Lighthouse)
- [ ] Mobile testing (iOS + Android)
- [ ] Release notes prepared
- [ ] Rollback plan ready

---

## Troubleshooting

### "Your branch is behind origin/develop"

```bash
git checkout feature/WINE-42
git pull origin develop
git push origin feature/WINE-42
```

---

### "Merge conflict in file.js"

```bash
# 1. Fetch latest changes
git fetch origin

# 2. Try to merge develop
git merge origin/develop

# 3. Git will mark conflicts in files:
#    <<<<<<< HEAD
#    your changes
#    =======
#    their changes
#    >>>>>>> origin/develop

# 4. Edit files to resolve conflicts

# 5. Stage resolved files
git add file.js

# 6. Complete the merge
git commit

# 7. Push
git push origin feature/WINE-42
```

---

### "Cannot push to protected branch"

This is **correct behavior**! Protected branches require PRs.

**Solution**: Open a PR on GitHub instead of pushing directly.

---

### "Need to update stale PR after new commits to base branch"

**Option 1: Merge** (preserves history)
```bash
git checkout feature/WINE-42
git pull origin develop
git push origin feature/WINE-42
```

**Option 2: Rebase** (cleaner history, but rewrites commits)
```bash
git checkout feature/WINE-42
git fetch origin
git rebase origin/develop
git push --force-with-lease origin feature/WINE-42
```

---

### "Accidentally committed to develop instead of feature branch"

```bash
# 1. Create branch with current changes
git checkout -b feature/WINE-42-fix

# 2. Push the new branch
git push -u origin feature/WINE-42-fix

# 3. Reset develop to match origin
git checkout develop
git reset --hard origin/develop

# 4. Open PR: feature/WINE-42-fix → develop
```

---

## Useful GitHub CLI Commands

### View open PRs

```bash
gh pr list
```

---

### Create PR from command line

```bash
gh pr create --title "WINE-42: Add feature X" --body "Description"
```

---

### Check PR status

```bash
gh pr status
```

---

### Merge PR from command line

```bash
gh pr merge 42 --squash
```

---

## Further Reading

- **Complete Setup Guide**: [GITHUB_SETUP_PLAN.md](GITHUB_SETUP_PLAN.md)
- **Contributing Guide**: [CONTRIBUTING.md](../../CONTRIBUTING.md)
- **Main Dev Guide**: [CLAUDE.md](../../CLAUDE.md)

---

*Keep this handy for quick reference during development!*

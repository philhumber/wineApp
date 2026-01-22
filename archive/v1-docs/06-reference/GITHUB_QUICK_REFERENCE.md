# GitHub Quick Reference

**Last Updated**: 2026-01-18

---

## Core Concepts

| Action | Direction | What It Does |
|--------|-----------|--------------|
| **Pull** | GitHub → Your computer | Download others' changes |
| **Push** | Your computer → GitHub | Upload your changes |
| **Commit** | Local only | Save a snapshot of your work |

**Key insight**: GitHub only sees what you've pushed. Local commits and changes are invisible to GitHub until you push.

---

## Branch Hierarchy

```
main → develop → feature/WINE-*
           └─→ bugfix/WINE-*

main → svelte-rewrite → rewrite/*
```

**Production deployment**: Files are manually deployed to the webserver when ready.

---

## Daily Workflow

### 1. Start New Work

```bash
git checkout develop
git pull origin develop                    # Get latest changes
git checkout -b feature/WIN-42-description # Create your branch
```

### 2. Save Your Work (Commit)

```bash
git add .                                  # Stage all changes
git commit -m "WIN-42: Short description"  # Commit locally
```

**Then**: Open PR on GitHub: `rewrite/component-name → svelte-rewrite` (squash merge)

---

### Release to Main (After Features Merged)

```bash
git commit -m "WIN-42: Title" -m "Detailed explanation of what changed and why"
```

**On GitHub**: Open PR `develop → main` (merge commit, requires 1 approval)

**Production deployment**: Manually copy files to webserver when ready.

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
git pull origin develop    # Merge develop into your branch
git push                   # Push the updated branch
```

---

## Weekly Sync (Every Monday)

Prevents mega-merge conflicts. Set a calendar reminder.

```bash
# Sync all long-lived branches to prevent conflicts

git checkout develop
git pull origin develop
git merge main
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
| `develop` → `main` | **Merge Commit** | "Create a merge commit" |
| `svelte-rewrite` → `main` | **Merge Commit** | "Create a merge commit" |
| `hotfix/*` → `main` | **Squash** | "Squash and merge" |

---

## Branch Naming

```
✅ Good:
feature/WIN-42-add-price-scale
bugfix/WIN-93-modal-error
hotfix/critical-bug

❌ Bad:
my-feature
fix
test-branch
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

### Before Merging to Main
- [ ] All PRs to develop merged and tested
- [ ] Feature-specific tests pass
- [ ] No known bugs
- [ ] Complete QA suite run
- [ ] Performance check (Lighthouse)
- [ ] Mobile testing (iOS + Android)

### Before Deploying to Production
- [ ] All tests pass on main
- [ ] Release notes prepared
- [ ] Rollback plan ready

---

## Troubleshooting

### "Your branch is behind origin/develop"

```bash
git pull origin develop
git push
```

### "Merge conflict in file.js"

```bash
git pull origin develop              # Git will mark conflicts
# Edit files to resolve (look for <<<< ==== >>>> markers)
git add .                            # Stage resolved files
git commit                           # Complete the merge
git push
```

### "Cannot push to protected branch"

Correct behavior. Open a PR on GitHub instead.

### PR shows "no differences"

You forgot to push. Run:
```bash
git add .
git commit -m "WIN-XX: Description"
git push
```

### Undo last commit (not yet pushed)

```bash
git reset --soft HEAD~1              # Changes stay staged
```

### Stash work temporarily

```bash
git stash                            # Save work in progress
# Do other stuff...
git stash pop                        # Restore stashed changes
```

---

## Quick Commands

```bash
git status                           # See what's changed
git log --oneline -10                # Last 10 commits
git diff                             # See unstaged changes
git branch                           # List local branches
```

---

## Further Reading

- [CONTRIBUTING.md](../../CONTRIBUTING.md) - Full contributing guide
- [CLAUDE.md](../../CLAUDE.md) - Main dev guide

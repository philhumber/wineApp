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
main (production) → staging (QA) → develop (daily work)
                                        └→ feature/WIN-*
                                        └→ bugfix/WIN-*
```

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

**Adding a longer description:**
```bash
git commit -m "WIN-42: Title" -m "Detailed explanation of what changed and why"
```

### 3. Upload to GitHub (Push)

```bash
git push -u origin feature/WIN-42-description
```

The `-u` flag links your local branch to GitHub. Only needed on first push.

### 4. Open Pull Request

Go to GitHub → Your repo → "Compare & pull request" button

**PR Title format**: `WIN-42: Add feature X`

---

## Keeping Your Branch Updated

If `develop` has new commits while you're working:

```bash
git pull origin develop    # Merge develop into your branch
git push                   # Push the updated branch
```

---

## Weekly Sync (Every Monday)

Prevents mega-merge conflicts. Set a calendar reminder.

```bash
git checkout staging && git pull && git merge main && git push
git checkout develop && git pull && git merge staging && git push
git checkout svelte-rewrite && git pull && git merge main && git push
git checkout develop       # Return to develop
```

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

## Merge Strategies

| PR Direction | Strategy | GitHub Button |
|-------------|----------|---------------|
| `feature/*` → `develop` | Squash | "Squash and merge" |
| `develop` → `staging` | Merge | "Create a merge commit" |
| `staging` → `main` | Merge | "Create a merge commit" |

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

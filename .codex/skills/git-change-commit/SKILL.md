---
name: git-change-commit
description: Summarize current git changes in the active repository, propose a clear commit message, confirm the intended commit scope, and create the commit safely. Use when Codex needs to inspect modified, staged, or untracked files, explain what changed, draft a commit title/body, or run git add and git commit for the current project.
---

# Git Change Commit

## Overview

Summarize the current repository changes and turn them into a safe, reviewable git commit.
Start with the helper script for a compact change snapshot, then inspect focused diffs before writing the final commit message.

## Workflow

1. Capture the current scope.
2. Inspect the meaningful diffs.
3. Draft a precise commit title and optional body.
4. Confirm scope and commit safely.
5. Report the resulting commit and any remaining changes.

### 1. Capture the current scope

- Run `python3 .codex/skills/git-change-commit/scripts/git_change_context.py` from the repository root to collect branch, staged files, unstaged files, untracked files, and diff stats.
- If both staged and unstaged changes exist and the user did not specify scope, ask whether to commit staged changes only or all current changes.
- Do not change the index implicitly when the scope is ambiguous.

### 2. Inspect the meaningful diffs

- Use the helper script output to identify the small set of files that explain the change.
- Read focused diffs with `git diff -- <file>` or `git diff --cached -- <file>` instead of dumping the full diff when the change set is large.
- Call out generated artifacts separately from source changes.
- Mention deleted, renamed, or newly tracked files explicitly when they materially affect the summary.

### 3. Draft the commit message

- Write the title in imperative mood.
- Keep the title concise and specific; prefer 72 characters or fewer when practical.
- Add a body only when it improves clarity, such as when the commit spans multiple areas, includes generated outputs, or needs rationale.
- Prefer bodies that explain why, user-visible impact, or notable side effects over line-by-line implementation details.

### 4. Commit safely

- Show the proposed commit title/body before running `git commit` unless the user explicitly asked for an immediate commit.
- If the user wants all current changes and nothing is staged yet, stage with `git add -A`.
- If the user wants staged changes only, preserve the existing index and commit without restaging.
- Use `git commit -m "<title>"` and additional `-m` flags for body paragraphs when needed.
- Avoid `git commit --amend`, `git reset`, rebase, or forceful history edits unless the user explicitly asked for them.

### 5. Report the result

- After committing, capture the new commit with `git show --stat --oneline --no-patch HEAD`.
- Check the remaining working tree with `git status --short`.
- Report the commit hash, final commit title, and whether uncommitted changes remain.

## Heuristics

- Separate source edits from generated files in both the summary and the commit body.
- Call out untracked files that might be accidental before staging them.
- Prefer mentioning the affected feature, system, or user-facing behavior over low-level refactoring noise.
- If the diff includes asset build outputs, say so explicitly.
- If the repository is already partially staged, preserve that intent unless the user asks to regroup changes.
- When summarizing changes for the user, prefer `-` bullet items over `*` bullets unless the user explicitly requests a different format.

## Resource

### scripts/

- `git_change_context.py`: Print a compact snapshot of staged, unstaged, and untracked changes plus diff stats for quick triage before writing the commit message.

---
name: git-change-commit
description: Summarize current git changes in the active repository, propose a clear commit message, confirm the intended commit scope, and create the commit safely. Use when Codex needs to inspect modified, staged, or untracked files, explain what changed, draft a commit title/body, or run git add and git commit for the current project.
---

# Git Change Commit

## Overview

Summarize the current repository changes and turn them into a safe, reviewable git commit.
Start with the helper script for a compact change snapshot, then inspect focused diffs before writing the final commit message.

## Output and language

- Write user-facing summaries, scope confirmations, and final reports in natural Korean by default unless the user explicitly asks for another language.
- Present change summaries and final result summaries as short `-` bullet lists unless the user explicitly requests another format.
- Avoid stiff literal translations; prefer concise, idiomatic Korean such as "조정했습니다", "추가했습니다", or "정리했습니다" when summarizing changes.
- When proposing a commit message, follow the repository's recent language/style convention when it is clear; otherwise prefer Korean if the user asked for Korean output.
- For Korean commit messages, prefer concise noun-like endings such as "수정", "정리", or "추가".
- If a slightly fuller style is needed, endings such as "수정하였음" or "추가하였음" are also acceptable.
- Keep the commit message itself concise even when the surrounding explanation is in Korean.
- Unless the change is truly tiny and self-evident, prefer a commit **body** in addition to the title.
- Commit bodies should usually be more specific than the user-facing summary and capture the main changed areas, behavior changes, or rationale.
- When the change adjusts existing values, thresholds, sizes, timing, or logic, prefer stating the previous state and the new state in the commit body when that before/after can be determined from the diff.

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
- Inspect enough of the diff to write a concrete commit body; do not stop at filenames and diffstat when the actual behavior change is still vague.
- For tuning or adjustment changes, inspect enough of the diff to identify the previous value, threshold, layout, timing, or logic so the commit body can describe the before/after change concretely.

### 3. Draft the commit message

- Write the title in the repository's preferred style.
- If writing the commit message in Korean and no stronger repository convention applies, end the subject with forms like "추가", "수정", or "정리" rather than "추가했다" or "정리한다".
- Keep the title concise and specific; prefer 72 characters or fewer when practical.
- Prefer adding a body by default whenever the commit touches multiple files, changes behavior, renames/replaces modules, or would be hard to understand from the title alone.
- For non-trivial commits, write a body with 2-4 short bullet-like lines or short sentences that cover:
  - what areas were changed,
  - what behavior or flow changed,
  - and, when useful, why the change was needed.
- When the change is an adjustment or modification of existing behavior, include the previous value or logic and the new value or logic in the body when that contrast is clear from the diff.
- Put before/after details in the body rather than overloading the title with implementation specifics.
- Prefer bodies that explain grouped implementation details, user-visible impact, or notable side effects over vague one-line summaries.
- Avoid empty or generic bodies such as "코드 정리" alone when the diff contains concrete behavior changes.
- If the commit is truly tiny and localized, a title-only commit is acceptable.

### 4. Commit safely

- Show the proposed commit title/body before running `git commit` unless the user explicitly asked for an immediate commit.
- If the user wants all current changes and nothing is staged yet, stage with `git add -A`.
- If the user wants staged changes only, preserve the existing index and commit without restaging.
- Use `git commit -m "<title>"` and additional `-m` flags for body paragraphs when needed.
- Avoid `git commit --amend`, `git reset`, rebase, or forceful history edits unless the user explicitly asked for them.
- When a body is warranted, do not omit it for convenience; pass it with additional `-m` flags.

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
- When summarizing changes for the user, use one idea per `-` bullet and keep each item short enough to scan quickly.
- If recent commit history mixes Korean and English, prefer Korean when the user asked for Korean output, but avoid forcing a style change when the repository clearly follows another convention.
- For Korean commit titles, avoid endings that read like present-tense descriptions such as "정리한다" or plain past-tense narrative such as "추가했다" unless the repository clearly standardizes on that style.
- Good default for commit bodies: mention 2-3 concrete subchanges rather than repeating the title in another wording.
- If the change tunes an existing number or rewires an existing flow, mention the old value or old logic and the new value or new logic in the body when the diff makes that clear.
- If a commit replaces one module with another, mention the replacement explicitly in the body.
- If a commit changes timing, persistence, initialization, or recovery behavior, mention that behavior explicitly in the body because it is hard to infer from filenames alone.

## Resource

### scripts/

- `git_change_context.py`: Print a compact snapshot of staged, unstaged, and untracked changes plus diff stats for quick triage before writing the commit message.

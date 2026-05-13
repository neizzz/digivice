---
name: digivice-release-packaging
description: Package a Digivice app release in this repository. Use when the user asks to bump `versions/app.json` patch/build/minor/major version, sync `virtual_bridge/pubspec.yaml`, write `versions/release-notes/v<version>+<build>.md`, make a scoped release commit, and create an annotated `v<version>+<build>` tag. Trigger phrases include "versions/app.json 패치", "build number 올려", "릴리즈 노트", "커밋 + 태그", or "릴리즈 패키징" in `/Users/neiz/digivice`.
---

# Digivice Release Packaging

## Overview

Perform the narrow Digivice release-packaging flow: version bump, Flutter pubspec sync, release note creation, scoped commit, and annotated tag. Keep unrelated generated assets, diagnostics, and dirty-tree changes out of the release commit unless the user explicitly asks to include them.

## Workflow

### 1. Confirm repository and dirty tree

Start from the repo root:

```bash
git status --short --branch
python3 .codex/skills/git-change-commit/scripts/git_change_context.py
```

Scope rule:

- If the user only asks for release packaging, stage only:
  - `versions/app.json`
  - `virtual_bridge/pubspec.yaml`
  - `versions/release-notes/v<version>+<build>.md`
- Leave existing `virtual_bridge/assets/...`, `tmp/`, diagnostics JSON, and other unrelated changes untouched.
- If unrelated changes are already staged, do not overwrite the index; ask before regrouping.

### 2. Inspect current version and previous tag

```bash
cat versions/app.json
grep -n '^version:' virtual_bridge/pubspec.yaml
git tag --sort=-creatordate | head -10
git log --oneline --decorate -12
```

Derive the previous release tag from the old `versions/app.json` values, e.g. `v0.5.1+10`.

### 3. Bump version

Use the repo script instead of editing by hand:

```bash
node ./scripts/bump-app-version.mjs patch
```

Command selection:

- Default to `patch` when the user says `패치`, `path dump`/`patch bump`, or simply asks for the usual app release bump.
- Use `build` when the user asks to keep the app version and only increment build number.
- Use `minor`, `major`, or `set-version <x.y.z>` only when explicitly requested.

The script must update both `versions/app.json` and `virtual_bridge/pubspec.yaml`.

### 4. Draft release notes

Create:

```text
versions/release-notes/v<newVersion>+<newBuild>.md
```

Use this structure:

```markdown
# Release Notes

## v<newVersion>+<newBuild> - YYYY-MM-DD

### 주요 변경
- <user-facing summary grouped by flow>

### 포함 커밋
- <commit subject from previous tag..HEAD>
```

Build the note from:

```bash
git log --oneline <previousTag>..HEAD
```

Guidelines:

- Summarize by user-visible flow rather than only file names.
- Include all commit subjects under `포함 커밋` in chronological or readable order.
- If `HEAD` already includes a release-note commit for the same target, avoid duplicating it.
- If the previous tag is missing, use recent history and state the fallback in the final report.

### 5. Validate and stage only release files

```bash
git diff -- versions/app.json virtual_bridge/pubspec.yaml versions/release-notes/v<newVersion>+<newBuild>.md
git diff --check -- versions/app.json virtual_bridge/pubspec.yaml versions/release-notes/v<newVersion>+<newBuild>.md
git add versions/app.json virtual_bridge/pubspec.yaml versions/release-notes/v<newVersion>+<newBuild>.md
git diff --cached --stat
git diff --cached --name-only
```

Check that the cached file list contains only the three release files. If it contains anything else, stop and fix the staging scope before committing.

### 6. Commit

Use this style:

```bash
git commit -m "chore: v<newVersion>+<newBuild> 릴리즈 노트 추가" \
  -m "versions/app.json을 <oldVersion>+<oldBuild>에서 <newVersion>+<newBuild>로 올리고 Flutter pubspec 버전을 동기화했습니다." \
  -m "<previousTag> 이후 변경 내역을 기준으로 v<newVersion>+<newBuild> 릴리즈 노트를 추가했습니다."
```

After committing:

```bash
git show --stat --oneline --no-patch HEAD
git status --short
```

### 7. Create annotated tag

Before creating the tag, ensure it does not already exist:

```bash
git tag --list 'v<newVersion>+<newBuild>'
```

If empty, create it on the release commit:

```bash
git tag -a v<newVersion>+<newBuild> -m "v<newVersion>+<newBuild>"
git show --stat --oneline --no-patch v<newVersion>+<newBuild>
git status --short --branch
```

Do not push unless the user explicitly asks.

## Final report

Report concisely in Korean:

- version transition, release note path, commit hash/title, tag name
- whether the branch is ahead of origin
- remaining uncommitted changes, especially excluded generated assets or `tmp/`
- changed file list with ANSI line counts in this format: `\u001b[32m+N\u001b[0m / \u001b[31m-M\u001b[0m`

Get line counts with:

```bash
git show --numstat --format='' HEAD
```

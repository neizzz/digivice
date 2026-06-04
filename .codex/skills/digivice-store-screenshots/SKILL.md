---
name: digivice-store-screenshots
description: Play Store screenshot workflow for the Digivice repo. Use when the request mentions `play store`, `store screenshot`, `screenshot snapshot`, or `locale screenshot`, and you want the repo-local capture script, fixture rules, locale output structure, and validation steps for marketing submission images.
---

# Digivice Store Screenshots

## Purpose

Use this repo-local skill for **Google Play 제출용** 스크린샷 산출만 다룬다.

- `snapshot:i18n`: UI/번역 QA용 정적 화면 캡처
- `snapshot:store`: 마케팅 제출용 locale별 1080x2340 스크린샷 캡처

Keep the work narrow: fixture, runtime hook, capture script, and output verification only.

## Trigger phrases

- `play store`
- `store screenshot`
- `screenshot snapshot`
- `locale screenshot`

## First-pass search scope

Always start with `semble search` and stay inside this scope first.

- `apps/client/scripts/capture-store-snapshots.mjs`
- `apps/client/scripts/store-snapshot-fixtures/`
- `apps/client/src/SnapshotScreen.tsx`
- `apps/client/src/GameContainer.tsx`
- `apps/client/src/layers/MonsterInfoLayer.tsx`
- `apps/game/src/scenes/MonsterBookScene/index.ts`
- `apps/client/package.json`

Expand only when a shot cannot be explained from those files.

## Default commands

```bash
pnpm --filter @digivice/client snapshot:store -- --locales ko,en,ja
pnpm --filter @digivice/client snapshot:store -- --locales ko,en,ja --shots main-scene-day,monster-info,monster-book
pnpm --filter @digivice/client snapshot:store:current -- --url http://127.0.0.1:5173 --locales ko,en,ja
```

## Output contract

- viewport preset: `android-19_5-9`
- CSS viewport: `360x780`
- device scale factor: `3`
- expected PNG output: `1080x2340`
- output root: `tmp/store-snapshots/<timestamp>/<locale>/<shot>.png`

Every locale folder should contain the same shot names.

## Fixture rules

Fixture files live in:

- `apps/client/scripts/store-snapshot-fixtures/*.json`

Use shot-specific JSON with this intent:

- `storage`: localStorage keys to inject before app boot
- `scene`: runtime target scene (`main`, `flappy_bird_game`, `monster_book`)
- `timeOfDay`: `day` or `night` when a main-scene shot must be forced
- `overlay`: use `monster-info` when the popup must auto-open

Prefer editing the smallest fixture that owns the visual state.
Do not move this logic into broad app runtime if a fixture can express it.

## Shot ownership

- `setup`, `settings-menu`, `settings-reset`: `SnapshotScreen` path
- `main-scene-day`, `main-scene-night`, `monster-info`: seeded main scene + runtime snapshot hook
- `flappy-bird`: seeded main scene, then real scene transition to Flappy Bird
- `monster-book`: seeded storage, then real scene transition to Monster Book

## Adding a new shot

1. Add the shot to `SHOT_CONFIG` in `capture-store-snapshots.mjs`
2. Add a fixture JSON if runtime state is needed
3. Reuse existing query-driven hook in `GameContainer.tsx` before adding new runtime-only code
4. Add the shot name to the default shot list only after it is stable across locales
5. Verify one-locale subset first, then the full locale set

## Validation order

1. Focused subset first
   - `pnpm --filter @digivice/client snapshot:store -- --locales ko --shots main-scene-day,monster-info,monster-book`
2. Build validation
   - `pnpm --filter @digivice/client build:development`
3. Existing i18n snapshot regression
   - `pnpm --filter @digivice/client snapshot:i18n -- --locales ko --screens setup,settings,settings-reset`
4. Diff hygiene
   - `git diff --check -- apps/client apps/game .codex/skills/digivice-store-screenshots`

## Default rules

- Start with `semble search`.
- Keep locale output names identical across locales.
- Prefer fixture edits over ad-hoc waits or DOM hacks.
- `monster-info` and `monster-book` must stay on real runtime paths, not mock screens.
- When a capture is flaky, first inspect bridge readiness in `GameContainer.tsx`, then adjust fixture or settle time.

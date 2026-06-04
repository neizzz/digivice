# Repository Guidelines

## Project Structure & Module Organization
`digivice` is a pnpm workspace for a webview-based mobile Tamagotchi app.
- `apps/client/`: React + Vite UI shell rendered inside the mobile webview. Main code lives in `src/`; capture utilities live in `scripts/`.
- `apps/game/`: core game logic, assets, and Node-based tests. Use `src/` for gameplay code and `assets/` for sprites, sounds, and data copied into the client.
- `shared/i18n`, `shared/storage`: shared TypeScript packages used across workspaces.
- `virtual_bridge/`: Flutter host app with native Android/iOS integration, JS channels, and widget code. Dart code is in `lib/`, Flutter tests in `test/`.
- `versions/app.json`: source of truth for app versioning; syncs into `virtual_bridge/pubspec.yaml`.

## Build, Test, and Development Commands
- `pnpm install`: install workspace dependencies.
- `pnpm dev`: start the client Vite app with game assets synced.
- `pnpm build`: build the web client from the repo root.
- `pnpm --filter @digivice/game test`: run the game test suite via Node test runner.
- `pnpm --filter @digivice/client lint`: run the client ESLint checks.
- `pnpm --filter @digivice/client snapshot:i18n` / `snapshot:store`: capture localized or Play Store screenshots.
- `pnpm --filter @digivice/client build:flutter:development`: build the web bundle and copy it into Flutter assets.
- `cd virtual_bridge && flutter test`: run Flutter-side tests.

## Coding Style & Naming Conventions
TypeScript formatting is governed by `biome.json`: tabs, 80-column target, and double quotes. Prefer explicit types and avoid `any`. Use `PascalCase` for React components/classes, `camelCase` for functions/variables, and keep test files near the feature when practical. Let Biome organize imports; use ESLint for client-specific issues.

## Testing Guidelines
Use `*.test.ts` for TypeScript tests and `*_test.dart` for Flutter tests. Add or update focused tests whenever game logic, storage bootstrapping, widget sync, or native bridge behavior changes. For asset- or widget-related changes, include the relevant screenshot or snapshot command output in your validation notes.

## Commit & Pull Request Guidelines
Follow the existing Conventional Commit style seen in history: `fix: ...`, `feat: ...`, `chore: ...`. Keep each commit scoped to one concern. PRs should include a short summary, linked issue/ticket when available, test commands run, and screenshots for UI, widget, or store-snapshot changes. Do not hand-edit generated web assets in `virtual_bridge/assets/web/`; rebuild them from the source workspaces instead.

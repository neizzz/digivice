---
name: digivice-home-widget
description: Narrow home widget workflow for the Digivice repo. Use when the request mentions `widget`, `home widget`, `1x1 widget`, `widget snapshot`, `widget debug`, `widget preview`, or `widget sync`, and you want a fixed first-pass search scope, expansion rules, response format, and validation routine without reloading the whole repository context.
---

# Digivice Home Widget

## Purpose

Use this repo-local skill to keep Digivice widget work narrow and repeatable.
Start from the native widget surface first, expand only when needed, and answer in a short scope-first format.

## Trigger phrases

- `widget`
- `home widget`
- `1x1 widget`
- `widget snapshot`
- `widget debug`
- `widget preview`
- `widget sync`

## Request template

```txt
[widget/<area>]
목표: ...
범위: 수정 허용 = ...
비범위: 건드리지 말 것 = ...
검증: ...
```

Use `<area>` such as `native-debug-controls`, `snapshot-selection`, `layout-1x1`, `layout-2x1`, `flutter-sync-bridge`, `preview-rendering`, or `sprite-rendering`.

## First-pass search scope

Always start with `semble search` and stay inside this first-pass scope unless it fails to explain the issue.

### Kotlin

- `virtual_bridge/android/app/src/main/kotlin/com/ch00n9h09/montto/HomeWidgetConstants.kt`
- `virtual_bridge/android/app/src/main/kotlin/com/ch00n9h09/montto/HomeWidgetProvider.kt`
- `virtual_bridge/android/app/src/main/kotlin/com/ch00n9h09/montto/HomeWidgetDebugPresets.kt`
- `virtual_bridge/android/app/src/main/kotlin/com/ch00n9h09/montto/HomeWidgetSnapshot.kt`
- `virtual_bridge/android/app/src/main/kotlin/com/ch00n9h09/montto/HomeWidgetSnapshotFactory.kt`
- `virtual_bridge/android/app/src/main/kotlin/com/ch00n9h09/montto/MainActivity.kt`

### Layout / XML

- `virtual_bridge/android/app/src/main/res/layout/montto_home_widget.xml`
- `virtual_bridge/android/app/src/main/res/layout/montto_home_widget_1x1.xml`
- `virtual_bridge/android/app/src/main/res/layout/montto_home_widget_preview.xml`
- `virtual_bridge/android/app/src/main/res/layout/montto_home_widget_1x1_preview.xml`
- `virtual_bridge/android/app/src/main/res/xml/montto_home_widget_info.xml`
- `virtual_bridge/android/app/src/main/res/xml/montto_home_widget_1x1_info.xml`

### Test

- `virtual_bridge/android/app/src/test/java/com/ch00n9h09/montto/HomeWidget*Test.kt`

### Expansion rule

Expand to Flutter/web only when one of these is true:

- the user explicitly asks for bridge or sync behavior,
- the native first pass cannot explain the bug,
- the issue is clearly about snapshot production rather than widget rendering.

Then inspect:

- `virtual_bridge/lib/home_widget/...`
- `virtual_bridge/assets/web/...`

Treat `virtual_bridge/assets/web/...` as generated output by default, not source of truth.

## Task classification

### `native-debug-controls`

Look here first:

1. `HomeWidgetConstants.kt`
2. `HomeWidgetProvider.kt`
3. `HomeWidgetDebugPresets.kt`
4. `HomeWidgetProviderTest.kt`

Use for preset next/prev/live actions, native override toggles, widget refresh broadcasts, and launcher debug controls.

### `snapshot-selection`

Look here first:

1. `HomeWidgetDebugPresets.kt`
2. `HomeWidgetSnapshot.kt`
3. `HomeWidgetSnapshotFactory.kt`
4. `HomeWidgetDebugPresetsTest.kt`

Use for authoritative-vs-current snapshot choice, fallback rules, stale snapshot recovery, and debug override precedence.

### `layout-1x1`

Look here first:

1. `HomeWidgetProvider.kt`
2. `montto_home_widget_1x1.xml`
3. `montto_home_widget_1x1_preview.xml`
4. `montto_home_widget_1x1_info.xml`

Use for 1x1 overlap, spacing, status icon rows, stamina dot placement, and size-specific resource binding.

### `layout-2x1`

Look here first:

1. `HomeWidgetProvider.kt`
2. `montto_home_widget.xml`
3. `montto_home_widget_preview.xml`
4. `montto_home_widget_info.xml`

Use for default home widget layout, 2x1 preview mismatch, title/meta crowding, and provider-to-layout binding.

### `flutter-sync-bridge`

Look here first:

1. `MainActivity.kt`
2. `virtual_bridge/lib/home_widget/home_widget_refresh_controller.dart`
3. `virtual_bridge/lib/home_widget/home_widget_sync_service.dart`
4. `HomeWidgetConstants.kt`

Use for request-pin flows, method channel payloads, refresh completion, and native/Flutter storage key alignment.

### `preview-rendering`

Look here first:

1. `MainActivity.kt`
2. `HomeWidgetProvider.kt`
3. `montto_home_widget_preview.xml`
4. `montto_home_widget_1x1_preview.xml`

Use for launcher preview differences, preview extras, `setWidgetPreview`, and preview-only layout regressions.

### `sprite-rendering`

Look here first:

1. `virtual_bridge/android/app/src/main/kotlin/com/ch00n9h09/montto/HomeWidgetSpriteRenderer.kt`
2. `HomeWidgetSnapshot.kt`
3. `HomeWidgetDebugPresets.kt`
4. `HomeWidgetProvider.kt`

Use for bitmap frame selection, background variant selection, pixel rendering, and sprite mismatch between snapshot state and rendered result.

## Token-saving workflow

1. Always begin with `semble search` using the narrowest task words possible.
2. If the returned chunk already identifies the owner logic, do not reopen the whole file.
3. Ignore unrelated Flutter pages, general app UI, generated web assets, and repo-wide dirty-tree noise by default.
4. Expand from native widget files to Flutter/web only after the expansion rule above is met.
5. Keep the answer short when the user request is narrow.

Preferred response shape:

- `범위`: 이번에 본 surface / 수정한 surface
- `영향`: 어떤 widget path에만 영향 있는지
- `검증`: 실행한 test / diff check / why skipped

## Validation routine

Default validation order:

1. Kotlin unit test first
2. Then focused diff or syntax check
3. Only then broader native/Flutter verification if still needed

Useful examples:

```bash
./gradlew app:testDebugUnitTest --tests com.ch00n9h09.montto.HomeWidgetDebugPresetsTest
./gradlew app:testDebugUnitTest --tests com.ch00n9h09.montto.HomeWidgetProviderTest
git diff --check -- virtual_bridge/android/app/src/main
```

If Gradle needs Android Studio JBR, use:

```bash
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew app:testDebugUnitTest --tests com.ch00n9h09.montto.HomeWidgetProviderTest
```

For preview or layout issues:

1. confirm XML ownership,
2. confirm provider binding,
3. confirm preview-specific path in `MainActivity.kt`,
4. only then expand to Flutter/native bridge or generated assets.

## Default rules

- Native widget changes start with **Kotlin + XML + test**.
- `MainActivity.kt` and Flutter bridge code are second-pass surfaces unless the request is explicitly about sync or request-pin flows.
- `virtual_bridge/assets/web` is not the default source of truth.
- Do not restate the whole repo context in the answer when this skill already fixes the start points, expansion rules, and validation routine.

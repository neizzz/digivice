#!/bin/bash
set -euo pipefail

PATCH_REVISION="android15-window-colors-v1"

usage() {
  cat <<'USAGE'
Usage: patch-flutter-embedding-android15.sh [options]

Options:
  --flutter-sdk <path>  Flutter SDK root. Defaults to virtual_bridge/android/local.properties.
  --android-dir <path>  Android host directory. Defaults to virtual_bridge/android.
  --output-dir <path>   Local Maven repo output directory. Defaults to <android-dir>/.patched-flutter-m2.
USAGE
}

fail() {
  echo "[flutter-android15-patch] $*" >&2
  exit 1
}

resolve_java_tool() {
  local tool_name="$1"
  shift

  if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/$tool_name" ]]; then
    printf '%s\n' "$JAVA_HOME/bin/$tool_name"
    return 0
  fi

  local candidate
  for candidate in "$@"; do
    if [[ -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  candidate="$(command -v "$tool_name" 2>/dev/null || true)"
  if [[ -n "$candidate" ]]; then
    printf '%s\n' "$candidate"
    return 0
  fi

  fail "Unable to find $tool_name. Set JAVA_HOME or install a JDK."
}

write_pom() {
  local artifact_id="$1"
  local pom_path="$2"

  cat > "$pom_path" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<project xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd" xmlns="http://maven.apache.org/POM/4.0.0"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <modelVersion>4.0.0</modelVersion>
  <groupId>io.flutter</groupId>
  <artifactId>${artifact_id}</artifactId>
  <version>${VERSION}</version>
  <packaging>jar</packaging>
  <dependencies>
    <dependency>
      <groupId>androidx.lifecycle</groupId>
      <artifactId>lifecycle-common</artifactId>
      <version>2.7.0</version>
      <scope>compile</scope>
    </dependency>
    <dependency>
      <groupId>androidx.lifecycle</groupId>
      <artifactId>lifecycle-common-java8</artifactId>
      <version>2.7.0</version>
      <scope>compile</scope>
    </dependency>
    <dependency>
      <groupId>androidx.lifecycle</groupId>
      <artifactId>lifecycle-process</artifactId>
      <version>2.7.0</version>
      <scope>compile</scope>
    </dependency>
    <dependency>
      <groupId>androidx.lifecycle</groupId>
      <artifactId>lifecycle-runtime</artifactId>
      <version>2.7.0</version>
      <scope>compile</scope>
    </dependency>
    <dependency>
      <groupId>androidx.fragment</groupId>
      <artifactId>fragment</artifactId>
      <version>1.7.1</version>
      <scope>compile</scope>
    </dependency>
    <dependency>
      <groupId>androidx.annotation</groupId>
      <artifactId>annotation</artifactId>
      <version>1.8.1</version>
      <scope>compile</scope>
    </dependency>
    <dependency>
      <groupId>androidx.tracing</groupId>
      <artifactId>tracing</artifactId>
      <version>1.2.0</version>
      <scope>compile</scope>
    </dependency>
    <dependency>
      <groupId>androidx.core</groupId>
      <artifactId>core</artifactId>
      <version>1.13.1</version>
      <scope>compile</scope>
    </dependency>
    <dependency>
      <groupId>androidx.window</groupId>
      <artifactId>window-java</artifactId>
      <version>1.2.0</version>
      <scope>compile</scope>
    </dependency>
    <dependency>
      <groupId>com.getkeepsafe.relinker</groupId>
      <artifactId>relinker</artifactId>
      <version>1.4.5</version>
      <scope>compile</scope>
    </dependency>
    <dependency>
      <groupId>androidx.exifinterface</groupId>
      <artifactId>exifinterface</artifactId>
      <version>1.4.1</version>
      <scope>compile</scope>
    </dependency>
  </dependencies>
</project>
EOF
}

write_maven_metadata() {
  local artifact_dir="$1"
  local artifact_id="$2"

  cat > "$artifact_dir/maven-metadata.xml" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<metadata>
  <groupId>io.flutter</groupId>
  <artifactId>${artifact_id}</artifactId>
  <versioning>
    <latest>${VERSION}</latest>
    <release>${VERSION}</release>
    <versions>
      <version>${VERSION}</version>
    </versions>
    <lastUpdated>20260504000000</lastUpdated>
  </versioning>
</metadata>
EOF
}

verify_no_direct_window_calls() {
  local jar_path="$1"
  local verification_output="$TMP_DIR/verification.txt"

  "$JAVAP" -classpath "$jar_path" -c -p \
    io.flutter.embedding.android.FlutterActivity \
    io.flutter.embedding.android.FlutterFragmentActivity \
    io.flutter.plugin.platform.PlatformPlugin > "$verification_output"

  if grep -E 'android/view/Window\.set(StatusBarColor|NavigationBarColor|NavigationBarDividerColor)' "$verification_output" >/dev/null; then
    fail "Direct Window system bar color calls are still present in $jar_path"
  fi
}

patch_source() {
  local source_path="$1"
  local mode="$2"

  python3 - "$source_path" "$mode" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
mode = sys.argv[2]
text = path.read_text()


def replace_once(current: str, old: str, new: str, label: str) -> str:
    if old not in current:
        raise SystemExit(f"Failed to find {label} in {path}")
    return current.replace(old, new, 1)


if mode == "flutter_activity":
    pattern = re.compile(
        r"""  private void configureStatusBarForFullscreenFlutterExperience\(\) \{\n(?:    .*\n)+?  \}\n""",
        re.MULTILINE,
    )
    replacement = """  private void configureStatusBarForFullscreenFlutterExperience() {\n    Window window = getWindow();\n    window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);\n    if (Build.VERSION.SDK_INT < API_LEVELS.API_35) {\n      maybeSetStatusBarColor(window, 0x40000000);\n    }\n    window.getDecorView().setSystemUiVisibility(PlatformPlugin.DEFAULT_SYSTEM_UI);\n  }\n\n  private static void maybeSetStatusBarColor(Window window, int color) {\n    if (Build.VERSION.SDK_INT >= API_LEVELS.API_35) {\n      return;\n    }\n    try {\n      Window.class.getMethod("setStatusBarColor", int.class).invoke(window, color);\n    } catch (ReflectiveOperationException | SecurityException ignored) {\n    }\n  }\n"""
    text, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise SystemExit(f"Failed to patch fullscreen status bar method in {path}")
elif mode == "flutter_fragment_activity":
    pattern = re.compile(
        r"""  private void configureStatusBarForFullscreenFlutterExperience\(\) \{\n(?:    .*\n)+?  \}\n""",
        re.MULTILINE,
    )
    replacement = """  private void configureStatusBarForFullscreenFlutterExperience() {\n    Window window = getWindow();\n    window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);\n    if (Build.VERSION.SDK_INT < API_LEVELS.API_35) {\n      maybeSetStatusBarColor(window, 0x40000000);\n    }\n    window.getDecorView().setSystemUiVisibility(PlatformPlugin.DEFAULT_SYSTEM_UI);\n  }\n\n  private static void maybeSetStatusBarColor(Window window, int color) {\n    if (Build.VERSION.SDK_INT >= API_LEVELS.API_35) {\n      return;\n    }\n    try {\n      Window.class.getMethod("setStatusBarColor", int.class).invoke(window, color);\n    } catch (ReflectiveOperationException | SecurityException ignored) {\n    }\n  }\n"""
    text, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise SystemExit(f"Failed to patch fullscreen status bar method in {path}")
elif mode == "platform_plugin":
    text = replace_once(
        text,
        "      window.setStatusBarColor(systemChromeStyle.statusBarColor);",
        "      maybeSetStatusBarColor(window, systemChromeStyle.statusBarColor);",
        "PlatformPlugin.statusBarColor call",
    )
    text = replace_once(
        text,
        "        window.setNavigationBarColor(systemChromeStyle.systemNavigationBarColor);",
        "        maybeSetNavigationBarColor(window, systemChromeStyle.systemNavigationBarColor);",
        "PlatformPlugin.navigationBarColor call",
    )
    text = replace_once(
        text,
        "      window.setNavigationBarDividerColor(systemChromeStyle.systemNavigationBarDividerColor);",
        "      maybeSetNavigationBarDividerColor(window, systemChromeStyle.systemNavigationBarDividerColor);",
        "PlatformPlugin.navigationBarDividerColor call",
    )
    helper_anchor = "  private void setFrameworkHandlesBack(boolean frameworkHandlesBack) {"
    helper_block = """  private static void maybeSetStatusBarColor(Window window, int color) {\n    if (Build.VERSION.SDK_INT >= API_LEVELS.API_35) {\n      return;\n    }\n    try {\n      Window.class.getMethod("setStatusBarColor", int.class).invoke(window, color);\n    } catch (ReflectiveOperationException | SecurityException ignored) {\n    }\n  }\n\n  private static void maybeSetNavigationBarColor(Window window, int color) {\n    if (Build.VERSION.SDK_INT >= API_LEVELS.API_35) {\n      return;\n    }\n    try {\n      Window.class.getMethod("setNavigationBarColor", int.class).invoke(window, color);\n    } catch (ReflectiveOperationException | SecurityException ignored) {\n    }\n  }\n\n  private static void maybeSetNavigationBarDividerColor(Window window, int color) {\n    if (Build.VERSION.SDK_INT >= API_LEVELS.API_35) {\n      return;\n    }\n    try {\n      Window.class.getMethod("setNavigationBarDividerColor", int.class).invoke(window, color);\n    } catch (ReflectiveOperationException | SecurityException ignored) {\n    }\n  }\n\n  private void setFrameworkHandlesBack(boolean frameworkHandlesBack) {\n"""
    text = replace_once(text, helper_anchor, helper_block, "PlatformPlugin helper insertion anchor")
else:
    raise SystemExit(f"Unknown patch mode: {mode}")

path.write_text(text)
PY
}

FLUTTER_SDK=""
ANDROID_DIR=""
OUTPUT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --flutter-sdk)
      [[ $# -ge 2 ]] || fail "Missing value for --flutter-sdk"
      FLUTTER_SDK="$2"
      shift 2
      ;;
    --android-dir)
      [[ $# -ge 2 ]] || fail "Missing value for --android-dir"
      ANDROID_DIR="$2"
      shift 2
      ;;
    --output-dir)
      [[ $# -ge 2 ]] || fail "Missing value for --output-dir"
      OUTPUT_DIR="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ANDROID_DIR="${ANDROID_DIR:-$REPO_ROOT/virtual_bridge/android}"
LOCAL_PROPERTIES="$ANDROID_DIR/local.properties"

[[ -f "$LOCAL_PROPERTIES" ]] || fail "local.properties not found at $LOCAL_PROPERTIES"

if [[ -z "$FLUTTER_SDK" ]]; then
  FLUTTER_SDK="$(grep '^flutter.sdk=' "$LOCAL_PROPERTIES" | cut -d'=' -f2-)"
fi
[[ -n "$FLUTTER_SDK" ]] || fail "flutter.sdk is missing from $LOCAL_PROPERTIES"
[[ -d "$FLUTTER_SDK" ]] || fail "Flutter SDK directory not found: $FLUTTER_SDK"

OUTPUT_DIR="${OUTPUT_DIR:-$ANDROID_DIR/.patched-flutter-m2}"
mkdir -p "$OUTPUT_DIR"
OUTPUT_DIR="$(cd "$OUTPUT_DIR" && pwd)"
ENGINE_STAMP_FILE="$FLUTTER_SDK/bin/cache/engine.stamp"
[[ -f "$ENGINE_STAMP_FILE" ]] || fail "engine.stamp not found at $ENGINE_STAMP_FILE"
ENGINE_STAMP="$(tr -d '[:space:]' < "$ENGINE_STAMP_FILE")"
[[ -n "$ENGINE_STAMP" ]] || fail "engine.stamp is empty"
VERSION="1.0.0-$ENGINE_STAMP"
MANIFEST_PATH="$OUTPUT_DIR/.patch-manifest"
EXPECTED_MANIFEST="$(cat <<EOF
patch_revision=$PATCH_REVISION
engine_stamp=$ENGINE_STAMP
flutter_sdk=$FLUTTER_SDK
EOF
)"

artifact_jar_path() {
  local artifact_id="$1"
  printf '%s\n' "$OUTPUT_DIR/io/flutter/$artifact_id/$VERSION/$artifact_id-$VERSION.jar"
}

if [[ -f "$MANIFEST_PATH" ]]; then
  CURRENT_MANIFEST="$(cat "$MANIFEST_PATH")"
  if [[ "$CURRENT_MANIFEST" == "$EXPECTED_MANIFEST" ]] \
    && [[ -f "$(artifact_jar_path flutter_embedding_debug)" ]] \
    && [[ -f "$(artifact_jar_path flutter_embedding_profile)" ]] \
    && [[ -f "$(artifact_jar_path flutter_embedding_release)" ]]; then
    exit 0
  fi
fi

JAVAC="$(resolve_java_tool javac \
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/javac" \
  "/Applications/Android Studio Preview.app/Contents/jbr/Contents/Home/bin/javac")"
JAR_TOOL="$(resolve_java_tool jar \
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/jar" \
  "/Applications/Android Studio Preview.app/Contents/jbr/Contents/Home/bin/jar")"
JAVAP="$(resolve_java_tool javap \
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/javap" \
  "/Applications/Android Studio Preview.app/Contents/jbr/Contents/Home/bin/javap")"

ANDROID_SDK_DIR="$(grep '^sdk.dir=' "$LOCAL_PROPERTIES" | cut -d'=' -f2-)"
[[ -n "$ANDROID_SDK_DIR" ]] || fail "sdk.dir is missing from $LOCAL_PROPERTIES"
[[ -d "$ANDROID_SDK_DIR/platforms" ]] || fail "Android SDK platforms directory not found under $ANDROID_SDK_DIR"

HIGHEST_PLATFORM=""
HIGHEST_PLATFORM_LEVEL=0
for platform_dir in "$ANDROID_SDK_DIR"/platforms/android-*; do
  [[ -d "$platform_dir" ]] || continue
  platform_name="${platform_dir##*/android-}"
  if [[ "$platform_name" =~ ^[0-9]+$ ]] && (( platform_name > HIGHEST_PLATFORM_LEVEL )); then
    HIGHEST_PLATFORM_LEVEL=$platform_name
    HIGHEST_PLATFORM="$platform_dir"
  fi
done
[[ -n "$HIGHEST_PLATFORM" ]] || fail "Unable to locate an Android platform in $ANDROID_SDK_DIR/platforms"
ANDROID_JAR="$HIGHEST_PLATFORM/android.jar"
[[ -f "$ANDROID_JAR" ]] || fail "android.jar not found at $ANDROID_JAR"

TMP_DIR="$(mktemp -d -t flutter-android15-patch)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/source/io/flutter/embedding/android" "$TMP_DIR/source/io/flutter/plugin/platform" "$TMP_DIR/classpath" "$TMP_DIR/classes"

cp "$FLUTTER_SDK/engine/src/flutter/shell/platform/android/io/flutter/embedding/android/FlutterActivity.java" \
  "$TMP_DIR/source/io/flutter/embedding/android/FlutterActivity.java"
cp "$FLUTTER_SDK/engine/src/flutter/shell/platform/android/io/flutter/embedding/android/FlutterFragmentActivity.java" \
  "$TMP_DIR/source/io/flutter/embedding/android/FlutterFragmentActivity.java"
cp "$FLUTTER_SDK/engine/src/flutter/shell/platform/android/io/flutter/plugin/platform/PlatformPlugin.java" \
  "$TMP_DIR/source/io/flutter/plugin/platform/PlatformPlugin.java"

patch_source "$TMP_DIR/source/io/flutter/embedding/android/FlutterActivity.java" flutter_activity
patch_source "$TMP_DIR/source/io/flutter/embedding/android/FlutterFragmentActivity.java" flutter_fragment_activity
patch_source "$TMP_DIR/source/io/flutter/plugin/platform/PlatformPlugin.java" platform_plugin

GRADLE_CACHE_ROOT="${GRADLE_USER_HOME:-$HOME/.gradle}/caches/modules-2/files-2.1"
[[ -d "$GRADLE_CACHE_ROOT" ]] || fail "Gradle module cache not found at $GRADLE_CACHE_ROOT"

RELEASE_EMBEDDING_JAR="$FLUTTER_SDK/bin/cache/artifacts/engine/android-arm-release/flutter.jar"
[[ -f "$RELEASE_EMBEDDING_JAR" ]] || fail "Release flutter.jar not found at $RELEASE_EMBEDDING_JAR"

declare -a CLASSPATH_ENTRIES
CLASSPATH_ENTRIES=("$ANDROID_JAR" "$RELEASE_EMBEDDING_JAR")

declare -a CLASS_GROUP_DIRS=(
  "androidx.activity"
  "androidx.annotation"
  "androidx.collection"
  "androidx.core"
  "androidx.exifinterface"
  "androidx.fragment"
  "androidx.lifecycle"
  "androidx.savedstate"
  "androidx.tracing"
  "androidx.window"
  "com.getkeepsafe.relinker"
  "org.jetbrains.kotlin"
  "org.jetbrains.kotlinx"
)

extract_index=0
append_group_artifacts() {
  local group_name="$1"
  local group_dir="$GRADLE_CACHE_ROOT/$group_name"
  [[ -d "$group_dir" ]] || return 0

  while IFS= read -r artifact_path; do
    if [[ "$artifact_path" == *.aar ]]; then
      local extracted_jar="$TMP_DIR/classpath/$(printf '%04d' "$extract_index")-${artifact_path##*/}.classes.jar"
      extract_index=$((extract_index + 1))
      unzip -p "$artifact_path" classes.jar > "$extracted_jar" 2>/dev/null || continue
      [[ -s "$extracted_jar" ]] && CLASSPATH_ENTRIES+=("$extracted_jar")
    else
      CLASSPATH_ENTRIES+=("$artifact_path")
    fi
  done < <(find "$group_dir" -type f \( -name '*.jar' -o -name '*.aar' \) | sort)
}

for group_name in "${CLASS_GROUP_DIRS[@]}"; do
  append_group_artifacts "$group_name"
done

CLASSPATH="$(IFS=:; echo "${CLASSPATH_ENTRIES[*]}")"

"$JAVAC" -proc:none -cp "$CLASSPATH" -d "$TMP_DIR/classes" \
  "$TMP_DIR/source/io/flutter/embedding/android/FlutterActivity.java" \
  "$TMP_DIR/source/io/flutter/embedding/android/FlutterFragmentActivity.java" \
  "$TMP_DIR/source/io/flutter/plugin/platform/PlatformPlugin.java"

package_embedding() {
  local artifact_id="$1"
  local engine_cache_dir="$2"
  local source_jar="$FLUTTER_SDK/bin/cache/artifacts/engine/$engine_cache_dir/flutter.jar"
  [[ -f "$source_jar" ]] || fail "Source flutter.jar not found at $source_jar"

  local artifact_dir="$OUTPUT_DIR/io/flutter/$artifact_id"
  local version_dir="$artifact_dir/$VERSION"
  local output_jar="$version_dir/$artifact_id-$VERSION.jar"
  local output_pom="$version_dir/$artifact_id-$VERSION.pom"

  mkdir -p "$version_dir"
  cp "$source_jar" "$output_jar"
  (
    cd "$TMP_DIR/classes"
    "$JAR_TOOL" uf "$output_jar" \
      io/flutter/embedding/android/FlutterActivity.class \
      io/flutter/embedding/android/FlutterFragmentActivity.class \
      io/flutter/plugin/platform/PlatformPlugin.class
  )

  write_pom "$artifact_id" "$output_pom"
  write_maven_metadata "$artifact_dir" "$artifact_id"
  verify_no_direct_window_calls "$output_jar"
}

mkdir -p "$OUTPUT_DIR"
package_embedding flutter_embedding_debug android-arm
package_embedding flutter_embedding_profile android-arm-profile
package_embedding flutter_embedding_release android-arm-release

cat > "$MANIFEST_PATH" <<EOF
$EXPECTED_MANIFEST
EOF

echo "[flutter-android15-patch] Patched Flutter embedding artifacts generated at $OUTPUT_DIR"

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(scriptDirectory, "..");
export const versionConfigPath = resolve(repoRoot, "versions/app.json");
export const flutterPubspecPath = resolve(
  repoRoot,
  "virtual_bridge/pubspec.yaml",
);

function validateAppVersionConfig(config, sourcePath) {
  const appVersion = config.appVersion;
  const buildNumber = config.buildNumber;

  if (typeof appVersion !== "string" || !/^\d+\.\d+\.\d+$/.test(appVersion)) {
    throw new Error(
      `Invalid appVersion in ${sourcePath}: expected semver like 1.2.3`,
    );
  }

  if (!Number.isInteger(buildNumber) || buildNumber <= 0) {
    throw new Error(
      `Invalid buildNumber in ${sourcePath}: expected a positive integer`,
    );
  }

  return { appVersion, buildNumber };
}

export function readAppVersionConfig(filePath = versionConfigPath) {
  const config = JSON.parse(readFileSync(filePath, "utf-8"));
  return validateAppVersionConfig(config, filePath);
}

export function writeAppVersionConfig(config, filePath = versionConfigPath) {
  const nextConfig = validateAppVersionConfig(config, filePath);
  writeFileSync(filePath, `${JSON.stringify(nextConfig, null, 2)}\n`);
  return nextConfig;
}

export function syncFlutterPubspecVersion(
  config,
  filePath = flutterPubspecPath,
) {
  const nextConfig = validateAppVersionConfig(config, versionConfigPath);
  const pubspec = readFileSync(filePath, "utf-8");
  const versionPattern = /^version:\s+.+$/m;

  if (!versionPattern.test(pubspec)) {
    throw new Error(`Could not find a version field in ${filePath}`);
  }

  const nextVersion = formatAppVersionWithBuildNumber(nextConfig);
  const nextPubspec = pubspec.replace(
    versionPattern,
    `version: ${nextVersion}`,
  );
  const changed = nextPubspec !== pubspec;

  if (changed) {
    writeFileSync(filePath, nextPubspec);
  }

  return {
    changed,
    version: nextVersion,
  };
}

export function bumpSemver(version, releaseType) {
  const [major, minor, patch] = version
    .split(".")
    .map((value) => Number(value));

  switch (releaseType) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Unsupported release type: ${releaseType}`);
  }
}

export function formatAppVersionWithBuildNumber({ appVersion, buildNumber }) {
  return `${appVersion}+${buildNumber}`;
}

import {
  bumpSemver,
  formatAppVersionWithBuildNumber,
  readAppVersionConfig,
  syncFlutterPubspecVersion,
  writeAppVersionConfig,
} from "./app-version-utils.mjs";

function getNextConfig(previousConfig, command, nextVersionArg) {
  switch (command) {
    case "patch":
    case "minor":
    case "major":
      return {
        appVersion: bumpSemver(previousConfig.appVersion, command),
        buildNumber: previousConfig.buildNumber + 1,
      };
    case "build":
      return {
        appVersion: previousConfig.appVersion,
        buildNumber: previousConfig.buildNumber + 1,
      };
    case "set-version":
      if (typeof nextVersionArg !== "string") {
        throw new Error(
          "Usage: node ./scripts/bump-app-version.mjs set-version <x.y.z>",
        );
      }

      return {
        appVersion: nextVersionArg,
        buildNumber: previousConfig.buildNumber + 1,
      };
    default:
      throw new Error(
        `Unsupported command: ${command}. Use patch, minor, major, build, or set-version <x.y.z>.`,
      );
  }
}

const command = process.argv[2] ?? "patch";
const nextVersionArg = process.argv[3];

const previousConfig = readAppVersionConfig();
const nextConfig = writeAppVersionConfig(
  getNextConfig(previousConfig, command, nextVersionArg),
);
const syncResult = syncFlutterPubspecVersion(nextConfig);

console.log(
  `[bump-app-version] ${formatAppVersionWithBuildNumber(previousConfig)} -> ${formatAppVersionWithBuildNumber(nextConfig)}`,
);
console.log(
  `[bump-app-version] virtual_bridge/pubspec.yaml ${syncResult.changed ? "updated" : "already synced"}: ${syncResult.version}`,
);

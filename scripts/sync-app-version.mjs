import {
  readAppVersionConfig,
  syncFlutterPubspecVersion,
} from "./app-version-utils.mjs";

const syncResult = syncFlutterPubspecVersion(readAppVersionConfig());

console.log(
  `[sync-app-version] virtual_bridge/pubspec.yaml ${syncResult.changed ? "updated" : "already uses"} ${syncResult.version}`,
);

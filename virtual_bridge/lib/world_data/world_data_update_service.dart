import 'package:shared_preferences/shared_preferences.dart';

import 'world_data_config.dart' as config;
import 'world_data_lifecycle_service.dart';
import 'world_data_monster_book_service.dart';
import 'world_data_sync_service.dart';

const String worldDataUpdateChannelName = 'digivice/world_data';

class WorldDataUpdateService {
  static Future<Map<String, Object?>> completeNativeWorldDataUpdate({
    String? source,
    void Function(String message)? log,
    int? nowMs,
    bool publishNativeSnapshot = true,
    WorldDataLifecycleRandomProvider randomProvider =
        WorldDataLifecycleService.deterministicRandomProvider,
  }) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String? rawWorldData = prefs.getString(config.worldDataStorageKey);
    final String updateSource = source ?? 'manual';

    if (rawWorldData == null || rawWorldData.isEmpty) {
      log?.call(
        '[WorldDataUpdateService] flutter authoritative update skipped '
        'source=$updateSource reason=missing_world_data',
      );
      return <String, Object?>{
        'status': 'flutter_world_data_update_failed',
        'source': updateSource,
        'error': 'missing_world_data',
        'hasUpdatedRawWorldData': false,
        'hasSnapshot': false,
      };
    }

    final int resolvedNowMs = nowMs ?? DateTime.now().millisecondsSinceEpoch;
    final WorldDataLifecycleAdvanceResult advanced =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: rawWorldData,
      nowMs: resolvedNowMs,
      source: updateSource,
      rawMonsterBookData: prefs.getString(config.monsterBookStorageKey),
      randomProvider: randomProvider,
    );

    await persistAdvanceResult(
      prefs: prefs,
      result: advanced,
    );

    final Map<String, Object?>? nativePublishResult = publishNativeSnapshot
        ? await WorldDataSyncService.publishSnapshotJson(
            snapshotJson: advanced.snapshotJson,
            reason: '${updateSource}_native_world_data_update',
            log: log,
          )
        : null;

    log?.call(
      '[WorldDataUpdateService] flutter authoritative update completed '
      'source=$updateSource '
      'status=${advanced.status} '
      'elapsedMs=${advanced.elapsedMs} '
      'tickCount=${advanced.tickCount} '
      'worldDataChanged=${advanced.worldDataChanged} '
      'hatched=${advanced.hatched} '
      'selectedCharacterKey=${advanced.selectedCharacterKey} '
      'hatchSelectionDiagnostics=${advanced.hatchSelectionDiagnostics} '
      'foodInteractionDiagnostics=${advanced.foodInteractionDiagnostics} '
      'diseaseOccurred=${advanced.diseaseOccurred} '
      'evolutionGageBefore=${advanced.evolutionDiagnostics.evolutionGageBefore} '
      'evolutionGageAfter=${advanced.evolutionDiagnostics.evolutionGageAfter} '
      'evolutionGageIncreased=${advanced.evolutionDiagnostics.evolutionGageIncreased} '
      'evolved=${advanced.evolutionDiagnostics.evolved} '
      'previousCharacterKey=${advanced.evolutionDiagnostics.previousCharacterKey} '
      'nextCharacterKey=${advanced.evolutionDiagnostics.nextCharacterKey} '
      'monsterBookWriteOwner=${advanced.monsterBookWriteOwner} '
      'monsterBookChanged=${advanced.monsterBookChanged} '
      'evolutionBlockReason=${advanced.evolutionDiagnostics.blockReason} '
      'homeWidgetSyncStatus=${nativePublishResult?['status']} '
      'homeWidgetAuthoritativePublishStatus='
      '${nativePublishResult?['authoritativePublishStatus']}',
    );

    return <String, Object?>{
      ...advanced.toMap(),
      if (nativePublishResult != null) ...<String, Object?>{
        'homeWidgetSyncStatus': nativePublishResult['status'],
        'homeWidgetCurrentPublishStatus':
            nativePublishResult['currentPublishStatus'],
        'homeWidgetAuthoritativePublishStatus':
            nativePublishResult['authoritativePublishStatus'],
        'homeWidgetSyncResult': nativePublishResult,
      },
    };
  }

  static Future<void> persistAdvanceResult({
    required SharedPreferences prefs,
    required WorldDataLifecycleAdvanceResult result,
  }) async {
    await prefs.setString(
      config.worldDataStorageKey,
      result.updatedRawWorldData,
    );
    await prefs.setString(
      config.monsterBookStorageKey,
      WorldDataMonsterBookService.extractStateJson(result.updatedRawWorldData),
    );

    final String? snapshotJson = result.snapshotJson;
    if (snapshotJson == null) {
      await prefs.remove(config.worldDataSnapshotStorageKey);
      await prefs.remove(config.worldDataAuthoritativeSnapshotStorageKey);
      return;
    }

    await prefs.setString(config.worldDataSnapshotStorageKey, snapshotJson);
    await prefs.setString(
      config.worldDataAuthoritativeSnapshotStorageKey,
      snapshotJson,
    );
  }

  static Map<String, Object?> normalizePlatformResult(
    Map<Object?, Object?>? result,
  ) {
    if (result == null) {
      return <String, Object?>{};
    }

    return result.map(
      (Object? key, Object? value) => MapEntry(
        key?.toString() ?? '',
        value,
      ),
    );
  }
}

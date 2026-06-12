import 'dart:convert';

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
    final Map<String, Object?> inputWorldDataDiagnostics =
        _summarizeWorldDataForDiagnostics(rawWorldData);

    if (rawWorldData == null || rawWorldData.isEmpty) {
      log?.call(
        '[WorldDataUpdateService] flutter authoritative update skipped '
        'source=$updateSource reason=missing_world_data '
        'inputWorldDataDiagnostics=$inputWorldDataDiagnostics',
      );
      return <String, Object?>{
        'status': 'flutter_world_data_update_failed',
        'source': updateSource,
        'error': 'missing_world_data',
        'hasUpdatedRawWorldData': false,
        'hasSnapshot': false,
        'inputWorldDataDiagnostics': inputWorldDataDiagnostics,
        'updatedWorldDataDiagnostics': null,
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
    final Map<String, Object?> updatedWorldDataDiagnostics =
        _summarizeWorldDataForDiagnostics(advanced.updatedRawWorldData);

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
      'sickStatusDiagnostics=${advanced.sickStatusDiagnostics} '
      'inputWorldDataDiagnostics=$inputWorldDataDiagnostics '
      'updatedWorldDataDiagnostics=$updatedWorldDataDiagnostics '
      'evolutionBlockReason=${advanced.evolutionDiagnostics.blockReason} '
      'homeWidgetSyncStatus=${nativePublishResult?['status']} '
      'homeWidgetAuthoritativePublishStatus='
      '${nativePublishResult?['authoritativePublishStatus']}',
    );

    return <String, Object?>{
      ...advanced.toMap(),
      'inputWorldDataDiagnostics': inputWorldDataDiagnostics,
      'updatedWorldDataDiagnostics': updatedWorldDataDiagnostics,
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

  static Map<String, Object?> _summarizeWorldDataForDiagnostics(
    String? rawWorldData,
  ) {
    if (rawWorldData == null || rawWorldData.isEmpty) {
      return <String, Object?>{
        'hasWorldData': false,
        'characterState': null,
        'statuses': const <int>[],
        'hasSickStatus': false,
        'sickStartTime': null,
        'statusIconVisibleCount': null,
        'worldDataLength': rawWorldData?.length ?? 0,
        'worldDataChecksum': null,
      };
    }

    final Map<String, Object?> base = <String, Object?>{
      'hasWorldData': true,
      'worldDataLength': rawWorldData.length,
      'worldDataChecksum': _shortChecksum(rawWorldData),
    };

    try {
      final Object decoded = jsonDecode(rawWorldData);
      if (decoded is! Map<String, dynamic>) {
        return <String, Object?>{
          ...base,
          'characterState': null,
          'statuses': const <int>[],
          'hasSickStatus': false,
          'sickStartTime': null,
          'statusIconVisibleCount': null,
          'parseError': 'world_data_must_be_object',
        };
      }

      for (final dynamic entity in _readList(decoded['entities'])) {
        if (entity is! Map<String, dynamic>) {
          continue;
        }
        final Map<String, dynamic> components = _readMap(entity['components']);
        final Map<String, dynamic> object = _readMap(components['object']);
        if (_readInt(object['type']) != config.characterObjectType) {
          continue;
        }

        final Map<String, dynamic> characterStatus =
            _readMap(components['characterStatus']);
        final Map<String, dynamic> diseaseSystem =
            _readMap(components['diseaseSystem']);
        final Map<String, dynamic> statusIconRender =
            _readMap(components['statusIconRender']);
        final List<int> statuses = _readList(characterStatus['statuses'])
            .map(_readInt)
            .whereType<int>()
            .where((int value) => value > 0)
            .toList(growable: false);
        return <String, Object?>{
          ...base,
          'hasCharacter': true,
          'characterState': _readInt(object['state']),
          'statuses': statuses,
          'hasSickStatus': statuses.contains(config.characterStatusSick),
          'sickStartTime': _readInt(diseaseSystem['sickStartTime']),
          'statusIconVisibleCount': _readInt(statusIconRender['visibleCount']),
        };
      }

      return <String, Object?>{
        ...base,
        'hasCharacter': false,
        'characterState': null,
        'statuses': const <int>[],
        'hasSickStatus': false,
        'sickStartTime': null,
        'statusIconVisibleCount': null,
      };
    } catch (error) {
      return <String, Object?>{
        ...base,
        'characterState': null,
        'statuses': const <int>[],
        'hasSickStatus': false,
        'sickStartTime': null,
        'statusIconVisibleCount': null,
        'parseError': error.toString(),
      };
    }
  }

  static String _shortChecksum(String value) {
    int hash = 0x811c9dc5;
    for (final int codeUnit in value.codeUnits) {
      hash ^= codeUnit;
      hash = (hash * 0x01000193) & 0xffffffff;
    }
    return hash.toRadixString(16).padLeft(8, '0');
  }

  static Map<String, dynamic> _readMap(Object? value) {
    return value is Map<String, dynamic> ? value : <String, dynamic>{};
  }

  static List<dynamic> _readList(Object? value) {
    return value is List<dynamic> ? value : const <dynamic>[];
  }

  static int? _readInt(Object? value) {
    if (value is int) {
      return value;
    }
    if (value is num) {
      return value.round();
    }
    if (value is String) {
      return int.tryParse(value);
    }
    return null;
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

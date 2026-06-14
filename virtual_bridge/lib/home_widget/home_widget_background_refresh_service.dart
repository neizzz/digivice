import 'dart:convert';

import 'package:home_widget/home_widget.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../world_data/world_data_lifecycle_service.dart';
import '../world_data/world_data_update_service.dart';
import '../world_data/world_data_config.dart' as config;
import '../world_data/world_data_sync_service.dart';

const String homeWidgetPeriodicRefreshTaskName = 'home_widget_periodic_refresh';

class HomeWidgetBackgroundRefreshService {
  const HomeWidgetBackgroundRefreshService._();

  static Future<Map<String, Object?>> runPeriodicRefresh({
    String source = config.widgetPeriodicRefreshSource,
    int? nowMs,
    void Function(String message)? log,
    WorldDataLifecycleRandomProvider randomProvider =
        WorldDataLifecycleService.deterministicRandomProvider,
    Future<bool?> Function({String? androidName, String? qualifiedAndroidName})?
        updateWidget,
    Future<bool?> Function(String key, Object value)? saveWidgetData,
  }) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final Future<bool?> Function(String key, Object value) saver =
        saveWidgetData ?? _saveHomeWidgetData;
    final int startedAtMs = nowMs ?? DateTime.now().millisecondsSinceEpoch;

    await _recordStatus(
      prefs,
      saver: saver,
      status: 'flutter_periodic_started',
      nowMs: startedAtMs,
    );
    await _recordBackgroundExecutionMetadata(
      prefs,
      saver,
      status: 'flutter_periodic_started',
      startedAtMs: startedAtMs,
      completedAtMs: null,
      error: null,
    );

    late Map<String, Object?> fullUpdateResult;
    try {
      fullUpdateResult =
          await WorldDataUpdateService.completeNativeWorldDataUpdate(
        source: source,
        log: log,
        nowMs: nowMs,
        publishNativeSnapshot: false,
        randomProvider: randomProvider,
      );
    } catch (error, stackTrace) {
      final int failedAtMs = nowMs ?? DateTime.now().millisecondsSinceEpoch;
      final bool hasWorldData =
          (prefs.getString(config.worldDataStorageKey) ?? '').isNotEmpty;
      final bool hasSnapshot =
          (prefs.getString(config.worldDataAuthoritativeSnapshotStorageKey) ??
                  '')
              .isNotEmpty;
      await _recordStatus(
        prefs,
        saver: saver,
        status: 'flutter_periodic_failed',
        nowMs: failedAtMs,
      );
      await _recordRefreshFailureMetadata(
        prefs,
        saver,
        nowMs: failedAtMs,
        status: 'flutter_periodic_failed',
        error: error.toString(),
        hasWorldData: hasWorldData,
        hasSnapshot: hasSnapshot,
      );
      await _recordBackgroundExecutionMetadata(
        prefs,
        saver,
        status: 'flutter_periodic_failed',
        startedAtMs: null,
        completedAtMs: failedAtMs,
        error: error.toString(),
      );
      log?.call(
        '[HomeWidgetBackgroundRefreshService] periodic refresh failed '
        'status=flutter_periodic_failed '
        'error=$error '
        'stackTrace=$stackTrace '
        'hasWorldData=$hasWorldData '
        'hasSnapshot=$hasSnapshot',
      );
      return <String, Object?>{
        'status': 'flutter_periodic_failed',
        'error': error.toString(),
        'hasWorldData': hasWorldData,
        'hasSnapshot': hasSnapshot,
      };
    }

    if (fullUpdateResult['status'] == 'flutter_world_data_update_failed' &&
        fullUpdateResult['error'] == 'missing_world_data') {
      final int failedAtMs = _readInt(fullUpdateResult['nowMs']) ??
          nowMs ??
          DateTime.now().millisecondsSinceEpoch;
      await _recordStatus(
        prefs,
        saver: saver,
        status: 'flutter_periodic_missing_world_data',
        nowMs: failedAtMs,
      );
      await _recordRefreshFailureMetadata(
        prefs,
        saver,
        nowMs: failedAtMs,
        status: 'flutter_periodic_missing_world_data',
        error: 'missing_world_data',
        hasWorldData: false,
        hasSnapshot: false,
      );
      await _recordBackgroundExecutionMetadata(
        prefs,
        saver,
        status: 'flutter_periodic_missing_world_data',
        startedAtMs: null,
        completedAtMs: failedAtMs,
        error: 'missing_world_data',
      );
      return <String, Object?>{
        'status': 'flutter_periodic_missing_world_data',
        'error': 'missing_world_data',
        'hasWorldData': false,
        'hasSnapshot': false,
      };
    }

    final String? snapshotJson =
        prefs.getString(config.worldDataAuthoritativeSnapshotStorageKey);
    if (snapshotJson != null) {
      final Map<String, bool> publishResults =
          await _publishSnapshotToWidgetSurfaces(
        saver,
        snapshotJson: snapshotJson,
        log: log,
      );
      await WorldDataSyncService.recordSnapshotPublishHistory(
        prefs: prefs,
        snapshotJson: snapshotJson,
        reason: '${source}_authoritative',
        publishedAtMs: _readInt(fullUpdateResult['nowMs']) ??
            nowMs ??
            DateTime.now().millisecondsSinceEpoch,
        publishResultsBySlot: <String, bool>{
          'current':
              (publishResults[config.worldDataSnapshotStorageKey] ?? false) &&
                  (publishResults[config.nativeWorldDataSnapshotKey] ?? false),
          'authoritative': (publishResults[
                      config.worldDataAuthoritativeSnapshotStorageKey] ??
                  false) &&
              (publishResults[config.nativeWorldDataAuthoritativeSnapshotKey] ??
                  false),
        },
        saver: saver,
      );
      final List<String> failedKeys = publishResults.entries
          .where((MapEntry<String, bool> entry) => !entry.value)
          .map((MapEntry<String, bool> entry) => entry.key)
          .toList();
      if (failedKeys.isEmpty) {
        await _recordRefreshCompletionMetadata(
          prefs,
          saver,
          snapshotJson: snapshotJson,
          nowMs: _readInt(fullUpdateResult['nowMs']) ??
              nowMs ??
              DateTime.now().millisecondsSinceEpoch,
          reason: '${source}_authoritative',
          hatched: fullUpdateResult['hatched'] == true,
          selectedCharacterKey: _readInt(
            fullUpdateResult['selectedCharacterKey'],
          ),
          hatchSelectionDiagnostics: _readStringObjectMap(
            fullUpdateResult['hatchSelectionDiagnostics'],
          ),
        );
      } else {
        final int failedAtMs = _readInt(fullUpdateResult['nowMs']) ??
            nowMs ??
            DateTime.now().millisecondsSinceEpoch;
        await _recordRefreshFailureMetadata(
          prefs,
          saver,
          nowMs: failedAtMs,
          status: 'flutter_periodic_snapshot_publish_failed',
          error: 'snapshot_publish_failed:${failedKeys.join(',')}',
          hasWorldData: true,
          hasSnapshot: true,
        );
        await _recordBackgroundExecutionMetadata(
          prefs,
          saver,
          status: 'flutter_periodic_snapshot_publish_failed',
          startedAtMs: null,
          completedAtMs: failedAtMs,
          error: 'snapshot_publish_failed:${failedKeys.join(',')}',
        );
        fullUpdateResult = <String, Object?>{
          ...fullUpdateResult,
          'status': 'flutter_periodic_snapshot_publish_failed',
          'error': 'snapshot_publish_failed:${failedKeys.join(',')}',
          'snapshotPublishStatus': 'failed',
          'snapshotPublishFailureKeys': failedKeys,
        };
      }
    } else {
      final int failedAtMs = _readInt(fullUpdateResult['nowMs']) ??
          nowMs ??
          DateTime.now().millisecondsSinceEpoch;
      await _recordRefreshFailureMetadata(
        prefs,
        saver,
        nowMs: failedAtMs,
        status: 'flutter_periodic_missing_snapshot',
        error: 'missing_authoritative_snapshot',
        hasWorldData: true,
        hasSnapshot: false,
      );
      await _recordBackgroundExecutionMetadata(
        prefs,
        saver,
        status: 'flutter_periodic_missing_snapshot',
        startedAtMs: null,
        completedAtMs: failedAtMs,
        error: 'missing_authoritative_snapshot',
      );
      fullUpdateResult = <String, Object?>{
        ...fullUpdateResult,
        'status': 'flutter_periodic_missing_snapshot',
        'error': 'missing_authoritative_snapshot',
      };
    }

    final Future<bool?> Function({
      String? androidName,
      String? qualifiedAndroidName,
    }) updater = updateWidget ??
        ({String? androidName, String? qualifiedAndroidName}) =>
            HomeWidget.updateWidget(
              androidName: androidName,
              qualifiedAndroidName: qualifiedAndroidName,
            );

    // 2x1 receiver (`HomeWidgetProvider`) is intentionally commented out in
    // `AndroidManifest.xml`, so the live product currently supports only the
    // 1x1 widget. Keep the result field for compatibility, but do not target
    // the disabled 2x1 receiver during background refresh. If 2x1 is
    // re-enabled later, add the `HomeWidgetProvider` update call back here.
    const String updatedTwoByOne = 'skipped_manifest_disabled';
    final bool updatedOneByOne = await _tryUpdateWidget(
      updater,
      androidName: 'HomeWidget1x1Provider',
      qualifiedAndroidName: 'com.ch00n9h09.montto.HomeWidget1x1Provider',
      log: log,
    );
    if (!updatedOneByOne) {
      final int failedAtMs = _readInt(fullUpdateResult['nowMs']) ??
          nowMs ??
          DateTime.now().millisecondsSinceEpoch;
      await _recordRefreshFailureMetadata(
        prefs,
        saver,
        nowMs: failedAtMs,
        status: 'flutter_periodic_widget_update_failed',
        error: 'update_widget_failed:HomeWidget1x1Provider',
        hasWorldData: true,
        hasSnapshot: snapshotJson != null,
      );
      fullUpdateResult = <String, Object?>{
        ...fullUpdateResult,
        'status': 'flutter_periodic_widget_update_failed',
        'error': 'update_widget_failed:HomeWidget1x1Provider',
      };
    }

    final int finishedAtMs = _readInt(fullUpdateResult['nowMs']) ??
        nowMs ??
        DateTime.now().millisecondsSinceEpoch;
    final String finalStatus = fullUpdateResult['status']?.toString() ??
        'flutter_world_data_update_unknown';

    await _recordStatus(
      prefs,
      saver: saver,
      status: finalStatus,
      nowMs: finishedAtMs,
    );
    await _recordBackgroundExecutionMetadata(
      prefs,
      saver,
      status: finalStatus,
      startedAtMs: null,
      completedAtMs: finishedAtMs,
      error: fullUpdateResult['error']?.toString(),
    );

    log?.call(
      '[HomeWidgetBackgroundRefreshService] periodic refresh completed '
      'status=${fullUpdateResult['status']} '
      'elapsedMs=${fullUpdateResult['elapsedMs']} '
      'tickCount=${fullUpdateResult['tickCount']} '
      'hatched=${fullUpdateResult['hatched']} '
      'selectedCharacterKey=${fullUpdateResult['selectedCharacterKey']} '
      'hatchSelectionDiagnostics=${fullUpdateResult['hatchSelectionDiagnostics']} '
      'hasSnapshot=${snapshotJson != null} '
      'updated2x1=$updatedTwoByOne '
      'updated1x1=$updatedOneByOne',
    );

    return <String, Object?>{
      ...fullUpdateResult,
      'updatedRawWorldData': null,
      'hasWorldData': true,
      'hasSnapshot': snapshotJson != null,
      'updated2x1': updatedTwoByOne,
      'updated1x1': updatedOneByOne,
    };
  }

  static Future<bool?> _saveHomeWidgetData(String key, Object value) async {
    if (value is bool) {
      return HomeWidget.saveWidgetData<bool>(key, value);
    }
    if (value is int) {
      return HomeWidget.saveWidgetData<int>(key, value);
    }
    return HomeWidget.saveWidgetData<String>(key, value.toString());
  }

  static Future<bool> _tryUpdateWidget(
    Future<bool?> Function({
      String? androidName,
      String? qualifiedAndroidName,
    }) updater, {
    required String androidName,
    required String qualifiedAndroidName,
    void Function(String message)? log,
  }) async {
    try {
      return await updater(
            androidName: androidName,
            qualifiedAndroidName: qualifiedAndroidName,
          ) !=
          false;
    } catch (error, stackTrace) {
      log?.call(
        '[HomeWidgetBackgroundRefreshService] updateWidget failed '
        'androidName=$androidName '
        'qualifiedAndroidName=$qualifiedAndroidName '
        'error=$error '
        'stackTrace=$stackTrace',
      );
      return false;
    }
  }

  static Future<void> _recordBackgroundExecutionMetadata(
    SharedPreferences prefs,
    Future<bool?> Function(String key, Object value) saver, {
    required String status,
    required int? startedAtMs,
    required int? completedAtMs,
    required String? error,
  }) async {
    await prefs.setString(config.refreshBackgroundStatusKey, status);
    await _trySave(saver, config.refreshBackgroundStatusKey, status);

    if (startedAtMs != null) {
      await prefs.setInt(config.refreshBackgroundStartedAtMsKey, startedAtMs);
      await _trySave(
          saver, config.refreshBackgroundStartedAtMsKey, startedAtMs);
      await prefs.remove(config.refreshBackgroundCompletedAtMsKey);
      await _trySave(saver, config.refreshBackgroundCompletedAtMsKey, 0);
    }

    if (completedAtMs != null) {
      await prefs.setInt(
        config.refreshBackgroundCompletedAtMsKey,
        completedAtMs,
      );
      await _trySave(
        saver,
        config.refreshBackgroundCompletedAtMsKey,
        completedAtMs,
      );
    }

    if (error == null || error.isEmpty) {
      await prefs.remove(config.refreshBackgroundErrorKey);
      await _trySave(saver, config.refreshBackgroundErrorKey, '');
    } else {
      await prefs.setString(config.refreshBackgroundErrorKey, error);
      await _trySave(saver, config.refreshBackgroundErrorKey, error);
    }
  }

  static Future<void> _recordRefreshCompletionMetadata(
    SharedPreferences prefs,
    Future<bool?> Function(String key, Object value) saver, {
    required String snapshotJson,
    required int nowMs,
    required String reason,
    required bool hatched,
    required int? selectedCharacterKey,
    required Map<String, Object?>? hatchSelectionDiagnostics,
  }) async {
    final String smokeResult = _buildRefreshSmokeResult(
      snapshotJson: snapshotJson,
      reason: reason,
      hatched: hatched,
      selectedCharacterKey: selectedCharacterKey,
      hatchSelectionDiagnostics: hatchSelectionDiagnostics,
    );
    await prefs.setBool(config.refreshInFlightKey, false);
    await prefs.setInt(config.refreshCompletedAtMsKey, nowMs);
    await prefs.setString(config.refreshSmokeResultKey, smokeResult);
    await _trySave(saver, config.refreshInFlightKey, false);
    await _trySave(saver, config.refreshCompletedAtMsKey, nowMs);
    await _trySave(
      saver,
      config.refreshSmokeResultKey,
      smokeResult,
    );
  }

  static Future<void> _recordRefreshFailureMetadata(
    SharedPreferences prefs,
    Future<bool?> Function(String key, Object value) saver, {
    required int nowMs,
    required String status,
    required String error,
    required bool hasWorldData,
    required bool hasSnapshot,
  }) async {
    final String smokeResult = _buildRefreshFailureSmokeResult(
      status: status,
      error: error,
      hasWorldData: hasWorldData,
      hasSnapshot: hasSnapshot,
    );
    await prefs.setBool(config.refreshInFlightKey, false);
    await prefs.setInt(config.refreshCompletedAtMsKey, nowMs);
    await prefs.setString(config.refreshSmokeResultKey, smokeResult);
    await _trySave(saver, config.refreshInFlightKey, false);
    await _trySave(saver, config.refreshCompletedAtMsKey, nowMs);
    await _trySave(saver, config.refreshSmokeResultKey, smokeResult);
  }

  static String _buildRefreshFailureSmokeResult({
    required String status,
    required String error,
    required bool hasWorldData,
    required bool hasSnapshot,
  }) {
    return 'authoritative_snapshot_publish_failed('
        'status=$status,'
        'error=$error,'
        'hasWorldData=$hasWorldData,'
        'hasSnapshot=$hasSnapshot'
        ')';
  }

  static Future<Map<String, bool>> _publishSnapshotToWidgetSurfaces(
    Future<bool?> Function(String key, Object value) saver, {
    required String snapshotJson,
    void Function(String message)? log,
  }) async {
    final Map<String, bool> results = <String, bool>{};
    for (final String key in <String>[
      config.worldDataSnapshotStorageKey,
      config.worldDataAuthoritativeSnapshotStorageKey,
      config.nativeWorldDataSnapshotKey,
      config.nativeWorldDataAuthoritativeSnapshotKey,
    ]) {
      results[key] = await _trySave(
        saver,
        key,
        snapshotJson,
        log: log,
      );
    }
    return results;
  }

  static String _buildRefreshSmokeResult({
    required String snapshotJson,
    required String reason,
    required bool hatched,
    required int? selectedCharacterKey,
    required Map<String, Object?>? hatchSelectionDiagnostics,
  }) {
    final String hatchSummary = _buildHatchSummary(
      hatched: hatched,
      selectedCharacterKey: selectedCharacterKey,
      hatchSelectionDiagnostics: hatchSelectionDiagnostics,
    );
    try {
      final Map<String, dynamic> snapshot =
          jsonDecode(snapshotJson) as Map<String, dynamic>;
      return 'authoritative_snapshot_published('
          'reason=$reason,'
          'state=${snapshot['characterState'] ?? 'unknown'},'
          'display=${snapshot['displayState'] ?? 'unknown'},'
          'icons=${snapshot['visibleStatusIcons'] ?? 'unknown'},'
          'key=${snapshot['characterKey'] ?? 'unknown'},'
          'kind=${snapshot['snapshotKind'] ?? 'unknown'},'
          '$hatchSummary'
          ')';
    } catch (_) {
      return 'authoritative_snapshot_published('
          'reason=$reason,'
          'state=unknown,'
          'key=unknown,'
          'kind=unknown,'
          '$hatchSummary'
          ')';
    }
  }

  static String _buildHatchSummary({
    required bool hatched,
    required int? selectedCharacterKey,
    required Map<String, Object?>? hatchSelectionDiagnostics,
  }) {
    final Map<String, Object?> diagnostics =
        hatchSelectionDiagnostics ?? <String, Object?>{};
    return 'hatched=$hatched,'
        'selectedCharacterKey=${selectedCharacterKey ?? 'unknown'},'
        'hatchUsedPendingCharacterKey='
        '${diagnostics['usedPendingCharacterKey'] ?? 'unknown'},'
        'hatchRandom=${diagnostics['random'] ?? 'unknown'},'
        'hatchNormalizedRandom=${diagnostics['normalizedRandom'] ?? 'unknown'},'
        'hatchRollPercent=${diagnostics['rollPercent'] ?? 'unknown'},'
        'hatchGreenProbability=${diagnostics['greenProbability'] ?? 'unknown'},'
        'hatchSoilProbability=${diagnostics['soilProbability'] ?? 'unknown'},'
        'hatchSkullProbability=${diagnostics['skullProbability'] ?? 'unknown'},'
        'hatchStaleFoodCountAtHatch='
        '${diagnostics['staleFoodCountAtHatch'] ?? 'unknown'},'
        'hatchSyringeCount=${diagnostics['syringeCount'] ?? 'unknown'}';
  }

  static Future<void> _recordStatus(
    SharedPreferences prefs, {
    required Future<bool?> Function(String key, Object value) saver,
    required String status,
    required int nowMs,
  }) async {
    await prefs.setString(config.periodicRefreshStatusKey, status);
    await prefs.setInt(config.periodicRefreshStatusAtMsKey, nowMs);
    await _trySave(saver, config.periodicRefreshStatusKey, status);
    await _trySave(saver, config.periodicRefreshStatusAtMsKey, nowMs);
  }

  static Future<bool> _trySave(
    Future<bool?> Function(String key, Object value) saver,
    String key,
    Object value, {
    void Function(String message)? log,
  }) async {
    try {
      return await saver(key, value) != false;
    } catch (error, stackTrace) {
      log?.call(
        '[HomeWidgetBackgroundRefreshService] saveWidgetData failed '
        'key=$key error=$error stackTrace=$stackTrace',
      );
      return false;
    }
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

  static Map<String, Object?>? _readStringObjectMap(Object? value) {
    if (value is Map<String, Object?>) {
      return value;
    }
    if (value is Map) {
      return value.map(
        (Object? key, Object? value) => MapEntry(key?.toString() ?? '', value),
      );
    }
    return null;
  }
}

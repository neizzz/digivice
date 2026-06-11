import 'dart:convert';

import 'package:home_widget/home_widget.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../world_data/world_data_lifecycle_service.dart';
import '../world_data/world_data_update_service.dart';
import '../world_data/world_data_config.dart' as config;

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
    final Map<String, Object?> fullUpdateResult =
        await WorldDataUpdateService.completeNativeWorldDataUpdate(
      source: source,
      log: log,
      nowMs: nowMs,
      publishNativeSnapshot: false,
      randomProvider: randomProvider,
    );

    if (fullUpdateResult['status'] == 'flutter_world_data_update_failed' &&
        fullUpdateResult['error'] == 'missing_world_data') {
      await _recordStatus(
        prefs,
        status: 'flutter_periodic_missing_world_data',
        nowMs: nowMs ?? DateTime.now().millisecondsSinceEpoch,
      );
      return <String, Object?>{
        'status': 'flutter_periodic_missing_world_data',
        'hasWorldData': false,
        'hasSnapshot': false,
      };
    }

    final String? snapshotJson =
        prefs.getString(config.worldDataAuthoritativeSnapshotStorageKey);
    if (snapshotJson != null) {
      final Future<bool?> Function(String key, Object value) saver =
          saveWidgetData ?? _saveHomeWidgetData;
      await saver(config.worldDataSnapshotStorageKey, snapshotJson);
      await saver(
          config.worldDataAuthoritativeSnapshotStorageKey, snapshotJson);
      await saver(config.nativeWorldDataSnapshotKey, snapshotJson);
      final bool? authoritativeSaveResult = await saver(
        config.nativeWorldDataAuthoritativeSnapshotKey,
        snapshotJson,
      );
      if (authoritativeSaveResult != false) {
        await _recordRefreshCompletionMetadata(
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
      }
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

    final bool? updatedTwoByOne = await updater(
      androidName: 'HomeWidgetProvider',
      qualifiedAndroidName: 'com.ch00n9h09.montto.HomeWidgetProvider',
    );
    final bool? updatedOneByOne = await updater(
      androidName: 'HomeWidget1x1Provider',
      qualifiedAndroidName: 'com.ch00n9h09.montto.HomeWidget1x1Provider',
    );

    await _recordStatus(
      prefs,
      status: fullUpdateResult['status']?.toString() ??
          'flutter_world_data_update_unknown',
      nowMs: _readInt(fullUpdateResult['nowMs']) ??
          nowMs ??
          DateTime.now().millisecondsSinceEpoch,
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

  static Future<void> _recordRefreshCompletionMetadata(
    Future<bool?> Function(String key, Object value) saver, {
    required String snapshotJson,
    required int nowMs,
    required String reason,
    required bool hatched,
    required int? selectedCharacterKey,
    required Map<String, Object?>? hatchSelectionDiagnostics,
  }) async {
    await saver(config.refreshInFlightKey, false);
    await saver(config.refreshCompletedAtMsKey, nowMs);
    await saver(
      config.refreshSmokeResultKey,
      _buildRefreshSmokeResult(
        snapshotJson: snapshotJson,
        reason: reason,
        hatched: hatched,
        selectedCharacterKey: selectedCharacterKey,
        hatchSelectionDiagnostics: hatchSelectionDiagnostics,
      ),
    );
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
    required String status,
    required int nowMs,
  }) async {
    await prefs.setString(config.periodicRefreshStatusKey, status);
    await prefs.setInt(config.periodicRefreshStatusAtMsKey, nowMs);
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

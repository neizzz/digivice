import 'package:home_widget/home_widget.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../world_data/world_data_lifecycle_service.dart';
import '../world_data/world_data_update_service.dart';
import 'world_data_config.dart' as config;

const String homeWidgetPeriodicRefreshTaskName = 'home_widget_periodic_refresh';
const String homeWidgetPeriodicRefreshUniqueName =
    'digivice_home_widget_periodic_refresh';
const Duration homeWidgetPeriodicRefreshFrequency = Duration(minutes: 15);

class HomeWidgetBackgroundRefreshService {
  const HomeWidgetBackgroundRefreshService._();

  static Future<Map<String, Object?>> runPeriodicRefresh({
    String source = config.periodicRefreshReason,
    int? nowMs,
    void Function(String message)? log,
    WorldDataLifecycleRandomProvider randomProvider =
        WorldDataLifecycleService.deterministicRandomProvider,
    Future<bool?> Function({String? androidName, String? qualifiedAndroidName})?
        updateWidget,
    Future<bool?> Function(String key, String value)? saveWidgetData,
  }) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String? rawWorldData = prefs.getString(config.worldDataStorageKey);
    if (rawWorldData == null || rawWorldData.isEmpty) {
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

    final WorldDataLifecycleAdvanceResult advanced =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: rawWorldData,
      nowMs: nowMs ?? DateTime.now().millisecondsSinceEpoch,
      source: source,
      randomProvider: randomProvider,
    );
    await WorldDataUpdateService.persistAdvanceResult(
      prefs: prefs,
      result: advanced,
    );

    final String? snapshotJson = advanced.snapshotJson;
    if (snapshotJson != null) {
      final Future<bool?> Function(String key, String value) saver =
          saveWidgetData ?? _saveHomeWidgetData;
      await saver(config.worldDataSnapshotStorageKey, snapshotJson);
      await saver(
          config.worldDataAuthoritativeSnapshotStorageKey, snapshotJson);
      await saver(config.nativeWorldDataSnapshotKey, snapshotJson);
      await saver(config.nativeWorldDataAuthoritativeSnapshotKey, snapshotJson);
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
      status: advanced.status,
      nowMs: advanced.nowMs,
    );

    log?.call(
      '[HomeWidgetBackgroundRefreshService] periodic refresh completed '
      'status=${advanced.status} '
      'elapsedMs=${advanced.elapsedMs} '
      'tickCount=${advanced.tickCount} '
      'hasSnapshot=${snapshotJson != null} '
      'updated2x1=$updatedTwoByOne '
      'updated1x1=$updatedOneByOne',
    );

    return <String, Object?>{
      ...advanced.toMap(includeWorldData: false),
      'hasWorldData': true,
      'hasSnapshot': snapshotJson != null,
      'updated2x1': updatedTwoByOne,
      'updated1x1': updatedOneByOne,
    };
  }

  static Future<bool?> _saveHomeWidgetData(String key, String value) async {
    return HomeWidget.saveWidgetData<String>(key, value);
  }

  static Future<void> _recordStatus(
    SharedPreferences prefs, {
    required String status,
    required int nowMs,
  }) async {
    await prefs.setString(config.periodicRefreshStatusKey, status);
    await prefs.setInt(config.periodicRefreshStatusAtMsKey, nowMs);
  }
}

import 'dart:convert';

import 'package:digivice_virtual_bridge/home_widget/home_widget_background_refresh_service.dart';
import 'package:digivice_virtual_bridge/home_widget/world_data_config.dart'
    as config;
import 'package:digivice_virtual_bridge/world_data/world_data_lifecycle_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

String _buildWorldData({
  int lastEcsSaved = 0,
  double evolutionGage = 0,
}) =>
    jsonEncode(<String, dynamic>{
      'world_metadata': <String, dynamic>{
        'monster_name': 'MonTTo',
        'last_ecs_saved': lastEcsSaved,
        'app_state': <String, dynamic>{
          'last_active_time': lastEcsSaved,
          'use_local_time': false,
        },
      },
      'entities': <Map<String, dynamic>>[
        <String, dynamic>{
          'components': <String, dynamic>{
            'object': <String, dynamic>{
              'id': 101,
              'type': config.characterObjectType,
              'state': config.characterStateIdle,
            },
            'render': <String, dynamic>{'textureKey': 1},
            'characterStatus': <String, dynamic>{
              'characterKey': 1,
              'stamina': 10,
              'evolutionGage': evolutionGage,
              'evolutionPhase': 1,
              'statuses': <int>[],
            },
            'diseaseSystem': <String, dynamic>{
              'nextCheckTime': 10 * 1000,
              'sickStartTime': 0,
            },
          },
        },
      ],
    });

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  test('periodic callback은 lifecycle 서비스를 거쳐 snapshot과 updateWidget을 호출한다',
      () async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString(config.worldDataStorageKey, _buildWorldData());
    final List<String> savedKeys = <String>[];
    final List<String> updatedWidgets = <String>[];

    final Map<String, Object?> result =
        await HomeWidgetBackgroundRefreshService.runPeriodicRefresh(
      nowMs: 60 * 1000,
      randomProvider: (_) => 1,
      saveWidgetData: (String key, String value) async {
        savedKeys.add(key);
        expect(value, isNotEmpty);
        return true;
      },
      updateWidget: (
          {String? androidName, String? qualifiedAndroidName}) async {
        updatedWidgets.add(androidName ?? qualifiedAndroidName ?? 'unknown');
        return true;
      },
    );

    expect(result['status'], worldDataLifecycleDefaultCompletedStatus);
    expect(result['source'], worldDataLifecycleWidgetPeriodicRefreshSource);
    expect(prefs.getString(config.worldDataSnapshotStorageKey), isNotNull);
    expect(
      prefs.getString(config.worldDataAuthoritativeSnapshotStorageKey),
      isNotNull,
    );
    expect(savedKeys, contains(config.worldDataSnapshotStorageKey));
    expect(
        savedKeys, contains(config.worldDataAuthoritativeSnapshotStorageKey));
    expect(savedKeys, contains(config.nativeWorldDataSnapshotKey));
    expect(savedKeys, contains(config.nativeWorldDataAuthoritativeSnapshotKey));
    expect(updatedWidgets, contains('HomeWidgetProvider'));
    expect(updatedWidgets, contains('HomeWidget1x1Provider'));
  });

  test('snapshot이 없어도 world data에서 authoritative snapshot을 생성한다', () async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString(config.worldDataStorageKey, _buildWorldData());

    await HomeWidgetBackgroundRefreshService.runPeriodicRefresh(
      nowMs: 1000,
      randomProvider: (_) => 1,
      saveWidgetData: (_, __) async => true,
      updateWidget:
          ({String? androidName, String? qualifiedAndroidName}) async => true,
    );

    final String? snapshotJson =
        prefs.getString(config.worldDataAuthoritativeSnapshotStorageKey);
    expect(snapshotJson, isNotNull);
    final Map<String, dynamic> snapshot =
        jsonDecode(snapshotJson!) as Map<String, dynamic>;
    expect(snapshot['snapshotKind'], 'authoritativeAppState');
    expect(snapshot['updatedAtMs'], 1000);
  });

  test('periodic callback은 진화 완료 상태의 snapshot을 저장한다', () async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      config.worldDataStorageKey,
      _buildWorldData(evolutionGage: 99.99),
    );

    final Map<String, Object?> result =
        await HomeWidgetBackgroundRefreshService.runPeriodicRefresh(
      nowMs: 60 * 1000,
      randomProvider: (WorldDataLifecycleRandomEvent event) {
        if (event.reason == 'evolution_mutation') {
          return 1;
        }
        if (event.reason == 'evolution') {
          return 0;
        }
        return 1;
      },
      saveWidgetData: (_, __) async => true,
      updateWidget:
          ({String? androidName, String? qualifiedAndroidName}) async => true,
    );

    expect(result['evolved'], isTrue);
    final String? snapshotJson =
        prefs.getString(config.worldDataAuthoritativeSnapshotStorageKey);
    expect(snapshotJson, isNotNull);
    final Map<String, dynamic> snapshot =
        jsonDecode(snapshotJson!) as Map<String, dynamic>;
    expect(snapshot['characterKey'], 2);
    expect(snapshot['snapshotKind'], 'authoritativeAppState');
  });
}

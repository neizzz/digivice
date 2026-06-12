import 'dart:convert';

import 'package:digivice_virtual_bridge/home_widget/home_widget_background_refresh_service.dart';
import 'package:digivice_virtual_bridge/world_data/world_data_config.dart'
    as config;
import 'package:digivice_virtual_bridge/world_data/world_data_lifecycle_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

String _buildWorldData({
  int lastEcsSaved = 0,
  int state = config.characterStateIdle,
  int characterKey = 1,
  double evolutionGage = 0,
  Map<String, dynamic>? eggHatch,
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
              'state': state,
            },
            'render': <String, dynamic>{
              'textureKey': state == config.characterStateEgg
                  ? config.eggTextureKeyStart
                  : 1,
            },
            'eggHatch': <String, dynamic>{
              'hatchTime': 0,
              'hatchDurationMs': 0,
              'isReadyToHatch': false,
              'syringeCount': 0,
              'pendingCharacterKey': 0,
              ...?eggHatch,
            },
            'characterStatus': <String, dynamic>{
              'characterKey': characterKey,
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
      saveWidgetData: (String key, Object value) async {
        savedKeys.add(key);
        if (value is String) {
          expect(value, isNotEmpty);
        }
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
    expect(savedKeys, contains(config.snapshotPublishHistoryStorageKey));
    final List<dynamic> publishHistory = jsonDecode(
      prefs.getString(config.snapshotPublishHistoryStorageKey)!,
    ) as List<dynamic>;
    expect(publishHistory, hasLength(2));
    expect((publishHistory.last as Map<String, dynamic>)['snapshotSlot'],
        'authoritative');
    expect((publishHistory.last as Map<String, dynamic>)['success'], isTrue);
    expect(updatedWidgets, isNot(contains('HomeWidgetProvider')));
    expect(updatedWidgets, contains('HomeWidget1x1Provider'));
    expect(result['updated2x1'], 'skipped_manifest_disabled');
    expect(result['updated1x1'], isTrue);
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

  test('periodic callback은 부화 완료 lifecycle 결과를 authoritative snapshot으로 저장한다',
      () async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      config.worldDataStorageKey,
      _buildWorldData(
        state: config.characterStateEgg,
        characterKey: 0,
        eggHatch: <String, dynamic>{
          'hatchTime': 1000,
          'hatchDurationMs': 1000,
          'isReadyToHatch': true,
          'pendingCharacterKey': 22,
        },
      ),
    );
    final Map<String, Object> savedValues = <String, Object>{};

    final Map<String, Object?> result =
        await HomeWidgetBackgroundRefreshService.runPeriodicRefresh(
      nowMs: 2000,
      randomProvider: (_) => 1,
      saveWidgetData: (String key, Object value) async {
        savedValues[key] = value;
        return true;
      },
      updateWidget:
          ({String? androidName, String? qualifiedAndroidName}) async => true,
    );

    expect(result['hatched'], isTrue);
    expect(result['selectedCharacterKey'], 22);
    final String? snapshotJson =
        prefs.getString(config.worldDataAuthoritativeSnapshotStorageKey);
    expect(snapshotJson, isNotNull);
    final Map<String, dynamic> snapshot =
        jsonDecode(snapshotJson!) as Map<String, dynamic>;
    expect(snapshot['snapshotKind'], 'authoritativeAppState');
    expect(snapshot['characterState'], 'idle');
    expect(snapshot['characterKey'], 22);
    expect(snapshot['eggCrackStage'], 0);

    final List<String> savedSnapshotJson = <String>[
      savedValues[config.worldDataSnapshotStorageKey] as String,
      savedValues[config.worldDataAuthoritativeSnapshotStorageKey] as String,
      savedValues[config.nativeWorldDataSnapshotKey] as String,
      savedValues[config.nativeWorldDataAuthoritativeSnapshotKey] as String,
    ];
    expect(
      savedSnapshotJson
          .map((String value) => jsonDecode(value) as Map<String, dynamic>)
          .map((Map<String, dynamic> value) => value['characterKey']),
      everyElement(22),
    );
    expect(savedValues[config.refreshInFlightKey], isFalse);
    expect(savedValues[config.refreshCompletedAtMsKey], 2000);
    expect(
      savedValues[config.refreshSmokeResultKey],
      allOf(<Matcher>[
        contains('reason=widget_periodic_refresh_authoritative'),
        contains('state=idle'),
        contains('key=22'),
        contains('kind=authoritativeAppState'),
        contains('hatched=true'),
        contains('selectedCharacterKey=22'),
        contains('hatchUsedPendingCharacterKey=true'),
        contains('hatchGreenProbability=65'),
        contains('hatchSoilProbability=20'),
        contains('hatchSkullProbability=15'),
      ]),
    );
    expect(
      savedValues[config.periodicRefreshStatusKey],
      worldDataLifecycleDefaultCompletedStatus,
    );
    expect(savedValues[config.periodicRefreshStatusAtMsKey], 2000);
  });

  test('periodic callback은 부화 roll과 확률을 refresh smoke result에 남긴다', () async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      config.worldDataStorageKey,
      _buildWorldData(
        state: config.characterStateEgg,
        characterKey: 0,
        eggHatch: <String, dynamic>{
          'hatchTime': 1000,
          'hatchDurationMs': 1000,
          'isReadyToHatch': true,
          'pendingCharacterKey': 0,
        },
      ),
    );
    final Map<String, Object> savedValues = <String, Object>{};

    final Map<String, Object?> result =
        await HomeWidgetBackgroundRefreshService.runPeriodicRefresh(
      nowMs: 2000,
      randomProvider: (WorldDataLifecycleRandomEvent event) {
        if (event.reason == 'hatch') {
          return 0.9;
        }
        return 1;
      },
      saveWidgetData: (String key, Object value) async {
        savedValues[key] = value;
        return true;
      },
      updateWidget:
          ({String? androidName, String? qualifiedAndroidName}) async => true,
    );

    expect(result['hatched'], isTrue);
    expect(result['selectedCharacterKey'],
        worldDataLifecycleSkullSlimeA1CharacterKey);
    expect(
      savedValues[config.refreshSmokeResultKey],
      allOf(<Matcher>[
        contains('hatched=true'),
        contains(
            'selectedCharacterKey=$worldDataLifecycleSkullSlimeA1CharacterKey'),
        contains('hatchUsedPendingCharacterKey=false'),
        contains('hatchRandom=0.9'),
        contains('hatchNormalizedRandom=0.9'),
        contains('hatchRollPercent=90.0'),
        contains('hatchGreenProbability=65'),
        contains('hatchSoilProbability=20'),
        contains('hatchSkullProbability=15'),
        contains('hatchStaleFoodCountAtHatch=0'),
        contains('hatchSyringeCount=0'),
      ]),
    );
  });

  test('periodic callback은 world data 누락 실패도 in-flight metadata를 닫는다',
      () async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final Map<String, Object> savedValues = <String, Object>{};

    final Map<String, Object?> result =
        await HomeWidgetBackgroundRefreshService.runPeriodicRefresh(
      nowMs: 2000,
      saveWidgetData: (String key, Object value) async {
        savedValues[key] = value;
        return true;
      },
      updateWidget:
          ({String? androidName, String? qualifiedAndroidName}) async => true,
    );

    expect(result['status'], 'flutter_periodic_missing_world_data');
    expect(result['error'], 'missing_world_data');
    expect(result['hasWorldData'], isFalse);
    expect(result['hasSnapshot'], isFalse);
    expect(prefs.getString(config.periodicRefreshStatusKey),
        'flutter_periodic_missing_world_data');
    expect(savedValues[config.periodicRefreshStatusKey],
        'flutter_periodic_missing_world_data');
    expect(savedValues[config.refreshInFlightKey], isFalse);
    expect(savedValues[config.refreshCompletedAtMsKey], 2000);
    expect(
      savedValues[config.refreshSmokeResultKey],
      allOf(<Matcher>[
        contains('status=flutter_periodic_missing_world_data'),
        contains('error=missing_world_data'),
        contains('hasWorldData=false'),
        contains('hasSnapshot=false'),
      ]),
    );
  });

  test('periodic callback은 native snapshot 저장 실패도 failure smoke로 기록한다',
      () async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString(config.worldDataStorageKey, _buildWorldData());
    final Map<String, Object> savedValues = <String, Object>{};

    final Map<String, Object?> result =
        await HomeWidgetBackgroundRefreshService.runPeriodicRefresh(
      nowMs: 2000,
      randomProvider: (_) => 1,
      saveWidgetData: (String key, Object value) async {
        savedValues[key] = value;
        return key != config.nativeWorldDataAuthoritativeSnapshotKey;
      },
      updateWidget:
          ({String? androidName, String? qualifiedAndroidName}) async => true,
    );

    expect(result['status'], 'flutter_periodic_snapshot_publish_failed');
    expect(result['error'],
        'snapshot_publish_failed:${config.nativeWorldDataAuthoritativeSnapshotKey}');
    expect(result['hasWorldData'], isTrue);
    expect(result['hasSnapshot'], isTrue);
    expect(savedValues[config.periodicRefreshStatusKey],
        'flutter_periodic_snapshot_publish_failed');
    expect(savedValues[config.refreshInFlightKey], isFalse);
    expect(savedValues[config.refreshCompletedAtMsKey], 2000);
    expect(
      savedValues[config.refreshSmokeResultKey],
      allOf(<Matcher>[
        contains('status=flutter_periodic_snapshot_publish_failed'),
        contains(
            'error=snapshot_publish_failed:${config.nativeWorldDataAuthoritativeSnapshotKey}'),
        contains('hasWorldData=true'),
        contains('hasSnapshot=true'),
      ]),
    );
  });
}

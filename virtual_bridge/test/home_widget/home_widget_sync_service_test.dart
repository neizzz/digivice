import 'dart:convert';

import 'package:digivice_virtual_bridge/home_widget/home_widget_sync_service.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

Map<String, dynamic> _buildWorldData({
  required int state,
  required double stamina,
  List<int> statuses = const <int>[],
  Map<String, dynamic>? appState,
  int? textureKey,
  int? lastEcsSaved,
  Map<String, dynamic>? eggHatch,
}) {
  return <String, dynamic>{
    'world_metadata': <String, dynamic>{
      'monster_name': 'MonTTo',
      if (lastEcsSaved != null) 'last_ecs_saved': lastEcsSaved,
      'app_state': <String, dynamic>{
        'use_local_time': false,
        'last_active_time': 123456,
        ...?appState,
      },
    },
    'entities': <Map<String, dynamic>>[
      <String, dynamic>{
        'components': <String, dynamic>{
          'object': <String, dynamic>{
            'type': 1,
            'state': state,
          },
          'render': <String, dynamic>{
            'textureKey': textureKey ?? 500,
          },
          'eggHatch': <String, dynamic>{
            'hatchTime': 0,
            'hatchDurationMs': 0,
            ...?eggHatch,
          },
          'characterStatus': <String, dynamic>{
            'characterKey': 1,
            'stamina': stamina,
            'statuses': statuses,
          },
        },
      },
    ],
  };
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const MethodChannel channel = MethodChannel('digivice/home_widget');
  late List<MethodCall> methodCalls;

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    methodCalls = <MethodCall>[];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (MethodCall call) async {
      methodCalls.add(call);

      switch (call.method) {
        case 'getLaunchContext':
          return <String, Object?>{'mode': 'widget_refresh'};
        case 'publishSnapshot':
          final Map<Object?, Object?> arguments =
              call.arguments as Map<Object?, Object?>;
          return <String, Object?>{
            'status': 'ok',
            'snapshotKey': arguments['snapshotKey'],
            'reason': arguments['reason'],
            'hasSnapshot': arguments['snapshotJson'] != null,
            'characterState': arguments['snapshotJson'] == null ? null : 'idle',
            'characterKey': arguments['snapshotJson'] == null ? null : 1,
            'eggHatchTimeMs': null,
            'snapshotKind': arguments['snapshotJson'] == null
                ? null
                : 'authoritativeAppState',
          };
      }

      return null;
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  group('HomeWidgetSyncService.buildSnapshotFromWorldDataJson', () {
    test('앱 저장 상태를 authoritative snapshot으로 그대로 반영한다', () {
      final snapshot = HomeWidgetSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(_buildWorldData(state: 2, stamina: 5.5)),
        now: DateTime(2026, 5, 19, 12),
      );

      expect(snapshot, isNotNull);
      expect(snapshot!.schemaVersion, 2);
      expect(
        snapshot.snapshotKind,
        HomeWidgetSnapshotKind.authoritativeAppState,
      );
      expect(snapshot.characterState, HomeWidgetCharacterState.moving);
      expect(snapshot.displayState, HomeWidgetDisplayState.idle);
      expect(snapshot.stamina, 5.5);
      expect(snapshot.staminaLevel, HomeWidgetStaminaLevel.orange);
      expect(snapshot.baseLastActiveTimeMs, 123456);
      expect(snapshot.projectedElapsedMs, 0);
      expect(snapshot.projectionVersion, 1);
      expect(snapshot.hasUrgentStatus, isFalse);
      expect(snapshot.visibleStatusIcons, isEmpty);
    });

    test('위젯 상태 아이콘은 sick/sleeping만 표시하고 temporary overlay는 제외한다', () {
      final sleepingSnapshot =
          HomeWidgetSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(
          _buildWorldData(
            state: 3,
            stamina: 8,
            statuses: <int>[2, 3, 4, 5],
          ),
        ),
        now: DateTime(2026, 5, 19, 12),
      );
      final sickSnapshot = HomeWidgetSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(_buildWorldData(state: 1, stamina: 2, statuses: <int>[3])),
        now: DateTime(2026, 5, 19, 12),
      );
      final discoverSnapshot =
          HomeWidgetSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(
            _buildWorldData(state: 1, stamina: 6, statuses: <int>[4, 5])),
        now: DateTime(2026, 5, 19, 12),
      );

      expect(sleepingSnapshot, isNotNull);
      expect(sleepingSnapshot!.displayState, HomeWidgetDisplayState.sleep);
      expect(
        sleepingSnapshot.visibleStatusIcons,
        <HomeWidgetStatusIcon>[
          HomeWidgetStatusIcon.sick,
          HomeWidgetStatusIcon.sleeping,
        ],
      );
      expect(sleepingSnapshot.hasUrgentStatus, isTrue);
      expect(sleepingSnapshot.staminaLevel, HomeWidgetStaminaLevel.green);

      expect(sickSnapshot, isNotNull);
      expect(sickSnapshot!.displayState, HomeWidgetDisplayState.sick);
      expect(
        sickSnapshot.visibleStatusIcons,
        <HomeWidgetStatusIcon>[HomeWidgetStatusIcon.sick],
      );
      expect(sickSnapshot.hasUrgentStatus, isFalse);
      expect(sickSnapshot.staminaLevel, HomeWidgetStaminaLevel.red);

      expect(discoverSnapshot, isNotNull);
      expect(discoverSnapshot!.displayState, HomeWidgetDisplayState.idle);
      expect(discoverSnapshot.visibleStatusIcons, isEmpty);
    });

    test('알 상태면 현재 egg texture key를 snapshot에 보존한다', () {
      final snapshot = HomeWidgetSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(_buildWorldData(state: 0, stamina: 10, textureKey: 517)),
        now: DateTime(2026, 5, 19, 12),
      );

      expect(snapshot, isNotNull);
      expect(snapshot!.characterState, HomeWidgetCharacterState.egg);
      expect(snapshot.eggTextureKey, 517);
    });

    test('dead 상태면 상태 아이콘을 모두 숨긴다', () {
      final snapshot = HomeWidgetSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(
          _buildWorldData(state: 6, stamina: 0, statuses: <int>[3, 4, 5]),
        ),
        now: DateTime(2026, 5, 19, 12),
      );

      expect(snapshot, isNotNull);
      expect(snapshot!.characterState, HomeWidgetCharacterState.dead);
      expect(snapshot.visibleStatusIcons, isEmpty);
    });

    test('알 상태면 부화 진행도에 따라 crack stage를 계산한다', () {
      final now = DateTime(2026, 5, 19, 12, 0, 0);
      final snapshot = HomeWidgetSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(
          _buildWorldData(
            state: 0,
            stamina: 10,
            textureKey: 517,
            eggHatch: <String, dynamic>{
              'hatchTime': now.millisecondsSinceEpoch + 10 * 60 * 1000,
              'hatchDurationMs': 40 * 60 * 1000,
            },
          ),
        ),
        now: now,
      );

      expect(snapshot, isNotNull);
      expect(snapshot!.eggCrackStage, 3);
      expect(snapshot.eggHatchDurationMs, 40 * 60 * 1000);
    });
  });

  group('HomeWidgetSyncService.selectWorldDataForSync', () {
    test('저장본만 있으면 Flutter 저장본을 선택한다', () {
      final String stored = jsonEncode(
        _buildWorldData(state: 1, stamina: 6, lastEcsSaved: 100),
      );

      final HomeWidgetSyncWorldDataSelection selection =
          HomeWidgetSyncService.selectWorldDataForSync(
        storedRawWorldData: stored,
        inMemoryRawWorldData: null,
      );

      expect(selection.source, HomeWidgetSyncWorldDataSource.stored);
      expect(selection.sourceName, 'stored');
      expect(selection.selectedRawWorldData, stored);
      expect(selection.storedLastEcsSaved, 100);
      expect(selection.inMemoryLastEcsSaved, isNull);
    });

    test('in-memory만 있으면 in-memory를 선택한다', () {
      final String inMemory = jsonEncode(
        _buildWorldData(state: 1, stamina: 6, lastEcsSaved: 200),
      );

      final HomeWidgetSyncWorldDataSelection selection =
          HomeWidgetSyncService.selectWorldDataForSync(
        storedRawWorldData: null,
        inMemoryRawWorldData: inMemory,
      );

      expect(selection.source, HomeWidgetSyncWorldDataSource.inMemory);
      expect(selection.sourceName, 'in_memory');
      expect(selection.selectedRawWorldData, inMemory);
      expect(selection.storedLastEcsSaved, isNull);
      expect(selection.inMemoryLastEcsSaved, 200);
    });

    test('in-memory가 더 최신이면 in-memory를 선택한다', () {
      final String stored = jsonEncode(
        _buildWorldData(state: 1, stamina: 6, lastEcsSaved: 300),
      );
      final String inMemory = jsonEncode(
        _buildWorldData(state: 3, stamina: 8, lastEcsSaved: 350),
      );

      final HomeWidgetSyncWorldDataSelection selection =
          HomeWidgetSyncService.selectWorldDataForSync(
        storedRawWorldData: stored,
        inMemoryRawWorldData: inMemory,
      );

      expect(selection.source, HomeWidgetSyncWorldDataSource.inMemory);
      expect(selection.selectedRawWorldData, inMemory);
      expect(selection.storedLastEcsSaved, 300);
      expect(selection.inMemoryLastEcsSaved, 350);
    });

    test('저장본 hatch 완료는 stale in-memory egg보다 우선한다', () {
      final String stored = jsonEncode(
        _buildWorldData(state: 1, stamina: 6, lastEcsSaved: 400),
      );
      final String inMemory = jsonEncode(
        _buildWorldData(state: 0, stamina: 10, lastEcsSaved: 450),
      );

      final HomeWidgetSyncWorldDataSelection selection =
          HomeWidgetSyncService.selectWorldDataForSync(
        storedRawWorldData: stored,
        inMemoryRawWorldData: inMemory,
      );

      expect(selection.source, HomeWidgetSyncWorldDataSource.stored);
      expect(selection.selectedRawWorldData, stored);
      expect(selection.storedLastEcsSaved, 400);
      expect(selection.inMemoryLastEcsSaved, 450);
    });
  });

  group('HomeWidgetSyncService.progressSnapshot', () {
    test('refresh는 widget_progressed snapshot으로 deterministic progression 한다',
        () {
      final authoritativeSnapshot =
          HomeWidgetSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(_buildWorldData(state: 1, stamina: 8)),
        now: DateTime(2026, 5, 19, 12, 0, 0),
      )!;

      final firstProgressed = HomeWidgetSyncService.progressSnapshot(
        authoritativeSnapshot,
        now: DateTime(2026, 5, 19, 12, 12, 0),
      );
      final secondProgressed = HomeWidgetSyncService.progressSnapshot(
        firstProgressed!,
        now: DateTime(2026, 5, 19, 12, 24, 0),
      );

      expect(
        firstProgressed.snapshotKind,
        HomeWidgetSnapshotKind.widgetProgressed,
      );
      expect(firstProgressed.projectedElapsedMs, 12 * 60 * 1000);
      expect(firstProgressed.stamina, closeTo(7.75, 0.0001));
      expect(firstProgressed.staminaLevel, HomeWidgetStaminaLevel.green);
      expect(firstProgressed.hasUrgentStatus, isFalse);

      expect(secondProgressed, isNotNull);
      expect(secondProgressed!.projectedElapsedMs, 24 * 60 * 1000);
      expect(secondProgressed.stamina, closeTo(7.5, 0.0001));
      expect(secondProgressed.staminaLevel, HomeWidgetStaminaLevel.green);
      expect(secondProgressed.hasUrgentStatus, isFalse);
    });

    test('sleeping 상태는 더 느리게 stamina가 감소한다', () {
      final sleepingSnapshot =
          HomeWidgetSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(_buildWorldData(state: 3, stamina: 8)),
        now: DateTime(2026, 5, 19, 12, 0, 0),
      )!;

      final progressed = HomeWidgetSyncService.progressSnapshot(
        sleepingSnapshot,
        now: DateTime(2026, 5, 19, 13, 0, 0),
      );

      expect(progressed, isNotNull);
      expect(progressed!.displayState, HomeWidgetDisplayState.sleep);
      expect(progressed.stamina, closeTo(7.75, 0.0001));
      expect(
        progressed.visibleStatusIcons,
        contains(HomeWidgetStatusIcon.sleeping),
      );
    });
  });

  group('HomeWidgetSyncService bridge completion', () {
    test('launch mode를 native bridge에서 읽는다', () async {
      final String mode = await HomeWidgetSyncService.getLaunchMode();

      expect(mode, widgetRefreshLaunchMode);
      expect(methodCalls.single.method, 'getLaunchContext');
    });

    test('syncFromStorageOrWorldDataJson은 Flutter 저장본 기준 선택 결과를 반환한다',
        () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        worldDataStorageKey: jsonEncode(
          _buildWorldData(state: 1, stamina: 6, lastEcsSaved: 500),
        ),
      });

      final Map<String, Object?> result =
          await HomeWidgetSyncService.syncFromStorageOrWorldDataJson(
        inMemoryRawWorldData: jsonEncode(
          _buildWorldData(state: 0, stamina: 10, lastEcsSaved: 550),
        ),
        reason: 'widget_refresh_storage_selection_test',
      );

      expect(result['status'], 'synced');
      expect(result['selectedSource'], 'stored');
      expect(result['storedLastEcsSaved'], 500);
      expect(result['inMemoryLastEcsSaved'], 550);
      expect(result['characterState'], 'idle');
    });

    test('syncFromWorldDataJson은 두 native publish 완료 후 결과를 반환한다', () async {
      final Map<String, Object?> result =
          await HomeWidgetSyncService.syncFromWorldDataJson(
        rawWorldData: jsonEncode(_buildWorldData(state: 1, stamina: 6)),
        reason: 'widget_refresh_test',
      );

      expect(result['status'], 'synced');
      expect(result['characterState'], 'idle');
      expect(result['currentPublishStatus'], 'ok');
      expect(result['authoritativePublishStatus'], 'ok');

      final List<MethodCall> publishCalls = methodCalls
          .where((MethodCall call) => call.method == 'publishSnapshot')
          .toList();

      expect(publishCalls, hasLength(2));
      expect(
        (publishCalls.first.arguments as Map<Object?, Object?>)['reason'],
        'widget_refresh_test',
      );
      expect(
        (publishCalls.last.arguments as Map<Object?, Object?>)['reason'],
        'widget_refresh_test_authoritative',
      );
    });

    test('world data가 없으면 cleared 결과와 함께 native snapshot 둘 다 비운다', () async {
      final Map<String, Object?> result =
          await HomeWidgetSyncService.syncFromWorldDataJson(
        rawWorldData: null,
        reason: 'widget_refresh_empty',
      );

      expect(result['status'], 'cleared');
      expect(result['hasSnapshot'], isFalse);
      expect(result['currentPublishStatus'], 'ok');
      expect(result['authoritativePublishStatus'], 'ok');

      final List<MethodCall> publishCalls = methodCalls
          .where((MethodCall call) => call.method == 'publishSnapshot')
          .toList();

      expect(publishCalls, hasLength(2));
      expect(
        (publishCalls.first.arguments as Map<Object?, Object?>)['snapshotJson'],
        isNull,
      );
      expect(
        (publishCalls.last.arguments as Map<Object?, Object?>)['snapshotJson'],
        isNull,
      );
    });
  });
}

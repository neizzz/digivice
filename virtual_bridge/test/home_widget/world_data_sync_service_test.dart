import 'dart:convert';

import 'package:digivice_virtual_bridge/home_widget/world_data_sync_service.dart';
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

  group('WorldDataSyncService.buildSnapshotFromWorldDataJson', () {
    test('앱 저장 상태를 authoritative snapshot으로 그대로 반영한다', () {
      final snapshot = WorldDataSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(_buildWorldData(state: 2, stamina: 5.5)),
        now: DateTime(2026, 5, 19, 12),
      );

      expect(snapshot, isNotNull);
      expect(snapshot!.schemaVersion, 2);
      expect(
        snapshot.snapshotKind,
        WorldDataSnapshotKind.authoritativeAppState,
      );
      expect(snapshot.characterState, WorldDataCharacterState.moving);
      expect(snapshot.displayState, WorldDataDisplayState.idle);
      expect(snapshot.stamina, 5.5);
      expect(snapshot.staminaLevel, WorldDataStaminaLevel.orange);
      expect(snapshot.baseLastActiveTimeMs, 123456);
      expect(snapshot.projectedElapsedMs, 0);
      expect(snapshot.projectionVersion, 1);
      expect(snapshot.hasUrgentStatus, isFalse);
      expect(snapshot.visibleStatusIcons, isEmpty);
    });

    test('위젯 상태 아이콘은 sick/sleeping만 표시하고 temporary overlay는 제외한다', () {
      final sleepingSnapshot =
          WorldDataSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(
          _buildWorldData(
            state: 3,
            stamina: 8,
            statuses: <int>[2, 3, 4, 5],
          ),
        ),
        now: DateTime(2026, 5, 19, 12),
      );
      final sickSnapshot = WorldDataSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(_buildWorldData(state: 1, stamina: 2, statuses: <int>[3])),
        now: DateTime(2026, 5, 19, 12),
      );
      final discoverSnapshot =
          WorldDataSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(
            _buildWorldData(state: 1, stamina: 6, statuses: <int>[4, 5])),
        now: DateTime(2026, 5, 19, 12),
      );

      expect(sleepingSnapshot, isNotNull);
      expect(sleepingSnapshot!.displayState, WorldDataDisplayState.sleep);
      expect(
        sleepingSnapshot.visibleStatusIcons,
        <WorldDataStatusIcon>[
          WorldDataStatusIcon.sick,
          WorldDataStatusIcon.sleeping,
        ],
      );
      expect(sleepingSnapshot.hasUrgentStatus, isTrue);
      expect(sleepingSnapshot.staminaLevel, WorldDataStaminaLevel.green);

      expect(sickSnapshot, isNotNull);
      expect(sickSnapshot!.displayState, WorldDataDisplayState.sick);
      expect(
        sickSnapshot.visibleStatusIcons,
        <WorldDataStatusIcon>[WorldDataStatusIcon.sick],
      );
      expect(sickSnapshot.hasUrgentStatus, isFalse);
      expect(sickSnapshot.staminaLevel, WorldDataStaminaLevel.red);

      expect(discoverSnapshot, isNotNull);
      expect(discoverSnapshot!.displayState, WorldDataDisplayState.idle);
      expect(discoverSnapshot.visibleStatusIcons, isEmpty);
    });

    test('알 상태면 현재 egg texture key를 snapshot에 보존한다', () {
      final snapshot = WorldDataSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(_buildWorldData(state: 0, stamina: 10, textureKey: 517)),
        now: DateTime(2026, 5, 19, 12),
      );

      expect(snapshot, isNotNull);
      expect(snapshot!.characterState, WorldDataCharacterState.egg);
      expect(snapshot.eggTextureKey, 517);
    });

    test('dead 상태면 상태 아이콘을 모두 숨긴다', () {
      final snapshot = WorldDataSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(
          _buildWorldData(state: 6, stamina: 0, statuses: <int>[3, 4, 5]),
        ),
        now: DateTime(2026, 5, 19, 12),
      );

      expect(snapshot, isNotNull);
      expect(snapshot!.characterState, WorldDataCharacterState.dead);
      expect(snapshot.visibleStatusIcons, isEmpty);
    });

    test('알 상태면 부화 진행도에 따라 crack stage를 계산한다', () {
      final now = DateTime(2026, 5, 19, 12, 0, 0);
      final snapshot = WorldDataSyncService.buildSnapshotFromWorldDataJson(
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

  group('WorldDataSyncService.selectWorldDataForSync', () {
    test('저장본만 있으면 Flutter 저장본을 선택한다', () {
      final String stored = jsonEncode(
        _buildWorldData(state: 1, stamina: 6, lastEcsSaved: 100),
      );

      final WorldDataSyncSelection selection =
          WorldDataSyncService.selectWorldDataForSync(
        storedRawWorldData: stored,
        inMemoryRawWorldData: null,
      );

      expect(selection.source, WorldDataSyncSource.stored);
      expect(selection.sourceName, 'stored');
      expect(selection.selectedRawWorldData, stored);
      expect(selection.storedLastEcsSaved, 100);
      expect(selection.inMemoryLastEcsSaved, isNull);
    });

    test('in-memory만 있으면 in-memory를 선택한다', () {
      final String inMemory = jsonEncode(
        _buildWorldData(state: 1, stamina: 6, lastEcsSaved: 200),
      );

      final WorldDataSyncSelection selection =
          WorldDataSyncService.selectWorldDataForSync(
        storedRawWorldData: null,
        inMemoryRawWorldData: inMemory,
      );

      expect(selection.source, WorldDataSyncSource.inMemory);
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

      final WorldDataSyncSelection selection =
          WorldDataSyncService.selectWorldDataForSync(
        storedRawWorldData: stored,
        inMemoryRawWorldData: inMemory,
      );

      expect(selection.source, WorldDataSyncSource.inMemory);
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

      final WorldDataSyncSelection selection =
          WorldDataSyncService.selectWorldDataForSync(
        storedRawWorldData: stored,
        inMemoryRawWorldData: inMemory,
      );

      expect(selection.source, WorldDataSyncSource.stored);
      expect(selection.selectedRawWorldData, stored);
      expect(selection.storedLastEcsSaved, 400);
      expect(selection.inMemoryLastEcsSaved, 450);
    });
  });

  group('WorldDataSyncService.progressSnapshot', () {
    test('refresh는 widget_progressed snapshot으로 deterministic progression 한다',
        () {
      final authoritativeSnapshot =
          WorldDataSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(_buildWorldData(state: 1, stamina: 8)),
        now: DateTime(2026, 5, 19, 12, 0, 0),
      )!;

      final firstProgressed = WorldDataSyncService.progressSnapshot(
        authoritativeSnapshot,
        now: DateTime(2026, 5, 19, 12, 12, 0),
      );
      final secondProgressed = WorldDataSyncService.progressSnapshot(
        firstProgressed!,
        now: DateTime(2026, 5, 19, 12, 24, 0),
      );

      expect(
        firstProgressed.snapshotKind,
        WorldDataSnapshotKind.widgetProgressed,
      );
      expect(firstProgressed.projectedElapsedMs, 12 * 60 * 1000);
      expect(firstProgressed.stamina, closeTo(7.75, 0.0001));
      expect(firstProgressed.staminaLevel, WorldDataStaminaLevel.green);
      expect(firstProgressed.hasUrgentStatus, isFalse);

      expect(secondProgressed, isNotNull);
      expect(secondProgressed!.projectedElapsedMs, 24 * 60 * 1000);
      expect(secondProgressed.stamina, closeTo(7.5, 0.0001));
      expect(secondProgressed.staminaLevel, WorldDataStaminaLevel.green);
      expect(secondProgressed.hasUrgentStatus, isFalse);
      expect(
        secondProgressed.animationFrameIndex,
        (DateTime(2026, 5, 19, 12, 24, 0).millisecondsSinceEpoch ~/ 1000 +
                (secondProgressed.characterKey ?? 0)) %
            4,
      );
    });

    test('sleeping 상태는 더 느리게 stamina가 감소한다', () {
      final sleepingSnapshot =
          WorldDataSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(_buildWorldData(state: 3, stamina: 8)),
        now: DateTime(2026, 5, 19, 12, 0, 0),
      )!;

      final progressed = WorldDataSyncService.progressSnapshot(
        sleepingSnapshot,
        now: DateTime(2026, 5, 19, 13, 0, 0),
      );

      expect(progressed, isNotNull);
      expect(progressed!.displayState, WorldDataDisplayState.sleep);
      expect(progressed.stamina, closeTo(7.75, 0.0001));
      expect(
        progressed.visibleStatusIcons,
        contains(WorldDataStatusIcon.sleeping),
      );
    });

    test('egg snapshot은 부화 완료를 직접 만들지 않고 crack stage만 projection한다', () {
      final now = DateTime(2026, 5, 19, 12, 0, 0);
      final authoritativeSnapshot =
          WorldDataSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(
          _buildWorldData(
            state: 0,
            stamina: 10,
            textureKey: 517,
            eggHatch: <String, dynamic>{
              'hatchTime':
                  now.add(const Duration(minutes: 40)).millisecondsSinceEpoch,
              'hatchDurationMs': 40 * 60 * 1000,
            },
          ),
        ),
        now: now,
      )!;

      final beforeHatch = WorldDataSyncService.progressSnapshot(
        authoritativeSnapshot,
        now: now.add(const Duration(minutes: 20)),
      );
      final afterHatchTime = WorldDataSyncService.progressSnapshot(
        beforeHatch!,
        now: now.add(const Duration(minutes: 41)),
      );

      expect(authoritativeSnapshot.eggCrackStage, 0);
      expect(beforeHatch.characterState, WorldDataCharacterState.egg);
      expect(beforeHatch.eggCrackStage, 2);
      expect(beforeHatch.projectedElapsedMs, 20 * 60 * 1000);
      expect(afterHatchTime, isNotNull);
      expect(afterHatchTime!.characterState, WorldDataCharacterState.egg);
      expect(
          afterHatchTime.snapshotKind, WorldDataSnapshotKind.widgetProgressed);
      expect(afterHatchTime.eggCrackStage, 3);
      expect(afterHatchTime.projectedElapsedMs, 41 * 60 * 1000);
    });

    test('authoritative refresh 후 projection 기준은 새 snapshot에서 다시 시작한다', () {
      final firstAuthoritative =
          WorldDataSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(_buildWorldData(state: 1, stamina: 8)),
        now: DateTime(2026, 5, 19, 12, 0, 0),
      )!;
      final progressed = WorldDataSyncService.progressSnapshot(
        firstAuthoritative,
        now: DateTime(2026, 5, 19, 12, 12, 0),
      )!;
      final refreshedAuthoritative =
          WorldDataSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(_buildWorldData(state: 1, stamina: 8.5)),
        now: DateTime(2026, 5, 19, 12, 12, 0),
      )!;
      final progressedAfterRefresh = WorldDataSyncService.progressSnapshot(
        refreshedAuthoritative,
        now: DateTime(2026, 5, 19, 12, 24, 0),
      )!;

      expect(progressed.snapshotKind, WorldDataSnapshotKind.widgetProgressed);
      expect(progressed.projectedElapsedMs, 12 * 60 * 1000);
      expect(
        refreshedAuthoritative.snapshotKind,
        WorldDataSnapshotKind.authoritativeAppState,
      );
      expect(refreshedAuthoritative.projectedElapsedMs, 0);
      expect(progressedAfterRefresh.projectedElapsedMs, 12 * 60 * 1000);
      expect(progressedAfterRefresh.stamina, closeTo(8.25, 0.0001));
    });
  });

  group('WorldDataSyncService bridge completion', () {
    test('launch mode를 native bridge에서 읽는다', () async {
      final String mode = await WorldDataSyncService.getLaunchMode();

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
          await WorldDataSyncService.syncFromStorageOrWorldDataJson(
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
          await WorldDataSyncService.syncFromWorldDataJson(
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
          await WorldDataSyncService.syncFromWorldDataJson(
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

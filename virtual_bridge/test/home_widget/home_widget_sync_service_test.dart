import 'dart:convert';

import 'package:digivice_virtual_bridge/home_widget/home_widget_sync_service.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _buildWorldData({
  required int state,
  required double stamina,
  List<int> statuses = const <int>[],
  Map<String, dynamic>? appState,
  int? textureKey,
  Map<String, dynamic>? eggHatch,
}) {
  return <String, dynamic>{
    'world_metadata': <String, dynamic>{
      'monster_name': 'MonTTo',
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
}

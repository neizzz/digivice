import 'dart:convert';

import 'package:digivice_virtual_bridge/home_widget/home_widget_sync_service.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _buildWorldData({
  required int state,
  required double stamina,
  List<int> statuses = const <int>[],
  Map<String, dynamic>? appState,
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

    test('상태 아이콘은 persistent 전부 + latest overlay만 표시하고 urgent는 제외한다', () {
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

import 'dart:convert';

import 'package:digivice_virtual_bridge/world_data/world_data_sync_service.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _buildWorldData({
  required int state,
  required double stamina,
  List<int> statuses = const <int>[],
}) {
  return <String, dynamic>{
    'world_metadata': <String, dynamic>{
      'monster_name': 'MonTTo',
      'app_state': <String, dynamic>{'use_local_time': false},
    },
    'entities': <Map<String, dynamic>>[
      <String, dynamic>{
        'components': <String, dynamic>{
          'object': <String, dynamic>{'type': 1, 'state': state},
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
  group('WorldDataSyncService widget-only status filtering', () {
    test('discover 같은 temporary overlay는 위젯 아이콘에 포함하지 않는다', () {
      final snapshot = WorldDataSyncService.buildSnapshotFromWorldDataJson(
        jsonEncode(
            _buildWorldData(state: 1, stamina: 6, statuses: <int>[4, 5])),
        now: DateTime(2026, 5, 19, 12),
      );

      expect(snapshot, isNotNull);
      expect(snapshot!.displayState, WorldDataDisplayState.idle);
      expect(snapshot.visibleStatusIcons, isEmpty);
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
  });
}

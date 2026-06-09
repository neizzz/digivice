import 'dart:convert';

import 'package:digivice_virtual_bridge/home_widget/world_data_config.dart'
    as config;
import 'package:digivice_virtual_bridge/world_data/world_data_lifecycle_service.dart';
import 'package:digivice_virtual_bridge/world_data/world_data_update_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

String _buildWorldData({int lastEcsSaved = 0}) => jsonEncode(<String, dynamic>{
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
              'evolutionGage': 1.5,
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

  test(
      'completeNativeWorldDataUpdate는 Dart lifecycle 서비스를 직접 호출하고 MonsterBookData를 저장한다',
      () async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString(config.worldDataStorageKey, _buildWorldData());

    final Map<String, Object?> result =
        await WorldDataUpdateService.completeNativeWorldDataUpdate(
      source: 'app_resume',
      nowMs: 60 * 1000,
      randomProvider: (_) => 1,
    );

    expect(result['status'], worldDataLifecycleDefaultCompletedStatus);
    expect(result['source'], 'app_resume');
    expect(result['worldDataChanged'], isTrue);
    expect(result['hatched'], isFalse);
    expect(result['evolutionGageBefore'], 1.5);
    expect(result['evolutionGageAfter'], greaterThan(1.5));
    expect(prefs.getString(config.worldDataStorageKey), isNotNull);
    expect(prefs.getString(config.worldDataAuthoritativeSnapshotStorageKey),
        isNotNull);
    expect(prefs.getString(config.monsterBookStorageKey), isNotNull);
    expect(result['monsterBookWriteOwner'], 'flutter_lifecycle');
  });

  test('completeNativeWorldDataUpdate는 기존 MonsterBookData를 병합해 보존한다', () async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      config.monsterBookStorageKey,
      jsonEncode(<String, dynamic>{
        'reached': <String, dynamic>{
          '1': <Map<String, dynamic>>[
            <String, dynamic>{
              'name': '기존',
              'reached_at': 100,
              'object_id': 1,
              'source': 'hatch',
            },
          ],
        },
      }),
    );
    await prefs.setString(config.worldDataStorageKey, _buildWorldData());

    await WorldDataUpdateService.completeNativeWorldDataUpdate(
      source: 'app_resume',
      nowMs: 60 * 1000,
      randomProvider: (_) => 1,
    );

    final String? rawMonsterBook =
        prefs.getString(config.monsterBookStorageKey);
    expect(rawMonsterBook, isNotNull);
    final Map<String, dynamic> monsterBook =
        jsonDecode(rawMonsterBook!) as Map<String, dynamic>;
    expect((monsterBook['reached'] as Map<String, dynamic>)['1'], hasLength(1));
  });

  test('world data가 없으면 실패 상태를 반환한다', () async {
    final Map<String, Object?> result =
        await WorldDataUpdateService.completeNativeWorldDataUpdate(
      source: 'app_resume',
      nowMs: 60 * 1000,
    );

    expect(result['status'], 'flutter_world_data_update_failed');
    expect(result['error'], 'missing_world_data');
  });
}

import 'dart:convert';

import 'package:digivice_virtual_bridge/home_widget/world_data_config.dart'
    as config;
import 'package:digivice_virtual_bridge/world_data/world_data_lifecycle_service.dart';
import 'package:digivice_virtual_bridge/world_data/world_data_update_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

String _buildWorldData({
  int lastEcsSaved = 0,
  int state = config.characterStateIdle,
  int characterKey = 1,
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
            'characterStatus': <String, dynamic>{
              'characterKey': characterKey,
              'stamina': 10,
              'evolutionGage': 1.5,
              'statuses': <int>[],
            },
            'eggHatch': <String, dynamic>{
              'hatchTime': 0,
              'hatchDurationMs': 0,
              'isReadyToHatch': false,
              'syringeCount': 0,
              'pendingCharacterKey': 0,
              ...?eggHatch,
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

  test('foreground_hatch source는 Dart lifecycle 부화 진단과 저장본을 반환한다', () async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    var syncCallCount = 0;
    String? syncedRawWorldData;
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

    final Map<String, Object?> result =
        await WorldDataUpdateService.completeNativeWorldDataUpdate(
      source: worldDataLifecycleForegroundHatchSource,
      nowMs: 2000,
      randomProvider: (_) => 1,
      syncSnapshotPublisher: ({
        required String? rawWorldData,
        String reason = 'manual',
        void Function(String message)? log,
      }) async {
        syncCallCount += 1;
        syncedRawWorldData = rawWorldData;

        final Map<String, dynamic> decoded =
            jsonDecode(rawWorldData!) as Map<String, dynamic>;
        final Map<String, dynamic> components =
            ((decoded['entities'] as List<dynamic>).single
                as Map<String, dynamic>)['components'] as Map<String, dynamic>;
        final Map<String, dynamic> object =
            components['object'] as Map<String, dynamic>;
        final Map<String, dynamic> characterStatus =
            components['characterStatus'] as Map<String, dynamic>;

        return <String, Object?>{
          'status': 'synced',
          'reason': reason,
          'hasWorldData': true,
          'hasSnapshot': true,
          'characterState': 'idle',
          'characterKey': characterStatus['characterKey'],
          'currentPublishStatus': 'ok',
          'authoritativePublishStatus': 'ok',
          'verifiedRawState': object['state'],
        };
      },
    );
    final Map<String, Object?> diagnostics =
        result['hatchSelectionDiagnostics'] as Map<String, Object?>;

    expect(result['status'], worldDataLifecycleDefaultCompletedStatus);
    expect(result['source'], worldDataLifecycleForegroundHatchSource);
    expect(result['hatched'], isTrue);
    expect(result['selectedCharacterKey'], 22);
    expect(diagnostics['selectedCharacterKey'], 22);
    expect(diagnostics['usedPendingCharacterKey'], isTrue);
    expect(result['updatedRawWorldData'], isA<String>());
    expect(prefs.getString(config.worldDataStorageKey), contains('"state":1'));
    expect(syncCallCount, 1);
    expect(syncedRawWorldData, result['updatedRawWorldData']);
    expect(syncedRawWorldData, contains('"state":1'));
    expect(result['homeWidgetSyncStatus'], 'synced');
    expect(result['homeWidgetCurrentPublishStatus'], 'ok');
    expect(result['homeWidgetAuthoritativePublishStatus'], 'ok');
    expect(result['homeWidgetSyncedCharacterState'], 'idle');
    expect(result['homeWidgetSyncedCharacterKey'], 22);
  });

  test('world data가 없으면 실패 상태를 반환한다', () async {
    var syncCallCount = 0;
    final Map<String, Object?> result =
        await WorldDataUpdateService.completeNativeWorldDataUpdate(
      source: 'app_resume',
      nowMs: 60 * 1000,
      syncSnapshotPublisher: ({
        required String? rawWorldData,
        String reason = 'manual',
        void Function(String message)? log,
      }) async {
        syncCallCount += 1;
        return <String, Object?>{'status': 'unexpected'};
      },
    );

    expect(result['status'], 'flutter_world_data_update_failed');
    expect(result['error'], 'missing_world_data');
    expect(syncCallCount, 0);
  });
}

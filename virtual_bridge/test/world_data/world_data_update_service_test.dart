import 'dart:convert';

import 'package:digivice_virtual_bridge/world_data/world_data_config.dart'
    as config;
import 'package:digivice_virtual_bridge/world_data/world_data_lifecycle_service.dart';
import 'package:digivice_virtual_bridge/world_data/world_data_update_service.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

String _buildWorldData({
  int lastEcsSaved = 0,
  int state = config.characterStateIdle,
  int characterKey = 1,
  List<int> statuses = const <int>[],
  int sickStartTime = 0,
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
              'statuses': statuses,
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
              'sickStartTime': sickStartTime,
            },
          },
        },
      ],
    });

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

      if (call.method == 'publishSnapshot') {
        final Map<Object?, Object?> arguments =
            call.arguments as Map<Object?, Object?>;
        final String? snapshotJson = arguments['snapshotJson'] as String?;
        final Map<String, dynamic>? snapshot = snapshotJson == null
            ? null
            : jsonDecode(snapshotJson) as Map<String, dynamic>;
        return <String, Object?>{
          'status': 'ok',
          'snapshotKey': arguments['snapshotKey'],
          'reason': arguments['reason'],
          'hasSnapshot': snapshotJson != null,
          'characterState': snapshot?['characterState'],
          'characterKey': snapshot?['characterKey'],
          'eggHatchTimeMs': snapshot?['eggHatchTimeMs'],
          'snapshotKind': snapshot?['snapshotKind'],
        };
      }

      return null;
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
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
    expect(result['homeWidgetSyncStatus'], 'synced');
    expect(result['homeWidgetAuthoritativePublishStatus'], 'ok');
    expect(
      (result['inputWorldDataDiagnostics']
          as Map<String, Object?>)['hasSickStatus'],
      isFalse,
    );
    expect(
      (result['updatedWorldDataDiagnostics']
          as Map<String, Object?>)['hasSickStatus'],
      isFalse,
    );
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

  test('completeNativeWorldDataUpdate는 sick 상태와 snapshot 아이콘을 보존한다', () async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      config.worldDataStorageKey,
      _buildWorldData(
        state: config.characterStateMoving,
        statuses: const <int>[config.characterStatusSick],
        sickStartTime: 1234,
      ),
    );

    final Map<String, Object?> result =
        await WorldDataUpdateService.completeNativeWorldDataUpdate(
      source: 'app_resume',
      nowMs: 60 * 1000,
      randomProvider: (_) => 1,
    );

    final Map<String, dynamic> updated = jsonDecode(
      prefs.getString(config.worldDataStorageKey)!,
    ) as Map<String, dynamic>;
    final Map<String, dynamic> components =
        ((updated['entities'] as List<dynamic>).single
            as Map<String, dynamic>)['components'] as Map<String, dynamic>;
    final Map<String, dynamic> snapshot = jsonDecode(
      prefs.getString(config.worldDataAuthoritativeSnapshotStorageKey)!,
    ) as Map<String, dynamic>;

    final Map<String, Object?> inputDiagnostics =
        result['inputWorldDataDiagnostics'] as Map<String, Object?>;
    final Map<String, Object?> updatedDiagnostics =
        result['updatedWorldDataDiagnostics'] as Map<String, Object?>;

    expect(result['sickStatusDiagnostics'], isA<Map<String, Object?>>());
    expect(inputDiagnostics['characterState'], config.characterStateMoving);
    expect(inputDiagnostics['statuses'], contains(config.characterStatusSick));
    expect(inputDiagnostics['hasSickStatus'], isTrue);
    expect(inputDiagnostics['sickStartTime'], 1234);
    expect(inputDiagnostics['worldDataLength'], greaterThan(0));
    expect(inputDiagnostics['worldDataChecksum'], isA<String>());
    expect(updatedDiagnostics['characterState'], config.characterStateSick);
    expect(
        updatedDiagnostics['statuses'], contains(config.characterStatusSick));
    expect(updatedDiagnostics['hasSickStatus'], isTrue);
    expect(updatedDiagnostics['sickStartTime'], 1234);
    expect((components['object'] as Map<String, dynamic>)['state'],
        config.characterStateSick);
    expect(
      (components['characterStatus'] as Map<String, dynamic>)['statuses'],
      contains(config.characterStatusSick),
    );
    expect(
      (components['diseaseSystem'] as Map<String, dynamic>)['sickStartTime'],
      1234,
    );
    expect(snapshot['displayState'], 'sick');
    expect(snapshot['visibleStatusIcons'], contains('sick'));
  });

  test('foreground_hatch source는 Dart lifecycle 부화 진단과 저장본을 반환한다', () async {
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

    final Map<String, Object?> result =
        await WorldDataUpdateService.completeNativeWorldDataUpdate(
      source: worldDataLifecycleForegroundHatchSource,
      nowMs: 2000,
      randomProvider: (_) => 1,
    );
    final Map<String, Object?> diagnostics =
        result['hatchSelectionDiagnostics'] as Map<String, Object?>;
    final List<MethodCall> publishCalls = methodCalls
        .where((MethodCall call) => call.method == 'publishSnapshot')
        .toList();

    expect(result['status'], worldDataLifecycleDefaultCompletedStatus);
    expect(result['source'], worldDataLifecycleForegroundHatchSource);
    expect(result['hatched'], isTrue);
    expect(result['selectedCharacterKey'], 22);
    expect(diagnostics['selectedCharacterKey'], 22);
    expect(diagnostics['usedPendingCharacterKey'], isTrue);
    expect(result['updatedRawWorldData'], isA<String>());
    expect(prefs.getString(config.worldDataStorageKey), contains('"state":1'));
    expect(result['homeWidgetSyncStatus'], 'synced');
    expect(result['homeWidgetAuthoritativePublishStatus'], 'ok');
    expect(publishCalls, hasLength(2));
    expect(
      (publishCalls.last.arguments as Map<Object?, Object?>)['snapshotKey'],
      config.nativeWorldDataAuthoritativeSnapshotKey,
    );
    expect(
      (publishCalls.last.arguments as Map<Object?, Object?>)['reason'],
      '${worldDataLifecycleForegroundHatchSource}_native_world_data_update_authoritative',
    );
  });

  test('widget_periodic_refresh source는 부화 시간이 지난 egg를 idle snapshot으로 저장한다',
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

    final Map<String, Object?> result =
        await WorldDataUpdateService.completeNativeWorldDataUpdate(
      source: worldDataLifecycleWidgetPeriodicRefreshSource,
      nowMs: 2000,
      randomProvider: (_) => 1,
    );

    final String? rawStoredWorldData =
        prefs.getString(config.worldDataStorageKey);
    expect(rawStoredWorldData, isNotNull);
    final Map<String, dynamic> storedWorldData =
        jsonDecode(rawStoredWorldData!) as Map<String, dynamic>;
    final Map<String, dynamic> storedComponents =
        ((storedWorldData['entities'] as List<dynamic>).single
            as Map<String, dynamic>)['components'] as Map<String, dynamic>;
    final Map<String, dynamic> storedObject =
        storedComponents['object'] as Map<String, dynamic>;

    final String? rawCurrentSnapshot =
        prefs.getString(config.worldDataSnapshotStorageKey);
    final String? rawAuthoritativeSnapshot =
        prefs.getString(config.worldDataAuthoritativeSnapshotStorageKey);
    expect(rawCurrentSnapshot, isNotNull);
    expect(rawAuthoritativeSnapshot, isNotNull);

    final Map<String, dynamic> currentSnapshot =
        jsonDecode(rawCurrentSnapshot!) as Map<String, dynamic>;
    final Map<String, dynamic> authoritativeSnapshot =
        jsonDecode(rawAuthoritativeSnapshot!) as Map<String, dynamic>;

    expect(result['hatched'], isTrue);
    expect(result['selectedCharacterKey'], 22);
    expect(result['homeWidgetSyncStatus'], 'synced');
    expect(result['homeWidgetAuthoritativePublishStatus'], 'ok');
    expect(storedObject['state'], config.characterStateIdle);

    for (final Map<String, dynamic> snapshot in <Map<String, dynamic>>[
      currentSnapshot,
      authoritativeSnapshot
    ]) {
      expect(snapshot['characterState'], 'idle');
      expect(snapshot['characterKey'], 22);
      expect(snapshot['snapshotKind'], 'authoritativeAppState');
    }

    for (final Map<String, dynamic> snapshot in <Map<String, dynamic>>[
      currentSnapshot,
      authoritativeSnapshot
    ]) {
      expect(snapshot['characterState'], 'idle');
      expect(snapshot['characterKey'], 22);
      expect(snapshot['eggHatchTimeMs'], isNull);
      expect(snapshot['eggHatchDurationMs'], isNull);
      expect(snapshot['eggCrackStage'], 0);
    }

    final List<MethodCall> publishCalls = methodCalls
        .where((MethodCall call) => call.method == 'publishSnapshot')
        .toList();
    expect(publishCalls, hasLength(2));
    final Map<String, dynamic> nativeAuthoritativeSnapshot = jsonDecode(
      (publishCalls.last.arguments as Map<Object?, Object?>)['snapshotJson']
          as String,
    ) as Map<String, dynamic>;
    expect(nativeAuthoritativeSnapshot['characterState'], 'idle');
    expect(nativeAuthoritativeSnapshot['characterKey'], 22);
    expect(nativeAuthoritativeSnapshot['eggHatchTimeMs'], isNull);
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

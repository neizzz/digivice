import 'dart:convert';

import 'package:digivice_virtual_bridge/world_data/world_data_config.dart'
    as config;
import 'package:digivice_virtual_bridge/world_data/world_data_update_controller.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:webview_flutter/webview_flutter.dart';

String _buildWorldData({
  int lastEcsSaved = 0,
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
            'render': <String, dynamic>{
              'textureKey': 1,
            },
            'characterStatus': <String, dynamic>{
              'characterKey': 1,
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
            },
            'diseaseSystem': <String, dynamic>{
              'nextCheckTime': 10 * 1000,
              'sickStartTime': 0,
            },
          },
        },
      ],
    });

Map<String, dynamic> _decodeStoredWorldData(SharedPreferences prefs) =>
    jsonDecode(prefs.getString(config.worldDataStorageKey)!)
        as Map<String, dynamic>;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const MethodChannel channel = MethodChannel('digivice/home_widget');

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (MethodCall call) async {
      if (call.method == 'publishSnapshot') {
        return <String, Object?>{
          'status': 'ok',
          'snapshotKey':
              (call.arguments as Map<Object?, Object?>)['snapshotKey'],
        };
      }

      return null;
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  test('completeNativeWorldDataUpdate는 JS payload의 nowMs를 service에 전달한다',
      () async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      config.worldDataStorageKey,
      _buildWorldData(lastEcsSaved: 1000),
    );
    final List<Map<String, String?>> resolutions = <Map<String, String?>>[];
    final WorldDataUpdateController controller = WorldDataUpdateController(
      resolvePromise: (
          {required String id, String? data, String? error}) async {
        resolutions.add(<String, String?>{
          'id': id,
          'data': data,
          'error': error,
        });
      },
    );

    await controller.handleAction(
      JavaScriptMessage(
        message: jsonEncode(<String, dynamic>{
          'id': 'request-1',
          'action': 'completeNativeWorldDataUpdate',
          'payload': <String, dynamic>{
            'source': 'app_resume',
            'nowMs': 60000,
          },
        }),
      ),
    );

    expect(resolutions, hasLength(1));
    expect(resolutions.single['id'], 'request-1');
    expect(resolutions.single['error'], isNull);
    final Map<String, dynamic> result =
        jsonDecode(resolutions.single['data']!) as Map<String, dynamic>;
    final Map<String, dynamic> storedWorldData = _decodeStoredWorldData(prefs);
    final Map<String, dynamic> metadata =
        storedWorldData['world_metadata'] as Map<String, dynamic>;
    final Map<String, dynamic> appState =
        metadata['app_state'] as Map<String, dynamic>;

    expect(result['source'], 'app_resume');
    expect(metadata['last_ecs_saved'], 60000);
    expect(appState['last_active_time'], 60000);
  });

  test('nowMs가 없거나 invalid이면 DateTime.now fallback을 유지한다', () async {
    Future<void> runFallbackCase(Map<String, dynamic> payload) async {
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      await prefs.clear();
      await prefs.setString(config.worldDataStorageKey, _buildWorldData());
      final List<Map<String, String?>> resolutions = <Map<String, String?>>[];
      final WorldDataUpdateController controller = WorldDataUpdateController(
        resolvePromise: ({
          required String id,
          String? data,
          String? error,
        }) async {
          resolutions.add(<String, String?>{
            'id': id,
            'data': data,
            'error': error,
          });
        },
      );
      final int beforeMs = DateTime.now().millisecondsSinceEpoch;

      await controller.handleAction(
        JavaScriptMessage(
          message: jsonEncode(<String, dynamic>{
            'id': 'request-fallback',
            'action': 'completeNativeWorldDataUpdate',
            'payload': payload,
          }),
        ),
      );

      final int afterMs = DateTime.now().millisecondsSinceEpoch;
      final Map<String, dynamic> storedWorldData =
          _decodeStoredWorldData(prefs);
      final Map<String, dynamic> metadata =
          storedWorldData['world_metadata'] as Map<String, dynamic>;
      final int savedAtMs = metadata['last_ecs_saved'] as int;

      expect(resolutions, hasLength(1));
      expect(resolutions.single['error'], isNull);
      expect(savedAtMs, isNot(60000));
      expect(savedAtMs, greaterThanOrEqualTo(beforeMs - 1000));
      expect(savedAtMs, lessThanOrEqualTo(afterMs + 1000));
    }

    await runFallbackCase(<String, dynamic>{'source': 'app_resume'});
    await runFallbackCase(<String, dynamic>{
      'source': 'app_resume',
      'nowMs': '60000',
    });
  });
}

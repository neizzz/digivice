import 'package:digivice_virtual_bridge/world_data/world_data_update_service.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const MethodChannel channel = MethodChannel(worldDataUpdateChannelName);
  late List<MethodCall> methodCalls;

  setUp(() {
    methodCalls = <MethodCall>[];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (MethodCall call) async {
      methodCalls.add(call);
      return <Object?, Object?>{
        'status': 'native_world_data_update_completed',
        'worldDataChanged': true,
        'hatched': false,
        'evolutionGageBefore': 1.5,
        'evolutionGageAfter': 2.0,
      };
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  test(
      'completeNativeWorldDataUpdate는 widget controller 없이 world data channel을 호출한다',
      () async {
    final Map<String, Object?> result =
        await WorldDataUpdateService.completeNativeWorldDataUpdate(
      source: 'app_resume',
    );

    expect(result['status'], 'native_world_data_update_completed');
    expect(result['worldDataChanged'], isTrue);
    expect(result['hatched'], isFalse);
    expect(result['evolutionGageBefore'], 1.5);
    expect(result['evolutionGageAfter'], 2.0);

    expect(methodCalls, hasLength(1));
    expect(methodCalls.single.method, 'completeNativeWorldDataUpdate');
    expect(
      methodCalls.single.arguments,
      <String, Object?>{'source': 'app_resume'},
    );
  });
}

import 'package:flutter/services.dart';

const String worldDataUpdateChannelName = 'digivice/world_data';

class WorldDataUpdateService {
  static const MethodChannel _platformChannel = MethodChannel(
    worldDataUpdateChannelName,
  );

  static Future<Map<String, Object?>> completeNativeWorldDataUpdate({
    String? source,
    void Function(String message)? log,
  }) async {
    final Map<String, dynamic> payload = <String, dynamic>{
      if (source != null) 'source': source,
    };

    final Map<Object?, Object?>? result =
        await _platformChannel.invokeMethod<Map<Object?, Object?>>(
      'completeNativeWorldDataUpdate',
      payload,
    );
    final Map<String, Object?> normalized = normalizePlatformResult(result);

    log?.call(
      '[WorldDataUpdateService] completeNativeWorldDataUpdate '
      'source=$source '
      'status=${normalized['status']} '
      'worldDataChanged=${normalized['worldDataChanged']} '
      'hatched=${normalized['hatched']} '
      'evolutionGageBefore=${normalized['evolutionGageBefore']} '
      'evolutionGageAfter=${normalized['evolutionGageAfter']} '
      'evolutionGageIncreased=${normalized['evolutionGageIncreased']} '
      'evolutionBlockReason=${normalized['evolutionBlockReason']}',
    );

    return normalized;
  }

  static Map<String, Object?> normalizePlatformResult(
    Map<Object?, Object?>? result,
  ) {
    if (result == null) {
      return <String, Object?>{};
    }

    return result.map(
      (Object? key, Object? value) => MapEntry(
        key?.toString() ?? '',
        value,
      ),
    );
  }
}

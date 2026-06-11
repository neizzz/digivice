import 'dart:convert';

import 'package:webview_flutter/webview_flutter.dart';

import 'world_data_update_service.dart';

class WorldDataUpdateController {
  final void Function(String message)? log;
  final Future<void> Function({
    required String id,
    String? data,
    String? error,
  }) resolvePromise;

  const WorldDataUpdateController({
    this.log,
    required this.resolvePromise,
  });

  int? _readNowMs(Object? value) {
    if (value is! num || !value.isFinite) {
      return null;
    }

    return value.toInt();
  }

  String getJavaScriptInterface() {
    return '''
      window.worldDataUpdateController = {
        completeNativeWorldDataUpdate: (payload = {}) => {
          return __createPromise((id) => {
            __native_world_data_update.postMessage(JSON.stringify({
              id,
              action: "completeNativeWorldDataUpdate",
              payload
            }));
          }).then((raw) => {
            if (!raw) {
              return { status: "unknown" };
            }
            return typeof raw === "string" ? JSON.parse(raw) : raw;
          });
        }
      };
    ''';
  }

  Future<void> handleAction(JavaScriptMessage message) async {
    String? requestId;

    try {
      final Object decoded = jsonDecode(message.message);
      final Map<String, dynamic> request =
          decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
      final String action = request['action'] as String? ?? '';
      final String? id = request['id'] as String?;
      requestId = id;
      final Map<String, dynamic> payload = request['payload'] is Map
          ? Map<String, dynamic>.from(request['payload'] as Map)
          : <String, dynamic>{};

      switch (action) {
        case 'completeNativeWorldDataUpdate':
          final Map<String, Object?> result =
              await WorldDataUpdateService.completeNativeWorldDataUpdate(
            source: payload['source'] as String?,
            nowMs: _readNowMs(payload['nowMs']),
            log: log,
          );
          if (id != null) {
            await resolvePromise(id: id, data: jsonEncode(result));
          }
          return;
        default:
          if (id != null) {
            await resolvePromise(
              id: id,
              error: 'Unsupported world data update action: $action',
            );
          }
          return;
      }
    } catch (error) {
      if (requestId != null) {
        await resolvePromise(id: requestId, error: error.toString());
      }
      log?.call('[WorldDataUpdateController] action failed: $error');
    }
  }
}

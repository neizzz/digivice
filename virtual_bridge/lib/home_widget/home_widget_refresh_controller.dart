import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

class HomeWidgetRefreshController {
  static const MethodChannel _platformChannel = MethodChannel(
    'digivice/home_widget',
  );

  final void Function(String message)? log;
  final Future<void> Function({
    required String id,
    String? data,
    String? error,
  }) resolvePromise;

  const HomeWidgetRefreshController({
    this.log,
    required this.resolvePromise,
  });

  String getJavaScriptInterface() {
    return '''
      window.homeWidgetController = {
        requestPinWidget: () => {
          return __createPromise((id) => {
            __native_home_widget.postMessage(JSON.stringify({
              id,
              action: "requestPinWidget"
            }));
          });
        },
        completeRefresh: (payload = {}) => {
          try {
            __native_home_widget.postMessage(JSON.stringify({
              action: "completeRefresh",
              payload
            }));
          } catch (_) {}
        }
      };
      window.homeWidgetRefreshController = window.homeWidgetController;
    ''';
  }

  Future<void> handleAction(JavaScriptMessage message) async {
    try {
      final Object decoded = jsonDecode(message.message);
      final Map<String, dynamic> request = decoded is Map<String, dynamic>
          ? decoded
          : <String, dynamic>{};
      final String action = request['action'] as String? ?? '';
      final String? id = request['id'] as String?;
      final Map<String, dynamic> payload = request['payload'] is Map
          ? Map<String, dynamic>.from(request['payload'] as Map)
          : <String, dynamic>{};

      switch (action) {
        case 'requestPinWidget':
          try {
            final Map<Object?, Object?>? result =
                await _platformChannel.invokeMethod<Map<Object?, Object?>>(
              'requestPinWidget',
            );
            if (id != null) {
              final String encodedResult = jsonEncode(
                (result ?? <Object?, Object?>{}).map(
                  (Object? key, Object? value) => MapEntry(
                    key?.toString() ?? '',
                    value,
                  ),
                ),
              );
              await resolvePromise(id: id, data: encodedResult);
            }
            log?.call(
              '[HomeWidgetRefreshController] requestPinWidget result=${result?['status']}',
            );
          } catch (error) {
            if (id != null) {
              await resolvePromise(id: id, error: error.toString());
            }
            rethrow;
          }
          return;
        case 'completeRefresh':
          await _platformChannel.invokeMethod<void>(
            'completeRefresh',
            payload,
          );
          log?.call(
            '[HomeWidgetRefreshController] completeRefresh result=${payload['result']} source=${payload['source']}',
          );
          return;
        default:
          return;
      }
    } catch (error) {
      log?.call('[HomeWidgetRefreshController] action failed: $error');
    }
  }
}

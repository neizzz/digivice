import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'home_widget_sync_service.dart';

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
        requestPinWidget1x1: () => {
          return __createPromise((id) => {
            __native_home_widget.postMessage(JSON.stringify({
              id,
              action: "requestPinWidget1x1"
            }));
          });
        },
        requestPinWidget2x1: () => {
          return __createPromise((id) => {
            __native_home_widget.postMessage(JSON.stringify({
              id,
              action: "requestPinWidget2x1"
            }));
          });
        },
        getLaunchContext: () => {
          return __createPromise((id) => {
            __native_home_widget.postMessage(JSON.stringify({
              id,
              action: "getLaunchContext"
            }));
          }).then((raw) => {
            if (!raw) {
              return { mode: "default" };
            }
            return typeof raw === "string" ? JSON.parse(raw) : raw;
          }).catch(() => {
            return { mode: "default" };
          });
        },
        syncFromWorldDataJson: (payload = {}) => {
          return __createPromise((id) => {
            __native_home_widget.postMessage(JSON.stringify({
              id,
              action: "syncFromWorldDataJson",
              payload
            }));
          }).then((raw) => {
            if (!raw) {
              return { status: "unknown" };
            }
            return typeof raw === "string" ? JSON.parse(raw) : raw;
          });
        },
        completeRefresh: (payload = {}) => {
          return __createPromise((id) => {
            __native_home_widget.postMessage(JSON.stringify({
              id,
              action: "completeRefresh",
              payload
            }));
          }).then((raw) => {
            if (!raw) {
              return { status: "ok" };
            }
            return typeof raw === "string" ? JSON.parse(raw) : raw;
          });
        },
        completeNativeWorldDataUpdate: (payload = {}) => {
          return __createPromise((id) => {
            __native_home_widget.postMessage(JSON.stringify({
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
        },
        getRefreshDiagnostics: () => {
          return __createPromise((id) => {
            __native_home_widget.postMessage(JSON.stringify({
              id,
              action: "getRefreshDiagnostics"
            }));
          }).then((raw) => {
            if (!raw) {
              return {};
            }
            return typeof raw === "string" ? JSON.parse(raw) : raw;
          }).catch(() => {
            return {};
          });
        }
      };
      window.homeWidgetRefreshController = window.homeWidgetController;
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
        case 'requestPinWidget':
        case 'requestPinWidget1x1':
        case 'requestPinWidget2x1':
          try {
            final String method = switch (action) {
              'requestPinWidget1x1' => 'requestPinWidget1x1',
              'requestPinWidget2x1' => 'requestPinWidget2x1',
              _ => 'requestPinWidget',
            };
            final Map<Object?, Object?>? result =
                await _platformChannel.invokeMethod<Map<Object?, Object?>>(
              method,
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
              '[HomeWidgetRefreshController] $action result=${result?['status']}',
            );
          } catch (error) {
            if (id != null) {
              requestId = null;
              await resolvePromise(id: id, error: error.toString());
            }
            rethrow;
          }
          return;
        case 'getLaunchContext':
          final Map<Object?, Object?>? launchContext =
              await _platformChannel.invokeMethod<Map<Object?, Object?>>(
            'getLaunchContext',
          );
          if (id != null) {
            await resolvePromise(
              id: id,
              data: jsonEncode(
                _normalizePlatformResult(
                  launchContext ?? <Object?, Object?>{'mode': 'default'},
                ),
              ),
            );
          }
          log?.call(
            '[HomeWidgetRefreshController] getLaunchContext '
            'mode=${launchContext?['mode'] ?? 'default'}',
          );
          return;
        case 'completeRefresh':
          final Map<Object?, Object?>? completeResult =
              await _platformChannel.invokeMethod<Map<Object?, Object?>>(
            'completeRefresh',
            payload,
          );
          if (id != null) {
            await resolvePromise(
              id: id,
              data: jsonEncode(_normalizePlatformResult(completeResult)),
            );
          }
          log?.call(
            '[HomeWidgetRefreshController] completeRefresh result=${payload['result']} source=${payload['source']}',
          );
          return;
        case 'completeNativeWorldDataUpdate':
          final Map<Object?, Object?>? nativeUpdateResult =
              await _platformChannel.invokeMethod<Map<Object?, Object?>>(
            'completeNativeWorldDataUpdate',
            payload,
          );
          if (id != null) {
            await resolvePromise(
              id: id,
              data: jsonEncode(_normalizePlatformResult(nativeUpdateResult)),
            );
          }
          log?.call(
            '[HomeWidgetRefreshController] completeNativeWorldDataUpdate '
            'source=${payload['source']} '
            'status=${nativeUpdateResult?['status']} '
            'worldDataChanged=${nativeUpdateResult?['worldDataChanged']} '
            'hatched=${nativeUpdateResult?['hatched']}',
          );
          return;
        case 'getRefreshDiagnostics':
          final Map<Object?, Object?>? diagnosticsResult =
              await _platformChannel.invokeMethod<Map<Object?, Object?>>(
            'getRefreshDiagnostics',
          );
          if (id != null) {
            await resolvePromise(
              id: id,
              data: jsonEncode(_normalizePlatformResult(diagnosticsResult)),
            );
          }
          log?.call(
            '[HomeWidgetRefreshController] getRefreshDiagnostics '
            'periodicStatus=${diagnosticsResult?['periodicRefreshStatus']} '
            'requestedAtMs=${diagnosticsResult?['requestedAtMs']} '
            'completedAtMs=${diagnosticsResult?['completedAtMs']} '
            'inFlight=${diagnosticsResult?['inFlight']}',
          );
          return;
        case 'syncFromWorldDataJson':
          final Map<String, Object?> syncResult =
              await HomeWidgetSyncService.syncFromWorldDataJson(
            rawWorldData: payload['rawWorldData'] as String?,
            reason: payload['reason'] as String? ?? 'manual',
            log: log,
          );
          if (id != null) {
            await resolvePromise(id: id, data: jsonEncode(syncResult));
          }
          log?.call(
            '[HomeWidgetRefreshController] syncFromWorldDataJson '
            'reason=${payload['reason']} '
            'status=${syncResult['status']} '
            'hasWorldData=${payload['rawWorldData'] is String && (payload['rawWorldData'] as String).isNotEmpty}',
          );
          return;
        default:
          if (id != null) {
            await resolvePromise(
              id: id,
              error: 'Unsupported home widget action: $action',
            );
          }
          return;
      }
    } catch (error) {
      if (requestId != null) {
        await resolvePromise(id: requestId!, error: error.toString());
      }
      log?.call('[HomeWidgetRefreshController] action failed: $error');
    }
  }

  Map<String, Object?> _normalizePlatformResult(Map<Object?, Object?>? result) {
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

import 'dart:async';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Storage 기능의 JavaScript 인터페이스를 관리하는 컨트롤러
class StorageController {
  static const int _previewLimit = 120;
  static const String _nativeDiagnosticsSinkName =
      '__digiviceNativeBridgeDiagnostics';
  final Function(String jsCode) runJavaScript;
  final Function({required String id, String? data, String? error})
      resolvePromise;
  final Function(String message) log;
  final bool emitWebViewConsoleDiagnostics;

  StorageController({
    required this.runJavaScript,
    required this.resolvePromise,
    required this.log,
    this.emitWebViewConsoleDiagnostics = false,
  });

  /// JavaScript에 Storage 인터페이스를 제공하는 코드를 반환합니다.
  String getJavaScriptInterface() {
    return '''
      window.storageController = {
        getData: (key) => {
          return __createPromise((id) => {
            const argObj = { id, operation: 'get', key };
            __native_storage.postMessage(JSON.stringify(argObj));
          });
        },
        setData: (key, value) => {
          return __createPromise((id) => {
            const argObj = { id, operation: 'set', key, value };
            __native_storage.postMessage(JSON.stringify(argObj));
          });
        },
        removeData: (key) => {
          return __createPromise((id) => {
            const argObj = { id, operation: 'remove', key };
            __native_storage.postMessage(JSON.stringify(argObj));
          });
        },
        getItem: (key) => window.storageController.getData(key),
        setItem: (key, value) => window.storageController.setData(key, value),
        removeItem: (key) => window.storageController.removeData(key),
        clear: () => {
          return __createPromise((id) => {
            const argObj = { id, operation: 'clear' };
            __native_storage.postMessage(JSON.stringify(argObj));
          });
        }
      };
    ''';
  }

  /// Storage 작업 요청을 처리합니다.
  Future<void> handleStorageOperation(JavaScriptMessage message) async {
    final Map<String, dynamic> jsArgs =
        jsonDecode(message.message) as Map<String, dynamic>;
    final String id = jsArgs['id'] as String;
    final String? operation = jsArgs['operation'] as String?;
    final String? key = jsArgs['key'] as String?;
    final Object? rawValue = jsArgs['value'];
    final String? value = rawValue is String ? rawValue : rawValue?.toString();

    final Stopwatch stopwatch = Stopwatch()..start();

    try {
      log(
        '[StorageController] start id=$id operation=$operation key=${key ?? '-'} '
        'hasValue=${value != null}',
      );
      _emitTimingDiagnostics(
        phase: 'start',
        id: id,
        operation: operation,
        key: key,
        hasValue: value != null,
        elapsedMs: stopwatch.elapsedMilliseconds,
      );

      final prefs = await SharedPreferences.getInstance();
      String? result;

      log(
        '[StorageController] shared_preferences_ready id=$id '
        'operation=$operation key=${key ?? '-'} '
        'elapsedMs=${stopwatch.elapsedMilliseconds}',
      );
      _emitTimingDiagnostics(
        phase: 'shared_preferences_ready',
        id: id,
        operation: operation,
        key: key,
        hasValue: value != null,
        elapsedMs: stopwatch.elapsedMilliseconds,
      );

      switch (operation) {
        case 'set':
          if (key == null || value == null) {
            throw ArgumentError('setData requires key and value');
          }
          await prefs.setString(key, value);
          log(
            '[StorageController] set id=$id key=$key length=${value.length} '
            'elapsedMs=${stopwatch.elapsedMilliseconds} '
            'preview=${_preview(value)}',
          );
          result = 'success';
          break;
        case 'remove':
          if (key == null) {
            throw ArgumentError('removeData requires key');
          }
          await prefs.remove(key);
          log(
            '[StorageController] remove id=$id key=$key '
            'elapsedMs=${stopwatch.elapsedMilliseconds}',
          );
          result = 'success';
          break;
        case 'clear':
          await prefs.clear();
          log(
            '[StorageController] clear id=$id elapsedMs=${stopwatch.elapsedMilliseconds}',
          );
          result = 'success';
          break;
        case 'get':
        default:
          if (key == null) {
            throw ArgumentError('getData requires key');
          }
          result = prefs.getString(key);
          log(
            '[StorageController] get id=$id key=$key contains=${prefs.containsKey(key)} '
            'isNull=${result == null} length=${result?.length ?? 0} '
            'elapsedMs=${stopwatch.elapsedMilliseconds} '
            'preview=${_preview(result)}',
          );
          break;
      }

      _emitTimingDiagnostics(
        phase: 'success',
        id: id,
        operation: operation,
        key: key,
        hasValue: value != null,
        elapsedMs: stopwatch.elapsedMilliseconds,
        valueLength: value?.length,
        resultLength: result?.length,
      );
      resolvePromise(id: id, data: result);
      log(
        '[StorageController] resolve_sent id=$id operation=$operation key=${key ?? '-'} '
        'status=success elapsedMs=${stopwatch.elapsedMilliseconds}',
      );
      _emitTimingDiagnostics(
        phase: 'resolve_sent',
        id: id,
        operation: operation,
        key: key,
        hasValue: value != null,
        elapsedMs: stopwatch.elapsedMilliseconds,
        valueLength: value?.length,
        resultLength: result?.length,
      );
    } catch (e) {
      log(
        '[StorageController] error id=$id operation=$operation key=${key ?? '-'} '
        'elapsedMs=${stopwatch.elapsedMilliseconds} $e',
      );
      _emitTimingDiagnostics(
        phase: 'error',
        id: id,
        operation: operation,
        key: key,
        hasValue: value != null,
        elapsedMs: stopwatch.elapsedMilliseconds,
        valueLength: value?.length,
        error: e.toString(),
      );
      resolvePromise(id: id, error: e.toString());
      log(
        '[StorageController] resolve_sent id=$id operation=$operation key=${key ?? '-'} '
        'status=error elapsedMs=${stopwatch.elapsedMilliseconds}',
      );
      _emitTimingDiagnostics(
        phase: 'resolve_sent',
        id: id,
        operation: operation,
        key: key,
        hasValue: value != null,
        elapsedMs: stopwatch.elapsedMilliseconds,
        valueLength: value?.length,
        error: e.toString(),
        status: 'error',
      );
    }
  }

  void _emitTimingDiagnostics({
    required String phase,
    required String id,
    required String? operation,
    required String? key,
    required bool hasValue,
    required int elapsedMs,
    int? valueLength,
    int? resultLength,
    String? error,
    String? status,
  }) {
    final Map<String, dynamic> payload = <String, dynamic>{
      'tag': 'NativeStorageTiming',
      'phase': phase,
      'id': id,
      'operation': operation,
      'key': key,
      'hasValue': hasValue,
      'elapsedMs': elapsedMs,
      'valueLength': valueLength,
      'resultLength': resultLength,
      'error': error,
      'status': status,
    };
    final String encodedPayload = jsonEncode(payload);
    final String sinkScript = '''
      (function () {
        const nextEntry = $encodedPayload;
        const sinkName = '$_nativeDiagnosticsSinkName';
        const existing = Array.isArray(window[sinkName]) ? window[sinkName] : [];
        existing.push(nextEntry);
        if (existing.length > 200) {
          existing.splice(0, existing.length - 200);
        }
        window[sinkName] = existing;
      })();
    ''';

    unawaited(
      runJavaScript(sinkScript).then((_) async {
        if (!emitWebViewConsoleDiagnostics) {
          return;
        }

        await runJavaScript(
          "console.log('[ImportantDiagnostics][NativeStorageTiming]', $encodedPayload);",
        );
      }).catchError((Object emitError) {
        log('[StorageController] emitTimingDiagnostics failed: $emitError');
      }),
    );
  }

  String _preview(String? value) {
    if (value == null) {
      return 'null';
    }

    if (value.length <= _previewLimit) {
      return value;
    }

    return '${value.substring(0, _previewLimit)}…';
  }

  /// 리소스를 정리합니다.
  void dispose() {
    // 현재는 특별히 정리할 리소스 없음
  }
}

import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Storage 기능의 JavaScript 인터페이스를 관리하는 컨트롤러
class StorageController {
  static const int _previewLimit = 120;
  final Function(String jsCode) runJavaScript;
  final Function({required String id, String? data, String? error})
      resolvePromise;
  final Function(String message) log;

  StorageController({
    required this.runJavaScript,
    required this.resolvePromise,
    required this.log,
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

    try {
      final prefs = await SharedPreferences.getInstance();
      String? result;

      log(
        '[StorageController] start operation=$operation key=${key ?? '-'} '
        'hasValue=${value != null}',
      );

      switch (operation) {
        case 'set':
          if (key == null || value == null) {
            throw ArgumentError('setData requires key and value');
          }
          await prefs.setString(key, value);
          log(
            '[StorageController] set key=$key length=${value.length} '
            'preview=${_preview(value)}',
          );
          result = 'success';
          break;
        case 'remove':
          if (key == null) {
            throw ArgumentError('removeData requires key');
          }
          await prefs.remove(key);
          log('[StorageController] remove key=$key');
          result = 'success';
          break;
        case 'clear':
          await prefs.clear();
          log('[StorageController] clear all keys');
          result = 'success';
          break;
        case 'get':
        default:
          if (key == null) {
            throw ArgumentError('getData requires key');
          }
          result = prefs.getString(key);
          log(
            '[StorageController] get key=$key contains=${prefs.containsKey(key)} '
            'isNull=${result == null} length=${result?.length ?? 0} '
            'preview=${_preview(result)}',
          );
          break;
      }

      resolvePromise(id: id, data: result);
    } catch (e) {
      log('[StorageController] error operation=$operation key=${key ?? '-'} $e');
      resolvePromise(id: id, error: e.toString());
    }
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

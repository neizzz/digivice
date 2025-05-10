import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Storage 기능의 JavaScript 인터페이스를 관리하는 컨트롤러
class StorageController {
  final Function(String jsCode) runJavaScript;
  final Function({required String id, String? data}) resolvePromise;
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
        getItem: (key) => {
          return __createPromise((id) => {
            const argObj = { id, key };
            __native_storage.postMessage(JSON.stringify(argObj));
          });
        },
        setItem: (key, value) => {
          return __createPromise((id) => {
            const argObj = { id, key, value };
            __native_storage.postMessage(JSON.stringify(argObj));
          });
        },
        removeItem: (key) => {
          return __createPromise((id) => {
            const argObj = { id, key };
            __native_storage.postMessage(JSON.stringify(argObj));
          });
        },
        clear: () => {
          return __createPromise((id) => {
            const argObj = { id };
            __native_storage.postMessage(JSON.stringify(argObj));
          });
        }
      };
    ''';
  }

  /// Storage 작업 요청을 처리합니다.
  Future<void> handleStorageOperation(JavaScriptMessage message) async {
    Map<String, dynamic> jsArgs = jsonDecode(message.message);
    String id = jsArgs['id'];
    String? key = jsArgs['key'];
    String? value = jsArgs['value'];

    try {
      final prefs = await SharedPreferences.getInstance();
      String? result;

      if (value != null) {
        // setItem
        await prefs.setString(key!, value);
        result = 'success';
      } else if (key != null) {
        // getItem or removeItem
        if (jsArgs.containsKey('value')) {
          await prefs.remove(key);
          result = 'success';
        } else {
          result = prefs.getString(key);
        }
      } else {
        // clear
        await prefs.clear();
        result = 'success';
      }

      resolvePromise(id: id, data: result);
    } catch (e) {
      resolvePromise(id: id, data: 'Error: ${e.toString()}');
    }
  }

  /// 리소스를 정리합니다.
  void dispose() {
    // 현재는 특별히 정리할 리소스 없음
  }
}

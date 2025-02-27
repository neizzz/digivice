import 'dart:convert';
import 'package:digivice_virtual_bridge/pip.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// PIP(Picture-in-Picture) 기능의 JavaScript 인터페이스를 관리하는 컨트롤러
class PipController {
  final AndroidOverlayController _androidOverlayController =
      AndroidOverlayController();
  final Function(String jsCode) runJavaScript;
  final Function({required String id, String? data}) resolvePromise;
  final Function(String message) log;

  PipController({
    required this.runJavaScript,
    required this.resolvePromise,
    required this.log,
  });

  /// JavaScript에 PIP 인터페이스를 제공하는 코드를 반환합니다.
  String getJavaScriptInterface() {
    return '''
      window.pipController = {
        enterPipMode: (rawArgObj = {}) => {
          return __createPromise((id) => {
            const argObj = { id, args: rawArgObj };
            __native_pipEnter.postMessage(JSON.stringify(argObj));
          });
        },
        exitPipMode: (rawArgObj = {}) => {
          return __createPromise((id) => {
            const argObj = { id, args: rawArgObj };
            __native_pipExit.postMessage(JSON.stringify(argObj));
          });
        }
      };
    ''';
  }

  /// PIP 모드 진입 요청을 처리합니다.
  void handleEnterPip(JavaScriptMessage message) async {
    Map<String, dynamic> jsArgs = jsonDecode(message.message);
    try {
      await log('Enter PIP mode request');
      _androidOverlayController.showOverlay();
      resolvePromise(id: jsArgs['id'], data: 'PiP enabled');
    } catch (e) {
      resolvePromise(id: jsArgs['id'], data: 'Error: ${e.toString()}');
    }
  }

  /// PIP 모드 종료 요청을 처리합니다.
  void handleExitPip(JavaScriptMessage message) async {
    Map<String, dynamic> jsArgs = jsonDecode(message.message);
    try {
      await log('Exit PIP mode request');
      _androidOverlayController.closeOverlay();
      resolvePromise(id: jsArgs['id'], data: 'PiP disabled');
    } catch (e) {
      resolvePromise(id: jsArgs['id'], data: 'Error: ${e.toString()}');
    }
  }

  /// 리소스를 정리합니다.
  void dispose() {
    try {
      _androidOverlayController.closeOverlay();
    } catch (e) {
      print('PIP 컨트롤러 정리 중 오류: $e');
    }
  }
}

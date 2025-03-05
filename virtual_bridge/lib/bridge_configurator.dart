import 'package:webview_flutter/webview_flutter.dart';
import 'nfc/nfc_controller.dart';
import 'pip/pip_controller.dart';

/// WebView와 네이티브 코드 간 브릿지 설정을 담당하는 클래스
class BridgeConfigurator {
  final WebViewController webViewController;
  final Function(String message) logCallback;

  late final NfcController _nfcController;
  late final PipController _pipController;

  BridgeConfigurator({
    required this.webViewController,
    required this.logCallback,
  }) {
    _nfcController = NfcController(
      runJavaScript: _runJavaScript,
      resolvePromise: _resolvePromise,
      log: logCallback,
    );

    _pipController = PipController(
      runJavaScript: _runJavaScript,
      resolvePromise: _resolvePromise,
      log: logCallback,
    );
  }

  /// 브릿지 초기화
  Future<void> setupBridge() async {
    await _setupBasePromiseSystem();
    await _setupControllers();

    // JavaScriptChannel 직접 추가
    webViewController
      ..addJavaScriptChannel(
        '__native_nfcReadWrite',
        onMessageReceived: (JavaScriptMessage message) =>
            _nfcController.handleStartReadWrite(message),
      )
      ..addJavaScriptChannel(
        '__native_nfcHce',
        onMessageReceived: (JavaScriptMessage message) =>
            _nfcController.handleStartHce(message),
      )
      ..addJavaScriptChannel(
        '__native_nfcStop',
        onMessageReceived: (JavaScriptMessage message) =>
            _nfcController.handleStop(message),
      )
      ..addJavaScriptChannel(
        '__native_pipEnter',
        onMessageReceived: (JavaScriptMessage message) =>
            _pipController.handleEnterPip(message),
      )
      ..addJavaScriptChannel(
        '__native_pipExit',
        onMessageReceived: (JavaScriptMessage message) =>
            _pipController.handleExitPip(message),
      )
      ..setOnConsoleMessage((JavaScriptConsoleMessage consoleMessage) {
        logCallback(consoleMessage.message);
      });
  }

  /// 기본 프로미스 시스템 설정
  Future<void> _setupBasePromiseSystem() async {
    await _runJavaScript('''
      window.__promises = {};
      window.__createPromise = function(callback) {
        return new Promise((resolve, reject) => {
          const promiseId = 'promise_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          window.__promises[promiseId] = { resolve, reject };
          callback(promiseId);
        });
      };
      window.__resolvePromise = function(promiseId, data, error) {
        if (window.__promises[promiseId]) {
          if (error) {
            window.__promises[promiseId].reject(error);
          } else {
            window.__promises[promiseId].resolve(data);
          }
          delete window.__promises[promiseId];
        }
      };
    ''');
  }

  /// 컨트롤러 설정
  Future<void> _setupControllers() async {
    await _runJavaScript(_nfcController.getJavaScriptInterface());
    await _runJavaScript(_pipController.getJavaScriptInterface());
  }

  /// JavaScript 코드 실행
  Future<void> _runJavaScript(String javaScript) async {
    try {
      await webViewController.runJavaScript(javaScript);
    } catch (e) {
      logCallback("JS 실행 오류: $e");
    }
  }

  /// Promise 해결/거부
  Future<void> _resolvePromise(
      {required String id, String? data, String? error}) async {
    final jsCode = '''
      window.__resolvePromise(
        "$id", 
        ${data != null ? "'$data'" : 'undefined'}, 
        ${error != null ? "'$error'" : 'undefined'}
      );
    ''';
    await _runJavaScript(jsCode);
  }

  /// 리소스 정리
  void dispose() {
    _nfcController.dispose();
    _pipController.dispose();
  }
}

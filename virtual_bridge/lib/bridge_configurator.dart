import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'webview_streaming/streaming_controller.dart';
import 'webview_streaming/streaming_server.dart';
import 'nfc/nfc_controller.dart';
import 'pip/pip_controller.dart';
import 'webview_streaming/screen_capture_service.dart';

/// WebView와 네이티브 코드 간 브릿지 설정을 담당하는 클래스
class BridgeConfigurator {
  final WebViewController webViewController;
  final Function(String message) logCallback;

  late final StreamingController _streamingController;
  late final NfcController _nfcController;
  late final PipController _pipController;
  final ScreenCaptureService _captureService = ScreenCaptureService();

  BridgeConfigurator({
    required this.webViewController,
    required this.logCallback,
  }) {
    // 캡처 서비스 초기화
    _captureService.initialize(webViewController);

    _streamingController = StreamingController(
      runJavaScript: _runJavaScript,
      resolvePromise: _resolvePromise,
      captureWebView: _handleCaptureWebView,
      log: logCallback,
    );

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

    await _addJavaScriptChannels({
      'initJavascriptInterfaces': (JavaScriptMessage message) =>
          _initJavascriptInterfaces(message),
      'native_streamingRequest': (JavaScriptMessage message) =>
          _streamingController.handleStreamingRequest(message),
      'native_nfcReadWrite': (JavaScriptMessage message) =>
          _nfcController.handleStartReadWrite(message),
      'native_nfcHce': (JavaScriptMessage message) =>
          _nfcController.handleStartHce(message),
      'native_nfcStop': (JavaScriptMessage message) =>
          _nfcController.handleStop(message),
      'native_pipEnter': (JavaScriptMessage message) =>
          _pipController.handleEnterPip(message),
      'native_pipExit': (JavaScriptMessage message) =>
          _pipController.handleExitPip(message),
    });

    await webViewController
        .setOnConsoleMessage((JavaScriptConsoleMessage consoleMessage) {
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
    await _runJavaScript(_streamingController.getJavaScriptInterface());
    await _runJavaScript(_nfcController.getJavaScriptInterface());
    await _runJavaScript(_pipController.getJavaScriptInterface());
  }

  /// JavaScript 채널 추가
  Future<void> _addJavaScriptChannels(
      Map<String, void Function(JavaScriptMessage)> channels) async {
    for (final entry in channels.entries) {
      await webViewController.addJavaScriptChannel(
        '__${entry.key}',
        onMessageReceived: entry.value,
      );
    }
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

  /// WebView 캡처 처리
  Future<Uint8List?> _handleCaptureWebView(Uint8List? placeholder) async {
    return _captureService.captureWebView(placeholder);
  }

  /// JavaScript 인터페이스 초기화
  Future<void> _initJavascriptInterfaces(JavaScriptMessage message) async {
    await _runJavaScript('''
      console.log(`Early errors: \${window.errorLogs || '없음'}`);
    ''');
    // 컨트롤러는 이미 setupBridge에서 설정되었으므로 별도의 설정은 필요 없음
  }

  /// 리소스 정리
  void dispose() {
    _streamingController.dispose();
    _nfcController.dispose();
    _pipController.dispose();
  }
}

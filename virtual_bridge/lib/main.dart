// ignore_for_file: avoid_print

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'dart:async';
import './nfc/nfc_controller.dart';
import './pip/pip_controller.dart';
import './webview_streaming/screen_capture_service.dart';
import './webview_streaming/streaming_controller.dart';

String mapToString(Map<String, dynamic> map) {
  return map.entries
      .map((entry) => "[${entry.key}, ${entry.value}]")
      .join(", ");
}

void main() {
  runApp(
    WidgetsApp(
      color: const Color(0xFFFFFFFF),
      builder: (context, _) => WebView(),
    ),
  );
}

// overlay entry point (2025.02.05 기준, for only Android)
@pragma("vm:entry-point")
void overlayMain() {
  runApp(const MaterialApp(
      color: Color.fromARGB(255, 255, 0, 0),
      debugShowCheckedModeBanner: true,
      home: Material(child: Text("My overlay"))));
}

// ignore: must_be_immutable
class WebView extends StatelessWidget {
  final WebViewController _controller = WebViewController();

  // 컨트롤러 인스턴스 선언
  late NfcController _nfcController;
  late PipController _pipController;
  late StreamingController _streamingController;
  final ScreenCaptureService _captureService = ScreenCaptureService();

  WebView({super.key}) {
    // 컨트롤러 초기화
    _nfcController = NfcController(
      runJavaScript: (jsCode) => _controller.runJavaScript(jsCode),
      resolvePromise: _resolvePromise,
      log: _log,
    );

    _pipController = PipController(
      runJavaScript: (jsCode) => _controller.runJavaScript(jsCode),
      resolvePromise: _resolvePromise,
      log: _log,
    );

    _streamingController = StreamingController(
      captureWebView: (param) => _captureService.captureWebView(_controller),
      runJavaScript: (jsCode) => _controller.runJavaScript(jsCode),
    );
  }

  @override
  Widget build(BuildContext context) {
    _controller
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setOnConsoleMessage((JavaScriptConsoleMessage consoleMessage) {
        print(consoleMessage.message);
      })
      ..addJavaScriptChannel('__initJavascriptInterfaces',
          onMessageReceived: _initJavascriptInterfaces)
      // NFC 채널
      ..addJavaScriptChannel('__native_nfcReadWrite',
          onMessageReceived: _nfcController.handleStartReadWrite)
      ..addJavaScriptChannel('__native_nfcHce',
          onMessageReceived: _nfcController.handleStartHce)
      ..addJavaScriptChannel('__native_nfcStop',
          onMessageReceived: _nfcController.handleStop)
      // PIP 채널
      ..addJavaScriptChannel('__native_pipEnter',
          onMessageReceived: _pipController.handleEnterPip)
      ..addJavaScriptChannel('__native_pipExit',
          onMessageReceived: _pipController.handleExitPip)
      // 스트리밍 채널
      ..addJavaScriptChannel('StreamingChannel',
          onMessageReceived: (message) =>
              _streamingController.handleJsMessage(message.message))
      // ..setNavigationDelegate(
      //   NavigationDelegate(
      //     onPageFinished: (url) {},
      //   ),
      // )
      ..loadRequest(Uri.parse('http://172.20.37.209:5173/'));

    return WebViewWidget(
      controller: _controller,
    );
  }

  /// apps/client/src/global.d.ts의 window 타입과 싱크
  void _initJavascriptInterfaces(JavaScriptMessage message) {
    // 기본 유틸리티 함수 주입
    _controller.runJavaScript('''
      console.log(`Early errors: \${window.errorLogs || '없음'}`);
      
      // 공통 유틸리티 함수
      window.__generateId = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
      window.__promises = {};
      window.__resolvePromise = (promiseId, data, error) => {
        if (error) {
         __promises[promiseId].reject(error);
        } else {
          __promises[promiseId].resolve(data);
        }
        delete __promises[promiseId];
      };
      window.__createPromise = (cb) => {
        const promise = new Promise((resolve, reject) => {
          let id = __generateId();
          if (__promises[id]) {
            id = __generateId();
          }
          try {
            cb(id);
            __promises[id] = { resolve, reject };
          } catch(exception) {
            console.warn(exception);
          }
        });
        return promise;
      }
    ''');
    _controller.runJavaScript(_nfcController.getJavaScriptInterface());
    _controller.runJavaScript(_pipController.getJavaScriptInterface());
    _controller.runJavaScript(_streamingController.getJavaScriptInterface());
  }

  Future<void> _log(String message) async {
    await _controller.runJavaScript('console.log(`[WebView] $message`)');
  }

  void _resolvePromise({required String id, String? data}) {
    _log('Resolving promise: $id, $data');
    // NOTE: 문자열 양 끝에 "가 붙어있는 경우 제거
    // 제거하지 않으면 웹뷰단에서 JSON.parse() 시 오류 발생
    _controller.runJavaScript(
        '__resolvePromise(`$id`, `${data?.substring(1, data.length - 1)}`)');
  }
}

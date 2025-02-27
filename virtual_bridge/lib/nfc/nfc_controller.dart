import 'dart:convert';
import './nfc_p2p.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// NFC 기능의 JavaScript 인터페이스를 관리하는 컨트롤러
class NfcController {
  final NfcP2pController _nfcP2pController = NfcP2pController();
  final Function(String jsCode) runJavaScript;
  final Function({required String id, String? data}) resolvePromise;
  final Function(String message) log;

  NfcController({
    required this.runJavaScript,
    required this.resolvePromise,
    required this.log,
  });

  /// JavaScript에 NFC 인터페이스를 제공하는 코드를 반환합니다.
  String getJavaScriptInterface() {
    return '''
      window.nfcController = {
        startReadWrite: (rawArgObj = {}) => {
          const promise = __createPromise((id) => {
            const argObj = {
              id,
              args: rawArgObj
            };
            const serializedArgObj = JSON.stringify(argObj);
            __native_nfcReadWrite.postMessage(serializedArgObj);
          });
          return promise;
        },
        startHce: (rawArgObj) => {
          const promise = __createPromise((id) => {
            const argObj = {
              id,
              args: rawArgObj
            };
            const serializedArgObj = JSON.stringify(argObj);
            __native_nfcHce.postMessage(serializedArgObj);
          });
          return promise;
        },
        stop: (rawArgObj) => {
          const promise = __createPromise((id) => {
            const argObj = {
              id,
              args: rawArgObj
            };
            const serializedArgObj = JSON.stringify(argObj);
            __native_nfcStop.postMessage(serializedArgObj);
          });
          return promise;
        }
      };
    ''';
  }

  /// NFC 읽기/쓰기 세션 시작 요청을 처리합니다.
  void handleStartReadWrite(JavaScriptMessage message) async {
    Map<String, dynamic> jsArgs = jsonDecode(message.message);
    await log('handleStartReadWrite message: $jsArgs');
    _nfcP2pController.startRequestSession(
        message: jsonEncode(jsArgs['args']['data']),
        onReceived: (String receivedMessage) async {
          resolvePromise(id: jsArgs['id'], data: receivedMessage);
        },
        onError: (String errorMessage) {
          resolvePromise(id: jsArgs['id'], data: errorMessage);
        });
  }

  /// NFC HCE(Host Card Emulation) 세션 시작 요청을 처리합니다.
  void handleStartHce(JavaScriptMessage message) async {
    Map<String, dynamic> jsArgs = jsonDecode(message.message);
    await log('handleStartHce message: $jsArgs');
    _nfcP2pController.startRespondSession(
      message: jsonEncode(jsArgs['args']['data']),
      onReceived: (String receivedMessage) {
        resolvePromise(id: jsArgs['id'], data: receivedMessage);
      },
      onError: (errorMessage) =>
          {resolvePromise(id: jsArgs['id'], data: errorMessage)},
    );
  }

  /// NFC 세션 중지 요청을 처리합니다.
  Future<void> handleStop(JavaScriptMessage message) async {
    Map<String, dynamic> jsArgs = jsonDecode(message.message);
    try {
      await _nfcP2pController.stopRequestSession();
      await _nfcP2pController.stopRespondSession();
      resolvePromise(id: jsArgs['id'], data: 'success');
    } catch (e) {
      resolvePromise(id: jsArgs['id'], data: 'Error: ${e.toString()}');
    }
  }

  /// 리소스를 정리합니다.
  Future<void> dispose() async {
    try {
      await _nfcP2pController.stopRequestSession();
      await _nfcP2pController.stopRespondSession();
    } catch (e) {
      print('NFC 컨트롤러 정리 중 오류: $e');
    }
  }
}

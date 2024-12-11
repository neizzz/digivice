import 'package:digivice_virtual_bridge/nfc.dart';
import 'package:flutter/widgets.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'dart:convert';

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

class WebView extends StatelessWidget {
  WebView({super.key});

  final WebViewController _controller = WebViewController();
  final NfcController _nfcController = NfcController();

  @override
  Widget build(BuildContext context) {
    _controller
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel('__initJavascriptInterfaces',
          onMessageReceived: _initJavascriptInterfaces)
      ..addJavaScriptChannel('__native_nfcRead',
          onMessageReceived: _handleNfcRead)
      ..addJavaScriptChannel('__native_nfcWrite',
          onMessageReceived: _handleNfcWrite)
      ..loadRequest(Uri.parse('http://172.20.37.209:5173'));

    return WebViewWidget(
      controller: _controller,
    );
  }

  /// 'message.message' => args json 객체
  /// ex) {option1: 123, option: 456, ...}
  void _handleNfcRead(JavaScriptMessage message) {
    Map<String, dynamic> args = jsonDecode(message.message);
    var serializedMessage = message.message;
    var serializedArgs = mapToString(args);
    _log('NFC Read: "$serializedMessage"/$serializedArgs');
  }

  void _handleNfcWrite(JavaScriptMessage message) {
    Map<String, dynamic> args = jsonDecode(message.message);
    var serializedMessage = message.message;
    var serializedArgs = mapToString(args);
    _log('NFC Write: "$serializedMessage"/$serializedArgs');
  }

  /// apps/client/src/global.d.ts의 window 타입과 싱크
  void _initJavascriptInterfaces(JavaScriptMessage message) {
    _controller.runJavaScript('''
      window.__generateId = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
      window.__promises = {};
      window.__resolvePromise = (promiseId, data, error) => {
        if (error) {
          __promises[uuid].reject(error);
        } else {
          __promises[uuid].resolve(data);
        }
        delete __promises[uuid];
      };
      window.nfcController = {
        readMessage: (argObj) => {
          // TODO: promise id 생성 및 주입
          __native_nfcRead.postMessage(JSON.stringify(argObj));
        },
        writeMessage: (argObj) => {
          // TODO: promise id 생성 및 주입
          __native_nfcWrite.postMessage(JSON.stringify(argObj));
        }
      }
      console.log('Javascript interfaces was initialized.');
    ''');
  }

  Future<void> _log(String text) async {
    await _controller.runJavaScript('console.log(`$text`)');
  }

  // Future<void> _recordResponse(String response) async {
  //   await _controller.runJavaScript('window.flutterResponse("$response")');
  // }
}

// ignore_for_file: avoid_print

import 'package:digivice_virtual_bridge/nfc.dart';
import 'package:flutter/widgets.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'dart:convert';

String mapToString(Map<String, dynamic> map) {
  return map.entries
      .map((entry) => "[${entry.key}, ${entry.value}]")
      .join(", ");
}

// class JavaScriptInterfaceArgsMapType {
//   final String id;
//   final Map<String, dynamic> args;

//   JavaScriptInterfaceArgsMapType({required this.id, required this.args});

//   Map<String, dynamic> toJson() {
//     return {'name': id, 'args': args};
//   }

//   factory JavaScriptInterfaceArgsMapType.fromJson(Map<String, dynamic> json) {
//     return JavaScriptInterfaceArgsMapType(
//       id: json['id'] as String,
//       args: json['args'] as Map<String, dynamic>,
//     );
//   }

//   @override
//   String toString() {
//     String serializedArgs = mapToString(args);
//     return '(id: $id, args: $serializedArgs)';
//   }
// }

void main() {
  runApp(
    WidgetsApp(
      color: const Color(0xFFFFFFFF),
      builder: (context, _) => WebView(),
    ),
  );
}

// ignore: must_be_immutable
class WebView extends StatelessWidget {
  final WebViewController _controller = WebViewController();
  late NfcController _nfcController;

  WebView({super.key});

  @override
  Widget build(BuildContext context) {
    _nfcController = NfcController();
    _controller
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setOnConsoleMessage((JavaScriptConsoleMessage consoleMessage) {
        print(consoleMessage.message);
      })
      ..addJavaScriptChannel('__initJavascriptInterfaces',
          onMessageReceived: _initJavascriptInterfaces)
      ..addJavaScriptChannel('__native_nfcRead',
          onMessageReceived: _handleNfcRead)
      ..addJavaScriptChannel('__native_nfcWrite',
          onMessageReceived: _handleNfcWrite)
      ..addJavaScriptChannel('__native_nfcStop',
          onMessageReceived: _handleNfcStop)
      ..loadRequest(Uri.parse('http://172.20.37.209:5173'));

    return WebViewWidget(
      controller: _controller,
    );
  }

  /// message.message: {id: string, message: string}
  void _handleNfcRead(JavaScriptMessage message) async {
    await _log(message.message);
    var jsArgs = jsonDecode(message.message);
    _nfcController.startReading(onRead: ({required String readMessage}) {
      print('onRead called');
      _resolvePromise(id: jsArgs['id'], data: readMessage);
    });
  }

  void _handleNfcWrite(JavaScriptMessage message) async {
    Map<String, dynamic> jsArgs = jsonDecode(message.message);
    _nfcController.startWriting(
        message: jsArgs['args']['message'],
        onWritten: ({required String writtenMessage}) {
          print('onWritten called');
          _resolvePromise(id: jsArgs['id'], data: writtenMessage);
        });
  }

  void _handleNfcStop(JavaScriptMessage message) async {
    Map<String, dynamic> jsArgs = jsonDecode(message.message);
    _nfcController.stop(onStop: () {
      print('onStop called');
      _resolvePromise(id: jsArgs['id']);
    });
  }

  /// apps/client/src/global.d.ts의 window 타입과 싱크
  void _initJavascriptInterfaces(JavaScriptMessage message) {
    _controller.runJavaScript('''
      console.log(`Early errors: \${window.errorLogs}`);
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
      window.nfcController = {
        readMessage: (rawArgObj = {}) => {
          const promise = __createPromise((id) => {
            const argObj = {
              id,
              args: rawArgObj
            };
            const serializedArgObj = JSON.stringify(argObj);
            __native_nfcRead.postMessage(serializedArgObj);
          });
          return promise;
        },
        writeMessage: (rawArgObj) => {
          const promise = __createPromise((id) => {
            const argObj = {
              id,
              args: rawArgObj
            };
            const serializedArgObj = JSON.stringify(argObj);
            __native_nfcWrite.postMessage(serializedArgObj);
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
      }
      console.log('Javascript interfaces was initialized.');
    ''');
  }

  Future<void> _log(String text) async {
    await _controller.runJavaScript('console.log(`$text`)');
  }

  void _resolvePromise({required String id, String? data}) {
    _controller.runJavaScript('__resolvePromise(`$id`, `$data`)');
  }
}

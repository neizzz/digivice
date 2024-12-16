// import 'package:digivice_virtual_bridge/nfc.dart';
import 'package:flutter/widgets.dart';
// import 'package:nfc_manager/nfc_manager.dart';
import 'package:webview_flutter/webview_flutter.dart';
// import 'dart:convert';

String mapToString(Map<String, dynamic> map) {
  return map.entries
      .map((entry) => "[${entry.key}, ${entry.value}]")
      .join(", ");
}

class JavaScriptInterfaceArgsMapType {
  final String id;
  final Map<String, dynamic> args;

  JavaScriptInterfaceArgsMapType({required this.id, required this.args});

  factory JavaScriptInterfaceArgsMapType.fromMap(Map<String, dynamic> map) {
    return JavaScriptInterfaceArgsMapType(
      id: map['id'] as String,
      args: map['args'] as Map<String, dynamic>,
    );
  }

  @override
  String toString() {
    String serializedArgs = mapToString(args);
    return '(id: $id, args: $serializedArgs)';
  }
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
  // final NfcController _nfcController = NfcController();

  @override
  Widget build(BuildContext context) {
    print('test');
    _controller
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      // ..addJavaScriptChannel('__initJavascriptInterfaces',
      //     onMessageReceived: _initJavascriptInterfaces)
      // ..addJavaScriptChannel('__native_nfcRead',
      //     onMessageReceived: _handleNfcRead)
      // ..addJavaScriptChannel('__native_nfcWrite',
      //     onMessageReceived: _handleNfcWrite)
      ..loadRequest(Uri.parse('http://172.20.37.209:5173'));

    return WebViewWidget(
      controller: _controller,
    );
  }

  /// 'message.message' => args json 객체
  /// ex) {id, option1: 123, option: 456, ...}
  // void _handleNfcRead(JavaScriptMessage message) {
  //   JavaScriptInterfaceArgsMapType jsArgs =
  //       jsonDecode(message.message) as JavaScriptInterfaceArgsMapType;
  //   String serializedMessage = message.message;
  //   String serializedJsArgs = jsArgs.toString();
  //   _log('NFC Read: "$serializedMessage"/$serializedJsArgs');
  //   // _nfcController.startReading(
  //   //     onRead: ({required NdefMessage readNdefMessage}) {
  //   //   _resolvePromise(
  //   //       id: jsArgs.id, result: readNdefMessage.records.toString());
  //   // });
  // }

  // void _handleNfcWrite(JavaScriptMessage message) {
  //   JavaScriptInterfaceArgsMapType jsArgs =
  //       jsonDecode(message.message) as JavaScriptInterfaceArgsMapType;
  //   String serializedMessage = message.message;
  //   String serializedJsArgs = jsArgs.toString();
  //   _log('NFC Write1: "$serializedMessage"/$serializedJsArgs');
  //   // _nfcController.startWriting(
  //   //     message: '@Nfc test message@',
  //   //     onWritten: ({required NdefMessage writtenNdefMessage}) {
  //   //       String serializedRecords = writtenNdefMessage.records.toString();
  //   //       _log('NFC Write2: $serializedRecords');
  //   //       _resolvePromise(id: jsArgs.id);
  //   //     });
  // }

  // /// apps/client/src/global.d.ts의 window 타입과 싱크
  // void _initJavascriptInterfaces(JavaScriptMessage message) {
  //   _controller.runJavaScript('''
  //     window.__generateId = () => {
  //       return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
  //         const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
  //         return v.toString(16);
  //       });
  //     };
  //     window.__promises = {};
  //     window.__resolvePromise = (promiseId, result, error) => {
  //       if (error) {
  //         __promises[uuid].reject(error);
  //       } else {
  //         __promises[uuid].resolve(result);
  //       }
  //       delete __promises[uuid];
  //     };
  //     window.__createPromise = (cb) => {
  //       const promise = new Promise((resolve, reject) => {
  //         let id = __generateId();
  //         if (__promises[id]) {
  //           id = __generateId();
  //         }
  //         __promises[id] = { resolve, reject };
  //         try {
  //           cb();
  //         } catch(exception) {
  //           console.warn(exception);
  //         }
  //       });
  //       return promise;
  //     }
  //     window.nfcController = {
  //       readMessage: (argObj) => {
  //         const serializedArgObj = JSON.stringify(argObj);
  //         return __createPromise(() => __native_nfcRead.postMessage(serializedArgObj));
  //       },
  //       writeMessage: (argObj) => {
  //         const serializedArgObj = JSON.stringify(argObj);
  //         return __createPromise(() => __native_nfcWrite.postMessage(serializedArgObj));
  //       }
  //     }
  //     console.log('Javascript interfaces was initialized.');
  //   ''');
  // }

  // Future<void> _log(String text) async {
  //   await _controller.runJavaScript('console.log(`$text`)');
  // }

  // void _resolvePromise({required String id, String? result}) {
  //   _controller.runJavaScript('__resolvePromise(`$id`, `$result`)');
  // }
}

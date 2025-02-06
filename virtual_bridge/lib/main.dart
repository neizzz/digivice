// ignore_for_file: avoid_print

import 'package:digivice_virtual_bridge/nfc.dart';
import 'package:digivice_virtual_bridge/nfc_p2p.dart';
import 'package:digivice_virtual_bridge/pip.dart';
import 'package:flutter/material.dart';
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
  final AndroidOverlayController _androidOverlayController =
      AndroidOverlayController();
  // late NfcController _nfcController;
  late NfcP2pController _nfcP2pController;

  WebView({super.key});

  @override
  Widget build(BuildContext context) {
    // _nfcController = NfcController();
    _nfcP2pController = NfcP2pController();
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
      ..addJavaScriptChannel('__native_pipEnter',
          onMessageReceived: _handlePipEnter)
      ..addJavaScriptChannel('__native_pipExit',
          onMessageReceived: _handlePipExit)
      ..loadRequest(Uri.parse('http://172.20.37.209:5173/'));

    return WebViewWidget(
      controller: _controller,
    );
  }

  /// message.message: {id: string, message: string}
  void _handleNfcRead(JavaScriptMessage message) async {
    await _log('_handleNfcRead message: $message.message');
    var jsArgs = jsonDecode(message.message);
    await _log('_handleNfcRead message: $jsArgs');
    // _nfcController.startReading(onRead: ({required String readMessage}) {
    //   print('onRead called');
    //   _resolvePromise(id: jsArgs['id'], data: readMessage);
    // });
    _nfcP2pController.startRequestSession(message: jsArgs['args']['message']);
  }

  void _handleNfcWrite(JavaScriptMessage message) async {
    Map<String, dynamic> jsArgs = jsonDecode(message.message);
    // _nfcController.startWriting(
    //     message: jsArgs['args']['message'],
    //     onWritten: ({required String writtenMessage}) {
    //       print('onWritten called');
    //       _resolvePromise(id: jsArgs['id'], data: writtenMessage);
    //     });
    _nfcP2pController.startRespondSession(message: jsArgs['args']['message']);
  }

  void _handleNfcStop(JavaScriptMessage message) async {
    Map<String, dynamic> jsArgs = jsonDecode(message.message);
    // _nfcController.stop(onStop: () {
    //   print('onStop called');
    //   _resolvePromise(id: jsArgs['id']);
    // })

    // TODO: _nfcP2pController.stopRespondSession();
  }

  void _handlePipEnter(JavaScriptMessage message) async {
    Map<String, dynamic> jsArgs = jsonDecode(message.message);
    try {
      _androidOverlayController.showOverlay();
      _resolvePromise(id: jsArgs['id'], data: 'PiP enabled');
    } catch (e) {
      _resolvePromise(id: jsArgs['id'], data: 'Error: ${e.toString()}');
    }
  }

  void _handlePipExit(JavaScriptMessage message) async {
    Map<String, dynamic> jsArgs = jsonDecode(message.message);
    try {
      _androidOverlayController.closeOverlay();
      _resolvePromise(id: jsArgs['id'], data: 'PiP disabled');
    } catch (e) {
      _resolvePromise(id: jsArgs['id'], data: 'Error: ${e.toString()}');
    }
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
      };
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
      console.log('Javascript interfaces was initialized.');
    ''');
  }

  Future<void> _log(String message) async {
    await _controller.runJavaScript('console.log(`[WebView] $message`)');
  }

  void _resolvePromise({required String id, String? data}) {
    _controller.runJavaScript('__resolvePromise(`$id`, `$data`)');
  }
}

// ignore_for_file: avoid_print

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'dart:async';
import 'bridge_configurator.dart';

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
  late final BridgeConfigurator _bridgeConfigurator;

  WebView({super.key}) {
    // BridgeConfigurator 초기화
    _bridgeConfigurator = BridgeConfigurator(
      webViewController: _controller,
      logCallback: _log,
    );
  }

  @override
  Widget build(BuildContext context) {
    // WebViewController 기본 설정
    _controller
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..loadRequest(Uri.parse('http://192.168.219.114:5173/'));

    // 브릿지 설정
    _bridgeConfigurator.setupBridge();

    return WebViewWidget(
      controller: _controller,
    );
  }

  Future<void> _log(String message) async {
    print(message);
  }
}

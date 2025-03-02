import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'bridge_configurator.dart';
// 미니뷰 컨트롤러와 iOS 스트리밍 컨트롤러 임포트 제거

class MainWebView extends StatefulWidget {
  final String initialUrl;

  const MainWebView({
    Key? key,
    required this.initialUrl,
  }) : super(key: key);

  @override
  _MainWebViewState createState() => _MainWebViewState();
}

class _MainWebViewState extends State<MainWebView> {
  late final WebViewController _webViewController;
  late final BridgeConfigurator _bridgeConfigurator;
  final List<String> _logs = [];

  @override
  void initState() {
    super.initState();
    _initWebView();
  }

  void _initWebView() {
    _webViewController = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(NavigationDelegate(
        onPageFinished: (url) {
          _setupBridge();
        },
      ))
      ..loadRequest(Uri.parse(widget.initialUrl));

    _bridgeConfigurator = BridgeConfigurator(
      webViewController: _webViewController,
      logCallback: _addLog,
    );
  }

  Future<void> _setupBridge() async {
    await _bridgeConfigurator.setupBridge();
  }

  void _addLog(String message) {
    setState(() {
      _logs.add('${DateTime.now()}: $message');
      if (_logs.length > 100) {
        _logs.removeAt(0);
      }
    });
  }

  @override
  void dispose() {
    _bridgeConfigurator.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('WebView'),
      ),
      body: WebViewWidget(controller: _webViewController),
    );
  }
}

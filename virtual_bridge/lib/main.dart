// ignore_for_file: avoid_print

import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'bridge_configurator.dart';

String mapToString(Map<String, dynamic> map) {
  return map.entries
      .map((entry) => "[${entry.key}, ${entry.value}]")
      .join(", ");
}

void main() async {
  // Flutter 바인딩 초기화
  WidgetsFlutterBinding.ensureInitialized();

  if (Platform.isAndroid) {
    await AndroidWebViewController.enableDebugging(true);
  }

  // AdMob 초기화
  await MobileAds.instance.initialize();
  print('[AdMob] Initialized successfully');

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
  runApp(
    const MaterialApp(
      color: Color.fromARGB(255, 255, 0, 0),
      debugShowCheckedModeBanner: true,
      home: Material(child: Text("My overlay")),
    ),
  );
}

class WebView extends StatefulWidget {
  const WebView({super.key});

  @override
  State<WebView> createState() => _WebViewState();
}

class _WebViewState extends State<WebView> {
  static const bool _stopAppOnAsset404 = false;

  final WebViewController _controller = WebViewController();
  late final BridgeConfigurator _bridgeConfigurator;
  HttpServer? _assetServer;
  int? _assetServerPort;
  String? _errorMessage;
  final Set<String> _missingAssetPathsLogged = <String>{};

  @override
  void initState() {
    super.initState();

    // BridgeConfigurator 초기화
    _bridgeConfigurator = BridgeConfigurator(
      webViewController: _controller,
      logCallback: _log,
      // 터미널 로그 폭주 방지를 위해 WebView console 포워딩은 기본 비활성화
      forwardConsoleMessages: false,
    );

    unawaited(_initializeWebView());
  }

  @override
  Widget build(BuildContext context) {
    final double keyboardInset = MediaQuery.viewInsetsOf(context).bottom;
    final Widget content;

    if (_errorMessage != null) {
      content = Center(
        child: Text(
          _errorMessage!,
          textAlign: TextAlign.center,
        ),
      );
    } else if (_assetServerPort == null) {
      content = const Center(child: CircularProgressIndicator());
    } else {
      content = WebViewWidget(controller: _controller);
    }

    return SafeArea(
      child: AnimatedPadding(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        padding: EdgeInsets.only(bottom: keyboardInset),
        child: content,
      ),
    );
  }

  Future<void> _initializeWebView() async {
    await _startAssetServer();

    // 기본 User Agent 문자열에 플랫폼 정보 추가
    final String platformInfo = Platform.isAndroid
        ? 'DigiviceApp-Android'
        : Platform.isIOS
            ? 'DigiviceApp-iOS'
            : 'DigiviceApp-${Platform.operatingSystem}';

    // WebViewController 기본 설정
    _controller
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) async {
            await _bridgeConfigurator.injectJavaScriptInterfaces();
          },
        ),
      )
      ..setUserAgent(platformInfo);

    // Android 플랫폼 설정
    if (_controller.platform is AndroidWebViewController) {
      final androidController =
          _controller.platform as AndroidWebViewController;
      await androidController.setAllowFileAccess(true);
    }

    // 브릿지 설정
    await _bridgeConfigurator.setupBridge();

    await _controller.loadRequest(
      Uri.parse('http://127.0.0.1:$_assetServerPort/index.html'),
    );

    if (mounted) {
      setState(() {});
    }
  }

  Future<void> _startAssetServer() async {
    try {
      _assetServer = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      _assetServerPort = _assetServer!.port;
      _assetServer!.listen(_handleAssetRequest);
      print(
          '[WebView] Local asset server started on 127.0.0.1:$_assetServerPort');
    } catch (e) {
      _errorMessage = '로컬 웹 서버 시작 실패: $e';
      print('[WebView] Failed to start local asset server: $e');
    }
  }

  Future<void> _handleAssetRequest(HttpRequest request) async {
    final String rawPath = request.uri.path;
    final String path =
        (rawPath.isEmpty || rawPath == '/') ? '/index.html' : rawPath;

    // 브라우저가 자동으로 요청하는 favicon은 앱 필수 리소스가 아니므로 무시
    if (path == '/favicon.ico') {
      request.response.statusCode = HttpStatus.noContent;
      await request.response.close();
      return;
    }

    final List<String> candidateAssetPaths = <String>[
      'assets/web$path',
    ];

    // 빌드/패키징 환경에 따라 /assets 하위가 assets/web/assets/** 또는
    // assets/web/**로 들어가는 차이를 흡수합니다.
    if (path.startsWith('/assets/')) {
      final String withoutAssetsPrefix = path.replaceFirst('/assets', '');
      candidateAssetPaths.add('assets/web/assets$withoutAssetsPrefix');
      candidateAssetPaths.add('assets/web$withoutAssetsPrefix');
    }

    ByteData? loadedData;
    for (final candidate in candidateAssetPaths) {
      try {
        loadedData = await rootBundle.load(candidate);
        break;
      } catch (_) {
        // try next candidate
      }
    }

    if (loadedData != null) {
      final bytes = loadedData.buffer
          .asUint8List(loadedData.offsetInBytes, loadedData.lengthInBytes);

      request.response.statusCode = HttpStatus.ok;
      request.response.headers.contentType = _contentTypeForPath(path);
      request.response.headers.set('Cache-Control', 'no-cache');
      request.response.add(bytes);
      await request.response.close();
      return;
    }

    {
      if (_missingAssetPathsLogged.add(path)) {
        print(
            '@@ASSET404@@ request=$path tried=${candidateAssetPaths.join(',')}');

        if (_stopAppOnAsset404) {
          // 404가 감지되면 즉시 앱을 종료해 원인 파악을 쉽게 합니다.
          request.response.statusCode = HttpStatus.internalServerError;
          request.response.headers.contentType = ContentType.text;
          request.response.write('ASSET404: $path');
          await request.response.close();
          await Future<void>.delayed(const Duration(milliseconds: 50));
          exit(42);
        }
      }

      // SPA 라우팅 경로는 index.html로 폴백
      if (!path.contains('.')) {
        try {
          final ByteData indexData =
              await rootBundle.load('assets/web/index.html');
          final bytes = indexData.buffer
              .asUint8List(indexData.offsetInBytes, indexData.lengthInBytes);
          request.response.statusCode = HttpStatus.ok;
          request.response.headers.contentType = ContentType.html;
          request.response.headers.set('Cache-Control', 'no-cache');
          request.response.add(bytes);
          await request.response.close();
          return;
        } catch (e) {
          print('[WebView] Failed to load index fallback: $e');
        }
      }

      request.response.statusCode = HttpStatus.notFound;
      request.response.headers.contentType = ContentType.text;
      request.response.write('Not Found: $path');
      await request.response.close();
    }
  }

  ContentType _contentTypeForPath(String path) {
    if (path.endsWith('.html')) return ContentType.html;
    if (path.endsWith('.js') || path.endsWith('.mjs')) {
      return ContentType('application', 'javascript', charset: 'utf-8');
    }
    if (path.endsWith('.css'))
      return ContentType('text', 'css', charset: 'utf-8');
    if (path.endsWith('.json')) {
      return ContentType('application', 'json', charset: 'utf-8');
    }
    if (path.endsWith('.png')) return ContentType('image', 'png');
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      return ContentType('image', 'jpeg');
    }
    if (path.endsWith('.gif')) return ContentType('image', 'gif');
    if (path.endsWith('.svg')) {
      return ContentType('image', 'svg+xml', charset: 'utf-8');
    }
    if (path.endsWith('.webp')) return ContentType('image', 'webp');
    if (path.endsWith('.wasm')) return ContentType('application', 'wasm');
    return ContentType.binary;
  }

  @override
  void dispose() {
    _assetServer?.close(force: true);
    super.dispose();
  }

  Future<void> _log(String message) async {
    // 브릿지 로그가 많아 디버깅이 어려우므로, 에셋 404 마커 로그만 우선 노출
    if (message.contains('@@ASSET404@@')) {
      print(message);
    }
  }
}

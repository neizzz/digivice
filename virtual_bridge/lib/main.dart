// ignore_for_file: avoid_print

import 'dart:async';
import 'dart:convert';
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
      color: const Color(0xFF000000),
      builder: (context, _) => const WebView(),
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

class _WebViewState extends State<WebView> with WidgetsBindingObserver {
  static const bool _stopAppOnAsset404 = false;

  final WebViewController _controller = WebViewController();
  late final BridgeConfigurator _bridgeConfigurator;
  HttpServer? _assetServer;
  int? _assetServerPort;
  String? _errorMessage;
  final Set<String> _missingAssetPathsLogged = <String>{};
  final List<Timer> _viewportSyncTimers = <Timer>[];
  bool _isPageReady = false;
  bool _isFullscreenAdShowing = false;
  String? _lastViewportMetricsKey;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    // BridgeConfigurator 초기화
    _bridgeConfigurator = BridgeConfigurator(
      webViewController: _controller,
      logCallback: _log,
      // 터미널 로그 폭주 방지를 위해 WebView console 포워딩은 기본 비활성화
      forwardConsoleMessages: false,
      onFullscreenAdStateChanged: _handleFullscreenAdStateChanged,
    );

    unawaited(_initializeWebView());
  }

  @override
  void reassemble() {
    super.reassemble();
    unawaited(_reloadWebViewForHotReload());
  }

  @override
  Widget build(BuildContext context) {
    final double keyboardInset = MediaQuery.viewInsetsOf(context).bottom;
    final Widget content;

    if (_errorMessage != null) {
      content = ColoredBox(
        color: Colors.black,
        child: Center(
          child: Text(
            _errorMessage!,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white),
          ),
        ),
      );
    } else if (_assetServerPort == null) {
      content = const ColoredBox(
        color: Colors.black,
        child: Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
          ),
        ),
      );
    } else {
      content = ColoredBox(
        color: Colors.black,
        child: WebViewWidget(controller: _controller),
      );
    }

    return PopScope<void>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) {
          return;
        }

        unawaited(_handleBackNavigation());
      },
      child: SafeArea(
        child: Padding(
          padding: keyboardInset > 0
              ? EdgeInsets.only(bottom: keyboardInset)
              : EdgeInsets.zero,
          child: content,
        ),
      ),
    );
  }

  Future<void> _handleBackNavigation() async {
    final bool canGoBack = await _controller.canGoBack();

    if (canGoBack) {
      await _controller.goBack();
      return;
    }

    await SystemNavigator.pop();
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
      ..setBackgroundColor(const Color(0xFF000000))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) async {
            await _bridgeConfigurator.injectJavaScriptInterfaces();
            _isPageReady = true;
            _scheduleViewportSync('page_finished');
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

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    print('[WebViewLifecycle] appLifecycleState=$state');

    if (state == AppLifecycleState.resumed) {
      _scheduleViewportSync(
        'flutter.lifecycle.resumed',
        dispatchLifecycleEvents: true,
        force: true,
      );
    }
  }

  @override
  void didChangeMetrics() {
    final view = WidgetsBinding.instance.platformDispatcher.views.first;
    final Size logicalSize = view.physicalSize / view.devicePixelRatio;

    print(
      '[WebViewLifecycle] didChangeMetrics '
      'physical=${view.physicalSize.width}x${view.physicalSize.height} '
      'logical=${logicalSize.width}x${logicalSize.height} '
      'dpr=${view.devicePixelRatio}',
    );

    _scheduleViewportSync('flutter.metrics_changed');
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

  Future<void> _reloadWebViewForHotReload() async {
    final int? port = _assetServerPort;
    if (port == null) {
      return;
    }

    final Uri uri = Uri.parse('http://127.0.0.1:$port/index.html').replace(
      queryParameters: <String, String>{
        'hotReload': DateTime.now().millisecondsSinceEpoch.toString(),
      },
    );

    try {
      print('[WebView] Hot reload detected. Reloading $uri');
      await _controller.loadRequest(uri);
    } catch (e) {
      print('[WebView] Failed to reload WebView on hot reload: $e');
    }
  }

  void _scheduleViewportSync(
    String reason, {
    List<int> delays = const <int>[0],
    bool dispatchLifecycleEvents = false,
    bool force = false,
  }) {
    if (!_isPageReady) {
      print('[WebViewLifecycle] skip viewport sync before page ready: $reason');
      return;
    }

    if (_isFullscreenAdShowing && !force) {
      print(
        '[WebViewLifecycle] skip viewport sync while fullscreen ad is showing: $reason',
      );
      return;
    }

    final String metricsKey = _buildViewportMetricsKey();
    if (!force && metricsKey == _lastViewportMetricsKey) {
      print('[WebViewLifecycle] skip duplicate viewport sync: $reason');
      return;
    }

    _lastViewportMetricsKey = metricsKey;
    _cancelViewportSyncTimers();

    for (final int delayMs in delays) {
      final timer = Timer(Duration(milliseconds: delayMs), () {
        unawaited(
          _dispatchViewportSync(
            '$reason@${delayMs}ms',
            dispatchLifecycleEvents: dispatchLifecycleEvents,
          ),
        );
      });
      _viewportSyncTimers.add(timer);
    }
  }

  void _cancelViewportSyncTimers() {
    for (final timer in _viewportSyncTimers) {
      timer.cancel();
    }
    _viewportSyncTimers.clear();
  }

  String _buildViewportMetricsKey() {
    final view = WidgetsBinding.instance.platformDispatcher.views.first;
    final Size logicalSize = view.physicalSize / view.devicePixelRatio;
    final double bottomInset = view.viewInsets.bottom / view.devicePixelRatio;

    return [
      logicalSize.width.round(),
      logicalSize.height.round(),
      view.devicePixelRatio.toStringAsFixed(3),
      bottomInset.round(),
    ].join('|');
  }

  void _handleFullscreenAdStateChanged(String state) {
    print('[WebViewLifecycle] fullscreenAdState=$state');

    if (state == 'showing') {
      _isFullscreenAdShowing = true;
      _cancelViewportSyncTimers();
      return;
    }

    _isFullscreenAdShowing = false;
    _scheduleViewportSync(
      'flutter.fullscreen_ad.$state',
      delays: const <int>[180],
      force: true,
    );
  }

  Future<void> _dispatchViewportSync(
    String reason, {
    bool dispatchLifecycleEvents = false,
  }) async {
    if (!_isPageReady) {
      return;
    }

    print('[WebViewLifecycle] dispatchViewportSync reason=$reason');

    final String encodedReason = jsonEncode(reason);
    final String encodedDispatchLifecycleEvents = jsonEncode(
      dispatchLifecycleEvents,
    );
    try {
      await _controller.runJavaScript('''
        (() => {
          const reason = $encodedReason;
          const dispatchLifecycleEvents = $encodedDispatchLifecycleEvents;
          const payload = {
            reason,
            dispatchLifecycleEvents,
            timestamp: new Date().toISOString(),
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio,
            screenWidth: window.screen?.width ?? null,
            screenHeight: window.screen?.height ?? null,
            visibilityState: document.visibilityState,
            visualViewportWidth: window.visualViewport?.width ?? null,
            visualViewportHeight: window.visualViewport?.height ?? null,
            visualViewportScale: window.visualViewport?.scale ?? null,
          };

          console.log('[NativeViewportSync] dispatch', payload);

          try { window.dispatchEvent(new Event('resize')); } catch (_) {}
          try {
            if (window.visualViewport) {
              window.visualViewport.dispatchEvent(new Event('resize'));
              window.visualViewport.dispatchEvent(new Event('scroll'));
            }
          } catch (_) {}

          if (dispatchLifecycleEvents) {
            try { window.dispatchEvent(new Event('focus')); } catch (_) {}
            try { window.dispatchEvent(new Event('pageshow')); } catch (_) {}
          }

          try {
            window.dispatchEvent(
              new CustomEvent('digivice:native-viewport-sync', {
                detail: payload,
              }),
            );
          } catch (_) {}
        })();
      ''');
    } catch (error) {
      print(
        '[WebViewLifecycle] dispatchViewportSync failed '
        'reason=$reason error=$error',
      );
    }
  }

  Future<void> _handleAssetRequest(HttpRequest request) async {
    final String rawPath = request.uri.path;
    final String path;

    if (rawPath.isEmpty ||
        rawPath == '/' ||
        rawPath == '/index' ||
        rawPath == '/index/') {
      path = '/index.html';
    } else {
      path = rawPath;
    }

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
    if (path.endsWith('.css')) {
      return ContentType('text', 'css', charset: 'utf-8');
    }
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
    WidgetsBinding.instance.removeObserver(this);
    _cancelViewportSyncTimers();
    _isPageReady = false;
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

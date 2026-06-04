// ignore_for_file: avoid_print

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui' show FrameTiming;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'bridge_configurator.dart';
import 'update/update_blocking_overlay.dart';
import 'update/update_coordinator.dart';

String mapToString(Map<String, dynamic> map) {
  return map.entries
      .map((entry) => "[${entry.key}, ${entry.value}]")
      .join(", ");
}

void main() async {
  // Flutter 바인딩 초기화
  WidgetsFlutterBinding.ensureInitialized();

  if (Platform.isAndroid) {
    await AndroidWebViewController.enableDebugging(!kReleaseMode);
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
  static const MethodChannel _backNavigationChannel =
      MethodChannel('digivice/back_navigation');
  static const MethodChannel _homeWidgetChannel =
      MethodChannel('digivice/home_widget');
  static const String _nativeDiagnosticsSinkName =
      '__digiviceNativeBridgeDiagnostics';
  static const bool _stopAppOnAsset404 = false;
  static const double _flutterFrameBudgetMs = 16.7;
  static const double _flutterFrameWarningMs = 20;
  static const double _flutterFrameCriticalMs = 33.3;
  static const int _flutterFrameSummaryBatchSize = 180;
  static const int _maxPendingFlutterFrameDiagnosticsPayloads = 48;
  static const Set<String> _webEntrypointPaths = <String>{
    '/index.html',
    '/index2.html',
    '/monster-animations.html',
  };

  final WebViewController _controller = WebViewController();
  late final BridgeConfigurator _bridgeConfigurator;
  late final UpdateCoordinator _updateCoordinator;
  HttpServer? _assetServer;
  int? _assetServerPort;
  String? _errorMessage;
  final Set<String> _missingAssetPathsLogged = <String>{};
  final List<Timer> _viewportSyncTimers = <Timer>[];
  final List<String> _pendingUpdateDiagnosticsLogs = <String>[];
  final List<Map<String, dynamic>> _pendingFlutterFrameDiagnosticsPayloads =
      <Map<String, dynamic>>[];
  bool _isPageReady = false;
  bool _isFullscreenAdShowing = false;
  String? _lastViewportMetricsKey;
  int _flutterFrameSummarySequence = 0;
  int _flutterFrameSummarySampleCount = 0;
  int _flutterFrameSummaryWarningCount = 0;
  int _flutterFrameSummaryCriticalCount = 0;
  double _flutterFrameSummaryMaxTotalMs = 0;
  double _flutterFrameSummaryMaxBuildMs = 0;
  double _flutterFrameSummaryMaxRasterMs = 0;

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
      enableStructuredDebugLogs: !kReleaseMode,
      onFullscreenAdStateChanged: _handleFullscreenAdStateChanged,
    );

    _updateCoordinator = UpdateCoordinator(log: _handleUpdateCoordinatorLog);
    _updateCoordinator.addListener(_handleUpdateCoordinatorChanged);
    WidgetsBinding.instance.addTimingsCallback(_handleFlutterFrameTimings);
    _backNavigationChannel.setMethodCallHandler(_handleBackNavigationCall);

    unawaited(
        _updateCoordinator.checkForMandatoryUpdate(reason: 'app_started'));
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
    final UpdateEnforcementState updateState = _updateCoordinator.state;
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
        child: _buildWebViewWidget(),
      );
    }

    final Widget layeredContent = Stack(
      fit: StackFit.expand,
      children: <Widget>[
        Positioned.fill(child: content),
        if (updateState.isBlocking)
          Positioned.fill(
            child: UpdateBlockingOverlay(
              state: updateState,
              onRetry: _updateCoordinator.retryImmediateUpdate,
              onOpenStore: _updateCoordinator.openPlayStoreListing,
              onExitApp: _exitApp,
            ),
          ),
      ],
    );

    return PopScope<void>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) {
          return;
        }

        if (_updateCoordinator.state.isBlocking) {
          return;
        }

        unawaited(_handleBackNavigation());
      },
      child: SafeArea(
        child: Padding(
          padding: keyboardInset > 0
              ? EdgeInsets.only(bottom: keyboardInset)
              : EdgeInsets.zero,
          child: layeredContent,
        ),
      ),
    );
  }

  Future<void> _exitApp() async {
    await SystemNavigator.pop();
  }

  Widget _buildWebViewWidget() {
    final platformParams = PlatformWebViewWidgetCreationParams(
      controller: _controller.platform,
    );

    if (Platform.isAndroid) {
      final androidParams = AndroidWebViewWidgetCreationParams
          .fromPlatformWebViewWidgetCreationParams(
        platformParams,
        displayWithHybridComposition: true,
      );

      return WebViewWidget.fromPlatformCreationParams(params: androidParams);
    }

    return WebViewWidget.fromPlatformCreationParams(params: platformParams);
  }

  Future<String> _handleBackNavigationCall(MethodCall call) async {
    if (call.method != 'handleBackNavigation') {
      throw PlatformException(
        code: 'not_implemented',
        message: 'Unknown back navigation method: ${call.method}',
      );
    }

    if (_updateCoordinator.state.isBlocking) {
      return 'blocked';
    }

    await _handleBackNavigation();
    return 'handled';
  }

  Future<void> _handleBackNavigation() async {
    final String? webBackNavigationAction = await _requestWebBackNavigation();

    if (webBackNavigationAction == 'consumed') {
      await _log('[BackNavigation] Consumed by web app');
      return;
    }

    if (await _requestManagedJavaScriptHistoryBack()) {
      if (webBackNavigationAction == 'exit') {
        await _log(
          '[BackNavigation] Web requested exit, but managed web history is available. Dispatching window.history.back().',
        );
      } else {
        await _log(
            '[BackNavigation] Dispatching managed window.history.back()');
      }
      return;
    }

    final bool canGoBack = await _controller.canGoBack();

    if (canGoBack) {
      if (webBackNavigationAction == 'exit') {
        await _log(
          '[BackNavigation] Web requested exit, but WebView history is available. Going back first.',
        );
      } else {
        await _log('[BackNavigation] Falling back to WebView history');
      }
      await _controller.goBack();
      return;
    }

    if (webBackNavigationAction == 'exit') {
      await _log('[BackNavigation] Exiting from MainScene');
      await SystemNavigator.pop();
      return;
    }

    await _log('[BackNavigation] Falling back to app exit');
    await SystemNavigator.pop();
  }

  Future<bool> _requestManagedJavaScriptHistoryBack() async {
    try {
      final Object result = await _controller.runJavaScriptReturningResult('''
        (() => {
          try {
            const entries =
              window &&
              window.history &&
              window.history.state &&
              window.history.state.__digiviceBackEntries;

            if (Array.isArray(entries) && entries.length > 0) {
              window.history.back();
              return true;
            }

            return false;
          } catch (error) {
            console.error('[BackNavigation] Failed to dispatch managed history back', error);
            return false;
          }
        })();
      ''');

      final bool didDispatchBack = _parseJavaScriptBooleanResult(result);
      return didDispatchBack;
    } catch (error) {
      await _log(
          '[BackNavigation] Failed to dispatch managed history back: $error');
      return false;
    }
  }

  Future<String?> _requestWebBackNavigation() async {
    try {
      final Object result = await _controller.runJavaScriptReturningResult('''
        (() => {
          try {
            if (
              typeof window !== 'undefined' &&
              window.digivicePopupBackBridge &&
              typeof window.digivicePopupBackBridge.handleBackNavigation === 'function' &&
              window.digivicePopupBackBridge.handleBackNavigation()
            ) {
              return 'consumed';
            }

            const popupBackEvent =
              typeof CustomEvent === 'function'
                ? new CustomEvent('digivice:native-back-request', {
                    cancelable: true,
                  })
                : new Event('digivice:native-back-request', {
                    cancelable: true,
                  });

            window.dispatchEvent(popupBackEvent);

            if (popupBackEvent.defaultPrevented) {
              return 'consumed';
            }

            if (
              typeof window === 'undefined' ||
              !window.digiviceBackBridge ||
              typeof window.digiviceBackBridge.handleBackNavigation !== 'function'
            ) {
              return null;
            }

            return window.digiviceBackBridge.handleBackNavigation();
          } catch (error) {
            console.error('[BackNavigation] Failed to handle native back press', error);
            return null;
          }
        })();
      ''');

      return _parseJavaScriptStringResult(result);
    } catch (error) {
      await _log('[BackNavigation] Failed to query web app: $error');
      return null;
    }
  }

  String? _parseJavaScriptStringResult(Object? result) {
    if (result is String) {
      return _normalizeJavaScriptStringResult(result);
    }

    if (result == null) {
      return null;
    }

    return _normalizeJavaScriptStringResult(result.toString());
  }

  bool _parseJavaScriptBooleanResult(Object? result) {
    if (result is bool) {
      return result;
    }

    if (result == null) {
      return false;
    }

    final String normalized = result.toString().trim().toLowerCase();

    if (normalized == 'true' || normalized == '"true"') {
      return true;
    }

    return false;
  }

  String? _normalizeJavaScriptStringResult(String result) {
    final String normalized = result.trim().toLowerCase();

    if (normalized == 'consumed' || normalized == 'exit') {
      return normalized;
    }

    if (normalized.isEmpty ||
        normalized == 'null' ||
        normalized == 'undefined') {
      return null;
    }

    if (normalized.startsWith('"') && normalized.endsWith('"')) {
      return _normalizeJavaScriptStringResult(
        normalized.substring(1, normalized.length - 1),
      );
    }

    return null;
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
            await _flushPendingUpdateDiagnosticsLogs();
            await _flushPendingFlutterFrameDiagnosticsPayloads();
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
      await androidController.setMediaPlaybackRequiresUserGesture(false);
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
    unawaited(_dispatchAppLifecycleEvent(state));

    if (state == AppLifecycleState.resumed) {
      unawaited(
        _updateCoordinator.checkForMandatoryUpdate(
          reason: 'app_resumed',
          force: true,
        ),
      );
      _scheduleViewportSync(
        'flutter.lifecycle.resumed',
        dispatchLifecycleEvents: true,
        force: true,
      );
    }
  }

  Future<void> _dispatchAppLifecycleEvent(AppLifecycleState state) async {
    if (!_isPageReady) {
      return;
    }

    final String encodedState = jsonEncode(state.name);
    final String encodedTimestamp =
        jsonEncode(DateTime.now().toIso8601String());
    final String encodedLaunchMode = jsonEncode(await _getLaunchMode());

    try {
      await _controller.runJavaScript('''
        (() => {
          try {
            window.dispatchEvent(
              new CustomEvent('digivice:native-app-lifecycle', {
                detail: {
                  state: $encodedState,
                  timestamp: $encodedTimestamp,
                  launchMode: $encodedLaunchMode,
                },
              }),
            );
          } catch (_) {}
        })();
      ''');
    } catch (error) {
      print(
        '[WebViewLifecycle] dispatchAppLifecycleEvent failed '
        'state=${state.name} error=$error',
      );
    }
  }

  Future<String> _getLaunchMode() async {
    try {
      final Map<Object?, Object?>? result =
          await _homeWidgetChannel.invokeMethod<Map<Object?, Object?>>(
        'getLaunchContext',
      );
      final Object? mode = result?['mode'];
      return mode is String && mode.isNotEmpty ? mode : 'default';
    } catch (_) {
      return 'default';
    }
  }

  @override
  void didChangeMetrics() {
    _scheduleViewportSync('flutter.metrics_changed');
  }

  Future<void> _startAssetServer() async {
    try {
      _assetServer = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      _assetServerPort = _assetServer!.port;
      _assetServer!.listen(_handleAssetRequest);
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
      return;
    }

    if (_isFullscreenAdShowing && !force) {
      return;
    }

    final String metricsKey = _buildViewportMetricsKey();
    if (!force && metricsKey == _lastViewportMetricsKey) {
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

  void _handleUpdateCoordinatorChanged() {
    if (!mounted) {
      return;
    }

    setState(() {});
  }

  Future<void> _handleUpdateCoordinatorLog(String message) async {
    if (!_isPageReady) {
      _enqueuePendingUpdateDiagnosticsLog(message);
      return;
    }

    await _emitUpdateDiagnosticsLog(message);
  }

  void _enqueuePendingUpdateDiagnosticsLog(String message) {
    if (_pendingUpdateDiagnosticsLogs.length >= 100) {
      _pendingUpdateDiagnosticsLogs.removeAt(0);
    }

    _pendingUpdateDiagnosticsLogs.add(message);
  }

  void _handleFlutterFrameTimings(List<FrameTiming> timings) {
    for (final FrameTiming timing in timings) {
      final double totalMs = _durationToMs(timing.totalSpan);
      final double buildMs = _durationToMs(timing.buildDuration);
      final double rasterMs = _durationToMs(timing.rasterDuration);
      final double vsyncOverheadMs = _durationToMs(timing.vsyncOverhead);

      _flutterFrameSummarySequence += 1;
      _flutterFrameSummarySampleCount += 1;
      if (totalMs >= _flutterFrameWarningMs) {
        _flutterFrameSummaryWarningCount += 1;
      }
      if (totalMs >= _flutterFrameCriticalMs) {
        _flutterFrameSummaryCriticalCount += 1;
      }
      _flutterFrameSummaryMaxTotalMs = totalMs > _flutterFrameSummaryMaxTotalMs
          ? totalMs
          : _flutterFrameSummaryMaxTotalMs;
      _flutterFrameSummaryMaxBuildMs = buildMs > _flutterFrameSummaryMaxBuildMs
          ? buildMs
          : _flutterFrameSummaryMaxBuildMs;
      _flutterFrameSummaryMaxRasterMs =
          rasterMs > _flutterFrameSummaryMaxRasterMs
              ? rasterMs
              : _flutterFrameSummaryMaxRasterMs;

      if (totalMs >= _flutterFrameCriticalMs) {
        _queueFlutterFrameDiagnosticsPayload(
          <String, dynamic>{
            'type': 'flutter_frame_critical',
            'sequence': _flutterFrameSummarySequence,
            'frameBudgetMs': _flutterFrameBudgetMs,
            'warningThresholdMs': _flutterFrameWarningMs,
            'criticalThresholdMs': _flutterFrameCriticalMs,
            'totalSpanMs': totalMs,
            'buildMs': buildMs,
            'rasterMs': rasterMs,
            'vsyncOverheadMs': vsyncOverheadMs,
          },
        );
      }
    }

    if (_flutterFrameSummarySampleCount >= _flutterFrameSummaryBatchSize) {
      final Map<String, dynamic> summaryPayload =
          _buildFlutterFrameSummaryPayload();
      if ((summaryPayload['warningCount'] as int) > 0 ||
          (summaryPayload['criticalCount'] as int) > 0) {
        _queueFlutterFrameDiagnosticsPayload(summaryPayload);
      }
      _resetFlutterFrameSummary();
    }
  }

  double _durationToMs(Duration duration) {
    return double.parse(
      (duration.inMicroseconds / 1000).toStringAsFixed(2),
    );
  }

  Map<String, dynamic> _buildFlutterFrameSummaryPayload() {
    return <String, dynamic>{
      'type': 'flutter_frame_summary',
      'sequence': _flutterFrameSummarySequence,
      'sampleCount': _flutterFrameSummarySampleCount,
      'frameBudgetMs': _flutterFrameBudgetMs,
      'warningThresholdMs': _flutterFrameWarningMs,
      'criticalThresholdMs': _flutterFrameCriticalMs,
      'warningCount': _flutterFrameSummaryWarningCount,
      'criticalCount': _flutterFrameSummaryCriticalCount,
      'maxTotalSpanMs':
          double.parse(_flutterFrameSummaryMaxTotalMs.toStringAsFixed(2)),
      'maxBuildMs':
          double.parse(_flutterFrameSummaryMaxBuildMs.toStringAsFixed(2)),
      'maxRasterMs':
          double.parse(_flutterFrameSummaryMaxRasterMs.toStringAsFixed(2)),
    };
  }

  void _resetFlutterFrameSummary() {
    _flutterFrameSummarySampleCount = 0;
    _flutterFrameSummaryWarningCount = 0;
    _flutterFrameSummaryCriticalCount = 0;
    _flutterFrameSummaryMaxTotalMs = 0;
    _flutterFrameSummaryMaxBuildMs = 0;
    _flutterFrameSummaryMaxRasterMs = 0;
  }

  void _queueFlutterFrameDiagnosticsPayload(Map<String, dynamic> payload) {
    final Map<String, dynamic> normalizedPayload = <String, dynamic>{
      ...payload,
      'timestamp': DateTime.now().toIso8601String(),
    };

    if (!_isPageReady) {
      if (_pendingFlutterFrameDiagnosticsPayloads.length >=
          _maxPendingFlutterFrameDiagnosticsPayloads) {
        _pendingFlutterFrameDiagnosticsPayloads.removeAt(0);
      }

      _pendingFlutterFrameDiagnosticsPayloads.add(normalizedPayload);
      return;
    }

    unawaited(_emitFlutterFrameDiagnosticsPayload(normalizedPayload));
  }

  Future<void> _flushPendingFlutterFrameDiagnosticsPayloads() async {
    if (!_isPageReady || _pendingFlutterFrameDiagnosticsPayloads.isEmpty) {
      return;
    }

    final List<Map<String, dynamic>> pendingPayloads =
        List<Map<String, dynamic>>.from(
      _pendingFlutterFrameDiagnosticsPayloads,
    );
    _pendingFlutterFrameDiagnosticsPayloads.clear();

    for (final Map<String, dynamic> payload in pendingPayloads) {
      await _emitFlutterFrameDiagnosticsPayload(payload);
    }
  }

  Future<void> _emitFlutterFrameDiagnosticsPayload(
    Map<String, dynamic> payload,
  ) async {
    final String encodedPayload = jsonEncode(payload);

    try {
      await _controller.runJavaScript('''
        (() => {
          const payload = $encodedPayload;
          const sinkName = '$_nativeDiagnosticsSinkName';
          const existing = Array.isArray(window[sinkName]) ? window[sinkName] : [];
          existing.push(payload);
          if (existing.length > 200) {
            existing.splice(0, existing.length - 200);
          }
          window[sinkName] = existing;
          console.warn('[ImportantDiagnostics][FlutterFrameTiming]', payload);
        })();
      ''');
    } catch (_) {
      if (_pendingFlutterFrameDiagnosticsPayloads.length >=
          _maxPendingFlutterFrameDiagnosticsPayloads) {
        _pendingFlutterFrameDiagnosticsPayloads.removeAt(0);
      }

      _pendingFlutterFrameDiagnosticsPayloads.add(payload);
    }
  }

  Future<void> _flushPendingUpdateDiagnosticsLogs() async {
    if (!_isPageReady || _pendingUpdateDiagnosticsLogs.isEmpty) {
      return;
    }

    final List<String> pendingMessages = List<String>.from(
      _pendingUpdateDiagnosticsLogs,
    );
    _pendingUpdateDiagnosticsLogs.clear();

    for (final String message in pendingMessages) {
      await _emitUpdateDiagnosticsLog(message);
    }
  }

  Future<void> _emitUpdateDiagnosticsLog(String message) async {
    final String encodedMessage = jsonEncode(message);

    try {
      await _controller.runJavaScript('''
        (() => {
          const message = $encodedMessage;
          const payload = {
            source: 'flutter_update_coordinator',
            message,
            timestamp: new Date().toISOString(),
          };
          const isError = /error|failed/i.test(message);
          const logMethod = isError ? console.error : console.warn;
          logMethod('[ImportantDiagnostics][NativeVersionCheck]', payload);
        })();
      ''');
    } catch (_) {
      _enqueuePendingUpdateDiagnosticsLog(message);
    }
  }

  Future<void> _dispatchViewportSync(
    String reason, {
    bool dispatchLifecycleEvents = false,
  }) async {
    if (!_isPageReady) {
      return;
    }

    final view = WidgetsBinding.instance.platformDispatcher.views.first;
    final double bottomInset = view.viewInsets.bottom / view.devicePixelRatio;
    final String encodedReason = jsonEncode(reason);
    final String encodedDispatchLifecycleEvents = jsonEncode(
      dispatchLifecycleEvents,
    );
    final String encodedBottomInset = jsonEncode(bottomInset);
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
            bottomInset: $encodedBottomInset,
            visualViewportWidth: window.visualViewport?.width ?? null,
            visualViewportHeight: window.visualViewport?.height ?? null,
            visualViewportScale: window.visualViewport?.scale ?? null,
          };

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

    // Vite public assets are copied into assets/web/assets/** for Flutter.
    // Browser URLs keep their root paths (/ui/**, /game/**), so try the
    // packaged location as a fallback when the direct path is not present.
    if (path.startsWith('/ui/') || path.startsWith('/game/')) {
      candidateAssetPaths.add('assets/web/assets$path');
    }

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
      if (_shouldLogMissingAssetRequest(path) &&
          _missingAssetPathsLogged.add(path)) {
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

  bool _shouldLogMissingAssetRequest(String path) {
    if (_isInspectorSourceLookup(path)) {
      return false;
    }

    if (_webEntrypointPaths.contains(path)) {
      return true;
    }

    return path.startsWith('/assets/');
  }

  bool _isInspectorSourceLookup(String path) {
    final String lowerPath = path.toLowerCase();

    if (lowerPath.endsWith('.map')) {
      return true;
    }

    if (lowerPath.endsWith('.ts') ||
        lowerPath.endsWith('.tsx') ||
        lowerPath.endsWith('.jsx') ||
        lowerPath.endsWith('.mjs') ||
        lowerPath.endsWith('.cjs')) {
      return true;
    }

    return lowerPath.startsWith('/@fs/') ||
        lowerPath.startsWith('/@id/') ||
        lowerPath.startsWith('/__vite') ||
        lowerPath.startsWith('/.well-known/') ||
        lowerPath.contains('/node_modules/') ||
        lowerPath.contains('/src/') ||
        lowerPath.contains('devtools');
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
    if (path.endsWith('.mp3')) return ContentType('audio', 'mpeg');
    if (path.endsWith('.wav')) return ContentType('audio', 'wav');
    if (path.endsWith('.ogg')) return ContentType('audio', 'ogg');
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
    WidgetsBinding.instance.removeTimingsCallback(_handleFlutterFrameTimings);
    _backNavigationChannel.setMethodCallHandler(null);
    _cancelViewportSyncTimers();
    _isPageReady = false;
    _updateCoordinator.removeListener(_handleUpdateCoordinatorChanged);
    _updateCoordinator.dispose();
    _assetServer?.close(force: true);
    super.dispose();
  }

  Future<void> _log(String message) async {
    if (message.startsWith('[SerializedWebLog] ')) {
      print(message);
      return;
    }

    if (message.startsWith('[BackNavigation]')) {
      print(message);
      return;
    }

    // 브릿지 로그가 많아 디버깅이 어려우므로, 에셋 404 마커 로그만 우선 노출
    if (message.contains('@@ASSET404@@')) {
      print(message);
    }
  }
}

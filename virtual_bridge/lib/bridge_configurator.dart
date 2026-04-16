import 'dart:convert';
import 'package:webview_flutter/webview_flutter.dart';
import 'pip/pip_controller.dart';
import 'storage/storage_controller.dart';
import 'ad/ad_controller.dart';
import 'sun/sun_controller.dart';
import 'vibration/vibration_controller.dart';

/// WebView와 네이티브 코드 간 브릿지 설정을 담당하는 클래스
class BridgeConfigurator {
  static const int _promisePreviewLimit = 120;
  final WebViewController webViewController;
  final Function(String message) logCallback;
  final bool forwardConsoleMessages;
  bool _channelsRegistered = false;

  late final PipController _pipController;
  late final StorageController _storageController;
  late final AdController _adController;
  late final SunController _sunController;
  late final VibrationController _vibrationController;

  BridgeConfigurator({
    required this.webViewController,
    required this.logCallback,
    this.forwardConsoleMessages = false,
  }) {
    _pipController = PipController(
      runJavaScript: _runJavaScript,
      resolvePromise: _resolvePromise,
      log: logCallback,
    );

    _storageController = StorageController(
      runJavaScript: _runJavaScript,
      resolvePromise: _resolvePromise,
      log: logCallback,
    );

    _adController = AdController(
      runJavaScript: _runJavaScript,
      resolvePromise: _resolvePromise,
      log: logCallback,
    );

    _sunController = SunController(
      runJavaScript: _runJavaScript,
      resolvePromise: _resolvePromise,
      log: logCallback,
    );

    _vibrationController = VibrationController(
      runJavaScript: _runJavaScript,
      resolvePromise: _resolvePromise,
      log: logCallback,
    );
  }

  /// 브릿지 초기화
  Future<void> setupBridge() async {
    await _registerJavaScriptChannels();

    if (forwardConsoleMessages) {
      webViewController
          .setOnConsoleMessage((JavaScriptConsoleMessage consoleMessage) {
        logCallback(consoleMessage.message);
      });
    }
  }

  /// 페이지 로드 이후 JavaScript 인터페이스를 주입합니다.
  Future<void> injectJavaScriptInterfaces() async {
    await _setupBasePromiseSystem();
    await _setupControllers();
  }

  /// JavaScriptChannel 직접 추가
  Future<void> _registerJavaScriptChannels() async {
    if (_channelsRegistered) {
      return;
    }

    webViewController
      ..addJavaScriptChannel(
        '__native_pipEnter',
        onMessageReceived: (JavaScriptMessage message) =>
            _pipController.handleEnterPip(message),
      )
      ..addJavaScriptChannel(
        '__native_pipExit',
        onMessageReceived: (JavaScriptMessage message) =>
            _pipController.handleExitPip(message),
      )
      ..addJavaScriptChannel(
        '__native_storage',
        onMessageReceived: (JavaScriptMessage message) =>
            _storageController.handleStorageOperation(message),
      )
      ..addJavaScriptChannel(
        '__native_adShow',
        onMessageReceived: (JavaScriptMessage message) =>
            _adController.handleShowInterstitial(message),
      )
      ..addJavaScriptChannel(
        '__native_adCanShow',
        onMessageReceived: (JavaScriptMessage message) =>
            _adController.handleCanShowAd(message),
      )
      ..addJavaScriptChannel(
        '__native_sun_get_times',
        onMessageReceived: (JavaScriptMessage message) =>
            _sunController.handleGetSunTimes(message),
      )
      ..addJavaScriptChannel(
        '__native_sun_request_permission',
        onMessageReceived: (JavaScriptMessage message) =>
            _sunController.handleRequestLocationPermission(message),
      )
      ..addJavaScriptChannel(
        '__native_vibrate',
        onMessageReceived: (JavaScriptMessage message) =>
            _vibrationController.handleVibrate(message),
      );

    _channelsRegistered = true;
  }

  /// 기본 프로미스 시스템 설정
  Future<void> _setupBasePromiseSystem() async {
    await _runJavaScript('''
      window.__promises = {};
      window.__createPromise = function(callback) {
        return new Promise((resolve, reject) => {
          const promiseId = 'promise_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          window.__promises[promiseId] = { resolve, reject };
          callback(promiseId);
        });
      };
      window.__resolvePromise = function(promiseId, data, error) {
        if (window.__promises[promiseId]) {
          if (error) {
            window.__promises[promiseId].reject(error);
          } else {
            window.__promises[promiseId].resolve(data);
          }
          delete window.__promises[promiseId];
        }
      };
    ''');
  }

  /// 컨트롤러 설정
  Future<void> _setupControllers() async {
    await _runJavaScript(_getDisabledNfcJavaScriptInterface());
    await _runJavaScript(_pipController.getJavaScriptInterface());
    await _runJavaScript(_storageController.getJavaScriptInterface());
    await _runJavaScript(_adController.getJavaScriptInterface());
    await _runJavaScript(_sunController.getJavaScriptInterface());
    await _runJavaScript(_vibrationController.getJavaScriptInterface());
  }

  /// NFC 미사용 기간 동안 JS 호출이 깨지지 않도록 스텁 인터페이스를 제공합니다.
  String _getDisabledNfcJavaScriptInterface() {
    return '''
      window.nfcController = {
        startReadWrite: (_rawArgObj = {}) => Promise.resolve('NFC_DISABLED'),
        startHce: (_rawArgObj = {}) => Promise.resolve('NFC_DISABLED'),
        stop: (_rawArgObj = {}) => Promise.resolve('NFC_DISABLED')
      };
    ''';
  }

  /// JavaScript 코드 실행
  Future<void> _runJavaScript(String javaScript) async {
    try {
      await webViewController.runJavaScript(javaScript);
    } catch (e) {
      logCallback("JS 실행 오류: $e");
    }
  }

  /// Promise 해결/거부
  Future<void> _resolvePromise({
    required String id,
    String? data,
    String? error,
  }) async {
    final String encodedData = data != null ? jsonEncode(data) : 'null';
    final String encodedError = error != null ? jsonEncode(error) : 'null';
    logCallback(
      '[BridgeConfigurator] resolvePromise id=$id '
      'dataIsNull=${data == null} errorIsNull=${error == null} '
      'dataPreview=${_previewPromiseValue(data)} '
      'errorPreview=${_previewPromiseValue(error)}',
    );
    final jsCode = '''
      (() => {
        const __bridgeData = $encodedData;
        const __bridgeError = $encodedError;
        const __preview = (value) => {
          if (value === null) return "null";
          if (typeof value === "undefined") return "undefined";
          const stringValue =
            typeof value === "string" ? value : JSON.stringify(value) ?? String(value);
          return stringValue.length > $_promisePreviewLimit
            ? stringValue.slice(0, $_promisePreviewLimit) + "…"
            : stringValue;
        };
        console.debug("[BridgeConfigurator] resolvePromise", {
          id: "$id",
          dataType: typeof __bridgeData,
          isDataNull: __bridgeData === null,
          isDataUndefined: typeof __bridgeData === "undefined",
          dataPreview: __preview(__bridgeData),
          errorType: typeof __bridgeError,
          isErrorNull: __bridgeError === null,
          isErrorUndefined: typeof __bridgeError === "undefined",
          errorPreview: __preview(__bridgeError),
        });
        window.__resolvePromise(
          "$id",
          __bridgeData,
          __bridgeError
        );
      })();
    ''';
    await _runJavaScript(jsCode);
  }

  String _previewPromiseValue(String? value) {
    if (value == null) {
      return 'null';
    }

    if (value.length <= _promisePreviewLimit) {
      return value;
    }

    return '${value.substring(0, _promisePreviewLimit)}…';
  }

  /// 리소스 정리
  void dispose() {
    _pipController.dispose();
    _storageController.dispose();
    _adController.dispose();
    _sunController.dispose();
    _vibrationController.dispose();
  }
}

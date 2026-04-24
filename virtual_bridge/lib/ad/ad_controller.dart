import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// AdMob 광고 관리 컨트롤러
/// 역할: 전면광고 로드/표시 및 쿨다운 관리
/// 정책 로직은 웹앱에서 처리
class AdController {
  final Function(String jsCode) runJavaScript;
  final Function({required String id, String? data, String? error})
      resolvePromise;
  final Function(String message) log;
  final void Function(String state)? onFullscreenAdStateChanged;

  static const String _cooldownKey = 'ad_last_shown_timestamp';
  static const Duration _defaultNativeCooldown = Duration(hours: 4);

  // 프로덕션 광고 단위 ID (Android)
  static const String _productionAdUnitIdAndroid =
      'ca-app-pub-8981042075594766/6933768144';

  // 테스트 광고 단위 ID (Android, debug gauge 즉시 노출용)
  static const String _testAdUnitIdAndroid =
      'ca-app-pub-3940256099942544/1033173712';
  // 테스트 광고 단위 ID (iOS, 이번 Android production 전환 범위 밖)
  static const String _testAdUnitIdIOS =
      'ca-app-pub-3940256099942544/4411468910';

  InterstitialAd? _interstitialAd;
  bool _isAdReady = false;
  bool _isLoading = false;
  String? _lastError;

  InterstitialAd? _testInterstitialAd;
  bool _isTestAdReady = false;
  bool _isTestLoading = false;
  String? _lastTestError;

  bool _isDisposed = false;

  AdController({
    required this.runJavaScript,
    required this.resolvePromise,
    required this.log,
    this.onFullscreenAdStateChanged,
  }) {
    _loadInterstitialAd();
  }

  /// JavaScript에 광고 인터페이스를 제공하는 코드를 반환
  String getJavaScriptInterface() {
    return '''
      window.adController = {
        showInterstitial: (options = {}) => {
          return __createPromise((id) => {
            const normalizedOptions =
              options && typeof options === 'object' ? options : {};
            const argObj = { id, ...normalizedOptions };
            __native_adShow.postMessage(JSON.stringify(argObj));
          });
        },
        showTestInterstitial: () => {
          return __createPromise((id) => {
            const argObj = { id };
            __native_adShowTest.postMessage(JSON.stringify(argObj));
          });
        },
        canShowAd: (options = {}) => {
          return __createPromise((id) => {
            const normalizedOptions =
              options && typeof options === 'object' ? options : {};
            const argObj = { id, ...normalizedOptions };
            __native_adCanShow.postMessage(JSON.stringify(argObj));
          });
        },
        getAdDebugState: () => {
          return __createPromise((id) => {
            const argObj = { id };
            __native_adDebugState.postMessage(JSON.stringify(argObj));
          });
        }
      };
    ''';
  }

  /// 전면광고 로드
  void _loadInterstitialAd() {
    if (_isDisposed || _isLoading) return;

    _isLoading = true;
    _lastError = null;
    final adUnitLabel = _getProductionAdUnitLabel();
    log('[AdController] Loading interstitial ad ($adUnitLabel)...');

    final adUnitId = _getProductionAdUnitId();

    InterstitialAd.load(
      adUnitId: adUnitId,
      request: const AdRequest(),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          if (_isDisposed) {
            ad.dispose();
            return;
          }

          _interstitialAd = ad;
          _isAdReady = true;
          _isLoading = false;
          _lastError = null;
          log(
            '[AdController] Interstitial ad loaded successfully '
            '($adUnitLabel)',
          );

          // 광고 이벤트 리스너 설정
          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdShowedFullScreenContent: (ad) {
              log('[AdController] Ad showed full screen content');
              unawaited(_notifyFullscreenAdState('showing'));
            },
            onAdDismissedFullScreenContent: (ad) {
              log('[AdController] Ad dismissed full screen content');
              unawaited(_notifyFullscreenAdState('dismissed'));
              ad.dispose();
              _interstitialAd = null;
              _isAdReady = false;
              _loadInterstitialAd(); // 다음을 위해 미리 로드
            },
            onAdFailedToShowFullScreenContent: (ad, error) {
              _lastError = error.toString();
              log('[AdController] Ad failed to show: $error');
              unawaited(_notifyFullscreenAdState('failed'));
              ad.dispose();
              _interstitialAd = null;
              _isAdReady = false;
              _loadInterstitialAd(); // 재시도
            },
          );
        },
        onAdFailedToLoad: (error) {
          _isLoading = false;
          _lastError = error.toString();
          log('[AdController] Failed to load ad: $error');

          // 30초 후 재시도
          Future.delayed(const Duration(seconds: 30), () {
            _loadInterstitialAd();
          });
        },
      ),
    );
  }

  /// 디버그용 테스트 전면광고 로드
  void _loadTestInterstitialAd() {
    if (_isDisposed || _isTestLoading) return;

    _isTestLoading = true;
    _lastTestError = null;
    final adUnitLabel = _getTestAdUnitLabel();
    log('[AdController] Loading test interstitial ad ($adUnitLabel)...');

    final adUnitId = _getTestAdUnitId();

    InterstitialAd.load(
      adUnitId: adUnitId,
      request: const AdRequest(),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          if (_isDisposed) {
            ad.dispose();
            return;
          }

          _testInterstitialAd = ad;
          _isTestAdReady = true;
          _isTestLoading = false;
          _lastTestError = null;
          log(
            '[AdController] Test interstitial ad loaded successfully '
            '($adUnitLabel)',
          );

          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdShowedFullScreenContent: (ad) {
              log('[AdController] Test ad showed full screen content');
              unawaited(_notifyFullscreenAdState('showing'));
            },
            onAdDismissedFullScreenContent: (ad) {
              log('[AdController] Test ad dismissed full screen content');
              unawaited(_notifyFullscreenAdState('dismissed'));
              ad.dispose();
              _testInterstitialAd = null;
              _isTestAdReady = false;
              _loadTestInterstitialAd();
            },
            onAdFailedToShowFullScreenContent: (ad, error) {
              _lastTestError = error.toString();
              log('[AdController] Test ad failed to show: $error');
              unawaited(_notifyFullscreenAdState('failed'));
              ad.dispose();
              _testInterstitialAd = null;
              _isTestAdReady = false;
              _loadTestInterstitialAd();
            },
          );
        },
        onAdFailedToLoad: (error) {
          _isTestLoading = false;
          _lastTestError = error.toString();
          log('[AdController] Failed to load test ad: $error');

          // 30초 후 재시도
          Future.delayed(const Duration(seconds: 30), () {
            _loadTestInterstitialAd();
          });
        },
      ),
    );
  }

  void _ensureTestInterstitialAdLoading() {
    if (!_isTestAdReady &&
        !_isTestLoading &&
        _testInterstitialAd == null &&
        !_isDisposed) {
      _loadTestInterstitialAd();
    }
  }

  /// 프로덕션 광고 단위 ID 반환 (플랫폼별)
  String _getProductionAdUnitId() {
    return Platform.isAndroid ? _productionAdUnitIdAndroid : _testAdUnitIdIOS;
  }

  String _getProductionAdUnitLabel() {
    return Platform.isAndroid ? 'android-production' : 'ios-test-fallback';
  }

  /// 테스트 광고 단위 ID 반환 (플랫폼별)
  String _getTestAdUnitId() {
    return Platform.isAndroid ? _testAdUnitIdAndroid : _testAdUnitIdIOS;
  }

  String _getTestAdUnitLabel() {
    return Platform.isAndroid ? 'android-test' : 'ios-test';
  }

  /// 전면광고 표시 요청 처리
  Future<void> handleShowInterstitial(JavaScriptMessage message) async {
    final Map<String, dynamic> argObj = _parseMessage(message);
    final String promiseId = argObj['id'] as String;

    try {
      final cooldown = _resolveCooldown(argObj);

      // 1. 네이티브 쿨다운 체크 (안전장치)
      if (!await _checkNativeCooldown(cooldown)) {
        log(
          '[AdController] Ad blocked by native cooldown '
          '(${cooldown.inMilliseconds}ms)',
        );
        resolvePromise(id: promiseId, error: 'Cooldown not expired');
        return;
      }

      // 2. 광고 준비 상태 확인
      if (!_isAdReady || _interstitialAd == null) {
        log('[AdController] Ad not ready');
        resolvePromise(id: promiseId, error: 'Ad not loaded');
        return;
      }

      // 3. 광고 표시
      log('[AdController] Showing interstitial ad');
      _lastError = null;
      await _interstitialAd!.show();

      // 4. 쿨다운 업데이트
      await _updateCooldown();

      resolvePromise(id: promiseId, data: 'success');
    } catch (e) {
      _lastError = e.toString();
      log('[AdController] Error showing ad: $e');
      await _notifyFullscreenAdState('failed');
      resolvePromise(id: promiseId, error: e.toString());
    }
  }

  /// 디버그용 테스트 전면광고 표시 요청 처리
  Future<void> handleShowTestInterstitial(JavaScriptMessage message) async {
    final Map<String, dynamic> argObj = _parseMessage(message);
    final String promiseId = argObj['id'] as String;

    try {
      if (!_isTestAdReady || _testInterstitialAd == null) {
        _lastTestError = 'Test ad not loaded';
        log('[AdController] Test ad not ready');
        _ensureTestInterstitialAdLoading();
        resolvePromise(id: promiseId, error: 'Test ad not loaded');
        return;
      }

      log('[AdController] Showing test interstitial ad');
      _lastTestError = null;
      final testAd = _testInterstitialAd!;
      _testInterstitialAd = null;
      _isTestAdReady = false;
      await testAd.show();
      resolvePromise(id: promiseId, data: 'success');
    } catch (e) {
      _lastTestError = e.toString();
      log('[AdController] Error showing test ad: $e');
      await _notifyFullscreenAdState('failed');
      resolvePromise(id: promiseId, error: e.toString());
    }
  }

  /// 광고 표시 가능 여부 확인 (쿨다운 체크)
  Future<void> handleCanShowAd(JavaScriptMessage message) async {
    final Map<String, dynamic> argObj = _parseMessage(message);
    final String promiseId = argObj['id'] as String;

    try {
      final cooldown = _resolveCooldown(argObj);
      final canShow = await _checkNativeCooldown(cooldown);
      resolvePromise(id: promiseId, data: canShow.toString());
    } catch (e) {
      log('[AdController] Error checking cooldown: $e');
      resolvePromise(id: promiseId, error: e.toString());
    }
  }

  /// 디버그용 광고 상태 조회
  Future<void> handleGetAdDebugState(JavaScriptMessage message) async {
    final Map<String, dynamic> argObj = _parseMessage(message);
    final String promiseId = argObj['id'] as String;

    try {
      _ensureTestInterstitialAdLoading();
      resolvePromise(id: promiseId, data: jsonEncode(_getDebugState()));
    } catch (e) {
      _lastError = e.toString();
      log('[AdController] Error getting ad debug state: $e');
      resolvePromise(id: promiseId, error: e.toString());
    }
  }

  /// 네이티브 쿨다운 체크
  Future<bool> _checkNativeCooldown(Duration cooldown) async {
    final prefs = await SharedPreferences.getInstance();
    final lastShown = prefs.getInt(_cooldownKey);

    if (lastShown == null) {
      return true; // 한 번도 표시한 적 없음
    }

    final lastShownTime = DateTime.fromMillisecondsSinceEpoch(lastShown);
    final now = DateTime.now();
    final difference = now.difference(lastShownTime);

    return difference >= cooldown;
  }

  Duration _resolveCooldown(Map<String, dynamic> argObj) {
    final dynamic rawCooldownMs = argObj['cooldownMs'];

    if (rawCooldownMs is num && rawCooldownMs.isFinite && rawCooldownMs > 0) {
      return Duration(milliseconds: rawCooldownMs.round());
    }

    return _defaultNativeCooldown;
  }

  /// 쿨다운 업데이트
  Future<void> _updateCooldown() async {
    final prefs = await SharedPreferences.getInstance();
    final now = DateTime.now().millisecondsSinceEpoch;
    await prefs.setInt(_cooldownKey, now);
    log('[AdController] Cooldown updated: $now');
  }

  /// 메시지 파싱
  Map<String, dynamic> _parseMessage(JavaScriptMessage message) {
    try {
      final dynamic decoded = jsonDecode(message.message);

      if (decoded is Map<String, dynamic>) {
        return decoded;
      }

      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }

      throw const FormatException('Decoded message is not a JSON object');
    } catch (e) {
      _lastError = 'Invalid bridge message: $e';
      log('[AdController] Failed to parse bridge message: $e');
      rethrow;
    }
  }

  Map<String, dynamic> _getDebugState() {
    return {
      'isReady': _isAdReady,
      'isLoading': _isLoading,
      'lastError': _lastError,
      'unit': _getProductionAdUnitLabel(),
      'production': {
        'isReady': _isAdReady,
        'isLoading': _isLoading,
        'lastError': _lastError,
        'unit': _getProductionAdUnitLabel(),
      },
      'test': {
        'isReady': _isTestAdReady,
        'isLoading': _isTestLoading,
        'lastError': _lastTestError,
        'unit': _getTestAdUnitLabel(),
      },
    };
  }

  Future<void> _notifyFullscreenAdState(String state) async {
    onFullscreenAdStateChanged?.call(state);

    final String encodedState = jsonEncode(state);

    try {
      await runJavaScript('''
        (() => {
          const state = $encodedState;
          try {
            window.dispatchEvent(
              new CustomEvent('digivice:fullscreen-ad', {
                detail: {
                  state,
                  timestamp: new Date().toISOString(),
                },
              }),
            );
          } catch (_) {}
        })();
      ''');
    } catch (e) {
      log('[AdController] Failed to dispatch fullscreen ad state: $e');
    }
  }

  /// 리소스 정리
  void dispose() {
    _isDisposed = true;
    _interstitialAd?.dispose();
    _interstitialAd = null;
    _isAdReady = false;
    _isLoading = false;
    _testInterstitialAd?.dispose();
    _testInterstitialAd = null;
    _isTestAdReady = false;
    _isTestLoading = false;
  }
}

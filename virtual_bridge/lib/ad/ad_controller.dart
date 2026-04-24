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
  static const Duration _nativeCooldown = Duration(hours: 4);

  // 테스트 광고 단위 ID (Android)
  static const String _testAdUnitIdAndroid =
      'ca-app-pub-3940256099942544/1033173712';
  // 테스트 광고 단위 ID (iOS)
  static const String _testAdUnitIdIOS =
      'ca-app-pub-3940256099942544/4411468910';

  InterstitialAd? _interstitialAd;
  bool _isAdReady = false;
  bool _isLoading = false;
  String? _lastError;

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
        showInterstitial: () => {
          return __createPromise((id) => {
            const argObj = { id };
            __native_adShow.postMessage(JSON.stringify(argObj));
          });
        },
        showTestInterstitial: () => {
          return __createPromise((id) => {
            const argObj = { id };
            __native_adShowTest.postMessage(JSON.stringify(argObj));
          });
        },
        canShowAd: () => {
          return __createPromise((id) => {
            const argObj = { id };
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
    if (_isLoading) return;

    _isLoading = true;
    _lastError = null;
    log('[AdController] Loading interstitial ad...');

    final adUnitId = _getAdUnitId();

    InterstitialAd.load(
      adUnitId: adUnitId,
      request: const AdRequest(),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          _interstitialAd = ad;
          _isAdReady = true;
          _isLoading = false;
          _lastError = null;
          log('[AdController] Interstitial ad loaded successfully');

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
              _isAdReady = false;
              _loadInterstitialAd(); // 다음을 위해 미리 로드
            },
            onAdFailedToShowFullScreenContent: (ad, error) {
              _lastError = error.toString();
              log('[AdController] Ad failed to show: $error');
              unawaited(_notifyFullscreenAdState('failed'));
              ad.dispose();
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

  /// 광고 단위 ID 반환 (플랫폼별)
  String _getAdUnitId() {
    // TODO: 프로덕션에서는 실제 광고 단위 ID로 교체
    return Platform.isAndroid ? _testAdUnitIdAndroid : _testAdUnitIdIOS;
  }

  /// 전면광고 표시 요청 처리
  Future<void> handleShowInterstitial(JavaScriptMessage message) async {
    final Map<String, dynamic> argObj = _parseMessage(message);
    final String promiseId = argObj['id'] as String;

    try {
      // 1. 네이티브 쿨다운 체크 (안전장치)
      if (!await _checkNativeCooldown()) {
        log('[AdController] Ad blocked by native cooldown');
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
      if (!_isAdReady || _interstitialAd == null) {
        _lastError = 'Ad not loaded';
        log('[AdController] Test ad not ready');
        resolvePromise(id: promiseId, error: 'Ad not loaded');
        return;
      }

      log('[AdController] Showing test interstitial ad');
      _lastError = null;
      await _interstitialAd!.show();
      resolvePromise(id: promiseId, data: 'success');
    } catch (e) {
      _lastError = e.toString();
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
      final canShow = await _checkNativeCooldown();
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
      resolvePromise(id: promiseId, data: jsonEncode(_getDebugState()));
    } catch (e) {
      _lastError = e.toString();
      log('[AdController] Error getting ad debug state: $e');
      resolvePromise(id: promiseId, error: e.toString());
    }
  }

  /// 네이티브 쿨다운 체크
  Future<bool> _checkNativeCooldown() async {
    final prefs = await SharedPreferences.getInstance();
    final lastShown = prefs.getInt(_cooldownKey);

    if (lastShown == null) {
      return true; // 한 번도 표시한 적 없음
    }

    final lastShownTime = DateTime.fromMillisecondsSinceEpoch(lastShown);
    final now = DateTime.now();
    final difference = now.difference(lastShownTime);

    return difference >= _nativeCooldown;
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
    _interstitialAd?.dispose();
    _interstitialAd = null;
    _isAdReady = false;
  }
}

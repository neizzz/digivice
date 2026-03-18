import 'dart:io' show Platform;
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// AdMob 광고 관리 컨트롤러
/// 역할: 전면광고 로드/표시 및 쿨다운 관리
/// 정책 로직은 웹앱에서 처리
class AdController {
  final Function(String jsCode) runJavaScript;
  final Function({required String id, String? data, String? error})
  resolvePromise;
  final Function(String message) log;

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

  AdController({
    required this.runJavaScript,
    required this.resolvePromise,
    required this.log,
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
        canShowAd: () => {
          return __createPromise((id) => {
            const argObj = { id };
            __native_adCanShow.postMessage(JSON.stringify(argObj));
          });
        }
      };
    ''';
  }

  /// 전면광고 로드
  void _loadInterstitialAd() {
    if (_isLoading) return;

    _isLoading = true;
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
          log('[AdController] Interstitial ad loaded successfully');

          // 광고 이벤트 리스너 설정
          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdShowedFullScreenContent: (ad) {
              log('[AdController] Ad showed full screen content');
            },
            onAdDismissedFullScreenContent: (ad) {
              log('[AdController] Ad dismissed full screen content');
              ad.dispose();
              _isAdReady = false;
              _loadInterstitialAd(); // 다음을 위해 미리 로드
            },
            onAdFailedToShowFullScreenContent: (ad, error) {
              log('[AdController] Ad failed to show: $error');
              ad.dispose();
              _isAdReady = false;
              _loadInterstitialAd(); // 재시도
            },
          );
        },
        onAdFailedToLoad: (error) {
          _isLoading = false;
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
  Future<void> handleShowInterstitial(dynamic message) async {
    final Map<String, dynamic> argObj = _parseMessage(message);
    final String promiseId = argObj['id'];

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
      await _interstitialAd!.show();

      // 4. 쿨다운 업데이트
      await _updateCooldown();

      resolvePromise(id: promiseId, data: 'success');
    } catch (e) {
      log('[AdController] Error showing ad: $e');
      resolvePromise(id: promiseId, error: e.toString());
    }
  }

  /// 광고 표시 가능 여부 확인 (쿨다운 체크)
  Future<void> handleCanShowAd(dynamic message) async {
    final Map<String, dynamic> argObj = _parseMessage(message);
    final String promiseId = argObj['id'];

    try {
      final canShow = await _checkNativeCooldown();
      resolvePromise(id: promiseId, data: canShow.toString());
    } catch (e) {
      log('[AdController] Error checking cooldown: $e');
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
  Map<String, dynamic> _parseMessage(dynamic message) {
    if (message is Map) {
      return Map<String, dynamic>.from(message);
    }
    return {};
  }

  /// 리소스 정리
  void dispose() {
    _interstitialAd?.dispose();
    _interstitialAd = null;
    _isAdReady = false;
  }
}

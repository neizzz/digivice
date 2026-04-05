import 'dart:convert';
import 'package:vibration/vibration.dart';
import 'package:webview_flutter/webview_flutter.dart';

const int _defaultVibrationDuration = 50;
const int _minVibrationAmplitude = 1;
const int _maxVibrationAmplitude = 255;

int? _parseAmplitude(dynamic rawAmplitude) {
  if (rawAmplitude is! num) {
    return null;
  }

  final int amplitude = rawAmplitude.round();
  return amplitude.clamp(_minVibrationAmplitude, _maxVibrationAmplitude);
}

/// Vibration 기능의 JavaScript 인터페이스를 관리하는 컨트롤러
class VibrationController {
  final Function(String jsCode) runJavaScript;
  final Function({required String id, String? data}) resolvePromise;
  final Function(String message) log;

  VibrationController({
    required this.runJavaScript,
    required this.resolvePromise,
    required this.log,
  });

  /// JavaScript에 Vibration 인터페이스를 제공하는 코드를 반환합니다.
  String getJavaScriptInterface() {
    return '''
      window.vibrationController = {
        vibrate: (duration, strength) => {
          return __createPromise((id) => {
            const argObj = {
              id,
              duration: duration || $_defaultVibrationDuration,
              strength,
            };
            __native_vibrate.postMessage(JSON.stringify(argObj));
          });
        }
      };
    ''';
  }

  /// Vibration 요청을 처리합니다.
  Future<void> handleVibrate(JavaScriptMessage message) async {
    Map<String, dynamic> jsArgs = jsonDecode(message.message);
    String id = jsArgs['id'];
    int duration = jsArgs['duration'] ?? _defaultVibrationDuration;
    final int? amplitude = _parseAmplitude(jsArgs['strength']);

    try {
      // 진동 기능 사용 가능 여부 확인
      bool? hasVibrator = await Vibration.hasVibrator();

      if (hasVibrator == true) {
        final bool hasAmplitudeControl =
            amplitude != null ? await Vibration.hasAmplitudeControl() : false;

        // 진동 실행
        await Vibration.vibrate(
          duration: duration,
          amplitude: hasAmplitudeControl ? amplitude : -1,
        );
        resolvePromise(id: id, data: 'success');
        log(
          '[VibrationController] Vibration executed: ${duration}ms, '
          'strength: ${hasAmplitudeControl ? amplitude : 'default'}',
        );
      } else {
        resolvePromise(id: id, data: 'no_vibrator');
        log('[VibrationController] No vibrator available');
      }
    } catch (e) {
      resolvePromise(id: id, data: 'Error: ${e.toString()}');
      log('[VibrationController] Error: ${e.toString()}');
    }
  }

  /// 리소스를 정리합니다.
  void dispose() {
    // 현재는 특별히 정리할 리소스 없음
  }
}

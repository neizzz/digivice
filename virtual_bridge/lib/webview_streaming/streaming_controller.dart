import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:webview_flutter/webview_flutter.dart';
import 'streaming_server.dart';

/// WebView 스트리밍 기능을 위한 통합 컨트롤러
/// 미니뷰 개념은 웹뷰 측에서만 추상화하여 관리
class StreamingController {
  final Function(String jsCode) runJavaScript;
  final Function({required String id, String? data}) resolvePromise;
  final Function(String message) log;

  final StreamingServer _streamingServer = StreamingServer();
  final Function(Uint8List?) captureWebView;
  Timer? _captureTimer;
  bool _isStreaming = false;
  String _streamingUrl = '';
  int _captureRate = 250; // ms (4프레임/초)
  String _currentQuality = 'medium';

  StreamingController({
    required this.runJavaScript,
    required this.resolvePromise,
    required this.captureWebView,
    required this.log,
  });

  /// JavaScript 인터페이스 코드를 반환합니다.
  String getJavaScriptInterface() {
    return '''
      // StreamingChannel 인터페이스
      window.StreamingChannel = {
        postMessage: (rawMessage) => {
          try {
            const message = JSON.parse(rawMessage);
            const { action, data, promiseId } = message;
            
            const argObj = { id: promiseId, action, data };
            __native_streamingRequest.postMessage(JSON.stringify(argObj));
          } catch (e) {
            console.error('StreamingChannel error:', e);
          }
        }
      };
      
      // WebViewStreamingAPI - 직접 호출 메서드
      window.WebViewStreamingAPI = {
        startStreaming: function() {
          return StreamingChannel.postMessage(JSON.stringify({
            action: 'startStreaming',
            data: {},
            promiseId: 'direct_start'
          }));
        },
        
        stopStreaming: function() {
          return StreamingChannel.postMessage(JSON.stringify({
            action: 'stopStreaming',
            data: {},
            promiseId: 'direct_stop'
          }));
        },
        
        getStreamingUrl: function() {
          return StreamingChannel.postMessage(JSON.stringify({
            action: 'getStreamingUrl',
            data: {},
            promiseId: 'direct_url'
          }));
        }
      };
      
      // 미니뷰 모드를 위한 더미 인터페이스 (웹뷰에서 처리)
      window.MiniViewController = {
        postMessage: (rawMessage) => {
          try {
            const message = JSON.parse(rawMessage);
            const { action, data, promiseId } = message;
            
            // 미니뷰는 웹뷰에서만 추상화하여 자체 처리
            console.log('MiniView action: ' + action);
            
            // 성공 응답 반환
            if (window.__resolvePromise && promiseId) {
              window.__resolvePromise(promiseId, {
                success: true,
                message: 'MiniView action processed in WebView: ' + action
              });
            }
          } catch (e) {
            console.error('MiniViewController error:', e);
          }
        }
      };
      
      // 이벤트 발생 시 알림을 위한 함수
      window.dispatchStreamingEvent = function(eventName, data) {
        const event = new CustomEvent('webview_streaming', { 
          detail: { type: eventName, data: data } 
        });
        document.dispatchEvent(event);
      };
    ''';
  }

  /// 스트리밍 요청 처리
  void handleStreamingRequest(JavaScriptMessage message) async {
    Map<String, dynamic> jsArgs;

    try {
      jsArgs = jsonDecode(message.message);
    } catch (e) {
      log('잘못된 요청 형식: ${message.message}');
      return;
    }

    final String action = jsArgs['action'] ?? '';
    final Map<String, dynamic> data = jsArgs['data'] ?? {};
    final String promiseId = jsArgs['id'] ?? '';

    try {
      switch (action) {
        case 'startStreaming':
          final result = await _startStreaming(
              quality: data['quality'] ?? _currentQuality,
              fps: data['fps'] ?? 30);
          if (promiseId.isNotEmpty && !promiseId.startsWith('direct_'))
            resolvePromise(id: promiseId, data: jsonEncode(result));
          break;

        case 'stopStreaming':
          final result = await _stopStreaming();
          if (promiseId.isNotEmpty && !promiseId.startsWith('direct_'))
            resolvePromise(id: promiseId, data: jsonEncode(result));
          break;

        case 'getStreamingUrl':
          final result = {
            'success': _isStreaming,
            'url': _streamingUrl,
            'message':
                _isStreaming ? '스트리밍 URL: $_streamingUrl' : '스트리밍이 활성화되지 않았습니다'
          };
          if (promiseId.isNotEmpty && !promiseId.startsWith('direct_'))
            resolvePromise(id: promiseId, data: jsonEncode(result));
          break;

        case 'getStreamingStatus':
          final status = {
            'success': true,
            'isStreaming': _isStreaming,
            'streamingUrl': _streamingUrl,
            'quality': _currentQuality,
            'captureRate': _captureRate
          };
          if (promiseId.isNotEmpty)
            resolvePromise(id: promiseId, data: jsonEncode(status));
          break;

        case 'updateStreamingConfig':
        case 'updateIosStreamingConfig': // iOS 호환성 유지
          final result = await _updateStreamingConfig(
              quality: data['quality'], captureRate: data['captureRate']);
          if (promiseId.isNotEmpty)
            resolvePromise(id: promiseId, data: jsonEncode(result));
          break;

        case 'captureWebView':
          final imageData = await captureWebView(null);
          final result = {
            'success': imageData != null,
            'message': imageData != null ? '캡처 성공' : '캡처 실패'
          };
          if (promiseId.isNotEmpty)
            resolvePromise(id: promiseId, data: jsonEncode(result));
          break;

        default:
          if (promiseId.isNotEmpty && !promiseId.startsWith('direct_'))
            resolvePromise(
                id: promiseId,
                data: jsonEncode(
                    {'success': false, 'message': '알 수 없는 액션: $action'}));
      }
    } catch (e) {
      log('스트리밍 요청 처리 오류: $e');
      if (promiseId.isNotEmpty && !promiseId.startsWith('direct_'))
        resolvePromise(
            id: promiseId,
            data: jsonEncode({'success': false, 'message': '오류: $e'}));
    }
  }

  /// 스트리밍 시작
  Future<Map<String, dynamic>> _startStreaming(
      {required String quality, required int fps}) async {
    if (_isStreaming) {
      return {'success': true, 'url': _streamingUrl, 'message': '이미 스트리밍 중입니다'};
    }

    try {
      _notifyJsStatus('스트리밍 서버 시작 중...');
      _currentQuality = quality;

      // 스트리밍 서버 시작
      final serverInfo = await _streamingServer.start();
      _streamingUrl =
          'http://${serverInfo.host}:${serverInfo.port}/stream.html';

      // 캡처 타이머 시작
      _captureTimer =
          Timer.periodic(Duration(milliseconds: _captureRate), (timer) async {
        if (!_isStreaming) {
          timer.cancel();
          return;
        }

        final imageData = await captureWebView(null);
        if (imageData != null) {
          await _streamingServer.sendFrame(imageData);
        }
      });

      _isStreaming = true;
      _notifyJsStatus('스트리밍 시작됨');

      return {
        'success': true,
        'url': _streamingUrl,
        'message': '스트리밍이 시작되었습니다'
      };
    } catch (e) {
      log('스트리밍 시작 실패: $e');
      return {'success': false, 'message': '스트리밍 시작 실패: $e'};
    }
  }

  /// 스트리밍 중지
  Future<Map<String, dynamic>> _stopStreaming() async {
    if (!_isStreaming) {
      return {'success': true, 'message': '스트리밍이 이미 중지되었습니다'};
    }

    try {
      _captureTimer?.cancel();
      _captureTimer = null;

      await _streamingServer.stop();
      _isStreaming = false;
      _notifyJsStatus('스트리밍 중지됨');

      return {'success': true, 'message': '스트리밍이 중지되었습니다'};
    } catch (e) {
      log('스트리밍 중지 실패: $e');
      return {'success': false, 'message': '스트리밍 중지 실패: $e'};
    }
  }

  /// 스트리밍 설정 업데이트
  Future<Map<String, dynamic>> _updateStreamingConfig(
      {String? quality, int? captureRate}) async {
    if (quality != null) _currentQuality = quality;
    if (captureRate != null) _captureRate = captureRate;

    // 스트리밍 중인 경우 캡처 레이트 업데이트
    if (_isStreaming && captureRate != null && _captureTimer != null) {
      _captureTimer!.cancel();
      _captureTimer =
          Timer.periodic(Duration(milliseconds: _captureRate), (timer) async {
        final imageData = await captureWebView(null);
        if (imageData != null) {
          await _streamingServer.sendFrame(imageData);
        }
      });
    }

    return {
      'success': true,
      'message': '스트리밍 설정이 업데이트되었습니다',
      'config': {'quality': _currentQuality, 'captureRate': _captureRate}
    };
  }

  /// JavaScript에 상태 알림
  void _notifyJsStatus(String status) {
    runJavaScript('''
      if (window.dispatchStreamingEvent) {
        window.dispatchStreamingEvent('status', "$status");
      }
    ''');
  }

  /// 리소스 정리
  void dispose() {
    _stopStreaming().then((_) => log('스트리밍 컨트롤러 정리됨'));
  }
}

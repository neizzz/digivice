import 'dart:async';
import 'dart:typed_data';
import 'screen_capture_service.dart';
import 'streaming_server.dart';

/// WebView 스트리밍 기능을 위한 컨트롤러
class StreamingController {
  final ScreenCaptureService _captureService = ScreenCaptureService();
  final StreamingServer _streamingServer = StreamingServer();
  Timer? _captureTimer;
  bool _isStreaming = false;
  String _serverUrl = '';

  // 콜백 함수 정의
  final Function(Uint8List?) captureWebView;
  final Function(String jsCode) runJavaScript;

  StreamingController({
    required this.captureWebView,
    required this.runJavaScript,
  });

  /// JavaScript 메시지를 처리합니다.
  /// main.dart에서 JavaScriptChannel onMessageReceived 콜백으로 이 메서드를 호출해야 합니다.
  void handleJsMessage(String message) {
    switch (message) {
      case 'start_streaming':
        startStreaming();
        break;
      case 'stop_streaming':
        stopStreaming();
        break;
      case 'get_url':
        sendStreamingUrlToJs();
        break;
      default:
        print('알 수 없는 메시지: $message');
    }
  }

  void sendStreamingUrlToJs() {
    if (_serverUrl.isNotEmpty) {
      runJavaScript('window.streamingUrl = "$_serverUrl";'
          'window.dispatchStreamingEvent("url_received", "$_serverUrl");');
    } else {
      notifyJsError('스트리밍 URL을 사용할 수 없습니다. 먼저 스트리밍을 시작하세요.');
    }
  }

  void notifyJsError(String errorMessage) {
    runJavaScript('''
      window.dispatchStreamingEvent('error', "${errorMessage.replaceAll('"', '\\"')}");
      console.error("스트리밍 오류:", "${errorMessage.replaceAll('"', '\\"')}");
    ''');
  }

  void notifyJsStatus(String status) {
    runJavaScript('''
      window.dispatchStreamingEvent('status', "$status");
    ''');
  }

  Future<void> startStreaming() async {
    if (_isStreaming) {
      notifyJsStatus('이미 스트리밍 중입니다');
      return;
    }

    try {
      _isStreaming = true;
      notifyJsStatus('스트리밍 서버 시작 중...');

      final serverInfo = await _streamingServer.start();
      _serverUrl = 'http://${serverInfo.host}:${serverInfo.port}';

      // 초당 4프레임(250ms) 간격으로 캡처
      _captureTimer =
          Timer.periodic(Duration(milliseconds: 250), (timer) async {
        final captureData = await captureWebView(null);
        if (captureData != null) {
          _streamingServer.sendFrame(captureData);
        }
      });

      notifyJsStatus('스트리밍 시작됨');
      sendStreamingUrlToJs();
    } catch (e) {
      _isStreaming = false;
      notifyJsError('스트리밍 시작 실패: $e');
      print('스트리밍 시작 실패: $e');
    }
  }

  void stopStreaming() {
    if (!_isStreaming) return;

    _isStreaming = false;
    _captureTimer?.cancel();
    _captureTimer = null;
    _streamingServer.stop();
    notifyJsStatus('스트리밍 중지됨');
  }

  void dispose() {
    stopStreaming();
  }

  /// JavaScript 인터페이스 코드를 반환합니다.
  /// main.dart에서 WebView가 로드된 후 이 코드를 실행해야 합니다.
  String getJavaScriptInterface() {
    return '''
      window.WebViewStreamingAPI = {
        startStreaming: function() {
          StreamingChannel.postMessage('start_streaming');
          return "스트리밍을 시작합니다";
        },
        
        stopStreaming: function() {
          StreamingChannel.postMessage('stop_streaming');
          return "스트리밍을 중지합니다";
        },
        
        getStreamingUrl: function() {
          StreamingChannel.postMessage('get_url');
          return "스트리밍 URL 요청 중...";
        }
      };
      
      // 이벤트 발생 시 알림을 위한 함수
      window.dispatchStreamingEvent = function(eventName, data) {
        const event = new CustomEvent('webview_streaming', { 
          detail: { type: eventName, data: data } 
        });
        document.dispatchEvent(event);
      };
      
      console.log('웹뷰 스트리밍 인터페이스가 초기화되었습니다.');
    ''';
  }
}

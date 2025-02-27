import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:path_provider/path_provider.dart';

class ServerInfo {
  final String host;
  final int port;

  ServerInfo(this.host, this.port);
}

class StreamingServer {
  HttpServer? _server;
  List<WebSocket> _clients = [];
  final StreamController<Uint8List> _frameController =
      StreamController<Uint8List>.broadcast();
  final int _port = 8888;

  Future<ServerInfo> start() async {
    if (_server != null) {
      return ServerInfo(await _getLocalIpAddress(), _port);
    }

    _server = await HttpServer.bind(InternetAddress.anyIPv4, _port);
    print('스트리밍 서버 시작됨: ${_server!.address.address}:${_server!.port}');

    _server!.listen((HttpRequest request) async {
      if (WebSocketTransformer.isUpgradeRequest(request)) {
        // WebSocket 연결 처리
        final socket = await WebSocketTransformer.upgrade(request);
        _handleWebSocket(socket);
      } else {
        // 일반 HTTP 요청 처리
        switch (request.uri.path) {
          case '/':
          case '/index.html':
            _serveMinimalHtmlPage(request);
            break;
          case '/stream':
            _serveStreamPage(request);
            break;
          case '/video':
            _handleVideoStream(request);
            break;
          default:
            request.response.statusCode = HttpStatus.notFound;
            request.response.close();
        }
      }
    });

    return ServerInfo(await _getLocalIpAddress(), _port);
  }

  void _handleWebSocket(WebSocket socket) {
    _clients.add(socket);

    socket.listen((data) {
      // 클라이언트로부터의 메시지 처리
      print('WebSocket 메시지 수신: $data');
    }, onDone: () {
      _clients.remove(socket);
    }, onError: (error) {
      print('WebSocket 오류: $error');
      _clients.remove(socket);
    });
  }

  // UI를 최소화한 HTML 페이지 제공
  void _serveMinimalHtmlPage(HttpRequest request) {
    request.response
      ..headers.contentType = ContentType.html
      ..write('''
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>WebView Stream</title>
        </head>
        <body style="margin:0;padding:0;text-align:center;">
          <img id="stream" src="/video" alt="Stream" style="max-width:100%;">
        </body>
        </html>
      ''')
      ..close();
  }

  void _serveStreamPage(HttpRequest request) async {
    request.response.headers.add('Content-Type', 'image/jpeg');
    request.response.bufferOutput = false;

    // 최신 프레임이 도착할 때까지 대기
    final completer = Completer<Uint8List>();
    late StreamSubscription subscription;

    subscription = _frameController.stream.listen((frame) {
      if (!completer.isCompleted) {
        completer.complete(frame);
        subscription.cancel();
      }
    });

    // 타임아웃 설정
    Future.delayed(Duration(seconds: 5), () {
      if (!completer.isCompleted) {
        completer.completeError('타임아웃');
        subscription.cancel();
      }
    });

    try {
      final frame = await completer.future;
      request.response.add(frame);
    } catch (e) {
      print('스트림 페이지 에러: $e');
    } finally {
      await request.response.close();
    }
  }

  void _handleVideoStream(HttpRequest request) {
    // MJPEG 스트림 구현 (Motion JPEG)
    request.response.headers
        .set('Content-Type', 'multipart/x-mixed-replace; boundary=frame');
    request.response.bufferOutput = false;

    final streamSubscription = _frameController.stream.listen((frame) {
      request.response.write('--frame\r\n'
          'Content-Type: image/jpeg\r\n'
          'Content-Length: ${frame.length}\r\n\r\n');
      request.response.add(frame);
      request.response.write('\r\n');
    });

    request.response.done.then((_) {
      streamSubscription.cancel();
    }).catchError((e) {
      streamSubscription.cancel();
    });
  }

  Future<String> _getLocalIpAddress() async {
    try {
      final interfaces = await NetworkInterface.list(
        includeLoopback: false,
        type: InternetAddressType.IPv4,
      );

      if (interfaces.isNotEmpty) {
        for (var interface in interfaces) {
          if (interface.name.contains('wlan') ||
              interface.name.contains('en0')) {
            if (interface.addresses.isNotEmpty) {
              return interface.addresses.first.address;
            }
          }
        }
        // fallback
        return interfaces.first.addresses.first.address;
      }
    } catch (e) {
      print('IP 주소 확인 실패: $e');
    }
    return '127.0.0.1';
  }

  void sendFrame(Uint8List frameData) {
    _frameController.add(frameData);

    // WebSocket 클라이언트들에게 전송
    for (var client in _clients) {
      try {
        client.add(frameData);
      } catch (e) {
        print('WebSocket 전송 오류: $e');
      }
    }
  }

  Future<void> stop() async {
    await _server?.close();
    _server = null;

    // WebSocket 연결 종료
    for (var client in _clients) {
      await client.close();
    }
    _clients.clear();
  }
}

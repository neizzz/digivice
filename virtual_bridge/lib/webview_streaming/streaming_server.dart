import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';

class ServerInfo {
  final String host;
  final int port;

  ServerInfo(this.host, this.port);
}

class StreamingServer {
  HttpServer? _server;
  final List<WebSocket> _clients = [];
  final StreamController<Uint8List> _frameController =
      StreamController<Uint8List>.broadcast();
  bool _isRunning = false;

  /// 스트리밍 서버 시작
  Future<ServerInfo> start() async {
    if (_isRunning) {
      final server = _server!;
      return ServerInfo(server.address.address, server.port);
    }

    // 서버 생성
    _server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final server = _server!;

    _isRunning = true;
    print('스트리밍 서버가 시작되었습니다: ${server.address.address}:${server.port}');

    // 요청 처리
    server.listen((HttpRequest request) {
      final path = request.uri.path;

      if (path == '/stream' || path == '/stream/') {
        _handleWebSocket(request);
      } else if (path == '/stream.html') {
        _handleStreamPage(request);
      } else {
        request.response.statusCode = HttpStatus.notFound;
        request.response.close();
      }
    });

    // 프레임 처리
    _frameController.stream.listen((frame) {
      if (_clients.isEmpty) return;

      final base64Frame = base64Encode(frame);
      for (var client in _clients) {
        try {
          client.add(base64Frame);
        } catch (e) {
          print('클라이언트 전송 오류: $e');
        }
      }
    });

    return ServerInfo(server.address.address, server.port);
  }

  /// 프레임 전송
  Future<void> sendFrame(Uint8List frame) async {
    if (!_isRunning || _clients.isEmpty) return;
    _frameController.add(frame);
  }

  /// WebSocket 연결 처리
  void _handleWebSocket(HttpRequest request) async {
    try {
      final socket = await WebSocketTransformer.upgrade(request);
      _clients.add(socket);

      print('새로운 WebSocket 클라이언트가 연결되었습니다. 총 ${_clients.length}개');

      socket.listen((data) {
        // 클라이언트 메시지 처리 (필요한 경우)
      }, onDone: () {
        _clients.remove(socket);
        print('WebSocket 클라이언트 연결이 종료되었습니다. 남은 수: ${_clients.length}');
      }, onError: (error) {
        _clients.remove(socket);
        print('WebSocket 오류: $error');
      });
    } catch (e) {
      print('WebSocket 연결 실패: $e');
      request.response.statusCode = HttpStatus.internalServerError;
      request.response.close();
    }
  }

  /// 스트리밍 페이지 응답
  void _handleStreamPage(HttpRequest request) {
    request.response.headers.contentType = ContentType.html;
    request.response.write('''
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>WebView Stream</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body, html { margin: 0; padding: 0; width: 100%; height: 100%; }
          #videoCanvas { width: 100%; height: 100%; object-fit: contain; }
        </style>
      </head>
      <body>
        <canvas id="videoCanvas"></canvas>
        <script>
          const canvas = document.getElementById('videoCanvas');
          const ctx = canvas.getContext('2d');
          const wsUrl = 'ws://' + window.location.host + '/stream';
          let ws;
          let reconnectTimer;
          
          function setupWebSocket() {
            ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
              console.log('WebSocket 연결됨');
              clearTimeout(reconnectTimer);
            };
            
            ws.onmessage = (event) => {
              const img = new Image();
              img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
              };
              img.src = 'data:image/jpeg;base64,' + event.data;
            };
            
            ws.onclose = () => {
              console.log('WebSocket 연결 종료, 재연결 시도 중...');
              reconnectTimer = setTimeout(setupWebSocket, 1000);
            };
            
            ws.onerror = (error) => {
              console.error('WebSocket 오류:', error);
              ws.close();
            };
          }
          
          setupWebSocket();
        </script>
      </body>
      </html>
    ''');
    request.response.close();
  }

  /// 서버 중지
  Future<void> stop() async {
    if (!_isRunning) return;

    // 연결된 클라이언트 모두 종료
    for (var client in List.from(_clients)) {
      await client.close();
    }
    _clients.clear();

    // 서버 종료
    await _server?.close(force: true);
    _server = null;
    _isRunning = false;

    print('스트리밍 서버가 중지되었습니다');
  }

  /// 리소스 정리
  Future<void> dispose() async {
    await stop();
    await _frameController.close();
  }
}

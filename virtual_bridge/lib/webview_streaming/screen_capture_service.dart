import 'dart:convert';
import 'dart:typed_data';
import 'package:webview_flutter/webview_flutter.dart';

class ScreenCaptureService {
  WebViewController? _controller;

  void initialize(WebViewController controller) {
    _controller = controller;
  }

  Future<Uint8List?> captureWebView([Uint8List? placeholder]) async {
    if (_controller == null) {
      return placeholder;
    }

    try {
      // WebView 화면을 캡처하는 JavaScript 실행
      final String screenshotBase64 =
          await _controller!.runJavaScriptReturningResult('''
        (function() {
          try {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            canvas.width = width;
            canvas.height = height;
            
            // 현재 화면 그리기
            context.fillStyle = "white";
            context.fillRect(0, 0, width, height);
            
            // html2canvas 라이브러리가 있다면 사용할 수 있지만, 
            // 기본 방식으로는 body의 내용을 렌더링
            const scrollX = window.scrollX;
            const scrollY = window.scrollY;
            
            context.drawWindow 
              ? context.drawWindow(window, scrollX, scrollY, width, height, "rgb(255,255,255)") 
              : context.drawImage(document.documentElement, 0, 0);
              
            return canvas.toDataURL("image/jpeg", 0.8).replace(/^data:image\\/jpeg;base64,/, "");
          } catch (e) {
            console.error("Screenshot error:", e);
            return "";
          }
        })();
      ''') as String;

      // 따옴표 제거 (JavaScript 문자열 반환값 처리)
      final cleanBase64 = screenshotBase64.replaceAll('"', '');
      if (cleanBase64.isEmpty) return placeholder;

      // Base64 디코딩
      return base64Decode(cleanBase64);
    } catch (e) {
      print('WebView 캡처 실패: $e');
      return placeholder;
    }
  }
}

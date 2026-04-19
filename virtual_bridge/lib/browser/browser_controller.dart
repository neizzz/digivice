import 'dart:convert';
import 'dart:io';

import 'package:android_intent_plus/android_intent.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

const MethodChannel _gmailDraftChannel = MethodChannel(
  'digivice/browser_mail',
);

class BrowserController {
  final Function(String jsCode) runJavaScript;
  final Function({required String id, String? data, String? error})
      resolvePromise;
  final Function(String message) log;

  BrowserController({
    required this.runJavaScript,
    required this.resolvePromise,
    required this.log,
  });

  String getJavaScriptInterface() {
    return '''
      window.browserController = {
        openExternalUrl: (url) => {
          return __createPromise((id) => {
            __native_browser_open.postMessage(JSON.stringify({
              id,
              operation: 'openExternalUrl',
              url,
            }));
          });
        },
        openGmailDraft: (to, subject, body, attachments) => {
          return __createPromise((id) => {
            __native_browser_open.postMessage(JSON.stringify({
              id,
              operation: 'openGmailDraft',
              to,
              subject,
              body,
              attachments,
            }));
          });
        }
      };
    ''';
  }

  Future<void> handleOpenExternalUrl(JavaScriptMessage message) async {
    final Map<String, dynamic> jsArgs =
        jsonDecode(message.message) as Map<String, dynamic>;
    final String id = jsArgs['id'] as String;
    final String operation =
        (jsArgs['operation'] as String?) ?? 'openExternalUrl';
    final String? url = jsArgs['url'] as String?;
    final String? to = jsArgs['to'] as String?;
    final String? subject = jsArgs['subject'] as String?;
    final String? body = jsArgs['body'] as String?;
    final List<dynamic>? attachments = jsArgs['attachments'] as List<dynamic>?;

    if (operation == 'openGmailDraft') {
      await _handleOpenGmailDraft(
        id: id,
        to: to,
        subject: subject,
        body: body,
        attachments: attachments,
      );
      return;
    }

    if (url == null || url.isEmpty) {
      resolvePromise(id: id, error: 'openExternalUrl requires url');
      return;
    }

    try {
      if (Platform.isAndroid) {
        final AndroidIntent intent = AndroidIntent(
          action: 'action_view',
          data: url,
        );
        await intent.launch();
        resolvePromise(id: id, data: 'success');
        log('[BrowserController] Opened external URL on Android: $url');
        return;
      }

      resolvePromise(
        id: id,
        error: 'External browser opening is not supported on this platform',
      );
    } catch (e) {
      log('[BrowserController] Failed to open external URL: $e');
      resolvePromise(id: id, error: e.toString());
    }
  }

  Future<void> _handleOpenGmailDraft({
    required String id,
    required String? to,
    required String? subject,
    required String? body,
    required List<dynamic>? attachments,
  }) async {
    if (to == null || to.isEmpty) {
      resolvePromise(id: id, error: 'openGmailDraft requires recipient');
      return;
    }

    try {
      if (Platform.isAndroid) {
        await _gmailDraftChannel
            .invokeMethod<void>('openGmailDraft', <String, dynamic>{
          'to': to,
          'subject': subject ?? '',
          'body': body ?? '',
          'attachments': attachments ?? <dynamic>[],
        });
        resolvePromise(id: id, data: 'success');
        log('[BrowserController] Opened Gmail draft on Android for $to');
        return;
      }

      resolvePromise(
        id: id,
        error: 'Gmail draft opening is not supported on this platform',
      );
    } catch (e) {
      if (Platform.isAndroid && (attachments == null || attachments.isEmpty)) {
        try {
          final AndroidIntent intent = AndroidIntent(
            action: 'android.intent.action.SEND',
            package: 'com.google.android.gm',
            type: 'message/rfc822',
            arguments: <String, dynamic>{
              'android.intent.extra.SUBJECT': subject ?? '',
              'android.intent.extra.TEXT': body ?? '',
            },
            arrayArguments: <String, List<dynamic>>{
              'android.intent.extra.EMAIL': <String>[to],
            },
          );
          await intent.launch();
          resolvePromise(id: id, data: 'success');
          log('[BrowserController] Opened Gmail draft on Android via fallback intent for $to');
          return;
        } catch (fallbackError) {
          log('[BrowserController] Gmail fallback intent failed: $fallbackError');
        }
      }

      log('[BrowserController] Failed to open Gmail draft: $e');
      resolvePromise(id: id, error: e.toString());
    }
  }

  void dispose() {}
}

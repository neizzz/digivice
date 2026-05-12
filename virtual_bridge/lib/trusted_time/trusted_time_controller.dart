import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:webview_flutter/webview_flutter.dart';

const String _trustedTimeCacheKey = 'trusted_time_snapshot_v1';
const int _ntpEpochOffsetSeconds = 2208988800;
const int _ntpPort = 123;
const Duration _ntpTimeout = Duration(seconds: 2);
const List<String> _googleNtpServers = <String>[
  'time.google.com',
  'time1.google.com',
  'time2.google.com',
  'time3.google.com',
  'time4.google.com',
];

class TrustedTimeSnapshot {
  final int trustedUtcMs;
  final int osUptimeMs;
  final String source;
  final int uncertaintyMs;
  final int capturedWallMs;

  const TrustedTimeSnapshot({
    required this.trustedUtcMs,
    required this.osUptimeMs,
    required this.source,
    required this.uncertaintyMs,
    required this.capturedWallMs,
  });

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'trustedUtcMs': trustedUtcMs,
      'osUptimeMs': osUptimeMs,
      'source': source,
      'uncertaintyMs': uncertaintyMs,
      'capturedWallMs': capturedWallMs,
    };
  }

  static TrustedTimeSnapshot? fromJsonString(String? raw) {
    if (raw == null || raw.isEmpty) {
      return null;
    }

    try {
      final Map<String, dynamic> data = jsonDecode(raw) as Map<String, dynamic>;
      final int? trustedUtcMs = (data['trustedUtcMs'] as num?)?.round();
      final int? osUptimeMs = (data['osUptimeMs'] as num?)?.round();
      final String? source = data['source'] as String?;
      final int? uncertaintyMs = (data['uncertaintyMs'] as num?)?.round();
      final int? capturedWallMs = (data['capturedWallMs'] as num?)?.round();

      if (trustedUtcMs == null ||
          osUptimeMs == null ||
          source == null ||
          uncertaintyMs == null ||
          capturedWallMs == null) {
        return null;
      }

      return TrustedTimeSnapshot(
        trustedUtcMs: trustedUtcMs,
        osUptimeMs: osUptimeMs,
        source: source,
        uncertaintyMs: uncertaintyMs,
        capturedWallMs: capturedWallMs,
      );
    } catch (_) {
      return null;
    }
  }
}

class TrustedTimeController {
  static const MethodChannel _platformChannel = MethodChannel(
    'digivice/trusted_time',
  );

  final Function({required String id, String? data, String? error})
      resolvePromise;
  final Function(String message) log;

  TrustedTimeController({
    required this.resolvePromise,
    required this.log,
  });

  String getJavaScriptInterface() {
    return '''
      window.trustedTimeController = {
        getSnapshot: (options = {}) => {
          return __createPromise((id) => {
            __native_trusted_time_get_snapshot.postMessage(JSON.stringify({
              id,
              forceRefresh: Boolean(options && options.forceRefresh),
            }));
          }).then((raw) => {
            if (!raw) {
              return null;
            }
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
          });
        }
      };
    ''';
  }

  Future<void> handleGetSnapshot(JavaScriptMessage message) async {
    final Map<String, dynamic> jsArgs =
        jsonDecode(message.message) as Map<String, dynamic>;
    final String id = jsArgs['id'] as String;
    final bool forceRefresh = jsArgs['forceRefresh'] == true;

    try {
      final TrustedTimeSnapshot? snapshot = await getSnapshot(
        forceRefresh: forceRefresh,
      );

      if (snapshot == null) {
        throw StateError('Trusted time is unavailable');
      }

      resolvePromise(id: id, data: jsonEncode(snapshot.toJson()));
    } catch (error) {
      log('[TrustedTimeController] getSnapshot failed: $error');
      resolvePromise(id: id, error: error.toString());
    }
  }

  Future<TrustedTimeSnapshot?> getSnapshot({bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final TrustedTimeSnapshot? cached = await _getCachedUptimeSnapshot();
      if (cached != null) {
        return cached;
      }
    }

    final TrustedTimeSnapshot? refreshed = await _fetchNtpSnapshot();
    if (refreshed != null) {
      await _cacheSnapshot(refreshed);
      return refreshed;
    }

    return _getCachedUptimeSnapshot();
  }

  Future<TrustedTimeSnapshot?> _fetchNtpSnapshot() async {
    final StreamController<TrustedTimeSnapshot?> resultController =
        StreamController<TrustedTimeSnapshot?>();
    var remaining = _googleNtpServers.length;

    void emitSnapshot(TrustedTimeSnapshot? snapshot) {
      if (!resultController.isClosed) {
        resultController.add(snapshot);
      }
    }

    for (final String server in _googleNtpServers) {
      unawaited(
        _queryNtpServer(server).then((TrustedTimeSnapshot snapshot) {
          log('[TrustedTimeController] NTP sync success server=$server '
              'uncertaintyMs=${snapshot.uncertaintyMs}');
          emitSnapshot(snapshot);
        }).catchError((Object error) {
          log('[TrustedTimeController] NTP sync failed server=$server error=$error');
          emitSnapshot(null);
        }).whenComplete(() async {
          remaining -= 1;
          if (remaining == 0 && !resultController.isClosed) {
            await resultController.close();
          }
        }),
      );
    }

    await for (final TrustedTimeSnapshot? snapshot in resultController.stream) {
      if (snapshot != null) {
        if (!resultController.isClosed) {
          unawaited(resultController.close());
        }
        return snapshot;
      }
    }

    return null;
  }

  Future<TrustedTimeSnapshot> _queryNtpServer(String server) async {
    final List<InternetAddress> addresses = await InternetAddress.lookup(
      server,
      type: InternetAddressType.IPv4,
    ).timeout(_ntpTimeout);

    if (addresses.isEmpty) {
      throw StateError('No IPv4 address resolved for $server');
    }

    final RawDatagramSocket socket = await RawDatagramSocket.bind(
      InternetAddress.anyIPv4,
      0,
    ).timeout(_ntpTimeout);

    final Stopwatch stopwatch = Stopwatch()..start();

    try {
      final Uint8List request = Uint8List(48);
      request[0] = 0x1B;
      socket.send(request, addresses.first, _ntpPort);

      final Completer<Datagram> completer = Completer<Datagram>();
      StreamSubscription<RawSocketEvent>? subscription;
      subscription = socket.listen((RawSocketEvent event) {
        if (event != RawSocketEvent.read || completer.isCompleted) {
          return;
        }

        final Datagram? datagram = socket.receive();
        if (datagram != null && datagram.data.length >= 48) {
          completer.complete(datagram);
        }
      });

      final Datagram response;
      try {
        response = await completer.future.timeout(_ntpTimeout);
      } finally {
        await subscription.cancel();
      }
      stopwatch.stop();

      final int transmitUtcMs = _readNtpTimestampMs(response.data, 40);
      final int uptimeMs = await _getOsUptimeMs();
      final int uncertaintyMs = (stopwatch.elapsedMilliseconds / 2).ceil();

      return TrustedTimeSnapshot(
        trustedUtcMs: transmitUtcMs + uncertaintyMs,
        osUptimeMs: uptimeMs,
        source: 'ntp',
        uncertaintyMs: uncertaintyMs,
        capturedWallMs: DateTime.now().toUtc().millisecondsSinceEpoch,
      );
    } finally {
      socket.close();
    }
  }

  int _readNtpTimestampMs(Uint8List data, int offset) {
    final ByteData byteData = ByteData.sublistView(data);
    final int seconds = byteData.getUint32(offset);
    final int fraction = byteData.getUint32(offset + 4);
    final int unixSeconds = seconds - _ntpEpochOffsetSeconds;
    final int fractionMs = ((fraction * 1000) / 0x100000000).round();
    return unixSeconds * 1000 + fractionMs;
  }

  Future<int> _getOsUptimeMs() async {
    final Object? result = await _platformChannel.invokeMethod<Object?>(
      'getOsUptimeMs',
    );

    if (result is int) {
      return result;
    }

    if (result is double) {
      return result.round();
    }

    throw StateError('Invalid OS uptime result: $result');
  }

  Future<TrustedTimeSnapshot?> _getCachedUptimeSnapshot() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final TrustedTimeSnapshot? cached = TrustedTimeSnapshot.fromJsonString(
      prefs.getString(_trustedTimeCacheKey),
    );

    if (cached == null) {
      return null;
    }

    final int currentUptimeMs = await _getOsUptimeMs();
    final int elapsedUptimeMs = currentUptimeMs - cached.osUptimeMs;

    if (elapsedUptimeMs < 0) {
      log('[TrustedTimeController] Cached trusted time ignored after reboot');
      return null;
    }

    return TrustedTimeSnapshot(
      trustedUtcMs: cached.trustedUtcMs + elapsedUptimeMs,
      osUptimeMs: currentUptimeMs,
      source: 'cached-uptime',
      uncertaintyMs: cached.uncertaintyMs + 1000,
      capturedWallMs: DateTime.now().toUtc().millisecondsSinceEpoch,
    );
  }

  Future<void> _cacheSnapshot(TrustedTimeSnapshot snapshot) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString(_trustedTimeCacheKey, jsonEncode(snapshot.toJson()));
  }
}

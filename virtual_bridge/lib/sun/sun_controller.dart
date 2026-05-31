import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'native_sun_times_diagnostics.dart';
import 'sun_calculator.dart';

const String _fallbackLocationKey = 'sun_fallback_location';
const Duration _locationPermissionTimeout = Duration(seconds: 8);
const Duration _locationServiceCheckTimeout = Duration(seconds: 4);
const Duration _currentPositionTimeout = Duration(seconds: 8);
const Duration _lastKnownPositionTimeout = Duration(seconds: 4);

class _FallbackLocation {
  final double latitude;
  final double longitude;
  final int timezoneOffsetMinutes;
  final String timezone;

  const _FallbackLocation({
    required this.latitude,
    required this.longitude,
    required this.timezoneOffsetMinutes,
    required this.timezone,
  });

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'latitude': latitude,
      'longitude': longitude,
      'timezoneOffsetMinutes': timezoneOffsetMinutes,
      'timezone': timezone,
    };
  }

  static _FallbackLocation? fromJsonString(String? raw) {
    if (raw == null || raw.isEmpty) {
      return null;
    }

    try {
      final Map<String, dynamic> data = jsonDecode(raw) as Map<String, dynamic>;
      final double? latitude = (data['latitude'] as num?)?.toDouble();
      final double? longitude = (data['longitude'] as num?)?.toDouble();
      final int? timezoneOffsetMinutes =
          (data['timezoneOffsetMinutes'] as num?)?.round();
      final String? timezone = data['timezone'] as String?;

      if (latitude == null ||
          longitude == null ||
          timezoneOffsetMinutes == null ||
          timezone == null) {
        return null;
      }

      return _FallbackLocation(
        latitude: latitude,
        longitude: longitude,
        timezoneOffsetMinutes: timezoneOffsetMinutes,
        timezone: timezone,
      );
    } catch (_) {
      return null;
    }
  }
}

const List<_FallbackLocation> _fallbackCandidates = <_FallbackLocation>[
  _FallbackLocation(
    latitude: 37.5665,
    longitude: 126.9780,
    timezoneOffsetMinutes: 540,
    timezone: 'Asia/Seoul',
  ),
  _FallbackLocation(
    latitude: 35.6762,
    longitude: 139.6503,
    timezoneOffsetMinutes: 540,
    timezone: 'Asia/Tokyo',
  ),
  _FallbackLocation(
    latitude: 1.3521,
    longitude: 103.8198,
    timezoneOffsetMinutes: 480,
    timezone: 'Asia/Singapore',
  ),
  _FallbackLocation(
    latitude: 13.7563,
    longitude: 100.5018,
    timezoneOffsetMinutes: 420,
    timezone: 'Asia/Bangkok',
  ),
  _FallbackLocation(
    latitude: 14.5995,
    longitude: 120.9842,
    timezoneOffsetMinutes: 480,
    timezone: 'Asia/Manila',
  ),
  _FallbackLocation(
    latitude: 21.3069,
    longitude: -157.8583,
    timezoneOffsetMinutes: -600,
    timezone: 'Pacific/Honolulu',
  ),
];

class _ResolvedLocation {
  final double latitude;
  final double longitude;
  final int timezoneOffsetMinutes;
  final String timezone;
  final String locationSource;
  final bool hasLocationPermission;

  const _ResolvedLocation({
    required this.latitude,
    required this.longitude,
    required this.timezoneOffsetMinutes,
    required this.timezone,
    required this.locationSource,
    required this.hasLocationPermission,
  });
}

class _PermissionResolutionResult {
  final bool granted;
  final bool alreadyGranted;
  final bool requestedPermission;

  const _PermissionResolutionResult({
    required this.granted,
    required this.alreadyGranted,
    required this.requestedPermission,
  });
}

/// 위치 기반 일출/일몰 기능의 JavaScript 인터페이스를 관리하는 컨트롤러
class SunController {
  final Future<void> Function(String jsCode) runJavaScript;
  final Function({required String id, String? data, String? error})
      resolvePromise;
  final Function(String message) log;
  final SunCalculator _sunCalculator = const SunCalculator();
  final Random _random = Random();
  late final NativeSunTimesDiagnostics _diagnostics;

  SunController({
    required this.runJavaScript,
    required this.resolvePromise,
    required this.log,
  }) {
    _diagnostics = NativeSunTimesDiagnostics(runJavaScript);
  }

  String getJavaScriptInterface() {
    return '''
      window.sunController = {
        getSunTimes: (promptForPermission = true, traceContext = null) => {
          return __createPromise((id) => {
            __native_sun_get_times.postMessage(JSON.stringify({
              id,
              promptForPermission,
              traceContext,
            }));
          }).then((raw) => {
            if (!raw) {
              return null;
            }
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
          });
        },
        requestLocationPermission: () => {
          return __createPromise((id) => {
            __native_sun_request_permission.postMessage(JSON.stringify({ id }));
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

  Future<void> handleGetSunTimes(JavaScriptMessage message) async {
    final Map<String, dynamic> jsArgs =
        jsonDecode(message.message) as Map<String, dynamic>;
    final String id = jsArgs['id'] as String;
    final bool promptForPermission = jsArgs['promptForPermission'] != false;
    final Map<String, dynamic>? traceContext =
        _diagnostics.sanitizeTraceContext(jsArgs['traceContext']);
    final Stopwatch stopwatch = Stopwatch()..start();

    await _diagnostics.emitRequestStart(
      promptForPermission: promptForPermission,
      traceContext: traceContext,
    );

    try {
      final _ResolvedLocation location = await _resolveLocation(
        promptForPermission: promptForPermission,
        traceContext: traceContext,
      );
      final Map<String, dynamic> payload = _buildSunTimesPayload(location);

      resolvePromise(id: id, data: jsonEncode(payload));
      await _diagnostics.emitRequestEnd(
        durationMs: stopwatch.elapsedMilliseconds,
        promptForPermission: promptForPermission,
        locationSource: location.locationSource,
        hasLocationPermission: location.hasLocationPermission,
        traceContext: traceContext,
      );
      log(
        '[SunController] Sun times resolved (${location.locationSource}, permission=${location.hasLocationPermission})',
      );
    } catch (e) {
      resolvePromise(id: id, error: e.toString());
      await _diagnostics.emitRequestError(
        durationMs: stopwatch.elapsedMilliseconds,
        promptForPermission: promptForPermission,
        error: e,
        traceContext: traceContext,
      );
      log('[SunController] Failed to resolve sun times: $e');
    }
  }

  Future<void> handleRequestLocationPermission(
      JavaScriptMessage message) async {
    final Map<String, dynamic> jsArgs =
        jsonDecode(message.message) as Map<String, dynamic>;
    final String id = jsArgs['id'] as String;

    try {
      final bool granted = await _requestLocationPermission();
      resolvePromise(
        id: id,
        data: jsonEncode(<String, dynamic>{
          'granted': granted,
        }),
      );
      log('[SunController] Location permission request result: $granted');
    } catch (e) {
      resolvePromise(id: id, error: e.toString());
      log('[SunController] Failed to request location permission: $e');
    }
  }

  Map<String, dynamic> _buildSunTimesPayload(_ResolvedLocation location) {
    final DateTime nowAtLocation = DateTime.now()
        .toUtc()
        .add(Duration(minutes: location.timezoneOffsetMinutes));
    final DateTime localDate = DateTime(
      nowAtLocation.year,
      nowAtLocation.month,
      nowAtLocation.day,
    );

    final SunTimesResult sunTimes = _sunCalculator.calculate(
      localDate: localDate,
      latitude: location.latitude,
      longitude: location.longitude,
    );

    return <String, dynamic>{
      'sunriseAt': _formatIsoWithOffset(
        sunTimes.sunriseUtc,
        location.timezoneOffsetMinutes,
      ),
      'sunsetAt': _formatIsoWithOffset(
        sunTimes.sunsetUtc,
        location.timezoneOffsetMinutes,
      ),
      'date': _formatDate(localDate),
      'timezone': location.timezone,
      'timezoneOffsetMinutes': location.timezoneOffsetMinutes,
      'fetchedAt': _formatIsoWithOffset(
        DateTime.now().toUtc(),
        location.timezoneOffsetMinutes,
      ),
      'locationSource': location.locationSource,
      'hasLocationPermission': location.hasLocationPermission,
    };
  }

  Future<_ResolvedLocation> _resolveLocation({
    required bool promptForPermission,
    Map<String, dynamic>? traceContext,
  }) async {
    final _PermissionResolutionResult permissionResult =
        await _ensureLocationPermission(
      promptForPermission: promptForPermission,
      traceContext: traceContext,
    );
    final bool hasPermission = permissionResult.granted;

    if (hasPermission) {
      final Stopwatch serviceCheckStopwatch = Stopwatch()..start();
      final bool serviceEnabled = await Geolocator.isLocationServiceEnabled()
          .timeout(_locationServiceCheckTimeout);
      await _diagnostics.emitLocationServiceCheckEnd(
        durationMs: serviceCheckStopwatch.elapsedMilliseconds,
        serviceEnabled: serviceEnabled,
        traceContext: traceContext,
      );

      if (serviceEnabled) {
        final Stopwatch currentPositionStopwatch = Stopwatch()..start();
        await _diagnostics.emitCurrentPositionStart(
          serviceEnabled: serviceEnabled,
          traceContext: traceContext,
        );
        try {
          final Position position = await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.low,
            ),
          ).timeout(_currentPositionTimeout);
          await _diagnostics.emitCurrentPositionEnd(
            durationMs: currentPositionStopwatch.elapsedMilliseconds,
            serviceEnabled: serviceEnabled,
            traceContext: traceContext,
          );

          return _createDeviceResolvedLocation(position);
        } catch (e) {
          await _diagnostics.emitCurrentPositionError(
            durationMs: currentPositionStopwatch.elapsedMilliseconds,
            serviceEnabled: serviceEnabled,
            error: e,
            traceContext: traceContext,
          );
          log('[SunController] Failed to get device location, trying last known location: $e');
        }
      } else {
        log('[SunController] Location service disabled, trying last known location');
      }

      final Stopwatch lastKnownStopwatch = Stopwatch()..start();
      await _diagnostics.emitLastKnownPositionStart(
        serviceEnabled: serviceEnabled,
        traceContext: traceContext,
      );
      try {
        final Position? lastKnownPosition =
            await Geolocator.getLastKnownPosition()
                .timeout(_lastKnownPositionTimeout);
        await _diagnostics.emitLastKnownPositionEnd(
          durationMs: lastKnownStopwatch.elapsedMilliseconds,
          serviceEnabled: serviceEnabled,
          foundPosition: lastKnownPosition != null,
          traceContext: traceContext,
        );
        if (lastKnownPosition != null) {
          log('[SunController] Using last known device location');
          return _createDeviceResolvedLocation(lastKnownPosition);
        }

        log('[SunController] Last known device location is unavailable, using fallback location');
      } catch (e) {
        await _diagnostics.emitLastKnownPositionError(
          durationMs: lastKnownStopwatch.elapsedMilliseconds,
          serviceEnabled: serviceEnabled,
          error: e,
          traceContext: traceContext,
        );
        log('[SunController] Failed to get last known location, using fallback: $e');
      }
    }

    final _FallbackLocation fallback = await _getOrCreateFallbackLocation();
    await _diagnostics.emitFallbackLocationSelected(
      hasLocationPermission: hasPermission,
      traceContext: traceContext,
    );
    return _ResolvedLocation(
      latitude: fallback.latitude,
      longitude: fallback.longitude,
      timezoneOffsetMinutes: fallback.timezoneOffsetMinutes,
      timezone: fallback.timezone,
      locationSource: 'fallback',
      hasLocationPermission: hasPermission,
    );
  }

  _ResolvedLocation _createDeviceResolvedLocation(Position position) {
    final DateTime now = DateTime.now();
    return _ResolvedLocation(
      latitude: position.latitude,
      longitude: position.longitude,
      timezoneOffsetMinutes: now.timeZoneOffset.inMinutes,
      timezone: now.timeZoneName,
      locationSource: 'device',
      hasLocationPermission: true,
    );
  }

  Future<_PermissionResolutionResult> _ensureLocationPermission({
    required bool promptForPermission,
    Map<String, dynamic>? traceContext,
  }) async {
    final Stopwatch stopwatch = Stopwatch()..start();
    LocationPermission permission = await Geolocator.checkPermission()
        .timeout(_locationPermissionTimeout);
    if (_isGranted(permission)) {
      const _PermissionResolutionResult result = _PermissionResolutionResult(
        granted: true,
        alreadyGranted: true,
        requestedPermission: false,
      );
      await _diagnostics.emitPermissionResolutionEnd(
        durationMs: stopwatch.elapsedMilliseconds,
        promptForPermission: promptForPermission,
        alreadyGranted: result.alreadyGranted,
        requestedPermission: result.requestedPermission,
        granted: result.granted,
        traceContext: traceContext,
      );
      return result;
    }

    if (!promptForPermission) {
      const _PermissionResolutionResult result = _PermissionResolutionResult(
        granted: false,
        alreadyGranted: false,
        requestedPermission: false,
      );
      await _diagnostics.emitPermissionResolutionEnd(
        durationMs: stopwatch.elapsedMilliseconds,
        promptForPermission: promptForPermission,
        alreadyGranted: result.alreadyGranted,
        requestedPermission: result.requestedPermission,
        granted: result.granted,
        traceContext: traceContext,
      );
      return result;
    }

    permission = await Geolocator.requestPermission()
        .timeout(_locationPermissionTimeout);
    final _PermissionResolutionResult result = _PermissionResolutionResult(
      granted: _isGranted(permission),
      alreadyGranted: false,
      requestedPermission: true,
    );
    await _diagnostics.emitPermissionResolutionEnd(
      durationMs: stopwatch.elapsedMilliseconds,
      promptForPermission: promptForPermission,
      alreadyGranted: result.alreadyGranted,
      requestedPermission: result.requestedPermission,
      granted: result.granted,
      traceContext: traceContext,
    );
    return result;
  }

  Future<bool> _requestLocationPermission() async {
    final LocationPermission permission = await Geolocator.requestPermission()
        .timeout(_locationPermissionTimeout);
    return _isGranted(permission);
  }

  bool _isGranted(LocationPermission permission) {
    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  Future<_FallbackLocation> _getOrCreateFallbackLocation() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final _FallbackLocation? stored =
        _FallbackLocation.fromJsonString(prefs.getString(_fallbackLocationKey));
    if (stored != null) {
      return stored;
    }

    final _FallbackLocation fallback =
        _fallbackCandidates[_random.nextInt(_fallbackCandidates.length)];
    await prefs.setString(_fallbackLocationKey, jsonEncode(fallback.toJson()));
    return fallback;
  }

  String _formatDate(DateTime date) {
    return '${date.year.toString().padLeft(4, '0')}-'
        '${date.month.toString().padLeft(2, '0')}-'
        '${date.day.toString().padLeft(2, '0')}';
  }

  String _formatIsoWithOffset(DateTime utcDateTime, int offsetMinutes) {
    final DateTime zonedUtc =
        utcDateTime.toUtc().add(Duration(minutes: offsetMinutes));
    final DateTime localDateTime = DateTime(
      zonedUtc.year,
      zonedUtc.month,
      zonedUtc.day,
      zonedUtc.hour,
      zonedUtc.minute,
      zonedUtc.second,
    );

    final int absoluteMinutes = offsetMinutes.abs();
    final String sign = offsetMinutes >= 0 ? '+' : '-';
    final String offsetHour =
        (absoluteMinutes ~/ 60).toString().padLeft(2, '0');
    final String offsetMinute =
        (absoluteMinutes % 60).toString().padLeft(2, '0');

    return '${localDateTime.year.toString().padLeft(4, '0')}-'
        '${localDateTime.month.toString().padLeft(2, '0')}-'
        '${localDateTime.day.toString().padLeft(2, '0')}T'
        '${localDateTime.hour.toString().padLeft(2, '0')}:'
        '${localDateTime.minute.toString().padLeft(2, '0')}:'
        '${localDateTime.second.toString().padLeft(2, '0')}'
        '$sign$offsetHour:$offsetMinute';
  }

  void dispose() {}
}

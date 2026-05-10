import 'dart:convert';

class NativeSunTimesDiagnostics {
  static const String _nativeDiagnosticsSinkName =
      '__digiviceNativeBridgeDiagnostics';
  final Future<void> Function(String jsCode) _runJavaScript;

  NativeSunTimesDiagnostics(this._runJavaScript);

  Map<String, dynamic>? sanitizeTraceContext(dynamic raw) {
    if (raw is! Map) {
      return null;
    }

    final dynamic source = raw['source'];
    final dynamic phase = raw['phase'];
    final dynamic setupFlowId = raw['setupFlowId'];
    final dynamic initializationAttemptId = raw['initializationAttemptId'];

    return <String, dynamic>{
      if (source is String && source.isNotEmpty) 'source': source,
      if (phase is String && phase.isNotEmpty) 'phase': phase,
      if (setupFlowId is String && setupFlowId.isNotEmpty)
        'setupFlowId': setupFlowId,
      if (initializationAttemptId is num)
        'initializationAttemptId': initializationAttemptId.round(),
    };
  }

  Future<void> emitRequestStart({
    required bool promptForPermission,
    Map<String, dynamic>? traceContext,
  }) async {
    await _emit('request_start', <String, dynamic>{
      'promptForPermission': promptForPermission,
      if (traceContext != null) 'traceContext': traceContext,
    });
  }

  Future<void> emitRequestEnd({
    required int durationMs,
    required bool promptForPermission,
    required String locationSource,
    required bool hasLocationPermission,
    Map<String, dynamic>? traceContext,
  }) async {
    await _emit('request_end', <String, dynamic>{
      'durationMs': durationMs,
      'promptForPermission': promptForPermission,
      'locationSource': locationSource,
      'hasLocationPermission': hasLocationPermission,
      if (traceContext != null) 'traceContext': traceContext,
    });
  }

  Future<void> emitRequestError({
    required int durationMs,
    required bool promptForPermission,
    required Object error,
    Map<String, dynamic>? traceContext,
  }) async {
    await _emit('request_error', <String, dynamic>{
      'durationMs': durationMs,
      'promptForPermission': promptForPermission,
      'error': error.toString(),
      if (traceContext != null) 'traceContext': traceContext,
    });
  }

  Future<void> emitLocationServiceCheckEnd({
    required int durationMs,
    required bool serviceEnabled,
    Map<String, dynamic>? traceContext,
  }) async {
    await _emit('location_service_check_end', <String, dynamic>{
      'durationMs': durationMs,
      'serviceEnabled': serviceEnabled,
      if (traceContext != null) 'traceContext': traceContext,
    });
  }

  Future<void> emitCurrentPositionStart({
    required bool serviceEnabled,
    Map<String, dynamic>? traceContext,
  }) async {
    await _emit('current_position_start', <String, dynamic>{
      'serviceEnabled': serviceEnabled,
      if (traceContext != null) 'traceContext': traceContext,
    });
  }

  Future<void> emitCurrentPositionEnd({
    required int durationMs,
    required bool serviceEnabled,
    Map<String, dynamic>? traceContext,
  }) async {
    await _emit('current_position_end', <String, dynamic>{
      'durationMs': durationMs,
      'serviceEnabled': serviceEnabled,
      if (traceContext != null) 'traceContext': traceContext,
    });
  }

  Future<void> emitCurrentPositionError({
    required int durationMs,
    required bool serviceEnabled,
    required Object error,
    Map<String, dynamic>? traceContext,
  }) async {
    await _emit('current_position_error', <String, dynamic>{
      'durationMs': durationMs,
      'serviceEnabled': serviceEnabled,
      'error': error.toString(),
      if (traceContext != null) 'traceContext': traceContext,
    });
  }

  Future<void> emitLastKnownPositionStart({
    required bool serviceEnabled,
    Map<String, dynamic>? traceContext,
  }) async {
    await _emit('last_known_position_start', <String, dynamic>{
      'serviceEnabled': serviceEnabled,
      if (traceContext != null) 'traceContext': traceContext,
    });
  }

  Future<void> emitLastKnownPositionEnd({
    required int durationMs,
    required bool serviceEnabled,
    required bool foundPosition,
    Map<String, dynamic>? traceContext,
  }) async {
    await _emit('last_known_position_end', <String, dynamic>{
      'durationMs': durationMs,
      'serviceEnabled': serviceEnabled,
      'foundPosition': foundPosition,
      if (traceContext != null) 'traceContext': traceContext,
    });
  }

  Future<void> emitLastKnownPositionError({
    required int durationMs,
    required bool serviceEnabled,
    required Object error,
    Map<String, dynamic>? traceContext,
  }) async {
    await _emit('last_known_position_error', <String, dynamic>{
      'durationMs': durationMs,
      'serviceEnabled': serviceEnabled,
      'error': error.toString(),
      if (traceContext != null) 'traceContext': traceContext,
    });
  }

  Future<void> emitFallbackLocationSelected({
    required bool hasLocationPermission,
    Map<String, dynamic>? traceContext,
  }) async {
    await _emit('fallback_location_selected', <String, dynamic>{
      'locationSource': 'fallback',
      'hasLocationPermission': hasLocationPermission,
      if (traceContext != null) 'traceContext': traceContext,
    });
  }

  Future<void> emitPermissionResolutionEnd({
    required int durationMs,
    required bool promptForPermission,
    required bool alreadyGranted,
    required bool requestedPermission,
    required bool granted,
    Map<String, dynamic>? traceContext,
  }) async {
    await _emit('permission_resolution_end', <String, dynamic>{
      'durationMs': durationMs,
      'promptForPermission': promptForPermission,
      'alreadyGranted': alreadyGranted,
      'requestedPermission': requestedPermission,
      'granted': granted,
      if (traceContext != null) 'traceContext': traceContext,
    });
  }

  Future<void> _emit(String phase, Map<String, dynamic> payload) async {
    final String encodedPayload = jsonEncode(<String, dynamic>{
      'tag': 'NativeSunTimesTiming',
      'phase': phase,
      ...payload,
    });

    try {
      await _runJavaScript(
        '''
        (function () {
          const nextEntry = $encodedPayload;
          const sinkName = '$_nativeDiagnosticsSinkName';
          const existing = Array.isArray(window[sinkName]) ? window[sinkName] : [];
          existing.push(nextEntry);
          if (existing.length > 200) {
            existing.splice(0, existing.length - 200);
          }
          window[sinkName] = existing;
        })();
        ''',
      );
    } catch (_) {
      // Diagnostics emission should never block sun time resolution.
    }
  }
}

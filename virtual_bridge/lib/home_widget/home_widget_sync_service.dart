import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

const String worldDataStorageKey = 'MainSceneWorldData';
const String homeWidgetSnapshotStorageKey = 'HomeWidgetSnapshotV1';
const String homeWidgetAuthoritativeSnapshotStorageKey =
    'HomeWidgetAuthoritativeSnapshotV1';
const String nativeHomeWidgetSnapshotKey = 'home_widget_snapshot_v1';
const String nativeHomeWidgetAuthoritativeSnapshotKey =
    'home_widget_authoritative_snapshot_v1';
const String nativeHomeWidgetStorageName = 'digivice_home_widget';
const String widgetRefreshLaunchMode = 'widget_refresh';

const int _characterObjectType = 1;
const int _characterStateEgg = 0;
const int _characterStateIdle = 1;
const int _characterStateMoving = 2;
const int _characterStateSleeping = 3;
const int _characterStateSick = 4;
const int _characterStateEating = 5;
const int _characterStateDead = 6;

const int _characterStatusUrgent = 2;
const int _characterStatusSick = 3;
const int _characterStatusHappy = 4;
const int _characterStatusDiscover = 5;

const double _maxStamina = 10;
const double _lowStaminaThreshold = 3;
const double _boostedStaminaThreshold = 7;
const int _animationFrameCount = 4;

const int _staminaDecreaseIntervalMs = 12 * 60 * 1000;
const double _staminaDecreaseAmount = 0.25;
const double _highStaminaDecayMultiplier = 1.3;
const double _lowStaminaDecayMultiplier = 0.7;
const double _sleepingStaminaDecayMultiplier = 0.2;
const int _projectionVersion = 1;

enum HomeWidgetSnapshotKind {
  authoritativeAppState,
  widgetProgressed,
}

enum HomeWidgetCharacterState {
  egg,
  idle,
  moving,
  sleeping,
  sick,
  eating,
  dead,
}

enum HomeWidgetTimeOfDay {
  day,
  sunrise,
  sunset,
  night,
}

enum HomeWidgetDisplayState {
  idle,
  sleep,
  sick,
}

enum HomeWidgetStaminaLevel {
  red,
  orange,
  green,
}

enum HomeWidgetStatusIcon {
  sick,
  happy,
  discover,
  sleeping,
}

class HomeWidgetSnapshot {
  final int schemaVersion;
  final HomeWidgetSnapshotKind snapshotKind;
  final String? monsterName;
  final int? characterKey;
  final HomeWidgetCharacterState characterState;
  final HomeWidgetDisplayState displayState;
  final HomeWidgetTimeOfDay timeOfDay;
  final double stamina;
  final double maxStamina;
  final double staminaPercent;
  final HomeWidgetStaminaLevel staminaLevel;
  final bool useLocalTime;
  final int animationFrameIndex;
  final int updatedAtMs;
  final int snapshotComputedAtMs;
  final int? lastActiveTimeMs;
  final int? baseLastActiveTimeMs;
  final int projectedElapsedMs;
  final int projectionVersion;
  final double staminaTimerMs;
  final bool hasUrgentStatus;
  final List<HomeWidgetStatusIcon> visibleStatusIcons;

  const HomeWidgetSnapshot({
    required this.schemaVersion,
    required this.snapshotKind,
    required this.monsterName,
    required this.characterKey,
    required this.characterState,
    required this.displayState,
    required this.timeOfDay,
    required this.stamina,
    required this.maxStamina,
    required this.staminaPercent,
    required this.staminaLevel,
    required this.useLocalTime,
    required this.animationFrameIndex,
    required this.updatedAtMs,
    required this.snapshotComputedAtMs,
    required this.lastActiveTimeMs,
    required this.baseLastActiveTimeMs,
    required this.projectedElapsedMs,
    required this.projectionVersion,
    required this.staminaTimerMs,
    required this.hasUrgentStatus,
    required this.visibleStatusIcons,
  });

  HomeWidgetSnapshot copyWith({
    HomeWidgetSnapshotKind? snapshotKind,
    String? monsterName,
    int? characterKey,
    HomeWidgetCharacterState? characterState,
    HomeWidgetDisplayState? displayState,
    HomeWidgetTimeOfDay? timeOfDay,
    double? stamina,
    double? maxStamina,
    double? staminaPercent,
    HomeWidgetStaminaLevel? staminaLevel,
    bool? useLocalTime,
    int? animationFrameIndex,
    int? updatedAtMs,
    int? snapshotComputedAtMs,
    Object? lastActiveTimeMs = _sentinel,
    Object? baseLastActiveTimeMs = _sentinel,
    int? projectedElapsedMs,
    int? projectionVersion,
    double? staminaTimerMs,
    bool? hasUrgentStatus,
    List<HomeWidgetStatusIcon>? visibleStatusIcons,
  }) {
    return HomeWidgetSnapshot(
      schemaVersion: schemaVersion,
      snapshotKind: snapshotKind ?? this.snapshotKind,
      monsterName: monsterName ?? this.monsterName,
      characterKey: characterKey ?? this.characterKey,
      characterState: characterState ?? this.characterState,
      displayState: displayState ?? this.displayState,
      timeOfDay: timeOfDay ?? this.timeOfDay,
      stamina: stamina ?? this.stamina,
      maxStamina: maxStamina ?? this.maxStamina,
      staminaPercent: staminaPercent ?? this.staminaPercent,
      staminaLevel: staminaLevel ?? this.staminaLevel,
      useLocalTime: useLocalTime ?? this.useLocalTime,
      animationFrameIndex: animationFrameIndex ?? this.animationFrameIndex,
      updatedAtMs: updatedAtMs ?? this.updatedAtMs,
      snapshotComputedAtMs: snapshotComputedAtMs ?? this.snapshotComputedAtMs,
      lastActiveTimeMs: identical(lastActiveTimeMs, _sentinel)
          ? this.lastActiveTimeMs
          : lastActiveTimeMs as int?,
      baseLastActiveTimeMs: identical(baseLastActiveTimeMs, _sentinel)
          ? this.baseLastActiveTimeMs
          : baseLastActiveTimeMs as int?,
      projectedElapsedMs: projectedElapsedMs ?? this.projectedElapsedMs,
      projectionVersion: projectionVersion ?? this.projectionVersion,
      staminaTimerMs: staminaTimerMs ?? this.staminaTimerMs,
      hasUrgentStatus: hasUrgentStatus ?? this.hasUrgentStatus,
      visibleStatusIcons: visibleStatusIcons ??
          List<HomeWidgetStatusIcon>.from(this.visibleStatusIcons),
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'schemaVersion': schemaVersion,
      'snapshotKind': snapshotKind.name,
      'monsterName': monsterName,
      'characterKey': characterKey,
      'characterState': characterState.name,
      'displayState': displayState.name,
      'timeOfDay': timeOfDay.name,
      'stamina': stamina,
      'maxStamina': maxStamina,
      'staminaPercent': staminaPercent,
      'primaryStatus': displayState.name,
      'staminaLevel': staminaLevel.name,
      'useLocalTime': useLocalTime,
      'animationFrameIndex': animationFrameIndex,
      'updatedAtMs': updatedAtMs,
      'snapshotComputedAtMs': snapshotComputedAtMs,
      'lastActiveTimeMs': lastActiveTimeMs,
      'baseLastActiveTimeMs': baseLastActiveTimeMs,
      'projectedElapsedMs': projectedElapsedMs,
      'projectionVersion': projectionVersion,
      'staminaTimerMs': staminaTimerMs,
      'hasUrgentStatus': hasUrgentStatus,
      'visibleStatusIcons': visibleStatusIcons
          .map((HomeWidgetStatusIcon icon) => icon.name)
          .toList(growable: false),
    };
  }

  static HomeWidgetSnapshot? fromJsonString(String? raw) {
    if (raw == null || raw.isEmpty) {
      return null;
    }

    try {
      final Object decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) {
        return null;
      }

      return _snapshotFromMap(decoded);
    } catch (_) {
      return null;
    }
  }

  static HomeWidgetSnapshot? _snapshotFromMap(Map<String, dynamic> json) {
    final double stamina = HomeWidgetSyncService._clampDouble(
      HomeWidgetSyncService._readDouble(json['stamina']) ?? 0,
      0,
      _maxStamina,
    );
    final int updatedAtMs =
        HomeWidgetSyncService._readInt(json['updatedAtMs']) ??
            HomeWidgetSyncService._readInt(json['snapshotComputedAtMs']) ??
            0;
    final HomeWidgetSnapshotKind snapshotKind =
        HomeWidgetSyncService._resolveSnapshotKind(
      json['snapshotKind'] as String?,
    );
    final HomeWidgetCharacterState characterState =
        HomeWidgetSyncService._resolveCharacterStateName(
      json['characterState'] as String?,
    );
    final bool hasUrgentStatus =
        json['hasUrgentStatus'] is bool ? json['hasUrgentStatus'] as bool : false;
    final List<HomeWidgetStatusIcon> visibleStatusIcons =
        HomeWidgetSyncService._resolveVisibleStatusIconsFromNames(
      json['visibleStatusIcons'],
      characterState: characterState,
    );
    final HomeWidgetDisplayState displayState =
        HomeWidgetSyncService._resolveDisplayStateName(
      (json['displayState'] ?? json['primaryStatus']) as String?,
      fallbackState: characterState,
      visibleStatusIcons: visibleStatusIcons,
    );

    return HomeWidgetSnapshot(
      schemaVersion: HomeWidgetSyncService._readInt(json['schemaVersion']) ?? 1,
      snapshotKind: snapshotKind,
      monsterName: json['monsterName'] as String?,
      characterKey: HomeWidgetSyncService._readInt(json['characterKey']),
      characterState: characterState,
      displayState: displayState,
      timeOfDay: HomeWidgetSyncService._resolveTimeOfDayName(
          json['timeOfDay'] as String?),
      stamina: stamina,
      maxStamina: HomeWidgetSyncService._clampDouble(
        HomeWidgetSyncService._readDouble(json['maxStamina']) ?? _maxStamina,
        1,
        _maxStamina,
      ),
      staminaPercent: HomeWidgetSyncService._clampDouble(
        HomeWidgetSyncService._readDouble(json['staminaPercent']) ??
            (stamina / _maxStamina),
        0,
        1,
      ),
      staminaLevel: HomeWidgetSyncService._resolveStaminaLevelName(
        json['staminaLevel'] as String?,
        stamina,
      ),
      useLocalTime:
          json['useLocalTime'] is bool ? json['useLocalTime'] as bool : true,
      animationFrameIndex:
          (HomeWidgetSyncService._readInt(json['animationFrameIndex']) ?? 0) %
              _animationFrameCount,
      updatedAtMs: updatedAtMs,
      snapshotComputedAtMs:
          HomeWidgetSyncService._readInt(json['snapshotComputedAtMs']) ??
              updatedAtMs,
      lastActiveTimeMs:
          HomeWidgetSyncService._readInt(json['lastActiveTimeMs']),
      baseLastActiveTimeMs:
          HomeWidgetSyncService._readInt(json['baseLastActiveTimeMs']) ??
              HomeWidgetSyncService._readInt(json['lastActiveTimeMs']),
      projectedElapsedMs:
          HomeWidgetSyncService._readInt(json['projectedElapsedMs']) ?? 0,
      projectionVersion:
          HomeWidgetSyncService._readInt(json['projectionVersion']) ?? 1,
      staminaTimerMs: HomeWidgetSyncService._clampDouble(
        HomeWidgetSyncService._readDouble(json['staminaTimerMs']) ?? 0,
        0,
        _staminaDecreaseIntervalMs.toDouble(),
      ),
      hasUrgentStatus: hasUrgentStatus,
      visibleStatusIcons: visibleStatusIcons,
    );
  }
}

class HomeWidgetSyncService {
  static const MethodChannel _platformChannel = MethodChannel(
    'digivice/home_widget',
  );

  static Future<String> getLaunchMode() async {
    try {
      final Map<Object?, Object?>? result =
          await _platformChannel.invokeMethod<Map<Object?, Object?>>(
        'getLaunchContext',
      );
      final Object? mode = result?['mode'];
      return mode is String && mode.isNotEmpty ? mode : 'default';
    } catch (_) {
      return 'default';
    }
  }

  static Future<void> syncFromStorage({
    String reason = 'manual',
    void Function(String message)? log,
  }) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await syncFromWorldDataJson(
      rawWorldData: prefs.getString(worldDataStorageKey),
      reason: reason,
      log: log,
    );
  }

  static Future<void> syncFromWorldDataJson({
    required String? rawWorldData,
    String reason = 'manual',
    void Function(String message)? log,
  }) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final DateTime now = DateTime.now();
    final HomeWidgetSnapshot? snapshot = buildSnapshotFromWorldDataJson(
      rawWorldData,
      now: now,
      log: log,
    );

    if (snapshot == null) {
      await prefs.remove(homeWidgetSnapshotStorageKey);
      await prefs.remove(homeWidgetAuthoritativeSnapshotStorageKey);
      await _publishSnapshot(snapshotJson: null, reason: reason, log: log);
      await _publishAuthoritativeSnapshot(
        snapshotJson: null,
        reason: reason,
        log: log,
      );
      log?.call(
        '[HomeWidgetSyncService] cleared snapshot reason=$reason hasWorldData=${rawWorldData != null && rawWorldData.isNotEmpty}',
      );
      return;
    }

    final String snapshotJson = jsonEncode(snapshot.toJson());
    await prefs.setString(homeWidgetSnapshotStorageKey, snapshotJson);
    await prefs.setString(
      homeWidgetAuthoritativeSnapshotStorageKey,
      snapshotJson,
    );
    await _publishSnapshot(
      snapshotJson: snapshotJson,
      reason: reason,
      log: log,
    );
    await _publishAuthoritativeSnapshot(
      snapshotJson: snapshotJson,
      reason: reason,
      log: log,
    );
    log?.call(
      '[HomeWidgetSyncService] synced authoritative snapshot reason=$reason '
      'characterState=${snapshot.characterState.name} '
      'timeOfDay=${snapshot.timeOfDay.name} '
      'staminaPercent=${snapshot.staminaPercent.toStringAsFixed(3)} '
      'visibleStatusIcons=${snapshot.visibleStatusIcons.map((e) => e.name).join(",")}',
    );
  }

  static HomeWidgetSnapshot? buildSnapshotFromWorldDataJson(
    String? rawWorldData, {
    required DateTime now,
    void Function(String message)? log,
  }) {
    if (rawWorldData == null || rawWorldData.isEmpty) {
      return null;
    }

    try {
      final Object decoded = jsonDecode(rawWorldData);
      if (decoded is! Map<String, dynamic>) {
        return null;
      }

      final Map<String, dynamic> worldData = decoded;
      final Map<String, dynamic> worldMetadata =
          _readMap(worldData['world_metadata']);
      final Map<String, dynamic> appState =
          _readMap(worldMetadata['app_state']);
      final List<dynamic> entities = _readList(worldData['entities']);
      final _CharacterSnapshotSource? source = _findMainCharacter(entities);

      if (source == null) {
        return null;
      }

      final bool useLocalTime = appState['use_local_time'] is bool
          ? appState['use_local_time'] as bool
          : true;
      final HomeWidgetCharacterState characterState =
          _resolveCharacterState(source.state);
      final List<HomeWidgetStatusIcon> visibleStatusIcons =
          _resolveVisibleStatusIcons(
        characterState: characterState,
        rawStatuses: source.statuses,
      );
      final bool hasUrgentStatus = _hasUrgentStatus(source.statuses);
      final HomeWidgetDisplayState displayState = _resolveDisplayState(
        characterState: characterState,
        visibleStatusIcons: visibleStatusIcons,
      );

      final double stamina = _clampDouble(source.stamina ?? 0, 0, _maxStamina);
      final int updatedAtMs = now.millisecondsSinceEpoch;
      final int? lastActiveTimeMs = _readInt(appState['last_active_time']);
      final HomeWidgetTimeOfDay timeOfDay = _resolveTimeOfDay(
        now: now,
        useLocalTime: useLocalTime,
        appState: appState,
      );

      return HomeWidgetSnapshot(
        schemaVersion: 2,
        snapshotKind: HomeWidgetSnapshotKind.authoritativeAppState,
        monsterName: worldMetadata['monster_name'] as String?,
        characterKey: source.characterKey,
        characterState: characterState,
        displayState: displayState,
        timeOfDay: timeOfDay,
        stamina: stamina,
        maxStamina: _maxStamina,
        staminaPercent: stamina / _maxStamina,
        staminaLevel: _resolveStaminaLevel(stamina),
        useLocalTime: useLocalTime,
        animationFrameIndex:
            (updatedAtMs ~/ 1000 + (source.characterKey ?? 0)) %
                _animationFrameCount,
        updatedAtMs: updatedAtMs,
        snapshotComputedAtMs: updatedAtMs,
        lastActiveTimeMs: lastActiveTimeMs,
        baseLastActiveTimeMs: lastActiveTimeMs,
        projectedElapsedMs: 0,
        projectionVersion: _projectionVersion,
        staminaTimerMs: 0,
        hasUrgentStatus: hasUrgentStatus,
        visibleStatusIcons: visibleStatusIcons,
      );
    } catch (error) {
      log?.call('[HomeWidgetSyncService] failed to build snapshot: $error');
      return null;
    }
  }

  static HomeWidgetSnapshot? progressSnapshot(
    HomeWidgetSnapshot snapshot, {
    required DateTime now,
  }) {
    final int elapsedMs =
        now.millisecondsSinceEpoch - snapshot.snapshotComputedAtMs;
    final int safeElapsedMs = elapsedMs < 0 ? 0 : elapsedMs;
    final int tickSizeMs = _resolveSimulationTickSizeMs(safeElapsedMs);
    final int totalTicks = tickSizeMs > 0 ? safeElapsedMs ~/ tickSizeMs : 0;
    final int remainingMs = tickSizeMs > 0 ? safeElapsedMs % tickSizeMs : 0;

    double stamina = snapshot.stamina;
    double staminaTimerMs = snapshot.staminaTimerMs;

    for (int index = 0; index < totalTicks; index += 1) {
      final _StaminaProgressResult progressed = _progressStamina(
        stamina: stamina,
        staminaTimerMs: staminaTimerMs,
        characterState: snapshot.characterState,
        deltaMs: tickSizeMs.toDouble(),
      );
      stamina = progressed.stamina;
      staminaTimerMs = progressed.staminaTimerMs;
    }

    if (remainingMs > 0) {
      final _StaminaProgressResult progressed = _progressStamina(
        stamina: stamina,
        staminaTimerMs: staminaTimerMs,
        characterState: snapshot.characterState,
        deltaMs: remainingMs.toDouble(),
      );
      stamina = progressed.stamina;
      staminaTimerMs = progressed.staminaTimerMs;
    }

    final HomeWidgetTimeOfDay timeOfDay = _resolveTimeOfDay(
      now: now,
      useLocalTime: snapshot.useLocalTime,
      appState: const <String, dynamic>{},
    );

    return snapshot.copyWith(
      snapshotKind: HomeWidgetSnapshotKind.widgetProgressed,
      stamina: stamina,
      staminaPercent: stamina / snapshot.maxStamina,
      staminaLevel: _resolveStaminaLevel(stamina),
      timeOfDay: timeOfDay,
      animationFrameIndex:
          (now.millisecondsSinceEpoch ~/ 1000 + (snapshot.characterKey ?? 0)) %
              _animationFrameCount,
      updatedAtMs: now.millisecondsSinceEpoch,
      snapshotComputedAtMs: now.millisecondsSinceEpoch,
      projectedElapsedMs: snapshot.projectedElapsedMs + safeElapsedMs,
      projectionVersion: _projectionVersion,
      staminaTimerMs: staminaTimerMs,
      hasUrgentStatus: snapshot.hasUrgentStatus,
    );
  }

  static Future<void> _publishSnapshot({
    required String? snapshotJson,
    required String reason,
    void Function(String message)? log,
  }) async {
    try {
      await _platformChannel
          .invokeMethod<void>('publishSnapshot', <String, dynamic>{
        'snapshotJson': snapshotJson,
        'storageName': nativeHomeWidgetStorageName,
        'snapshotKey': nativeHomeWidgetSnapshotKey,
        'reason': reason,
      });
    } catch (error) {
      log?.call('[HomeWidgetSyncService] native publish failed: $error');
    }
  }

  static Future<void> _publishAuthoritativeSnapshot({
    required String? snapshotJson,
    required String reason,
    void Function(String message)? log,
  }) async {
    try {
      await _platformChannel
          .invokeMethod<void>('publishSnapshot', <String, dynamic>{
        'snapshotJson': snapshotJson,
        'storageName': nativeHomeWidgetStorageName,
        'snapshotKey': nativeHomeWidgetAuthoritativeSnapshotKey,
        'reason': '${reason}_authoritative',
      });
    } catch (error) {
      log?.call(
        '[HomeWidgetSyncService] native authoritative publish failed: $error',
      );
    }
  }

  static Map<String, dynamic> _readMap(Object? value) {
    return value is Map<String, dynamic> ? value : <String, dynamic>{};
  }

  static List<dynamic> _readList(Object? value) {
    return value is List<dynamic> ? value : const <dynamic>[];
  }

  static int? _readInt(Object? value) {
    if (value is int) {
      return value;
    }
    if (value is num) {
      return value.round();
    }
    return null;
  }

  static double? _readDouble(Object? value) {
    if (value is double) {
      return value;
    }
    if (value is num) {
      return value.toDouble();
    }
    return null;
  }

  static double _clampDouble(double value, double min, double max) {
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
  }

  static _CharacterSnapshotSource? _findMainCharacter(List<dynamic> entities) {
    for (final dynamic entity in entities) {
      if (entity is! Map<String, dynamic>) {
        continue;
      }
      final Map<String, dynamic> components = _readMap(entity['components']);
      final Map<String, dynamic> object = _readMap(components['object']);
      if (_readInt(object['type']) != _characterObjectType) {
        continue;
      }

      final Map<String, dynamic> characterStatus =
          _readMap(components['characterStatus']);
      return _CharacterSnapshotSource(
        state: _readInt(object['state']),
        characterKey: _readInt(characterStatus['characterKey']),
        stamina: _readDouble(characterStatus['stamina']),
        statuses: characterStatus['statuses'] is List<dynamic>
            ? characterStatus['statuses'] as List<dynamic>
            : const <dynamic>[],
      );
    }

    return null;
  }

  static HomeWidgetCharacterState _resolveCharacterState(int? rawState) {
    switch (rawState) {
      case _characterStateEgg:
        return HomeWidgetCharacterState.egg;
      case _characterStateMoving:
        return HomeWidgetCharacterState.moving;
      case _characterStateSleeping:
        return HomeWidgetCharacterState.sleeping;
      case _characterStateSick:
        return HomeWidgetCharacterState.sick;
      case _characterStateEating:
        return HomeWidgetCharacterState.eating;
      case _characterStateDead:
        return HomeWidgetCharacterState.dead;
      case _characterStateIdle:
      default:
        return HomeWidgetCharacterState.idle;
    }
  }

  static HomeWidgetCharacterState _resolveCharacterStateName(String? rawName) {
    return HomeWidgetCharacterState.values.firstWhere(
      (HomeWidgetCharacterState value) => value.name == rawName,
      orElse: () => HomeWidgetCharacterState.idle,
    );
  }

  static HomeWidgetSnapshotKind _resolveSnapshotKind(String? rawName) {
    return HomeWidgetSnapshotKind.values.firstWhere(
      (HomeWidgetSnapshotKind value) => value.name == rawName,
      orElse: () => HomeWidgetSnapshotKind.authoritativeAppState,
    );
  }

  static HomeWidgetDisplayState _resolveDisplayState({
    required HomeWidgetCharacterState characterState,
    required List<HomeWidgetStatusIcon> visibleStatusIcons,
  }) {
    if (characterState == HomeWidgetCharacterState.sleeping ||
        visibleStatusIcons.contains(HomeWidgetStatusIcon.sleeping)) {
      return HomeWidgetDisplayState.sleep;
    }
    if (characterState == HomeWidgetCharacterState.sick ||
        visibleStatusIcons.contains(HomeWidgetStatusIcon.sick)) {
      return HomeWidgetDisplayState.sick;
    }
    return HomeWidgetDisplayState.idle;
  }

  static HomeWidgetDisplayState _resolveDisplayStateName(
    String? rawName, {
    required HomeWidgetCharacterState fallbackState,
    required List<HomeWidgetStatusIcon> visibleStatusIcons,
  }) {
    return HomeWidgetDisplayState.values.firstWhere(
      (HomeWidgetDisplayState value) => value.name == rawName,
      orElse: () => _resolveDisplayState(
        characterState: fallbackState,
        visibleStatusIcons: visibleStatusIcons,
      ),
    );
  }

  static List<HomeWidgetStatusIcon> _resolveVisibleStatusIcons({
    required HomeWidgetCharacterState characterState,
    required List<dynamic> rawStatuses,
  }) {
    if (characterState == HomeWidgetCharacterState.dead) {
      return const <HomeWidgetStatusIcon>[];
    }

    final List<int> statuses = rawStatuses
        .map(_readInt)
        .whereType<int>()
        .where((int value) => value > 0)
        .toList(growable: false);

    final List<HomeWidgetStatusIcon> visibleIcons = <HomeWidgetStatusIcon>[];

    for (final int status in statuses) {
      switch (status) {
        case _characterStatusUrgent:
          break;
        case _characterStatusSick:
          if (!visibleIcons.contains(HomeWidgetStatusIcon.sick)) {
            visibleIcons.add(HomeWidgetStatusIcon.sick);
          }
          break;
        case _characterStatusHappy:
        case _characterStatusDiscover:
          break;
      }
    }

    if (characterState == HomeWidgetCharacterState.sleeping) {
      visibleIcons.add(HomeWidgetStatusIcon.sleeping);
    }

    return visibleIcons;
  }

  static List<HomeWidgetStatusIcon> _resolveVisibleStatusIconsFromNames(
    Object? rawValue, {
    required HomeWidgetCharacterState characterState,
  }) {
    if (characterState == HomeWidgetCharacterState.dead) {
      return const <HomeWidgetStatusIcon>[];
    }

    final List<dynamic> values =
        rawValue is List<dynamic> ? rawValue : const <dynamic>[];

    final List<HomeWidgetStatusIcon> visibleIcons = <HomeWidgetStatusIcon>[];

    for (final String name in values.whereType<String>()) {
      final HomeWidgetStatusIcon? icon = _resolveWidgetStatusIconName(name);
      if (icon != null && !visibleIcons.contains(icon)) {
        visibleIcons.add(icon);
      }
    }

    return visibleIcons;
  }

  static HomeWidgetStatusIcon? _resolveWidgetStatusIconName(String name) {
    switch (name) {
      case 'sick':
        return HomeWidgetStatusIcon.sick;
      case 'sleeping':
        return HomeWidgetStatusIcon.sleeping;
      default:
        return null;
    }
  }

  static bool _hasUrgentStatus(List<dynamic> rawStatuses) {
    return rawStatuses
        .map(_readInt)
        .whereType<int>()
        .contains(_characterStatusUrgent);
  }

  static HomeWidgetStaminaLevel _resolveStaminaLevel(double stamina) {
    if (stamina <= _lowStaminaThreshold) {
      return HomeWidgetStaminaLevel.red;
    }
    if (stamina >= _boostedStaminaThreshold) {
      return HomeWidgetStaminaLevel.green;
    }
    return HomeWidgetStaminaLevel.orange;
  }

  static HomeWidgetStaminaLevel _resolveStaminaLevelName(
    String? rawName,
    double stamina,
  ) {
    return HomeWidgetStaminaLevel.values.firstWhere(
      (HomeWidgetStaminaLevel value) => value.name == rawName,
      orElse: () => _resolveStaminaLevel(stamina),
    );
  }

  static HomeWidgetTimeOfDay _resolveTimeOfDay({
    required DateTime now,
    required bool useLocalTime,
    required Map<String, dynamic> appState,
  }) {
    if (!useLocalTime) {
      return HomeWidgetTimeOfDay.day;
    }

    final Map<String, dynamic> cachedSunTimes =
        _readMap(appState['cached_sun_times']);
    final DateTime? sunriseAt = _projectSunTime(
      now: now,
      cachedSunTimes: cachedSunTimes,
      key: 'sunriseAt',
    );
    final DateTime? sunsetAt = _projectSunTime(
      now: now,
      cachedSunTimes: cachedSunTimes,
      key: 'sunsetAt',
    );

    if (sunriseAt == null ||
        sunsetAt == null ||
        !sunriseAt.isBefore(sunsetAt)) {
      final int hour = now.hour;
      return hour >= 19 || hour < 6
          ? HomeWidgetTimeOfDay.night
          : HomeWidgetTimeOfDay.day;
    }

    final DateTime sunriseStart =
        sunriseAt.subtract(const Duration(minutes: 60));
    final DateTime sunriseEnd = sunriseAt.add(const Duration(minutes: 60));
    final DateTime sunsetStart = sunsetAt.subtract(const Duration(minutes: 60));
    final DateTime sunsetEnd = sunsetAt.add(const Duration(minutes: 60));

    if (!now.isBefore(sunriseStart) && !now.isAfter(sunriseEnd)) {
      return HomeWidgetTimeOfDay.sunrise;
    }
    if (!now.isBefore(sunsetStart) && !now.isAfter(sunsetEnd)) {
      return HomeWidgetTimeOfDay.sunset;
    }
    if (now.isAfter(sunriseEnd) && now.isBefore(sunsetStart)) {
      return HomeWidgetTimeOfDay.day;
    }
    return HomeWidgetTimeOfDay.night;
  }

  static HomeWidgetTimeOfDay _resolveTimeOfDayName(String? rawName) {
    return HomeWidgetTimeOfDay.values.firstWhere(
      (HomeWidgetTimeOfDay value) => value.name == rawName,
      orElse: () => HomeWidgetTimeOfDay.day,
    );
  }

  static DateTime? _projectSunTime({
    required DateTime now,
    required Map<String, dynamic> cachedSunTimes,
    required String key,
  }) {
    final String? rawTime = cachedSunTimes[key] as String?;
    final int? timezoneOffsetMinutes = _readInt(
      cachedSunTimes['timezoneOffsetMinutes'],
    );

    if (rawTime == null || timezoneOffsetMinutes == null) {
      return null;
    }

    final DateTime? template = DateTime.tryParse(rawTime);
    if (template == null) {
      return null;
    }

    final DateTime zonedNow =
        now.toUtc().add(Duration(minutes: timezoneOffsetMinutes));
    final DateTime projectedUtc = DateTime.utc(
      zonedNow.year,
      zonedNow.month,
      zonedNow.day,
      template.toUtc().hour,
      template.toUtc().minute,
      template.toUtc().second,
      template.toUtc().millisecond,
      template.toUtc().microsecond,
    ).subtract(Duration(minutes: timezoneOffsetMinutes));

    return projectedUtc.toLocal();
  }

  static int _resolveSimulationTickSizeMs(int elapsedMs) {
    if (elapsedMs < 10 * 1000) {
      return 100;
    }
    if (elapsedMs < 5 * 60 * 1000) {
      return 1000;
    }
    if (elapsedMs < 60 * 60 * 1000) {
      return 10 * 1000;
    }
    return 60 * 1000;
  }

  static _StaminaProgressResult _progressStamina({
    required double stamina,
    required double staminaTimerMs,
    required HomeWidgetCharacterState characterState,
    required double deltaMs,
  }) {
    if (deltaMs <= 0 ||
        characterState == HomeWidgetCharacterState.egg ||
        characterState == HomeWidgetCharacterState.dead) {
      return _StaminaProgressResult(
        stamina: stamina,
        staminaTimerMs: staminaTimerMs,
      );
    }

    double remainingDeltaMs = deltaMs;
    double nextStamina = stamina;
    double nextTimerMs = staminaTimerMs;

    while (remainingDeltaMs > 0.0001 && nextStamina > 0) {
      final double multiplier =
          _resolveCurrentStaminaTimerMultiplier(nextStamina, characterState);
      if (multiplier <= 0) {
        break;
      }

      final double remainingEffectiveTime =
          (_staminaDecreaseIntervalMs - nextTimerMs).clamp(
        0,
        _staminaDecreaseIntervalMs.toDouble(),
      );
      final double timeUntilDecrease = remainingEffectiveTime / multiplier;

      if (remainingDeltaMs + 0.0001 < timeUntilDecrease) {
        nextTimerMs += remainingDeltaMs * multiplier;
        remainingDeltaMs = 0;
        break;
      }

      nextTimerMs = 0;
      remainingDeltaMs = (remainingDeltaMs - timeUntilDecrease).clamp(
        0,
        double.infinity,
      );
      nextStamina = _clampDouble(
        nextStamina - _staminaDecreaseAmount,
        0,
        _maxStamina,
      );
    }

    return _StaminaProgressResult(
      stamina: nextStamina,
      staminaTimerMs: nextTimerMs,
    );
  }

  static double _resolveCurrentStaminaTimerMultiplier(
    double stamina,
    HomeWidgetCharacterState characterState,
  ) {
    final double sleepMultiplier =
        characterState == HomeWidgetCharacterState.sleeping
            ? _sleepingStaminaDecayMultiplier
            : 1;
    return sleepMultiplier * _resolveStaminaDecayRateMultiplier(stamina);
  }

  static double _resolveStaminaDecayRateMultiplier(double stamina) {
    if (stamina >= _boostedStaminaThreshold) {
      return _highStaminaDecayMultiplier;
    }
    if (stamina < _lowStaminaThreshold) {
      return _lowStaminaDecayMultiplier;
    }
    return 1;
  }
}

class _CharacterSnapshotSource {
  final int? state;
  final int? characterKey;
  final double? stamina;
  final List<dynamic> statuses;

  const _CharacterSnapshotSource({
    required this.state,
    required this.characterKey,
    required this.stamina,
    required this.statuses,
  });
}

class _StaminaProgressResult {
  final double stamina;
  final double staminaTimerMs;

  const _StaminaProgressResult({
    required this.stamina,
    required this.staminaTimerMs,
  });
}

const Object _sentinel = Object();

import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'world_data_config.dart' as config;

export 'world_data_config.dart';

enum WorldDataSnapshotKind {
  authoritativeAppState,
  widgetProgressed,
}

enum WorldDataCharacterState {
  egg,
  idle,
  moving,
  sleeping,
  sick,
  eating,
  dead,
}

enum WorldDataTimeOfDay {
  day,
  sunrise,
  sunset,
  night,
}

enum WorldDataDisplayState {
  idle,
  sleep,
  sick,
}

enum WorldDataStaminaLevel {
  red,
  orange,
  green,
}

enum WorldDataStatusIcon {
  sick,
  happy,
  discover,
  sleeping,
}

class _ResolvedEggHatchTiming {
  final int hatchTimeMs;
  final int hatchDurationMs;
  final double progress;

  const _ResolvedEggHatchTiming({
    required this.hatchTimeMs,
    required this.hatchDurationMs,
    required this.progress,
  });
}

class WorldDataSnapshot {
  final int schemaVersion;
  final WorldDataSnapshotKind snapshotKind;
  final String? monsterName;
  final int? characterKey;
  final int? eggTextureKey;
  final int? eggHatchTimeMs;
  final int? eggHatchDurationMs;
  final int eggCrackStage;
  final WorldDataCharacterState characterState;
  final WorldDataDisplayState displayState;
  final WorldDataTimeOfDay timeOfDay;
  final double stamina;
  final double maxStamina;
  final double staminaPercent;
  final WorldDataStaminaLevel staminaLevel;
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
  final List<WorldDataStatusIcon> visibleStatusIcons;

  const WorldDataSnapshot({
    required this.schemaVersion,
    required this.snapshotKind,
    required this.monsterName,
    required this.characterKey,
    required this.eggTextureKey,
    required this.eggHatchTimeMs,
    required this.eggHatchDurationMs,
    required this.eggCrackStage,
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

  WorldDataSnapshot copyWith({
    WorldDataSnapshotKind? snapshotKind,
    String? monsterName,
    int? characterKey,
    Object? eggTextureKey = _sentinel,
    Object? eggHatchTimeMs = _sentinel,
    Object? eggHatchDurationMs = _sentinel,
    int? eggCrackStage,
    WorldDataCharacterState? characterState,
    WorldDataDisplayState? displayState,
    WorldDataTimeOfDay? timeOfDay,
    double? stamina,
    double? maxStamina,
    double? staminaPercent,
    WorldDataStaminaLevel? staminaLevel,
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
    List<WorldDataStatusIcon>? visibleStatusIcons,
  }) {
    return WorldDataSnapshot(
      schemaVersion: schemaVersion,
      snapshotKind: snapshotKind ?? this.snapshotKind,
      monsterName: monsterName ?? this.monsterName,
      characterKey: characterKey ?? this.characterKey,
      eggTextureKey: identical(eggTextureKey, _sentinel)
          ? this.eggTextureKey
          : eggTextureKey as int?,
      eggHatchTimeMs: identical(eggHatchTimeMs, _sentinel)
          ? this.eggHatchTimeMs
          : eggHatchTimeMs as int?,
      eggHatchDurationMs: identical(eggHatchDurationMs, _sentinel)
          ? this.eggHatchDurationMs
          : eggHatchDurationMs as int?,
      eggCrackStage: eggCrackStage ?? this.eggCrackStage,
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
          List<WorldDataStatusIcon>.from(this.visibleStatusIcons),
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'schemaVersion': schemaVersion,
      'snapshotKind': snapshotKind.name,
      'monsterName': monsterName,
      'characterKey': characterKey,
      'eggTextureKey': eggTextureKey,
      'eggHatchTimeMs': eggHatchTimeMs,
      'eggHatchDurationMs': eggHatchDurationMs,
      'eggCrackStage': eggCrackStage,
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
          .map((WorldDataStatusIcon icon) => icon.name)
          .toList(growable: false),
    };
  }

  static WorldDataSnapshot? fromJsonString(String? raw) {
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

  static WorldDataSnapshot? _snapshotFromMap(Map<String, dynamic> json) {
    final double stamina = WorldDataSyncService._clampDouble(
      WorldDataSyncService._readDouble(json['stamina']) ?? 0,
      0,
      config.maxStamina,
    );
    final int updatedAtMs =
        WorldDataSyncService._readInt(json['updatedAtMs']) ??
            WorldDataSyncService._readInt(json['snapshotComputedAtMs']) ??
            0;
    final WorldDataSnapshotKind snapshotKind =
        WorldDataSyncService._resolveSnapshotKind(
      json['snapshotKind'] as String?,
    );
    final WorldDataCharacterState characterState =
        WorldDataSyncService._resolveCharacterStateName(
      json['characterState'] as String?,
    );
    final int? eggHatchTimeMs =
        WorldDataSyncService._readInt(json['eggHatchTimeMs']);
    final int? eggHatchDurationMs =
        WorldDataSyncService._readInt(json['eggHatchDurationMs']);
    final _ResolvedEggHatchTiming? eggHatchTiming =
        WorldDataSyncService._resolveEggHatchTiming(
      nowMs: updatedAtMs,
      characterState: characterState,
      hatchTimeMs: eggHatchTimeMs,
      hatchDurationMs: eggHatchDurationMs,
    );
    final bool hasUrgentStatus = json['hasUrgentStatus'] is bool
        ? json['hasUrgentStatus'] as bool
        : false;
    final List<WorldDataStatusIcon> visibleStatusIcons =
        WorldDataSyncService._resolveVisibleStatusIconsFromNames(
      json['visibleStatusIcons'],
      characterState: characterState,
    );
    final WorldDataDisplayState displayState =
        WorldDataSyncService._resolveDisplayStateName(
      (json['displayState'] ?? json['primaryStatus']) as String?,
      fallbackState: characterState,
      visibleStatusIcons: visibleStatusIcons,
    );

    return WorldDataSnapshot(
      schemaVersion: WorldDataSyncService._readInt(json['schemaVersion']) ?? 1,
      snapshotKind: snapshotKind,
      monsterName: json['monsterName'] as String?,
      characterKey: WorldDataSyncService._readInt(json['characterKey']),
      eggTextureKey: WorldDataSyncService._readInt(json['eggTextureKey']),
      eggHatchTimeMs: eggHatchTiming?.hatchTimeMs,
      eggHatchDurationMs: eggHatchTiming?.hatchDurationMs,
      eggCrackStage: WorldDataSyncService._readInt(json['eggCrackStage']) ??
          WorldDataSyncService._resolveEggCrackStage(
            characterState: characterState,
            timing: eggHatchTiming,
          ),
      characterState: characterState,
      displayState: displayState,
      timeOfDay: WorldDataSyncService._resolveTimeOfDayName(
          json['timeOfDay'] as String?),
      stamina: stamina,
      maxStamina: WorldDataSyncService._clampDouble(
        WorldDataSyncService._readDouble(json['maxStamina']) ??
            config.maxStamina,
        1,
        config.maxStamina,
      ),
      staminaPercent: WorldDataSyncService._clampDouble(
        WorldDataSyncService._readDouble(json['staminaPercent']) ??
            (stamina / config.maxStamina),
        0,
        1,
      ),
      staminaLevel: WorldDataSyncService._resolveStaminaLevelName(
        json['staminaLevel'] as String?,
        stamina,
      ),
      useLocalTime:
          json['useLocalTime'] is bool ? json['useLocalTime'] as bool : true,
      animationFrameIndex:
          (WorldDataSyncService._readInt(json['animationFrameIndex']) ?? 0) %
              config.animationFrameCount,
      updatedAtMs: updatedAtMs,
      snapshotComputedAtMs:
          WorldDataSyncService._readInt(json['snapshotComputedAtMs']) ??
              updatedAtMs,
      lastActiveTimeMs: WorldDataSyncService._readInt(json['lastActiveTimeMs']),
      baseLastActiveTimeMs:
          WorldDataSyncService._readInt(json['baseLastActiveTimeMs']) ??
              WorldDataSyncService._readInt(json['lastActiveTimeMs']),
      projectedElapsedMs:
          WorldDataSyncService._readInt(json['projectedElapsedMs']) ?? 0,
      projectionVersion:
          WorldDataSyncService._readInt(json['projectionVersion']) ??
              config.projectionVersion,
      staminaTimerMs: WorldDataSyncService._clampDouble(
        WorldDataSyncService._readDouble(json['staminaTimerMs']) ?? 0,
        0,
        config.staminaDecreaseIntervalMs.toDouble(),
      ),
      hasUrgentStatus: hasUrgentStatus,
      visibleStatusIcons: visibleStatusIcons,
    );
  }
}

enum WorldDataSyncSource {
  stored,
  inMemory,
}

class WorldDataSyncSelection {
  final String? selectedRawWorldData;
  final WorldDataSyncSource? source;
  final int? storedLastEcsSaved;
  final int? inMemoryLastEcsSaved;

  const WorldDataSyncSelection({
    required this.selectedRawWorldData,
    required this.source,
    required this.storedLastEcsSaved,
    required this.inMemoryLastEcsSaved,
  });

  String? get sourceName => switch (source) {
        WorldDataSyncSource.stored => 'stored',
        WorldDataSyncSource.inMemory => 'in_memory',
        null => null,
      };
}

class WorldDataSyncService {
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

  static Future<Map<String, Object?>> syncFromStorage({
    String reason = 'manual',
    void Function(String message)? log,
  }) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    return syncFromWorldDataJson(
      rawWorldData: prefs.getString(config.worldDataStorageKey),
      reason: reason,
      log: log,
    );
  }

  static Future<Map<String, Object?>> syncFromStorageOrWorldDataJson({
    String? inMemoryRawWorldData,
    String reason = 'manual',
    void Function(String message)? log,
  }) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final WorldDataSyncSelection selection = selectWorldDataForSync(
      storedRawWorldData: prefs.getString(config.worldDataStorageKey),
      inMemoryRawWorldData: inMemoryRawWorldData,
    );

    log?.call(
      '[WorldDataSyncService] selected world data source=${selection.sourceName} '
      'reason=$reason '
      'storedLastEcsSaved=${selection.storedLastEcsSaved} '
      'inMemoryLastEcsSaved=${selection.inMemoryLastEcsSaved}',
    );

    final Map<String, Object?> result = await syncFromWorldDataJson(
      rawWorldData: selection.selectedRawWorldData,
      reason: reason,
      log: log,
    );

    return <String, Object?>{
      ...result,
      'selectedSource': selection.sourceName,
      'storedLastEcsSaved': selection.storedLastEcsSaved,
      'inMemoryLastEcsSaved': selection.inMemoryLastEcsSaved,
    };
  }

  static WorldDataSyncSelection selectWorldDataForSync({
    required String? storedRawWorldData,
    required String? inMemoryRawWorldData,
  }) {
    final _WorldDataSummary storedSummary = _summarizeWorldData(
      storedRawWorldData,
    );
    final _WorldDataSummary inMemorySummary = _summarizeWorldData(
      inMemoryRawWorldData,
    );

    if (!storedSummary.hasWorldData && !inMemorySummary.hasWorldData) {
      return WorldDataSyncSelection(
        selectedRawWorldData: null,
        source: null,
        storedLastEcsSaved: storedSummary.lastEcsSaved,
        inMemoryLastEcsSaved: inMemorySummary.lastEcsSaved,
      );
    }

    if (!storedSummary.hasWorldData) {
      return WorldDataSyncSelection(
        selectedRawWorldData: inMemoryRawWorldData,
        source: WorldDataSyncSource.inMemory,
        storedLastEcsSaved: storedSummary.lastEcsSaved,
        inMemoryLastEcsSaved: inMemorySummary.lastEcsSaved,
      );
    }

    if (!inMemorySummary.hasWorldData) {
      return WorldDataSyncSelection(
        selectedRawWorldData: storedRawWorldData,
        source: WorldDataSyncSource.stored,
        storedLastEcsSaved: storedSummary.lastEcsSaved,
        inMemoryLastEcsSaved: inMemorySummary.lastEcsSaved,
      );
    }

    final bool shouldPreferStoredCompletedHatch =
        storedSummary.mainCharacterState != null &&
            storedSummary.mainCharacterState != config.characterStateEgg &&
            inMemorySummary.mainCharacterState == config.characterStateEgg;
    final bool shouldUseInMemory = !shouldPreferStoredCompletedHatch &&
        inMemorySummary.lastEcsSaved != null &&
        (storedSummary.lastEcsSaved == null ||
            inMemorySummary.lastEcsSaved! > storedSummary.lastEcsSaved!);

    return WorldDataSyncSelection(
      selectedRawWorldData:
          shouldUseInMemory ? inMemoryRawWorldData : storedRawWorldData,
      source: shouldUseInMemory
          ? WorldDataSyncSource.inMemory
          : WorldDataSyncSource.stored,
      storedLastEcsSaved: storedSummary.lastEcsSaved,
      inMemoryLastEcsSaved: inMemorySummary.lastEcsSaved,
    );
  }

  static Future<Map<String, Object?>> syncFromWorldDataJson({
    required String? rawWorldData,
    String reason = 'manual',
    void Function(String message)? log,
  }) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final DateTime now = DateTime.now();
    final WorldDataSnapshot? snapshot = buildSnapshotFromWorldDataJson(
      rawWorldData,
      now: now,
      log: log,
    );

    if (snapshot == null) {
      await prefs.remove(config.worldDataSnapshotStorageKey);
      await prefs.remove(config.worldDataAuthoritativeSnapshotStorageKey);
      final Map<String, Object?> currentPublishResult = await _publishSnapshot(
        snapshotJson: null,
        reason: reason,
        log: log,
      );
      final Map<String, Object?> authoritativePublishResult =
          await _publishAuthoritativeSnapshot(
        snapshotJson: null,
        reason: reason,
        log: log,
      );
      log?.call(
        '[WorldDataSyncService] cleared snapshot reason=$reason hasWorldData=${rawWorldData != null && rawWorldData.isNotEmpty}',
      );
      return <String, Object?>{
        'status': 'cleared',
        'reason': reason,
        'hasWorldData': rawWorldData != null && rawWorldData.isNotEmpty,
        'hasSnapshot': false,
        'currentPublishStatus': currentPublishResult['status'],
        'authoritativePublishStatus': authoritativePublishResult['status'],
        'currentPublishResult': currentPublishResult,
        'authoritativePublishResult': authoritativePublishResult,
      };
    }

    final String snapshotJson = jsonEncode(snapshot.toJson());
    log?.call(
      '[WorldDataSyncService] built snapshot reason=$reason '
      'characterState=${snapshot.characterState.name} '
      'characterKey=${snapshot.characterKey} '
      'snapshotKind=${snapshot.snapshotKind.name} '
      'eggHatchTimeMs=${snapshot.eggHatchTimeMs} '
      'eggHatchDurationMs=${snapshot.eggHatchDurationMs} '
      'lastActiveTimeMs=${snapshot.lastActiveTimeMs}',
    );
    await prefs.setString(config.worldDataSnapshotStorageKey, snapshotJson);
    await prefs.setString(
      config.worldDataAuthoritativeSnapshotStorageKey,
      snapshotJson,
    );
    final Map<String, Object?> currentPublishResult = await _publishSnapshot(
      snapshotJson: snapshotJson,
      reason: reason,
      log: log,
    );
    final Map<String, Object?> authoritativePublishResult =
        await _publishAuthoritativeSnapshot(
      snapshotJson: snapshotJson,
      reason: reason,
      log: log,
    );
    log?.call(
      '[WorldDataSyncService] synced authoritative snapshot reason=$reason '
      'characterState=${snapshot.characterState.name} '
      'timeOfDay=${snapshot.timeOfDay.name} '
      'staminaPercent=${snapshot.staminaPercent.toStringAsFixed(3)} '
      'visibleStatusIcons=${snapshot.visibleStatusIcons.map((e) => e.name).join(",")}',
    );
    return <String, Object?>{
      'status': 'synced',
      'reason': reason,
      'hasWorldData': rawWorldData != null && rawWorldData.isNotEmpty,
      'hasSnapshot': true,
      'characterState': snapshot.characterState.name,
      'characterKey': snapshot.characterKey,
      'snapshotKind': snapshot.snapshotKind.name,
      'currentPublishStatus': currentPublishResult['status'],
      'authoritativePublishStatus': authoritativePublishResult['status'],
      'currentPublishResult': currentPublishResult,
      'authoritativePublishResult': authoritativePublishResult,
    };
  }

  static WorldDataSnapshot? buildSnapshotFromWorldDataJson(
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
      final WorldDataCharacterState characterState =
          _resolveCharacterState(source.state);
      final List<WorldDataStatusIcon> visibleStatusIcons =
          _resolveVisibleStatusIcons(
        characterState: characterState,
        rawStatuses: source.statuses,
      );
      final bool hasUrgentStatus = _hasUrgentStatus(source.statuses);
      final WorldDataDisplayState displayState = _resolveDisplayState(
        characterState: characterState,
        visibleStatusIcons: visibleStatusIcons,
      );
      final _ResolvedEggHatchTiming? eggHatchTiming = _resolveEggHatchTiming(
        nowMs: now.millisecondsSinceEpoch,
        characterState: characterState,
        hatchTimeMs: _readInt(source.eggHatchTime),
        hatchDurationMs: _readInt(source.eggHatchDurationMs),
      );

      final double stamina =
          _clampDouble(source.stamina ?? 0, 0, config.maxStamina);
      final int updatedAtMs = now.millisecondsSinceEpoch;
      final int? lastActiveTimeMs = _readInt(appState['last_active_time']);
      final WorldDataTimeOfDay timeOfDay = _resolveTimeOfDay(
        now: now,
        useLocalTime: useLocalTime,
        appState: appState,
      );

      return WorldDataSnapshot(
        schemaVersion: 2,
        snapshotKind: WorldDataSnapshotKind.authoritativeAppState,
        monsterName: worldMetadata['monster_name'] as String?,
        characterKey: source.characterKey,
        eggTextureKey: _resolveEggTextureKey(
          characterState: characterState,
          rawTextureKey: source.textureKey,
        ),
        eggHatchTimeMs: eggHatchTiming?.hatchTimeMs,
        eggHatchDurationMs: eggHatchTiming?.hatchDurationMs,
        eggCrackStage: _resolveEggCrackStage(
          characterState: characterState,
          timing: eggHatchTiming,
        ),
        characterState: characterState,
        displayState: displayState,
        timeOfDay: timeOfDay,
        stamina: stamina,
        maxStamina: config.maxStamina,
        staminaPercent: stamina / config.maxStamina,
        staminaLevel: _resolveStaminaLevel(stamina),
        useLocalTime: useLocalTime,
        animationFrameIndex:
            (updatedAtMs ~/ 1000 + (source.characterKey ?? 0)) %
                config.animationFrameCount,
        updatedAtMs: updatedAtMs,
        snapshotComputedAtMs: updatedAtMs,
        lastActiveTimeMs: lastActiveTimeMs,
        baseLastActiveTimeMs: lastActiveTimeMs,
        projectedElapsedMs: 0,
        projectionVersion: config.projectionVersion,
        staminaTimerMs: 0,
        hasUrgentStatus: hasUrgentStatus,
        visibleStatusIcons: visibleStatusIcons,
      );
    } catch (error) {
      log?.call('[WorldDataSyncService] failed to build snapshot: $error');
      return null;
    }
  }

  static WorldDataSnapshot? progressSnapshot(
    WorldDataSnapshot snapshot, {
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

    final WorldDataTimeOfDay timeOfDay = _resolveTimeOfDay(
      now: now,
      useLocalTime: snapshot.useLocalTime,
      appState: const <String, dynamic>{},
    );
    final _ResolvedEggHatchTiming? eggHatchTiming = _resolveEggHatchTiming(
      nowMs: now.millisecondsSinceEpoch,
      characterState: snapshot.characterState,
      hatchTimeMs: snapshot.eggHatchTimeMs,
      hatchDurationMs: snapshot.eggHatchDurationMs,
    );

    return snapshot.copyWith(
      snapshotKind: WorldDataSnapshotKind.widgetProgressed,
      stamina: stamina,
      staminaPercent: stamina / snapshot.maxStamina,
      staminaLevel: _resolveStaminaLevel(stamina),
      timeOfDay: timeOfDay,
      animationFrameIndex:
          (now.millisecondsSinceEpoch ~/ 1000 + (snapshot.characterKey ?? 0)) %
              config.animationFrameCount,
      updatedAtMs: now.millisecondsSinceEpoch,
      snapshotComputedAtMs: now.millisecondsSinceEpoch,
      projectedElapsedMs: snapshot.projectedElapsedMs + safeElapsedMs,
      projectionVersion: config.projectionVersion,
      staminaTimerMs: staminaTimerMs,
      hasUrgentStatus: snapshot.hasUrgentStatus,
      eggHatchTimeMs: eggHatchTiming?.hatchTimeMs,
      eggHatchDurationMs: eggHatchTiming?.hatchDurationMs,
      eggCrackStage: _resolveEggCrackStage(
        characterState: snapshot.characterState,
        timing: eggHatchTiming,
      ),
    );
  }

  static Future<Map<String, Object?>> _publishSnapshot({
    required String? snapshotJson,
    required String reason,
    void Function(String message)? log,
  }) async {
    try {
      final Map<Object?, Object?>? result = await _platformChannel
          .invokeMethod<Map<Object?, Object?>>(
              'publishSnapshot', <String, dynamic>{
        'snapshotJson': snapshotJson,
        'storageName': config.nativeWorldDataStorageName,
        'snapshotKey': config.nativeWorldDataSnapshotKey,
        'reason': reason,
      });
      log?.call(
        '[WorldDataSyncService] native publish result=${_describeNativePublishResult(result)}',
      );
      return _normalizePublishResult(
        result,
        fallbackReason: reason,
        fallbackSnapshotKey: config.nativeWorldDataSnapshotKey,
      );
    } catch (error) {
      log?.call('[WorldDataSyncService] native publish failed: $error');
      return <String, Object?>{
        'status': 'error',
        'reason': reason,
        'snapshotKey': config.nativeWorldDataSnapshotKey,
        'hasSnapshot': snapshotJson != null,
        'error': error.toString(),
      };
    }
  }

  static Future<Map<String, Object?>> _publishAuthoritativeSnapshot({
    required String? snapshotJson,
    required String reason,
    void Function(String message)? log,
  }) async {
    final String authoritativeReason = '${reason}_authoritative';

    try {
      final Map<Object?, Object?>? result = await _platformChannel
          .invokeMethod<Map<Object?, Object?>>(
              'publishSnapshot', <String, dynamic>{
        'snapshotJson': snapshotJson,
        'storageName': config.nativeWorldDataStorageName,
        'snapshotKey': config.nativeWorldDataAuthoritativeSnapshotKey,
        'reason': authoritativeReason,
      });
      log?.call(
        '[WorldDataSyncService] native authoritative publish result=${_describeNativePublishResult(result)}',
      );
      return _normalizePublishResult(
        result,
        fallbackReason: authoritativeReason,
        fallbackSnapshotKey: config.nativeWorldDataAuthoritativeSnapshotKey,
      );
    } catch (error) {
      log?.call(
        '[WorldDataSyncService] native authoritative publish failed: $error',
      );
      return <String, Object?>{
        'status': 'error',
        'reason': authoritativeReason,
        'snapshotKey': config.nativeWorldDataAuthoritativeSnapshotKey,
        'hasSnapshot': snapshotJson != null,
        'error': error.toString(),
      };
    }
  }

  static String _describeNativePublishResult(Map<Object?, Object?>? result) {
    if (result == null) {
      return 'null';
    }

    return <String>[
      'status=${result['status']}',
      'snapshotKey=${result['snapshotKey']}',
      'reason=${result['reason']}',
      'hasSnapshot=${result['hasSnapshot']}',
      'characterState=${result['characterState']}',
      'characterKey=${result['characterKey']}',
      'eggHatchTimeMs=${result['eggHatchTimeMs']}',
      'snapshotKind=${result['snapshotKind']}',
    ].join(' ');
  }

  static Map<String, Object?> _normalizePublishResult(
    Map<Object?, Object?>? result, {
    required String fallbackReason,
    required String fallbackSnapshotKey,
  }) {
    if (result == null) {
      return <String, Object?>{
        'status': 'unknown',
        'reason': fallbackReason,
        'snapshotKey': fallbackSnapshotKey,
      };
    }

    return <String, Object?>{
      'status': result['status']?.toString() ?? 'unknown',
      'reason': result['reason']?.toString() ?? fallbackReason,
      'snapshotKey': result['snapshotKey']?.toString() ?? fallbackSnapshotKey,
      'hasSnapshot': result['hasSnapshot'] == true,
      'characterState': result['characterState']?.toString(),
      'characterKey': _readInt(result['characterKey']),
      'eggHatchTimeMs': _readInt(result['eggHatchTimeMs']),
      'snapshotKind': result['snapshotKind']?.toString(),
    };
  }

  static _WorldDataSummary _summarizeWorldData(String? rawWorldData) {
    if (rawWorldData == null || rawWorldData.isEmpty) {
      return const _WorldDataSummary(
        hasWorldData: false,
        lastEcsSaved: null,
        mainCharacterState: null,
      );
    }

    try {
      final Object decoded = jsonDecode(rawWorldData);
      if (decoded is! Map<String, dynamic>) {
        return const _WorldDataSummary(
          hasWorldData: false,
          lastEcsSaved: null,
          mainCharacterState: null,
        );
      }

      final Map<String, dynamic> worldMetadata =
          _readMap(decoded['world_metadata']);
      final List<dynamic> entities = _readList(decoded['entities']);
      final _CharacterSnapshotSource? source = _findMainCharacter(entities);

      return _WorldDataSummary(
        hasWorldData: true,
        lastEcsSaved: _readInt(worldMetadata['last_ecs_saved']),
        mainCharacterState: source?.state,
      );
    } catch (_) {
      return const _WorldDataSummary(
        hasWorldData: false,
        lastEcsSaved: null,
        mainCharacterState: null,
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
      if (_readInt(object['type']) != config.characterObjectType) {
        continue;
      }

      final Map<String, dynamic> characterStatus =
          _readMap(components['characterStatus']);
      final Map<String, dynamic> render = _readMap(components['render']);
      final Map<String, dynamic> eggHatch = _readMap(components['eggHatch']);
      return _CharacterSnapshotSource(
        state: _readInt(object['state']),
        characterKey: _readInt(characterStatus['characterKey']),
        textureKey: _readInt(render['textureKey']),
        eggHatchTime: eggHatch['hatchTime'],
        eggHatchDurationMs: eggHatch['hatchDurationMs'],
        stamina: _readDouble(characterStatus['stamina']),
        statuses: characterStatus['statuses'] is List<dynamic>
            ? characterStatus['statuses'] as List<dynamic>
            : const <dynamic>[],
      );
    }

    return null;
  }

  static WorldDataCharacterState _resolveCharacterState(int? rawState) {
    switch (rawState) {
      case config.characterStateEgg:
        return WorldDataCharacterState.egg;
      case config.characterStateMoving:
        return WorldDataCharacterState.moving;
      case config.characterStateSleeping:
        return WorldDataCharacterState.sleeping;
      case config.characterStateSick:
        return WorldDataCharacterState.sick;
      case config.characterStateEating:
        return WorldDataCharacterState.eating;
      case config.characterStateDead:
        return WorldDataCharacterState.dead;
      case config.characterStateIdle:
      default:
        return WorldDataCharacterState.idle;
    }
  }

  static WorldDataCharacterState _resolveCharacterStateName(String? rawName) {
    return WorldDataCharacterState.values.firstWhere(
      (WorldDataCharacterState value) => value.name == rawName,
      orElse: () => WorldDataCharacterState.idle,
    );
  }

  static WorldDataSnapshotKind _resolveSnapshotKind(String? rawName) {
    return WorldDataSnapshotKind.values.firstWhere(
      (WorldDataSnapshotKind value) => value.name == rawName,
      orElse: () => WorldDataSnapshotKind.authoritativeAppState,
    );
  }

  static WorldDataDisplayState _resolveDisplayState({
    required WorldDataCharacterState characterState,
    required List<WorldDataStatusIcon> visibleStatusIcons,
  }) {
    if (characterState == WorldDataCharacterState.sleeping ||
        visibleStatusIcons.contains(WorldDataStatusIcon.sleeping)) {
      return WorldDataDisplayState.sleep;
    }
    if (characterState == WorldDataCharacterState.sick ||
        visibleStatusIcons.contains(WorldDataStatusIcon.sick)) {
      return WorldDataDisplayState.sick;
    }
    return WorldDataDisplayState.idle;
  }

  static WorldDataDisplayState _resolveDisplayStateName(
    String? rawName, {
    required WorldDataCharacterState fallbackState,
    required List<WorldDataStatusIcon> visibleStatusIcons,
  }) {
    return WorldDataDisplayState.values.firstWhere(
      (WorldDataDisplayState value) => value.name == rawName,
      orElse: () => _resolveDisplayState(
        characterState: fallbackState,
        visibleStatusIcons: visibleStatusIcons,
      ),
    );
  }

  static List<WorldDataStatusIcon> _resolveVisibleStatusIcons({
    required WorldDataCharacterState characterState,
    required List<dynamic> rawStatuses,
  }) {
    if (characterState == WorldDataCharacterState.dead) {
      return const <WorldDataStatusIcon>[];
    }

    final List<int> statuses = rawStatuses
        .map(_readInt)
        .whereType<int>()
        .where((int value) => value > 0)
        .toList(growable: false);

    final List<WorldDataStatusIcon> visibleIcons = <WorldDataStatusIcon>[];

    for (final int status in statuses) {
      switch (status) {
        case config.characterStatusUrgent:
          break;
        case config.characterStatusSick:
          if (!visibleIcons.contains(WorldDataStatusIcon.sick)) {
            visibleIcons.add(WorldDataStatusIcon.sick);
          }
          break;
        case config.characterStatusHappy:
        case config.characterStatusDiscover:
          break;
      }
    }

    if (characterState == WorldDataCharacterState.sick &&
        !visibleIcons.contains(WorldDataStatusIcon.sick)) {
      visibleIcons.add(WorldDataStatusIcon.sick);
    }

    if (characterState == WorldDataCharacterState.sleeping) {
      visibleIcons.add(WorldDataStatusIcon.sleeping);
    }

    return visibleIcons;
  }

  static List<WorldDataStatusIcon> _resolveVisibleStatusIconsFromNames(
    Object? rawValue, {
    required WorldDataCharacterState characterState,
  }) {
    if (characterState == WorldDataCharacterState.dead) {
      return const <WorldDataStatusIcon>[];
    }

    final List<dynamic> values =
        rawValue is List<dynamic> ? rawValue : const <dynamic>[];

    final List<WorldDataStatusIcon> visibleIcons = <WorldDataStatusIcon>[];

    for (final String name in values.whereType<String>()) {
      final WorldDataStatusIcon? icon = _resolveWidgetStatusIconName(name);
      if (icon != null && !visibleIcons.contains(icon)) {
        visibleIcons.add(icon);
      }
    }

    return visibleIcons;
  }

  static WorldDataStatusIcon? _resolveWidgetStatusIconName(String name) {
    switch (name) {
      case 'sick':
        return WorldDataStatusIcon.sick;
      case 'sleeping':
        return WorldDataStatusIcon.sleeping;
      default:
        return null;
    }
  }

  static bool _hasUrgentStatus(List<dynamic> rawStatuses) {
    return rawStatuses
        .map(_readInt)
        .whereType<int>()
        .contains(config.characterStatusUrgent);
  }

  static WorldDataStaminaLevel _resolveStaminaLevel(double stamina) {
    if (stamina <= config.lowStaminaThreshold) {
      return WorldDataStaminaLevel.red;
    }
    if (stamina >= config.boostedStaminaThreshold) {
      return WorldDataStaminaLevel.green;
    }
    return WorldDataStaminaLevel.orange;
  }

  static int? _resolveEggTextureKey({
    required WorldDataCharacterState characterState,
    required int? rawTextureKey,
  }) {
    if (characterState != WorldDataCharacterState.egg) {
      return null;
    }
    if (rawTextureKey == null ||
        rawTextureKey < config.eggTextureKeyStart ||
        rawTextureKey > config.eggTextureKeyEnd) {
      return config.eggTextureKeyStart;
    }
    return rawTextureKey;
  }

  static _ResolvedEggHatchTiming? _resolveEggHatchTiming({
    required int nowMs,
    required WorldDataCharacterState characterState,
    required int? hatchTimeMs,
    required int? hatchDurationMs,
  }) {
    if (characterState != WorldDataCharacterState.egg) {
      return null;
    }

    final int? normalizedHatchTime =
        hatchTimeMs != null && hatchTimeMs > 0 ? hatchTimeMs : null;
    final int? normalizedDurationMs =
        hatchDurationMs != null && hatchDurationMs > 0 ? hatchDurationMs : null;

    late final int resolvedHatchTimeMs;
    late final int resolvedDurationMs;

    if (normalizedDurationMs != null && normalizedHatchTime != null) {
      resolvedHatchTimeMs = normalizedHatchTime;
      resolvedDurationMs = normalizedDurationMs;
    } else if (normalizedHatchTime != null) {
      resolvedHatchTimeMs = normalizedHatchTime;
      resolvedDurationMs = math.max(0, normalizedHatchTime - nowMs);
    } else if (normalizedDurationMs != null) {
      resolvedDurationMs = normalizedDurationMs;
      resolvedHatchTimeMs = nowMs + normalizedDurationMs;
    } else {
      resolvedDurationMs = config.defaultEggHatchDurationMs;
      resolvedHatchTimeMs = nowMs + resolvedDurationMs;
    }

    final int hatchStartTimeMs = resolvedDurationMs > 0
        ? resolvedHatchTimeMs - resolvedDurationMs
        : resolvedHatchTimeMs;
    final double progress = resolvedDurationMs <= 0
        ? (nowMs >= resolvedHatchTimeMs ? 1 : 0).toDouble()
        : _clampDouble(
            (nowMs - hatchStartTimeMs) / resolvedDurationMs,
            0,
            1,
          );

    return _ResolvedEggHatchTiming(
      hatchTimeMs: resolvedHatchTimeMs,
      hatchDurationMs: resolvedDurationMs,
      progress: progress,
    );
  }

  static int _resolveEggCrackStage({
    required WorldDataCharacterState characterState,
    required _ResolvedEggHatchTiming? timing,
  }) {
    if (characterState != WorldDataCharacterState.egg || timing == null) {
      return 0;
    }

    if (timing.progress >= 0.75) {
      return 3;
    }
    if (timing.progress >= 0.5) {
      return 2;
    }
    if (timing.progress >= 0.25) {
      return 1;
    }
    return 0;
  }

  static WorldDataStaminaLevel _resolveStaminaLevelName(
    String? rawName,
    double stamina,
  ) {
    return WorldDataStaminaLevel.values.firstWhere(
      (WorldDataStaminaLevel value) => value.name == rawName,
      orElse: () => _resolveStaminaLevel(stamina),
    );
  }

  static WorldDataTimeOfDay _resolveTimeOfDay({
    required DateTime now,
    required bool useLocalTime,
    required Map<String, dynamic> appState,
  }) {
    if (!useLocalTime) {
      return WorldDataTimeOfDay.day;
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
          ? WorldDataTimeOfDay.night
          : WorldDataTimeOfDay.day;
    }

    final DateTime sunriseStart =
        sunriseAt.subtract(const Duration(minutes: 60));
    final DateTime sunriseEnd = sunriseAt.add(const Duration(minutes: 60));
    final DateTime sunsetStart = sunsetAt.subtract(const Duration(minutes: 60));
    final DateTime sunsetEnd = sunsetAt.add(const Duration(minutes: 60));

    if (!now.isBefore(sunriseStart) && !now.isAfter(sunriseEnd)) {
      return WorldDataTimeOfDay.sunrise;
    }
    if (!now.isBefore(sunsetStart) && !now.isAfter(sunsetEnd)) {
      return WorldDataTimeOfDay.sunset;
    }
    if (now.isAfter(sunriseEnd) && now.isBefore(sunsetStart)) {
      return WorldDataTimeOfDay.day;
    }
    return WorldDataTimeOfDay.night;
  }

  static WorldDataTimeOfDay _resolveTimeOfDayName(String? rawName) {
    return WorldDataTimeOfDay.values.firstWhere(
      (WorldDataTimeOfDay value) => value.name == rawName,
      orElse: () => WorldDataTimeOfDay.day,
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
    required WorldDataCharacterState characterState,
    required double deltaMs,
  }) {
    if (deltaMs <= 0 ||
        characterState == WorldDataCharacterState.egg ||
        characterState == WorldDataCharacterState.dead) {
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
          (config.staminaDecreaseIntervalMs - nextTimerMs).clamp(
        0,
        config.staminaDecreaseIntervalMs.toDouble(),
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
        nextStamina - config.staminaDecreaseAmount,
        0,
        config.maxStamina,
      );
    }

    return _StaminaProgressResult(
      stamina: nextStamina,
      staminaTimerMs: nextTimerMs,
    );
  }

  static double _resolveCurrentStaminaTimerMultiplier(
    double stamina,
    WorldDataCharacterState characterState,
  ) {
    final double sleepMultiplier =
        characterState == WorldDataCharacterState.sleeping
            ? config.sleepingStaminaDecayMultiplier
            : 1;
    return sleepMultiplier * _resolveStaminaDecayRateMultiplier(stamina);
  }

  static double _resolveStaminaDecayRateMultiplier(double stamina) {
    if (stamina >= config.boostedStaminaThreshold) {
      return config.highStaminaDecayMultiplier;
    }
    if (stamina < config.lowStaminaThreshold) {
      return config.lowStaminaDecayMultiplier;
    }
    return 1;
  }
}

class _WorldDataSummary {
  final bool hasWorldData;
  final int? lastEcsSaved;
  final int? mainCharacterState;

  const _WorldDataSummary({
    required this.hasWorldData,
    required this.lastEcsSaved,
    required this.mainCharacterState,
  });
}

class _CharacterSnapshotSource {
  final int? state;
  final int? characterKey;
  final int? textureKey;
  final Object? eggHatchTime;
  final Object? eggHatchDurationMs;
  final double? stamina;
  final List<dynamic> statuses;

  const _CharacterSnapshotSource({
    required this.state,
    required this.characterKey,
    required this.textureKey,
    required this.eggHatchTime,
    required this.eggHatchDurationMs,
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

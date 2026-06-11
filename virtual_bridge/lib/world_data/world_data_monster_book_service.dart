import 'dart:convert';

import 'world_data_constants.dart';

class WorldDataMonsterBookService {
  const WorldDataMonsterBookService._();

  static Map<String, dynamic>? decodeState(String? raw) {
    if (raw == null || raw.trim().isEmpty) {
      return null;
    }
    try {
      final Object? decoded = jsonDecode(raw);
      return decoded is Map<String, dynamic> ? decoded : null;
    } catch (_) {
      return null;
    }
  }

  static Map<String, dynamic> ensureState(Map<String, dynamic> appState) {
    final Map<String, dynamic> monsterBook = normalizeState(
      appState['monster_book'],
    );
    appState['monster_book'] = monsterBook;
    return monsterBook;
  }

  static Map<String, dynamic> mergeStates(Object? left, Object? right) {
    final Map<String, dynamic> merged = normalizeState(left);
    final Map<String, dynamic> rightState = normalizeState(right);
    final Map<String, dynamic> mergedReached = _readMap(merged['reached']);
    final Map<String, dynamic> rightReached = _readMap(rightState['reached']);

    for (final MapEntry<String, dynamic> entry in rightReached.entries) {
      final List<dynamic> records = <dynamic>[
        ..._readList(mergedReached[entry.key]),
        ..._readList(entry.value),
      ];
      mergedReached[entry.key] = normalizeRecords(records);
    }

    merged['reached'] = mergedReached;
    return normalizeState(merged);
  }

  static Map<String, dynamic> normalizeState(Object? value) {
    final Map<String, dynamic> reached = <String, dynamic>{};
    final Map<String, dynamic> rawReached = value is Map<String, dynamic>
        ? _readMap(value['reached'])
        : <String, dynamic>{};

    for (final int characterKey in worldDataMonsterCharacterKeys) {
      final List<Map<String, dynamic>> records = normalizeRecords(
        rawReached['$characterKey'],
      );
      if (records.isNotEmpty) {
        reached['$characterKey'] = records;
      }
    }

    return <String, dynamic>{'reached': reached};
  }

  static List<Map<String, dynamic>> normalizeRecords(Object? value) {
    final List<dynamic> rawRecords = _readList(value);
    final List<Map<String, dynamic>> normalized = <Map<String, dynamic>>[];

    for (final dynamic rawRecord in rawRecords) {
      if (rawRecord is! Map<String, dynamic>) {
        continue;
      }

      final String? name = _readString(rawRecord['name']);
      final int? reachedAt = _readInt(rawRecord['reached_at']);
      if (name == null || reachedAt == null) {
        continue;
      }

      normalized.add(<String, dynamic>{
        'name': name,
        'reached_at': reachedAt,
        'object_id': _readInt(rawRecord['object_id']) ?? 0,
        'source': _readString(rawRecord['source']) ?? 'backfill',
      });
    }

    normalized.sort(
      (Map<String, dynamic> a, Map<String, dynamic> b) =>
          (_readInt(b['reached_at']) ?? 0)
              .compareTo(_readInt(a['reached_at']) ?? 0),
    );

    final Set<int> seenObjectIds = <int>{};
    final List<Map<String, dynamic>> deduped = <Map<String, dynamic>>[];
    for (final Map<String, dynamic> record in normalized) {
      final int objectId = _readInt(record['object_id']) ?? 0;
      if (objectId > 0 && !seenObjectIds.add(objectId)) {
        continue;
      }

      deduped.add(record);
      if (deduped.length >= worldDataMonsterBookMaxRecordsPerCharacter) {
        break;
      }
    }

    return deduped;
  }

  static bool recordReach({
    required Map<String, dynamic> monsterBook,
    required int characterKey,
    required String name,
    required int reachedAt,
    required int objectId,
    required String source,
    required bool onlyIfMissing,
  }) {
    if (!worldDataMonsterCharacterKeys.contains(characterKey) ||
        name.trim().isEmpty) {
      return false;
    }

    final Map<String, dynamic> reached = _readMap(monsterBook['reached']);
    final String key = '$characterKey';
    final List<Map<String, dynamic>> current = normalizeRecords(reached[key]);
    if (onlyIfMissing && current.isNotEmpty) {
      reached[key] = current;
      monsterBook['reached'] = reached;
      return false;
    }

    reached[key] = normalizeRecords(<dynamic>[
      <String, dynamic>{
        'name': name.trim(),
        'reached_at': reachedAt,
        'object_id': objectId,
        'source': source,
      },
      ...current,
    ]);
    monsterBook['reached'] = reached;
    return true;
  }

  static String extractStateJson(String rawWorldData) {
    final Object decoded = jsonDecode(rawWorldData);
    if (decoded is! Map<String, dynamic>) {
      return jsonEncode(normalizeState(null));
    }

    final Map<String, dynamic> worldMetadata = _readMap(
      decoded['world_metadata'],
    );
    final Map<String, dynamic> appState = _readMap(
      worldMetadata['app_state'],
    );
    return jsonEncode(normalizeState(appState['monster_book']));
  }

  static Map<String, dynamic> _readMap(Object? value) =>
      value is Map<String, dynamic> ? value : <String, dynamic>{};

  static List<dynamic> _readList(Object? value) =>
      value is List<dynamic> ? value : <dynamic>[];

  static int? _readInt(Object? value) {
    if (value is int) {
      return value;
    }
    if (value is num) {
      return value.round();
    }
    return null;
  }

  static String? _readString(Object? value) {
    if (value is! String) {
      return null;
    }
    final String trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }
}

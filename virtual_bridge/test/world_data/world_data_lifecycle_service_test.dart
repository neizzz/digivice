import 'dart:convert';
import 'dart:math' as math;

import 'package:digivice_virtual_bridge/home_widget/world_data_config.dart'
    as config;
import 'package:digivice_virtual_bridge/world_data/world_data_lifecycle_service.dart';
import 'package:flutter_test/flutter_test.dart';

String _buildWorldData({
  int lastEcsSaved = 0,
  int state = config.characterStateIdle,
  int characterKey = 1,
  int evolutionPhase = 1,
  double stamina = 10,
  double evolutionGage = 0,
  List<int> statuses = const <int>[],
  int nextDiseaseCheckTime = 10 * 1000,
  double fatigue = 35,
  int nextNapCheckTime = 20 * 60 * 1000,
  int sleepMode = 0,
  int sleepSessionStartedAt = 0,
  Map<String, dynamic>? mutationRisk,
  Map<String, dynamic>? eggHatch,
  Map<String, dynamic>? position,
  Map<String, dynamic>? speed,
  Map<String, dynamic>? destination,
  Map<String, dynamic>? foodEating,
  Map<String, dynamic>? digestiveSystem,
  Map<String, dynamic>? monsterBook,
  List<Map<String, dynamic>> extraEntities = const <Map<String, dynamic>>[],
}) {
  return jsonEncode(<String, dynamic>{
    'world_metadata': <String, dynamic>{
      'monster_name': 'MonTTo',
      'last_ecs_saved': lastEcsSaved,
      'app_state': <String, dynamic>{
        'last_active_time': lastEcsSaved,
        'last_active_time_anchor': <String, dynamic>{
          'trustedUtcMs': lastEcsSaved
        },
        'use_local_time': false,
        if (monsterBook != null) 'monster_book': monsterBook,
      },
    },
    'entities': <Map<String, dynamic>>[
      <String, dynamic>{
        'components': <String, dynamic>{
          'object': <String, dynamic>{
            'id': 101,
            'type': config.characterObjectType,
            'state': state,
          },
          'render': <String, dynamic>{'textureKey': 1},
          if (position != null) 'position': position,
          if (speed != null) 'speed': speed,
          if (destination != null) 'destination': destination,
          if (foodEating != null) 'foodEating': foodEating,
          'eggHatch': <String, dynamic>{
            'hatchTime': 0,
            'hatchDurationMs': 0,
            'isReadyToHatch': false,
            'syringeCount': 0,
            'pendingCharacterKey': 0,
            ...?eggHatch,
          },
          'animationRender': <String, dynamic>{
            'spritesheetKey': characterKey,
          },
          'characterStatus': <String, dynamic>{
            'characterKey': characterKey,
            'stamina': stamina,
            'evolutionGage': evolutionGage,
            'evolutionPhase': evolutionPhase,
            'statuses': statuses,
          },
          if (mutationRisk != null) 'mutationRisk': mutationRisk,
          'digestiveSystem': <String, dynamic>{
            'capacity': 5.0,
            'currentLoad': 0.0,
            'nextPoopTime': 0,
            'nextSmallPoopTime': 0,
            ...?digestiveSystem,
          },
          'diseaseSystem': <String, dynamic>{
            'nextCheckTime': nextDiseaseCheckTime,
            'sickStartTime': 0,
          },
          'sleepSystem': <String, dynamic>{
            'fatigue': fatigue,
            'nextSleepTime': 0,
            'nextWakeTime': 0,
            'nextNapCheckTime': nextNapCheckTime,
            'nextNightWakeCheckTime': 0,
            'sleepMode': sleepMode,
            'pendingSleepReason': 0,
            'pendingWakeReason': 0,
            'sleepSessionStartedAt': sleepSessionStartedAt,
          },
        },
      },
      ...extraEntities,
    ],
  });
}

Map<String, dynamic> _buildFoodEntity({
  int id = 201,
  int state = 2,
  int textureKey = 400,
  Map<String, dynamic>? position,
  Map<String, dynamic>? foodMask,
  int? freshness,
  int? legacyFoodFreshness,
  Map<String, dynamic>? freshnessTimer,
}) {
  return <String, dynamic>{
    'components': <String, dynamic>{
      'object': <String, dynamic>{
        'id': id,
        'type': worldDataLifecycleFoodObjectType,
        'state': state,
      },
      if (position != null) 'position': position,
      'render': <String, dynamic>{'textureKey': textureKey},
      if (foodMask != null) 'foodMask': foodMask,
      if (freshness != null)
        'freshness': <String, dynamic>{
          'freshness': freshness,
        },
      if (freshnessTimer != null) 'freshnessTimer': freshnessTimer,
      if (legacyFoodFreshness != null)
        'food': <String, dynamic>{
          'freshness': legacyFoodFreshness,
        },
    },
  };
}

Map<String, dynamic> _decode(String raw) =>
    jsonDecode(raw) as Map<String, dynamic>;

Map<String, dynamic> _characterStatus(Map<String, dynamic> worldData) =>
    (((worldData['entities'] as List<dynamic>).single
            as Map<String, dynamic>)['components']
        as Map<String, dynamic>)['characterStatus'] as Map<String, dynamic>;

Map<String, dynamic> _object(Map<String, dynamic> worldData) =>
    (((worldData['entities'] as List<dynamic>).single
            as Map<String, dynamic>)['components']
        as Map<String, dynamic>)['object'] as Map<String, dynamic>;

Map<String, dynamic> _components(Map<String, dynamic> worldData) =>
    (((worldData['entities'] as List<dynamic>).first
        as Map<String, dynamic>)['components']) as Map<String, dynamic>;

List<dynamic> _entities(Map<String, dynamic> worldData) =>
    worldData['entities'] as List<dynamic>;

Map<String, dynamic> _entityComponentsAt(
  Map<String, dynamic> worldData,
  int index,
) =>
    ((_entities(worldData)[index] as Map<String, dynamic>)['components'])
        as Map<String, dynamic>;

Map<String, dynamic> _sleepSystem(Map<String, dynamic> worldData) =>
    (((worldData['entities'] as List<dynamic>).single
            as Map<String, dynamic>)['components']
        as Map<String, dynamic>)['sleepSystem'] as Map<String, dynamic>;

Map<String, dynamic> _monsterBook(Map<String, dynamic> worldData) =>
    ((worldData['world_metadata'] as Map<String, dynamic>)['app_state']
        as Map<String, dynamic>)['monster_book'] as Map<String, dynamic>;

List<dynamic> _monsterBookRecords(
  Map<String, dynamic> worldData,
  int characterKey,
) =>
    ((_monsterBook(worldData)['reached']
        as Map<String, dynamic>?)?['$characterKey'] as List<dynamic>?) ??
    const <dynamic>[];

void main() {
  test('background lifecycle은 1초 미만/100ms tick을 쓰지 않는다', () {
    expect(
      WorldDataLifecycleService.resolveBackgroundTickDurationsForTest(999),
      isEmpty,
    );
    expect(
      WorldDataLifecycleService.resolveBackgroundTickDurationsForTest(1500),
      <int>[1500],
    );
    expect(
      WorldDataLifecycleService.resolveBackgroundTickDurationsForTest(
          61 * 1000),
      <int>[60 * 1000, 1000],
    );
  });

  test('60분 중 40번째 tick 질병이면 이전 40분 진행분은 반영된다', () {
    var diseaseRoll = 1.0;
    var diseaseEventCount = 0;
    final WorldDataLifecycleAdvanceResult result =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: _buildWorldData(stamina: 10, evolutionGage: 0),
      nowMs: 60 * 60 * 1000,
      source: 'periodic_work',
      randomProvider: (WorldDataLifecycleRandomEvent event) {
        if (event.reason == 'disease') {
          diseaseEventCount += 1;
          if (diseaseEventCount == 40) {
            diseaseRoll = 0;
          }
          return diseaseRoll;
        }
        return 1;
      },
    );

    final Map<String, dynamic> updated = _decode(result.updatedRawWorldData);
    final Map<String, dynamic> status = _characterStatus(updated);

    expect(result.tickCount, 60);
    expect(result.diseaseOccurred, isTrue);
    expect(result.evolutionDiagnostics.evolutionGageAfter, greaterThan(0));
    expect(status['evolutionGage'], greaterThan(0));
    expect(status['stamina'], lessThan(10));
    expect(status['statuses'], contains(config.characterStatusSick));
    expect(_object(updated)['state'], config.characterStateSick);
  });

  test('시작부터 sick이면 진화 게이지가 증가하지 않는다', () {
    final WorldDataLifecycleAdvanceResult result =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: _buildWorldData(
        state: config.characterStateSick,
        statuses: const <int>[config.characterStatusSick],
        evolutionGage: 10,
      ),
      nowMs: 60 * 60 * 1000,
      source: 'app_resume',
      randomProvider: (_) => 1,
    );

    final Map<String, dynamic> updated = _decode(result.updatedRawWorldData);
    expect(_characterStatus(updated)['evolutionGage'], 10);
    expect(result.evolutionDiagnostics.blockReason, 'sick');
    expect(result.evolutionDiagnostics.evolutionGageIncreased, isFalse);
  });

  test('오프라인 elapsed 중 진화 게이지가 100에 도달하면 Dart가 실제 진화를 적용한다', () {
    final WorldDataLifecycleAdvanceResult result =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: _buildWorldData(
        characterKey: 2,
        evolutionPhase: 2,
        evolutionGage: 99.99,
        nextDiseaseCheckTime: 60 * 60 * 1000,
      ),
      nowMs: 60 * 1000,
      source: 'app_resume',
      randomProvider: (WorldDataLifecycleRandomEvent event) {
        if (event.reason == 'evolution_mutation') {
          return 1;
        }
        if (event.reason == 'evolution') {
          return 0;
        }
        return 1;
      },
    );

    final Map<String, dynamic> updated = _decode(result.updatedRawWorldData);
    final Map<String, dynamic> components = _components(updated);
    final Map<String, dynamic> status =
        components['characterStatus'] as Map<String, dynamic>;
    final Map<String, dynamic> animationRender =
        components['animationRender'] as Map<String, dynamic>;
    final Map<String, dynamic> render =
        components['render'] as Map<String, dynamic>;

    expect(result.evolutionDiagnostics.evolved, isTrue);
    expect(result.evolutionDiagnostics.previousCharacterKey, 2);
    expect(result.evolutionDiagnostics.nextCharacterKey, 3);
    expect(result.evolutionDiagnostics.previousEvolutionPhase, 2);
    expect(result.evolutionDiagnostics.nextEvolutionPhase, 3);
    expect(result.evolutionDiagnostics.candidateKind, 'base');
    expect(result.evolutionDiagnostics.mutationApplied, isFalse);
    expect(status['characterKey'], 3);
    expect(status['evolutionPhase'], 3);
    expect(status['evolutionGage'], 0.0);
    expect(animationRender['spritesheetKey'], 3);
    expect(render['textureKey'], 0);
    expect(result.authoritativeSnapshot!.characterKey, 3);
    expect(result.toMap()['evolved'], isTrue);
    expect(result.toMap()['nextCharacterKey'], 3);
  });

  test('fake random으로 weighted base evolution 후보를 선택한다', () {
    final WorldDataLifecycleAdvanceResult result =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: _buildWorldData(
        evolutionGage: 99.99,
        nextDiseaseCheckTime: 60 * 60 * 1000,
      ),
      nowMs: 60 * 1000,
      source: 'periodic_work',
      randomProvider: (WorldDataLifecycleRandomEvent event) {
        if (event.reason == 'evolution_mutation') {
          return 1;
        }
        if (event.reason == 'evolution') {
          return 0.56;
        }
        return 1;
      },
    );

    final Map<String, dynamic> updated = _decode(result.updatedRawWorldData);
    expect(_characterStatus(updated)['characterKey'], 5);
    expect(result.evolutionDiagnostics.evolutionRoll, 0.56);
    expect(result.evolutionDiagnostics.candidateKind,
        'same_line_variant_mutation');
  });

  test('fake random으로 mutation 적용과 target 선택을 검증한다', () {
    final WorldDataLifecycleAdvanceResult result =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: _buildWorldData(
        characterKey: 2,
        evolutionPhase: 2,
        evolutionGage: 99.99,
        mutationRisk: <String, dynamic>{'unnecessaryInjectionStacks': 10},
        nextDiseaseCheckTime: 60 * 60 * 1000,
      ),
      nowMs: 60 * 1000,
      source: 'periodic_work',
      randomProvider: (WorldDataLifecycleRandomEvent event) {
        if (event.reason == 'evolution_mutation') {
          return 0;
        }
        if (event.reason == 'evolution_mutation_target') {
          return 0.75;
        }
        if (event.reason == 'evolution') {
          fail('mutation이 적용되면 base evolution roll은 호출되지 않아야 한다');
        }
        return 1;
      },
    );

    final Map<String, dynamic> updated = _decode(result.updatedRawWorldData);
    final Map<String, dynamic> status = _characterStatus(updated);
    expect(status['characterKey'], 25);
    expect(status['evolutionPhase'], 2);
    expect(result.evolutionDiagnostics.mutationApplied, isTrue);
    expect(result.evolutionDiagnostics.candidateKind,
        'same_class_cross_line_mutation');
    expect(result.evolutionDiagnostics.mutationRate, closeTo(0.06, 1e-12));
    expect(result.evolutionDiagnostics.mutationRoll, 0);
    expect(result.evolutionDiagnostics.mutationTargetRoll, 0.75);
    expect(result.evolutionDiagnostics.evolutionRoll, isNull);
  });

  test('egg, dead, terminal 상태에서는 진화가 block된다', () {
    final List<({String reason, String raw})> cases =
        <({String reason, String raw})>[
      (
        reason: 'egg',
        raw: _buildWorldData(
          state: config.characterStateEgg,
          evolutionGage: 99.99,
        ),
      ),
      (
        reason: 'dead',
        raw: _buildWorldData(
          state: config.characterStateDead,
          evolutionGage: 99.99,
        ),
      ),
      (
        reason: 'terminal',
        raw: _buildWorldData(
          characterKey: 4,
          evolutionPhase: 4,
          evolutionGage: 99.99,
        ),
      ),
    ];

    for (final (:reason, :raw) in cases) {
      final WorldDataLifecycleAdvanceResult result =
          WorldDataLifecycleService.advanceWorldData(
        rawWorldData: raw,
        nowMs: 60 * 1000,
        source: 'periodic_work',
        randomProvider: (_) => 0,
      );
      expect(result.evolutionDiagnostics.blockReason, reason);
      expect(result.evolutionDiagnostics.evolved, isFalse);
    }
  });

  test('긴 오프라인 elapsed에서도 한 lifecycle call 안에서는 실제 진화를 최대 1회만 적용한다', () {
    final Map<String, int> eventCounts = <String, int>{};
    final WorldDataLifecycleAdvanceResult result =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: _buildWorldData(
        evolutionGage: 99.99,
        nextDiseaseCheckTime: 400 * 60 * 60 * 1000,
      ),
      nowMs: 200 * 60 * 60 * 1000,
      source: 'periodic_work',
      randomProvider: (WorldDataLifecycleRandomEvent event) {
        eventCounts[event.reason] = (eventCounts[event.reason] ?? 0) + 1;
        if (event.reason == 'evolution_mutation') {
          return 1;
        }
        if (event.reason == 'evolution') {
          return 0;
        }
        return 1;
      },
    );

    final Map<String, dynamic> updated = _decode(result.updatedRawWorldData);
    expect(_characterStatus(updated)['characterKey'], 2);
    expect(result.evolutionDiagnostics.evolved, isTrue);
    expect(eventCounts['evolution_mutation'], 1);
    expect(eventCounts['evolution_mutation_target'], 1);
    expect(eventCounts['evolution'], 1);
  });

  test('같은 raw data와 nowMs면 source가 달라도 상태 결과가 같다', () {
    final String raw = _buildWorldData(stamina: 8, evolutionGage: 2);
    final WorldDataLifecycleAdvanceResult reentry =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: raw,
      nowMs: 30 * 60 * 1000,
      source: 'app_resume',
      randomProvider: (_) => 1,
    );
    final WorldDataLifecycleAdvanceResult periodic =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: raw,
      nowMs: 30 * 60 * 1000,
      source: 'periodic_work',
      randomProvider: (_) => 1,
    );

    expect(reentry.updatedRawWorldData, periodic.updatedRawWorldData);
    expect(
        reentry.toMap()..remove('source'), periodic.toMap()..remove('source'));
  });

  test('질병 확률은 check count에 맞게 집계된다', () {
    const double perCheck = 0.2;
    final double aggregated = WorldDataLifecycleService.aggregateProbability(
      perCheckProbability: perCheck,
      checkCount: 3,
    );
    expect(aggregated, closeTo(1 - math.pow(1 - perCheck, 3), 1e-12));

    final WorldDataLifecycleAdvanceResult result =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: _buildWorldData(
        nextDiseaseCheckTime: 10 * 1000,
      ),
      nowMs: 30 * 1000,
      source: 'periodic_work',
      randomProvider: (WorldDataLifecycleRandomEvent event) {
        if (event.reason == 'disease') {
          expect(event.checkCount, greaterThanOrEqualTo(1));
          expect(
            event.aggregatedProbability,
            closeTo(
              WorldDataLifecycleService.aggregateProbability(
                perCheckProbability: event.perCheckProbability,
                checkCount: event.checkCount,
              ),
              1e-12,
            ),
          );
          return 0;
        }
        return 1;
      },
    );
    expect(result.diseaseOccurred, isTrue);
  });

  test('질병 확률은 저장된 freshness가 normal이어도 timer 기준 stale food를 반영한다', () {
    final List<WorldDataLifecycleRandomEvent> diseaseEvents =
        <WorldDataLifecycleRandomEvent>[];
    final WorldDataLifecycleAdvanceResult result =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: _buildWorldData(
        nextDiseaseCheckTime: 10 * 60 * 1000,
        extraEntities: <Map<String, dynamic>>[
          _buildFoodEntity(
            freshness: worldDataLifecycleFoodFreshnessNormal,
            freshnessTimer: <String, dynamic>{
              'createdTime': 0,
              'normalTime': 3 * 60 * 1000,
              'staleTime': 10 * 60 * 1000,
              'isBeingEaten': false,
            },
          ),
        ],
      ),
      nowMs: 10 * 60 * 1000,
      source: 'periodic_work',
      randomProvider: (WorldDataLifecycleRandomEvent event) {
        if (event.reason == 'disease') {
          diseaseEvents.add(event);
        }
        return 1;
      },
    );

    final Map<String, dynamic> updated = _decode(result.updatedRawWorldData);
    final Map<String, dynamic> foodComponents = _entityComponentsAt(updated, 1);
    final Map<String, dynamic> freshness =
        foodComponents['freshness'] as Map<String, dynamic>;

    expect(diseaseEvents, hasLength(1));
    expect(
      diseaseEvents.single.perCheckProbability,
      closeTo(
        worldDataLifecycleBaseDiseaseRate +
            worldDataLifecycleStaleFoodDiseaseRate,
        1e-12,
      ),
    );
    expect(freshness['freshness'], worldDataLifecycleFoodFreshnessStale);
    expect(result.diseaseOccurred, isFalse);
  });

  test('day nap 확률도 check count 기반 집계 경로를 사용한다', () {
    final List<WorldDataLifecycleRandomEvent> events =
        <WorldDataLifecycleRandomEvent>[];
    final WorldDataLifecycleAdvanceResult result =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: _buildWorldData(
        fatigue: 80,
        nextNapCheckTime: 20 * 60 * 1000,
        nextDiseaseCheckTime: 90 * 60 * 1000,
      ),
      nowMs: 21 * 60 * 1000,
      source: 'periodic_work',
      randomProvider: (WorldDataLifecycleRandomEvent event) {
        if (event.reason == 'day_nap') {
          events.add(event);
          expect(event.checkCount, greaterThanOrEqualTo(1));
          expect(
            event.aggregatedProbability,
            closeTo(
              WorldDataLifecycleService.aggregateProbability(
                perCheckProbability: event.perCheckProbability,
                checkCount: event.checkCount,
              ),
              1e-12,
            ),
          );
          return 0;
        }
        return 1;
      },
    );

    final Map<String, dynamic> updated = _decode(result.updatedRawWorldData);
    expect(events, hasLength(1));
    expect(result.dayNapOccurred, isTrue);
    expect(result.dayNapCheckCount, 1);
    expect(_object(updated)['state'], config.characterStateSleeping);
    expect(
        _sleepSystem(updated)['sleepMode'], worldDataLifecycleSleepModeDayNap);
    expect(result.toMap()['dayNapOccurred'], isTrue);
  });

  test('offline fatigue 증가는 stamina와 무관하게 동일하다', () {
    WorldDataLifecycleAdvanceResult advanceWithStamina(double stamina) =>
        WorldDataLifecycleService.advanceWorldData(
          rawWorldData: _buildWorldData(
            stamina: stamina,
            nextDiseaseCheckTime: 2 * 60 * 60 * 1000,
            nextNapCheckTime: 2 * 60 * 60 * 1000,
          ),
          nowMs: 60 * 60 * 1000,
          source: 'periodic_work',
          randomProvider: (_) => 1,
        );

    final Map<String, dynamic> normal =
        _decode(advanceWithStamina(5).updatedRawWorldData);
    final Map<String, dynamic> critical =
        _decode(advanceWithStamina(1.5).updatedRawWorldData);

    expect(_sleepSystem(normal)['fatigue'], closeTo(44.5, 1e-12));
    expect(_sleepSystem(critical)['fatigue'], closeTo(44.5, 1e-12));
  });

  test('offline day nap은 최소 30분 뒤 fatigue 48 이하이면 깬다', () {
    WorldDataLifecycleAdvanceResult advanceAt(int nowMs) =>
        WorldDataLifecycleService.advanceWorldData(
          rawWorldData: _buildWorldData(
            lastEcsSaved: 1000,
            state: config.characterStateSleeping,
            fatigue: worldDataLifecycleFatigueDayNapWakeThreshold,
            nextDiseaseCheckTime: 2 * 60 * 60 * 1000,
            nextNapCheckTime: 2 * 60 * 60 * 1000,
            sleepMode: worldDataLifecycleSleepModeDayNap,
            sleepSessionStartedAt: 1000,
          ),
          nowMs: nowMs,
          source: 'periodic_work',
          randomProvider: (_) => 1,
        );

    final Map<String, dynamic> beforeMin = _decode(
        advanceAt(1000 + worldDataLifecycleDayNapMinDurationMs - 1000)
            .updatedRawWorldData);
    final Map<String, dynamic> atMin = _decode(
        advanceAt(1000 + worldDataLifecycleDayNapMinDurationMs)
            .updatedRawWorldData);

    expect(_object(beforeMin)['state'], config.characterStateSleeping);
    expect(
      _sleepSystem(beforeMin)['sleepMode'],
      worldDataLifecycleSleepModeDayNap,
    );
    expect(_object(atMin)['state'], config.characterStateIdle);
    expect(_sleepSystem(atMin)['sleepMode'], worldDataLifecycleSleepModeAwake);
  });

  test('offline day nap은 fatigue가 높으면 최대 90분 뒤 깬다', () {
    WorldDataLifecycleAdvanceResult advanceAt(int nowMs) =>
        WorldDataLifecycleService.advanceWorldData(
          rawWorldData: _buildWorldData(
            lastEcsSaved: 1000,
            state: config.characterStateSleeping,
            fatigue: worldDataLifecycleFatigueMax,
            nextDiseaseCheckTime: 2 * 60 * 60 * 1000,
            nextNapCheckTime: 2 * 60 * 60 * 1000,
            sleepMode: worldDataLifecycleSleepModeDayNap,
            sleepSessionStartedAt: 1000,
          ),
          nowMs: nowMs,
          source: 'periodic_work',
          randomProvider: (_) => 1,
        );

    final Map<String, dynamic> beforeMax = _decode(
        advanceAt(1000 + worldDataLifecycleDayNapMaxDurationMs - 1000)
            .updatedRawWorldData);
    final Map<String, dynamic> atMax = _decode(
        advanceAt(1000 + worldDataLifecycleDayNapMaxDurationMs)
            .updatedRawWorldData);

    expect(_object(beforeMax)['state'], config.characterStateSleeping);
    expect(
      _sleepSystem(beforeMax)['sleepMode'],
      worldDataLifecycleSleepModeDayNap,
    );
    expect(_object(atMax)['state'], config.characterStateIdle);
    expect(_sleepSystem(atMax)['sleepMode'], worldDataLifecycleSleepModeAwake);
  });

  test('부화 진단은 freshness component의 stale food를 확률에 반영한다', () {
    final WorldDataLifecycleAdvanceResult result =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: _buildWorldData(
        state: config.characterStateEgg,
        characterKey: 0,
        eggHatch: <String, dynamic>{
          'hatchTime': 1000,
          'hatchDurationMs': 1000,
          'pendingCharacterKey': 0,
        },
        extraEntities: <Map<String, dynamic>>[
          _buildFoodEntity(
            freshness: worldDataLifecycleFoodFreshnessStale,
          ),
        ],
      ),
      nowMs: 2000,
      source: 'app_resume',
      randomProvider: (_) => 0.64,
    );
    final Map<String, Object?> diagnostics = result.hatchSelectionDiagnostics!;

    expect(result.hatched, isTrue);
    expect(
        result.selectedCharacterKey, worldDataLifecycleSoilSlimeA1CharacterKey);
    expect(diagnostics['staleFoodCountAtHatch'], 1);
    expect(diagnostics['greenProbability'], 63);
    expect(diagnostics['soilProbability'], 22);
    expect(diagnostics['skullProbability'], 15);
    expect(diagnostics['rollPercent'], 64.0);
  });

  test('부화 진단은 저장된 freshness가 normal이어도 hatch 시각의 timer 기준 stale food를 반영한다',
      () {
    final WorldDataLifecycleAdvanceResult result =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: _buildWorldData(
        state: config.characterStateEgg,
        characterKey: 0,
        eggHatch: <String, dynamic>{
          'hatchTime': 10 * 60 * 1000,
          'hatchDurationMs': 10 * 60 * 1000,
          'pendingCharacterKey': 0,
        },
        extraEntities: <Map<String, dynamic>>[
          _buildFoodEntity(
            freshness: worldDataLifecycleFoodFreshnessNormal,
            freshnessTimer: <String, dynamic>{
              'createdTime': 0,
              'normalTime': 3 * 60 * 1000,
              'staleTime': 10 * 60 * 1000,
              'isBeingEaten': false,
            },
          ),
        ],
      ),
      nowMs: 10 * 60 * 1000,
      source: 'app_resume',
      randomProvider: (_) => 1,
    );
    final Map<String, Object?> diagnostics = result.hatchSelectionDiagnostics!;
    final Map<String, dynamic> updated = _decode(result.updatedRawWorldData);
    final Map<String, dynamic> foodComponents = _entityComponentsAt(updated, 1);
    final Map<String, dynamic> freshness =
        foodComponents['freshness'] as Map<String, dynamic>;

    expect(result.hatched, isTrue);
    expect(diagnostics['staleFoodCountAtHatch'], 1);
    expect(diagnostics['greenProbability'], 63);
    expect(diagnostics['soilProbability'], 22);
    expect(diagnostics['skullProbability'], 15);
    expect(freshness['freshness'], worldDataLifecycleFoodFreshnessStale);
  });

  test('부화 진단은 legacy food freshness도 fallback으로 반영한다', () {
    final WorldDataLifecycleAdvanceResult result =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: _buildWorldData(
        state: config.characterStateEgg,
        characterKey: 0,
        eggHatch: <String, dynamic>{
          'hatchTime': 1000,
          'hatchDurationMs': 1000,
          'pendingCharacterKey': 0,
        },
        extraEntities: <Map<String, dynamic>>[
          _buildFoodEntity(
            legacyFoodFreshness: worldDataLifecycleFoodFreshnessStale,
          ),
        ],
      ),
      nowMs: 2000,
      source: 'app_resume',
      randomProvider: (_) => 1,
    );
    final Map<String, Object?> diagnostics = result.hatchSelectionDiagnostics!;

    expect(result.hatched, isTrue);
    expect(diagnostics['staleFoodCountAtHatch'], 1);
    expect(diagnostics['greenProbability'], 63);
    expect(diagnostics['soilProbability'], 22);
    expect(diagnostics['skullProbability'], 15);
  });

  test('부화 진단은 freshness component가 있으면 legacy food freshness를 무시한다', () {
    final WorldDataLifecycleAdvanceResult result =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: _buildWorldData(
        state: config.characterStateEgg,
        characterKey: 0,
        eggHatch: <String, dynamic>{
          'hatchTime': 1000,
          'hatchDurationMs': 1000,
          'pendingCharacterKey': 0,
        },
        extraEntities: <Map<String, dynamic>>[
          _buildFoodEntity(
            freshness: 1,
            legacyFoodFreshness: worldDataLifecycleFoodFreshnessStale,
          ),
        ],
      ),
      nowMs: 2000,
      source: 'app_resume',
      randomProvider: (_) => 1,
    );
    final Map<String, Object?> diagnostics = result.hatchSelectionDiagnostics!;

    expect(result.hatched, isTrue);
    expect(diagnostics['staleFoodCountAtHatch'], 0);
    expect(diagnostics['greenProbability'], 65);
    expect(diagnostics['soilProbability'], 20);
    expect(diagnostics['skullProbability'], 15);
  });

  test('부화 완료 시 Dart lifecycle이 MonsterBook hatch 기록을 저장한다', () {
    final WorldDataLifecycleAdvanceResult result =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: _buildWorldData(
        state: config.characterStateEgg,
        characterKey: 0,
        eggHatch: <String, dynamic>{
          'hatchTime': 1000,
          'hatchDurationMs': 1000,
          'pendingCharacterKey': 22,
        },
      ),
      nowMs: 2000,
      source: 'app_resume',
      randomProvider: (_) => 1,
    );

    final Map<String, dynamic> updated = _decode(result.updatedRawWorldData);
    final List<dynamic> records = _monsterBookRecords(updated, 22);

    expect(result.hatched, isTrue);
    expect(result.selectedCharacterKey, 22);
    expect(result.monsterBookWriteOwner, 'flutter_lifecycle');
    expect(result.monsterBookChanged, isTrue);
    expect(_object(updated)['state'], config.characterStateIdle);
    expect(_characterStatus(updated)['characterKey'], 22);
    expect(records, hasLength(1));
    expect((records.single as Map<String, dynamic>)['source'], 'hatch');
  });

  test('진화 완료 시 이전 캐릭터를 보정하고 다음 캐릭터를 evolution으로 기록한다', () {
    final WorldDataLifecycleAdvanceResult result =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: _buildWorldData(
        characterKey: 2,
        evolutionPhase: 2,
        evolutionGage: 99.99,
        nextDiseaseCheckTime: 60 * 60 * 1000,
      ),
      nowMs: 60 * 1000,
      source: 'periodic_work',
      randomProvider: (WorldDataLifecycleRandomEvent event) {
        if (event.reason == 'evolution_mutation') {
          return 1;
        }
        if (event.reason == 'evolution') {
          return 0;
        }
        return 1;
      },
    );

    final Map<String, dynamic> updated = _decode(result.updatedRawWorldData);
    final List<dynamic> previousRecords = _monsterBookRecords(updated, 2);
    final List<dynamic> nextRecords = _monsterBookRecords(updated, 3);

    expect(result.evolutionDiagnostics.evolved, isTrue);
    expect(previousRecords, hasLength(1));
    expect(
        (previousRecords.single as Map<String, dynamic>)['source'], 'backfill');
    expect(nextRecords, hasLength(1));
    expect((nextRecords.single as Map<String, dynamic>)['source'], 'evolution');
  });

  test('기존 MonsterBookData는 Dart lifecycle 저장 시 보존/병합된다', () {
    final String dedicatedMonsterBook = jsonEncode(<String, dynamic>{
      'reached': <String, dynamic>{
        '1': <Map<String, dynamic>>[
          <String, dynamic>{
            'name': '기존',
            'reached_at': 100,
            'object_id': 1,
            'source': 'hatch',
          },
        ],
      },
    });

    final WorldDataLifecycleAdvanceResult result =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: _buildWorldData(
        characterKey: 2,
        evolutionPhase: 2,
        evolutionGage: 99.99,
        nextDiseaseCheckTime: 60 * 60 * 1000,
      ),
      rawMonsterBookData: dedicatedMonsterBook,
      nowMs: 60 * 1000,
      source: 'app_resume',
      randomProvider: (WorldDataLifecycleRandomEvent event) {
        if (event.reason == 'evolution_mutation') {
          return 1;
        }
        if (event.reason == 'evolution') {
          return 0;
        }
        return 1;
      },
    );

    final Map<String, dynamic> updated = _decode(result.updatedRawWorldData);
    expect(_monsterBookRecords(updated, 1), hasLength(1));
    expect(_monsterBookRecords(updated, 2), hasLength(1));
    expect(_monsterBookRecords(updated, 3), hasLength(1));
  });

  test('eating 중 장시간 이탈하면 Dart lifecycle이 음식 제거와 회복을 완료한다', () {
    final WorldDataLifecycleAdvanceResult result =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: _buildWorldData(
        state: config.characterStateEating,
        stamina: 2,
        nextDiseaseCheckTime: 60 * 60 * 1000,
        foodEating: <String, dynamic>{
          'targetFood': 1,
          'progress': 0.3125,
          'duration': worldDataLifecycleFoodEatingDurationMs,
          'elapsedTime': 1000,
          'isActive': true,
        },
        extraEntities: <Map<String, dynamic>>[
          _buildFoodEntity(
            state: worldDataLifecycleFoodStateBeingIntaken,
            textureKey: 405,
            foodMask: <String, dynamic>{
              'progress': 0.3125,
              'isInitialized': true,
            },
          ),
        ],
      ),
      nowMs: 3 * 1000,
      source: 'app_resume',
      randomProvider: (_) => 1,
    );

    final Map<String, dynamic> updated = _decode(result.updatedRawWorldData);
    final Map<String, dynamic> components = _components(updated);

    expect(_entities(updated), hasLength(1));
    expect((components['object'] as Map<String, dynamic>)['state'],
        config.characterStateIdle);
    expect(
        (components['characterStatus'] as Map<String, dynamic>)['stamina'], 6);
    expect(
        (components['digestiveSystem'] as Map<String, dynamic>)['currentLoad'],
        1.5);
    expect(components.containsKey('foodEating'), isFalse);
  });

  test('moving-to-food 중 충분히 이탈하면 이동과 섭취를 완료한다', () {
    final WorldDataLifecycleAdvanceResult result =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: _buildWorldData(
        state: config.characterStateMoving,
        stamina: 5,
        nextDiseaseCheckTime: 60 * 60 * 1000,
        position: <String, dynamic>{'x': 0, 'y': 0},
        speed: <String, dynamic>{'value': 0.01},
        destination: <String, dynamic>{
          'type': worldDataLifecycleDestinationTypeTargeted,
          'target': 1,
          'x': 10,
          'y': 0,
        },
        extraEntities: <Map<String, dynamic>>[
          _buildFoodEntity(
            state: worldDataLifecycleFoodStateTargeted,
            textureKey: 400,
            position: <String, dynamic>{'x': 12, 'y': 0},
          ),
        ],
      ),
      nowMs: 5 * 1000,
      source: 'app_resume',
      randomProvider: (_) => 1,
    );

    final Map<String, dynamic> updated = _decode(result.updatedRawWorldData);
    final Map<String, dynamic> components = _components(updated);

    expect(_entities(updated), hasLength(1));
    expect((components['object'] as Map<String, dynamic>)['state'],
        config.characterStateIdle);
    expect(
        (components['characterStatus'] as Map<String, dynamic>)['stamina'], 6);
    expect((components['position'] as Map<String, dynamic>)['x'], 10);
    expect(components.containsKey('destination'), isFalse);
  });

  test('완료까지 시간이 부족하면 eating pending 상태를 유지한다', () {
    final WorldDataLifecycleAdvanceResult result =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: _buildWorldData(
        state: config.characterStateEating,
        stamina: 2,
        nextDiseaseCheckTime: 60 * 60 * 1000,
        foodEating: <String, dynamic>{
          'targetFood': 1,
          'progress': 0.3125,
          'duration': worldDataLifecycleFoodEatingDurationMs,
          'elapsedTime': 1000,
          'isActive': true,
        },
        extraEntities: <Map<String, dynamic>>[
          _buildFoodEntity(
            state: worldDataLifecycleFoodStateBeingIntaken,
            foodMask: <String, dynamic>{
              'progress': 0.3125,
              'isInitialized': true,
            },
          ),
        ],
      ),
      nowMs: 1000,
      source: 'app_resume',
      randomProvider: (_) => 1,
    );

    final Map<String, dynamic> updated = _decode(result.updatedRawWorldData);
    final Map<String, dynamic> characterComponents = _components(updated);
    final Map<String, dynamic> foodComponents = _entityComponentsAt(updated, 1);
    final Map<String, dynamic> foodEating =
        characterComponents['foodEating'] as Map<String, dynamic>;
    final Map<String, dynamic> foodMask =
        foodComponents['foodMask'] as Map<String, dynamic>;

    expect(_entities(updated), hasLength(2));
    expect((characterComponents['object'] as Map<String, dynamic>)['state'],
        config.characterStateEating);
    expect((foodComponents['object'] as Map<String, dynamic>)['state'],
        worldDataLifecycleFoodStateBeingIntaken);
    expect(foodEating['elapsedTime'], 2000);
    expect(foodEating['progress'], closeTo(0.625, 1e-12));
    expect(foodMask['progress'], closeTo(0.625, 1e-12));
  });

  test('last_ecs_saved, last_active_time, authoritative snapshot이 갱신된다', () {
    final WorldDataLifecycleAdvanceResult result =
        WorldDataLifecycleService.advanceWorldData(
      rawWorldData: _buildWorldData(),
      nowMs: 123456,
      source: 'app_resume',
      randomProvider: (_) => 1,
    );
    final Map<String, dynamic> updated = _decode(result.updatedRawWorldData);
    final Map<String, dynamic> metadata =
        updated['world_metadata'] as Map<String, dynamic>;
    final Map<String, dynamic> appState =
        metadata['app_state'] as Map<String, dynamic>;

    expect(metadata['last_ecs_saved'], 123456);
    expect(appState['last_active_time'], 123456);
    expect(appState.containsKey('last_active_time_anchor'), isFalse);
    expect(result.authoritativeSnapshot, isNotNull);
    expect(result.authoritativeSnapshot!.updatedAtMs, 123456);
  });
}

import 'dart:convert';
import 'dart:math' as math;

import '../home_widget/world_data_config.dart' as config;
import '../home_widget/world_data_sync_service.dart';
import 'world_data_evolution_specs.dart';
import 'world_data_monster_book_service.dart';

const int worldDataLifecycleMinTickMs = 1000;
const int worldDataLifecycleMaxTickMs = 60 * 1000;
const int worldDataLifecycleDiseaseCheckIntervalMs = 10 * 1000;
const double worldDataLifecycleBaseDiseaseRate = 0.0001862601875783909;
const double worldDataLifecycleLowStaminaDiseaseBonus = 0.000093;
const double worldDataLifecycleVeryLowStaminaDiseaseBonus = 0.000186;
const double worldDataLifecyclePoopDiseaseRate = 0.000093;
const double worldDataLifecycleStaleFoodDiseaseRate = 0.000093;
const double worldDataLifecycleSleepingDiseaseRateMultiplier = 0.1;
const int worldDataLifecyclePoopObjectType = 4;
const int worldDataLifecycleFoodObjectType = 3;
const int worldDataLifecycleFoodFreshnessStale = 3;
const int worldDataLifecycleFoodStateBeingThrowing = 1;
const double worldDataLifecycleVeryLowStaminaThreshold = 1.5;
const double worldDataLifecycleEvolutionMaxGauge = 100;
const int worldDataLifecycleEvolutionCheckIntervalMs = 10 * 1000;
const double worldDataLifecycleEvolutionGaugeGainMultiplier = 1.1;
const double worldDataLifecycleSleepingEvolutionTimeMultiplier = 1 / 3;
const double worldDataLifecycleBoostedEvolutionGaugeGainMultiplier = 1.2;
const int worldDataLifecycleTextureKeyNull = 0;
const int worldDataLifecycleAnimationKeyIdle = 1;
const double worldDataLifecycleFatigueMax = 100;
const double worldDataLifecycleFatigueDefault = 35;
const double worldDataLifecycleFatigueAwakeGainPerHour = 9.5;
const double worldDataLifecycleFatigueSleepRecoveryPerHour = 12;
const double worldDataLifecycleFatigueSleepRecoveryPerHourWhenSick = 6;
const double worldDataLifecycleDayNapChance = 0.07;
const int worldDataLifecycleDayNapCheckIntervalMs = 20 * 60 * 1000;
const int worldDataLifecycleDayNapMinDurationMs = 30 * 60 * 1000;
const int worldDataLifecycleDayNapMaxDurationMs = 90 * 60 * 1000;
const double worldDataLifecycleFatigueDayNapMinThreshold = 55;
const double worldDataLifecycleFatigueDayNapWakeThreshold = 48;
const int worldDataLifecycleSleepModeAwake = 0;
const int worldDataLifecycleSleepModeNightSleep = 1;
const int worldDataLifecycleSleepModeDayNap = 2;
const int worldDataLifecycleSleepReasonNone = 0;
const int worldDataLifecycleSleepReasonNap = 3;
const int worldDataLifecycleEggHatchMaxBonusCount = 10;
const int worldDataLifecycleEggHatchBaseGreenPercent = 65;
const int worldDataLifecycleEggHatchBaseSoilPercent = 20;
const int worldDataLifecycleEggHatchBaseSkullPercent = 15;
const int worldDataLifecycleEggHatchBonusPerCountPercent = 2;
const int worldDataLifecycleGreenSlimeA1CharacterKey = 1;
const int worldDataLifecycleSkullSlimeA1CharacterKey = 14;
const int worldDataLifecycleSoilSlimeA1CharacterKey = 22;
const String worldDataLifecycleDefaultCompletedStatus =
    'flutter_world_data_update_completed';
const String worldDataLifecycleForegroundHatchSource = 'foreground_hatch';
const String worldDataLifecycleWidgetPeriodicRefreshSource =
    'widget_periodic_refresh';

class WorldDataLifecycleRandomEvent {
  final int objectId;
  final int checkTimeMs;
  final String reason;
  final int checkCount;
  final double perCheckProbability;
  final double aggregatedProbability;

  const WorldDataLifecycleRandomEvent({
    required this.objectId,
    required this.checkTimeMs,
    required this.reason,
    this.checkCount = 1,
    this.perCheckProbability = 0,
    this.aggregatedProbability = 0,
  });
}

typedef WorldDataLifecycleRandomProvider = double Function(
  WorldDataLifecycleRandomEvent event,
);

class WorldDataLifecycleEvolutionDiagnostics {
  final double? evolutionGageBefore;
  final double? evolutionGageAfter;
  final bool evolutionGageIncreased;
  final bool evolved;
  final int? previousCharacterKey;
  final int? nextCharacterKey;
  final int? previousEvolutionPhase;
  final int? nextEvolutionPhase;
  final String? candidateKind;
  final bool mutationApplied;
  final double? mutationRate;
  final double? mutationRoll;
  final double? mutationTargetRoll;
  final double? evolutionRoll;
  final String blockReason;

  const WorldDataLifecycleEvolutionDiagnostics({
    required this.evolutionGageBefore,
    required this.evolutionGageAfter,
    required this.evolutionGageIncreased,
    this.evolved = false,
    this.previousCharacterKey,
    this.nextCharacterKey,
    this.previousEvolutionPhase,
    this.nextEvolutionPhase,
    this.candidateKind,
    this.mutationApplied = false,
    this.mutationRate,
    this.mutationRoll,
    this.mutationTargetRoll,
    this.evolutionRoll,
    required this.blockReason,
  });

  Map<String, Object?> toJson() => <String, Object?>{
        'evolutionGageBefore': evolutionGageBefore,
        'evolutionGageAfter': evolutionGageAfter,
        'evolutionGageIncreased': evolutionGageIncreased,
        'evolved': evolved,
        'previousCharacterKey': previousCharacterKey,
        'nextCharacterKey': nextCharacterKey,
        'previousEvolutionPhase': previousEvolutionPhase,
        'nextEvolutionPhase': nextEvolutionPhase,
        'candidateKind': candidateKind,
        'mutationApplied': mutationApplied,
        'mutationRate': mutationRate,
        'mutationRoll': mutationRoll,
        'mutationTargetRoll': mutationTargetRoll,
        'evolutionRoll': evolutionRoll,
        'blockReason': blockReason,
      };
}

class WorldDataLifecycleAdvanceResult {
  final String status;
  final String source;
  final String updatedRawWorldData;
  final WorldDataSnapshot? authoritativeSnapshot;
  final int previousLastEcsSaved;
  final int nowMs;
  final int elapsedMs;
  final int tickCount;
  final List<int> tickDurationsMs;
  final bool diseaseOccurred;
  final int diseaseCheckCount;
  final double? lastDiseasePerCheckProbability;
  final double? lastDiseaseAggregatedProbability;
  final bool dayNapOccurred;
  final int dayNapCheckCount;
  final double? lastDayNapPerCheckProbability;
  final double? lastDayNapAggregatedProbability;
  final bool worldDataChanged;
  final int? previousCharacterState;
  final int? nextCharacterState;
  final WorldDataLifecycleEvolutionDiagnostics evolutionDiagnostics;
  final bool hatched;
  final int? selectedCharacterKey;
  final Map<String, Object?>? hatchSelectionDiagnostics;
  final bool monsterBookChanged;
  final String monsterBookWriteOwner;

  const WorldDataLifecycleAdvanceResult({
    required this.status,
    required this.source,
    required this.updatedRawWorldData,
    required this.authoritativeSnapshot,
    required this.previousLastEcsSaved,
    required this.nowMs,
    required this.elapsedMs,
    required this.tickCount,
    required this.tickDurationsMs,
    required this.diseaseOccurred,
    required this.diseaseCheckCount,
    required this.lastDiseasePerCheckProbability,
    required this.lastDiseaseAggregatedProbability,
    required this.dayNapOccurred,
    required this.dayNapCheckCount,
    required this.lastDayNapPerCheckProbability,
    required this.lastDayNapAggregatedProbability,
    required this.worldDataChanged,
    required this.previousCharacterState,
    required this.nextCharacterState,
    required this.evolutionDiagnostics,
    required this.hatched,
    required this.selectedCharacterKey,
    required this.hatchSelectionDiagnostics,
    required this.monsterBookChanged,
    this.monsterBookWriteOwner = worldDataMonsterBookWriteOwner,
  });

  String? get snapshotJson => authoritativeSnapshot == null
      ? null
      : jsonEncode(authoritativeSnapshot!.toJson());

  Map<String, Object?> toMap({bool includeWorldData = true}) {
    return <String, Object?>{
      'status': status,
      'source': source,
      'updatedRawWorldData': includeWorldData ? updatedRawWorldData : null,
      'hasUpdatedRawWorldData': updatedRawWorldData.isNotEmpty,
      'hasSnapshot': authoritativeSnapshot != null,
      'worldDataChanged': worldDataChanged,
      'hatched': hatched,
      'selectedCharacterKey': selectedCharacterKey,
      'hatchSelectionDiagnostics': hatchSelectionDiagnostics,
      'monsterBookChanged': monsterBookChanged,
      'monsterBookWriteOwner': monsterBookWriteOwner,
      'previousCharacterState': previousCharacterState,
      'nextCharacterState': nextCharacterState,
      'elapsedMs': elapsedMs,
      'tickCount': tickCount,
      'tickDurationsMs': tickDurationsMs,
      'diseaseOccurred': diseaseOccurred,
      'diseaseCheckCount': diseaseCheckCount,
      'lastDiseasePerCheckProbability': lastDiseasePerCheckProbability,
      'lastDiseaseAggregatedProbability': lastDiseaseAggregatedProbability,
      'dayNapOccurred': dayNapOccurred,
      'dayNapCheckCount': dayNapCheckCount,
      'lastDayNapPerCheckProbability': lastDayNapPerCheckProbability,
      'lastDayNapAggregatedProbability': lastDayNapAggregatedProbability,
      'evolutionDiagnostics': evolutionDiagnostics.toJson(),
      'evolutionGageBefore': evolutionDiagnostics.evolutionGageBefore,
      'evolutionGageAfter': evolutionDiagnostics.evolutionGageAfter,
      'evolutionGageIncreased': evolutionDiagnostics.evolutionGageIncreased,
      'evolved': evolutionDiagnostics.evolved,
      'previousCharacterKey': evolutionDiagnostics.previousCharacterKey,
      'nextCharacterKey': evolutionDiagnostics.nextCharacterKey,
      'previousEvolutionPhase': evolutionDiagnostics.previousEvolutionPhase,
      'nextEvolutionPhase': evolutionDiagnostics.nextEvolutionPhase,
      'candidateKind': evolutionDiagnostics.candidateKind,
      'mutationApplied': evolutionDiagnostics.mutationApplied,
      'mutationRate': evolutionDiagnostics.mutationRate,
      'mutationRoll': evolutionDiagnostics.mutationRoll,
      'mutationTargetRoll': evolutionDiagnostics.mutationTargetRoll,
      'evolutionRoll': evolutionDiagnostics.evolutionRoll,
      'evolutionBlockReason': evolutionDiagnostics.blockReason,
    };
  }
}

class WorldDataLifecycleService {
  const WorldDataLifecycleService._();

  static WorldDataLifecycleAdvanceResult advanceWorldData({
    required String rawWorldData,
    required int nowMs,
    required String source,
    String? rawMonsterBookData,
    WorldDataLifecycleRandomProvider randomProvider =
        deterministicRandomProvider,
  }) {
    final Object decoded = jsonDecode(rawWorldData);
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException('world_data_must_be_object');
    }

    final Map<String, dynamic> worldData = _deepCopyMap(decoded);
    final Map<String, dynamic> worldMetadata = _ensureMap(
      worldData,
      'world_metadata',
    );
    final Map<String, dynamic> appState =
        _ensureMap(worldMetadata, 'app_state');
    final String monsterName = _readString(worldMetadata['monster_name']) ?? '';
    appState['monster_book'] = WorldDataMonsterBookService.mergeStates(
      appState['monster_book'],
      WorldDataMonsterBookService.decodeState(rawMonsterBookData),
    );
    final String previousMonsterBookJson = jsonEncode(
      WorldDataMonsterBookService.normalizeState(appState['monster_book']),
    );
    final List<dynamic> entities = _ensureList(worldData, 'entities');
    final _MutableCharacterSource? character = _findMainCharacter(entities);
    final int previousLastEcsSaved =
        _readInt(worldMetadata['last_ecs_saved']) ?? nowMs;
    final int elapsedMs = math.max(0, nowMs - previousLastEcsSaved);
    final int? previousCharacterState = character?.state;

    bool changed = previousLastEcsSaved != nowMs;
    bool diseaseOccurred = false;
    int totalDiseaseCheckCount = 0;
    double? lastDiseasePerCheckProbability;
    double? lastDiseaseAggregatedProbability;
    bool dayNapOccurred = false;
    int totalDayNapCheckCount = 0;
    double? lastDayNapPerCheckProbability;
    double? lastDayNapAggregatedProbability;
    WorldDataLifecycleEvolutionDiagnostics evolutionDiagnostics =
        _buildEvolutionDiagnostics(character, blockReason: 'no_character');
    final List<int> tickDurationsMs = _buildTickDurations(elapsedMs);
    int cursorMs = previousLastEcsSaved;
    bool hatched = false;
    int? selectedCharacterKey;
    Map<String, Object?>? hatchSelectionDiagnostics;

    if (character != null) {
      changed = _syncSickStatusFromState(character) || changed;
      final _HatchProgressResult hatchResult = _progressHatchIfReady(
        character: character,
        entities: entities,
        appState: appState,
        monsterName: monsterName,
        nowMs: nowMs,
        randomProvider: randomProvider,
      );
      changed = hatchResult.changed || changed;
      hatched = hatchResult.hatched;
      selectedCharacterKey = hatchResult.selectedCharacterKey;
      hatchSelectionDiagnostics = hatchResult.selectionDiagnostics;

      for (final int tickDurationMs in tickDurationsMs) {
        final _TickProgressResult tickResult = _progressTick(
          character: character,
          entities: entities,
          appState: appState,
          monsterName: monsterName,
          tickStartMs: cursorMs,
          tickDurationMs: tickDurationMs,
          evolutionAlreadyApplied: evolutionDiagnostics.evolved,
          randomProvider: randomProvider,
        );
        changed = tickResult.changed || changed;
        diseaseOccurred = tickResult.diseaseOccurred || diseaseOccurred;
        totalDiseaseCheckCount += tickResult.diseaseCheckCount;
        lastDiseasePerCheckProbability =
            tickResult.lastDiseasePerCheckProbability ??
                lastDiseasePerCheckProbability;
        lastDiseaseAggregatedProbability =
            tickResult.lastDiseaseAggregatedProbability ??
                lastDiseaseAggregatedProbability;
        dayNapOccurred = tickResult.dayNapOccurred || dayNapOccurred;
        totalDayNapCheckCount += tickResult.dayNapCheckCount;
        lastDayNapPerCheckProbability =
            tickResult.lastDayNapPerCheckProbability ??
                lastDayNapPerCheckProbability;
        lastDayNapAggregatedProbability =
            tickResult.lastDayNapAggregatedProbability ??
                lastDayNapAggregatedProbability;
        if (tickResult.evolutionDiagnostics.evolved ||
            !evolutionDiagnostics.evolved) {
          evolutionDiagnostics = tickResult.evolutionDiagnostics;
        }
        cursorMs += tickDurationMs;
      }
    }

    worldMetadata['last_ecs_saved'] = nowMs;
    appState['last_active_time'] = nowMs;
    appState.remove('last_active_time_anchor');
    appState['monster_book'] = WorldDataMonsterBookService.normalizeState(
      appState['monster_book'],
    );
    final bool monsterBookChanged =
        previousMonsterBookJson != jsonEncode(appState['monster_book']);

    final String updatedRawWorldData = jsonEncode(worldData);
    final WorldDataSnapshot? snapshot =
        WorldDataSyncService.buildSnapshotFromWorldDataJson(
      updatedRawWorldData,
      now: DateTime.fromMillisecondsSinceEpoch(nowMs),
    );

    return WorldDataLifecycleAdvanceResult(
      status: worldDataLifecycleDefaultCompletedStatus,
      source: source,
      updatedRawWorldData: updatedRawWorldData,
      authoritativeSnapshot: snapshot,
      previousLastEcsSaved: previousLastEcsSaved,
      nowMs: nowMs,
      elapsedMs: elapsedMs,
      tickCount: tickDurationsMs.length,
      tickDurationsMs: tickDurationsMs,
      diseaseOccurred: diseaseOccurred,
      diseaseCheckCount: totalDiseaseCheckCount,
      lastDiseasePerCheckProbability: lastDiseasePerCheckProbability,
      lastDiseaseAggregatedProbability: lastDiseaseAggregatedProbability,
      dayNapOccurred: dayNapOccurred,
      dayNapCheckCount: totalDayNapCheckCount,
      lastDayNapPerCheckProbability: lastDayNapPerCheckProbability,
      lastDayNapAggregatedProbability: lastDayNapAggregatedProbability,
      worldDataChanged: changed,
      previousCharacterState: previousCharacterState,
      nextCharacterState: character?.state,
      evolutionDiagnostics: evolutionDiagnostics,
      hatched: hatched,
      selectedCharacterKey: selectedCharacterKey,
      hatchSelectionDiagnostics: hatchSelectionDiagnostics,
      monsterBookChanged: monsterBookChanged,
    );
  }

  static double aggregateProbability({
    required double perCheckProbability,
    required int checkCount,
  }) {
    if (checkCount <= 0 || perCheckProbability <= 0) {
      return 0;
    }
    if (perCheckProbability >= 1) {
      return 1;
    }
    return 1 - math.pow(1 - perCheckProbability, checkCount).toDouble();
  }

  static List<int> resolveBackgroundTickDurationsForTest(int elapsedMs) =>
      _buildTickDurations(elapsedMs);

  static List<int> _buildTickDurations(int elapsedMs) {
    if (elapsedMs < worldDataLifecycleMinTickMs) {
      return const <int>[];
    }
    final List<int> durations = <int>[];
    int remainingMs = elapsedMs;
    while (remainingMs >= worldDataLifecycleMinTickMs) {
      final int durationMs = math.min(
        worldDataLifecycleMaxTickMs,
        remainingMs,
      );
      durations.add(durationMs);
      remainingMs -= durationMs;
    }
    return durations;
  }

  static _TickProgressResult _progressTick({
    required _MutableCharacterSource character,
    required List<dynamic> entities,
    required Map<String, dynamic> appState,
    required String monsterName,
    required int tickStartMs,
    required int tickDurationMs,
    required bool evolutionAlreadyApplied,
    required WorldDataLifecycleRandomProvider randomProvider,
  }) {
    bool changed = false;

    final double previousStamina = character.stamina ?? config.maxStamina;
    final _StaminaProgressResult staminaResult = _progressStamina(
      stamina: previousStamina,
      staminaTimerMs: character.staminaTimerMs,
      characterState: character.state,
      deltaMs: tickDurationMs.toDouble(),
    );
    character.staminaTimerMs = staminaResult.staminaTimerMs;
    if (staminaResult.stamina != previousStamina) {
      character.characterStatus['stamina'] = staminaResult.stamina;
      changed = true;
    }

    final _SleepProgressResult sleepResult = _progressSleepBeforeRandomChecks(
      character: character,
      appState: appState,
      tickEndMs: tickStartMs + tickDurationMs,
      tickDurationMs: tickDurationMs,
    );
    changed = sleepResult.changed || changed;

    final WorldDataLifecycleEvolutionDiagnostics evolutionDiagnostics =
        _progressEvolution(
      character: character,
      entities: entities,
      appState: appState,
      monsterName: monsterName,
      nowMs: tickStartMs + tickDurationMs,
      elapsedMs: tickDurationMs,
      evolutionAlreadyApplied: evolutionAlreadyApplied,
      randomProvider: randomProvider,
    );
    changed = evolutionDiagnostics.evolutionGageIncreased ||
        evolutionDiagnostics.evolved ||
        changed;

    final _ProbabilityProgressResult dayNapResult = _progressDayNapAtTickEnd(
      character: character,
      appState: appState,
      tickEndMs: tickStartMs + tickDurationMs,
      randomProvider: randomProvider,
    );
    changed = dayNapResult.changed || changed;

    final _ProbabilityProgressResult diseaseResult = _progressDiseaseAtTickEnd(
      character: character,
      entities: entities,
      tickEndMs: tickStartMs + tickDurationMs,
      randomProvider: randomProvider,
    );
    changed = diseaseResult.changed || changed;

    return _TickProgressResult(
      changed: changed,
      diseaseOccurred: diseaseResult.occurred,
      diseaseCheckCount: diseaseResult.checkCount,
      lastDiseasePerCheckProbability: diseaseResult.perCheckProbability,
      lastDiseaseAggregatedProbability: diseaseResult.aggregatedProbability,
      dayNapOccurred: dayNapResult.occurred,
      dayNapCheckCount: dayNapResult.checkCount,
      lastDayNapPerCheckProbability: dayNapResult.perCheckProbability,
      lastDayNapAggregatedProbability: dayNapResult.aggregatedProbability,
      evolutionDiagnostics: evolutionDiagnostics,
    );
  }

  static _HatchProgressResult _progressHatchIfReady({
    required _MutableCharacterSource character,
    required List<dynamic> entities,
    required Map<String, dynamic> appState,
    required String monsterName,
    required int nowMs,
    required WorldDataLifecycleRandomProvider randomProvider,
  }) {
    if (character.state != config.characterStateEgg) {
      return const _HatchProgressResult();
    }

    final int? hatchTimeMs = _readInt(character.eggHatch['hatchTime']);
    if (hatchTimeMs == null || hatchTimeMs <= 0 || nowMs < hatchTimeMs) {
      return const _HatchProgressResult();
    }

    final _EggHatchSelection selection = _resolveEggHatchSelection(
      character: character,
      entities: entities,
      hatchTimeMs: hatchTimeMs,
      randomProvider: randomProvider,
    );
    _applyHatch(
      character: character,
      selectedCharacterKey: selection.selectedCharacterKey,
    );
    final Map<String, dynamic> monsterBook =
        WorldDataMonsterBookService.ensureState(appState);
    WorldDataMonsterBookService.recordReach(
      monsterBook: monsterBook,
      characterKey: selection.selectedCharacterKey,
      name: monsterName,
      reachedAt: nowMs,
      objectId: character.objectId ?? 0,
      source: 'hatch',
      onlyIfMissing: false,
    );

    return _HatchProgressResult(
      changed: true,
      hatched: true,
      selectedCharacterKey: selection.selectedCharacterKey,
      selectionDiagnostics: selection.toJson(),
    );
  }

  static _EggHatchSelection _resolveEggHatchSelection({
    required _MutableCharacterSource character,
    required List<dynamic> entities,
    required int hatchTimeMs,
    required WorldDataLifecycleRandomProvider randomProvider,
  }) {
    final int staleFoodCountAtHatch = _countStaleFood(entities);
    final int syringeCount = _normalizeEggHatchBonusCount(
        _readInt(character.eggHatch['syringeCount']) ?? 0);
    final _EggHatchProbabilities probabilities =
        _calculateEggHatchProbabilities(
      staleFoodCountAtHatch: staleFoodCountAtHatch,
      syringeCount: syringeCount,
    );
    final int? pendingCharacterKey = _normalizePendingEggHatchCharacterKey(
      _readInt(character.eggHatch['pendingCharacterKey']),
    );

    if (pendingCharacterKey != null) {
      return _EggHatchSelection(
        staleFoodCountAtHatch: staleFoodCountAtHatch,
        syringeCount: syringeCount,
        normalizedStaleFoodCountAtHatch:
            probabilities.normalizedStaleFoodCountAtHatch,
        normalizedSyringeCount: probabilities.normalizedSyringeCount,
        random: null,
        normalizedRandom: null,
        rollPercent: null,
        greenProbability: probabilities.green,
        soilProbability: probabilities.soil,
        skullProbability: probabilities.skull,
        selectedCharacterKey: pendingCharacterKey,
        usedPendingCharacterKey: true,
      );
    }

    final double random = _normalizeRandom(
      randomProvider(
        WorldDataLifecycleRandomEvent(
          objectId: character.objectId ?? 0,
          checkTimeMs: hatchTimeMs,
          reason: 'hatch',
        ),
      ),
    );
    final double rollPercent = random * 100;
    final int selectedCharacterKey = rollPercent < probabilities.green
        ? worldDataLifecycleGreenSlimeA1CharacterKey
        : rollPercent < probabilities.green + probabilities.soil
            ? worldDataLifecycleSoilSlimeA1CharacterKey
            : worldDataLifecycleSkullSlimeA1CharacterKey;

    return _EggHatchSelection(
      staleFoodCountAtHatch: staleFoodCountAtHatch,
      syringeCount: syringeCount,
      normalizedStaleFoodCountAtHatch:
          probabilities.normalizedStaleFoodCountAtHatch,
      normalizedSyringeCount: probabilities.normalizedSyringeCount,
      random: random,
      normalizedRandom: random,
      rollPercent: rollPercent,
      greenProbability: probabilities.green,
      soilProbability: probabilities.soil,
      skullProbability: probabilities.skull,
      selectedCharacterKey: selectedCharacterKey,
      usedPendingCharacterKey: false,
    );
  }

  static void _applyHatch({
    required _MutableCharacterSource character,
    required int selectedCharacterKey,
  }) {
    character.object['state'] = config.characterStateIdle;
    character.characterStatus['characterKey'] = selectedCharacterKey;
    character.characterStatus['evolutionPhase'] = 1;
    character.eggHatch['hatchTime'] = 0;
    character.eggHatch['hatchDurationMs'] = 0;
    character.eggHatch['isReadyToHatch'] = false;
    character.eggHatch['syringeCount'] = 0;
    character.eggHatch['pendingCharacterKey'] = 0;

    final Map<String, dynamic> render =
        _ensureMap(character.components, 'render');
    render['storeIndex'] = worldDataLifecycleTextureKeyNull;
    render['textureKey'] = worldDataLifecycleTextureKeyNull;

    final Map<String, dynamic> animationRender =
        _ensureMap(character.components, 'animationRender');
    animationRender['storeIndex'] = worldDataLifecycleTextureKeyNull;
    animationRender['spritesheetKey'] = selectedCharacterKey;
    animationRender['animationKey'] = worldDataLifecycleAnimationKeyIdle;
    animationRender['isPlaying'] = true;
    animationRender['loop'] = true;
    animationRender['speed'] = 0.04;
  }

  static _SleepProgressResult _progressSleepBeforeRandomChecks({
    required _MutableCharacterSource character,
    required Map<String, dynamic> appState,
    required int tickEndMs,
    required int tickDurationMs,
  }) {
    final int? state = character.state;
    if (state == config.characterStateEgg ||
        state == config.characterStateDead) {
      return const _SleepProgressResult();
    }

    bool changed = false;
    final double previousFatigue = character.fatigue;
    final double nextFatigue = _progressFatigue(
      fatigue: previousFatigue,
      isSleeping: state == config.characterStateSleeping,
      isSick: character.statuses.contains(config.characterStatusSick),
      elapsedMs: tickDurationMs,
    );
    if (nextFatigue != previousFatigue) {
      character.sleepSystem['fatigue'] = nextFatigue;
      changed = true;
    }

    changed = _handleScheduledWake(character, tickEndMs) || changed;
    changed = _handleScheduledSleep(character, tickEndMs) || changed;
    changed = _handleNapWake(character, tickEndMs) || changed;

    return _SleepProgressResult(changed: changed);
  }

  static _ProbabilityProgressResult _progressDayNapAtTickEnd({
    required _MutableCharacterSource character,
    required Map<String, dynamic> appState,
    required int tickEndMs,
    required WorldDataLifecycleRandomProvider randomProvider,
  }) {
    if (_resolveTimeOfDay(tickEndMs: tickEndMs, appState: appState) != 'day' ||
        character.state == config.characterStateSleeping ||
        (WorldDataLifecycleService._readInt(
                    character.sleepSystem['nextSleepTime']) ??
                0) >
            0 ||
        character.fatigue < worldDataLifecycleFatigueDayNapMinThreshold) {
      return const _ProbabilityProgressResult();
    }

    int? nextNapCheckTime = _readInt(character.sleepSystem['nextNapCheckTime']);
    if (nextNapCheckTime == null || nextNapCheckTime <= 0) {
      character.sleepSystem['nextNapCheckTime'] =
          tickEndMs + worldDataLifecycleDayNapCheckIntervalMs;
      return const _ProbabilityProgressResult(changed: true);
    }
    if (tickEndMs < nextNapCheckTime) {
      return const _ProbabilityProgressResult();
    }

    int checkCount = 0;
    while (tickEndMs >= nextNapCheckTime!) {
      checkCount += 1;
      nextNapCheckTime += worldDataLifecycleDayNapCheckIntervalMs;
    }
    character.sleepSystem['nextNapCheckTime'] = nextNapCheckTime;

    final double fatigueRatio =
        (character.fatigue / worldDataLifecycleFatigueMax)
            .clamp(0, 1)
            .toDouble();
    final double perCheckProbability =
        math.min(1, worldDataLifecycleDayNapChance * (0.5 + fatigueRatio));
    final double aggregatedProbability = aggregateProbability(
      perCheckProbability: perCheckProbability,
      checkCount: checkCount,
    );
    final bool occurred = _rollAggregatedProbability(
      objectId: character.objectId ?? 0,
      checkTimeMs: tickEndMs,
      reason: 'day_nap',
      checkCount: checkCount,
      perCheckProbability: perCheckProbability,
      aggregatedProbability: aggregatedProbability,
      randomProvider: randomProvider,
    );

    if (occurred) {
      character.sleepSystem['nextSleepTime'] = tickEndMs;
      character.sleepSystem['pendingSleepReason'] =
          worldDataLifecycleSleepReasonNap;
      if (_canEnterSleep(character)) {
        _enterSleep(character, tickEndMs, worldDataLifecycleSleepModeDayNap);
      }
    }

    return _ProbabilityProgressResult(
      changed: true,
      occurred: occurred,
      checkCount: checkCount,
      perCheckProbability: perCheckProbability,
      aggregatedProbability: aggregatedProbability,
    );
  }

  static WorldDataLifecycleEvolutionDiagnostics _progressEvolution({
    required _MutableCharacterSource character,
    required List<dynamic> entities,
    required Map<String, dynamic> appState,
    required String monsterName,
    required int nowMs,
    required int elapsedMs,
    required bool evolutionAlreadyApplied,
    required WorldDataLifecycleRandomProvider randomProvider,
  }) {
    if (evolutionAlreadyApplied) {
      return _buildEvolutionDiagnostics(
        character,
        blockReason: 'already_evolved',
      );
    }
    if (elapsedMs <= 0) {
      return _buildEvolutionDiagnostics(
        character,
        blockReason: 'elapsed_below_interval',
      );
    }
    final int? state = character.state;
    if (state == config.characterStateEgg) {
      return _buildEvolutionDiagnostics(character, blockReason: 'egg');
    }
    if (state == config.characterStateDead) {
      return _buildEvolutionDiagnostics(character, blockReason: 'dead');
    }
    if (state == config.characterStateSick ||
        character.statuses.contains(config.characterStatusSick)) {
      return _buildEvolutionDiagnostics(character, blockReason: 'sick');
    }

    final double stamina = character.stamina ?? config.maxStamina;
    if (stamina < config.lowStaminaThreshold) {
      return _buildEvolutionDiagnostics(character, blockReason: 'low_stamina');
    }

    final int? characterKey = character.characterKey;
    final WorldDataEvolutionSpec? spec = worldDataEvolutionSpecs[characterKey];
    if (spec == null || spec.candidates.isEmpty) {
      return _buildEvolutionDiagnostics(character, blockReason: 'terminal');
    }

    final double effectiveElapsedMs = elapsedMs *
        (state == config.characterStateSleeping
            ? worldDataLifecycleSleepingEvolutionTimeMultiplier
            : 1);
    final int increaseCount =
        (effectiveElapsedMs / worldDataLifecycleEvolutionCheckIntervalMs)
            .floor();
    if (increaseCount <= 0) {
      return _buildEvolutionDiagnostics(
        character,
        blockReason: 'elapsed_below_interval',
      );
    }

    final double currentGauge = character.evolutionGage ?? 0;
    final double baseGain = _resolveEvolutionGaugeGain(
      classCode: spec.classCode,
      objectId: character.objectId ?? 0,
      phase: spec.phase,
    );
    final double gaugeGain = stamina >= config.boostedStaminaThreshold
        ? baseGain * worldDataLifecycleBoostedEvolutionGaugeGainMultiplier
        : baseGain;
    final double nextGauge = math.min(
      worldDataLifecycleEvolutionMaxGauge,
      currentGauge + gaugeGain * increaseCount,
    );
    if (nextGauge == currentGauge) {
      return _buildEvolutionDiagnostics(character, blockReason: 'none');
    }

    character.characterStatus['evolutionGage'] = nextGauge;
    if (nextGauge >= worldDataLifecycleEvolutionMaxGauge) {
      final _EvolutionSelection selection = _resolveEvolutionSelection(
        character: character,
        entities: entities,
        currentSpec: spec,
        nowMs: nowMs,
        randomProvider: randomProvider,
      );
      final WorldDataEvolutionCandidate? candidate = selection.candidate;
      if (candidate == null) {
        return WorldDataLifecycleEvolutionDiagnostics(
          evolutionGageBefore: currentGauge,
          evolutionGageAfter: character.evolutionGage,
          evolutionGageIncreased: true,
          mutationApplied: false,
          mutationRate: selection.mutationRate,
          mutationRoll: selection.mutationRoll,
          mutationTargetRoll: selection.mutationTargetRoll,
          evolutionRoll: selection.evolutionRoll,
          blockReason: 'no_candidate',
        );
      }

      final int previousCharacterKey = character.characterKey ?? 0;
      final int previousEvolutionPhase =
          _readInt(character.characterStatus['evolutionPhase']) ?? spec.phase;
      final Map<String, dynamic> monsterBook =
          WorldDataMonsterBookService.ensureState(appState);
      WorldDataMonsterBookService.recordReach(
        monsterBook: monsterBook,
        characterKey: previousCharacterKey,
        name: monsterName,
        reachedAt: nowMs,
        objectId: character.objectId ?? 0,
        source: 'backfill',
        onlyIfMissing: true,
      );
      _applyEvolution(
        character: character,
        currentSpec: spec,
        candidate: candidate,
      );
      WorldDataMonsterBookService.recordReach(
        monsterBook: monsterBook,
        characterKey: candidate.to,
        name: monsterName,
        reachedAt: nowMs,
        objectId: character.objectId ?? 0,
        source: 'evolution',
        onlyIfMissing: false,
      );
      return WorldDataLifecycleEvolutionDiagnostics(
        evolutionGageBefore: currentGauge,
        evolutionGageAfter: character.evolutionGage,
        evolutionGageIncreased: true,
        evolved: true,
        previousCharacterKey: previousCharacterKey,
        nextCharacterKey: candidate.to,
        previousEvolutionPhase: previousEvolutionPhase,
        nextEvolutionPhase:
            _readInt(character.characterStatus['evolutionPhase']),
        candidateKind: candidate.kind,
        mutationApplied: candidate.kind == evolutionCandidateKindCrossLine,
        mutationRate: selection.mutationRate,
        mutationRoll: selection.mutationRoll,
        mutationTargetRoll: selection.mutationTargetRoll,
        evolutionRoll: selection.evolutionRoll,
        blockReason: 'none',
      );
    }

    return WorldDataLifecycleEvolutionDiagnostics(
      evolutionGageBefore: currentGauge,
      evolutionGageAfter: nextGauge,
      evolutionGageIncreased: true,
      blockReason: 'none',
    );
  }

  static _EvolutionSelection _resolveEvolutionSelection({
    required _MutableCharacterSource character,
    required List<dynamic> entities,
    required WorldDataEvolutionSpec currentSpec,
    required int nowMs,
    required WorldDataLifecycleRandomProvider randomProvider,
  }) {
    final int objectId = character.objectId ?? 0;
    final _MutationRiskStacks mutationStacks = _getMutationRiskStacks(
      character: character,
      entities: entities,
      nowMs: nowMs,
    );
    final double mutationRate = _calculateMutationRate(
      currentSpec: currentSpec,
      unnecessaryInjectionStacks: mutationStacks.unnecessaryInjectionStacks,
      dirtyExposureStacks: mutationStacks.dirtyExposureStacks,
    );
    final double mutationRoll = _normalizeRandom(
      randomProvider(
        WorldDataLifecycleRandomEvent(
          objectId: objectId,
          checkTimeMs: nowMs,
          reason: 'evolution_mutation',
        ),
      ),
    );
    final double mutationTargetRoll = _normalizeRandom(
      randomProvider(
        WorldDataLifecycleRandomEvent(
          objectId: objectId,
          checkTimeMs: nowMs,
          reason: 'evolution_mutation_target',
        ),
      ),
    );
    final WorldDataEvolutionCandidate? mutationCandidate =
        _resolveMutationEvolutionCandidate(
      currentSpec: currentSpec,
      mutationRate: mutationRate,
      mutationRoll: mutationRoll,
      targetRoll: mutationTargetRoll,
    );
    if (mutationCandidate != null) {
      return _EvolutionSelection(
        candidate: mutationCandidate,
        mutationRate: mutationRate,
        mutationRoll: mutationRoll,
        mutationTargetRoll: mutationTargetRoll,
      );
    }

    final double evolutionRoll = _normalizeRandom(
      randomProvider(
        WorldDataLifecycleRandomEvent(
          objectId: objectId,
          checkTimeMs: nowMs,
          reason: 'evolution',
        ),
      ),
    );
    return _EvolutionSelection(
      candidate: _resolveWeightedEvolutionCandidate(
        candidates: currentSpec.candidates,
        random: evolutionRoll,
      ),
      mutationRate: mutationRate,
      mutationRoll: mutationRoll,
      mutationTargetRoll: mutationTargetRoll,
      evolutionRoll: evolutionRoll,
    );
  }

  static _ProbabilityProgressResult _progressDiseaseAtTickEnd({
    required _MutableCharacterSource character,
    required List<dynamic> entities,
    required int tickEndMs,
    required WorldDataLifecycleRandomProvider randomProvider,
  }) {
    final int? state = character.state;
    if (state == config.characterStateDead) {
      return const _ProbabilityProgressResult();
    }
    if (state == config.characterStateEgg) {
      final bool removed =
          character.statuses.remove(config.characterStatusSick);
      character.diseaseSystem['sickStartTime'] = 0;
      character.diseaseSystem['nextCheckTime'] = _advanceCheckTime(
        _readInt(character.diseaseSystem['nextCheckTime']),
        tickEndMs,
        worldDataLifecycleDiseaseCheckIntervalMs,
      );
      return _ProbabilityProgressResult(changed: removed);
    }

    int? nextCheckTime = _readInt(character.diseaseSystem['nextCheckTime']);
    if (nextCheckTime == null || nextCheckTime <= 0) {
      character.diseaseSystem['nextCheckTime'] =
          tickEndMs + worldDataLifecycleDiseaseCheckIntervalMs;
      return const _ProbabilityProgressResult(changed: true);
    }
    if (tickEndMs < nextCheckTime) {
      return const _ProbabilityProgressResult();
    }

    final bool isSleeping = state == config.characterStateSleeping;
    final int effectiveInterval = isSleeping
        ? (worldDataLifecycleDiseaseCheckIntervalMs /
                worldDataLifecycleSleepingDiseaseRateMultiplier)
            .round()
        : worldDataLifecycleDiseaseCheckIntervalMs;
    int checkCount = 0;
    while (tickEndMs >= nextCheckTime!) {
      checkCount += 1;
      nextCheckTime += effectiveInterval;
    }

    bool diseaseOccurred = false;
    double? diseaseRate;
    double? aggregatedProbability;
    if (!character.statuses.contains(config.characterStatusSick)) {
      diseaseRate = _calculateDiseaseRate(character, entities);
      aggregatedProbability = aggregateProbability(
        perCheckProbability: diseaseRate,
        checkCount: checkCount,
      );
      if (_rollAggregatedProbability(
        objectId: character.objectId ?? 0,
        checkTimeMs: tickEndMs,
        reason: 'disease',
        checkCount: checkCount,
        perCheckProbability: diseaseRate,
        aggregatedProbability: aggregatedProbability,
        randomProvider: randomProvider,
      )) {
        _addStatus(character.statuses, config.characterStatusSick);
        character.diseaseSystem['sickStartTime'] = tickEndMs;
        if (!isSleeping) {
          character.object['state'] = config.characterStateSick;
        }
        diseaseOccurred = true;
      }
    }

    character.diseaseSystem['nextCheckTime'] = nextCheckTime;
    return _ProbabilityProgressResult(
      changed: true,
      occurred: diseaseOccurred,
      checkCount: checkCount,
      perCheckProbability: diseaseRate,
      aggregatedProbability: aggregatedProbability,
    );
  }

  static bool _rollAggregatedProbability({
    required int objectId,
    required int checkTimeMs,
    required String reason,
    required int checkCount,
    required double perCheckProbability,
    required double aggregatedProbability,
    required WorldDataLifecycleRandomProvider randomProvider,
  }) {
    if (checkCount <= 0 || aggregatedProbability <= 0) {
      return false;
    }
    final double roll = _normalizeRandom(
      randomProvider(
        WorldDataLifecycleRandomEvent(
          objectId: objectId,
          checkTimeMs: checkTimeMs,
          reason: reason,
          checkCount: checkCount,
          perCheckProbability: perCheckProbability,
          aggregatedProbability: aggregatedProbability,
        ),
      ),
    );
    return roll < aggregatedProbability;
  }

  static double _progressFatigue({
    required double fatigue,
    required bool isSleeping,
    required bool isSick,
    required int elapsedMs,
  }) {
    final double nextFatigue = isSleeping
        ? fatigue -
            elapsedMs *
                ((isSick
                        ? worldDataLifecycleFatigueSleepRecoveryPerHourWhenSick
                        : worldDataLifecycleFatigueSleepRecoveryPerHour) /
                    (60 * 60 * 1000))
        : fatigue +
            elapsedMs *
                worldDataLifecycleFatigueAwakeGainPerHour /
                (60 * 60 * 1000);
    return nextFatigue.clamp(0, worldDataLifecycleFatigueMax).toDouble();
  }

  static bool _handleScheduledWake(
      _MutableCharacterSource character, int nowMs) {
    if (character.state != config.characterStateSleeping) {
      return false;
    }
    final int? nextWakeTime = _readInt(character.sleepSystem['nextWakeTime']);
    if (nextWakeTime == null || nextWakeTime <= 0 || nowMs < nextWakeTime) {
      return false;
    }
    _wakeCharacter(character, nowMs);
    return true;
  }

  static bool _handleScheduledSleep(
      _MutableCharacterSource character, int nowMs) {
    final int? nextSleepTime = _readInt(character.sleepSystem['nextSleepTime']);
    if (nextSleepTime == null ||
        nextSleepTime <= 0 ||
        nowMs < nextSleepTime ||
        !_canEnterSleep(character)) {
      return false;
    }
    final int mode = _readInt(character.sleepSystem['pendingSleepReason']) ==
            worldDataLifecycleSleepReasonNap
        ? worldDataLifecycleSleepModeDayNap
        : worldDataLifecycleSleepModeNightSleep;
    _enterSleep(character, nowMs, mode);
    return true;
  }

  static bool _handleNapWake(_MutableCharacterSource character, int nowMs) {
    if (character.state != config.characterStateSleeping ||
        _readInt(character.sleepSystem['sleepMode']) !=
            worldDataLifecycleSleepModeDayNap) {
      return false;
    }
    final int? startedAt =
        _readInt(character.sleepSystem['sleepSessionStartedAt']);
    if (startedAt == null || startedAt <= 0) {
      return false;
    }
    final int elapsedMs = nowMs - startedAt;
    final bool hasReachedMinDuration =
        elapsedMs >= worldDataLifecycleDayNapMinDurationMs;
    final bool hasRecoveredEnough =
        character.fatigue <= worldDataLifecycleFatigueDayNapWakeThreshold;
    final bool hasReachedMaxDuration =
        elapsedMs >= worldDataLifecycleDayNapMaxDurationMs;
    if (!hasReachedMaxDuration &&
        !(hasReachedMinDuration && hasRecoveredEnough)) {
      return false;
    }
    _wakeCharacter(character, nowMs);
    return true;
  }

  static bool _canEnterSleep(_MutableCharacterSource character) {
    return switch (character.state) {
      config.characterStateEgg ||
      config.characterStateDead ||
      config.characterStateEating =>
        false,
      _ => true,
    };
  }

  static void _enterSleep(
    _MutableCharacterSource character,
    int nowMs,
    int mode,
  ) {
    character.object['state'] = config.characterStateSleeping;
    character.sleepSystem['sleepMode'] = mode;
    character.sleepSystem['nextSleepTime'] = 0;
    character.sleepSystem['pendingSleepReason'] =
        worldDataLifecycleSleepReasonNone;
    character.sleepSystem['pendingWakeReason'] =
        worldDataLifecycleSleepReasonNone;
    character.sleepSystem['sleepSessionStartedAt'] = nowMs;
    if (mode == worldDataLifecycleSleepModeDayNap) {
      character.sleepSystem['nextWakeTime'] =
          nowMs + worldDataLifecycleDayNapMaxDurationMs;
    }
  }

  static void _wakeCharacter(_MutableCharacterSource character, int nowMs) {
    character.object['state'] =
        character.statuses.contains(config.characterStatusSick)
            ? config.characterStateSick
            : config.characterStateIdle;
    character.sleepSystem['sleepMode'] = worldDataLifecycleSleepModeAwake;
    character.sleepSystem['nextSleepTime'] = 0;
    character.sleepSystem['nextWakeTime'] = 0;
    character.sleepSystem['pendingSleepReason'] =
        worldDataLifecycleSleepReasonNone;
    character.sleepSystem['pendingWakeReason'] =
        worldDataLifecycleSleepReasonNone;
    character.sleepSystem['sleepSessionStartedAt'] = 0;
    character.sleepSystem['nextNapCheckTime'] =
        nowMs + worldDataLifecycleDayNapCheckIntervalMs;
  }

  static String _resolveTimeOfDay({
    required int tickEndMs,
    required Map<String, dynamic> appState,
  }) {
    if (appState['use_local_time'] is bool &&
        appState['use_local_time'] == false) {
      return 'day';
    }
    final int hour = DateTime.fromMillisecondsSinceEpoch(tickEndMs).hour;
    return hour >= 19 || hour < 6 ? 'night' : 'day';
  }

  static double _calculateDiseaseRate(
    _MutableCharacterSource character,
    List<dynamic> entities,
  ) {
    final double stamina = character.stamina ?? config.maxStamina;
    double diseaseRate = worldDataLifecycleBaseDiseaseRate;
    if (stamina <= worldDataLifecycleVeryLowStaminaThreshold) {
      diseaseRate += worldDataLifecycleVeryLowStaminaDiseaseBonus;
    } else if (stamina <= config.lowStaminaThreshold) {
      diseaseRate += worldDataLifecycleLowStaminaDiseaseBonus;
    }
    diseaseRate +=
        _countObjectsInWorld(entities, worldDataLifecyclePoopObjectType) *
            worldDataLifecyclePoopDiseaseRate;
    diseaseRate +=
        _countStaleFood(entities) * worldDataLifecycleStaleFoodDiseaseRate;
    return diseaseRate.clamp(0, 1).toDouble();
  }

  static _MutationRiskStacks _getMutationRiskStacks({
    required _MutableCharacterSource character,
    required List<dynamic> entities,
    required int nowMs,
  }) {
    final Map<String, dynamic> mutationRisk =
        _readMap(character.components['mutationRisk']);
    return _MutationRiskStacks(
      unnecessaryInjectionStacks: _normalizeMutationStackCount(
        _readInt(mutationRisk['unnecessaryInjectionStacks']) ?? 0,
      ),
      dirtyExposureStacks: _countActiveDirtyExposureStacks(entities, nowMs),
    );
  }

  static int _countActiveDirtyExposureStacks(
    List<dynamic> entities,
    int nowMs,
  ) {
    int stackCount = 0;
    for (final dynamic entity in entities) {
      if (entity is! Map<String, dynamic>) {
        continue;
      }
      final Map<String, dynamic> components = _readMap(entity['components']);
      if (!_isActiveDirtyExposureSource(components)) {
        continue;
      }

      final Map<String, dynamic> dirtyExposure =
          _readMap(components['dirtyExposure']);
      if (dirtyExposure.isEmpty) {
        stackCount += 1;
        continue;
      }

      final int currentStacks = _readInt(dirtyExposure['stackCount']) ?? 0;
      final int accumulatedExposureMs =
          _readInt(dirtyExposure['accumulatedExposureMs']) ?? 0;
      final int lastUpdatedTime =
          _readInt(dirtyExposure['lastUpdatedTime']) ?? nowMs;
      final int elapsedMs = math.max(0, nowMs - lastUpdatedTime);
      final int gainedStacks = ((accumulatedExposureMs + elapsedMs) /
              worldDataLifecycleMutationDirtyExposureStackIntervalMs)
          .floor();
      final int exposureStacks =
          _normalizeMutationStackCount(currentStacks + gainedStacks);
      stackCount += math.max(1, exposureStacks);
    }
    return stackCount;
  }

  static bool _isActiveDirtyExposureSource(Map<String, dynamic> components) {
    final Map<String, dynamic> object = _readMap(components['object']);
    final int? type = _readInt(object['type']);
    if (type == worldDataLifecyclePoopObjectType) {
      return true;
    }
    if (type != worldDataLifecycleFoodObjectType ||
        _readInt(object['state']) == worldDataLifecycleFoodStateBeingThrowing) {
      return false;
    }

    final Map<String, dynamic> freshness = _readMap(components['freshness']);
    final Map<String, dynamic> food = _readMap(components['food']);
    final int? resolvedFreshness =
        _readInt(freshness['freshness']) ?? _readInt(food['freshness']);
    return resolvedFreshness == worldDataLifecycleFoodFreshnessStale;
  }

  static int _normalizeMutationStackCount(int value) {
    if (value <= 0) {
      return 0;
    }
    return math.min(worldDataLifecycleMutationStackCap, value);
  }

  static double _calculateMutationRate({
    required WorldDataEvolutionSpec currentSpec,
    required int unnecessaryInjectionStacks,
    required int dirtyExposureStacks,
  }) {
    final double stackBonusRate = switch (currentSpec.geneLine) {
      'green-slime' => 0.005,
      'soil-slime' => 0.01,
      'skull-slime' => 0.015,
      _ => 0,
    };
    final int injectionStacks =
        _normalizeMutationStackCount(unnecessaryInjectionStacks);
    final int dirtyStacks = _normalizeMutationStackCount(dirtyExposureStacks);
    return math.min(
      1,
      worldDataLifecycleMutationBaseRate +
          (injectionStacks + dirtyStacks) * stackBonusRate,
    );
  }

  static WorldDataEvolutionCandidate? _resolveMutationEvolutionCandidate({
    required WorldDataEvolutionSpec currentSpec,
    required double mutationRate,
    required double mutationRoll,
    required double targetRoll,
  }) {
    final List<int> mutationTargets =
        _getSameClassCrossGeneMutationTargets(currentSpec);
    if (mutationTargets.isEmpty || mutationRoll >= mutationRate) {
      return null;
    }
    final int index = (targetRoll * mutationTargets.length).floor().clamp(
          0,
          mutationTargets.length - 1,
        );
    return WorldDataEvolutionCandidate(
      to: mutationTargets[index],
      weight: 1,
      kind: evolutionCandidateKindCrossLine,
    );
  }

  static List<int> _getSameClassCrossGeneMutationTargets(
    WorldDataEvolutionSpec currentSpec,
  ) {
    return worldDataMonsterCharacterKeys.where((int targetKey) {
      final WorldDataEvolutionSpec? targetSpec =
          worldDataEvolutionSpecs[targetKey];
      return targetSpec != null &&
          targetSpec.classCode == currentSpec.classCode &&
          targetSpec.geneLine != currentSpec.geneLine;
    }).toList();
  }

  static WorldDataEvolutionCandidate? _resolveWeightedEvolutionCandidate({
    required List<WorldDataEvolutionCandidate> candidates,
    required double random,
  }) {
    if (candidates.isEmpty) {
      return null;
    }
    final int totalWeight = candidates.fold<int>(
      0,
      (int sum, WorldDataEvolutionCandidate candidate) =>
          sum + math.max(0, candidate.weight),
    );
    if (totalWeight <= 0) {
      return null;
    }

    final double roll = random * totalWeight;
    int accumulatedWeight = 0;
    for (final WorldDataEvolutionCandidate candidate in candidates) {
      accumulatedWeight += candidate.weight;
      if (roll < accumulatedWeight) {
        return candidate;
      }
    }
    return candidates.last;
  }

  static void _applyEvolution({
    required _MutableCharacterSource character,
    required WorldDataEvolutionSpec currentSpec,
    required WorldDataEvolutionCandidate candidate,
  }) {
    final WorldDataEvolutionSpec? targetSpec =
        worldDataEvolutionSpecs[candidate.to];
    if (targetSpec == null) {
      return;
    }
    final int nextPhase = candidate.kind == evolutionCandidateKindCrossLine
        ? currentSpec.phase
        : targetSpec.phase;

    character.characterStatus['characterKey'] = candidate.to;
    character.characterStatus['evolutionPhase'] = nextPhase;
    character.characterStatus['evolutionGage'] = 0.0;

    final Map<String, dynamic> animationRender =
        _ensureMap(character.components, 'animationRender');
    animationRender['storeIndex'] = worldDataLifecycleTextureKeyNull;
    animationRender['spritesheetKey'] = candidate.to;
    animationRender['animationKey'] = worldDataLifecycleAnimationKeyIdle;
    animationRender['isPlaying'] = true;
    animationRender['loop'] = true;
    animationRender['speed'] = 0.04;

    final Map<String, dynamic> render =
        _ensureMap(character.components, 'render');
    render['storeIndex'] = worldDataLifecycleTextureKeyNull;
    render['textureKey'] = worldDataLifecycleTextureKeyNull;
  }

  static _StaminaProgressResult _progressStamina({
    required double stamina,
    required double staminaTimerMs,
    required int? characterState,
    required double deltaMs,
  }) {
    if (deltaMs <= 0 ||
        characterState == config.characterStateEgg ||
        characterState == config.characterStateDead) {
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
          (config.staminaDecreaseIntervalMs - nextTimerMs)
              .clamp(0, config.staminaDecreaseIntervalMs.toDouble())
              .toDouble();
      final double timeUntilDecrease = remainingEffectiveTime / multiplier;
      if (remainingDeltaMs + 0.0001 < timeUntilDecrease) {
        nextTimerMs += remainingDeltaMs * multiplier;
        remainingDeltaMs = 0;
        break;
      }
      nextTimerMs = 0;
      remainingDeltaMs = math.max(0, remainingDeltaMs - timeUntilDecrease);
      nextStamina = (nextStamina - config.staminaDecreaseAmount)
          .clamp(0, config.maxStamina)
          .toDouble();
    }

    return _StaminaProgressResult(
      stamina: nextStamina,
      staminaTimerMs: nextTimerMs,
    );
  }

  static double _resolveCurrentStaminaTimerMultiplier(
    double stamina,
    int? characterState,
  ) {
    final double sleepMultiplier =
        characterState == config.characterStateSleeping
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

  static WorldDataLifecycleEvolutionDiagnostics _buildEvolutionDiagnostics(
    _MutableCharacterSource? character, {
    required String blockReason,
  }) {
    return WorldDataLifecycleEvolutionDiagnostics(
      evolutionGageBefore: character?.evolutionGage,
      evolutionGageAfter: character?.evolutionGage,
      evolutionGageIncreased: false,
      blockReason: blockReason,
    );
  }

  static bool _syncSickStatusFromState(_MutableCharacterSource character) {
    if (character.state != config.characterStateSick ||
        character.statuses.contains(config.characterStatusSick)) {
      return false;
    }
    _addStatus(character.statuses, config.characterStatusSick);
    return true;
  }

  static double _resolveEvolutionGaugeGain({
    required String classCode,
    required int objectId,
    required int phase,
  }) {
    final double targetDurationMs = switch (classCode) {
      'A' => 20 * 60 * 60 * 1000,
      'B' => 40 * 60 * 60 * 1000,
      'C' => 60 * 60 * 60 * 1000,
      'D' => 80 * 60 * 60 * 1000,
      _ => 0,
    };
    final double varianceMs = switch (classCode) {
      'A' => 2 * 60 * 60 * 1000,
      'B' => 4 * 60 * 60 * 1000,
      'C' => 6 * 60 * 60 * 1000,
      'D' => 8 * 60 * 60 * 1000,
      _ => 0,
    };
    if (targetDurationMs <= 0) {
      return 0;
    }
    final double seed = _stableSeededUnitValue('$objectId:$classCode:$phase');
    final double durationMs = targetDurationMs + varianceMs * (seed * 2 - 1);
    if (durationMs <= 0) {
      return 0;
    }
    return ((worldDataLifecycleEvolutionMaxGauge *
                worldDataLifecycleEvolutionCheckIntervalMs) /
            durationMs) *
        worldDataLifecycleEvolutionGaugeGainMultiplier;
  }

  static int _advanceCheckTime(int? current, int nowMs, int intervalMs) {
    if (current == null || current <= 0) {
      return nowMs + intervalMs;
    }
    var next = current;
    while (nowMs >= next) {
      next += intervalMs;
    }
    return next;
  }

  static int _countObjectsInWorld(List<dynamic> entities, int objectType) {
    int count = 0;
    for (final dynamic entity in entities) {
      if (entity is! Map<String, dynamic>) {
        continue;
      }
      final Map<String, dynamic> components = _readMap(entity['components']);
      final Map<String, dynamic> object = _readMap(components['object']);
      if (_readInt(object['type']) == objectType) {
        count += 1;
      }
    }
    return count;
  }

  static int _countStaleFood(List<dynamic> entities) {
    int count = 0;
    for (final dynamic entity in entities) {
      if (entity is! Map<String, dynamic>) {
        continue;
      }
      final Map<String, dynamic> components = _readMap(entity['components']);
      final Map<String, dynamic> object = _readMap(components['object']);
      if (_readInt(object['type']) != worldDataLifecycleFoodObjectType) {
        continue;
      }
      final Map<String, dynamic> freshness = _readMap(components['freshness']);
      final Map<String, dynamic> food = _readMap(components['food']);
      final int? resolvedFreshness =
          _readInt(freshness['freshness']) ?? _readInt(food['freshness']);
      if (resolvedFreshness == worldDataLifecycleFoodFreshnessStale) {
        count += 1;
      }
    }
    return count;
  }

  static _MutableCharacterSource? _findMainCharacter(List<dynamic> entities) {
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
          _ensureMap(components, 'characterStatus');
      final Map<String, dynamic> eggHatch = _ensureMap(components, 'eggHatch');
      final Map<String, dynamic> diseaseSystem =
          _ensureMap(components, 'diseaseSystem');
      final Map<String, dynamic> sleepSystem =
          _ensureMap(components, 'sleepSystem');
      return _MutableCharacterSource(
        components: components,
        object: object,
        characterStatus: characterStatus,
        eggHatch: eggHatch,
        diseaseSystem: diseaseSystem,
        sleepSystem: sleepSystem,
      );
    }
    return null;
  }

  static Map<String, dynamic> _deepCopyMap(Map<String, dynamic> value) {
    return jsonDecode(jsonEncode(value)) as Map<String, dynamic>;
  }

  static Map<String, dynamic> _ensureMap(
    Map<String, dynamic> parent,
    String key,
  ) {
    final Object? current = parent[key];
    if (current is Map<String, dynamic>) {
      return current;
    }
    final Map<String, dynamic> next = <String, dynamic>{};
    parent[key] = next;
    return next;
  }

  static List<dynamic> _ensureList(Map<String, dynamic> parent, String key) {
    final Object? current = parent[key];
    if (current is List<dynamic>) {
      return current;
    }
    final List<dynamic> next = <dynamic>[];
    parent[key] = next;
    return next;
  }

  static Map<String, dynamic> _readMap(Object? value) {
    return value is Map<String, dynamic> ? value : <String, dynamic>{};
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

  static String? _readString(Object? value) {
    if (value is! String) {
      return null;
    }
    final String trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  static int _normalizeEggHatchBonusCount(int value) {
    if (value <= 0) {
      return 0;
    }
    return math.min(worldDataLifecycleEggHatchMaxBonusCount, value);
  }

  static _EggHatchProbabilities _calculateEggHatchProbabilities({
    required int staleFoodCountAtHatch,
    required int syringeCount,
  }) {
    final int normalizedStaleFoodCountAtHatch =
        _normalizeEggHatchBonusCount(staleFoodCountAtHatch);
    final int normalizedSyringeCount =
        _normalizeEggHatchBonusCount(syringeCount);
    final int soilBonus = normalizedStaleFoodCountAtHatch *
        worldDataLifecycleEggHatchBonusPerCountPercent;
    final int skullBonus =
        normalizedSyringeCount * worldDataLifecycleEggHatchBonusPerCountPercent;
    return _EggHatchProbabilities(
      normalizedStaleFoodCountAtHatch: normalizedStaleFoodCountAtHatch,
      normalizedSyringeCount: normalizedSyringeCount,
      green:
          worldDataLifecycleEggHatchBaseGreenPercent - soilBonus - skullBonus,
      soil: worldDataLifecycleEggHatchBaseSoilPercent + soilBonus,
      skull: worldDataLifecycleEggHatchBaseSkullPercent + skullBonus,
    );
  }

  static int? _normalizePendingEggHatchCharacterKey(int? value) {
    return switch (value) {
      worldDataLifecycleGreenSlimeA1CharacterKey ||
      worldDataLifecycleSkullSlimeA1CharacterKey ||
      worldDataLifecycleSoilSlimeA1CharacterKey =>
        value,
      _ => null,
    };
  }

  static void _addStatus(List<int> statuses, int status) {
    if (!statuses.contains(status)) {
      statuses.add(status);
    }
  }

  static double _normalizeRandom(double value) {
    if (value.isNaN || value.isInfinite) {
      return 0;
    }
    if (value < 0) {
      return 0;
    }
    if (value >= 1) {
      return 0.999999999;
    }
    return value;
  }

  static double deterministicRandomProvider(
    WorldDataLifecycleRandomEvent event,
  ) {
    return _stableSeededUnitValue(
      '${event.objectId}:${event.checkTimeMs}:${event.reason}',
    );
  }

  static double _stableSeededUnitValue(String seed) {
    int hash = 0x811c9dc5;
    for (final int codeUnit in seed.codeUnits) {
      hash ^= codeUnit;
      hash = (hash * 0x01000193) & 0xffffffff;
    }
    return (hash & 0xffffffff) / 0x100000000;
  }
}

class _MutableCharacterSource {
  final Map<String, dynamic> object;
  final Map<String, dynamic> components;
  final Map<String, dynamic> characterStatus;
  final Map<String, dynamic> eggHatch;
  final Map<String, dynamic> diseaseSystem;
  final Map<String, dynamic> sleepSystem;

  _MutableCharacterSource({
    required this.components,
    required this.object,
    required this.characterStatus,
    required this.eggHatch,
    required this.diseaseSystem,
    required this.sleepSystem,
  });

  int? get objectId => WorldDataLifecycleService._readInt(object['id']);
  int? get state => WorldDataLifecycleService._readInt(object['state']);
  int? get characterKey =>
      WorldDataLifecycleService._readInt(characterStatus['characterKey']);
  double? get stamina =>
      WorldDataLifecycleService._readDouble(characterStatus['stamina']);
  double? get evolutionGage =>
      WorldDataLifecycleService._readDouble(characterStatus['evolutionGage']);
  double get fatigue =>
      WorldDataLifecycleService._readDouble(sleepSystem['fatigue']) ??
      worldDataLifecycleFatigueDefault;
  double staminaTimerMs = 0;

  List<int> get statuses {
    final Object? rawStatuses = characterStatus['statuses'];
    if (rawStatuses is List<dynamic>) {
      final List<int> normalized = rawStatuses
          .map(WorldDataLifecycleService._readInt)
          .whereType<int>()
          .where((int status) => status > 0)
          .toList();
      characterStatus['statuses'] = normalized;
      return normalized;
    }
    final List<int> normalized = <int>[];
    characterStatus['statuses'] = normalized;
    return normalized;
  }
}

class _TickProgressResult {
  final bool changed;
  final bool diseaseOccurred;
  final int diseaseCheckCount;
  final double? lastDiseasePerCheckProbability;
  final double? lastDiseaseAggregatedProbability;
  final bool dayNapOccurred;
  final int dayNapCheckCount;
  final double? lastDayNapPerCheckProbability;
  final double? lastDayNapAggregatedProbability;
  final WorldDataLifecycleEvolutionDiagnostics evolutionDiagnostics;

  const _TickProgressResult({
    required this.changed,
    required this.diseaseOccurred,
    required this.diseaseCheckCount,
    required this.lastDiseasePerCheckProbability,
    required this.lastDiseaseAggregatedProbability,
    required this.dayNapOccurred,
    required this.dayNapCheckCount,
    required this.lastDayNapPerCheckProbability,
    required this.lastDayNapAggregatedProbability,
    required this.evolutionDiagnostics,
  });
}

class _HatchProgressResult {
  final bool changed;
  final bool hatched;
  final int? selectedCharacterKey;
  final Map<String, Object?>? selectionDiagnostics;

  const _HatchProgressResult({
    this.changed = false,
    this.hatched = false,
    this.selectedCharacterKey,
    this.selectionDiagnostics,
  });
}

class _EggHatchProbabilities {
  final int normalizedStaleFoodCountAtHatch;
  final int normalizedSyringeCount;
  final int green;
  final int soil;
  final int skull;

  const _EggHatchProbabilities({
    required this.normalizedStaleFoodCountAtHatch,
    required this.normalizedSyringeCount,
    required this.green,
    required this.soil,
    required this.skull,
  });
}

class _EggHatchSelection {
  final int staleFoodCountAtHatch;
  final int syringeCount;
  final int normalizedStaleFoodCountAtHatch;
  final int normalizedSyringeCount;
  final double? random;
  final double? normalizedRandom;
  final double? rollPercent;
  final int greenProbability;
  final int soilProbability;
  final int skullProbability;
  final int selectedCharacterKey;
  final bool usedPendingCharacterKey;

  const _EggHatchSelection({
    required this.staleFoodCountAtHatch,
    required this.syringeCount,
    required this.normalizedStaleFoodCountAtHatch,
    required this.normalizedSyringeCount,
    required this.random,
    required this.normalizedRandom,
    required this.rollPercent,
    required this.greenProbability,
    required this.soilProbability,
    required this.skullProbability,
    required this.selectedCharacterKey,
    required this.usedPendingCharacterKey,
  });

  Map<String, Object?> toJson() => <String, Object?>{
        'staleFoodCountAtHatch': staleFoodCountAtHatch,
        'syringeCount': syringeCount,
        'normalizedStaleFoodCountAtHatch': normalizedStaleFoodCountAtHatch,
        'normalizedSyringeCount': normalizedSyringeCount,
        'random': random,
        'normalizedRandom': normalizedRandom,
        'rollPercent': rollPercent,
        'greenProbability': greenProbability,
        'soilProbability': soilProbability,
        'skullProbability': skullProbability,
        'selectedCharacterKey': selectedCharacterKey,
        'usedPendingCharacterKey': usedPendingCharacterKey,
      };
}

class _StaminaProgressResult {
  final double stamina;
  final double staminaTimerMs;

  const _StaminaProgressResult({
    required this.stamina,
    required this.staminaTimerMs,
  });
}

class _SleepProgressResult {
  final bool changed;

  const _SleepProgressResult({this.changed = false});
}

class _ProbabilityProgressResult {
  final bool changed;
  final bool occurred;
  final int checkCount;
  final double? perCheckProbability;
  final double? aggregatedProbability;

  const _ProbabilityProgressResult({
    this.changed = false,
    this.occurred = false,
    this.checkCount = 0,
    this.perCheckProbability,
    this.aggregatedProbability,
  });
}

class _MutationRiskStacks {
  final int unnecessaryInjectionStacks;
  final int dirtyExposureStacks;

  const _MutationRiskStacks({
    required this.unnecessaryInjectionStacks,
    required this.dirtyExposureStacks,
  });
}

class _EvolutionSelection {
  final WorldDataEvolutionCandidate? candidate;
  final double? mutationRate;
  final double? mutationRoll;
  final double? mutationTargetRoll;
  final double? evolutionRoll;

  const _EvolutionSelection({
    required this.candidate,
    this.mutationRate,
    this.mutationRoll,
    this.mutationTargetRoll,
    this.evolutionRoll,
  });
}

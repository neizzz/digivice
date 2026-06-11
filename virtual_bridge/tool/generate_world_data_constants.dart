import 'dart:convert';
import 'dart:io';

import 'package:digivice_virtual_bridge/world_data/world_data_constants.dart';

const String _outputRelativePath =
    'apps/game/src/scenes/MainScene/generated/worldDataConstants.generated.ts';

void main(List<String> args) {
  final bool check = args.contains('--check');
  final Uri repoRoot = Platform.script.resolve('../..');
  final File outputFile = File.fromUri(repoRoot.resolve(_outputRelativePath));
  final String generated = _buildTypeScriptOutput();

  if (check) {
    final String current =
        outputFile.existsSync() ? outputFile.readAsStringSync() : '';
    if (current != generated) {
      stderr.writeln(
        '$_outputRelativePath is stale. Run: dart virtual_bridge/tool/generate_world_data_constants.dart',
      );
      exitCode = 1;
    }
    return;
  }

  outputFile.parent.createSync(recursive: true);
  outputFile.writeAsStringSync(generated);
  stdout.writeln('Generated $_outputRelativePath');
}

String _buildTypeScriptOutput() {
  final JsonEncoder encoder = const JsonEncoder.withIndent('\t');
  final StringBuffer buffer = StringBuffer()
    ..writeln('// AUTO-GENERATED FILE. DO NOT EDIT.')
    ..writeln(
        '// Source of truth: virtual_bridge/lib/world_data/world_data_constants.dart')
    ..writeln('// Run: pnpm run sync:world-data-constants')
    ..writeln(
        '// For gameplay balance changes, edit the Dart source of truth above.')
    ..writeln();

  _writeConst(
      buffer,
      'PRODUCTION_BALANCE_REFERENCE',
      <String, Object?>{
        'TARGET_NIGHT_SLEEP_DURATION': worldDataGameTargetNightSleepDurationMs,
      },
      encoder);
  _writeConst(buffer, 'GAME_CONSTANTS', _gameConstants(), encoder);
  _writeConst(
    buffer,
    'PRODUCTION_EVOLUTION_TARGET_DURATION_BY_CLASS_MS',
    _classMsMap(worldDataLifecycleEvolutionTargetDurationByClassMs),
    encoder,
  );
  _writeConst(
    buffer,
    'PRODUCTION_EVOLUTION_TARGET_DURATION_VARIANCE_BY_CLASS_MS',
    _classMsMap(worldDataLifecycleEvolutionTargetDurationVarianceByClassMs),
    encoder,
  );
  _writeConst(buffer, 'PRODUCTION_EVOLUTION_GAUGE_CONFIG',
      _productionEvolutionGaugeConfig(), encoder);
  _writeConst(buffer, 'DEV_EVOLUTION_GAUGE_CONFIG', _devEvolutionGaugeConfig(),
      encoder);
  buffer
    ..writeln('export const EVOLUTION_GAUGE_CONFIG = import.meta.env.DEV')
    ..writeln('\t? DEV_EVOLUTION_GAUGE_CONFIG')
    ..writeln('\t: PRODUCTION_EVOLUTION_GAUGE_CONFIG;')
    ..writeln();
  _writeConst(
      buffer,
      'HATCH_GENE_CONFIG',
      <String, Object?>{
        'maxBonusCount': worldDataLifecycleEggHatchMaxBonusCount,
        'baseGreenPercent': worldDataLifecycleEggHatchBaseGreenPercent,
        'baseSoilPercent': worldDataLifecycleEggHatchBaseSoilPercent,
        'baseSkullPercent': worldDataLifecycleEggHatchBaseSkullPercent,
        'bonusPerCountPercent': worldDataLifecycleEggHatchBonusPerCountPercent,
        'greenSlimeA1CharacterKey': worldDataLifecycleGreenSlimeA1CharacterKey,
        'soilSlimeA1CharacterKey': worldDataLifecycleSoilSlimeA1CharacterKey,
        'skullSlimeA1CharacterKey': worldDataLifecycleSkullSlimeA1CharacterKey,
      },
      encoder);

  buffer
    ..writeln('export type GeneratedEvolutionCandidateKind =')
    ..writeln('\t| "base"')
    ..writeln('\t| "same_line_variant_mutation"')
    ..writeln('\t| "same_class_cross_line_mutation";')
    ..writeln()
    ..writeln('export type GeneratedMonsterEvolutionSpec = {')
    ..writeln('\tkey: number;')
    ..writeln('\tgeneLine: "green-slime" | "skull-slime" | "soil-slime";')
    ..writeln('\tclassCode: "A" | "B" | "C" | "D";')
    ..writeln('\tvariant: number;')
    ..writeln('\tphase: number;')
    ..writeln('\tcandidates: readonly {')
    ..writeln('\t\tto: number;')
    ..writeln('\t\tweight: number;')
    ..writeln('\t\tkind: GeneratedEvolutionCandidateKind;')
    ..writeln('\t}[];')
    ..writeln('};')
    ..writeln();

  _writeConst(
      buffer, 'MONSTER_EVOLUTION_SPECS', _monsterEvolutionSpecs(), encoder,
      suffix: ' satisfies Record<string, GeneratedMonsterEvolutionSpec>');

  return buffer.toString();
}

Map<String, Object?> _gameConstants() => <String, Object?>{
      'EGG_HATCH_MIN_TIME': worldDataGameEggHatchMinTimeMs,
      'EGG_HATCH_MODE_TIME': worldDataGameEggHatchModeTimeMs,
      'EGG_HATCH_MAX_TIME': worldDataGameEggHatchMaxTimeMs,
      'DIGESTIVE_CAPACITY': worldDataLifecycleDigestiveCapacity,
      'DIGESTIVE_MULTIPLIER': worldDataGameDigestiveMultiplier,
      'DIGESTIVE_LOAD_PER_MEAL': worldDataLifecycleDigestiveLoadPerMeal,
      'POOP_DELAY': worldDataLifecyclePoopDelayMs,
      'DIGESTIVE_SMALL_POOP_DELAY': worldDataLifecycleSmallPoopDelayMs,
      'POOP_SPAWN_DISTANCE': worldDataGamePoopSpawnDistance,
      'POOP_SPAWN_MIN_OBJECT_SPACING': worldDataGamePoopSpawnMinObjectSpacing,
      'POOP_SPAWN_RETRY_COUNT': worldDataGamePoopSpawnRetryCount,
      'POOP_SPAWN_DISTANCE_JITTER': worldDataGamePoopSpawnDistanceJitter,
      'POOP_SPAWN_ANGLE_JITTER_RAD': worldDataGamePoopSpawnAngleJitterRad,
      'MAX_ACTIVE_OBJECT_COUNT': worldDataGameMaxActiveObjectCount,
      'MAX_ACTIVE_FOOD_COUNT': worldDataGameMaxActiveFoodCount,
      'DISEASE_CHECK_INTERVAL': worldDataLifecycleDiseaseCheckIntervalMs,
      'BASE_DISEASE_RATE': worldDataLifecycleBaseDiseaseRate,
      'POOP_DISEASE_RATE': worldDataLifecyclePoopDiseaseRate,
      'STALE_FOOD_DISEASE_RATE': worldDataLifecycleStaleFoodDiseaseRate,
      'FRESH_TO_NORMAL_TIME': worldDataGameFreshToNormalTimeMs,
      'NORMAL_TO_STALE_TIME': worldDataLifecycleFoodNormalToStaleMs,
      'UNHAPPY_STAMINA_THRESHOLD': lowStaminaThreshold,
      'HAPPY_EMOTION_COOLDOWN_MS': worldDataGameHappyEmotionCooldownMs,
      'URGENT_STAMINA_THRESHOLD': worldDataGameUrgentStaminaThreshold,
      'URGENT_SPEED_MULTIPLIER': worldDataGameUrgentSpeedMultiplier,
      'DEATH_DELAY': worldDataGameDeathDelayClassAMs,
      'DEATH_DELAY_CLASS_A': worldDataGameDeathDelayClassAMs,
      'DEATH_DELAY_CLASS_B': worldDataGameDeathDelayClassBMs,
      'DEATH_DELAY_CLASS_C': worldDataGameDeathDelayClassCMs,
      'DEATH_DELAY_CLASS_D': worldDataGameDeathDelayClassDMs,
      'MAX_STAMINA': maxStamina,
      'BOOSTED_STAMINA_THRESHOLD': boostedStaminaThreshold,
      'STAMINA_DECREASE_INTERVAL': staminaDecreaseIntervalMs,
      'STAMINA_DECREASE_AMOUNT': staminaDecreaseAmount,
      'HIGH_STAMINA_DECAY_MULTIPLIER': highStaminaDecayMultiplier,
      'LOW_STAMINA_DECAY_MULTIPLIER': lowStaminaDecayMultiplier,
      'NIGHT_SLEEP_MIN_DELAY': worldDataGameNightSleepMinDelayMs,
      'NIGHT_SLEEP_MAX_DELAY': worldDataGameNightSleepMaxDelayMs,
      'TARGET_NIGHT_SLEEP_DURATION': worldDataGameTargetNightSleepDurationMs,
      'TARGET_NIGHT_SLEEP_JITTER': worldDataGameTargetNightSleepJitterMs,
      'SUNRISE_WAKE_MIN_DELAY': worldDataGameSunriseWakeMinDelayMs,
      'SUNRISE_WAKE_MAX_DELAY': worldDataGameSunriseWakeMaxDelayMs,
      'SUNRISE_WAKE_OFFSET_MIN': worldDataGameSunriseWakeOffsetMinMs,
      'SUNRISE_WAKE_OFFSET_MAX': worldDataGameSunriseWakeOffsetMaxMs,
      'NIGHT_RESLEEP_MIN_DELAY': worldDataGameNightResleepMinDelayMs,
      'NIGHT_RESLEEP_MAX_DELAY': worldDataGameNightResleepMaxDelayMs,
      'DAY_NAP_CHANCE': worldDataLifecycleDayNapChance,
      'DAY_NAP_CHECK_INTERVAL': worldDataLifecycleDayNapCheckIntervalMs,
      'DAY_NAP_MIN_DURATION': worldDataLifecycleDayNapMinDurationMs,
      'DAY_NAP_MAX_DURATION': worldDataLifecycleDayNapMaxDurationMs,
      'FATIGUE_MAX': worldDataLifecycleFatigueMax,
      'FATIGUE_DEFAULT': worldDataLifecycleFatigueDefault,
      'FATIGUE_AWAKE_GAIN_PER_HOUR': worldDataLifecycleFatigueAwakeGainPerHour,
      'FATIGUE_SLEEP_RECOVERY_PER_HOUR':
          worldDataLifecycleFatigueSleepRecoveryPerHour,
      'FATIGUE_SLEEP_RECOVERY_PER_HOUR_WHEN_SICK':
          worldDataLifecycleFatigueSleepRecoveryPerHourWhenSick,
      'FATIGUE_DAY_NAP_MIN_THRESHOLD':
          worldDataLifecycleFatigueDayNapMinThreshold,
      'FATIGUE_DAY_NAP_WAKE_THRESHOLD':
          worldDataLifecycleFatigueDayNapWakeThreshold,
      'NATURAL_SICK_RECOVERY_FATIGUE_THRESHOLD':
          worldDataGameNaturalSickRecoveryFatigueThreshold,
      'NATURAL_SICK_RECOVERY_MIN_DURATION':
          worldDataGameNaturalSickRecoveryMinDurationMs,
      'MINI_GAME_SLEEP_INTERRUPT_FATIGUE':
          worldDataGameMiniGameSleepInterruptFatigue,
      'MINI_GAME_SLEEP_INTERRUPT_STAMINA':
          worldDataGameMiniGameSleepInterruptStamina,
      'SLEEPING_STAMINA_DECAY_MULTIPLIER': sleepingStaminaDecayMultiplier,
      'SLEEPING_DISEASE_RATE_MULTIPLIER':
          worldDataLifecycleSleepingDiseaseRateMultiplier,
    };

Map<String, Object?> _productionEvolutionGaugeConfig() {
  final Map<String, num> targetDurationByClassMs =
      _classMsMap(worldDataLifecycleEvolutionTargetDurationByClassMs);
  return <String, Object?>{
    'maxGauge': worldDataLifecycleEvolutionMaxGauge,
    'staminaThreshold': lowStaminaThreshold,
    'boostedStaminaThreshold': boostedStaminaThreshold,
    'boostedGaugeGainMultiplier':
        worldDataLifecycleBoostedEvolutionGaugeGainMultiplier,
    'checkIntervalMs': worldDataLifecycleEvolutionCheckIntervalMs,
    'sleepingGaugeTimeProgressMultiplier':
        worldDataLifecycleSleepingEvolutionTimeMultiplier,
    'gaugeGainByClass': targetDurationByClassMs.map(
      (String key, num durationMs) => MapEntry<String, double>(
        key,
        _getGaugeGainForDurationMs(durationMs.toDouble()),
      ),
    ),
    'targetDurationByClassMs': targetDurationByClassMs,
    'targetDurationVarianceByClassMs':
        _classMsMap(worldDataLifecycleEvolutionTargetDurationVarianceByClassMs),
  };
}

Map<String, Object?> _devEvolutionGaugeConfig() =>
    _productionEvolutionGaugeConfig();

Map<String, num> _classMsMap(Map<String, int> source) => <String, num>{
      'character-class-a': source['A']!,
      'character-class-b': source['B']!,
      'character-class-c': source['C']!,
      'character-class-d': source['D']!,
    };

double _getGaugeGainForDurationMs(double durationMs) {
  if (durationMs <= 0) {
    return 0;
  }
  return (worldDataLifecycleEvolutionMaxGauge *
          worldDataLifecycleEvolutionCheckIntervalMs) /
      durationMs;
}

Map<String, Object?> _monsterEvolutionSpecs() {
  final Map<String, int> variants = <String, int>{};
  final List<WorldDataEvolutionSpec> specs =
      worldDataEvolutionSpecs.values.toList()
        ..sort((WorldDataEvolutionSpec a, WorldDataEvolutionSpec b) {
          final int geneCompare = a.geneLine.compareTo(b.geneLine);
          if (geneCompare != 0) return geneCompare;
          final int classCompare = a.classCode.compareTo(b.classCode);
          if (classCompare != 0) return classCompare;
          return a.key.compareTo(b.key);
        });

  final Map<String, Object?> result = <String, Object?>{};
  for (final WorldDataEvolutionSpec spec in specs) {
    final String variantKey = '${spec.geneLine}:${spec.classCode}';
    final int variant = (variants[variantKey] ?? 0) + 1;
    variants[variantKey] = variant;
    result['${spec.key}'] = <String, Object?>{
      'key': spec.key,
      'geneLine': spec.geneLine,
      'classCode': spec.classCode,
      'variant': variant,
      'phase': spec.phase,
      'candidates': spec.candidates
          .map((WorldDataEvolutionCandidate candidate) => <String, Object?>{
                'to': candidate.to,
                'weight': candidate.weight,
                'kind': candidate.kind,
              })
          .toList(growable: false),
    };
  }
  return result;
}

void _writeConst(
  StringBuffer buffer,
  String name,
  Object? value,
  JsonEncoder encoder, {
  String suffix = '',
}) {
  buffer
    ..write('export const $name = ')
    ..write(encoder.convert(value))
    ..writeln(' as const$suffix;')
    ..writeln();
}

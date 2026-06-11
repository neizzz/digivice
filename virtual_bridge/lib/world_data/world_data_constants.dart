// Flutter/Dart is the source of truth for world-data gameplay constants.
// Dart lifecycle/update code imports this file directly, and
// virtual_bridge/tool/generate_world_data_constants.dart emits read-only
// TypeScript constants for the WebView game from these values.
//
// Edit world-data/gameplay balance values here first, then run:
//   pnpm run sync:world-data-constants
//   pnpm run check:world-data-constants
// Do not edit apps/game/src/scenes/MainScene/generated/worldDataConstants.generated.ts
// directly; it is generated from this file.

// Home-widget/world-data wire constants shared by Flutter snapshot code.
/// 월드 데이터 엔티티 중 메인 캐릭터를 식별하는 object type 값입니다.
const int characterObjectType = 1;

/// 캐릭터가 알 상태일 때 저장되는 상태 코드입니다.
const int characterStateEgg = 0;

/// 캐릭터가 깨어 있고 대기 중일 때 저장되는 상태 코드입니다.
const int characterStateIdle = 1;

/// 캐릭터가 이동 중일 때 저장되는 상태 코드입니다.
const int characterStateMoving = 2;

/// 캐릭터가 수면 중일 때 저장되는 상태 코드입니다.
const int characterStateSleeping = 3;

/// 캐릭터가 질병 상태일 때 저장되는 상태 코드입니다.
const int characterStateSick = 4;

/// 캐릭터가 음식을 섭취 중일 때 저장되는 상태 코드입니다.
const int characterStateEating = 5;

/// 캐릭터가 사망했을 때 저장되는 상태 코드입니다.
const int characterStateDead = 6;

/// 긴급 상태를 나타내는 캐릭터 status 코드입니다.
const int characterStatusUrgent = 2;

/// 질병 상태를 나타내는 캐릭터 status 코드입니다.
const int characterStatusSick = 3;

/// 행복/만족 상태를 나타내는 캐릭터 status 코드입니다.
const int characterStatusHappy = 4;

/// 발견/알림 상태를 나타내는 캐릭터 status 코드입니다.
const int characterStatusDiscover = 5;

/// 알 스프라이트 texture key 범위의 시작값입니다.
const int eggTextureKeyStart = 500;

/// 알 스프라이트 texture key 범위의 끝값입니다.
const int eggTextureKeyEnd = 529;

/// 기본 부화 시간입니다. 게임 부화 모드 시간과 동일하게 유지합니다.
const int defaultEggHatchDurationMs = worldDataGameEggHatchModeTimeMs;

/// 캐릭터 체력/스태미나의 최대값입니다.
const double maxStamina = 10;

/// 이 값 미만이면 진화 게이지 증가가 멈추고 저체력 상태로 간주합니다.
const double lowStaminaThreshold = 3;

/// 이 값 이상이면 스태미나가 충분해 진화 게이지 보너스를 받습니다.
const double boostedStaminaThreshold = 7;

/// 캐릭터 애니메이션에서 순환하는 기본 프레임 수입니다.
const int animationFrameCount = 4;

/// 스태미나가 한 번 감소하기까지 걸리는 기본 간격입니다.
const int staminaDecreaseIntervalMs = 12 * 60 * 1000;

/// 스태미나 감소 tick마다 차감되는 양입니다.
const double staminaDecreaseAmount = 0.25;

/// 높은 스태미나 구간에서 스태미나 감소 타이머를 빠르게 진행하는 배율입니다.
const double highStaminaDecayMultiplier = 1.3;

/// 낮은 스태미나 구간에서 스태미나 감소 타이머를 느리게 진행하는 배율입니다.
const double lowStaminaDecayMultiplier = 0.7;

/// 수면 중 스태미나 감소 속도에 적용되는 배율입니다.
const double sleepingStaminaDecayMultiplier = 0.2;

/// home-widget/world-data snapshot projection 스키마 버전입니다.
const int projectionVersion = 1;

// WebView gameplay constants generated from this Dart source.
/// 밀리초 단위 1초입니다.
const int secondMs = 1000;

/// 밀리초 단위 1분입니다.
const int minuteMs = 60 * secondMs;

/// 밀리초 단위 1시간입니다.
const int hourMs = 60 * minuteMs;

// const int worldDataGameEggHatchModeTimeMs = 20 * minuteMs;
/// 알 부화 시간 분포의 기준값입니다.
const int worldDataGameEggHatchModeTimeMs = 5 * minuteMs; // DEBUG
// const int worldDataGameEggHatchVarianceMs = 4.5 * minuteMs;
/// 부화 시간에 더하거나 뺄 수 있는 랜덤 편차입니다.
const int worldDataGameEggHatchVarianceMs = 0 * minuteMs; // DEBUG

/// 부화 시간이 가질 수 있는 최소값입니다.
const int worldDataGameEggHatchMinTimeMs =
    worldDataGameEggHatchModeTimeMs - worldDataGameEggHatchVarianceMs;

/// 부화 시간이 가질 수 있는 최대값입니다.
const int worldDataGameEggHatchMaxTimeMs =
    worldDataGameEggHatchModeTimeMs + worldDataGameEggHatchVarianceMs;

/// 음식 섭취량을 소화 부하로 환산할 때 적용하는 배율입니다.
const double worldDataGameDigestiveMultiplier = 0.5;

/// 똥을 캐릭터 주변에 생성할 때 사용하는 기본 거리입니다.
const int worldDataGamePoopSpawnDistance = 25;

/// 똥 생성 위치가 기존 오브젝트와 최소한 떨어져야 하는 거리입니다.
const int worldDataGamePoopSpawnMinObjectSpacing = 20;

/// 적절한 똥 생성 위치를 찾기 위해 재시도하는 횟수입니다.
const int worldDataGamePoopSpawnRetryCount = 6;

/// 똥 생성 거리에 더하는 랜덤 흔들림 범위입니다.
const int worldDataGamePoopSpawnDistanceJitter = 20;

/// 똥 생성 각도에 더하는 랜덤 흔들림 범위(라디안)입니다.
const double worldDataGamePoopSpawnAngleJitterRad = 1.5707963267948966;

/// 월드 안에 유지할 수 있는 전체 활성 오브젝트 최대 개수입니다.
const int worldDataGameMaxActiveObjectCount = 50;

/// 월드 안에 유지할 수 있는 활성 음식 최대 개수입니다.
const int worldDataGameMaxActiveFoodCount = 30;

/// 음식이 fresh에서 normal 신선도로 바뀌기까지 걸리는 시간입니다.
const int worldDataGameFreshToNormalTimeMs = 3 * minuteMs;

/// happy 감정 표시를 다시 띄우기 전까지의 쿨다운입니다.
const int worldDataGameHappyEmotionCooldownMs = 10 * minuteMs;

/// urgent 상태를 판단하는 스태미나 임계값입니다.
const double worldDataGameUrgentStaminaThreshold = 0;

/// urgent 상태에서 이동 속도에 적용되는 배율입니다.
const double worldDataGameUrgentSpeedMultiplier = 0.8;

/// A 클래스 캐릭터가 위험 상태로 방치된 뒤 사망하기까지의 지연 시간입니다.
const int worldDataGameDeathDelayClassAMs = 6 * hourMs;

/// B 클래스 캐릭터가 위험 상태로 방치된 뒤 사망하기까지의 지연 시간입니다.
const int worldDataGameDeathDelayClassBMs = 14 * hourMs;

/// C 클래스 캐릭터가 위험 상태로 방치된 뒤 사망하기까지의 지연 시간입니다.
const int worldDataGameDeathDelayClassCMs = 22 * hourMs;

/// D 클래스 캐릭터가 위험 상태로 방치된 뒤 사망하기까지의 지연 시간입니다.
const int worldDataGameDeathDelayClassDMs = 30 * hourMs;

/// 밤 수면 시작을 검사한 뒤 실제 잠들기까지의 최소 지연입니다.
const int worldDataGameNightSleepMinDelayMs = 10 * minuteMs;

/// 밤 수면 시작을 검사한 뒤 실제 잠들기까지의 최대 지연입니다.
const int worldDataGameNightSleepMaxDelayMs = 60 * minuteMs;

/// 밤 수면의 목표 지속 시간입니다.
const int worldDataGameTargetNightSleepDurationMs = 8 * hourMs;

/// 밤 수면 목표 시간에 적용하는 랜덤 편차입니다.
const int worldDataGameTargetNightSleepJitterMs = 30 * minuteMs;

/// 일출 이후 기상 판정을 시작하기까지의 최소 지연입니다.
const int worldDataGameSunriseWakeMinDelayMs = 10 * minuteMs;

/// 일출 이후 기상 판정을 시작하기까지의 최대 지연입니다.
const int worldDataGameSunriseWakeMaxDelayMs = 60 * minuteMs;

/// 일출 기상 시각을 앞당길 수 있는 최소 오프셋입니다.
const int worldDataGameSunriseWakeOffsetMinMs = -10 * minuteMs;

/// 일출 기상 시각을 늦출 수 있는 최대 오프셋입니다.
const int worldDataGameSunriseWakeOffsetMaxMs = 40 * minuteMs;

/// 밤중에 다시 잠들기까지의 최소 지연입니다.
const int worldDataGameNightResleepMinDelayMs = 5 * minuteMs;

/// 밤중에 다시 잠들기까지의 최대 지연입니다.
const int worldDataGameNightResleepMaxDelayMs = 15 * minuteMs;

/// 자연 회복이 가능한 피로도 상한입니다.
const double worldDataGameNaturalSickRecoveryFatigueThreshold = 28;

/// 질병 자연 회복 전에 최소로 유지되어야 하는 아픈 시간입니다.
const int worldDataGameNaturalSickRecoveryMinDurationMs = 30 * minuteMs;

/// 미니게임으로 수면이 끊길 때 증가시키는 피로도입니다.
const double worldDataGameMiniGameSleepInterruptFatigue = 10;

/// 미니게임으로 수면이 끊길 때 감소시키는 스태미나입니다.
const double worldDataGameMiniGameSleepInterruptStamina = 1;

// Flutter world-data lifecycle balance constants.
/// 백그라운드/오프라인 lifecycle replay에서 사용하는 최소 tick 길이입니다.
const int worldDataLifecycleMinTickMs = 1000;

/// 백그라운드/오프라인 lifecycle replay에서 한 tick이 넘지 않도록 자르는 최대 길이입니다.
const int worldDataLifecycleMaxTickMs = 60 * 1000;

/// 질병 발생 여부를 검사하는 주기입니다.
const int worldDataLifecycleDiseaseCheckIntervalMs = 10 * 1000;

/// 기본 질병 발생 확률입니다.
const double worldDataLifecycleBaseDiseaseRate = 0.0001862601875783909;

/// 똥 오브젝트 하나가 질병 발생 확률에 더하는 값입니다.
const double worldDataLifecyclePoopDiseaseRate = 0.000093;

/// 상한 음식 하나가 질병 발생 확률에 더하는 값입니다.
const double worldDataLifecycleStaleFoodDiseaseRate = 0.000093;

/// 수면 중 질병 발생 확률에 적용하는 배율입니다.
const double worldDataLifecycleSleepingDiseaseRateMultiplier = 0.1;

/// lifecycle에서 똥 오브젝트를 식별하는 type 값입니다.
const int worldDataLifecyclePoopObjectType = 4;

/// lifecycle에서 음식 오브젝트를 식별하는 type 값입니다.
const int worldDataLifecycleFoodObjectType = 3;

/// 음식 fresh 신선도 코드입니다.
const int worldDataLifecycleFoodFreshnessFresh = 1;

/// 음식 normal 신선도 코드입니다.
const int worldDataLifecycleFoodFreshnessNormal = 2;

/// 음식 stale 신선도 코드입니다.
const int worldDataLifecycleFoodFreshnessStale = 3;

/// 음식이 던져지는 중일 때의 상태 코드입니다.
const int worldDataLifecycleFoodStateBeingThrowing = 1;

/// 음식이 바닥에 놓인 상태 코드입니다.
const int worldDataLifecycleFoodStateLanded = 2;

/// 음식이 섭취되는 중일 때의 상태 코드입니다.
const int worldDataLifecycleFoodStateBeingIntaken = 3;

/// 음식이 캐릭터의 목표로 지정된 상태 코드입니다.
const int worldDataLifecycleFoodStateTargeted = 4;

/// 음식이 normal에서 stale로 변하기까지 걸리는 시간입니다.
const int worldDataLifecycleFoodNormalToStaleMs = 10 * 60 * 1000;

/// 목적지가 없음을 나타내는 destination type 코드입니다.
const int worldDataLifecycleDestinationTypeNull = 0;

/// 목적지가 지정되었음을 나타내는 destination type 코드입니다.
const int worldDataLifecycleDestinationTypeTargeted = 3;

/// 음식 섭취 애니메이션/처리에 사용하는 지속 시간입니다.
const int worldDataLifecycleFoodEatingDurationMs = 3200;

/// 음식 texture key 범위의 시작값입니다.
const int worldDataLifecycleFoodTextureKeyMin = 400;

/// 음식 texture key 범위의 끝값입니다.
const int worldDataLifecycleFoodTextureKeyMax = 463;

/// 음식 기본 스태미나 회복량입니다.
const double worldDataLifecycleDefaultFoodStaminaBonus = 2;

/// 음식별 스태미나 회복량을 뽑을 때 사용하는 분포입니다.
const List<int> worldDataLifecycleFoodStaminaBonusDistribution = <int>[
  1,
  2,
  2,
  3,
  3,
  4
];

/// 소화 부하가 쌓일 수 있는 최대 용량입니다.
const double worldDataLifecycleDigestiveCapacity = 5.0;

/// 음식 한 끼가 추가하는 기본 소화 부하입니다.
const double worldDataLifecycleDigestiveLoadPerMeal = 1.5;

/// 일반 똥이 생성되기까지의 지연 시간입니다.
const int worldDataLifecyclePoopDelayMs = 20 * 60 * 1000;

/// 작은 똥이 생성되기까지의 지연 시간입니다.
const int worldDataLifecycleSmallPoopDelayMs = 8 * 60 * 60 * 1000;

/// 진화 게이지의 최대 raw 값입니다. UI는 이 값을 기준으로 퍼센트를 계산합니다.
const double worldDataLifecycleEvolutionMaxGauge = 100;

/// 진화 게이지 증가 여부를 검사하는 주기입니다.
const int worldDataLifecycleEvolutionCheckIntervalMs = 10 * 1000;

/// 수면 중 진화 게이지 시간 진행에 적용하는 배율입니다.
const double worldDataLifecycleSleepingEvolutionTimeMultiplier = 1 / 3;

/// 스태미나가 boosted 구간일 때 진화 게이지 증가량에 적용하는 배율입니다.
const double worldDataLifecycleBoostedEvolutionGaugeGainMultiplier = 1.3;

/// 클래스별 목표 진화 시간입니다. 실제 gain은 max gauge와 이 시간을 기반으로 계산됩니다.
const Map<String, int> worldDataLifecycleEvolutionTargetDurationByClassMs =
    <String, int>{
  'A': 20 * hourMs,
  'B': 40 * hourMs,
  'C': 60 * hourMs,
  'D': 60 * hourMs,
  // 'A': 10 * minuteMs, // DEBUG
  // 'B': 10 * minuteMs, // DEBUG
  // 'C': 10 * minuteMs, // DEBUG
  // 'D': 10 * minuteMs, // DEBUG
};

/// 클래스별 목표 진화 시간에 적용하는 랜덤 편차입니다.
const Map<String, int>
    worldDataLifecycleEvolutionTargetDurationVarianceByClassMs = <String, int>{
  'A': 2 * hourMs,
  'B': 4 * hourMs,
  'C': 6 * hourMs,
  'D': 6 * hourMs,
  // 'A': 0 * hourMs, // DEBUG
  // 'B': 0 * hourMs, // DEBUG
  // 'C': 0 * hourMs, // DEBUG
  // 'D': 0 * hourMs, // DEBUG
};

/// texture/store index가 없음을 나타내는 null texture key입니다.
const int worldDataLifecycleTextureKeyNull = 0;

/// 기본 idle 애니메이션 key입니다.
const int worldDataLifecycleAnimationKeyIdle = 1;

/// 피로도의 최대값입니다.
const double worldDataLifecycleFatigueMax = 100;

/// 새 캐릭터 또는 기본 상태에서 사용하는 피로도 초기값입니다.
const double worldDataLifecycleFatigueDefault = 35;

/// 깨어 있는 동안 시간당 증가하는 피로도입니다.
const double worldDataLifecycleFatigueAwakeGainPerHour = 9.5;

/// 수면 중 시간당 회복되는 피로도입니다.
const double worldDataLifecycleFatigueSleepRecoveryPerHour = 12;

/// 아픈 상태에서 수면 중 시간당 회복되는 피로도입니다.
const double worldDataLifecycleFatigueSleepRecoveryPerHourWhenSick = 6;

/// 낮잠 체크 시 낮잠에 들어갈 기본 확률입니다.
const double worldDataLifecycleDayNapChance = 0.07;

/// 낮잠 여부를 검사하는 주기입니다.
const int worldDataLifecycleDayNapCheckIntervalMs = 20 * 60 * 1000;

/// 낮잠 최소 지속 시간입니다.
const int worldDataLifecycleDayNapMinDurationMs = 30 * 60 * 1000;

/// 낮잠 최대 지속 시간입니다.
const int worldDataLifecycleDayNapMaxDurationMs = 90 * 60 * 1000;

/// 낮잠이 가능해지는 최소 피로도입니다.
const double worldDataLifecycleFatigueDayNapMinThreshold = 55;

/// 낮잠에서 깨어날 수 있는 피로도 기준값입니다.
const double worldDataLifecycleFatigueDayNapWakeThreshold = 48;

/// 수면 모드: 깨어 있음입니다.
const int worldDataLifecycleSleepModeAwake = 0;

/// 수면 모드: 밤 수면입니다.
const int worldDataLifecycleSleepModeNightSleep = 1;

/// 수면 모드: 낮잠입니다.
const int worldDataLifecycleSleepModeDayNap = 2;

/// 수면 이유가 없음을 나타내는 코드입니다.
const int worldDataLifecycleSleepReasonNone = 0;

/// 수면 이유가 낮잠임을 나타내는 코드입니다.
const int worldDataLifecycleSleepReasonNap = 3;

/// 알 부화 유전자 보너스 계산에 반영할 수 있는 최대 보너스 카운트입니다.
const int worldDataLifecycleEggHatchMaxBonusCount = 10;

/// 기본 green 계열 부화 확률(퍼센트)입니다.
const int worldDataLifecycleEggHatchBaseGreenPercent = 65;

/// 기본 soil 계열 부화 확률(퍼센트)입니다.
const int worldDataLifecycleEggHatchBaseSoilPercent = 20;

/// 기본 skull 계열 부화 확률(퍼센트)입니다.
const int worldDataLifecycleEggHatchBaseSkullPercent = 15;

/// 보너스 카운트 하나당 부화 확률에 더하는 퍼센트 포인트입니다.
const int worldDataLifecycleEggHatchBonusPerCountPercent = 2;

/// green slime A1 캐릭터 key입니다.
const int worldDataLifecycleGreenSlimeA1CharacterKey = 1;

/// skull slime A1 캐릭터 key입니다.
const int worldDataLifecycleSkullSlimeA1CharacterKey = 14;

/// soil slime A1 캐릭터 key입니다.
const int worldDataLifecycleSoilSlimeA1CharacterKey = 22;

/// Flutter world-data update가 완료되었을 때 기록하는 기본 status 문자열입니다.
const String worldDataLifecycleDefaultCompletedStatus =
    'flutter_world_data_update_completed';

/// foreground에서 부화를 처리했음을 나타내는 update source 문자열입니다.
const String worldDataLifecycleForegroundHatchSource = 'foreground_hatch';

/// home widget 주기 refresh가 lifecycle update를 요청했음을 나타내는 source 문자열입니다.
const String worldDataLifecycleWidgetPeriodicRefreshSource =
    'widget_periodic_refresh';

/// 도감에서 캐릭터 하나당 보관할 최대 도달 기록 수입니다.
const int worldDataMonsterBookMaxRecordsPerCharacter = 50;

/// 도감 데이터를 Flutter lifecycle이 작성했음을 나타내는 owner 문자열입니다.
const String worldDataMonsterBookWriteOwner = 'flutter_lifecycle';

// Monster evolution and mutation constants.
/// 기본 진화 후보를 나타내는 kind 문자열입니다.
const String evolutionCandidateKindBase = 'base';

/// 같은 계열 내 변종 진화 후보를 나타내는 kind 문자열입니다.
const String evolutionCandidateKindSameLine = 'same_line_variant_mutation';

/// 같은 클래스의 다른 계열로 변이되는 후보를 나타내는 kind 문자열입니다.
const String evolutionCandidateKindCrossLine = 'same_class_cross_line_mutation';

/// 오염 노출이 없을 때 적용하는 기본 변이 확률입니다.
const double worldDataLifecycleMutationBaseRate = 0.01;

/// 오염 노출 스택이 쌓일 수 있는 최대 개수입니다.
const int worldDataLifecycleMutationStackCap = 10;

/// 더러운 환경 노출 스택을 하나 추가하기 위한 노출 시간 간격입니다.
const int worldDataLifecycleMutationDirtyExposureStackIntervalMs =
    2 * 60 * 60 * 1000;

/// 진화 후보 하나를 표현합니다.
class WorldDataEvolutionCandidate {
  /// 진화 결과로 도달할 캐릭터 key입니다.
  final int to;

  /// 같은 후보 목록 안에서 사용하는 가중치입니다.
  final int weight;

  /// 기본 진화/같은 계열 변이/교차 계열 변이를 구분하는 문자열입니다.
  final String kind;

  const WorldDataEvolutionCandidate({
    required this.to,
    required this.weight,
    required this.kind,
  });
}

/// 캐릭터 하나의 진화 계보와 후보 목록을 표현합니다.
class WorldDataEvolutionSpec {
  /// 현재 캐릭터 key입니다.
  final int key;

  /// 캐릭터가 속한 유전자 계열입니다.
  final String geneLine;

  /// 캐릭터 클래스 코드입니다. 진화 시간과 희귀도 범위 계산에 사용합니다.
  final String classCode;

  /// 캐릭터 진화 단계입니다.
  final int phase;

  /// 현재 캐릭터에서 선택 가능한 다음 진화 후보 목록입니다.
  final List<WorldDataEvolutionCandidate> candidates;

  const WorldDataEvolutionSpec({
    required this.key,
    required this.geneLine,
    required this.classCode,
    required this.phase,
    required this.candidates,
  });
}

/// 캐릭터 key별 진화 스펙입니다. candidates가 비어 있으면 최종 진화형입니다.
const Map<int, WorldDataEvolutionSpec> worldDataEvolutionSpecs =
    <int, WorldDataEvolutionSpec>{
  1: WorldDataEvolutionSpec(
    key: 1,
    geneLine: 'green-slime',
    classCode: 'A',
    phase: 1,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 2, weight: 55, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 5, weight: 25, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 6, weight: 20, kind: evolutionCandidateKindSameLine),
    ],
  ),
  2: WorldDataEvolutionSpec(
    key: 2,
    geneLine: 'green-slime',
    classCode: 'B',
    phase: 2,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 3, weight: 50, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 7, weight: 20, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 8, weight: 15, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 9, weight: 15, kind: evolutionCandidateKindSameLine),
    ],
  ),
  3: WorldDataEvolutionSpec(
    key: 3,
    geneLine: 'green-slime',
    classCode: 'C',
    phase: 3,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 4, weight: 50, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 10, weight: 20, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 11, weight: 15, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 12, weight: 15, kind: evolutionCandidateKindSameLine),
    ],
  ),
  4: WorldDataEvolutionSpec(
    key: 4,
    geneLine: 'green-slime',
    classCode: 'D',
    phase: 4,
    candidates: <WorldDataEvolutionCandidate>[],
  ),
  5: WorldDataEvolutionSpec(
    key: 5,
    geneLine: 'green-slime',
    classCode: 'B',
    phase: 2,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 7, weight: 50, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 3, weight: 20, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 8, weight: 15, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 9, weight: 15, kind: evolutionCandidateKindSameLine),
    ],
  ),
  6: WorldDataEvolutionSpec(
    key: 6,
    geneLine: 'green-slime',
    classCode: 'B',
    phase: 2,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 8, weight: 50, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 3, weight: 20, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 7, weight: 15, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 9, weight: 15, kind: evolutionCandidateKindSameLine),
    ],
  ),
  7: WorldDataEvolutionSpec(
    key: 7,
    geneLine: 'green-slime',
    classCode: 'C',
    phase: 3,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 10, weight: 50, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 4, weight: 20, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 11, weight: 15, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 12, weight: 15, kind: evolutionCandidateKindSameLine),
    ],
  ),
  8: WorldDataEvolutionSpec(
    key: 8,
    geneLine: 'green-slime',
    classCode: 'C',
    phase: 3,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 11, weight: 50, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 4, weight: 20, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 10, weight: 15, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 12, weight: 15, kind: evolutionCandidateKindSameLine),
    ],
  ),
  9: WorldDataEvolutionSpec(
    key: 9,
    geneLine: 'green-slime',
    classCode: 'C',
    phase: 3,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 12, weight: 50, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 4, weight: 20, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 10, weight: 15, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 11, weight: 15, kind: evolutionCandidateKindSameLine),
    ],
  ),
  10: WorldDataEvolutionSpec(
      key: 10,
      geneLine: 'green-slime',
      classCode: 'D',
      phase: 4,
      candidates: <WorldDataEvolutionCandidate>[]),
  11: WorldDataEvolutionSpec(
      key: 11,
      geneLine: 'green-slime',
      classCode: 'D',
      phase: 4,
      candidates: <WorldDataEvolutionCandidate>[]),
  12: WorldDataEvolutionSpec(
      key: 12,
      geneLine: 'green-slime',
      classCode: 'D',
      phase: 4,
      candidates: <WorldDataEvolutionCandidate>[]),
  14: WorldDataEvolutionSpec(
    key: 14,
    geneLine: 'skull-slime',
    classCode: 'A',
    phase: 1,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 16, weight: 70, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 17, weight: 30, kind: evolutionCandidateKindSameLine),
    ],
  ),
  16: WorldDataEvolutionSpec(
    key: 16,
    geneLine: 'skull-slime',
    classCode: 'B',
    phase: 2,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 18, weight: 70, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 19, weight: 30, kind: evolutionCandidateKindSameLine),
    ],
  ),
  17: WorldDataEvolutionSpec(
    key: 17,
    geneLine: 'skull-slime',
    classCode: 'B',
    phase: 2,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 19, weight: 70, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 18, weight: 30, kind: evolutionCandidateKindSameLine),
    ],
  ),
  18: WorldDataEvolutionSpec(
    key: 18,
    geneLine: 'skull-slime',
    classCode: 'C',
    phase: 3,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 20, weight: 70, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 21, weight: 30, kind: evolutionCandidateKindSameLine),
    ],
  ),
  19: WorldDataEvolutionSpec(
    key: 19,
    geneLine: 'skull-slime',
    classCode: 'C',
    phase: 3,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 21, weight: 60, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 20, weight: 40, kind: evolutionCandidateKindSameLine),
    ],
  ),
  20: WorldDataEvolutionSpec(
      key: 20,
      geneLine: 'skull-slime',
      classCode: 'D',
      phase: 4,
      candidates: <WorldDataEvolutionCandidate>[]),
  21: WorldDataEvolutionSpec(
      key: 21,
      geneLine: 'skull-slime',
      classCode: 'D',
      phase: 4,
      candidates: <WorldDataEvolutionCandidate>[]),
  22: WorldDataEvolutionSpec(
    key: 22,
    geneLine: 'soil-slime',
    classCode: 'A',
    phase: 1,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 24, weight: 70, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 25, weight: 30, kind: evolutionCandidateKindSameLine),
    ],
  ),
  24: WorldDataEvolutionSpec(
    key: 24,
    geneLine: 'soil-slime',
    classCode: 'B',
    phase: 2,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 26, weight: 55, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 27, weight: 25, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 28, weight: 20, kind: evolutionCandidateKindSameLine),
    ],
  ),
  25: WorldDataEvolutionSpec(
    key: 25,
    geneLine: 'soil-slime',
    classCode: 'B',
    phase: 2,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 27, weight: 55, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 26, weight: 25, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 28, weight: 20, kind: evolutionCandidateKindSameLine),
    ],
  ),
  26: WorldDataEvolutionSpec(
    key: 26,
    geneLine: 'soil-slime',
    classCode: 'C',
    phase: 3,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 29, weight: 55, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 30, weight: 25, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 31, weight: 20, kind: evolutionCandidateKindSameLine),
    ],
  ),
  27: WorldDataEvolutionSpec(
    key: 27,
    geneLine: 'soil-slime',
    classCode: 'C',
    phase: 3,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 30, weight: 55, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 29, weight: 25, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 31, weight: 20, kind: evolutionCandidateKindSameLine),
    ],
  ),
  28: WorldDataEvolutionSpec(
    key: 28,
    geneLine: 'soil-slime',
    classCode: 'C',
    phase: 3,
    candidates: <WorldDataEvolutionCandidate>[
      WorldDataEvolutionCandidate(
          to: 31, weight: 55, kind: evolutionCandidateKindBase),
      WorldDataEvolutionCandidate(
          to: 29, weight: 25, kind: evolutionCandidateKindSameLine),
      WorldDataEvolutionCandidate(
          to: 30, weight: 20, kind: evolutionCandidateKindSameLine),
    ],
  ),
  29: WorldDataEvolutionSpec(
      key: 29,
      geneLine: 'soil-slime',
      classCode: 'D',
      phase: 4,
      candidates: <WorldDataEvolutionCandidate>[]),
  30: WorldDataEvolutionSpec(
      key: 30,
      geneLine: 'soil-slime',
      classCode: 'D',
      phase: 4,
      candidates: <WorldDataEvolutionCandidate>[]),
  31: WorldDataEvolutionSpec(
      key: 31,
      geneLine: 'soil-slime',
      classCode: 'D',
      phase: 4,
      candidates: <WorldDataEvolutionCandidate>[]),
};

/// 게임에서 몬스터로 취급하는 모든 캐릭터 key 목록입니다.
const List<int> worldDataMonsterCharacterKeys = <int>[
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  14,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  24,
  25,
  26,
  27,
  28,
  29,
  30,
  31,
];

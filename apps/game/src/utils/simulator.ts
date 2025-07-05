// import cloneDeep from "lodash.clonedeep";
import { CHARACTER_STATUS, FOOD_FRESHNESS } from "../config";
import { type ObjectData, ObjectType, type GameData } from "../types/GameData";
import {
  type CharacterClass,
  type CharacterKey,
  CharacterState,
} from "../types/Character";
import { evolve, getCharacterClassFrom, hatch } from "../evolution";
import type { LastCheckData } from "../managers/LastCheckDataManager";
import { cloneDeep } from "./common";

const A_MINUTE = 60 * 1000;
const FOUR_HOURS = 4 * 60 * 60 * 1000;
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

function _logConfiguredIntervals(): void {
  console.group(
    "[simulator] 현재 설정된 간격 값 (isDebugMode:",
    import.meta.env.DEV,
    ")"
  );

  // 알 부화 시간
  console.log(
    "EGG_HATCH_TIMEOUT:",
    CHARACTER_STATUS.EGG_HATCH_TIMEOUT,
    "ms",
    `(${Math.floor(
      CHARACTER_STATUS.EGG_HATCH_TIMEOUT / 1000 / 60
    )}분 ${Math.round((CHARACTER_STATUS.EGG_HATCH_TIMEOUT / 1000) % 60)}초)`
  );

  // 진화 게이지 관련
  console.log(
    "EVOLUTION_GAUGE_CHECK_INTERVAL:",
    CHARACTER_STATUS.EVOLUTION_GAUGE_CHECK_INTERVAL,
    "ms",
    `(${Math.floor(
      CHARACTER_STATUS.EVOLUTION_GAUGE_CHECK_INTERVAL / 1000 / 60
    )}분 ${Math.round(
      (CHARACTER_STATUS.EVOLUTION_GAUGE_CHECK_INTERVAL / 1000) % 60
    )}초)`
  );
  console.log(
    "EVOLUTION_GAUGE_STATMINA_THRESHOLD:",
    CHARACTER_STATUS.EVOLUTION_GAUGE_STATMINA_THRESHOLD
  );

  // 스태미나 감소 간격
  console.log(
    "STAMINA_DECREASE_INTERVAL:",
    CHARACTER_STATUS.STAMINA_DECREASE_INTERVAL,
    "ms",
    `(${Math.floor(
      CHARACTER_STATUS.STAMINA_DECREASE_INTERVAL / 1000 / 60
    )}분 ${Math.round(
      (CHARACTER_STATUS.STAMINA_DECREASE_INTERVAL / 1000) % 60
    )}초)`
  );
  console.log(
    "STAMINA_DECREASE_AMOUNT:",
    CHARACTER_STATUS.STAMINA_DECREASE_AMOUNT
  );

  // 질병 체크 간격
  console.log(
    "SICKNESS_CHECK_INTERVAL:",
    CHARACTER_STATUS.SICKNESS_CHECK_INTERVAL,
    "ms",
    `(${Math.floor(
      CHARACTER_STATUS.SICKNESS_CHECK_INTERVAL / 1000 / 60
    )}분 ${Math.round(
      (CHARACTER_STATUS.SICKNESS_CHECK_INTERVAL / 1000) % 60
    )}초)`
  );
  console.log("SICKNESS_PROBABILITY:", CHARACTER_STATUS.SICKNESS_PROBABILITY);

  // 스태미나 0 이후 타임아웃
  console.log(
    "TIMEOUT_AFTER_STAMINA_ZERO:",
    CHARACTER_STATUS.TIMEOUT_AFTER_STAMINA_ZERO,
    "ms",
    `(${Math.floor(
      CHARACTER_STATUS.TIMEOUT_AFTER_STAMINA_ZERO / 1000 / 60
    )}분 ${Math.round(
      (CHARACTER_STATUS.TIMEOUT_AFTER_STAMINA_ZERO / 1000) % 60
    )}초)`
  );

  console.groupEnd();
}
_logConfiguredIntervals();

export function simulateCharacterStatus(params: {
  /** background(or turn off) 진입 후 경과 시간 */
  elapsedTime: number;
  /** background(or turn off) 진입 당시, 게임 데이터 */
  inputGameData: GameData;
  /** background(or turn off) 진입 당시, 최근 상태 체크 정보 */
  inputCheckData: LastCheckData;
}): {
  resultGameData: GameData;
  resultLastCheckData: LastCheckData;
} {
  const { elapsedTime, inputGameData, inputCheckData } = params;
  const lastGameData = cloneDeep(inputGameData);
  const lastCharacterInfo = lastGameData.character;

  const baseTick = _determineBaseTick(elapsedTime);
  if (!baseTick) {
    lastCharacterInfo.status.stamina = 0;
    lastCharacterInfo.status.state = CharacterState.DEAD;
    return {
      resultGameData: lastGameData,
      resultLastCheckData: inputCheckData,
    };
  }

  // 시뮬레이션 전 상태 동기화
  if (lastCharacterInfo.status.stamina > 0) {
    lastCharacterInfo.status.timeOfZeroStamina = undefined;
  }

  const now = Date.now();
  const startTime = now - elapsedTime;
  const lastCheckData = cloneDeep(inputCheckData);

  for (
    let currentTime = startTime;
    currentTime < now;
    currentTime += baseTick
  ) {
    if (lastCharacterInfo.key === "egg") {
      const shouldHatch = _checkEggHatch({
        createdAt: inputGameData._createdAt,
      }); // 알 상태일 때는 진화 게이지가 없음.
      if (shouldHatch) {
        const hatchCharacterKey = hatch();
        lastCharacterInfo.key = hatchCharacterKey;
        lastCharacterInfo.status = {
          ...lastCharacterInfo.status,
          // TODO: 부화 이후 진입 시간에 따라, state/position을 랜덤or정교하게 생성
          // state: CharacterState.IDLE,
          state: lastCharacterInfo.status.state,
        };
        lastCheckData.stamina = currentTime; // 알 상태일 때는 스태미나 체크를 하지 않음.
        lastCheckData.sickness = currentTime; // 알 상태일 때는 sickness 체크를 하지 않음.
        lastCheckData.evolutionGauge = currentTime; // 알 상태일 때는 진화 게이지 체크를 하지 않음.
      }
      continue;
    }

    const intervalVariation = 1 + (Math.random() * 0.2 - 0.1); // -10% to +10% variation
    const shouldCheckSickness =
      currentTime >
      lastCheckData.sickness +
        CHARACTER_STATUS.SICKNESS_CHECK_INTERVAL * intervalVariation;
    // const shouldCheckDeath = !!lastCharacterInfo.status.timeOfZeroStamina;
    const shouldCheckDeath = false;
    const shouldCheckStamina =
      currentTime >
      lastCheckData.stamina +
        CHARACTER_STATUS.STAMINA_DECREASE_INTERVAL * intervalVariation;
    const shouldCheckEvolutionGauge =
      lastCharacterInfo.status.stamina >=
        CHARACTER_STATUS.EVOLUTION_GAUGE_STATMINA_THRESHOLD &&
      currentTime >
        lastCheckData.evolutionGauge +
          CHARACTER_STATUS.EVOLUTION_GAUGE_CHECK_INTERVAL * intervalVariation;

    if (shouldCheckSickness) {
      lastCheckData.sickness = currentTime;

      if (
        lastCharacterInfo.status.state !== CharacterState.SICK &&
        lastCharacterInfo.status.state !== CharacterState.EATING &&
        lastCharacterInfo.status.state !== CharacterState.SLEEPING
      ) {
        const sickness = _checkSickness({
          unhygienicObjectCount: _getUnhygienicObjectCount(
            currentTime,
            inputGameData.objectsMap
          ),
        });

        if (sickness) {
          lastCharacterInfo.status.state = CharacterState.SICK;
        }
      }

      /** 이미 이프다면, 스태미나 추가 감소 */
      if (lastCharacterInfo.status.state === CharacterState.SICK) {
        lastCharacterInfo.status.stamina = _decreaseStamina({
          startStamina: lastCharacterInfo.status.stamina,
        });
      }
    }

    if (shouldCheckDeath) {
      if (lastCharacterInfo.status.state !== CharacterState.EATING) {
        const isDead = _checkDeath({
          timeOfZeroStamina: lastCharacterInfo.status
            .timeOfZeroStamina as number,
        });
        if (isDead) {
          lastCharacterInfo.status.state = CharacterState.DEAD;
        }
      }
    }

    if (shouldCheckStamina) {
      lastCheckData.stamina = currentTime;

      if (!shouldCheckDeath) {
        const resultStamina = _decreaseStamina({
          startStamina: lastCharacterInfo.status.stamina,
        });
        if (resultStamina <= 0 && lastCharacterInfo.status.stamina > 0) {
          lastCharacterInfo.status.timeOfZeroStamina = currentTime;
        }
        lastCharacterInfo.status.stamina = resultStamina;
      }
    }

    if (shouldCheckEvolutionGauge) {
      const { resultEvolutionGauge, shouldEvolve } = _increaseEvolutionGage({
        currentEvolutionGauge: lastCharacterInfo.status.evolutionGauge,
        currentCharacterKey: lastCharacterInfo.key as CharacterKey,
      });
      lastCharacterInfo.status.evolutionGauge = resultEvolutionGauge;
      lastCheckData.evolutionGauge = currentTime;

      if (shouldEvolve) {
        const evolvedCharacterKey = evolve(
          lastCharacterInfo.key as CharacterKey
        );
        if (evolvedCharacterKey) {
          lastCharacterInfo.key = evolvedCharacterKey;
        }
      }
    }

    const shouldCreatePoob =
      lastGameData.futureEvents[0] &&
      lastGameData.futureEvents[0].time <= currentTime;
    if (shouldCreatePoob) {
      console.log("✅ [simulator] Poob 생성 이벤트 발생");
      lastGameData.futureEvents.splice(0, 1); // lastCharacter.InfofutureEvents에서 첫 번째 이벤트 제거
      // TODO: elapsedTime에 따라 app boundary 내 랜덤 위치 or 정밀 위치
      const poobPosition = {
        x: lastCharacterInfo.status.position.x,
        y: lastCharacterInfo.status.position.y,
      };
      lastGameData.objectsMap[ObjectType.Poob].push({
        id: `poob-${Date.now()}`,
        position: poobPosition,
        _createdAt: currentTime,
      });
    }
  }

  if (baseTick > 1000) {
    _logCharacterInfoChange(
      elapsedTime,
      inputGameData.character,
      lastCharacterInfo
    );
  }

  return {
    resultGameData: lastGameData,
    resultLastCheckData: lastCheckData,
  };
}

function _determineBaseTick(elapsedTime: number): number | undefined {
  if (elapsedTime < 500) {
    // forground이라고 가정하면 됨.
    return 16.667;
  }
  if (elapsedTime < A_MINUTE) {
    return 500;
  }
  if (elapsedTime < FOUR_HOURS) {
    return 2000;
  }
  if (elapsedTime < THREE_DAYS) {
    return 60000;
  }
}

function _getUnhygienicObjectCount(
  currentTime: number,
  objectsMap: GameData["objectsMap"]
): number {
  const poobCount = objectsMap[ObjectType.Poob]?.length || 0;
  const staleFoodCount =
    objectsMap[ObjectType.Food]?.filter(
      (food) =>
        (food as ObjectData[ObjectType.Food])._createdAt +
          FOOD_FRESHNESS.NORMAL_DURATION +
          FOOD_FRESHNESS.FRESH_DURATION <
        currentTime
    ).length || 0;

  return poobCount + staleFoodCount;
}

function _checkEggHatch(params: { createdAt: number }): boolean {
  const { createdAt } = params;
  const now = Date.now();
  const hatchTime = createdAt + CHARACTER_STATUS.EGG_HATCH_TIMEOUT;
  return now > hatchTime;
}

function _checkSickness(params: { unhygienicObjectCount: number }): boolean {
  const { unhygienicObjectCount } = params;
  const adjustedSicknessProbability =
    CHARACTER_STATUS.SICKNESS_PROBABILITY + unhygienicObjectCount * 0.01;
  const tmpRamdom = Math.random();
  const sickness = !!(tmpRamdom < adjustedSicknessProbability);
  console.debug(
    "[simulator] ✅_checkSickness:",
    adjustedSicknessProbability,
    sickness
  );
  return sickness;
}

function _decreaseStamina(params: { startStamina: number }): number {
  const { startStamina } = params;
  return Math.max(0, startStamina - CHARACTER_STATUS.STAMINA_DECREASE_AMOUNT);
}

function _increaseEvolutionGage(params: {
  currentEvolutionGauge: number;
  currentCharacterKey: CharacterKey;
}): { resultEvolutionGauge: number; shouldEvolve: boolean } {
  const { currentEvolutionGauge, currentCharacterKey } = params;
  const currentClass = getCharacterClassFrom(
    currentCharacterKey
  ) as CharacterClass;
  const increaseAmount =
    CHARACTER_STATUS.EVOLUTION_GAUGE_INCREASE_AMOUNT[currentClass];
  const resultEvolutionGauge = currentEvolutionGauge + increaseAmount;
  const shouldEvolve = resultEvolutionGauge >= 100;
  return {
    resultEvolutionGauge: shouldEvolve
      ? resultEvolutionGauge - 100
      : resultEvolutionGauge,
    shouldEvolve,
  };
}

function _checkDeath(params: { timeOfZeroStamina: number }): boolean {
  const { timeOfZeroStamina } = params;
  return (
    CHARACTER_STATUS.TIMEOUT_AFTER_STAMINA_ZERO < Date.now() - timeOfZeroStamina
  );
}

/**
 * Logs character state changes during simulation
 * @param elapsedTime Elapsed time in milliseconds
 * @param beforeCharacter Character state before simulation
 * @param afterCharacter Character state after simulation
 */
function _logCharacterInfoChange(
  elapsedTime: number,
  beforeCharacter: GameData["character"],
  afterCharacter: GameData["character"]
): void {
  console.group();
  console.log(
    `[simulator] Character State Change (Elapsed: ${elapsedTime}ms | ${Math.floor(
      elapsedTime / 1000 / 60
    )}분 ${Math.round((elapsedTime / 1000) % 60)}초)`
  );
  console.log(
    "Before:",
    JSON.stringify(
      {
        key: beforeCharacter.key,
        state: beforeCharacter.status.state,
        stamina: beforeCharacter.status.stamina,
        // sick: beforeCharacter.status.sickness,
        evolutionGauge: beforeCharacter.status.evolutionGauge,
      },
      null,
      2
    )
  );
  console.log(
    "After:",
    JSON.stringify(
      {
        key: afterCharacter.key,
        state: afterCharacter.status.state,
        stamina: afterCharacter.status.stamina,
        // sick: afterCharacter.status.sickness,
        evolutionGauge: afterCharacter.status.evolutionGauge,
      },
      null,
      2
    )
  );

  // Log significant changes
  if (beforeCharacter.key !== afterCharacter.key) {
    console.log(
      `Character evolved/changed from ${beforeCharacter.key} to ${afterCharacter.key}`
    );
  }

  if (beforeCharacter.status.state !== afterCharacter.status.state) {
    console.log(
      `State changed from ${beforeCharacter.status.state} to ${afterCharacter.status.state}`
    );
  }
  console.groupEnd();
}

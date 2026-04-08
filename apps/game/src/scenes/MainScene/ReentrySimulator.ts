import { defineQuery, type IWorld } from "bitecs";
import {
  ObjectComp,
  CharacterStatusComp,
  PositionComp,
} from "./raw-components";
import { ObjectType, CharacterStatus, CharacterState } from "./types";
import { getCharacterNameByKey } from "./systems/EvolutionSystem";

/**
 * 진화 정보
 */
interface EvolutionEvent {
  eid: number;
  characterId: number;
  tickNumber: number;
  simulationTime: number;
  beforePhase: number;
  beforeCharacterKey: number;
  beforeCharacterName: string;
  afterPhase: number;
  afterCharacterKey: number;
  afterCharacterName: string;
}

/**
 * 시뮬레이션 전후 캐릭터 상태 정보
 */
interface CharacterStateSnapshot {
  eid: number;
  characterId: number;
  stamina: number;
  evolutionGage: number;
  evolutionPhase: number;
  characterKey: number;
  characterName: string;
  statuses: string[]; // CharacterStatus enum의 문자열 표현
  state: string; // CharacterState enum의 문자열 표현
  position: { x: number; y: number };
}

/**
 * 재진입 시뮬레이션 관리 클래스
 * 앱 재진입 시 경과된 시간에 따른 시뮬레이션 실행을 담당
 */
export class ReentrySimulator {
  private _currentSimulationTime = 0;
  private _beforeStates: CharacterStateSnapshot[] = [];
  private _afterStates: CharacterStateSnapshot[] = [];
  private _evolutionEvents: EvolutionEvent[] = [];
  private _currentTick = 0;
  private _baseTickSize = 0;

  /**
   * 재진입 시뮬레이션 실행
   * @param lastActiveTime 마지막 활성 시간
   * @param simulatorFunction 시뮬레이션할 시스템 파이프라인 함수
   * @param context 시뮬레이션에 필요한 컨텍스트 (world 등)
   */
  async simulate<T extends IWorld>(
    lastActiveTime: number,
    simulatorFunction: (params: { world: T; delta: number }) => void,
    context: T
  ): Promise<void> {
    const currentTime = Date.now();
    const elapsedTime = currentTime - lastActiveTime;

    console.groupCollapsed(
      `[ReentrySimulator] 🔄 Processing ${elapsedTime}ms of elapsed time...`
    );

    try {
      // 시뮬레이션 전 상태 수집
      this._beforeStates = this._collectCharacterStates(context);

      // 시뮬레이션 틱 크기 결정
      const tickSize = this._getSimulationTickSize(elapsedTime);
      this._baseTickSize = tickSize;
      const totalTicks = Math.floor(elapsedTime / tickSize);
      const remainingTime = elapsedTime % tickSize;
      const totalSteps = totalTicks + (remainingTime > 0 ? 1 : 0);

      console.log(`Simulating ${totalSteps} tick(s) with base ${tickSize}ms`);
      console.log(`Base tick size: ${this._formatTime(tickSize)}`);
      if (remainingTime > 0) {
        console.log(`Remaining partial tick: ${remainingTime}ms`);
      }
      const progressLogInterval = totalSteps > 5000 ? 1000 : 100;

      // 각 틱마다 시스템 파이프라인 실행
      for (let tick = 0; tick < totalSteps; tick++) {
        this._currentTick = tick + 1;
        const isPartialTick = tick === totalTicks && remainingTime > 0;
        const simulationDelta = isPartialTick ? remainingTime : tickSize;
        const elapsedUntilTick =
          tick < totalTicks
            ? (tick + 1) * tickSize
            : totalTicks * tickSize + remainingTime;
        const simulationTime = lastActiveTime + elapsedUntilTick;

        // 현재 시뮬레이션 시간 설정
        this._currentSimulationTime = simulationTime;

        // 진화 전 상태 저장 (진화 추적용)
        const beforeTickStates = this._collectCharacterStates(context);

        // 시스템 파이프라인 실행
        simulatorFunction({
          world: context,
          delta: simulationDelta,
        });

        // 진화 후 상태 확인 및 진화 이벤트 기록
        this._checkForEvolutions(context, beforeTickStates, simulationTime);

        // 진행률 로깅 (매 100틱마다)
        if (tick % progressLogInterval === 0 || tick === totalSteps - 1) {
          const progress = (((tick + 1) / totalSteps) * 100).toFixed(1);
          console.log(
            `Simulation progress: ${progress}% (tick ${tick + 1}/${totalSteps})`
          );
        }
      }

      // 시뮬레이션 후 상태 수집
      this._afterStates = this._collectCharacterStates(context);

      // 시뮬레이션 결과 요약 출력
      this._logSimulationSummary(elapsedTime, totalSteps);

      console.log(
        `Simulation completed! Processed ${totalSteps} tick(s) in ${elapsedTime}ms`
      );
    } catch (error) {
      console.error("Simulation failed:", error);
    } finally {
      console.groupEnd();
    }
  }

  /**
   * 경과 시간에 따른 시뮬레이션 틱 크기 결정
   */
  private _getSimulationTickSize(elapsedTime: number): number {
    const TEN_SECONDS = 10 * 1000;
    const FIVE_MINUTES = 5 * 60 * 1000;
    const ONE_HOUR = 60 * 60 * 1000;

    if (elapsedTime < TEN_SECONDS) {
      return 100; // 10초 미만: 0.1초 틱
    } else if (elapsedTime < FIVE_MINUTES) {
      return 1000; // 5분 미만: 1초 틱
    } else if (elapsedTime < ONE_HOUR) {
      return 10 * 1000; // 1시간 미만: 10초 틱
    } else {
      return 60 * 1000; // 1시간 이상: 1분 틱
    }
  }

  /**
   * 현재 시뮬레이션 시간 반환
   */
  public getCurrentSimulationTime(): number {
    return this._currentSimulationTime;
  }

  /**
   * 월드에서 캐릭터 상태들을 수집
   */
  private _collectCharacterStates<T extends IWorld>(
    context: T
  ): CharacterStateSnapshot[] {
    const characterQuery = defineQuery([
      ObjectComp,
      CharacterStatusComp,
      PositionComp,
    ]);
    const entities = characterQuery(context);

    const states: CharacterStateSnapshot[] = [];

    for (const eid of entities) {
      if (ObjectComp.type[eid] === ObjectType.CHARACTER) {
        // 상태 배열에서 활성 상태들만 추출
        const statusArray = CharacterStatusComp.statuses[eid];
        const activeStatuses: string[] = [];

        for (let i = 0; i < statusArray.length; i++) {
          const status = statusArray[i];
          if (status !== ECS_NULL_VALUE) {
            activeStatuses.push(
              CharacterStatus[status] || `Unknown(${status})`
            );
          }
        }

        const characterKey = CharacterStatusComp.characterKey[eid];

        states.push({
          eid,
          characterId: ObjectComp.id[eid],
          stamina: CharacterStatusComp.stamina[eid],
          evolutionGage: CharacterStatusComp.evolutionGage[eid],
          evolutionPhase: CharacterStatusComp.evolutionPhase[eid],
          characterKey,
          characterName: getCharacterNameByKey(characterKey),
          statuses: activeStatuses,
          state:
            CharacterState[ObjectComp.state[eid]] ||
            `Unknown(${ObjectComp.state[eid]})`,
          position: {
            x: Math.round(PositionComp.x[eid]),
            y: Math.round(PositionComp.y[eid]),
          },
        });
      }
    }

    return states;
  }

  /**
   * 진화 이벤트 추적
   */
  private _checkForEvolutions<T extends IWorld>(
    context: T,
    beforeStates: CharacterStateSnapshot[],
    simulationTime: number
  ): void {
    const afterStates = this._collectCharacterStates(context);

    for (let i = 0; i < beforeStates.length; i++) {
      const before = beforeStates[i];
      const after = afterStates.find((s) => s.eid === before.eid);

      if (!after) continue;

      // 진화가 발생했는지 확인
      if (before.evolutionPhase !== after.evolutionPhase) {
        const evolutionEvent: EvolutionEvent = {
          eid: before.eid,
          characterId: before.characterId,
          tickNumber: this._currentTick,
          simulationTime,
          beforePhase: before.evolutionPhase,
          beforeCharacterKey: before.characterKey,
          beforeCharacterName: before.characterName,
          afterPhase: after.evolutionPhase,
          afterCharacterKey: after.characterKey,
          afterCharacterName: after.characterName,
        };

        this._evolutionEvents.push(evolutionEvent);

        console.log(
          `🎉 [Tick ${this._currentTick}] Evolution detected! Character ${before.characterId}: ${before.characterName} → ${after.characterName}`
        );
      }
    }
  }

  /**
   * 시뮬레이션 전후 상태 변화를 요약하여 로깅
   */
  private _logSimulationSummary(elapsedTime: number, totalTicks: number): void {
    console.groupCollapsed(
      `📊 Simulation Summary (${this._formatTime(elapsedTime)} elapsed)`
    );

    if (this._beforeStates.length === 0) {
      console.log("No characters found to simulate");
      console.groupEnd();
      return;
    }

    // 기본 정보
    console.log(
      `Simulated ${totalTicks} ticks over ${this._formatTime(elapsedTime)}`
    );
    console.log(`Base tick size: ${this._formatTime(this._baseTickSize)}`);
    console.log(`Found ${this._beforeStates.length} character(s)`);

    // 진화 이벤트 요약
    if (this._evolutionEvents.length > 0) {
      console.groupCollapsed(
        `🎉 Evolution Events (${this._evolutionEvents.length})`
      );
      for (const evolution of this._evolutionEvents) {
        const tickTime = this._formatTime(
          (evolution.tickNumber - 1) * this._baseTickSize
        );
        const absoluteTime = new Date(evolution.simulationTime).toLocaleString(
          "ko-KR"
        );
        console.log(
          `[Tick ${evolution.tickNumber}] (${tickTime} in) ${absoluteTime} - Character ${evolution.characterId}: ` +
            `${evolution.beforeCharacterName} (Phase ${evolution.beforePhase}) → ` +
            `${evolution.afterCharacterName} (Phase ${evolution.afterPhase})`
        );
      }
      console.groupEnd();
    }

    // 캐릭터별 상태 변화
    console.groupCollapsed(`📊 Character State Changes`);
    for (let i = 0; i < this._beforeStates.length; i++) {
      const before = this._beforeStates[i];
      const after = this._afterStates[i];

      if (!after) continue;

      console.groupCollapsed(
        `🐾 Character ${before.characterId} (EID: ${before.eid})`
      );

      // 캐릭터 정보 (진화 포함)
      const characterChanged = before.characterName !== after.characterName;
      console.log(
        `Character: ${before.characterName} → ${after.characterName}${
          characterChanged ? " 🎉" : ""
        }`
      );

      // 기본 상태 변화
      console.log(
        `State: ${before.state} → ${after.state}${
          before.state !== after.state ? " ✨" : ""
        }`
      );
      console.log(
        `Stamina: ${before.stamina} → ${after.stamina}${this._getChangeIcon(
          before.stamina,
          after.stamina
        )}`
      );

      // 진화 정보 (Phase 변화가 있으면 강조)
      const phaseChanged = before.evolutionPhase !== after.evolutionPhase;
      console.log(
        `Evolution: ${before.evolutionGage.toFixed(
          1
        )} → ${after.evolutionGage.toFixed(1)}${this._getChangeIcon(
          before.evolutionGage,
          after.evolutionGage
        )} ` +
          `(Phase ${before.evolutionPhase} → ${after.evolutionPhase}${
            phaseChanged ? " 🎉" : ""
          })`
      );

      // 위치 변화
      const positionChanged =
        before.position.x !== after.position.x ||
        before.position.y !== after.position.y;
      console.log(
        `Position: (${before.position.x}, ${before.position.y}) → (${
          after.position.x
        }, ${after.position.y})${positionChanged ? " 🚶" : ""}`
      );

      // 상태 변화
      const beforeStatusSet = new Set(before.statuses);
      const afterStatusSet = new Set(after.statuses);

      const addedStatuses = after.statuses.filter(
        (s) => !beforeStatusSet.has(s)
      );
      const removedStatuses = before.statuses.filter(
        (s) => !afterStatusSet.has(s)
      );

      if (addedStatuses.length > 0 || removedStatuses.length > 0) {
        console.log(`Status Changes:`);
        if (addedStatuses.length > 0) {
          console.log(`  + Added: ${addedStatuses.join(", ")} ⚡`);
        }
        if (removedStatuses.length > 0) {
          console.log(`  - Removed: ${removedStatuses.join(", ")} ✅`);
        }
      } else {
        console.log(
          `Status: ${
            after.statuses.length > 0 ? after.statuses.join(", ") : "Normal"
          } (no changes)`
        );
      }

      console.groupEnd();
    }
    console.groupEnd();

    console.groupEnd();
  }

  /**
   * 수치 변화에 따른 아이콘 반환
   */
  private _getChangeIcon(before: number, after: number): string {
    if (after > before) return " ⬆️";
    if (after < before) return " ⬇️";
    return "";
  }

  /**
   * 시간을 읽기 쉬운 형태로 포맷팅
   */
  private _formatTime(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    }

    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return remainingSeconds > 0
        ? `${minutes}m ${remainingSeconds}s`
        : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  }
}

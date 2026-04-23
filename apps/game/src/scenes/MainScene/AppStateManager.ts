import { MainSceneWorld } from "./world";
import { ObjectType } from "./types";
import {
  GAME_CONSTANTS,
  getUrgentDeathDelayMsByCharacterKey,
} from "./config";
import {
  CharacterStatusComp,
  DigestiveSystemComp,
  DiseaseSystemComp,
  VitalityComp,
  FreshnessTimerComp,
  ObjectComp,
} from "./raw-components";
import { defineQuery, hasComponent, addComponent } from "bitecs";

const characterQuery = defineQuery([ObjectComp, CharacterStatusComp]);
const foodQuery = defineQuery([ObjectComp, FreshnessTimerComp]);

/**
 * 앱 상태 관리자
 * 앱의 일시정지/재개 상태를 추적하고 시간 동기화를 처리
 */
export class AppStateManager {
  private lastActiveTime: number = 0;
  private isFirstLoad: boolean = true;
  private world: MainSceneWorld;
  private cleanup?: () => void;

  constructor(world: MainSceneWorld) {
    this.world = world;
    this.lastActiveTime = Date.now();

    // 브라우저 이벤트 리스너 등록
    this.setupEventListeners();
  }

  /**
   * 브라우저 생명주기 이벤트 리스너 설정
   */
  private setupEventListeners(): void {
    // 페이지 가시성 변화 감지
    const handleVisibilityChange = () => {
      if (document.hidden) {
        this.onAppPause();
      } else {
        this.onAppResume();
      }
    };

    // 페이지 언로드 시
    const handleBeforeUnload = () => {
      this.onAppPause();
    };

    // 페이지 포커스 변화
    const handleBlur = () => {
      this.onAppPause();
    };

    const handleFocus = () => {
      this.onAppResume();
    };

    // 이벤트 리스너 등록
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    // 정리용으로 참조 저장
    this.cleanup = () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }

  /**
   * 앱이 비활성화될 때 호출
   */
  public onAppPause(): void {
    this.lastActiveTime = Date.now();
    console.log(
      "[AppStateManager] App paused at:",
      new Date(this.lastActiveTime)
    );
  }

  /**
   * 앱이 다시 활성화될 때 호출
   */
  public onAppResume(): void {
    const currentTime = Date.now();

    if (!this.isFirstLoad && this.lastActiveTime > 0) {
      const timeElapsed = currentTime - this.lastActiveTime;

      // 너무 오래된 시간은 무시 (1일 이상)
      if (timeElapsed > 24 * 60 * 60 * 1000) {
        console.log("=== AppStateManager ===");
        console.log("❌ 시간이 1일을 초과하여 동기화를 건너뜁니다.");
        console.log(
          `마지막 활성: ${new Date(this.lastActiveTime).toLocaleString(
            "ko-KR"
          )}`
        );
        return;
      }

      // 상세한 로그 출력
      this.logResumeDetails(currentTime, timeElapsed);
      this.syncTimeBasedProgress(currentTime, timeElapsed);
    }

    this.isFirstLoad = false;
    this.lastActiveTime = currentTime;
  }

  /**
   * 재진입 상세 정보 로그
   */
  private logResumeDetails(currentTime: number, timeElapsed: number): void {
    console.log("=== AppStateManager 앱 재진입 ===");

    const pauseDate = new Date(this.lastActiveTime);
    const resumeDate = new Date(currentTime);

    console.log(`🕐 앱 중단 시간: ${pauseDate.toLocaleString("ko-KR")}`);
    console.log(`🕐 앱 복귀 시간: ${resumeDate.toLocaleString("ko-KR")}`);

    const minutes = Math.floor(timeElapsed / (1000 * 60));
    const seconds = Math.floor((timeElapsed % (1000 * 60)) / 1000);
    console.log(`⏱️  중단 지속 시간: ${minutes}분 ${seconds}초`);
  }

  /**
   * 시간 기반 진행사항 동기화
   */
  private syncTimeBasedProgress(
    currentTime: number,
    timeElapsed: number
  ): void {
    console.log("📊 [AppStateManager] 시간 기반 진행사항 동기화 시작...");

    // 캐릭터 상태 동기화
    this.syncCharacterProgress(currentTime, timeElapsed);

    // 음식 신선도 동기화
    this.syncFoodFreshness(currentTime, timeElapsed);

    console.log("✅ [AppStateManager] 시간 기반 진행사항 동기화 완료");
  }

  /**
   * 캐릭터 진행사항 동기화
   */
  private syncCharacterProgress(
    currentTime: number,
    timeElapsed: number
  ): void {
    const characters = characterQuery(this.world);

    for (let i = 0; i < characters.length; i++) {
      const eid = characters[i];

      if (ObjectComp.type[eid] !== ObjectType.CHARACTER) continue;

      // 스테미나 감소 처리 (30초 간격 - 실제 게임과 동일)
      const staminaDecreaseIntervals = Math.floor(
        timeElapsed / GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL
      );
      if (staminaDecreaseIntervals > 0) {
        console.log(
          `[스테미나 동기화] Character ${eid}: ${staminaDecreaseIntervals}번의 스테미나 감소 필요`
        );

        // 현재 질병 상태 확인
        const diseaseComp = hasComponent(this.world, DiseaseSystemComp, eid)
          ? DiseaseSystemComp
          : null;
        const sickStartTime = diseaseComp ? diseaseComp.sickStartTime[eid] : 0;

        const pauseStartTime = this.lastActiveTime;
        let totalDecrease = 0;

        // 각 간격별로 질병 상태를 확인하여 스테미나 감소량 계산
        for (
          let interval = 0;
          interval < staminaDecreaseIntervals;
          interval++
        ) {
          const intervalTime =
            pauseStartTime +
            interval * GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL;
          const wasSickAtInterval =
            sickStartTime > 0 && intervalTime >= sickStartTime;

          // 질병 상태에 따른 감소량 결정
          const decreaseAmount = wasSickAtInterval
            ? GAME_CONSTANTS.STAMINA_DECREASE_AMOUNT * 2
            : GAME_CONSTANTS.STAMINA_DECREASE_AMOUNT;

          totalDecrease += decreaseAmount;

          const intervalTimeStr = new Date(intervalTime).toLocaleString(
            "ko-KR"
          );
          console.log(
            `  - ${intervalTimeStr}: 스테미나 ${decreaseAmount} 감소 ${
              wasSickAtInterval ? "(질병으로 2배)" : "(정상)"
            }`
          );
        }

        const currentStamina = CharacterStatusComp.stamina[eid];
        const newStamina = Math.max(0, currentStamina - totalDecrease);
        CharacterStatusComp.stamina[eid] = newStamina;
        console.log(
          `[스테미나 최종] Character ${eid}: ${currentStamina} → ${newStamina} (총 ${totalDecrease} 감소)`
        );

        // 스테미나가 0이 되었다면 urgent 상태 및 death 타이머 체크
        if (newStamina <= 0 && currentStamina > 0) {
          // 스테미나가 0이 된 시점 계산 (어느 간격에서 0이 되었는지)
          let cumulativeDecrease = 0;
          let urgentTriggeredTime = 0;

          for (
            let interval = 0;
            interval < staminaDecreaseIntervals;
            interval++
          ) {
            const intervalTime =
              pauseStartTime +
              interval * GAME_CONSTANTS.STAMINA_DECREASE_INTERVAL;
            const wasSickAtInterval =
              sickStartTime > 0 && intervalTime >= sickStartTime;
            const decreaseAmount = wasSickAtInterval
              ? GAME_CONSTANTS.STAMINA_DECREASE_AMOUNT * 2
              : GAME_CONSTANTS.STAMINA_DECREASE_AMOUNT;

            cumulativeDecrease += decreaseAmount;

            if (
              currentStamina - cumulativeDecrease <= 0 &&
              urgentTriggeredTime === 0
            ) {
              urgentTriggeredTime = intervalTime;
              break;
            }
          }

          // VitalityComp에 urgent 시작 시간 설정
          if (!hasComponent(this.world, VitalityComp, eid)) {
            addComponent(this.world, VitalityComp, eid);
            VitalityComp.urgentStartTime[eid] = 0;
            VitalityComp.deathTime[eid] = 0;
            VitalityComp.isDead[eid] = 0;
          }

          VitalityComp.urgentStartTime[eid] = urgentTriggeredTime;
          const deathTime =
            urgentTriggeredTime +
            getUrgentDeathDelayMsByCharacterKey(
              CharacterStatusComp.characterKey[eid],
            );
          VitalityComp.deathTime[eid] = deathTime;

          const urgentTimeStr = new Date(urgentTriggeredTime).toLocaleString(
            "ko-KR"
          );
          const deathTimeStr = new Date(deathTime).toLocaleString("ko-KR");

          console.log(
            `[Death 체크] Character ${eid}: ${urgentTimeStr}에 urgent 상태 진입`
          );

          // 현재 시간이 이미 death 시간을 넘었다면 즉시 죽음 처리
          if (currentTime >= deathTime) {
            VitalityComp.isDead[eid] = 1;
            console.log(
              `[Death 체크] Character ${eid}: ${deathTimeStr}에 사망 (앱 중단 중 사망)`
            );
          } else {
            console.log(
              `[Death 체크] Character ${eid}: ${deathTimeStr}에 사망 예정`
            );
          }
        }
      }

      // 질병 시스템 동기화
      this.syncDiseaseSystem(eid, currentTime, timeElapsed);

      // 소화기관 동기화
      this.syncDigestiveSystem(eid, currentTime, timeElapsed);

      // 생존 상태 동기화
      this.syncVitalitySystem(eid, currentTime, timeElapsed);
    }
  }

  /**
   * 질병 시스템 동기화
   */
  private syncDiseaseSystem(
    eid: number,
    currentTime: number,
    timeElapsed: number
  ): void {
    if (!hasComponent(this.world, DiseaseSystemComp, eid)) {
      addComponent(this.world, DiseaseSystemComp, eid);
      DiseaseSystemComp.nextCheckTime[eid] =
        currentTime + GAME_CONSTANTS.DISEASE_CHECK_INTERVAL;
      DiseaseSystemComp.sickStartTime[eid] = 0;
    }

    // 질병 체크 시간 조정
    const missedChecks = Math.floor(
      timeElapsed / GAME_CONSTANTS.DISEASE_CHECK_INTERVAL
    );
    if (missedChecks > 0) {
      // 놓친 체크 횟수만큼 즉시 체크하도록 시간 조정
      DiseaseSystemComp.nextCheckTime[eid] = currentTime;
      console.log(
        `[AppStateManager] Character ${eid} missed ${missedChecks} disease checks`
      );
    }
  }

  /**
   * 소화기관 동기화
   */
  private syncDigestiveSystem(
    eid: number,
    _currentTime: number,
    _timeElapsed: number
  ): void {
    if (!hasComponent(this.world, DigestiveSystemComp, eid)) {
      addComponent(this.world, DigestiveSystemComp, eid);
      DigestiveSystemComp.capacity[eid] = GAME_CONSTANTS.DIGESTIVE_CAPACITY;
      DigestiveSystemComp.currentLoad[eid] = 0;
      DigestiveSystemComp.nextPoopTime[eid] = 0;
      DigestiveSystemComp.nextSmallPoopTime[eid] = 0;
    }
  }

  /**
   * 생존 상태 동기화
   */
  private syncVitalitySystem(
    eid: number,
    currentTime: number,
    _timeElapsed: number
  ): void {
    if (!hasComponent(this.world, VitalityComp, eid)) {
      addComponent(this.world, VitalityComp, eid);
      VitalityComp.urgentStartTime[eid] = 0;
      VitalityComp.deathTime[eid] = 0;
      VitalityComp.isDead[eid] = 0;
    }

    // urgent 상태였다면 죽음 시간 재계산
    const urgentStartTime = VitalityComp.urgentStartTime[eid];
    if (urgentStartTime > 0) {
      const urgentDuration = currentTime - urgentStartTime;
      const urgentDeathDelay = getUrgentDeathDelayMsByCharacterKey(
        CharacterStatusComp.characterKey[eid],
      );

      if (urgentDuration >= urgentDeathDelay) {
        // 죽음 시간이 지났다면 즉시 죽음 처리
        VitalityComp.deathTime[eid] = currentTime;
        console.log(
          `[AppStateManager] Character ${eid} should die due to extended urgent state`
        );
      } else {
        // 아직 죽음 시간이 안 됐다면 남은 시간 계산
        VitalityComp.deathTime[eid] = urgentStartTime + urgentDeathDelay;
      }
    }
  }

  /**
   * 음식 신선도 동기화
   */
  private syncFoodFreshness(_currentTime: number, timeElapsed: number): void {
    const foods = foodQuery(this.world);
    let processedCount = 0;

    for (let i = 0; i < foods.length; i++) {
      const eid = foods[i];

      if (ObjectComp.type[eid] !== ObjectType.FOOD) continue;

      // 생성 시간을 과거로 조정하여 신선도 변화 반영
      const originalCreatedTime = FreshnessTimerComp.createdTime[eid];
      const adjustedCreatedTime = originalCreatedTime - timeElapsed;
      FreshnessTimerComp.createdTime[eid] = adjustedCreatedTime;

      processedCount++;
    }

    if (processedCount > 0) {
      const minutes = Math.floor(timeElapsed / (1000 * 60));
      console.log(
        `🍎 [AppStateManager] ${processedCount}개 음식 신선도 ${minutes}분 조정`
      );
    }
  }

  /**
   * 정리 작업
   */
  public destroy(): void {
    // 이벤트 리스너 제거
    if (this.cleanup) {
      this.cleanup();
    }
  }

  /**
   * 현재 상태 정보 반환
   */
  public getState() {
    return {
      lastActiveTime: this.lastActiveTime,
      isFirstLoad: this.isFirstLoad,
      isActive: !document.hidden,
    };
  }
}

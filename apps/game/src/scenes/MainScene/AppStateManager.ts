import { MainSceneWorld } from "./world";
import { ObjectType } from "./types";
import { GAME_CONSTANTS } from "./config";
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
        console.log("[AppStateManager] Time elapsed too long, skipping sync");
        return;
      }

      console.log(
        `[AppStateManager] App resumed after ${Math.floor(
          timeElapsed / 1000
        )} seconds`
      );
      this.syncTimeBasedProgress(currentTime, timeElapsed);
    }

    this.isFirstLoad = false;
    this.lastActiveTime = currentTime;
  }

  /**
   * 시간 기반 진행사항 동기화
   */
  private syncTimeBasedProgress(
    currentTime: number,
    timeElapsed: number
  ): void {
    console.log("[AppStateManager] Syncing time-based progress...");

    // 캐릭터 상태 동기화
    this.syncCharacterProgress(currentTime, timeElapsed);

    // 음식 신선도 동기화
    this.syncFoodFreshness(currentTime, timeElapsed);

    console.log("[AppStateManager] Time-based progress sync completed");
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

      // 스테미나 감소 (시간당 1씩 감소)
      const staminaDecrease = Math.floor(timeElapsed / (60 * 60 * 1000)); // 1시간마다 1씩
      if (staminaDecrease > 0) {
        const currentStamina = CharacterStatusComp.stamina[eid];
        const newStamina = Math.max(0, currentStamina - staminaDecrease);
        CharacterStatusComp.stamina[eid] = newStamina;
        console.log(
          `[AppStateManager] Character ${eid} stamina: ${currentStamina} -> ${newStamina}`
        );
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
    currentTime: number,
    timeElapsed: number
  ): void {
    if (!hasComponent(this.world, DigestiveSystemComp, eid)) {
      addComponent(this.world, DigestiveSystemComp, eid);
      DigestiveSystemComp.capacity[eid] = GAME_CONSTANTS.DIGESTIVE_CAPACITY;
      DigestiveSystemComp.currentLoad[eid] = 0;
      DigestiveSystemComp.nextPoopTime[eid] = 0;
    }

    // 소화기관 내용물 자연 감소 (시간당 0.5씩)
    const digestiveDecrease = (timeElapsed / (60 * 60 * 1000)) * 0.5;
    if (digestiveDecrease > 0) {
      const currentLoad = DigestiveSystemComp.currentLoad[eid];
      const newLoad = Math.max(0, currentLoad - digestiveDecrease);
      DigestiveSystemComp.currentLoad[eid] = newLoad;

      console.log(
        `[AppStateManager] Character ${eid} digestive load: ${currentLoad.toFixed(
          2
        )} -> ${newLoad.toFixed(2)}`
      );

      // 소화기관이 비어있으면 똥 타이머 초기화
      if (newLoad === 0) {
        DigestiveSystemComp.nextPoopTime[eid] = 0;
      }
    }
  }

  /**
   * 생존 상태 동기화
   */
  private syncVitalitySystem(
    eid: number,
    currentTime: number,
    timeElapsed: number
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
      if (urgentDuration >= GAME_CONSTANTS.DEATH_DELAY) {
        // 죽음 시간이 지났다면 즉시 죽음 처리
        VitalityComp.deathTime[eid] = currentTime;
        console.log(
          `[AppStateManager] Character ${eid} should die due to extended urgent state`
        );
      } else {
        // 아직 죽음 시간이 안 됐다면 남은 시간 계산
        VitalityComp.deathTime[eid] =
          urgentStartTime + GAME_CONSTANTS.DEATH_DELAY;
      }
    }
  }

  /**
   * 음식 신선도 동기화
   */
  private syncFoodFreshness(currentTime: number, timeElapsed: number): void {
    const foods = foodQuery(this.world);

    for (let i = 0; i < foods.length; i++) {
      const eid = foods[i];

      if (ObjectComp.type[eid] !== ObjectType.FOOD) continue;

      // 생성 시간을 과거로 조정하여 신선도 변화 반영
      const originalCreatedTime = FreshnessTimerComp.createdTime[eid];
      const adjustedCreatedTime = originalCreatedTime - timeElapsed;
      FreshnessTimerComp.createdTime[eid] = adjustedCreatedTime;

      console.log(
        `[AppStateManager] Food ${eid} creation time adjusted by ${Math.floor(
          timeElapsed / 1000
        )} seconds`
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

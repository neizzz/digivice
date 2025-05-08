import { CharacterKey } from "../types/Character";
import { GameDataManager } from "./GameDataManager";
import { EventBus, EventTypes } from "./EventBus";
import { CHARACTER_EVOLUTION, CHARACTER_STATUS } from "../config";
import type { GameData } from "types/GameData";

/**
 * 시간 경과에 따른 게임 상태 변화를 관리하는 클래스
 * - 앱이 포그라운드일 때: 프레임 기반 tick으로 상태 체크
 * - 앱이 백그라운드에서 돌아왔을 때: 경과 시간 계산하여 한번에 상태 업데이트
 */
export class TimeManager {
  private static instance: TimeManager;
  private lastTickTime: number = Date.now();
  private lastEggCheckTime: number = Date.now();
  private lastSicknessCheckTime: number = Date.now();
  private lastStaminaDecreaseTime: number = Date.now();
  private lastDeathCheckTime: number = Date.now();
  private isRunning = false;

  // 각 체크 항목별 다음 체크 시간 (변동성 적용)
  private nextSicknessCheckInterval: number = this.getRandomInterval(
    CHARACTER_STATUS.SICKNESS_CHECK_INTERVAL
  );
  private nextStaminaDecreaseInterval: number = this.getRandomInterval(
    CHARACTER_STATUS.STAMINA_DECREASE_INTERVAL
  );
  private nextDeathCheckInterval: number = this.getRandomInterval(
    CHARACTER_STATUS.DEATH_CHECK_INTERVAL
  );

  // 최대 변동 비율 (20%)
  private readonly MAX_VARIATION_PERCENT = 0.2;

  /**
   * 생성자 - 싱글톤 패턴으로 구현
   */
  private constructor() {
    this.setupEventListeners();
  }

  /**
   * 싱글톤 인스턴스 반환
   */
  public static getInstance(): TimeManager {
    if (!TimeManager.instance) {
      TimeManager.instance = new TimeManager();
    }
    return TimeManager.instance;
  }

  /**
   * 이벤트 리스너 설정
   */
  private setupEventListeners(): void {
    // 앱이 백그라운드에서 포그라운드로 돌아왔을 때 호출될 이벤트 리스너
    EventBus.subscribe(EventTypes.APP_RESUME, (data) => {
      this.onAppResume(data.timestamp);
    });
  }

  /**
   * 시간 경과 체크 시작
   */
  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTickTime = Date.now();
    this.lastEggCheckTime = Date.now();
    this.lastSicknessCheckTime = Date.now();
    this.lastStaminaDecreaseTime = Date.now();
    this.lastDeathCheckTime = Date.now();

    // 시스템 시작 시 모든 랜덤 값 초기화
    this.refreshRandomIntervals();

    console.log("TimeManager 시작됨");
  }

  /**
   * 시간 경과 체크 중지
   */
  public stop(): void {
    this.isRunning = false;
    console.log("TimeManager 중지됨");
  }

  /**
   * 매 프레임마다 호출되어 시간 경과 체크
   */
  public update(deltaTime: number): void {
    if (!this.isRunning) return;

    const now = Date.now();
    const elapsedTime = now - this.lastTickTime;

    // 시간 경과 이벤트 발행
    EventBus.publish(EventTypes.TIME_TICK, { elapsedTime });

    // 각 상태 체크
    this.checkEvolution(now);
    this.checkSickness(now);
    this.checkStaminaDecrease(now);
    this.checkDeath(now);

    this.lastTickTime = now;
  }

  /**
   * 앱이 백그라운드에서 포그라운드로 돌아왔을 때 호출
   * @param resumeTimestamp 앱이 재개된 시간 (밀리초)
   */
  private async onAppResume(resumeTimestamp: number): Promise<void> {
    const gameData = await GameDataManager.loadData();
    if (!gameData) return;

    const lastSavedAt = gameData.lastSavedAt;
    const elapsedTime = resumeTimestamp - lastSavedAt;

    console.log(
      `앱이 ${elapsedTime}ms 동안 백그라운드에 있었습니다. 상태 체크 수행...`
    );

    // 각 상태 일괄 체크
    await this.processBackgroundEvolution(gameData, elapsedTime);
    await this.processBackgroundSickness(gameData, elapsedTime);
    await this.processBackgroundStaminaDecrease(gameData, elapsedTime);
    await this.processBackgroundDeath(gameData, elapsedTime);

    // 마지막 저장 시간 업데이트
    await GameDataManager.updateData({ lastSavedAt: resumeTimestamp });

    this.resetCheckTimes(resumeTimestamp);
  }

  /**
   * 체크 시간 초기화
   */
  private resetCheckTimes(timestamp: number): void {
    this.lastTickTime = timestamp;
    this.lastEggCheckTime = timestamp;
    this.lastSicknessCheckTime = timestamp;
    this.lastStaminaDecreaseTime = timestamp;
    this.lastDeathCheckTime = timestamp;
  }

  /**
   * 캐릭터 진화 체크
   */
  private async checkEvolution(currentTime: number): Promise<void> {
    const gameData = await GameDataManager.loadData();
    if (!gameData) return;

    // 이미 진화했거나 알이 아니면 체크하지 않음
    if (gameData.character.key !== "egg") return;

    const elapsedSinceCreation = currentTime - gameData.createdAt;

    // 진화 시간에 변동성을 적용
    const evolutionTime = this.getRandomInterval(
      CHARACTER_EVOLUTION.EGG_END_TIME
    );

    // 진화 시간이 되었는지 체크
    if (elapsedSinceCreation >= evolutionTime) {
      await this.evolveFromEgg(gameData);
    }
  }

  /**
   * 백그라운드에서의 캐릭터 진화 처리
   */
  private async processBackgroundEvolution(
    gameData: GameData,
    acceleratedTime: number
  ): Promise<void> {
    // 이미 진화했거나 알이 아니면 체크하지 않음
    if (gameData.character.key !== "egg") return;

    const elapsedSinceCreation =
      Date.now() - (gameData.character.evolvedAt as number);

    // 진화 시간에 변동성을 적용
    const evolutionTime = this.getRandomInterval(
      CHARACTER_EVOLUTION.EGG_END_TIME
    );

    // 진화 시간이 되었는지 체크
    if (elapsedSinceCreation >= evolutionTime) {
      await this.evolveFromEgg(gameData);
    }
  }

  /**
   * 알에서 캐릭터로 진화
   */
  private async evolveFromEgg(gameData: GameData): Promise<void> {
    // 기본 캐릭터로 진화 (현재는 GreenSlime으로 고정)
    const newCharacterKey = CharacterKey.GreenSlime;

    // 게임 데이터 업데이트
    await GameDataManager.updateData({
      character: {
        ...gameData.character,
        key: newCharacterKey,
        evolvedAt: Date.now(),
      },
    });

    // 진화 이벤트 발행
    EventBus.publish(EventTypes.CHARACTER_EVOLUTION, {
      newForm: newCharacterKey,
    });

    console.log(`알이 ${newCharacterKey}(으)로 진화했습니다!`);
  }

  /**
   * 질병 발생 체크
   */
  private async checkSickness(currentTime: number): Promise<void> {
    // 정해진 주기마다 체크
    if (
      currentTime - this.lastSicknessCheckTime <
      this.nextSicknessCheckInterval
    ) {
      return;
    }

    const gameData = await GameDataManager.loadData();
    if (!gameData) return;

    // 이미 아프거나 죽은 상태면 체크하지 않음
    if (gameData.status.sick || gameData.status.dead) return;

    // 확률로 질병 발생
    if (Math.random() < CHARACTER_STATUS.SICKNESS_PROBABILITY) {
      await this.makeSick(gameData);
    }

    this.lastSicknessCheckTime = currentTime;
    this.nextSicknessCheckInterval = this.getRandomInterval(
      CHARACTER_STATUS.SICKNESS_CHECK_INTERVAL
    );
  }

  /**
   * 백그라운드에서의 질병 발생 처리
   */
  private async processBackgroundSickness(
    gameData: GameData,
    acceleratedTime: number
  ): Promise<void> {
    // 이미 아프거나 죽은 상태면 체크하지 않음
    if (gameData.status.sick || gameData.status.dead) return;

    // 경과 시간 동안 몇 번의 체크가 있었을지 계산
    const checkCount = Math.floor(
      acceleratedTime / CHARACTER_STATUS.SICKNESS_CHECK_INTERVAL
    );

    // 각 체크마다 병 걸릴 확률 계산
    // 전체 기간 동안 한 번도 병에 걸리지 않을 확률 = (1 - 발병확률)^체크횟수
    // 하나라도 발병할 확률 = 1 - (전체 기간 동안 한 번도 병에 걸리지 않을 확률)
    const sicknessOccurenceProbability =
      1 - (1 - CHARACTER_STATUS.SICKNESS_PROBABILITY) ** checkCount;

    // 계산된 확률로 질병 발생
    if (Math.random() < sicknessOccurenceProbability) {
      await this.makeSick(gameData);
    }
  }

  /**
   * 캐릭터 질병 발생시키기
   */
  private async makeSick(gameData: GameData): Promise<void> {
    // 질병 상태로 변경
    await GameDataManager.updateData({
      status: {
        ...gameData.status,
        sick: true,
      },
    });

    // 질병 발생 이벤트 발행
    EventBus.publish(EventTypes.CHARACTER_SICKNESS, {
      sicknessType: "common", // 기본 질병 타입
    });

    console.log("캐릭터가 아프게 되었습니다!");
  }

  /**
   * 스태미나 감소 체크
   */
  private async checkStaminaDecrease(currentTime: number): Promise<void> {
    // 정해진 주기마다 체크
    if (
      currentTime - this.lastStaminaDecreaseTime <
      this.nextStaminaDecreaseInterval
    ) {
      return;
    }

    const gameData = await GameDataManager.loadData();
    if (!gameData) return;

    // 이미 죽은 상태면 체크하지 않음
    if (gameData.status.dead) return;

    // 스태미나 감소 처리
    const currentStamina = gameData.status.stamina;
    const newStamina = Math.max(
      0,
      currentStamina - CHARACTER_STATUS.STAMINA_DECREASE_AMOUNT
    );

    if (newStamina !== currentStamina) {
      // 변경이 있을 때만 업데이트
      await GameDataManager.updateData({
        status: {
          ...gameData.status,
          stamina: newStamina,
        },
      });

      // 스태미나 변경 이벤트 발행
      EventBus.publish(EventTypes.STAMINA_CHANGED, {
        current: newStamina,
        max: 10, // TODO: 캐릭터별 최대 스태미나 동적으로 가져오기
      });

      console.log(
        `스태미나가 감소했습니다: ${currentStamina} -> ${newStamina}`
      );
    }

    this.lastStaminaDecreaseTime = currentTime;
    this.nextStaminaDecreaseInterval = this.getRandomInterval(
      CHARACTER_STATUS.STAMINA_DECREASE_INTERVAL
    );
  }

  /**
   * 백그라운드에서의 스태미나 감소 처리
   */
  private async processBackgroundStaminaDecrease(
    gameData: GameData,
    acceleratedTime: number
  ): Promise<void> {
    // 이미 죽은 상태면 체크하지 않음
    if (gameData.status.dead) return;

    // 경과 시간 동안 몇 번의 스태미나 감소가 있었을지 계산
    const decreaseCount = Math.floor(
      acceleratedTime / CHARACTER_STATUS.STAMINA_DECREASE_INTERVAL
    );

    if (decreaseCount > 0) {
      const currentStamina = gameData.status.stamina;
      const decreaseAmount =
        decreaseCount * CHARACTER_STATUS.STAMINA_DECREASE_AMOUNT;
      const newStamina = Math.max(0, currentStamina - decreaseAmount);

      if (newStamina !== currentStamina) {
        // 변경이 있을 때만 업데이트
        await GameDataManager.updateData({
          status: {
            ...gameData.status,
            stamina: newStamina,
          },
        });

        // 스태미나 변경 이벤트 발행
        EventBus.publish(EventTypes.STAMINA_CHANGED, {
          current: newStamina,
          max: 10, // TODO: 캐릭터별 최대 스태미나 동적으로 가져오기
        });

        console.log(
          `백그라운드 중 스태미나 감소: ${currentStamina} -> ${newStamina} (${decreaseCount}회)`
        );
      }
    }
  }

  /**
   * 죽음 체크
   */
  private async checkDeath(currentTime: number): Promise<void> {
    // 정해진 주기마다 체크
    if (currentTime - this.lastDeathCheckTime < this.nextDeathCheckInterval) {
      return;
    }

    const gameData = await GameDataManager.loadData();
    if (!gameData) return;

    // 이미 죽은 상태면 체크하지 않음
    if (gameData.status.dead) return;

    // 스태미나 0 또는 아픈 상태인 경우 죽음 확인
    const isDying =
      gameData.status.stamina <= 0 ||
      (gameData.status.sick &&
        Math.random() < CHARACTER_STATUS.DEATH_PROBABILITY_SICK);

    if (isDying) {
      await this.killCharacter(gameData);
    }

    this.lastDeathCheckTime = currentTime;
    this.nextDeathCheckInterval = this.getRandomInterval(
      CHARACTER_STATUS.DEATH_CHECK_INTERVAL
    );
  }

  /**
   * 백그라운드에서의 죽음 체크 처리
   */
  private async processBackgroundDeath(
    gameData: GameData,
    acceleratedTime: number
  ): Promise<void> {
    // 이미 죽은 상태면 체크하지 않음
    if (gameData.status.dead) return;

    // 스태미나 0이면 즉시 죽음
    if (gameData.status.stamina <= 0) {
      await this.killCharacter(gameData);
      return;
    }

    // 아픈 상태인 경우 죽음 확률 계산
    if (gameData.status.sick) {
      // 경과 시간 동안 몇 번의 죽음 체크가 있었을지 계산
      const checkCount = Math.floor(
        acceleratedTime / CHARACTER_STATUS.DEATH_CHECK_INTERVAL
      );

      // 전체 기간 동안 한 번도 죽지 않을 확률 = (1 - 죽음확률)^체크횟수
      // 하나라도 죽을 확률 = 1 - (전체 기간 동안 한 번도 죽지 않을 확률)
      const deathOccurenceProbability =
        1 - (1 - CHARACTER_STATUS.DEATH_PROBABILITY_SICK) ** checkCount;

      if (Math.random() < deathOccurenceProbability) {
        await this.killCharacter(gameData);
      }
    }
  }

  /**
   * 캐릭터 죽음 처리
   */
  private async killCharacter(gameData: GameData): Promise<void> {
    // 죽음 상태로 변경
    await GameDataManager.updateData({
      status: {
        ...gameData.status,
        dead: true,
      },
    });

    // 죽음 이벤트 발행
    EventBus.publish(EventTypes.CHARACTER_DEATH, undefined);

    console.log("캐릭터가 사망했습니다!");
  }

  /**
   * 랜덤한 시간 간격을 생성하는 유틸리티 함수 (최대 ±20% 변동)
   * @param baseInterval 기본 시간 간격
   * @returns 랜덤하게 변동된 시간 간격
   */
  private getRandomInterval(baseInterval: number): number {
    // 기본값의 ±20% 범위 내에서 랜덤값 생성
    const variation = baseInterval * this.MAX_VARIATION_PERCENT;
    return baseInterval + (Math.random() * 2 - 1) * variation;
  }

  /**
   * 각 체크 항목의 간격을 새로 갱신하는 함수
   */
  private refreshRandomIntervals(): void {
    this.nextSicknessCheckInterval = this.getRandomInterval(
      CHARACTER_STATUS.SICKNESS_CHECK_INTERVAL
    );
    this.nextStaminaDecreaseInterval = this.getRandomInterval(
      CHARACTER_STATUS.STAMINA_DECREASE_INTERVAL
    );
    this.nextDeathCheckInterval = this.getRandomInterval(
      CHARACTER_STATUS.DEATH_CHECK_INTERVAL
    );

    console.log(`INTERVAL 변동성 적용됨: 
      질병체크: ${Math.round(this.nextSicknessCheckInterval / 60000)}분,
      스태미나감소: ${Math.round(this.nextStaminaDecreaseInterval / 60000)}분,
      죽음체크: ${Math.round(this.nextDeathCheckInterval / 60000)}분
    `);
  }
}

// 편의를 위한 싱글톤 인스턴스 export
export const timeManager = TimeManager.getInstance();

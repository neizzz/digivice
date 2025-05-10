import { CharacterKey, CharacterState } from "../types/Character";
import { GameDataManager } from "./GameDataManager";
import { EventBus, EventTypes } from "../utils/EventBus";
import { CHARACTER_EVOLUTION, CHARACTER_STATUS } from "../config";
import type { GameData } from "../types/GameData";

/**
 * 시간 경과에 따른 게임 상태 변화를 관리하는 클래스
 * - 앱이 포그라운드일 때: 프레임 기반 update로 상태 체크
 * - 앱이 백그라운드에서 돌아왔을 때: 경과 시간 계산하여 한번에 상태 업데이트
 */
export class TimeManager {
  private static instance: TimeManager;
  private lastTickTime: number = Date.now();
  private lastSicknessCheckTime: number = Date.now();
  private lastStaminaDecreaseTime: number = Date.now();
  private lastDeathCheckTime: number = Date.now();
  private lastEvolutionCheckTime: number = Date.now();
  private isRunning = false;

  // 최대 변동 비율 (20%)
  private readonly MAX_VARIATION_PERCENT = 0.2;

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
  private nextEvolutionCheckInterval: number = this.getRandomInterval(
    CHARACTER_EVOLUTION.EGG_END_TIME / 10
  );

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
    this.lastSicknessCheckTime = Date.now();
    this.lastStaminaDecreaseTime = Date.now();
    this.lastDeathCheckTime = Date.now();
    this.lastEvolutionCheckTime = Date.now();

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

  public async update(delta: number): Promise<void> {
    if (!this.isRunning) return;

    const currentTime = Date.now();

    const gameData = await GameDataManager.loadData();
    if (!gameData) return;

    this.lastTickTime = currentTime;

    await this.checkEvolution(currentTime, gameData);

    // 캐릭터가 죽은 상태일 경우 아무것도 체크하지 않음
    if (gameData.character.status.state === CharacterState.DEAD) {
      return;
    }
    if (gameData.character.key === "egg") {
      return;
    }

    await this.checkSickness(currentTime, gameData);
    await this.decreaseStamina(currentTime, gameData);
    await this.checkDeath(currentTime, gameData);
  }

  /**
   * 앱이 백그라운드에서 포그라운드로 돌아왔을 때 호출
   * @param resumeTimestamp 앱이 재개된 시간 (밀리초)
   */
  private async onAppResume(resumeTimestamp: number): Promise<void> {
    const gameData = await GameDataManager.loadData();
    if (!gameData) return;

    const lastSavedAt = gameData.savedAt;
    const elapsedTime = resumeTimestamp - lastSavedAt;

    console.log(
      `앱이 ${elapsedTime}ms 동안 백그라운드에 있었습니다.\n상태 체크 수행...`
    );

    // 각 상태 일괄 체크
    if (gameData.character.status.state === CharacterState.DEAD) {
      console.log("캐릭터가 이미 죽은 상태입니다. resume시 처리 생략.");
      return;
    }

    await this.processBackground(gameData, elapsedTime);

    this.resetCheckTimes(resumeTimestamp);
  }

  /**
   * 체크 시간 초기화
   */
  private resetCheckTimes(timestamp: number): void {
    this.lastTickTime = timestamp;
    this.lastSicknessCheckTime = timestamp;
    this.lastStaminaDecreaseTime = timestamp;
    this.lastDeathCheckTime = timestamp;
    this.lastEvolutionCheckTime = timestamp;
  }

  /**
   * 다음 체크 간격이 되었는지 확인
   */
  private isTimeToCheck(
    lastCheckTime: number,
    nextInterval: number,
    currentTime: number
  ): boolean {
    return currentTime - lastCheckTime >= nextInterval;
  }

  /**
   * 진화 체크를 위한 공통 로직
   */
  private async processEvolutionCheck(
    gameData: GameData,
    currentTime: number
  ): Promise<boolean> {
    const character = gameData.character;

    return await this.processEvolution(character, currentTime);
  }

  /**
   * 캐릭터 진화 체크
   */
  private async checkEvolution(
    currentTime: number,
    gameData: GameData
  ): Promise<void> {
    // 진화 체크 간격이 되지 않았으면 넘어감
    if (
      !this.isTimeToCheck(
        this.lastEvolutionCheckTime,
        this.nextEvolutionCheckInterval,
        currentTime
      )
    )
      return;

    // 공통 진화 체크 로직 실행
    await this.processEvolutionCheck(gameData, currentTime);

    // 다음 체크 간격 업데이트
    this.lastEvolutionCheckTime = currentTime;
    this.nextEvolutionCheckInterval = this.getRandomInterval(
      CHARACTER_EVOLUTION.EGG_END_TIME
    );
  }

  /**
   * 진화 처리 로직 (일반/백그라운드 공통)
   */
  private async processEvolution(
    character: GameData["character"],
    currentTime: number
  ): Promise<boolean> {
    // egg 단계(0)에서만 진화 처리
    if (character.key !== "egg") return false;

    // 알 -> 유년기 진화 시간 계산
    const evolutionEndTime = CHARACTER_EVOLUTION.EGG_END_TIME;

    // 진화 시간이 지난 경우 진화 처리
    if (currentTime >= evolutionEndTime) {
      console.log("알이 부화합니다: 알 -> 유년기");

      // 이벤트 발송
      // FIXME: 추후에 EvolutionManager로 통합 예정
      EventBus.publish(EventTypes.CHARACTER_EVOLVED, {
        characterKey: CharacterKey.GreenSlime,
      });

      return true;
    }

    return false;
  }

  /**
   * 질병 발생 체크 (인터벌 기반)
   */
  private async checkSickness(
    currentTime: number,
    gameData: GameData
  ): Promise<void> {
    // 정해진 주기마다 체크
    if (
      !this.isTimeToCheck(
        this.lastSicknessCheckTime,
        this.nextSicknessCheckInterval,
        currentTime
      )
    ) {
      return;
    }

    console.log("질병 체크", new Date());

    // 단위 시간당 처리 로직 호출
    await this.processSickness(
      gameData,
      CHARACTER_STATUS.SICKNESS_CHECK_INTERVAL
    );

    // 다음 체크 시간 업데이트
    this.lastSicknessCheckTime = currentTime;
    this.nextSicknessCheckInterval = this.getRandomInterval(
      CHARACTER_STATUS.SICKNESS_CHECK_INTERVAL
    );
  }

  /**
   * 캐릭터 질병 발생시키기
   */
  private async makeSick(): Promise<void> {
    // 질병 상태로 변경 - 이벤트 발행으로 대체
    EventBus.publish(EventTypes.CHARACTER_STATUS_UPDATED, {
      status: {
        sick: true,
      },
    });

    console.log("캐릭터가 아프게 되었습니다!");
  }

  /**
   * 스태미나 감소 체크 (인터벌 기반)
   */
  private async decreaseStamina(
    currentTime: number,
    gameData: GameData
  ): Promise<void> {
    // 정해진 주기마다 체크
    if (
      !this.isTimeToCheck(
        this.lastStaminaDecreaseTime,
        this.nextStaminaDecreaseInterval,
        currentTime
      )
    ) {
      return;
    }

    console.log("스태미나 감소 체크", new Date());

    // 단위 시간당 처리 로직 호출
    await this.processStaminaDecrease(
      gameData,
      CHARACTER_STATUS.STAMINA_DECREASE_INTERVAL
    );

    // 다음 체크 시간 업데이트
    this.lastStaminaDecreaseTime = currentTime;
    this.nextStaminaDecreaseInterval = this.getRandomInterval(
      CHARACTER_STATUS.STAMINA_DECREASE_INTERVAL
    );
  }

  /**
   * 죽음 체크 (인터벌 기반)
   */
  private async checkDeath(
    currentTime: number,
    gameData: GameData
  ): Promise<void> {
    // 정해진 주기마다 체크
    if (
      !this.isTimeToCheck(
        this.lastDeathCheckTime,
        this.nextDeathCheckInterval,
        currentTime
      )
    ) {
      return;
    }

    console.log("죽음 체크", new Date());

    // 단위 시간당 처리 로직 호출
    await this.processDeath(gameData, CHARACTER_STATUS.DEATH_CHECK_INTERVAL);

    // 다음 체크 시간 업데이트
    this.lastDeathCheckTime = currentTime;
    this.nextDeathCheckInterval = this.getRandomInterval(
      CHARACTER_STATUS.DEATH_CHECK_INTERVAL
    );
  }

  /**
   * 죽음 처리
   */
  private async killCharacter(): Promise<void> {
    // 죽음 상태로 변경 - 이벤트 발행으로 대체
    EventBus.publish(EventTypes.CHARACTER_STATUS_UPDATED, {
      status: {
        state: CharacterState.DEAD,
      },
    });
    console.log("캐릭터가 사망했습니다!");
  }

  /**
   * 백그라운드 진행 처리 (일반 메서드로 수정)
   */
  public async processBackground(
    gameData: GameData,
    elapsedTime: number
  ): Promise<void> {
    if (!gameData) return;

    // 백그라운드에서 체크할 항목들
    await this.processStaminaDecrease(gameData, elapsedTime);
    await this.processSickness(gameData, elapsedTime);
    await this.processDeath(gameData, elapsedTime);
    await this.processEvolutionCheck(gameData, Date.now());
  }

  /**
   * 스태미나 감소 처리 (일반화된 메서드)
   */
  private async processStaminaDecrease(
    gameData: GameData,
    elapsedTime: number
  ): Promise<void> {
    // 경과 시간 동안 몇 번의 스태미나 감소가 있었을지 계산
    const decreaseCount = Math.floor(
      elapsedTime / CHARACTER_STATUS.STAMINA_DECREASE_INTERVAL
    );

    const { status } = gameData.character;

    if (decreaseCount > 0) {
      const currentStamina = status.stamina;
      const decreaseAmount =
        decreaseCount * CHARACTER_STATUS.STAMINA_DECREASE_AMOUNT;
      const newStamina = Math.max(0, currentStamina - decreaseAmount);

      if (newStamina !== currentStamina) {
        // 변경이 있을 때만 이벤트 발행
        EventBus.publish(EventTypes.CHARACTER_STATUS_UPDATED, {
          status: {
            stamina: newStamina,
          },
        });

        console.log(
          `스태미나 감소: ${currentStamina} -> ${newStamina} (${decreaseCount}회)`
        );
      }
    }
  }

  /**
   * 질병 발생 처리 (일반화된 메서드)
   */
  private async processSickness(
    gameData: GameData,
    elapsedTime: number
  ): Promise<void> {
    // 이미 아픈 상태면 체크하지 않음
    if (gameData.character.status.sick) return;

    // 경과 시간 동안 몇 번의 체크가 있었을지 계산
    const checkCount = Math.floor(
      elapsedTime / CHARACTER_STATUS.SICKNESS_CHECK_INTERVAL
    );

    // 각 체크마다 병 걸릴 확률 계산
    // 전체 기간 동안 한 번도 병에 걸리지 않을 확률 = (1 - 발병확률)^체크횟수
    // 하나라도 발병할 확률 = 1 - (전체 기간 동안 한 번도 병에 걸리지 않을 확률)
    const sicknessOccurenceProbability =
      1 - (1 - CHARACTER_STATUS.SICKNESS_PROBABILITY) ** checkCount;

    // 계산된 확률로 질병 발생
    if (Math.random() < sicknessOccurenceProbability) {
      await this.makeSick();
    }
  }

  /**
   * 죽음 체크 처리 (일반화된 메서드)
   */
  private async processDeath(
    gameData: GameData,
    elapsedTime: number
  ): Promise<void> {
    const { status } = gameData.character;

    // 스태미나 0이면 죽음
    if (status.stamina <= 0) {
      await this.killCharacter();
      return;
    }

    // 아픈 상태인 경우 죽음 확률 계산
    if (status.sick) {
      // 경과 시간 동안 몇 번의 죽음 체크가 있었을지 계산
      const checkCount = Math.floor(
        elapsedTime / CHARACTER_STATUS.DEATH_CHECK_INTERVAL
      );

      // 전체 기간 동안 한 번도 죽지 않을 확률 = (1 - 죽음확률)^체크횟수
      // 하나라도 죽을 확률 = 1 - (전체 기간 동안 한 번도 죽지 않을 확률)
      const deathOccurenceProbability =
        1 - (1 - CHARACTER_STATUS.DEATH_PROBABILITY_SICK) ** checkCount;

      if (Math.random() < deathOccurenceProbability) {
        await this.killCharacter();
      }
    }
  }

  /**
   * 랜덤 간격 계산 (기본값에 변동성 적용)
   */
  private getRandomInterval(baseInterval: number): number {
    const variation = baseInterval * this.MAX_VARIATION_PERCENT;
    return baseInterval - variation + Math.random() * variation * 2;
  }

  /**
   * 모든 랜덤 간격 새로 계산
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
    this.nextEvolutionCheckInterval = this.getRandomInterval(
      CHARACTER_EVOLUTION.EGG_END_TIME
    );
  }
}

// 편의를 위한 싱글톤 인스턴스 export
export const timeManager = TimeManager.getInstance();

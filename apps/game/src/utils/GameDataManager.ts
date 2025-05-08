import { FlutterStorage, type Storage, WebLocalStorage } from "@shared/storage";
import type { GameData } from "../types/GameData";
import { ObjectType } from "../types/GameData";
import { EventBus, EventTypes } from "./EventBus";
import { FoodFreshness } from "../entities/Food"; // FoodFreshness 임포트 추가
import { CharacterState } from "../types/Character";

class _GameDataManager {
  private data: GameData | null = null;
  private storage: Storage;
  private readonly GAME_DATA_KEY = "digivice_game_data";
  private isInitialized = false;

  constructor() {
    if (typeof window !== "undefined" && "storageController" in window) {
      this.storage = new FlutterStorage();
    } else {
      this.storage = new WebLocalStorage();
    }
  }

  // 이벤트 구독 초기화
  public initialize(): void {
    if (this.isInitialized) return;

    this.setupEventListeners();

    this.isInitialized = true;
    console.log("GameDataManager의 이벤트 구독이 초기화되었습니다.");
  }

  /**
   * 모든 이벤트 리스너를 설정합니다.
   */
  private setupEventListeners(): void {
    // 미니게임 점수 업데이트 이벤트 구독
    EventBus.subscribe(EventTypes.MINIGAME_SCORE_UPDATED, async (data) => {
      console.log("미니게임 점수 업데이트:", data);
      const currentData = await this.loadData();
      if (
        currentData &&
        data.score > currentData.minigame.flappyBird.highScore
      ) {
        currentData.minigame.flappyBird.highScore = data.score;
        await this.saveData(currentData);
      }
    });

    // 캐릭터 상태 업데이트 이벤트 구독
    EventBus.subscribe(EventTypes.CHARACTER_STATUS_UPDATED, async (data) => {
      console.log("캐릭터 상태 업데이트:", data);
      const currentData = await this.loadData();
      if (currentData) {
        const { status } = data;
        if (status === "stamina") {
          // 스태미나 관련 이벤트는 STAMINA_CHANGED에서 처리
        } else if (status === "sick") {
          currentData.status.sick = true;
          await this.saveData(currentData);
        } else if (status === "dead") {
          currentData.status.dead = true;
          await this.saveData(currentData);
        }
      }
    });

    // 스태미나 변경 이벤트 구독
    EventBus.subscribe(EventTypes.STAMINA_CHANGED, async (data) => {
      console.log("스태미나 변경:", data);
      const currentData = await this.loadData();
      if (currentData) {
        currentData.status.stamina = data.current;
        await this.saveData(currentData);
      }
    });

    // Food 생성 이벤트 구독 추가
    EventBus.subscribe(EventTypes.FOOD_CREATED, async (data) => {
      console.log("Food 생성:", data);
      const currentData = await this.loadData();
      if (currentData?.objectsMap) {
        // Food 객체 생성 및 추가 (ObjectData 구조에 맞게)
        const newFood = {
          position: data.position,
          createdAt: Date.now(),
          textureKey: data.textureKey,
          freshness: FoodFreshness.FRESH,
        };

        // Food 배열이 없으면 초기화
        if (!currentData.objectsMap[ObjectType.Food]) {
          currentData.objectsMap[ObjectType.Food] = [];
        }

        // 새 Food 추가
        currentData.objectsMap[ObjectType.Food].push(newFood);
        await this.saveData(currentData);
      }
    });

    // Food 신선도 업데이트 이벤트 구독
    EventBus.subscribe(EventTypes.FOOD_FRESHNESS_UPDATED, async (data) => {
      console.log("음식 신선도 업데이트:", data);
      const currentData = await this.loadData();
      if (currentData?.objectsMap?.[ObjectType.Food]) {
        // 해당 ID의 음식 찾기
        const foodIndex = currentData.objectsMap[ObjectType.Food].findIndex(
          (food, index) => data.foodId === index.toString()
        );

        if (foodIndex !== -1) {
          // 신선도 업데이트
          currentData.objectsMap[ObjectType.Food][foodIndex].freshness =
            data.freshness;
          await this.saveData(currentData);
        }
      }
    });

    // Poob 생성 이벤트 구독
    EventBus.subscribe(EventTypes.POOB_CREATED, async (data) => {
      console.log("Poob 생성:", data);
      const currentData = await this.loadData();
      if (currentData?.objectsMap) {
        const newPoob = {
          position: data.position,
          data: undefined,
        };

        // Poob 배열이 없으면 초기화
        if (!currentData.objectsMap[ObjectType.Poob]) {
          currentData.objectsMap[ObjectType.Poob] = [];
        }

        // 새 Poob 추가
        currentData.objectsMap[ObjectType.Poob].push(newPoob);
        await this.saveData(currentData);
      }
    });
  }

  /**
   * 초기 게임 데이터를 생성합니다.
   * @param characterKey 선택한 캐릭터 키
   * @param name 캐릭터 이름
   * @returns 생성된 게임 데이터
   */
  public async createInitialGameData(params: {
    name: string;
  }): Promise<GameData> {
    const { name } = params;
    const randomEggTextureKey = `egg_${Math.floor(Math.random() * 30)}`;
    const initialGameData: GameData = {
      name,
      createdAt: Date.now(),
      lastSavedAt: Date.now(),
      character: {
        key: "egg",
        eggTextureKey: randomEggTextureKey,
      },
      objectsMap: {
        [ObjectType.Food]: [],
        [ObjectType.Poob]: [],
      },
      coins: [],
      status: {
        lastPosition: {
          x: Number.NaN,
          y: Number.NaN,
        },
        lastState: CharacterState.IDLE,
        stamina: 10,
        dead: false,
        sick: false,
      },
      minigame: {
        flappyBird: {
          highScore: 0,
        },
      },
    };

    return await this.saveData(initialGameData);
  }

  public async saveData(data: GameData): Promise<GameData> {
    this.data = Object.freeze(data);
    await this.storage.setItem(this.GAME_DATA_KEY, JSON.stringify(data));
    return this.data;
  }

  public async loadData(): Promise<GameData | undefined> {
    if (this.data) return this.data;

    const savedData = await this.storage.getItem(this.GAME_DATA_KEY);

    if (!savedData) {
      console.warn("게임 데이터가 없습니다.");
      return undefined;
    }

    try {
      this.data = Object.freeze(JSON.parse(savedData) as GameData);
      return this.data;
    } catch (e) {
      throw new Error(`게임 데이터 로드 실패: ${e}`);
    }
  }

  public async updateData(partialData: Partial<GameData>): Promise<GameData> {
    const currentData = await this.loadData();
    const updatedData = { ...currentData, ...partialData } as GameData;
    return this.saveData(updatedData);
  }

  public async clearData(): Promise<void> {
    this.data = null;
    await this.storage.removeItem(this.GAME_DATA_KEY);
  }
}

export const GameDataManager = new _GameDataManager();

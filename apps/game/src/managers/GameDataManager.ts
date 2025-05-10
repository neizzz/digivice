import { FlutterStorage, type Storage, WebLocalStorage } from "@shared/storage";
import type { GameData } from "../types/GameData";
import { ObjectType } from "../types/GameData";
import { EventBus, EventTypes } from "../utils/EventBus";
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

      if (!currentData) {
        throw new Error("Must not to be reached: 게임 데이터가 없습니다.");
      }

      const newData = {
        ...currentData,
        character: {
          ...currentData.character,
          status: {
            ...currentData.character.status,
            ...data.status,
          },
        },
      };
      await this.saveData(newData);
    });

    // 캐릭터 진화 이벤트 구독
    EventBus.subscribe(EventTypes.CHARACTER_EVOLVED, async (data) => {
      console.log("캐릭터 진화:", data);
      const currentData = await this.loadData();

      if (!currentData) {
        throw new Error("Must not to be reached: 게임 데이터가 없습니다.");
      }

      const newData = {
        ...currentData,
        character: {
          ...currentData.character,
          key: data.characterKey,
          evolvedAt: Date.now(),
        },
      };
      await this.saveData(newData);
    });

    // Food 생성 이벤트 구독
    EventBus.subscribe(EventTypes.FOOD_CREATED, async (data) => {
      console.log("Food 생성:", data);
      const currentData = await this.loadData();
      if (currentData?.objectsMap) {
        // Food 객체 생성 및 추가 (ObjectData 구조에 맞게)
        const newFood = {
          id: data.id, // 객체의 고유 ID 저장
          position: data.position,
          createdAt: Date.now(),
          textureKey: data.textureKey,
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

    // Poob 생성 이벤트 구독
    EventBus.subscribe(EventTypes.POOB_CREATED, async (data) => {
      console.log("Poob 생성:", data);
      const currentData = await this.loadData();
      if (currentData?.objectsMap) {
        const newPoob = {
          id: data.id, // 객체의 고유 ID 저장
          position: data.position,
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

    // 음식 섭취 완료 이벤트 구독
    EventBus.subscribe(EventTypes.FOOD_EATING_FINISHED, async (data) => {
      console.log("음식 섭취 완료:", data);
      // 먹은 음식 객체 제거
      if (data.id) {
        await this.removeObjectByIdAndType(ObjectType.Food, data.id);
      }
    });

    // 오브젝트 청소 이벤트 구독 (Food, Poob 등)
    EventBus.subscribe(EventTypes.OBJECT_CLEANED, async (data) => {
      console.log("오브젝트 청소됨:", data);
      const { type, id } = data;
      await this.removeObjectByIdAndType(type, id);
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
      savedAt: Date.now(),
      character: {
        key: "egg",
        eggTextureKey: randomEggTextureKey,
        status: {
          position: {
            x: Number.NaN,
            y: Number.NaN,
          },
          state: CharacterState.IDLE,
          stamina: 6,
          sick: false,
        },
      },
      objectsMap: {
        [ObjectType.Food]: [],
        [ObjectType.Poob]: [],
      },
      coins: [],
      minigame: {
        flappyBird: {
          highScore: 0,
        },
      },
    };

    return await this.saveData(initialGameData);
  }

  public async loadData(): Promise<GameData | undefined> {
    if (this.data) return this.data;

    const savedData = await this.storage.getItem(this.GAME_DATA_KEY);

    if (!savedData) {
      console.warn("게임 데이터가 없습니다.");
      return undefined;
    }

    try {
      this.data = JSON.parse(savedData) as GameData;
      return this.data;
    } catch (e) {
      throw new Error(`게임 데이터 로드 실패: ${e}`);
    }
  }

  private async saveData(data: GameData): Promise<GameData> {
    this.data = data;
    this.data.savedAt = Date.now();
    await this.storage.setItem(this.GAME_DATA_KEY, JSON.stringify(data));
    return this.data;
  }

  public async clearData(): Promise<void> {
    this.data = null;
    await this.storage.removeItem(this.GAME_DATA_KEY);
  }

  /**
   * 타입과 ID를 기반으로 오브젝트를 게임 데이터에서 제거합니다.
   * @param type 오브젝트 타입 (Food, Poob 등)
   * @param id 제거할 오브젝트의 ID
   */
  private async removeObjectByIdAndType(
    type: ObjectType,
    id: string
  ): Promise<void> {
    const currentData = await this.loadData();
    if (!currentData?.objectsMap || !currentData.objectsMap[type]) {
      console.warn(`${type} 데이터가 존재하지 않습니다.`);
      return;
    }

    console.log(`${type} ID ${id}를 게임 데이터에서 제거합니다.`);

    // 해당 ID를 가진 오브젝트 제거

    // 타입별로 올바른 타입으로 필터링
    if (type === ObjectType.Food) {
      currentData.objectsMap[ObjectType.Food] = currentData.objectsMap[
        ObjectType.Food
      ].filter((obj) => obj.id !== id);
    } else if (type === ObjectType.Poob) {
      currentData.objectsMap[ObjectType.Poob] = currentData.objectsMap[
        ObjectType.Poob
      ].filter((obj) => obj.id !== id);
    }

    // 변경된 데이터 저장
    await this.saveData(currentData);
  }
}

export const GameDataManager = new _GameDataManager();

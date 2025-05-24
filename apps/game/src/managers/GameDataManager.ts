import { FlutterStorage, type Storage, WebLocalStorage } from "@shared/storage";
import type { GameData } from "../types/GameData";
import { ObjectType } from "../types/GameData";
import { EventBus, EventTypes } from "../utils/EventBus";
import { CharacterState } from "../types/Character";
import type { Position } from "src/types/Position";

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
    this._setupEventListeners();
    this.isInitialized = true;
    console.log("[GameDataManager] 초기화 완료.");
  }

  /**
   * 모든 이벤트 리스너를 설정합니다.
   */
  private _setupEventListeners(): void {
    // 미니게임 점수 업데이트 이벤트 구독
    EventBus.subscribe(EventTypes.Game.MINIGAME_SCORE_UPDATED, (data) => {
      console.debug("[GameDataManager] 미니게임 점수 업데이트:", data);
      const currentData = this.data;
      if (
        currentData &&
        data.score > currentData.minigame.flappyBird.highScore
      ) {
        currentData.minigame.flappyBird.highScore = data.score;
        this._saveData(currentData);
      }
    });

    // 캐릭터 상태 업데이트 이벤트 구독
    EventBus.subscribe(
      EventTypes.Character.CHARACTER_STATUS_UPDATED,
      async (data) => {
        console.debug(
          "[GameDataManager] 캐릭터 상태 업데이트:",
          JSON.stringify(data, null, 2)
        );
        const currentData = this.data;

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
        this._saveData(newData);
      }
    );

    // 캐릭터 진화 이벤트 구독
    EventBus.subscribe(EventTypes.Character.CHARACTER_EVOLUTION, (data) => {
      console.debug("[GameDataManager] 캐릭터 진화:", data);
      const currentData = this.data;

      if (!currentData) {
        throw new Error(
          "[GameDataManager] Must not to be reached: 게임 데이터가 없습니다."
        );
      }

      const newData = {
        ...currentData,
        character: {
          ...currentData.character,
          key: data.toCharacterKey,
          _evolvedAt: Date.now(),
        },
      };
      this._saveData(newData);
    });

    // Food 생성 이벤트 구독
    EventBus.subscribe(EventTypes.Food.FOOD_CREATED, (data) => {
      console.debug("[GameDataManager] Food 생성:", data);
      const currentData = this.data;
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
        this._saveData(currentData);
      }
    });

    // Poob 생성 이벤트 구독
    EventBus.subscribe(EventTypes.Poob.POOB_CREATED, (data) => {
      console.debug("[GameDataManager] Poob 생성:", data);
      const currentData = this.data;
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
        this._saveData(currentData);
      }
    });

    // 음식 섭취 완료 이벤트 구독
    EventBus.subscribe(EventTypes.Food.FOOD_EATING_FINISHED, async (data) => {
      console.debug("[GameDataManager] 음식 섭취 완료:", data);
      // 먹은 음식 객체 제거
      if (data.id) {
        await this._removeObjectByIdAndType(ObjectType.Food, data.id);
      }
    });

    // 오브젝트 청소 이벤트 구독 (Food, Poob 등)
    EventBus.subscribe(EventTypes.Object.OBJECT_CLEANED, async (data) => {
      console.debug("[GameDataManager] 오브젝트 청소됨:", data);
      const { type, id } = data;
      await this._removeObjectByIdAndType(type, id);
    });
  }

  /**
   * 초기 게임 데이터를 생성합니다.
   * @param characterKey 선택한 캐릭터 키
   * @param name 캐릭터 이름
   * @returns 생성된 게임 데이터
   */
  public createInitialData(
    formData: {
      name: string;
    },
    params: { position: Position }
  ): Promise<GameData> {
    const { name } = formData;
    const { position } = params;
    const randomEggTextureKey = `egg_${Math.floor(Math.random() * 30)}`;
    const initialGameData: GameData = {
      name,
      _createdAt: Date.now(),
      _savedAt: Date.now(),
      character: {
        key: "egg",
        eggTextureKey: randomEggTextureKey,
        _evolvedAt: Date.now(),
        status: {
          position,
          state: CharacterState.IDLE,
          stamina: 6,
          sickness: false,
          evolutionGauge: 0,
          timeOfZeroStamina: undefined,
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

    return this._saveData(initialGameData);
  }

  public async _loadData(): Promise<GameData | undefined> {
    const savedData = await this.storage.getItem(this.GAME_DATA_KEY);

    if (!savedData) {
      console.warn("[GameDataManager] 게임 데이터가 없습니다.");
      return undefined;
    }

    try {
      this.data = JSON.parse(savedData) as GameData;
      return this.data;
    } catch (e) {
      throw new Error(`[GameDataManager] 게임 데이터 로드 실패: ${e}`);
    }
  }

  public async getData(): Promise<GameData | undefined> {
    if (this.data) return this.data;
    return this._loadData();
  }

  public _saveData(data: GameData): GameData {
    this.data = data;
    this.data._savedAt = Date.now();
    this.storage.setItem(this.GAME_DATA_KEY, JSON.stringify(data));
    return this.data;
  }

  /**
   * 타입과 ID를 기반으로 오브젝트를 게임 데이터에서 제거합니다.
   * @param type 오브젝트 타입 (Food, Poob 등)
   * @param id 제거할 오브젝트의 ID
   */
  private async _removeObjectByIdAndType(
    type: ObjectType,
    id: string
  ): Promise<void> {
    const currentData = this.data;
    if (!currentData?.objectsMap || !currentData.objectsMap[type]) {
      console.warn(`[GameDataManager] ${type} 데이터가 존재하지 않습니다.`);
      return;
    }

    console.log(
      `[GameDataManager] ${type} ID ${id}를 게임 데이터에서 제거합니다.`
    );

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
    await this._saveData(currentData);
  }
}

export const GameDataManager = new _GameDataManager();

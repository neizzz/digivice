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

  public initialize(): void {
    if (this.isInitialized) return;
    this._setupEventListeners();
    this._loadData()
      .then((data) => {
        if (data) {
          this.data = data;
          console.log("[GameDataManager] 기존 게임 데이터 로드 완료.");
        } else {
          console.log("[GameDataManager] 기존 게임 데이터가 없습니다.");
        }
        this.isInitialized = true;
        console.log("[GameDataManager] 초기화 완료.");
      })
      .catch((error) => {
        console.error("[GameDataManager] 초기화 실패:", error);
      });
  }

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

    EventBus.subscribe(
      EventTypes.Character.CHARACTER_STATUS_UPDATED,
      async (data) => {
        console.debug(
          "[GameDataManager] 캐릭터 상태 업데이트:",
          JSON.stringify(data, null, 2)
        );
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
            status: {
              ...currentData.character.status,
              ...data.status,
            },
          },
        };
        this._saveData(newData);
      }
    );

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

    EventBus.subscribe(EventTypes.Object.OBJECT_CREATED, (data) => {
      console.debug("[GameDataManager] Object 생성:", data);
      const currentData = this.data;
      if (currentData?.objectsMap) {
        if (data.type === ObjectType.Food) {
          const newFood = {
            id: data.id,
            position: data.position,
            textureKey: data.textureKey as string,
            _createdAt: Date.now(),
          };
          if (!currentData.objectsMap[ObjectType.Food]) {
            currentData.objectsMap[ObjectType.Food] = [];
          }
          currentData.objectsMap[ObjectType.Food].push(newFood);
        } else if (data.type === ObjectType.Poob) {
          const newPoob = {
            id: data.id,
            position: data.position,
            _createdAt: Date.now(),
          };
          if (!currentData.objectsMap[ObjectType.Poob]) {
            currentData.objectsMap[ObjectType.Poob] = [];
          }
          currentData.objectsMap[ObjectType.Poob].push(newPoob);
        } else if (data.type === ObjectType.Pill) {
          if (!currentData.objectsMap[ObjectType.Pill]) {
            currentData.objectsMap[ObjectType.Pill] = [];
          }
          currentData.objectsMap[ObjectType.Pill].push({
            id: data.id,
            position: data.position,
            textureKey: data.textureKey as string,
            _createdAt: Date.now(),
          });
        }
        this._saveData(currentData);
      }
    });

    EventBus.subscribe(EventTypes.Food.FOOD_EATING_FINISHED, async (data) => {
      console.debug("[GameDataManager] 음식 섭취 완료:", data);
      // 먹은 음식 객체 제거
      if (data.id) {
        await this._removeObjectByIdAndType(ObjectType.Food, data.id);
      }
    });

    EventBus.subscribe(EventTypes.Object.OBJECT_CLEANED, async (data) => {
      console.debug("[GameDataManager] 오브젝트 청소됨:", data);
      const { type, id } = data;
      await this._removeObjectByIdAndType(type, id);
    });
  }

  public createInitialData(
    formData: {
      name: string;
    },
    params: { position: Position }
  ): GameData {
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
          // state: CharacterState.IDLE,
          state: CharacterState.SICK,
          stamina: 6,
          evolutionGauge: 0,
          timeOfZeroStamina: undefined,
        },
      },
      objectsMap: {
        [ObjectType.Food]: [],
        [ObjectType.Poob]: [],
        [ObjectType.Pill]: [],
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

  public clearData(): void {
    this.data = null;
    this.storage.removeItem(this.GAME_DATA_KEY);
    console.log("[GameDataManager] 게임 데이터 초기화 완료.");
  }

  public async getData(): Promise<GameData | undefined> {
    if (this.data) return this.data;
    return this._loadData();
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

  public _saveData(data: GameData): GameData {
    this.data = data;
    this.data._savedAt = Date.now();
    this.storage.setItem(this.GAME_DATA_KEY, JSON.stringify(this.data));
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
    // @ts-ignore
    currentData.objectsMap[type] = currentData.objectsMap[type].filter(
      (obj) => obj.id !== id
    );
    this._saveData(currentData);
  }
}

export const GameDataManager = new _GameDataManager();

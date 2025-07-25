import { addEntity, createWorld, IWorld, pipe, setDefaultSize } from "bitecs";
import * as PIXI from "pixi.js";
import {
  AngleComponent,
  Boundary,
  CharacterState,
  CharacterStatusComponent,
  DestinationComponent,
  FreshnessComponent,
  ObjectComponent,
  ObjectType,
  PositionComponent,
  RandomMovementComponent,
  RenderComponent,
  AnimationRenderComponent,
  StatusIconRenderComponent,
  SpeedComponent,
  AnimationKey,
  SpritesheetKey,
} from "./types";
import { randomMovementSystem } from "./systems/RandomMovementSystem";
import { animationRenderSystem } from "./systems/AnimationRenderSystem";
import { statusIconRenderSystem } from "./systems/StatusIconRenderSystem";
import { renderSystem } from "./systems/RenderSystem";
import { characterManagerSystem } from "./systems/CharacterManageSystem";
import { dataSyncSystem } from "./systems/DataSyncSystem";
import { HTMLDebugStatusUI } from "./ui/HTMLDebugStatusUI";
import { HTMLDebugToggleButton } from "./ui/HTMLDebugToggleButton";
import { StaminaGaugeUI } from "./ui/StaminaGaugeUI";
import { StorageManager } from "../../managers/StorageManager";
import { Background } from "../../entities/Background";
import {
  applySavedEntityToECS,
  convertECSEntityToSavedEntity,
} from "./entityDataHelpers";
import { createCharacterEntity } from "./entityFactory";
import { generatePersistentNumericId } from "@/utils/generate";
import {
  loadSpritesheets,
  LoadSpritesheetOptions,
  loadSpritesheet,
} from "../../utils/asset";
import { SPRITESHEET_KEY_TO_NAME } from "./systems/AnimationRenderSystem";

export type EntityComponents = {
  characterStatus?: CharacterStatusComponent;
  position?: PositionComponent;
  angle?: AngleComponent;
  object?: ObjectComponent;
  render?: RenderComponent;
  animationRender?: AnimationRenderComponent;
  statusIconRender?: StatusIconRenderComponent;
  speed?: SpeedComponent;
  freshness?: FreshnessComponent;
  destination?: DestinationComponent;
  randomMovement?: RandomMovementComponent;
};

export type SavedEntity = {
  components: EntityComponents;
};

export type WorldMetadata = {
  name: string;
  last_saved: number;
  version: string;
};

export type MainSceneWorldData = {
  world_metadata: WorldMetadata;
  entities: SavedEntity[];
};

const WORLD_DATA_STORAGE_KEY = "MainSceneWorldData";

const COMMON_SPRITESHEET_ASSETS: LoadSpritesheetOptions[] = [
  {
    jsonPath: "/game/sprites/bird.json",
    alias: "bird",
    pixelArt: true,
  },
  {
    jsonPath: "/game/sprites/eggs.json",
    alias: "eggs",
    pixelArt: true,
  },
  {
    jsonPath: "/game/sprites/foods.json",
    alias: "foods",
    pixelArt: true,
  },
  {
    jsonPath: "/game/sprites/common16x16.json",
    alias: "common16x16",
    pixelArt: true,
  },
  {
    jsonPath: "/game/sprites/common32x32.json",
    alias: "common32x32",
    pixelArt: true,
  },
  // {
  //   jsonPath: "/game/sprites/monsters/test-green-slime_A1.json",
  //   alias: "test-green-slime_A1",
  //   pixelArt: true,
  // },
  // {
  //   jsonPath: "/game/sprites/monsters/test-green-slime_B1.json",
  //   alias: "test-green-slime_B1",
  //   pixelArt: true,
  // },
  // {
  //   jsonPath: "/game/sprites/monsters/test-green-slime_C1.json",
  //   alias: "test-green-slime_C1",
  //   pixelArt: true,
  // },
  // {
  //   jsonPath: "/game/sprites/monsters/test-green-slime_D1.json",
  //   alias: "test-green-slime_D1",
  //   pixelArt: true,
  // },
];
const IMAGE_ASSETS = {
  grass: "/game/tiles/grass-tile.jpg",
};

/**
 * a) ecs구조에서 다루기 힘든 browser event핸들링
 * b) 전역 데이터 저장
 * c) PIXI v8 Assets API를 활용한 에셋 관리
 */
export class MainSceneWorld implements IWorld {
  public readonly VERSION = "1.0.0";
  private _stage: PIXI.Container;
  private _positionBoundary: Boundary;
  private _background?: Background;
  private _persistentData?: MainSceneWorldData;
  private _debugStatusUI?: HTMLDebugStatusUI;
  private _debugToggleButton?: HTMLDebugToggleButton;
  private _staminaGaugeUI?: StaminaGaugeUI;
  private _parentElement?: HTMLElement;
  private _pipedSystems = pipe(
    randomMovementSystem,
    characterManagerSystem,
    animationRenderSystem,
    statusIconRenderSystem,
    renderSystem,
    dataSyncSystem
  );

  get stage(): PIXI.Container {
    return this._stage;
  }
  get positionBoundary(): Boundary {
    return this._positionBoundary;
  }

  constructor(params: {
    stage: PIXI.Container;
    positionBoundary: Boundary;
    parentElement?: HTMLElement;
  }) {
    this._stage = params.stage;
    this._positionBoundary = params.positionBoundary;
    this._parentElement = params.parentElement;
  }

  /**
   * 에셋 로딩 - 스프라이트시트와 일반 이미지를 병렬로 로드
   */
  private async _loadGameAssets(): Promise<void> {
    try {
      console.log("[MainSceneWorld] Loading game assets...");

      // 스프라이트시트와 일반 이미지를 병렬로 로드
      const [spritesheetResults] = await Promise.all([
        loadSpritesheets(COMMON_SPRITESHEET_ASSETS),
        this._loadImageAssets(),
      ]);

      // 로드 결과 로깅
      console.log(
        `[MainSceneWorld] Successfully loaded ${spritesheetResults.length} spritesheets`
      );
      spritesheetResults.forEach((result) => {
        console.log(
          `[MainSceneWorld] - Spritesheet '${result.alias}': ${result.animations.length} animations, ${result.textures.length} textures`
        );
      });

      console.log("[MainSceneWorld] All game assets loaded successfully");
    } catch (error) {
      console.error("[MainSceneWorld] Failed to load game assets:", error);
      throw error;
    }
  }

  /**
   * 일반 이미지 에셋들을 로드
   */
  private async _loadImageAssets(): Promise<void> {
    const imageLoadPromises = Object.entries(IMAGE_ASSETS).map(
      async ([key, path]) => {
        try {
          await PIXI.Assets.load({
            alias: key,
            src: path,
          });
          console.log(`[MainSceneWorld] Loaded image asset: ${key}`);
        } catch (error) {
          console.warn(
            `[MainSceneWorld] Failed to load image asset ${key}:`,
            error
          );
        }
      }
    );

    await Promise.all(imageLoadPromises);
  }

  async init(): Promise<void> {
    console.log("[MainSceneWorld] Initializing world...");
    createWorld(this, 100);

    // 스토리지에서 데이터 로드 시도
    console.log("[MainSceneWorld] Loading saved data from storage...");
    const loadedData = await this.getData();

    if (
      !loadedData ||
      !loadedData.entities ||
      loadedData.entities.length === 0
    ) {
      console.warn(
        "[MainSceneWorld] No saved data found, initializing with default entities..."
      );
      this._persistentData = this._initializeData();
    } else {
      console.log(
        `[MainSceneWorld] Found saved data, validating and loading...`
      );

      this._persistentData = this._validateAndMigrateData(loadedData);
      this._loadEcsEntitiesFromStorage();
    }

    // PIXI v8 Assets API로 게임 에셋 로드
    await this._loadGameAssets();

    const characterSpritesheetKey = this._persistentData.entities.find(
      (entity) => {
        return entity.components.object?.type === ObjectType.CHARACTER;
      }
    )?.components.animationRender?.spritesheetKey;

    if (characterSpritesheetKey) {
      const spritesheetName = SPRITESHEET_KEY_TO_NAME[characterSpritesheetKey];
      await loadSpritesheet({
        jsonPath: `/game/sprites/monsters/${spritesheetName}.json`,
        alias: spritesheetName,
        pixelArt: true,
      });
    }

    // 배경 설정
    this._background = new Background(PIXI.Assets.get("grass"));
    this._stage.addChild(this._background);

    const width = this._stage.width;
    const height = this._stage.height;
    this._background.resize(width, height);

    // UI 초기화
    if (this._parentElement) {
      // 스테미나 게이지 UI (항상 표시)
      this._staminaGaugeUI = new StaminaGaugeUI(this, this._parentElement);

      // 디버그 UI (개발 환경에서만)
      if (import.meta.env.DEV) {
        this._debugStatusUI = new HTMLDebugStatusUI(this, this._parentElement);
        this._debugToggleButton = new HTMLDebugToggleButton(() => {
          this._debugStatusUI?.toggle();
          return this._debugStatusUI?.isDebugVisible() ?? false;
        }, this._parentElement);
      }
    }

    console.log("[MainSceneWorld] World initialization completed");
  }

  /**
   * 기본 캐릭터(알) 생성
   */
  private _createDefaultCharacterEntity(): SavedEntity {
    const eid = createCharacterEntity(this, {
      position: {
        x: this._positionBoundary.width / 2,
        y: this._positionBoundary.height / 2,
      },
      angle: { value: 0 },
      object: {
        id: generatePersistentNumericId(),
        type: ObjectType.CHARACTER,
        state: CharacterState.EGG,
      },
      characterStatus: {
        characterKey: ECS_NULL_VALUE,
        stamina: 10, // 초기 스테미나 최대값으로 설정
        evolutionGage: 0, // 초기 진화 게이지 0으로 설정
        evolutionPhase: 1,
        statuses: new Array(ECS_CHARACTER_STATUS_LENGTH).fill(ECS_NULL_VALUE),
      },
      render: {
        storeIndex: ECS_NULL_VALUE,
        scale: 3,
        textureKey: ECS_NULL_VALUE,
        zIndex: ECS_NULL_VALUE,
      },
      animationRender: {
        storeIndex: ECS_NULL_VALUE,
        spritesheetKey: SpritesheetKey.TestGreenSlimeA1,
        animationKey: AnimationKey.IDLE,
        isPlaying: true,
        loop: true,
        speed: 0.04,
      },
      speed: { value: ECS_NULL_VALUE },
    });

    return convertECSEntityToSavedEntity(this, eid);
  }

  /**
   * 스토리지에서 엔티티들을 로드하여 ECS 월드에 복원
   */
  private _loadEcsEntitiesFromStorage(): void {
    if (!this._persistentData?.entities) {
      console.warn("[MainSceneWorld] No entities data found in storage");
      return;
    }

    let loadedEntitiesCount = 0;
    let errorCount = 0;

    this._persistentData.entities.forEach((savedEntity, index) => {
      try {
        const eid = addEntity(this);
        applySavedEntityToECS(this, eid, savedEntity);
        loadedEntitiesCount++;

        console.log(
          `[MainSceneWorld] Loaded entity ${index + 1}: ID=${
            savedEntity.components.object?.id
          }, Type=${savedEntity.components.object?.type}`
        );
      } catch (error) {
        errorCount++;
        console.warn(
          `[MainSceneWorld] Failed to load entity ${index + 1}:`,
          error
        );
        console.warn("  Problematic entity data:", savedEntity);
      }
    });

    console.log(
      `[MainSceneWorld] Loaded ${loadedEntitiesCount} entities successfully, ${errorCount} failed`
    );

    // 로딩 실패한 엔티티들이 있고 성공한 엔티티가 하나도 없다면 기본 캐릭터 생성
    if (loadedEntitiesCount === 0 && errorCount > 0) {
      console.warn(
        "[MainSceneWorld] All entities failed to load, creating default character..."
      );
      this._createDefaultCharacterEntity();
    }

    this._logLoadedEcsEntities(); // 로드된 엔티티 상태 요약 로그
  }

  /**
   * 로드된 엔티티들의 상태를 로깅하는 디버그 메소드
   */
  private _logLoadedEcsEntities(): void {
    if (!this._persistentData?.entities) return;

    console.group("[MainSceneWorld] Loaded Entities Summary:");

    const entityStats = {
      total: this._persistentData.entities.length,
      byType: {} as Record<string, number>,
      byState: {} as Record<string, number>,
    };

    this._persistentData.entities.forEach((entity) => {
      if (entity.components.object) {
        const type = ObjectType[entity.components.object.type] || "UNKNOWN";
        entityStats.byType[type] = (entityStats.byType[type] || 0) + 1;

        if (entity.components.object.type === ObjectType.CHARACTER) {
          const state =
            CharacterState[entity.components.object.state] || "UNKNOWN";
          entityStats.byState[state] = (entityStats.byState[state] || 0) + 1;
        }
      }
    });

    console.log(`Total entities: ${entityStats.total}`);
    console.log("By type:", entityStats.byType);
    if (Object.keys(entityStats.byState).length > 0) {
      console.log("Character states:", entityStats.byState);
    }

    console.groupEnd();
  }

  destroy(): void {
    console.log("[MainSceneWorld] Destroying world...");

    // 디버그 UI 정리
    if (this._debugStatusUI) {
      this._debugStatusUI.destroy();
      this._debugStatusUI = undefined;
    }
    if (this._debugToggleButton) {
      this._debugToggleButton.destroy();
      this._debugToggleButton = undefined;
    }

    this._background && this._stage.removeChild(this._background);
    // this._assetsLoaded = false;

    // PIXI v8에서는 필요시 특정 에셋만 언로드 가능
    // PIXI.Assets.unload(Object.keys(GAME_ASSETS));

    console.log("[MainSceneWorld] World destroyed successfully");
    // TODO: 모든 엔티티 제거
  }
  update(delta: number): void {
    // TODO: hatchSystem, throwSystem
    this._pipedSystems({ world: this, delta });

    // UI 업데이트
    if (this._staminaGaugeUI) {
      this._staminaGaugeUI.update();
    }

    // 디버그 UI 업데이트
    if (this._debugStatusUI) {
      this._debugStatusUI.update();

      // 디버그 토글 버튼 상태 동기화
      if (this._debugToggleButton) {
        this._debugToggleButton.updateState(
          this._debugStatusUI.isDebugVisible()
        );
      }
    }
  }

  private _initializeData(): MainSceneWorldData {
    return {
      world_metadata: {
        name: "MainScene",
        last_saved: Date.now(),
        version: this.VERSION,
      },
      entities: [this._createDefaultCharacterEntity()],
    };
  }

  getInMemoryData(): MainSceneWorldData {
    return this._persistentData as MainSceneWorldData;
  }

  async getData(): Promise<MainSceneWorldData | null> {
    try {
      const data = (await StorageManager.getData(
        WORLD_DATA_STORAGE_KEY
      )) as MainSceneWorldData;

      if (!data) {
        console.log("[MainSceneWorld] No saved data found in storage");
        return null;
      }

      console.log("[MainSceneWorld] Successfully loaded data from storage");
      return data;
    } catch (error) {
      console.error(
        "[MainSceneWorld] Failed to load data from storage:",
        error
      );

      // 스토리지에서 데이터를 읽는 데 실패한 경우, 빈 데이터로 덮어쓰기
      // try {
      //   await StorageManager.setData(WORLD_DATA_STORAGE_KEY, null);
      //   console.log("[MainSceneWorld] Cleared corrupted storage data");
      // } catch (clearError) {
      //   console.error(
      //     "[MainSceneWorld] Failed to clear corrupted data:",
      //     clearError
      //   );
      // }

      return null;
    }
  }

  setData(data: MainSceneWorldData): void {
    this._persistentData = data;
    StorageManager.setData(WORLD_DATA_STORAGE_KEY, data)
      .then(() => (this._persistentData = data))
      .catch((error) => {
        console.error("[MainSceneWorld] Failed to save data:", error);
      });
  }

  /**
   * 저장된 데이터의 유효성을 검증하고 필요시 마이그레이션 수행
   */
  private _validateAndMigrateData(
    data: MainSceneWorldData
  ): MainSceneWorldData {
    console.log("[MainSceneWorld] Validating saved data...");

    // 기본 구조 검증
    if (!data.world_metadata) {
      console.warn("[MainSceneWorld] Missing world_metadata, creating default");
      data.world_metadata = {
        name: "MainScene",
        last_saved: Date.now(),
        version: this.VERSION,
      };
    }

    if (!data.entities) {
      console.warn(
        "[MainSceneWorld] Missing entities array, creating empty array"
      );
      data.entities = [];
    }

    // 버전 호환성 검증
    if (data.world_metadata.version !== this.VERSION) {
      console.log(
        `[MainSceneWorld] Version mismatch (saved: ${data.world_metadata.version}, current: ${this.VERSION}), attempting migration...`
      );
      data = this._migrateData(data);
    }

    // 엔티티 데이터 유효성 검증
    data.entities = data.entities.filter((entity, index) => {
      if (!entity.components) {
        console.warn(
          `[MainSceneWorld] Entity ${index} missing components, removing`
        );
        return false;
      }

      // 필수 컴포넌트 검증 (object 컴포넌트는 필수)
      if (!entity.components.object) {
        console.warn(
          `[MainSceneWorld] Entity ${index} missing object component, removing`
        );
        return false;
      }

      // ID 유효성 검증
      if (
        typeof entity.components.object.id !== "number" ||
        entity.components.object.id <= 0
      ) {
        console.warn(
          `[MainSceneWorld] Entity ${index} has invalid ID, removing`
        );
        return false;
      }

      return true;
    });

    console.log(
      `[MainSceneWorld] Data validation completed, ${data.entities.length} valid entities found`
    );
    return data;
  }

  /**
   * 이전 버전 데이터를 현재 버전으로 마이그레이션
   */
  private _migrateData(data: MainSceneWorldData): MainSceneWorldData {
    console.log(
      `[MainSceneWorld] Migrating data from version ${data.world_metadata.version} to ${this.VERSION}`
    );

    // TODO: 버전별 마이그레이션 로직
    // 예: 1.0.0 이전 버전에서 특정 필드가 추가되었다면 여기서 처리

    // 마이그레이션 완료 후 버전 업데이트
    data.world_metadata.version = this.VERSION;
    data.world_metadata.last_saved = Date.now();

    console.log("[MainSceneWorld] Data migration completed");
    return data;
  }

  /**
   * 화면 크기 변경 시 호출되는 메서드
   */
  resize(width: number, height: number): void {
    // 위치 경계 업데이트
    this._positionBoundary = {
      x: this._positionBoundary.x,
      y: this._positionBoundary.y,
      width: width - 2 * this._positionBoundary.x,
      height: height - 2 * this._positionBoundary.y,
    };

    // 배경 크기 조정
    if (this._background) {
      this._background.resize(width, height);
    }
  }
}

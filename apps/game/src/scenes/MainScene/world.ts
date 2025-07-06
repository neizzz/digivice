import { addEntity, createWorld, IWorld, pipe } from "bitecs";
import * as PIXI from "pixi.js";
import {
  AngleComponent,
  Boundary,
  CharacterState,
  DestinationComponent,
  FreshnessComponent,
  ObjectComponent,
  ObjectType,
  PositionComponent,
  RandomMovementComponent,
  RenderComponent,
  SpeedComponent,
  TextureKey,
} from "./types";
import { randomMovementSystem } from "./systems/RandomMovementSystem";
import { renderSystem } from "./systems/RenderSystem";
import { dataSyncSystem } from "./systems/DataSyncSystem";
import { StorageManager } from "../../managers/StorageManager";
import { AssetLoader } from "../../utils/AssetLoader";
import { Background } from "../../entities/Background";
import { applySavedEntityToECS } from "./entityDataHelpers";
import { createCharacterEntity } from "./entityFactory";
import { ECS_NULL_VALUE } from "@/utils/ecs";

export type EntityComponents = {
  position?: PositionComponent;
  angle?: AngleComponent;
  object?: ObjectComponent;
  render?: RenderComponent;
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

/**
 * a) ecs구조에서 다루기 힘든 browser event핸들링
 * b) 전역 데이터 저장
 */
export class MainSceneWorld implements IWorld {
  public readonly VERSION = "1.0.0";
  private _stage: PIXI.Container;
  private _positionBoundary: Boundary;
  private _background: Background;
  private _persistentData?: MainSceneWorldData;

  get stage(): PIXI.Container {
    return this._stage;
  }
  get positionBoundary(): Boundary {
    return this._positionBoundary;
  }
  get background(): Background {
    return this._background;
  }

  constructor(params: { stage: PIXI.Container; positionBoundary: Boundary }) {
    this._stage = params.stage;
    this._positionBoundary = params.positionBoundary;

    // 배경 설정
    const assets = AssetLoader.getAssets();
    const backgroundTexture = assets.backgroundTexture || PIXI.Texture.WHITE;
    this._background = new Background(backgroundTexture);
  }

  async init(): Promise<void> {
    this._stage.addChild(this._background);

    const width = this._positionBoundary.width;
    const height = this._positionBoundary.height;
    this._background.resize(width, height);

    createWorld(this, 100);

    this._persistentData = await this.getData();
    if (!this._persistentData) {
      this._persistentData = this._initializeData();
      // egg
      createCharacterEntity(this, {
        position: {
          x: this._positionBoundary.width / 2,
          y: this._positionBoundary.height / 2,
        },
        angle: { value: 0 },
        object: {
          id: 0,
          type: ObjectType.CHARACTER,
          state: CharacterState.EGG,
        },
        render: {
          spriteRefIndex: ECS_NULL_VALUE,
          scale: 3,
          textureKey: TextureKey.EGG0,
          zIndex: ECS_NULL_VALUE,
        },
        speed: { value: 0 },
      });
    } else {
      this._persistentData.entities.forEach((savedEntity) => {
        const eid = addEntity(this);
        applySavedEntityToECS(this, eid, savedEntity);
      });
    }
  }

  destroy(): void {
    this._stage.removeChild(this._background);
    // TODO: 모든 엔티티 제거
  }

  update(deltaTime: number): void {
    // TODO: hatchSystem, throwSystem
    pipe(randomMovementSystem, renderSystem, dataSyncSystem)(this, deltaTime);
  }

  getStage(): PIXI.Container {
    return this._stage;
  }

  private _initializeData(): MainSceneWorldData {
    return {
      world_metadata: {
        name: "MainScene",
        last_saved: Date.now(),
        version: this.VERSION,
      },
      entities: [],
    };
  }

  getInMemoryData(): MainSceneWorldData {
    return this._persistentData as MainSceneWorldData;
  }

  getData(): Promise<MainSceneWorldData> {
    return StorageManager.getData(
      WORLD_DATA_STORAGE_KEY
    ) as Promise<MainSceneWorldData>;
  }

  setData(data: MainSceneWorldData): void {
    this._persistentData = data;
    StorageManager.setData(WORLD_DATA_STORAGE_KEY, data)
      .then(() => (this._persistentData = data))
      .catch((error) => {
        console.error("[MainSceneWorld] Failed to save data:", error);
      });
  }

  // serializeGameData(): string {
  //   return JSON.stringify(this._persistentData);
  // }
  // deserializeGameData(jsonData: string): void {
  //   try {
  //     this._persistentData = JSON.parse(jsonData);
  //   } catch (error) {
  //     console.error("[MainSceneWorld] Failed to deserialize game data:", error);
  //   }
  // }
}

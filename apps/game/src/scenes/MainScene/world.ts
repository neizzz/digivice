import { IWorld, pipe } from "bitecs";
import * as PIXI from "pixi.js";
import {
  AngleComponent,
  Boundary,
  DestinationComponent,
  FreshnessComponent,
  ObjectComponent,
  PositionComponent,
  RandomMovementComponent,
  RenderComponent,
  SpeedComponent,
} from "./types";
import { randomMovementSystem } from "./systems/RandomMovementSystem";
import { renderSystem } from "./systems/RenderSystem";
import { dataSyncSystem } from "./systems/DataSyncSystem";
import { StorageManager } from "../../managers/StorageManager";
import { AssetLoader } from "../../utils/AssetLoader";
import { Background } from "../../entities/Background";

export type EntityComponents = {
  positionComponent?: PositionComponent;
  angleComponent?: AngleComponent;
  objectComponent?: ObjectComponent;
  renderComponent?: RenderComponent;
  speedComponent?: SpeedComponent;
  freshnessComponent?: FreshnessComponent;
  destinationComponent?: DestinationComponent;
  randomMovementComponent?: RandomMovementComponent;
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
  // private _persistentData: MainSceneWorldData;

  get stage(): PIXI.Container {
    return this._stage;
  }
  get positionBoundary(): Boundary {
    return this._positionBoundary;
  }
  get background(): Background {
    return this._background;
  }

  // getMainSceneWorldData():MainSceneWorldData {
  //   return this._persistentData;
  // }

  constructor(params: { stage: PIXI.Container; positionBoundary: Boundary }) {
    this._stage = params.stage;
    this._positionBoundary = params.positionBoundary;
    // this._persistentData = this._initializMainSceneWorldData();

    // 배경 설정
    const assets = AssetLoader.getAssets();
    const backgroundTexture = assets.backgroundTexture || PIXI.Texture.WHITE;
    this._background = new Background(backgroundTexture);
  }

  // private _initializMainSceneWorldData(): MainSceneWorldData {
  //   return {
  //     world_metadata: {
  //       name: "MainScene",
  //       last_saved: Date.now(),
  //       version: this.VERSION,
  //     },
  //     entities: [],
  //   };
  // }

  init() {
    // 배경을 stage에 추가하고 맨 뒤에 배치
    this._stage.addChild(this._background);

    // 화면 크기에 맞게 배경 크기 조정
    // positionBoundary를 사용하여 화면 크기 가져오기
    const width = this._positionBoundary.width;
    const height = this._positionBoundary.height;
    this._background.resize(width, height);
  }

  destroy(): void {
    this._stage.removeChild(this._background);
    // TODO: 모든 엔티티 제거
  }

  update(deltaTime: number): void {
    pipe(randomMovementSystem, renderSystem, dataSyncSystem)(this, deltaTime);
    // 추가적인 리셋 로직이 필요하다면 여기에 작성
  }

  getStage(): PIXI.Container {
    return this._stage;
  }

  getWorldData(): Promise<MainSceneWorldData> {
    return StorageManager.getData(
      WORLD_DATA_STORAGE_KEY
    ) as Promise<MainSceneWorldData>;
  }

  setWorldData(data: MainSceneWorldData): void {
    return StorageManager.setData(WORLD_DATA_STORAGE_KEY, data);
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

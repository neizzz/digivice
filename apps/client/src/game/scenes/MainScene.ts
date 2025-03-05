import * as PIXI from "pixi.js";
import { Background } from "../entities/Background";
import { Character } from "../entities/Character";
import { AssetLoader } from "../utils/AssetLoader";

export class MainScene extends PIXI.Container {
  private app: PIXI.Application;
  private background: Background;
  private character: Character;

  constructor(app: PIXI.Application) {
    super();
    this.app = app;

    // 에셋 가져오기
    const assets = AssetLoader.getAssets();

    // 배경 생성 및 추가
    this.background = new Background(assets.backgroundTexture);
    this.addChild(this.background);

    // 캐릭터 생성 및 추가
    this.character = new Character(assets.slimeSprites);
    this.addChild(this.character);

    // 캐릭터를 씬 중앙에 배치
    this.positionCharacter();
  }

  private positionCharacter(): void {
    this.character.position.set(
      this.app.view.width / 2,
      this.app.view.height / 2
    );
  }

  public onResize(width: number, height: number): void {
    // 화면 크기 변경 시 배경 크기 조정
    this.background.resize(width, height);

    // 캐릭터 위치 재조정
    this.positionCharacter();
  }

  public update(deltaTime: number): void {
    // 캐릭터 업데이트
    this.character.update(deltaTime);
  }
}

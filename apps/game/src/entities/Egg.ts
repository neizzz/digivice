import * as PIXI from "pixi.js";
import type { Position } from "../types/Position";
import { AssetLoader } from "../utils/AssetLoader";
import { GameDataManager } from "../managers/GameDataManager";
import { EventBus } from "../utils/EventBus";

/**
 * Egg 클래스 - 움직이지 않고 화면 중앙에 위치하는 독립적인 간단한 엔티티
 */
export class Egg extends PIXI.Container {
  private sprite: PIXI.Sprite | null = null;
  private eggTextureKey = "egg_0";
  private app: PIXI.Application;
  private eventBus: EventBus;

  /**
   * Egg 생성자
   */
  constructor(params: { position: Position; app: PIXI.Application }) {
    super();

    this.app = params.app;
    this.eventBus = EventBus.getInstance();

    // 화면 중앙에 위치
    this.position.set(
      params.position.x || this.app.screen.width / 2,
      params.position.y || this.app.screen.height / 2
    );

    // 게임 데이터에서 알 텍스처 키 로드
    this.loadEggTextureKey();
  }

  /**
   * 게임 데이터에서 알 텍스처 키를 로드합니다.
   */
  private async loadEggTextureKey(): Promise<void> {
    try {
      const gameData = await GameDataManager.getData();
      if (!gameData?.character.eggTextureKey) {
        throw new Error("게임 데이터에 알 텍스처 키가 없습니다.");
      }
      this.eggTextureKey = gameData.character.eggTextureKey;
      this.updateEggTexture();
    } catch (error) {
      console.error("알 텍스처 키 로드 오류:", error);
    }
  }

  /**
   * 알 텍스처를 업데이트합니다.
   */
  private updateEggTexture(): void {
    const assets = AssetLoader.getAssets();
    const eggSprites = assets.eggSprites;

    if (eggSprites?.textures?.[this.eggTextureKey]) {
      console.log(`Egg 텍스처 업데이트: ${this.eggTextureKey}`);

      const eggTexture = eggSprites.textures[this.eggTextureKey];

      // 기존 스프라이트 제거
      if (this.sprite) {
        this.removeChild(this.sprite);
        this.sprite.destroy();
        this.sprite = null;
      }

      // 새 스프라이트 생성
      this.sprite = new PIXI.Sprite(eggTexture);
      this.sprite.anchor.set(0.5, 0.5);

      // 스케일 적용 (2.0은 CharacterDictionary에서의 Egg scale 값)
      const scaleFactor = 2.0;
      this.sprite.width = eggTexture.width * scaleFactor;
      this.sprite.height = eggTexture.height * scaleFactor;

      this.addChild(this.sprite);
    } else {
      console.error(`텍스처를 찾을 수 없음: ${this.eggTextureKey}`);
    }
  }

  /**
   * Egg의 현재 위치를 반환합니다.
   */
  public getPosition(): { x: number; y: number } {
    return {
      x: this.position.x,
      y: this.position.y,
    };
  }

  /**
   * 화면 크기가 변경될 때 호출되는 메서드
   */
  public onResize(width: number, height: number): void {
    // 화면 중앙에 위치
    this.position.set(width / 2, height / 2);
  }

  /**
   * Egg 정리 메서드
   */
  public destroy(): void {
    if (this.sprite) {
      this.removeChild(this.sprite);
      this.sprite.destroy();
      this.sprite = null;
    }
    super.destroy();
  }
}

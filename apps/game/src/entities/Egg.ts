import * as PIXI from "pixi.js";
import type { Position } from "../types/Position";
import { AssetLoader } from "../utils/AssetLoader";
import { GameDataManager } from "../utils/GameDataManager";

/**
 * Egg 클래스 - 움직이지 않고 화면 중앙에 위치하는 독립적인 간단한 엔티티
 */
export class Egg extends PIXI.Container {
  private sprite: PIXI.Sprite | null = null;
  private eggTextureKey = "egg_0";
  private app: PIXI.Application;

  /**
   * Egg 생성자
   */
  constructor(params: { position: Position; app: PIXI.Application }) {
    super();

    this.app = params.app;

    // 화면 중앙에 위치
    this.position.set(this.app.screen.width / 2, this.app.screen.height / 2);

    // 게임 데이터에서 알 텍스처 키 로드
    this.loadEggTextureKey();
  }

  /**
   * 게임 데이터에서 알 텍스처 키를 로드합니다.
   */
  private async loadEggTextureKey(): Promise<void> {
    try {
      const gameData = await GameDataManager.loadData();
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
   * 알 텍스처를 변경합니다.
   * @param textureKey 새로운 텍스처 키
   */
  public async changeEggTexture(textureKey: string): Promise<boolean> {
    try {
      const assets = AssetLoader.getAssets();
      const eggSprites = assets.eggSprites;

      if (!eggSprites?.textures?.[textureKey]) {
        console.error(`유효하지 않은 텍스처 키: ${textureKey}`);
        return false;
      }

      // 게임 데이터 업데이트
      const gameData = await GameDataManager.loadData();
      if (!gameData) return false;

      await GameDataManager.updateData({
        character: {
          ...gameData.character,
          eggTextureKey: textureKey,
        },
      });

      // 텍스처 업데이트
      this.eggTextureKey = textureKey;
      this.updateEggTexture();
      return true;
    } catch (error) {
      console.error("알 텍스처 변경 오류:", error);
      return false;
    }
  }

  /**
   * 화면 크기가 변경될 때 호출되는 메서드
   */
  public onResize(width: number, height: number): void {
    // 화면 중앙에 위치
    this.position.set(width / 2, height / 2);
  }
}

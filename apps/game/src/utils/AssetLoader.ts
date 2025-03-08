import * as PIXI from "pixi.js";

export interface GameAssets {
  backgroundTexture: PIXI.Texture;
  slimeSprites: PIXI.Spritesheet;
}

export class AssetLoader {
  private static assets?: GameAssets;
  private static isLoading: boolean = false;
  private static loadingPromise: Promise<GameAssets> | null = null;

  public static async loadAssets(): Promise<GameAssets> {
    // 이미 로딩된 에셋이 있으면 반환
    if (this.assets) {
      return this.assets;
    }

    // 이미 로딩 중이면 현재 진행 중인 Promise 반환
    if (this.isLoading && this.loadingPromise) {
      return this.loadingPromise;
    }

    this.isLoading = true;

    // 로딩 Promise 생성 및 저장
    this.loadingPromise = this.loadAssetsInternal();

    try {
      // 로딩 완료 대기
      return await this.loadingPromise;
    } finally {
      // 로딩 완료 후 상태 초기화
      this.isLoading = false;
      this.loadingPromise = null;
    }
  }

  // 실제 에셋 로딩을 처리하는 내부 메서드
  private static async loadAssetsInternal(): Promise<GameAssets> {
    try {
      // 에셋 경로 설정
      const assetMap = {
        backgroundTile: "/game/tiles/grass-tile.jpg",
        slimeSheet: "/game/sprites/test-slime/sprite-sheet.png",
        slimeData: "/game/sprites/test-slime/metadata.json",
      };

      // 에셋 로딩
      await PIXI.Assets.load([assetMap.backgroundTile, assetMap.slimeSheet]);
      const slimeData = await fetch(assetMap.slimeData).then((res) =>
        res.json()
      );

      // 고유 ID 접두사 추가
      const uniquePrefix = "slime_sprite_";

      // 프레임 ID에 접두사 추가
      for (const frameKey in slimeData.frames) {
        const newFrameKey = uniquePrefix + frameKey;
        slimeData.frames[newFrameKey] = slimeData.frames[frameKey];
        delete slimeData.frames[frameKey];
      }

      // 애니메이션 ID는 그대로 유지하고 프레임만 업데이트 (중요 변경)
      for (const animKey in slimeData.animations) {
        slimeData.animations[animKey] = slimeData.animations[animKey].map(
          (frameId: string) => uniquePrefix + frameId
        );
      }

      console.log(
        "Animation data after processing:",
        Object.keys(slimeData.animations)
      );

      // 배경 텍스처 생성
      const backgroundTexture = PIXI.Texture.from(assetMap.backgroundTile);

      // 슬라임 스프라이트시트 생성
      const baseTexture = PIXI.BaseTexture.from(assetMap.slimeSheet);
      const slimeSprites = new PIXI.Spritesheet(baseTexture, slimeData);
      await slimeSprites.parse();

      // 로딩된 스프라이트시트 확인
      console.log(
        "Spritesheet parsed successfully:",
        Object.keys(slimeSprites.animations)
      );

      // 로딩된 에셋 저장
      this.assets = {
        backgroundTexture,
        slimeSprites,
      };

      return this.assets;
    } catch (error) {
      console.error("Error loading assets:", error);
      throw error;
    }
  }

  public static getAssets(): GameAssets {
    if (!this.assets) {
      throw new Error("Assets not loaded yet. Call loadAssets first.");
    }
    return this.assets;
  }

  // 필요시 에셋 캐시를 지우는 메서드 추가
  public static clearAssets(): void {
    // 로딩 중인 경우 완료될 때까지 대기
    if (this.isLoading) {
      console.warn("Cannot clear assets while loading is in progress");
      return;
    }

    if (this.assets) {
      // 스프라이트시트의 텍스처 해제
      if (this.assets.slimeSprites) {
        this.assets.slimeSprites.destroy(true);
      }

      // 배경 텍스처 해제
      if (this.assets.backgroundTexture) {
        this.assets.backgroundTexture.destroy(true);
      }

      this.assets = undefined;
    }

    // PIXI 캐시 정리
    PIXI.utils.clearTextureCache();
  }
}

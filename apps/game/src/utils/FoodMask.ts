import * as PIXI from "pixi.js";
import { AssetLoader } from "./AssetLoader";

/**
 * 음식 마스킹을 처리하는 클래스
 * 음식이 먹히는 과정을 단계별로 시각화
 */
export class FoodMask {
  // 마스크 관련 변수
  private maskSprite: PIXI.Sprite | null = null;
  // 스프라이트시트에 정의된 프레임 이름과 일치시킴
  private maskFrames: string[] = [
    "vite-mask_0",
    "vite-mask_1",
    "vite-mask_2",
    "vite-mask_3",
    "vite-mask_4",
  ];
  private maskTextures: PIXI.Texture[] = [];
  private parentSprite: PIXI.Sprite;
  private parentContainer: PIXI.Container;

  /**
   * @param parentSprite 마스크를 적용할 부모 스프라이트 (음식)
   * @param parentContainer 마스크 스프라이트를 추가할 컨테이너
   */
  constructor(parentSprite: PIXI.Sprite, parentContainer: PIXI.Container) {
    this.parentSprite = parentSprite;
    this.parentContainer = parentContainer;
    this.loadMaskTextures();
  }

  /**
   * 마스크 텍스처를 로드하는 메서드
   */
  private loadMaskTextures(): void {
    console.log("FoodMask: 마스크 텍스처 로드 시작");

    try {
      // AssetLoader에서 로드된 마스크 스프라이트시트 가져오기
      const assets = AssetLoader.getAssets();
      const maskSpritesheet = assets.foodMaskSprites;

      if (maskSpritesheet?.textures) {
        console.log("FoodMask: AssetLoader에서 마스크 스프라이트시트 찾음");

        // 스프라이트시트에서 각 마스크 프레임 텍스처 가져오기
        for (const frameName of this.maskFrames) {
          if (maskSpritesheet.textures[frameName]) {
            console.log(
              `FoodMask: 스프라이트시트에서 텍스처 가져옴: ${frameName}`
            );
            this.maskTextures.push(maskSpritesheet.textures[frameName]);
          } else {
            console.warn(
              `FoodMask: 스프라이트시트에 텍스처 없음: ${frameName}, 직접 로드 시도`
            );
            // 스프라이트시트에 없으면 직접 로드 시도
            try {
              const texture = PIXI.Texture.from(frameName);
              this.maskTextures.push(texture);
            } catch (e) {
              console.error(`FoodMask: 텍스처 직접 로드 실패: ${frameName}`, e);
            }
          }
        }
      } else {
        console.warn(
          "FoodMask: 마스크 스프라이트시트를 찾을 수 없음, 프레임 직접 로드 시도"
        );

        // 스프라이트시트가 없으면 각 프레임 직접 로드
        for (const frameName of this.maskFrames) {
          try {
            console.log(`FoodMask: 프레임 직접 로드 시도: ${frameName}`);
            const texture = PIXI.Texture.from(frameName);
            this.maskTextures.push(texture);
          } catch (e) {
            console.error(`FoodMask: 텍스처 직접 로드 실패: ${frameName}`, e);
          }
        }
      }

      console.log(
        `FoodMask: 로드된 마스크 텍스처 총 개수: ${this.maskTextures.length}`
      );

      // 중요: 음식이 착지한 후에 init()이 직접 호출되도록 변경
      // 마스크 자동 초기화 코드 제거
    } catch (error) {
      console.error("FoodMask: 마스크 텍스처 로드 실패:", error);
    }
  }

  /**
   * 마스크를 초기화하고 음식 스프라이트에 적용
   */
  public init(): void {
    if (this.maskTextures.length === 0) {
      console.warn("FoodMask: 마스크 텍스처가 로드되지 않았습니다.");
      return;
    }

    if (!this.maskSprite) {
      console.log("FoodMask: 마스크 스프라이트 초기화");
      this.maskSprite = new PIXI.Sprite(this.maskTextures[0]);
      this.maskSprite.anchor.set(0.5);

      // 중요: 마스크 스프라이트를 부모 스프라이트의 mask로 설정
      this.parentSprite.mask = this.maskSprite;

      // 마스크 스프라이트도 화면에 추가해야 마스킹이 작동함
      this.parentContainer.addChild(this.maskSprite);

      console.log("FoodMask: 마스크 스프라이트 추가됨 (마스킹 모드)");
    }

    // 초기 위치 설정
    this.updatePosition();
  }

  /**
   * 마스크 위치와 크기를 부모 스프라이트에 맞게 업데이트
   */
  public updatePosition(): void {
    if (!this.maskSprite) return;

    // 마스크의 위치를 부모 스프라이트와 동일하게 설정
    this.maskSprite.position.x = this.parentSprite.position.x;
    this.maskSprite.position.y = this.parentSprite.position.y;
  }

  /**
   * 진행도에 따라 마스크 텍스처 업데이트
   * @param progress 진행도 (0~1)
   */
  public updateProgress(progress: number): void {
    if (!this.maskSprite || this.maskTextures.length === 0) {
      // 마스크가 없거나 텍스처가 로드되지 않았으면 초기화
      if (!this.maskSprite) this.init();
      return;
    }

    // 마스크 인덱스 계산 (0~4)
    const maskIndex = Math.min(
      Math.floor(progress * this.maskTextures.length),
      this.maskTextures.length - 1
    );

    // 현재 진행 상태에 맞는 마스크 텍스처 설정
    this.maskSprite.texture = this.maskTextures[maskIndex];
  }

  /**
   * 마스크가 제대로 표시되고 있는지 확인하고 문제가 있으면 해결
   */
  public checkVisibility(): boolean {
    if (!this.maskSprite) {
      console.warn("FoodMask: 마스크 스프라이트가 초기화되지 않았습니다.");
      this.init();
      return false;
    }

    if (this.maskSprite?.parent === null) {
      console.warn("FoodMask: 마스크 스프라이트가 화면에 추가되지 않았습니다!");
      this.parentContainer.addChild(this.maskSprite);

      // 마스크 연결 확인
      if (this.parentSprite.mask !== this.maskSprite) {
        this.parentSprite.mask = this.maskSprite;
        console.log("FoodMask: 마스크 재연결됨");
      }

      this.updatePosition();
      return false;
    }

    return true;
  }

  /**
   * 마스크 스프라이트 제거
   */
  public destroy(): void {
    if (this.maskSprite) {
      // 마스크 연결 해제
      if (this.parentSprite.mask === this.maskSprite) {
        this.parentSprite.mask = null;
      }

      // 스프라이트 제거
      if (this.maskSprite.parent) {
        this.maskSprite.parent.removeChild(this.maskSprite);
      }

      this.maskSprite = null;
      console.log("FoodMask: 마스크 스프라이트 제거됨");
    }
  }
}

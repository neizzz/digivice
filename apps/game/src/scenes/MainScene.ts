import * as PIXI from "pixi.js";
import { Scene } from "../interfaces/Scene";
import { Background } from "../entities/Background";
import { Character } from "../entities/Character";
import { AssetLoader } from "../utils/AssetLoader";
import { DebugHelper } from "../utils/DebugHelper";

export class MainScene extends PIXI.Container implements Scene {
  private app: PIXI.Application;
  private background: Background;
  private character: Character;
  private initialized: boolean = false;

  constructor(app: PIXI.Application) {
    super();
    this.app = app;

    // 디버그 헬퍼 초기화
    DebugHelper.init(app);
    DebugHelper.setEnabled(true);

    // 동기적 초기화 수행
    this.setupScene();
  }

  /**
   * 씬을 동기적으로 설정합니다.
   */
  private setupScene(): void {
    // 에셋 동기적으로 가져오기
    AssetLoader.getAssets()
      .then((assets) => {
        // 배경 생성 및 추가
        this.background = new Background(assets.backgroundTexture);
        this.addChild(this.background);

        // 캐릭터 생성 및 추가
        this.character = new Character({
          spritesheet: assets.slimeSprites,
          name: "Slime",
          initialPosition: {
            x: this.app.screen.width / 2,
            y: this.app.screen.height / 2,
          },
          speed: 1,
        });
        this.addChild(this.character);

        // 초기 설정 완료
        this.positionCharacter();
        this.applyCharacterMovement();
        this.setupDebugVisualization();
        this.initialized = true;

        // 화면 크기에 맞게 조정
        this.onResize(this.app.screen.width, this.app.screen.height);

        console.log("MainScene setup completed");
      })
      .catch((error) => {
        console.error("Error setting up MainScene:", error);
      });
  }

  private positionCharacter(): void {
    const { width, height } = this.app.screen;
    this.character.position.set(width / 2, height / 2);
  }

  /**
   * 캐릭터에 랜덤 움직임을 적용하는 메서드
   */
  private applyCharacterMovement(): void {
    console.log("Applying movement to character in MainScene");

    // 약간의 딜레이를 주어 캐릭터가 완전히 초기화된 후에 움직임을 적용
    setTimeout(() => {
      const controller = this.character.applyRandomMovement(this.app, {
        minIdleTime: 2000, // 최소 2초 대기
        maxIdleTime: 5000, // 최대 5초 대기
        minMoveTime: 1500, // 최소 1.5초 이동
        maxMoveTime: 4000, // 최대 4초 이동
        // moveSpeed 옵션 제거 - 캐릭터의 speed 속성을 사용함
        boundaryPadding: 50, // 화면 경계 여백
      });

      console.log("Movement controller created:", controller);
    }, 500);
  }

  /**
   * 디버그 시각화 설정
   */
  private setupDebugVisualization(): void {
    // 약간의 지연 후에 디버그 시각화 추가 (캐릭터가 완전히 초기화된 후)
    setTimeout(() => {
      if (this.character && this.character.animatedSprite) {
        console.log("Adding debug visualization");

        DebugHelper.addDebugger(this.character, this.app);
      } else {
        console.error(
          "Character or animatedSprite not available for debugging"
        );
      }
    }, 1000);
  }

  public onResize(width: number, height: number): void {
    // 초기화 전에는 리사이징 무시
    if (!this.initialized) return;

    // 화면 크기 변경 시 배경 크기 조정
    if (this.background) {
      this.background.resize(width, height);
    }

    // 캐릭터 위치 재조정
    if (this.character) {
      this.positionCharacter();
      this.character.stopRandomMovement();
      this.applyCharacterMovement();
    }
  }

  public update(deltaTime: number): void {
    // 초기화 전에는 업데이트 무시
    if (!this.initialized) return;

    // 캐릭터 업데이트
    if (this.character) {
      this.character.update(deltaTime);
    }
  }
}

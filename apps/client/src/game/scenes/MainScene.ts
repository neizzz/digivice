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

  constructor(app: PIXI.Application) {
    super();
    this.app = app;

    // 디버그 헬퍼 초기화
    DebugHelper.init(app);
    // 디버그 시각화 기본 활성화
    DebugHelper.setEnabled(true);

    // 에셋 가져오기
    const assets = AssetLoader.getAssets();

    // 배경 생성 및 추가
    this.background = new Background(assets.backgroundTexture);
    this.addChild(this.background);

    // 캐릭터 생성 및 추가 (속도를 더 높게 설정)
    this.character = new Character({
      spritesheet: assets.slimeSprites,
      name: "Slime",
      initialPosition: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      speed: 1,
    });
    this.addChild(this.character);

    // 캐릭터를 씬 중앙에 배치
    this.positionCharacter();

    // 캐릭터에 랜덤 움직임 적용
    this.applyCharacterMovement();

    // 캐릭터에 디버그 시각화 추가
    this.setupDebugVisualization();

    console.log("MainScene created successfully");
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
    // 화면 크기 변경 시 배경 크기 조정
    this.background.resize(width, height);

    // 캐릭터 위치 재조정
    this.positionCharacter();

    // 움직임 컨트롤러 재설정 (화면 크기 변경으로 경계가 바뀌었으므로)
    this.character.stopRandomMovement();
    this.applyCharacterMovement();
  }

  public update(deltaTime: number): void {
    // 캐릭터 업데이트
    this.character.update(deltaTime);
  }
}

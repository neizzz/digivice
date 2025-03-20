import * as PIXI from "pixi.js";
import * as Matter from "matter-js";
import { GameEngine } from "../GameEngine";
import { AssetLoader } from "../utils/AssetLoader";

export interface PipePair {
  top: PIXI.Container;
  bottom: PIXI.Container;
  topBody: Matter.Body;
  bottomBody: Matter.Body;
  passed: boolean;
}

export class PipeGenerator {
  private app: PIXI.Application;
  private gameEngine: GameEngine;

  // 텍스처 캐싱
  private pipeBodyTexture: PIXI.Texture;
  private pipeEndTexture: PIXI.Texture;

  constructor(app: PIXI.Application, gameEngine: GameEngine) {
    this.app = app;
    this.gameEngine = gameEngine;
    this.initTextures();
  }

  /**
   * 필요한 텍스처를 초기화하고 캐시합니다.
   */
  private initTextures(): void {
    // 기본 텍스처 설정
    this.pipeBodyTexture = PIXI.Texture.WHITE;
    this.pipeEndTexture = PIXI.Texture.WHITE;

    // AssetLoader에서 텍스처 가져오기
    const assets = AssetLoader.getAssets();
    if (assets.tilesetSprites) {
      if (assets.tilesetSprites.textures["pipe-body"]) {
        this.pipeBodyTexture = assets.tilesetSprites.textures["pipe-body"];
      }
      if (assets.tilesetSprites.textures["pipe-end"]) {
        this.pipeEndTexture = assets.tilesetSprites.textures["pipe-end"];
      }
    }
  }

  /**
   * 파이프 쌍을 생성하여 반환합니다.
   */
  public createPipePair(groundHeight: number, tileSize: number): PipePair {
    const pipeWidth = tileSize;
    const minPipeHeight = tileSize;
    const availableHeight = this.app.screen.height - groundHeight;

    // 새가 지나갈 통로 높이 설정
    const minPassageHeight = Math.max(60, availableHeight * 0.2);
    const maxPassageHeight = Math.max(80, availableHeight * 0.3);
    let passageHeight =
      minPassageHeight + Math.random() * (maxPassageHeight - minPassageHeight);
    passageHeight = Math.ceil(passageHeight / tileSize) * tileSize;

    // 파이프 높이 계산
    let topPipeHeight = Math.max(
      minPipeHeight,
      Math.floor(
        (Math.random() *
          (availableHeight - passageHeight - minPipeHeight * 2)) /
          tileSize
      ) * tileSize
    );

    const groundY = this.app.screen.height - groundHeight;
    const bottomPipeHeight =
      Math.floor((availableHeight - topPipeHeight - passageHeight) / tileSize) *
      tileSize;

    // 파이프 생성
    const { pipe: topPipe, body: topPipeBody } = this.createPipe(
      topPipeHeight,
      pipeWidth,
      true
    );

    const { pipe: bottomPipe, body: bottomPipeBody } = this.createPipe(
      bottomPipeHeight,
      pipeWidth,
      false,
      groundY - bottomPipeHeight
    );

    return {
      top: topPipe,
      bottom: bottomPipe,
      topBody: topPipeBody,
      bottomBody: bottomPipeBody,
      passed: false,
    };
  }

  /**
   * 파이프를 생성합니다.
   * @param height 파이프 높이
   * @param width 파이프 너비
   * @param isTop 상단 파이프 여부
   * @param yPosition Y 좌표 (하단 파이프 전용)
   */
  private createPipe(
    height: number,
    width: number,
    isTop: boolean,
    yPosition?: number
  ): { pipe: PIXI.Container; body: Matter.Body } {
    const pipe = new PIXI.Container();
    const segmentsCount = Math.floor(height / width);
    const actualHeight = segmentsCount * width;

    pipe.pivot.set(width / 2, actualHeight / 2);

    // 상단 또는 하단 파이프에 따라 세그먼트 생성
    if (isTop) {
      // 상단 파이프 (위에서 아래로)
      for (let i = 0; i < segmentsCount - 1; i++) {
        const segment = new PIXI.Sprite(this.pipeBodyTexture);
        segment.width = width;
        segment.height = width;
        segment.position.set(0, i * width);
        pipe.addChild(segment);
      }

      // 파이프 끝부분 (회전)
      const pipeEnd = new PIXI.Sprite(this.pipeEndTexture);
      pipeEnd.width = width;
      pipeEnd.height = width;
      pipeEnd.anchor.set(0.5, 0.5);
      pipeEnd.rotation = Math.PI; // 180도 회전
      pipeEnd.position.set(width / 2, (segmentsCount - 1) * width + width / 2);
      pipe.addChild(pipeEnd);
      pipe.position.set(this.app.screen.width + width / 2, actualHeight / 2);
    } else {
      // 하단 파이프 (위에서 아래로)
      const pipeEnd = new PIXI.Sprite(this.pipeEndTexture);
      pipeEnd.width = width;
      pipeEnd.height = width;
      pipeEnd.position.set(0, 0);
      pipe.addChild(pipeEnd);

      for (let i = 1; i < segmentsCount; i++) {
        const segment = new PIXI.Sprite(this.pipeBodyTexture);
        segment.width = width;
        segment.height = width;
        segment.position.set(0, i * width);
        pipe.addChild(segment);
      }

      pipe.pivot.x = width / 2;
      pipe.position.set(this.app.screen.width + width / 2, yPosition);
    }

    // 컨테이너 크기 설정
    pipe.width = width;
    pipe.height = actualHeight;

    // 물리 바디 생성
    const bodyPosition = {
      x: this.app.screen.width + width / 2,
      y: isTop ? actualHeight / 2 : yPosition + actualHeight / 2,
    };

    const body = Matter.Bodies.rectangle(
      bodyPosition.x,
      bodyPosition.y,
      width,
      actualHeight,
      { isStatic: true, label: "pipe" }
    );

    return { pipe, body };
  }
}

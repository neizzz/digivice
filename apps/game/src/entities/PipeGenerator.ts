import * as PIXI from "pixi.js";
import * as Matter from "matter-js";
import { GameEngine } from "../GameEngine";
import { AssetLoader } from "../utils/AssetLoader";

export interface PipePair {
  top: PIXI.Sprite | PIXI.Container;
  bottom: PIXI.Sprite | PIXI.Container;
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
  private pipeEndTopTexture: PIXI.Texture;

  constructor(app: PIXI.Application, gameEngine: GameEngine) {
    this.app = app;
    this.gameEngine = gameEngine;

    // 텍스처 초기화
    this.initTextures();
  }

  /**
   * 필요한 텍스처를 초기화하고 캐시합니다.
   */
  private initTextures(): void {
    // 기본 텍스처 설정
    this.pipeBodyTexture = PIXI.Texture.WHITE;
    this.pipeEndTexture = PIXI.Texture.WHITE;
    this.pipeEndTopTexture = PIXI.Texture.WHITE;

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
    // 기본 변수 설정
    const pipeWidth = tileSize;
    const minPipeHeight = 2 * tileSize; // 최소 파이프 높이

    // 화면 가용 높이 (지면 제외)
    const availableHeight = this.app.screen.height - groundHeight;

    // 새가 지나갈 통로 높이 범위 설정 (화면 높이의 20%~30%)
    const minPassageHeight = Math.max(60, availableHeight * 0.2); // 최소 60px 또는 화면 높이의 20%
    const maxPassageHeight = Math.max(80, availableHeight * 0.3); // 최대 80px 또는 화면 높이의 30%

    // 통로 높이 랜덤 설정 (타일 크기의 배수로 반올림)
    let passageHeight =
      minPassageHeight + Math.random() * (maxPassageHeight - minPassageHeight);
    passageHeight = Math.ceil(passageHeight / tileSize) * tileSize; // 타일 크기의 배수로 반올림

    // 상단 파이프 높이 계산 및 타일 크기의 배수로 반올림
    let topPipeHeight = Math.max(
      minPipeHeight,
      minPipeHeight +
        Math.random() * (availableHeight - passageHeight - minPipeHeight * 2)
    );
    topPipeHeight = Math.floor(topPipeHeight / tileSize) * tileSize; // 타일 크기의 배수로 내림

    // 하단 파이프 타일 개수 계산 (지면에서부터 상단 파이프 아래쪽까지의 공간)
    const groundY = this.app.screen.height - groundHeight; // 지면의 y좌표
    const bottomPipeMaxHeight =
      this.app.screen.height - groundHeight - (topPipeHeight + passageHeight);
    const bottomPipeTiles = Math.floor(bottomPipeMaxHeight / tileSize);
    const bottomPipeHeight = bottomPipeTiles * tileSize; // 타일 단위로 딱 맞게 조정

    // 상단 파이프 생성
    const { pipe: topPipe, body: topPipeBody } = this.createTopPipe(
      topPipeHeight,
      pipeWidth
    );

    // 하단 파이프 생성 - 지면 높이만 전달
    const { pipe: bottomPipe, body: bottomPipeBody } = this.createBottomPipe(
      bottomPipeHeight,
      pipeWidth,
      groundY // 지면 y좌표만 전달
    );

    // 생성된 파이프 쌍 반환
    return {
      top: topPipe,
      bottom: bottomPipe,
      topBody: topPipeBody,
      bottomBody: bottomPipeBody,
      passed: false,
    };
  }

  /**
   * 상단 파이프를 생성합니다.
   */
  private createTopPipe(
    height: number,
    width: number
  ): { pipe: PIXI.Container; body: Matter.Body } {
    // 상단 파이프 생성
    const pipe = new PIXI.Container();

    // 파이프 타일 개수 계산 (정수 타일 개수)
    const segmentsCount = Math.floor(height / width);
    const actualHeight = segmentsCount * width; // 정확한 높이 재계산

    // 파이프 본체 세그먼트 생성 (마지막 하나는 파이프 끝부분용)
    for (let i = 0; i < segmentsCount - 1; i++) {
      const segment = new PIXI.Sprite(this.pipeBodyTexture);
      segment.width = width;
      segment.height = width;
      segment.position.x = 0;
      segment.position.y = i * width;
      pipe.addChild(segment);
    }

    // 상단 파이프 끝부분 추가
    const pipeEnd = new PIXI.Sprite(this.pipeEndTexture);
    pipeEnd.width = width;
    pipeEnd.height = width;
    pipeEnd.anchor.set(0.5, 0.5);
    pipeEnd.rotation = Math.PI; // 180도 회전
    pipeEnd.position.x = width / 2;
    pipeEnd.position.y = (segmentsCount - 1) * width + width / 2;
    pipe.addChild(pipeEnd);

    // 컨테이너 크기 명시적으로 지정
    pipe.width = width;
    pipe.height = actualHeight;

    // 앵커 및 위치 설정
    pipe.pivot.x = width / 2;
    pipe.pivot.y = actualHeight / 2;
    pipe.position.set(this.app.screen.width + width / 2, actualHeight / 2);

    // 물리 바디 생성 - 실제 높이 사용
    const body = Matter.Bodies.rectangle(
      this.app.screen.width + width / 2,
      actualHeight / 2,
      width,
      actualHeight,
      { isStatic: true, label: "pipe" }
    );

    return { pipe, body };
  }

  /**
   * 하단 파이프를 생성합니다.
   * @param height 파이프 높이
   * @param width 파이프 너비
   * @param groundY 지면의 y좌표
   */
  private createBottomPipe(
    height: number,
    width: number,
    groundY: number
  ): { pipe: PIXI.Container; body: Matter.Body } {
    // 하단 파이프 생성
    const pipe = new PIXI.Container();

    // 정확한 타일 개수 계산
    const segmentsCount = Math.floor(height / width);
    const actualHeight = segmentsCount * width; // 정확한 높이 재계산

    // 앵커 포인트 설정 - 하단 중앙이 기준점
    pipe.pivot.x = width / 2;
    pipe.pivot.y = height / 2; // 상단을 기준점으로 변경

    // 파이프를 상단 파이프와 간격 위치에 배치
    const topPipeAndGap = groundY - actualHeight;
    pipe.position.set(this.app.screen.width + width / 2, topPipeAndGap);

    // 파이프 끝부분 추가 - 맨 위에 위치
    const pipeEnd = new PIXI.Sprite(this.pipeEndTexture);
    pipeEnd.width = width;
    pipeEnd.height = width;
    pipeEnd.position.x = 0;
    pipeEnd.position.y = 0; // 상단 기준점에서 시작
    pipe.addChild(pipeEnd);

    // 파이프 본체 세그먼트 생성 - 위에서 아래로
    for (let i = 1; i < segmentsCount; i++) {
      const segment = new PIXI.Sprite(this.pipeBodyTexture);
      segment.width = width;
      segment.height = width;
      segment.position.x = 0;
      segment.position.y = i * width; // 상단부터 아래로 측정
      pipe.addChild(segment);
    }

    // 컨테이너 크기 명시적으로 지정
    pipe.width = width;
    pipe.height = actualHeight;

    // 물리 바디 생성 - 파이프의 중앙에 배치
    const body = Matter.Bodies.rectangle(
      this.app.screen.width + width / 2,
      topPipeAndGap + actualHeight / 2, // 파이프 중앙 위치
      width,
      actualHeight,
      { isStatic: true, label: "pipe" }
    );

    return { pipe, body };
  }
}

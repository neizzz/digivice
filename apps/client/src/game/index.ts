import { GameEngine } from "./engine";
import * as PIXI from "pixi.js";
import * as Matter from "matter-js";

export class Game {
  private engine: GameEngine;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element with id '${containerId}' not found`);
    }

    // 컨테이너 크기에 맞게 엔진 초기화
    const width = container.clientWidth;
    const height = container.clientHeight;
    this.engine = new GameEngine(width, height);

    this.engine.initialize(container);
    this.setupDemo();
  }

  private setupDemo() {
    // 간단한 데모: 사각형 생성하기
    const boxSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
    boxSprite.width = 50;
    boxSprite.height = 50;
    boxSprite.tint = 0xff0000;

    const boxBody = Matter.Bodies.rectangle(
      400,
      300, // x, y
      50,
      50, // width, height
      { restitution: 0.8 } // 탄성
    );

    // 스프라이트와 물리 객체 연동
    this.engine.addGameObject(boxSprite, boxBody);

    // 업데이트 루프에서 물리 위치에 따라 스프라이트 위치 업데이트
    this.engine.addGameObject = (sprite, body) => {
      sprite.position.set(body.position.x, body.position.y);
      sprite.rotation = body.angle;
    };
  }

  public destroy() {
    this.engine.cleanup();
  }
}

// 게임 사용 예:
// const game = new Game('game-container');

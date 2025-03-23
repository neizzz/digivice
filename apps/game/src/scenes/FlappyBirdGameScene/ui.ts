import * as PIXI from "pixi.js";

/**
 * 점수 UI 관리 클래스
 */
export class ScoreUI {
  private scoreText: PIXI.Text;
  private score: number = 0;

  constructor() {
    this.scoreText = new PIXI.Text("Score: 0", {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 4,
      align: "center",
    });
    this.scoreText.anchor.set(0.5, 0);
  }

  /**
   * 점수를 증가시키고 UI를 업데이트합니다.
   */
  public incrementScore(): void {
    this.score++;
    this.scoreText.text = `Score: ${this.score}`;
  }

  /**
   * 점수를 초기화합니다.
   */
  public resetScore(): void {
    this.score = 0;
    this.scoreText.text = "Score: 0";
  }

  /**
   * 현재 점수를 반환합니다.
   */
  public getScore(): number {
    return this.score;
  }

  /**
   * UI 요소를 반환합니다.
   */
  public getDisplayObject(): PIXI.Text {
    return this.scoreText;
  }

  /**
   * 위치를 업데이트합니다.
   */
  public updatePosition(width: number): void {
    this.scoreText.position.set(width / 2, 20);
  }
}

/**
 * 게임 오버 UI 관리 클래스
 */
export class GameOverUI {
  private container: PIXI.Container;
  private gameOverText: PIXI.Text;
  private restartText: PIXI.Text;

  constructor() {
    this.container = new PIXI.Container();

    this.gameOverText = new PIXI.Text("Game Over", {
      fontFamily: "Arial",
      fontSize: 48,
      fill: 0xffffff,
      align: "center",
      stroke: 0x000000,
      strokeThickness: 6,
    });
    this.gameOverText.name = "gameOverText";
    this.gameOverText.anchor.set(0.5);

    this.restartText = new PIXI.Text("Press SPACE to restart", {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0xffffff,
      align: "center",
      stroke: 0x000000,
      strokeThickness: 4,
    });
    this.restartText.name = "restartText";
    this.restartText.anchor.set(0.5);

    this.container.addChild(this.gameOverText);
    this.container.addChild(this.restartText);

    // 기본적으로 숨김
    this.container.visible = false;
  }

  /**
   * 게임 오버 UI를 표시합니다.
   */
  public show(): void {
    this.container.visible = true;
  }

  /**
   * 게임 오버 UI를 숨깁니다.
   */
  public hide(): void {
    this.container.visible = false;
  }

  /**
   * UI 요소를 반환합니다.
   */
  public getDisplayObject(): PIXI.Container {
    return this.container;
  }

  /**
   * 위치를 업데이트합니다.
   */
  public updatePosition(width: number, height: number): void {
    this.gameOverText.position.set(width / 2, height / 3);
    this.restartText.position.set(width / 2, height / 2);
  }
}

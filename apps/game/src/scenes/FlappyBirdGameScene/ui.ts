import * as PIXI from "pixi.js";
import { NAME_LABEL_FONT_FAMILIES } from "../../utils/nameLabel";

const FLAPPY_BIRD_FONT_FAMILIES = [...NAME_LABEL_FONT_FAMILIES];
const FLAPPY_BIRD_SCORE_FONT_SIZE = 18;
const FLAPPY_BIRD_SCORE_MARGIN_X = 4;
const FLAPPY_BIRD_SCORE_MARGIN_Y = 6;
const FLAPPY_BIRD_SCORE_LINE_GAP = 24;
const FLAPPY_BIRD_NEAR_MISS_FONT_SIZE = 21;
const FLAPPY_BIRD_NEAR_MISS_DURATION_MS = 520;
const FLAPPY_BIRD_NEAR_MISS_FLOAT_DISTANCE = 14;
const FLAPPY_BIRD_NEAR_MISS_GOOD_COLOR = 0x8ee3ff;
const FLAPPY_BIRD_NEAR_MISS_GREAT_COLOR = 0xffc857;
const FLAPPY_BIRD_COUNTDOWN_FONT_SIZE = 63;
const FLAPPY_BIRD_GAME_OVER_FONT_SIZE = 72;
const FLAPPY_BIRD_RESTART_FONT_SIZE = 36;

export class CountdownUI {
  private text: PIXI.Text;
  private remainingMs = 0;
  private currentDisplayValue = 0;
  private baseX = 0;
  private baseY = 0;

  constructor() {
    this.text = new PIXI.Text({
      text: "3",
      style: {
        fontFamily: FLAPPY_BIRD_FONT_FAMILIES,
        fontSize: FLAPPY_BIRD_COUNTDOWN_FONT_SIZE,
        fill: 0xffffff,
        align: "center",
        stroke: {
          color: 0x000000,
          width: 6,
        },
      },
    });
    this.text.anchor.set(0.5);
    this.text.visible = false;
  }

  public start(seconds: number): void {
    const countdownSeconds = Math.max(1, Math.floor(seconds));
    this.remainingMs = countdownSeconds * 1000;
    this.currentDisplayValue = countdownSeconds;
    this.text.text = String(countdownSeconds);
    this.text.visible = true;
    this.text.alpha = 1;
    this.text.scale.set(1);
    this.text.position.set(this.baseX, this.baseY);
  }

  public update(deltaTime: number): boolean {
    if (this.remainingMs <= 0) {
      return false;
    }

    this.remainingMs = Math.max(0, this.remainingMs - deltaTime);

    if (this.remainingMs <= 0) {
      this.hide();
      return true;
    }

    const nextDisplayValue = Math.max(1, Math.ceil(this.remainingMs / 1000));

    if (nextDisplayValue !== this.currentDisplayValue) {
      this.currentDisplayValue = nextDisplayValue;
      this.text.text = String(nextDisplayValue);
    }

    return false;
  }

  public hide(): void {
    this.remainingMs = 0;
    this.currentDisplayValue = 0;
    this.text.visible = false;
  }

  public getCurrentDisplayValue(): number {
    return this.currentDisplayValue;
  }

  public updatePosition(width: number, height: number): void {
    this.baseX = width / 2;
    this.baseY = height / 2;
    this.text.position.set(this.baseX, this.baseY);
  }

  public getDisplayObject(): PIXI.Text {
    return this.text;
  }
}

/**
 * 점수 UI 관리 클래스
 */
export class ScoreUI {
  private container: PIXI.Container;
  private bestScoreText: PIXI.Text;
  private scoreText: PIXI.Text;
  private score: number = 0;
  private bestScore: number = 0;

  constructor(initialBestScore = 0) {
    const textStyle = {
      fontFamily: FLAPPY_BIRD_FONT_FAMILIES,
      fontSize: FLAPPY_BIRD_SCORE_FONT_SIZE,
      fill: 0xffffff,
      stroke: {
        color: 0x000000,
        width: 4,
      },
      align: "left",
    } as const;

    this.container = new PIXI.Container();
    this.bestScoreText = new PIXI.Text({
      text: "Best: 0",
      style: textStyle,
    });
    this.scoreText = new PIXI.Text({
      text: "Score: 0",
      style: textStyle,
    });

    this.bestScoreText.anchor.set(0, 0);
    this.scoreText.anchor.set(0, 0);
    this.scoreText.position.set(0, FLAPPY_BIRD_SCORE_LINE_GAP);

    this.container.addChild(this.bestScoreText);
    this.container.addChild(this.scoreText);

    this.setBestScore(initialBestScore);
    this.resetScore();
  }

  /**
   * 점수를 증가시키고 UI를 업데이트합니다.
   */
  public incrementScore(): {
    score: number;
    bestScore: number;
    isNewBest: boolean;
  } {
    return this.addScore(1);
  }

  public addScore(amount: number): {
    score: number;
    bestScore: number;
    isNewBest: boolean;
  } {
    this.score += Math.max(0, Math.floor(amount));
    const isNewBest = this.score > this.bestScore;

    if (isNewBest) {
      this.bestScore = this.score;
    }

    this.syncText();

    return {
      score: this.score,
      bestScore: this.bestScore,
      isNewBest,
    };
  }

  /**
   * 점수를 초기화합니다.
   */
  public resetScore(): void {
    this.score = 0;
    this.syncText();
  }

  /**
   * 최고 점수를 설정합니다.
   */
  public setBestScore(score: number): void {
    this.bestScore = Math.max(0, Math.floor(score));
    this.syncText();
  }

  /**
   * 현재 점수를 반환합니다.
   */
  public getScore(): number {
    return this.score;
  }

  /**
   * 현재 최고 점수를 반환합니다.
   */
  public getBestScore(): number {
    return this.bestScore;
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
  public updatePosition(_width: number): void {
    this.container.position.set(
      FLAPPY_BIRD_SCORE_MARGIN_X,
      FLAPPY_BIRD_SCORE_MARGIN_Y,
    );
  }

  private syncText(): void {
    this.bestScoreText.text = `Best: ${this.bestScore}`;
    this.scoreText.text = `Score: ${this.score}`;
  }
}

export class NearMissUI {
  private text: PIXI.Text;
  private remainingMs = 0;
  private readonly totalDurationMs = FLAPPY_BIRD_NEAR_MISS_DURATION_MS;
  private baseX = 0;
  private baseY = 0;

  constructor() {
    this.text = new PIXI.Text({
      text: "Good!",
      style: {
        fontFamily: FLAPPY_BIRD_FONT_FAMILIES,
        fontSize: FLAPPY_BIRD_NEAR_MISS_FONT_SIZE,
        fill: FLAPPY_BIRD_NEAR_MISS_GOOD_COLOR,
        align: "center",
        stroke: {
          color: 0x000000,
          width: 4,
        },
      },
    });
    this.text.anchor.set(0.5);
    this.text.visible = false;
    this.text.alpha = 0;
  }

  public showBonus(amount: number): void {
    const feedback = resolveNearMissFeedback(amount);

    this.text.text = feedback.text;
    this.text.style.fill = feedback.fill;
    this.remainingMs = this.totalDurationMs;
    this.text.visible = true;
    this.text.alpha = 1;
    this.text.scale.set(1);
    this.text.position.set(this.baseX, this.baseY);
  }

  public update(deltaTime: number): void {
    if (this.remainingMs <= 0) {
      return;
    }

    this.remainingMs = Math.max(0, this.remainingMs - deltaTime);
    const progress = 1 - this.remainingMs / this.totalDurationMs;
    const fadeStartProgress = 0.35;
    const fadeProgress = Math.max(
      0,
      (progress - fadeStartProgress) / (1 - fadeStartProgress),
    );

    this.text.position.set(
      this.baseX,
      this.baseY - progress * FLAPPY_BIRD_NEAR_MISS_FLOAT_DISTANCE,
    );
    this.text.alpha = 1 - fadeProgress;
    this.text.scale.set(1 + (1 - progress) * 0.08);

    if (this.remainingMs <= 0) {
      this.text.visible = false;
      this.text.alpha = 0;
    }
  }

  public updatePosition(width: number, height: number): void {
    this.baseX = width / 2;
    this.baseY = Math.max(58, height * 0.24);

    if (this.remainingMs <= 0) {
      this.text.position.set(this.baseX, this.baseY);
    }
  }

  public reset(): void {
    this.remainingMs = 0;
    this.text.visible = false;
    this.text.alpha = 0;
    this.text.position.set(this.baseX, this.baseY);
  }

  public getDisplayObject(): PIXI.Text {
    return this.text;
  }
}

export function resolveNearMissFeedback(amount: number): {
  text: "Good!" | "Great!";
  fill: number;
} {
  const bonusAmount = Math.max(1, Math.floor(amount));
  const isGreat = bonusAmount >= 2;

  return {
    text: isGreat ? "Great!" : "Good!",
    fill: isGreat
      ? FLAPPY_BIRD_NEAR_MISS_GREAT_COLOR
      : FLAPPY_BIRD_NEAR_MISS_GOOD_COLOR,
  };
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

    this.gameOverText = new PIXI.Text({
      text: "Game Over",
      style: {
        fontFamily: FLAPPY_BIRD_FONT_FAMILIES,
        fontSize: FLAPPY_BIRD_GAME_OVER_FONT_SIZE,
        fill: 0xffffff,
        align: "center",
        stroke: {
          color: 0x000000,
          width: 6,
        },
      },
    });
    this.gameOverText.name = "gameOverText";
    this.gameOverText.anchor.set(0.5);

    this.restartText = new PIXI.Text({
      text: "Press SPACE to restart",
      style: {
        fontFamily: FLAPPY_BIRD_FONT_FAMILIES,
        fontSize: FLAPPY_BIRD_RESTART_FONT_SIZE,
        fill: 0xffffff,
        align: "center",
        stroke: {
          color: 0x000000,
          width: 4,
        },
      },
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

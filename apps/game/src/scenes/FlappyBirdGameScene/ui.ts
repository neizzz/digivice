import { DEFAULT_LOCALE, type LocaleCode, translate } from "@shared/i18n";
import * as PIXI from "pixi.js";
import {
  NAME_LABEL_FONT_FAMILIES,
  NAME_LABEL_FONT_WEIGHT,
} from "../../utils/nameLabel";

const FLAPPY_BIRD_FONT_FAMILIES = [...NAME_LABEL_FONT_FAMILIES];
const FLAPPY_BIRD_RETRO_FONT_FAMILY = "NeoDunggeunmo Pro";
const FLAPPY_BIRD_RETRO_FONT_FAMILIES = [
  FLAPPY_BIRD_RETRO_FONT_FAMILY,
  ...NAME_LABEL_FONT_FAMILIES,
];
const FLAPPY_BIRD_SCORE_FONT_SIZE = 18;
const FLAPPY_BIRD_SCORE_MARGIN_X = 4;
const FLAPPY_BIRD_SCORE_MARGIN_Y = 6;
const FLAPPY_BIRD_SCORE_LINE_GAP = 24;
const FLAPPY_BIRD_NEAR_MISS_FONT_SIZE = 21;
const FLAPPY_BIRD_NEAR_MISS_STROKE_WIDTH = 6;
const FLAPPY_BIRD_NEAR_MISS_DURATION_MS = 520;
const FLAPPY_BIRD_NEAR_MISS_FLOAT_DISTANCE = 14;
const FLAPPY_BIRD_NEAR_MISS_GOOD_COLOR = 0x8ee3ff;
const FLAPPY_BIRD_NEAR_MISS_GREAT_COLOR = 0xffc857;
const FLAPPY_BIRD_COUNTDOWN_FONT_SIZE = 63;
const FLAPPY_BIRD_GAME_OVER_FONT_SIZE = 72;
const FLAPPY_BIRD_RESTART_FONT_SIZE = 36;
export const FLAPPY_BIRD_RETRO_FONT_PRELOAD_TIMEOUT_MS = 2_000;

let flappyBirdRetroFontLoadPromise: Promise<boolean> | null = null;

function formatFlappyBirdBestScore(score: number): string {
  return `Best: ${score}`;
}

function formatFlappyBirdScore(score: number): string {
  return `Score: ${score}`;
}

function createFlappyBirdScoreTextStyle(
  fontFamily: readonly string[],
): PIXI.TextStyleOptions {
  return {
    fontFamily: [...fontFamily],
    fontSize: FLAPPY_BIRD_SCORE_FONT_SIZE,
    fill: 0xffffff,
    stroke: {
      color: 0x000000,
      width: 4,
    },
    align: "left",
  };
}

function createFlappyBirdCountdownTextStyle(
  fontFamily: readonly string[],
): PIXI.TextStyleOptions {
  return {
    fontFamily: [...fontFamily],
    fontSize: FLAPPY_BIRD_COUNTDOWN_FONT_SIZE,
    fill: 0xffffff,
    align: "center",
    stroke: {
      color: 0x000000,
      width: 6,
    },
  };
}

function getDocumentFontSet(): FontFaceSet | null {
  if (typeof document === "undefined") {
    return null;
  }

  return document.fonts ?? null;
}

export function isFlappyBirdRetroFontLoaded(): boolean {
  const fonts = getDocumentFontSet();

  if (typeof fonts?.check !== "function") {
    return true;
  }

  return fonts.check(`12px "${FLAPPY_BIRD_RETRO_FONT_FAMILY}"`);
}

function getInitialFlappyBirdRetroSafeFontFamilies(): readonly string[] {
  return isFlappyBirdRetroFontLoaded()
    ? FLAPPY_BIRD_RETRO_FONT_FAMILIES
    : NAME_LABEL_FONT_FAMILIES;
}

function createFlappyBirdRetroFontLoadPromise(): Promise<boolean> {
  const fonts = getDocumentFontSet();

  if (!fonts) {
    return Promise.resolve(true);
  }

  return (async () => {
    try {
      if (isFlappyBirdRetroFontLoaded()) {
        return true;
      }

      if (typeof fonts.load === "function") {
        await fonts.load(`12px "${FLAPPY_BIRD_RETRO_FONT_FAMILY}"`);
      } else {
        await fonts.ready;
      }
    } catch (error) {
      console.warn("[FlappyBirdUI] Failed to load retro font", error);
      return false;
    }

    return isFlappyBirdRetroFontLoaded();
  })();
}

export async function preloadFlappyBirdRetroFont(
  options: {
    timeoutMs?: number;
  } = {},
): Promise<boolean> {
  if (isFlappyBirdRetroFontLoaded()) {
    return true;
  }

  if (!flappyBirdRetroFontLoadPromise) {
    const loadPromise = createFlappyBirdRetroFontLoadPromise();
    let handledLoadPromise: Promise<boolean>;
    handledLoadPromise = loadPromise.then(
      (isLoaded) => {
        if (!isLoaded && flappyBirdRetroFontLoadPromise === handledLoadPromise) {
          flappyBirdRetroFontLoadPromise = null;
        }

        return isLoaded;
      },
      (error) => {
        if (flappyBirdRetroFontLoadPromise === handledLoadPromise) {
          flappyBirdRetroFontLoadPromise = null;
        }

        throw error;
      },
    );
    flappyBirdRetroFontLoadPromise = handledLoadPromise;
  }

  const timeoutMs = options.timeoutMs;

  if (typeof timeoutMs !== "number" || timeoutMs <= 0) {
    return flappyBirdRetroFontLoadPromise;
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      flappyBirdRetroFontLoadPromise,
      new Promise<boolean>((resolve) => {
        timeoutId = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

export function resetFlappyBirdRetroFontLoadStateForTest(): void {
  flappyBirdRetroFontLoadPromise = null;
}

async function loadFlappyBirdRetroFont(): Promise<boolean> {
  try {
    return await preloadFlappyBirdRetroFont();
  } catch (error) {
    console.warn("[FlappyBirdUI] Failed to load retro font", error);
    return false;
  }
}

export class CountdownUI {
  private text: PIXI.Text;
  private remainingMs = 0;
  private currentDisplayValue = 0;
  private baseX = 0;
  private baseY = 0;
  private isUsingRetroCountdownFont = false;
  private pendingRetroCountdownFontApply = false;

  constructor() {
    const initialFontFamily = getInitialFlappyBirdRetroSafeFontFamilies();
    this.isUsingRetroCountdownFont =
      initialFontFamily[0] === FLAPPY_BIRD_RETRO_FONT_FAMILY;
    this.text = new PIXI.Text({
      text: "3",
      style: createFlappyBirdCountdownTextStyle(initialFontFamily),
    });
    this.text.anchor.set(0.5);
    this.text.visible = false;

    if (!this.isUsingRetroCountdownFont) {
      void this.loadAndApplyRetroCountdownFont();
    }
  }

  public start(seconds: number): void {
    this.syncCountdownFontForStart();
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

    if (this.pendingRetroCountdownFontApply) {
      this.applyRetroCountdownFont();
    }
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

  private syncCountdownFontForStart(): void {
    this.pendingRetroCountdownFontApply = false;

    if (isFlappyBirdRetroFontLoaded()) {
      this.applyRetroCountdownFont();
      return;
    }

    this.text.style.fontFamily = [...NAME_LABEL_FONT_FAMILIES];
    this.isUsingRetroCountdownFont = false;
    void this.loadAndApplyRetroCountdownFont();
  }

  private applyRetroCountdownFont(): void {
    this.text.style.fontFamily = [...FLAPPY_BIRD_RETRO_FONT_FAMILIES];
    this.isUsingRetroCountdownFont = true;
    this.pendingRetroCountdownFontApply = false;
  }

  private async loadAndApplyRetroCountdownFont(): Promise<void> {
    if (this.isUsingRetroCountdownFont) {
      return;
    }

    const isLoaded = await loadFlappyBirdRetroFont();

    if (!isLoaded) {
      return;
    }

    if (this.remainingMs > 0) {
      this.pendingRetroCountdownFontApply = true;
      return;
    }

    this.applyRetroCountdownFont();
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
  private isUsingRetroScoreFont = false;

  constructor(initialBestScore = 0, _locale: LocaleCode = DEFAULT_LOCALE) {
    const initialFontFamily = getInitialFlappyBirdRetroSafeFontFamilies();
    this.isUsingRetroScoreFont =
      initialFontFamily[0] === FLAPPY_BIRD_RETRO_FONT_FAMILY;

    this.container = new PIXI.Container();
    this.bestScoreText = new PIXI.Text({
      text: formatFlappyBirdBestScore(0),
      style: createFlappyBirdScoreTextStyle(initialFontFamily),
    });
    this.scoreText = new PIXI.Text({
      text: formatFlappyBirdScore(0),
      style: createFlappyBirdScoreTextStyle(initialFontFamily),
    });

    this.bestScoreText.anchor.set(0, 0);
    this.scoreText.anchor.set(0, 0);
    this.scoreText.position.set(0, FLAPPY_BIRD_SCORE_LINE_GAP);

    this.container.addChild(this.bestScoreText);
    this.container.addChild(this.scoreText);

    this.setBestScore(initialBestScore);
    this.resetScore();

    if (!this.isUsingRetroScoreFont) {
      void this.loadAndApplyRetroScoreFont();
    }
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

  public setLocale(_locale: LocaleCode): void {
    this.syncText();
  }

  private syncText(): void {
    this.bestScoreText.text = formatFlappyBirdBestScore(this.bestScore);
    this.scoreText.text = formatFlappyBirdScore(this.score);
  }

  private async loadAndApplyRetroScoreFont(): Promise<void> {
    if (this.isUsingRetroScoreFont) {
      return;
    }

    const isLoaded = await loadFlappyBirdRetroFont();

    if (!isLoaded) {
      return;
    }

    this.bestScoreText.style.fontFamily = [...FLAPPY_BIRD_RETRO_FONT_FAMILIES];
    this.scoreText.style.fontFamily = [...FLAPPY_BIRD_RETRO_FONT_FAMILIES];
    this.isUsingRetroScoreFont = true;
    this.syncText();
  }
}

export class NearMissUI {
  private text: PIXI.Text;
  private remainingMs = 0;
  private readonly totalDurationMs = FLAPPY_BIRD_NEAR_MISS_DURATION_MS;
  private locale: LocaleCode;
  private baseX = 0;
  private baseY = 0;

  constructor(locale: LocaleCode = DEFAULT_LOCALE) {
    this.locale = locale;
    this.text = new PIXI.Text({
      text: translate(this.locale, "flappy.nearMissGood"),
      style: {
        fontFamily: FLAPPY_BIRD_FONT_FAMILIES,
        fontSize: FLAPPY_BIRD_NEAR_MISS_FONT_SIZE,
        fontWeight: NAME_LABEL_FONT_WEIGHT,
        fill: FLAPPY_BIRD_NEAR_MISS_GOOD_COLOR,
        align: "center",
        stroke: {
          color: 0x000000,
          width: FLAPPY_BIRD_NEAR_MISS_STROKE_WIDTH,
        },
      },
    });
    this.text.anchor.set(0.5);
    this.text.visible = false;
    this.text.alpha = 0;
  }

  public showBonus(amount: number): void {
    const feedback = resolveNearMissFeedback(amount, this.locale);

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

  public setLocale(locale: LocaleCode): void {
    this.locale = locale;
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

export function resolveNearMissFeedback(
  amount: number,
  locale: LocaleCode = DEFAULT_LOCALE,
): {
  text: string;
  fill: number;
} {
  const bonusAmount = Math.max(1, Math.floor(amount));
  const isGreat = bonusAmount >= 2;

  return {
    text: translate(locale, isGreat ? "flappy.nearMissGreat" : "flappy.nearMissGood"),
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
  private locale: LocaleCode;

  constructor(locale: LocaleCode = DEFAULT_LOCALE) {
    this.locale = locale;
    this.container = new PIXI.Container();

    this.gameOverText = new PIXI.Text({
      text: translate(this.locale, "flappy.gameOver"),
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
      text: translate(this.locale, "flappy.restartInstruction"),
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

  public setLocale(locale: LocaleCode): void {
    this.locale = locale;
    this.gameOverText.text = translate(this.locale, "flappy.gameOver");
    this.restartText.text = translate(this.locale, "flappy.restartInstruction");
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

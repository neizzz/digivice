import * as PIXI from "pixi.js";
import type { Game } from "../../Game";
import { SceneKey } from "../../SceneKey";
import type { Scene } from "../../interfaces/Scene";
import { StorageManager } from "../../managers/StorageManager";
import { ControlButtonType } from "../../ui/types";
import {
  ensureCharacterSpritesheetLoaded,
  getCharacterSpritesheetOptions,
} from "../../utils/asset";
import {
  MONSTER_CHARACTER_KEYS,
  isMonsterCharacterKey,
  type MonsterCharacterKey,
  type MonsterClassCode,
} from "../MainScene/evolutionConfig";
import {
  type MonsterBookState,
  ensureMonsterBookBackfillFromSavedData,
  hasReachedMonster,
  normalizeMonsterBookState,
} from "../MainScene/monsterBook";
import {
  type MainSceneWorldData,
  WORLD_DATA_STORAGE_KEY,
} from "../MainScene/world";
import { CharacterState, ObjectType } from "../MainScene/types";
import {
  type MonsterBookGlobalPage,
  createMonsterBookCardInfo,
  getMonsterBookFirstPageIndexForClass,
  getMonsterBookGlobalPages,
  getMonsterBookPageIndexByDelta,
  normalizeMonsterBookPageIndex,
} from "./catalog";

type MonsterBookCardView = {
  container: PIXI.Container;
  characterKey: MonsterCharacterKey;
  isReached: boolean;
};

const RETRO_FONT_FAMILY =
  '"NeoDunggeunmo Pro", "Droid Sans Mono", "SF Mono", monospace, sans-serif';
const RETRO_PRIMARY_FONT_FAMILY = "NeoDunggeunmo Pro";
const CLASS_ORDER: MonsterClassCode[] = ["A", "B", "C", "D"];
const CARDS_PER_PAGE = 6;
const CARD_COLUMNS = 3;
const CARD_ROWS = 2;
const MONSTER_BOOK_BACKGROUND_URL =
  "/assets/game/sprites/monster-book.png";
const RARITY_STAR_URL = "/assets/game/sprites/star.png";
const RARITY_STAR_SIZE = 14.4;
const RARITY_STAR_GAP = 1;
const CARD_BORDER_WIDTH = 1.5;
const CURRENT_MONSTER_CARD_BORDER_WIDTH = 3.5;
const CLASS_TITLE_FONT_SIZE = 31.68;
const CLASS_TITLE_Y_OFFSET = 16;
const CLASS_TITLE_UNDERLINE_GAP = 0.6;
const CLASS_TITLE_TO_CARD_GAP = 32.464;
const PAGE_NUMBER_FONT_SIZE = 20.9088;
const GRID_BOTTOM_PADDING = 34;
const CARD_COLUMN_GAP = 7;
const CARD_ROW_GAP = 17;
const CARD_GRID_BOTTOM_GAP = 7;
const CLASS_ACCENT_COLORS: Record<MonsterClassCode, number> = {
  A: 0x5c5147,
  B: 0x1368c4,
  C: 0x2d8a3f,
  D: 0xbe2f70,
};

export class MonsterBookScene extends PIXI.Container implements Scene {
  private readonly game: Game;
  private readonly background = new PIXI.Graphics();
  private readonly bookLayer = new PIXI.Container();
  private readonly contentLayer = new PIXI.Container();
  private monsterBookState: MonsterBookState = normalizeMonsterBookState(null);
  private currentMonsterKeys = new Set<MonsterCharacterKey>();
  private selectedPageIndex = 0;
  private cardViews: MonsterBookCardView[] = [];
  private isInitialized = false;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    switch (event.code) {
      case "Escape":
        void this.returnToMainScene();
        break;
      case "ArrowLeft":
        this.changePage(-1);
        break;
      case "ArrowRight":
        this.changePage(1);
        break;
      case "ArrowUp":
        this.selectPreviousClass();
        break;
      case "ArrowDown":
        this.selectNextClass();
        break;
    }
  };

  constructor(game: Game) {
    super();
    this.game = game;
    this.sortableChildren = true;
  }

  public async init(): Promise<MonsterBookScene> {
    this.addChild(this.background, this.bookLayer, this.contentLayer);
    this.game.changeControlButtons([
      { type: ControlButtonType.Cancel },
      { type: ControlButtonType.Previous },
      { type: ControlButtonType.Next },
    ]);

    await this.preloadRetroFont();
    await this.loadMonsterBookState();
    await Promise.all([
      this.preloadBookBackground(),
      this.preloadRarityStar(),
      this.preloadReachedMonsterSprites(),
    ]);
    window.addEventListener("keydown", this.handleKeyDown);
    this.isInitialized = true;
    this.renderScene();
    return this;
  }

  public update(): void {
    // Static collection scene.
  }

  public handleControlButtonClick(buttonType: ControlButtonType): void {
    switch (buttonType) {
      case ControlButtonType.Cancel:
        void this.returnToMainScene();
        break;
      case ControlButtonType.Previous:
        this.changePage(-1);
        break;
      case ControlButtonType.Next:
        this.changePage(1);
        break;
    }
  }

  public handleSliderValueChange(): void {
    // No-op.
  }

  public handleSliderEnd(): void {
    // No-op.
  }

  public resize(): void {
    if (!this.isInitialized) {
      return;
    }

    this.renderScene();
  }

  public destroy(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    this.removeChildren();
    super.destroy({ children: true });
  }

  private async loadMonsterBookState(): Promise<void> {
    const data = await StorageManager.getData<MainSceneWorldData>(
      WORLD_DATA_STORAGE_KEY,
    );

    if (!data) {
      this.monsterBookState = normalizeMonsterBookState(null);
      this.currentMonsterKeys = new Set();
      return;
    }

    ensureMonsterBookBackfillFromSavedData(data, Date.now());
    this.monsterBookState = normalizeMonsterBookState(
      data.world_metadata.app_state?.monster_book,
    );
    this.currentMonsterKeys = getCurrentMonsterCharacterKeys(data);

    await StorageManager.setData(WORLD_DATA_STORAGE_KEY, data);
  }

  private async preloadBookBackground(): Promise<void> {
    try {
      await PIXI.Assets.load(MONSTER_BOOK_BACKGROUND_URL);
    } catch (error) {
      console.error("[MonsterBookScene] Failed to load book background", {
        url: MONSTER_BOOK_BACKGROUND_URL,
        error,
      });
    }
  }

  private async preloadRarityStar(): Promise<void> {
    try {
      const texture = await PIXI.Assets.load<PIXI.Texture>(RARITY_STAR_URL);
      texture.source.scaleMode = "nearest";
    } catch (error) {
      console.error("[MonsterBookScene] Failed to load rarity star", {
        url: RARITY_STAR_URL,
        error,
      });
    }
  }

  private async preloadRetroFont(): Promise<void> {
    if (typeof document === "undefined") {
      return;
    }

    try {
      await document.fonts?.load(`22px "${RETRO_PRIMARY_FONT_FAMILY}"`);
    } catch (error) {
      console.warn("[MonsterBookScene] Failed to load retro font", error);
    }
  }

  private async preloadReachedMonsterSprites(): Promise<void> {
    const reachedKeys = MONSTER_CHARACTER_KEYS.filter((characterKey) =>
      hasReachedMonster(this.monsterBookState, characterKey),
    );

    await Promise.all(
      reachedKeys.map((characterKey) =>
        ensureCharacterSpritesheetLoaded({
          characterKey,
          reason: "init",
          maxRetries: 1,
        }),
      ),
    );
  }

  private renderScene(): void {
    this.clearContainer(this.bookLayer);
    this.clearContainer(this.contentLayer);
    this.cardViews = [];

    const { width, height } = this.game.app.screen;
    this.drawBookBackground(width, height);

    const layout = this.getLayout(width, height);
    this.drawHeader(layout);
    this.drawPageNumber(layout);
    this.drawCards(layout);
  }

  private drawBookBackground(width: number, height: number): void {
    this.background.clear();
    this.background.rect(0, 0, width, height).fill({ color: 0x1f0507 });

    const texture =
      PIXI.Assets.get<PIXI.Texture>(MONSTER_BOOK_BACKGROUND_URL) ??
      PIXI.Texture.WHITE;
    const bookBackground = new PIXI.Sprite(texture);
    bookBackground.width = width;
    bookBackground.height = height;
    bookBackground.eventMode = "none";
    this.bookLayer.addChild(bookBackground);
  }

  private drawHeader(layout: ReturnType<MonsterBookScene["getLayout"]>): void {
    const currentPage = this.getCurrentPage();
    const accentColor = this.getCurrentClassAccentColor();
    const title = this.createText(`Class ${currentPage.classCode}`, {
      fontSize: CLASS_TITLE_FONT_SIZE,
      fill: accentColor,
      fontWeight: "700",
    });
    title.anchor.set(0.5, 0);
    title.position.set(
      layout.pageX + layout.pageWidth / 2,
      layout.pageY + CLASS_TITLE_Y_OFFSET,
    );

    const underlineWidth = Math.max(78, title.width + 10);
    const underline = new PIXI.Graphics()
      .roundRect(
        layout.pageX + layout.pageWidth / 2 - underlineWidth / 2,
        layout.pageY +
          CLASS_TITLE_Y_OFFSET +
          CLASS_TITLE_FONT_SIZE +
          CLASS_TITLE_UNDERLINE_GAP,
        underlineWidth,
        2,
        1,
      )
      .fill({ color: accentColor, alpha: 0.86 });
    this.contentLayer.addChild(title, underline);
  }

  private drawPageNumber(
    layout: ReturnType<MonsterBookScene["getLayout"]>,
  ): void {
    const currentPage = this.getCurrentPage();
    const accentColor = this.getCurrentClassAccentColor();
    const pageNumber = this.createText(
      `${currentPage.globalPageIndex + 1} / ${currentPage.totalGlobalPages}`,
      {
        fontSize: PAGE_NUMBER_FONT_SIZE,
        fill: accentColor,
        fontWeight: "700",
      },
    );
    pageNumber.anchor.set(0, 0);
    pageNumber.position.set(layout.contentX, layout.pageY + 21);
    this.contentLayer.addChild(pageNumber);
  }

  private drawCards(layout: ReturnType<MonsterBookScene["getLayout"]>): void {
    const entries = this.getCurrentPageEntries();
    const cardWidth = Math.floor(
      (layout.contentWidth - CARD_COLUMN_GAP * 2) / CARD_COLUMNS,
    );
    const cardHeight = Math.floor(
      (layout.gridHeight - CARD_ROW_GAP - CARD_GRID_BOTTOM_GAP) / CARD_ROWS,
    );

    entries.forEach((characterKey, index) => {
      const col = index % CARD_COLUMNS;
      const row = Math.floor(index / CARD_COLUMNS);
      const x = layout.contentX + col * (cardWidth + CARD_COLUMN_GAP);
      const y = layout.gridY + row * (cardHeight + CARD_ROW_GAP);
      const card = this.createCard(characterKey, {
        x,
        y,
        width: cardWidth,
        height: cardHeight,
      });
      this.contentLayer.addChild(card.container);
      this.cardViews.push(card);
    });
  }

  private createCard(
    characterKey: MonsterCharacterKey,
    params: { x: number; y: number; width: number; height: number },
  ): MonsterBookCardView {
    const cardInfo = createMonsterBookCardInfo({
      characterKey,
      monsterBookState: this.monsterBookState,
    });
    const isReached = cardInfo.isReached;
    const isCurrentMonster = this.currentMonsterKeys.has(characterKey);
    const container = new PIXI.Container();
    const cardBackground = new PIXI.Graphics()
      .roundRect(params.x, params.y, params.width, params.height, 6)
      .fill({ color: isReached ? 0xffe7af : 0xb58a62 })
      .stroke({
        color: this.getCurrentClassAccentColor(),
        width: isCurrentMonster
          ? CURRENT_MONSTER_CARD_BORDER_WIDTH
          : CARD_BORDER_WIDTH,
      });
    container.addChild(cardBackground);

    this.drawRarityStars(
      container,
      cardInfo.rarity,
      params.x + 6,
      params.y + 5,
    );

    if (isReached) {
      this.addMonsterSprite(container, characterKey, params);
    } else {
      const unknown = this.createText("?", {
        fontSize: Math.max(26, Math.floor(params.height * 0.48)),
        fill: 0x4b2c21,
        fontWeight: "700",
      });
      unknown.anchor.set(0.5);
      unknown.position.set(params.x + params.width / 2, params.y + params.height / 2 + 3);
      container.addChild(unknown);
    }

    return {
      container,
      characterKey,
      isReached,
    };
  }

  private drawRarityStars(
    container: PIXI.Container,
    count: number,
    x: number,
    y: number,
  ): void {
    const texture =
      PIXI.Assets.get<PIXI.Texture>(RARITY_STAR_URL) ?? PIXI.Texture.WHITE;
    const starContainer = new PIXI.Container();

    for (let index = 0; index < count; index++) {
      const star = new PIXI.Sprite(texture);
      star.width = RARITY_STAR_SIZE;
      star.height = RARITY_STAR_SIZE;
      star.roundPixels = true;
      star.position.set(index * (RARITY_STAR_SIZE + RARITY_STAR_GAP), 0);
      starContainer.addChild(star);
    }

    starContainer.position.set(x, y);
    container.addChild(starContainer);
  }

  private addMonsterSprite(
    container: PIXI.Container,
    characterKey: MonsterCharacterKey,
    params: { x: number; y: number; width: number; height: number },
  ): void {
    const options = getCharacterSpritesheetOptions(characterKey);
    const alias = options?.alias ?? null;
    const spritesheet = alias
      ? PIXI.Assets.get<PIXI.Spritesheet>(alias)
      : null;
    const textures = spritesheet?.animations?.idle;

    if (!textures || textures.length === 0) {
      return;
    }

    const sprite = new PIXI.AnimatedSprite(textures);
    sprite.anchor.set(0.5);
    sprite.animationSpeed = 0.04;
    sprite.play();
    const maxSpriteSize = Math.min(params.width * 0.696, params.height * 0.624);
    const sourceWidth = sprite.texture.width || 16;
    const sourceHeight = sprite.texture.height || 16;
    const scale = maxSpriteSize / Math.max(sourceWidth, sourceHeight);
    sprite.scale.set(scale);
    sprite.position.set(
      params.x + params.width / 2,
      params.y + params.height / 2 + 3,
    );
    container.addChild(sprite);
  }

  private selectPreviousClass(): void {
    const currentIndex = CLASS_ORDER.indexOf(this.getCurrentPage().classCode);
    this.selectClass(
      CLASS_ORDER[(currentIndex - 1 + CLASS_ORDER.length) % CLASS_ORDER.length],
    );
  }

  private selectNextClass(): void {
    const currentIndex = CLASS_ORDER.indexOf(this.getCurrentPage().classCode);
    this.selectClass(CLASS_ORDER[(currentIndex + 1) % CLASS_ORDER.length]);
  }

  private selectClass(classCode: MonsterClassCode): void {
    this.selectedPageIndex = getMonsterBookFirstPageIndexForClass({
      classOrder: CLASS_ORDER,
      cardsPerPage: CARDS_PER_PAGE,
      classCode,
    });
    this.renderScene();
  }

  private changePage(delta: number): void {
    const globalPages = this.getGlobalPages();
    this.selectedPageIndex = getMonsterBookPageIndexByDelta({
      pageIndex: this.getNormalizedSelectedPageIndex(),
      delta,
      totalPages: globalPages.length,
    });
    this.renderScene();
  }

  private getCurrentPageEntries(): MonsterCharacterKey[] {
    return this.getCurrentPage().entries;
  }

  private getCurrentPage(): MonsterBookGlobalPage {
    const globalPages = this.getGlobalPages();
    return globalPages[this.getNormalizedSelectedPageIndex()];
  }

  private getNormalizedSelectedPageIndex(): number {
    return normalizeMonsterBookPageIndex({
      pageIndex: this.selectedPageIndex,
      totalPages: this.getGlobalPages().length,
    });
  }

  private getGlobalPages(): MonsterBookGlobalPage[] {
    return getMonsterBookGlobalPages({
      classOrder: CLASS_ORDER,
      cardsPerPage: CARDS_PER_PAGE,
    });
  }

  private getCurrentClassAccentColor(): number {
    return CLASS_ACCENT_COLORS[this.getCurrentPage().classCode];
  }

  private getLayout(width: number, height: number) {
    const pageX = Math.max(20, width * 0.055);
    const pageY = Math.max(12, height * 0.03);
    const pageWidth = Math.max(220, width * 0.845);
    const pageHeight = Math.max(260, height * 0.915);
    const contentX = pageX + Math.max(12, width * 0.035);
    const contentWidth = pageWidth - Math.max(28, width * 0.075);
    const gridYOffset =
      CLASS_TITLE_Y_OFFSET + CLASS_TITLE_FONT_SIZE + CLASS_TITLE_TO_CARD_GAP;
    const gridY = pageY + gridYOffset;
    const gridHeight = Math.max(
      210,
      pageHeight - gridYOffset - GRID_BOTTOM_PADDING,
    );

    return {
      pageX,
      pageY,
      pageWidth,
      pageHeight,
      contentX,
      contentWidth,
      gridY,
      gridHeight,
    };
  }

  private createText(
    text: string,
    style: Partial<PIXI.TextStyleOptions>,
  ): PIXI.Text {
    return new PIXI.Text({
      text,
      style: {
        fontFamily: RETRO_FONT_FAMILY,
        align: "center",
        ...style,
      },
    });
  }

  private clearContainer(container: PIXI.Container): void {
    for (const child of container.removeChildren()) {
      child.destroy({ children: true });
    }
  }

  private async returnToMainScene(): Promise<void> {
    await this.game.changeScene(SceneKey.MAIN);
  }
}

function getCurrentMonsterCharacterKeys(
  data: MainSceneWorldData,
): Set<MonsterCharacterKey> {
  const characterKeys = new Set<MonsterCharacterKey>();

  for (const entity of data.entities ?? []) {
    const object = entity.components.object;
    const characterStatus = entity.components.characterStatus;

    if (
      object?.type !== ObjectType.CHARACTER ||
      object.state === CharacterState.EGG ||
      object.state === CharacterState.DEAD ||
      !characterStatus
    ) {
      continue;
    }

    if (isMonsterCharacterKey(characterStatus.characterKey)) {
      characterKeys.add(characterStatus.characterKey);
    }
  }

  return characterKeys;
}

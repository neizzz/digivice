import * as PIXI from "pixi.js";
import type { Game } from "../../Game";
import type { Scene } from "../../interfaces/Scene";
import { StorageManager } from "../../managers/StorageManager";
import { SceneKey } from "../../SceneKey";
import { ControlButtonType } from "../../ui/types";
import {
  ensureCharacterSpritesheetLoaded,
  getCharacterSpritesheetOptions,
} from "../../utils/asset";
import {
  MONSTER_CHARACTER_KEYS,
  MONSTER_EVOLUTION_CATALOG,
  type MonsterCharacterKey,
  type MonsterClassCode,
} from "../MainScene/evolutionConfig";
import {
  hasReachedMonster,
  normalizeMonsterBookState,
  ensureMonsterBookBackfillFromSavedData,
  type MonsterBookState,
} from "../MainScene/monsterBook";
import {
  type MainSceneWorldData,
  WORLD_DATA_STORAGE_KEY,
} from "../MainScene/world";

type MonsterBookClassPageIndex = Record<MonsterClassCode, number>;

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
const RARITY_STAR_SIZE = 12;
const RARITY_STAR_GAP = 1;
const RARITY_STAR_COUNT_BY_CLASS: Record<MonsterClassCode, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
};

export class MonsterBookScene extends PIXI.Container implements Scene {
  private readonly game: Game;
  private readonly background = new PIXI.Graphics();
  private readonly bookLayer = new PIXI.Container();
  private readonly contentLayer = new PIXI.Container();
  private monsterBookState: MonsterBookState = normalizeMonsterBookState(null);
  private selectedClass: MonsterClassCode = "A";
  private selectedCardIndex = 0;
  private classPageIndex: MonsterBookClassPageIndex = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
  };
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
      case "Tab":
        event.preventDefault();
        this.selectNextCard();
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
      return;
    }

    ensureMonsterBookBackfillFromSavedData(data, Date.now());
    this.monsterBookState = normalizeMonsterBookState(
      data.world_metadata.app_state?.monster_book,
    );
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
    const title = this.createText(`Class ${this.selectedClass}`, {
      fontSize: 22,
      fill: 0x4a160f,
      fontWeight: "700",
    });
    title.anchor.set(0.5, 0);
    title.position.set(layout.pageX + layout.pageWidth / 2, layout.pageY + 16);
    title.eventMode = "static";
    title.cursor = "pointer";
    title.on("pointertap", () => this.selectNextClass());

    const underlineWidth = Math.max(78, title.width + 10);
    const underline = new PIXI.Graphics()
      .roundRect(
        layout.pageX + layout.pageWidth / 2 - underlineWidth / 2,
        layout.pageY + 43,
        underlineWidth,
        2,
        1,
      )
      .fill({ color: 0x4a160f, alpha: 0.86 });
    this.contentLayer.addChild(title, underline);
  }

  private drawPageNumber(
    layout: ReturnType<MonsterBookScene["getLayout"]>,
  ): void {
    const currentPage = this.classPageIndex[this.selectedClass] ?? 0;
    const totalPages = this.getTotalPages(this.selectedClass);
    const pageNumber = this.createText(`${currentPage + 1} / ${totalPages}`, {
      fontSize: 11,
      fill: 0x6d3b24,
      fontWeight: "700",
    });
    pageNumber.anchor.set(0, 0);
    pageNumber.position.set(layout.contentX, layout.pageY + 21);
    this.contentLayer.addChild(pageNumber);
  }

  private drawCards(layout: ReturnType<MonsterBookScene["getLayout"]>): void {
    const entries = this.getCurrentPageEntries();
    const gap = 7;
    const cardWidth = Math.floor((layout.contentWidth - gap * 2) / CARD_COLUMNS);
    const cardHeight = Math.floor((layout.gridHeight - gap * 2) / CARD_ROWS);

    entries.forEach((characterKey, index) => {
      const col = index % CARD_COLUMNS;
      const row = Math.floor(index / CARD_COLUMNS);
      const x = layout.contentX + col * (cardWidth + gap);
      const y = layout.gridY + row * (cardHeight + gap);
      const card = this.createCard(characterKey, {
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        index,
      });
      this.contentLayer.addChild(card.container);
      this.cardViews.push(card);
    });
  }

  private createCard(
    characterKey: MonsterCharacterKey,
    params: { x: number; y: number; width: number; height: number; index: number },
  ): MonsterBookCardView {
    const spec = MONSTER_EVOLUTION_CATALOG[characterKey];
    const isReached = hasReachedMonster(this.monsterBookState, characterKey);
    const isSelected = this.selectedCardIndex === params.index;
    const container = new PIXI.Container();
    const cardBackground = new PIXI.Graphics()
      .roundRect(params.x, params.y, params.width, params.height, 6)
      .fill({ color: isReached ? 0xffe7af : 0xb58a62 })
      .stroke({
        color: isSelected ? 0x9d2025 : 0x6c3f24,
        width: isSelected ? 3 : 1.5,
      });
    container.addChild(cardBackground);

    this.drawRarityStars(
      container,
      RARITY_STAR_COUNT_BY_CLASS[spec.classCode],
      params.x + 6,
      params.y + 5,
    );

    if (isReached) {
      this.addMonsterSprite(container, characterKey, params);
      const name = this.createText(spec.code.replace("green-slime_", ""), {
        fontSize: 8,
        fill: 0x4a160f,
        fontWeight: "700",
      });
      name.anchor.set(0.5, 1);
      name.position.set(params.x + params.width / 2, params.y + params.height - 5);
      container.addChild(name);
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

    container.eventMode = "static";
    container.cursor = "pointer";
    container.on("pointertap", () => {
      this.selectedCardIndex = params.index;
      this.renderScene();
    });

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
    const maxSpriteSize = Math.min(params.width * 0.58, params.height * 0.52);
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

  private selectNextCard(): void {
    const entries = this.getCurrentPageEntries();
    if (entries.length === 0) {
      return;
    }

    this.selectedCardIndex = (this.selectedCardIndex + 1) % entries.length;
    this.renderScene();
  }

  private selectPreviousClass(): void {
    const currentIndex = CLASS_ORDER.indexOf(this.selectedClass);
    this.selectedClass =
      CLASS_ORDER[(currentIndex - 1 + CLASS_ORDER.length) % CLASS_ORDER.length];
    this.selectedCardIndex = 0;
    this.renderScene();
  }

  private selectNextClass(): void {
    const currentIndex = CLASS_ORDER.indexOf(this.selectedClass);
    this.selectedClass = CLASS_ORDER[(currentIndex + 1) % CLASS_ORDER.length];
    this.selectedCardIndex = 0;
    this.renderScene();
  }

  private changePage(delta: number): void {
    const totalPages = this.getTotalPages(this.selectedClass);
    const currentPage = this.classPageIndex[this.selectedClass] ?? 0;
    this.classPageIndex[this.selectedClass] =
      (currentPage + delta + totalPages) % totalPages;
    this.selectedCardIndex = 0;
    this.renderScene();
  }

  private getCurrentPageEntries(): MonsterCharacterKey[] {
    const entries = this.getEntriesForClass(this.selectedClass);
    const page = this.classPageIndex[this.selectedClass] ?? 0;
    return entries.slice(page * CARDS_PER_PAGE, (page + 1) * CARDS_PER_PAGE);
  }

  private getEntriesForClass(classCode: MonsterClassCode): MonsterCharacterKey[] {
    return MONSTER_CHARACTER_KEYS.filter(
      (characterKey) =>
        MONSTER_EVOLUTION_CATALOG[characterKey].classCode === classCode,
    );
  }

  private getTotalPages(classCode: MonsterClassCode): number {
    return Math.max(
      1,
      Math.ceil(this.getEntriesForClass(classCode).length / CARDS_PER_PAGE),
    );
  }

  private getLayout(width: number, height: number) {
    const pageX = Math.max(20, width * 0.055);
    const pageY = Math.max(12, height * 0.03);
    const pageWidth = Math.max(220, width * 0.845);
    const pageHeight = Math.max(260, height * 0.915);
    const contentX = pageX + Math.max(12, width * 0.035);
    const contentWidth = pageWidth - Math.max(28, width * 0.075);
    const gridY = pageY + 58;
    const gridHeight = Math.max(210, pageHeight - 92);

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

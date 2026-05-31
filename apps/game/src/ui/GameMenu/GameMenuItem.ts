export enum GameMenuItemType {
  MiniGame = "mini-game",
  Feed = "feed",
  Versus = "versus",
  Drug = "drug",
  Clean = "clean",
  Hospital = "hospital",
  Information = "information",
  // Training = "training",
}

const MENU_ITEM_SIZE_MIN = 32;
const MENU_ITEM_SIZE_MID = 36;
const MENU_ITEM_SIZE_MAX = 40;
const MENU_ITEM_SIZE_MID_VIEWPORT = 360;
const MENU_ITEM_SIZE_MAX_VIEWPORT = 420;
const LEGACY_MENU_SPRITE_SLOT_COUNT = 8;
const LEGACY_MENU_SPRITE_URL = "/assets/game/sprites/menu-items.png";
const GAME_MENU_SPRITE_URL = "/assets/game/sprites/game-menu.png";
const GAME_MENU_JSON_URL = "/assets/game/sprites/game-menu.json";

type SpriteFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type SpriteSheetMetadata = {
  frames: Record<string, SpriteFrame>;
  size: {
    w: number;
    h: number;
  };
};

type ResolvedFrameBackgroundParams = {
  frame: SpriteFrame;
  sheetSize: SpriteSheetMetadata["size"];
  imageUrl: string;
  containerSize: number;
  targetSpriteSize: number;
  fineTuneX?: number;
};

const MENU_SPRITE_FINE_TUNE_X: Partial<Record<GameMenuItemType, number>> = {
  [GameMenuItemType.Drug]: 1,
};

const MENU_SPRITE_SIZE_DELTA: Partial<Record<GameMenuItemType, number>> = {
  [GameMenuItemType.Hospital]: 4,
};

const MENU_ICON_SCALE: Partial<Record<GameMenuItemType, number>> = {
  [GameMenuItemType.MiniGame]: 0.94,
  [GameMenuItemType.Clean]: 0.9,
  [GameMenuItemType.Information]: 0.92,
  [GameMenuItemType.Hospital]: 0.84,
};

const MENU_ICON_NAME_BY_TYPE: Partial<Record<GameMenuItemType, string>> = {
  [GameMenuItemType.MiniGame]: "menu_game",
  [GameMenuItemType.Clean]: "menu_bin",
  [GameMenuItemType.Information]: "menu_info",
  [GameMenuItemType.Hospital]: "menu_hospital",
};

const getLegacySpriteSlotIndex = (type: GameMenuItemType): number => {
  switch (type) {
    case GameMenuItemType.MiniGame:
      return 0;
    case GameMenuItemType.Feed:
      return 1;
    case GameMenuItemType.Versus:
      return 2;
    case GameMenuItemType.Drug:
      return 3;
    case GameMenuItemType.Clean:
      return 4;
    case GameMenuItemType.Information:
      return 5;
    case GameMenuItemType.Hospital:
      return 7;
    default:
      throw new Error(`Unknown menu item type: ${type}`);
  }
};

const inferSpriteSheetSize = (
  frames: Record<string, SpriteFrame>,
): SpriteSheetMetadata["size"] => {
  let maxRight = 0;
  let maxBottom = 0;

  for (const frame of Object.values(frames)) {
    maxRight = Math.max(maxRight, frame.x + frame.w);
    maxBottom = Math.max(maxBottom, frame.y + frame.h);
  }

  return {
    w: maxRight,
    h: maxBottom,
  };
};

const normalizeGameMenuMetadata = (data: unknown): SpriteSheetMetadata | null => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  const frames: Record<string, SpriteFrame> = {};

  for (const [key, value] of Object.entries(data)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }

    const frame = value as Partial<SpriteFrame>;
    if (
      typeof frame.x !== "number" ||
      typeof frame.y !== "number" ||
      typeof frame.w !== "number" ||
      typeof frame.h !== "number"
    ) {
      continue;
    }

    frames[key] = {
      x: frame.x,
      y: frame.y,
      w: frame.w,
      h: frame.h,
    };
  }

  if (Object.keys(frames).length === 0) {
    return null;
  }

  return {
    frames,
    size: inferSpriteSheetSize(frames),
  };
};

let gameMenuSheetPromise: Promise<SpriteSheetMetadata | null> | null = null;
let gameMenuSheetMetadata: SpriteSheetMetadata | null = null;
const spriteImagePromiseByUrl = new Map<string, Promise<HTMLImageElement | null>>();
const isolatedFrameDataUrlCache = new Map<string, string>();

const fetchSpriteSheetMetadata = async (
  url: string,
  normalizer: (data: unknown) => SpriteSheetMetadata | null,
): Promise<SpriteSheetMetadata | null> => {
  if (typeof fetch !== "function") {
    return null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    return normalizer(await response.json());
  } catch {
    return null;
  }
};

const loadGameMenuSheetMetadata = (): Promise<SpriteSheetMetadata | null> => {
  if (!gameMenuSheetPromise) {
    gameMenuSheetPromise = fetchSpriteSheetMetadata(
      GAME_MENU_JSON_URL,
      normalizeGameMenuMetadata,
    ).then((metadata) => {
      gameMenuSheetMetadata = metadata;
      return metadata;
    });
  }

  return gameMenuSheetPromise;
};

const getResolvedFrameRenderKey = (
  params: ResolvedFrameBackgroundParams,
): string =>
  [
    params.imageUrl,
    params.frame.x,
    params.frame.y,
    params.frame.w,
    params.frame.h,
    params.containerSize,
    params.targetSpriteSize,
    params.fineTuneX ?? 0,
  ].join(":");

const getIsolatedFrameCacheKey = (
  imageUrl: string,
  frame: SpriteFrame,
): string => `${imageUrl}:${frame.x}:${frame.y}:${frame.w}:${frame.h}`;

const loadSpriteImage = (url: string): Promise<HTMLImageElement | null> => {
  const cachedPromise = spriteImagePromiseByUrl.get(url);
  if (cachedPromise) {
    return cachedPromise;
  }

  if (typeof Image === "undefined") {
    return Promise.resolve(null);
  }

  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });

  spriteImagePromiseByUrl.set(url, promise);
  return promise;
};

const createIsolatedFrameDataUrl = (
  image: HTMLImageElement,
  frame: SpriteFrame,
): string | null => {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = frame.w;
  canvas.height = frame.h;

  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, frame.w, frame.h);
  context.drawImage(
    image,
    frame.x,
    frame.y,
    frame.w,
    frame.h,
    0,
    0,
    frame.w,
    frame.h,
  );

  return canvas.toDataURL();
};

const getIsolatedFrameBackgroundPosition = (params: {
  frame: SpriteFrame;
  containerSize: number;
  targetSpriteSize: number;
  fineTuneX?: number;
}) => {
  const { frame, containerSize, targetSpriteSize, fineTuneX = 0 } = params;
  const scale = targetSpriteSize / Math.max(frame.w, frame.h);
  const scaledFrameWidth = Math.round(frame.w * scale);
  const scaledFrameHeight = Math.round(frame.h * scale);
  const centerOffsetX = Math.floor((containerSize - scaledFrameWidth) / 2);
  const centerOffsetY = Math.floor((containerSize - scaledFrameHeight) / 2);

  return {
    backgroundPosition: `${centerOffsetX + fineTuneX}px ${centerOffsetY}px`,
    backgroundSize: `${scaledFrameWidth}px ${scaledFrameHeight}px`,
  };
};

const getBackgroundPosition = (params: {
  frame: SpriteFrame;
  sheetSize: SpriteSheetMetadata["size"];
  containerSize: number;
  targetSpriteSize: number;
  fineTuneX?: number;
}) => {
  const { frame, sheetSize, containerSize, targetSpriteSize, fineTuneX = 0 } =
    params;
  const scale = targetSpriteSize / Math.max(frame.w, frame.h);
  const scaledFrameWidth = frame.w * scale;
  const scaledFrameHeight = frame.h * scale;
  const centerOffsetX = Math.floor((containerSize - scaledFrameWidth) / 2);
  const centerOffsetY = Math.floor((containerSize - scaledFrameHeight) / 2);

  return {
    backgroundPosition: `${Math.round(-frame.x * scale + centerOffsetX + fineTuneX)}px ${Math.round(-frame.y * scale + centerOffsetY)}px`,
    backgroundSize: `${Math.round(sheetSize.w * scale)}px ${Math.round(sheetSize.h * scale)}px`,
  };
};

const getLegacyBackgroundPosition = (
  type: GameMenuItemType,
  containerSize: number,
  spriteSize: number,
) => {
  const fineTuneX = MENU_SPRITE_FINE_TUNE_X[type] ?? 0;
  const slotIndex = getLegacySpriteSlotIndex(type);
  const centerOffset = Math.floor((containerSize - spriteSize) / 2);

  return `${-slotIndex * spriteSize + centerOffset + fineTuneX}px ${centerOffset}px`;
};

const getResponsiveMenuItemSize = (availableWidth: number): number => {
  if (availableWidth >= MENU_ITEM_SIZE_MAX_VIEWPORT) {
    return MENU_ITEM_SIZE_MAX;
  }

  if (availableWidth >= MENU_ITEM_SIZE_MID_VIEWPORT) {
    return MENU_ITEM_SIZE_MID;
  }

  return MENU_ITEM_SIZE_MIN;
};

export class GameMenuItem {
  private element: HTMLDivElement;
  private iconElement: HTMLDivElement;
  private itemType: GameMenuItemType;
  private isFocused = false;
  private isDisabled = false;
  private feedPreviewTextureName: string | null = null;
  private pendingResolvedFrameRenderKey: string | null = null;

  constructor(itemType: GameMenuItemType) {
    this.itemType = itemType;
    this.element = document.createElement("div");
    this.element.className = "game-menu-item";
    this.iconElement = document.createElement("div");
    this.iconElement.className = "game-menu-item-icon";

    // 타입별 클래스 추가 - 이미 kebab-case로 변경되어 있으므로 그대로 사용
    this.element.classList.add(`type-${itemType}`);
    this.element.appendChild(this.iconElement);

    this.updateSize();
    void this.loadSpriteMetadata();

    // 초기 포커스 상태 설정
    this.updateFocusState();
  }

  public setFocused(focused: boolean): void {
    if (this.isDisabled) return; // 비활성화된 경우 포커스 설정 불가

    if (this.isFocused === focused) return; // 상태가 변경되지 않으면 리턴

    this.isFocused = focused;
    this.updateFocusState();
  }

  public setDisabled(disabled: boolean): void {
    if (this.isDisabled === disabled) return; // 상태가 변경되지 않으면 리턴

    this.isDisabled = disabled;

    // 비활성화 시 포커스 제거
    if (disabled && this.isFocused) {
      this.isFocused = false;
    }

    this.updateDisabledState();
    this.updateFocusState();
  }

  public isMenuDisabled(): boolean {
    return this.isDisabled;
  }

  private updateFocusState(): void {
    if (this.isFocused) {
      this.element.classList.add("focused");
    } else {
      this.element.classList.remove("focused");
    }
  }

  private updateDisabledState(): void {
    if (this.isDisabled) {
      this.element.classList.add("disabled");
    } else {
      this.element.classList.remove("disabled");
    }
  }

  public getElement(): HTMLDivElement {
    return this.element;
  }

  public getSize(): number {
    return Number.parseInt(this.element.style.height);
  }

  public setFeedPreviewTextureName(textureName: string | null): void {
    if (this.feedPreviewTextureName === textureName) {
      return;
    }

    this.feedPreviewTextureName = textureName;
    this.updateSize();
    void this.loadSpriteMetadata();
  }

  private async loadSpriteMetadata(): Promise<void> {
    await loadGameMenuSheetMetadata();
    this.updateSize();
  }

  private applyBackgroundStyle(
    imageUrl: string,
    backgroundPosition: string,
    backgroundSize: string,
  ): void {
    this.iconElement.style.backgroundImage = `url("${imageUrl}")`;
    this.iconElement.style.backgroundPosition = backgroundPosition;
    this.iconElement.style.backgroundSize = backgroundSize;
  }

  private updateBackgroundFromResolvedFrame(
    params: ResolvedFrameBackgroundParams,
  ): void {
    const renderKey = getResolvedFrameRenderKey(params);
    this.pendingResolvedFrameRenderKey = renderKey;

    const isolatedFrameCacheKey = getIsolatedFrameCacheKey(
      params.imageUrl,
      params.frame,
    );
    const cachedIsolatedFrameDataUrl = isolatedFrameDataUrlCache.get(
      isolatedFrameCacheKey,
    );

    if (cachedIsolatedFrameDataUrl) {
      const { backgroundPosition, backgroundSize } =
        getIsolatedFrameBackgroundPosition(params);
      this.applyBackgroundStyle(
        cachedIsolatedFrameDataUrl,
        backgroundPosition,
        backgroundSize,
      );
      return;
    }

    const { backgroundPosition, backgroundSize } = getBackgroundPosition(params);
    this.applyBackgroundStyle(
      params.imageUrl,
      backgroundPosition,
      backgroundSize,
    );

    void loadSpriteImage(params.imageUrl).then((image) => {
      if (!image) {
        return;
      }

      let isolatedFrameDataUrl = isolatedFrameDataUrlCache.get(
        isolatedFrameCacheKey,
      );
      if (!isolatedFrameDataUrl) {
        const createdIsolatedFrameDataUrl = createIsolatedFrameDataUrl(
          image,
          params.frame,
        );
        if (!createdIsolatedFrameDataUrl) {
          return;
        }

        isolatedFrameDataUrl = createdIsolatedFrameDataUrl;
        isolatedFrameDataUrlCache.set(
          isolatedFrameCacheKey,
          createdIsolatedFrameDataUrl,
        );
      }

      if (this.pendingResolvedFrameRenderKey !== renderKey) {
        return;
      }

      const isolatedBackgroundStyles =
        getIsolatedFrameBackgroundPosition(params);
      this.applyBackgroundStyle(
        isolatedFrameDataUrl,
        isolatedBackgroundStyles.backgroundPosition,
        isolatedBackgroundStyles.backgroundSize,
      );
    });
  }

  private updateLegacyBackground(
    containerSize: number,
    spriteSize: number,
  ): void {
    this.iconElement.style.backgroundImage = `url("${LEGACY_MENU_SPRITE_URL}")`;
    this.iconElement.style.backgroundPosition = getLegacyBackgroundPosition(
      this.itemType,
      containerSize,
      spriteSize,
    );
    this.iconElement.style.backgroundSize = `${spriteSize * LEGACY_MENU_SPRITE_SLOT_COUNT}px ${spriteSize}px`;
  }

  public updateSize(availableWidth?: number): void {
    const size = getResponsiveMenuItemSize(
      availableWidth ?? document.body.clientWidth,
    );
    const menuSpriteBaseSize =
      size + (MENU_SPRITE_SIZE_DELTA[this.itemType] ?? 0);
    const menuSpriteScale = MENU_ICON_SCALE[this.itemType] ?? 1;
    const menuSpriteSize = Math.round(menuSpriteBaseSize * menuSpriteScale);
    const fineTuneX = MENU_SPRITE_FINE_TUNE_X[this.itemType] ?? 0;

    this.element.style.width = `${size}px`;
    this.element.style.height = `${size}px`;
    this.iconElement.style.width = `${size}px`;
    this.iconElement.style.height = `${size}px`;

    if (
      this.itemType === GameMenuItemType.Feed &&
      this.feedPreviewTextureName
    ) {
      const gameMenuSheet = gameMenuSheetMetadata;
      const gameMenuFeedFrame =
        gameMenuSheet?.frames[this.feedPreviewTextureName];
      if (gameMenuFeedFrame && gameMenuSheet) {
        this.updateBackgroundFromResolvedFrame({
          frame: gameMenuFeedFrame,
          sheetSize: gameMenuSheet.size,
          imageUrl: GAME_MENU_SPRITE_URL,
          containerSize: size,
          targetSpriteSize: size,
        });
        return;
      }
    }

    const menuIconName = MENU_ICON_NAME_BY_TYPE[this.itemType];
    if (menuIconName && gameMenuSheetMetadata?.frames[menuIconName]) {
      this.updateBackgroundFromResolvedFrame({
        frame: gameMenuSheetMetadata.frames[menuIconName],
        sheetSize: gameMenuSheetMetadata.size,
        imageUrl: GAME_MENU_SPRITE_URL,
        containerSize: size,
        targetSpriteSize: menuSpriteSize,
        fineTuneX,
      });
      return;
    }

    this.updateLegacyBackground(size, menuSpriteSize);
  }

  public destroy(): void {
    // 메모리 해제 작업 (이벤트 리스너가 있다면 제거)
  }
}

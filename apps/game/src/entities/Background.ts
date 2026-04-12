import * as PIXI from "pixi.js";
import { TimeOfDay, type SkyVisualState } from "../scenes/MainScene/timeOfDay";

type BackgroundLayerVisibility = {
  backgroundSprite?: boolean;
  baseTone?: boolean;
};

type BackgroundOptions = {
  zIndex?: number;
  visibility?: BackgroundLayerVisibility;
};

export class Background extends PIXI.Container {
  private _bgSprite: PIXI.Sprite;
  private _baseToneGraphics: PIXI.Graphics;
  private _width = 0;
  private _height = 0;
  private _skyState: SkyVisualState = {
    timeOfDay: TimeOfDay.Day,
    progress: 1,
  };
  private _visibility: Required<BackgroundLayerVisibility>;

  constructor(texture: PIXI.Texture, options: BackgroundOptions = {}) {
    super();
    this.sortableChildren = true;
    this.zIndex = options.zIndex ?? -1;

    this._visibility = {
      backgroundSprite: options.visibility?.backgroundSprite ?? true,
      baseTone: options.visibility?.baseTone ?? true,
    };

    this._bgSprite = new PIXI.Sprite(texture);
    this._bgSprite.anchor.set(0.5);
    this._bgSprite.zIndex = 0;
    this.addChild(this._bgSprite);

    this._baseToneGraphics = new PIXI.Graphics();
    this._baseToneGraphics.zIndex = 1;
    this.addChild(this._baseToneGraphics);
  }

  public resize(width: number, height: number): void {
    this._width = width;
    this._height = height;

    this.position.set(width / 2, height / 2);

    const scaleX = width / this._bgSprite.texture.width;
    const scaleY = height / this._bgSprite.texture.height;
    this._bgSprite.scale.set(Math.max(scaleX, scaleY));

    this._redrawSky();
  }

  public applySkyState(skyState: SkyVisualState): void {
    this._skyState = {
      timeOfDay: skyState.timeOfDay,
      progress: Math.max(0, Math.min(1, skyState.progress)),
    };
    this._redrawSky();
  }

  public animate(currentTime: number): void {
    void currentTime;
  }

  private _redrawSky(): void {
    this._baseToneGraphics.clear();

    if (this._width <= 0 || this._height <= 0) {
      return;
    }

    const visualConfig = this._getVisualConfig();
    const left = -this._width / 2;
    const top = -this._height / 2;

    this._bgSprite.visible = this._visibility.backgroundSprite;
    this._baseToneGraphics.visible = this._visibility.baseTone;

    if (this._visibility.baseTone && visualConfig.baseAlpha > 0) {
      this._baseToneGraphics.beginFill(
        visualConfig.baseColor,
        visualConfig.baseAlpha,
      );
      this._baseToneGraphics.drawRect(left, top, this._width, this._height);
      this._baseToneGraphics.endFill();
    }
  }

  private _getVisualConfig(): {
    baseColor: number;
    baseAlpha: number;
  } {
    const progress = this._easeInOut(this._skyState.progress);

    switch (this._skyState.timeOfDay) {
      case TimeOfDay.Sunrise: {
        const warmBand = Math.sin(Math.PI * progress);
        return {
          baseColor: 0x16274e,
          baseAlpha: this._lerp(0.48, 0.05, progress),
        };
      }
      case TimeOfDay.Sunset: {
        const warmBand = Math.sin(Math.PI * progress);
        return {
          baseColor: 0x132345,
          baseAlpha: this._lerp(0.04, 0.58, progress),
        };
      }
      case TimeOfDay.Night:
        return {
          baseColor: 0x0b1733,
          baseAlpha: 0.58,
        };
      case TimeOfDay.Day:
      default:
        return {
          baseColor: 0xffffff,
          baseAlpha: 0,
        };
    }
  }

  private _lerp(from: number, to: number, progress: number): number {
    return from + (to - from) * progress;
  }

  private _easeInOut(progress: number): number {
    return progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;
  }

  private _interpolateColor(
    fromColor: number,
    toColor: number,
    progress: number,
  ): number {
    const fromRed = (fromColor >> 16) & 0xff;
    const fromGreen = (fromColor >> 8) & 0xff;
    const fromBlue = fromColor & 0xff;

    const toRed = (toColor >> 16) & 0xff;
    const toGreen = (toColor >> 8) & 0xff;
    const toBlue = toColor & 0xff;

    const red = Math.round(this._lerp(fromRed, toRed, progress));
    const green = Math.round(this._lerp(fromGreen, toGreen, progress));
    const blue = Math.round(this._lerp(fromBlue, toBlue, progress));

    return (red << 16) + (green << 8) + blue;
  }
}

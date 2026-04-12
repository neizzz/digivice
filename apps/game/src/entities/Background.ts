import * as PIXI from "pixi.js";
import { TimeOfDay, type SkyVisualState } from "../scenes/MainScene/timeOfDay";

export class Background extends PIXI.Container {
  private _bgSprite: PIXI.Sprite;
  private _baseToneGraphics: PIXI.Graphics;
  private _skyTintGraphics: PIXI.Graphics;
  private _sunGlowGraphics: PIXI.Graphics;
  private _sunDiscGraphics: PIXI.Graphics;
  private _width = 0;
  private _height = 0;
  private _skyState: SkyVisualState = {
    timeOfDay: TimeOfDay.Day,
    progress: 1,
  };

  constructor(texture: PIXI.Texture) {
    super();
    this.sortableChildren = true;

    // 배경 스프라이트 생성
    this._bgSprite = new PIXI.Sprite(texture);
    this._bgSprite.anchor.set(0.5); // 중앙 기준점으로 설정
    this._bgSprite.zIndex = 0;
    this.zIndex = -1; // 컨테이너 자체도 배경 뒤에 위치시킴
    this.addChild(this._bgSprite);

    this._baseToneGraphics = new PIXI.Graphics();
    this._baseToneGraphics.zIndex = 1;
    this.addChild(this._baseToneGraphics);

    this._skyTintGraphics = new PIXI.Graphics();
    this._skyTintGraphics.zIndex = 2;
    this.addChild(this._skyTintGraphics);

    this._sunGlowGraphics = new PIXI.Graphics();
    this._sunGlowGraphics.zIndex = 3;
    this.addChild(this._sunGlowGraphics);

    this._sunDiscGraphics = new PIXI.Graphics();
    this._sunDiscGraphics.zIndex = 4;
    this.addChild(this._sunDiscGraphics);
  }

  public resize(width: number, height: number): void {
    this._width = width;
    this._height = height;

    // 배경 위치를 화면 중앙으로 설정
    this.position.set(width / 2, height / 2);

    // 화면을 완전히 채우도록 비율 조정
    const scaleX = width / this._bgSprite.texture.width;
    const scaleY = height / this._bgSprite.texture.height;

    // 더 큰 스케일 값을 사용하여 화면을 완전히 커버
    const scale = Math.max(scaleX, scaleY);
    this._bgSprite.scale.set(scale);

    this._redrawSky();
  }

  public applySkyState(skyState: SkyVisualState): void {
    this._skyState = {
      timeOfDay: skyState.timeOfDay,
      progress: Math.max(0, Math.min(1, skyState.progress)),
    };
    this._redrawSky();
  }

  private _redrawSky(): void {
    this._baseToneGraphics.clear();
    this._skyTintGraphics.clear();
    this._sunGlowGraphics.clear();
    this._sunDiscGraphics.clear();

    if (this._width <= 0 || this._height <= 0) {
      return;
    }

    const visualConfig = this._getVisualConfig();
    const left = -this._width / 2;
    const top = -this._height / 2;

    if (visualConfig.baseAlpha > 0) {
      this._baseToneGraphics.beginFill(
        visualConfig.baseColor,
        visualConfig.baseAlpha,
      );
      this._baseToneGraphics.drawRect(left, top, this._width, this._height);
      this._baseToneGraphics.endFill();
    }

    this._drawDirectionalTintBands(
      visualConfig.skyTintColor,
      visualConfig.skyTintAlpha,
    );
    this._drawSunGlow(visualConfig.sunGlowColor, visualConfig.sunGlowAlpha);
    this._drawSunDisc(visualConfig.sunDiscColor, visualConfig.sunDiscAlpha);
  }

  private _drawDirectionalTintBands(color: number, alpha: number): void {
    if (alpha <= 0) {
      return;
    }

    const bandCount = 16;
    const bandWidth = this._width / bandCount;
    const top = -this._height / 2;

    for (let index = 0; index < bandCount; index += 1) {
      const distanceRatio = 1 - index / bandCount;
      const bandAlpha = alpha * Math.pow(distanceRatio, 1.6);
      if (bandAlpha <= 0.001) {
        continue;
      }

      this._skyTintGraphics.beginFill(color, bandAlpha);
      this._skyTintGraphics.drawRect(
        this._width / 2 - bandWidth * (index + 1),
        top,
        bandWidth,
        this._height,
      );
      this._skyTintGraphics.endFill();
    }
  }

  private _drawSunGlow(color: number, alpha: number): void {
    if (alpha <= 0) {
      return;
    }

    const centerX = this._width * 0.28;
    const centerY = -this._height * 0.2;
    const radii = [this._width * 0.38, this._width * 0.26, this._width * 0.16];

    radii.forEach((radius, index) => {
      const layerAlpha = alpha * (0.42 - index * 0.11);
      if (layerAlpha <= 0.001) {
        return;
      }

      this._sunGlowGraphics.beginFill(color, layerAlpha);
      this._sunGlowGraphics.drawCircle(centerX, centerY, radius);
      this._sunGlowGraphics.endFill();
    });
  }

  private _drawSunDisc(color: number, alpha: number): void {
    if (alpha <= 0) {
      return;
    }

    const centerX = this._width * 0.3;
    const centerY = -this._height * 0.18;
    const radius = Math.max(22, Math.min(this._width, this._height) * 0.06);

    this._sunDiscGraphics.beginFill(color, alpha);
    this._sunDiscGraphics.drawCircle(centerX, centerY, radius);
    this._sunDiscGraphics.endFill();
  }

  private _getVisualConfig(): {
    baseColor: number;
    baseAlpha: number;
    skyTintColor: number;
    skyTintAlpha: number;
    sunGlowColor: number;
    sunGlowAlpha: number;
    sunDiscColor: number;
    sunDiscAlpha: number;
  } {
    const progress = this._easeInOut(this._skyState.progress);

    switch (this._skyState.timeOfDay) {
      case TimeOfDay.Sunrise: {
        const warmBand = Math.sin(Math.PI * progress);
        return {
          baseColor: 0x142347,
          baseAlpha: this._lerp(0.5, 0.04, progress),
          skyTintColor: this._interpolateColor(0x6a4f7d, 0xffb067, progress),
          skyTintAlpha: this._lerp(0.12, 0.34, warmBand),
          sunGlowColor: this._interpolateColor(0xff9645, 0xfff1b8, progress),
          sunGlowAlpha: this._lerp(0.12, 0.58, progress),
          sunDiscColor: this._interpolateColor(0xffa45a, 0xfff0b0, progress),
          sunDiscAlpha: this._lerp(0.04, 0.5, progress),
        };
      }
      case TimeOfDay.Sunset: {
        const warmBand = Math.sin(Math.PI * progress);
        return {
          baseColor: 0x102144,
          baseAlpha: this._lerp(0.03, 0.62, progress),
          skyTintColor: this._interpolateColor(0xffc27a, 0x7d4b78, progress),
          skyTintAlpha: this._lerp(0.18, 0.4, warmBand),
          sunGlowColor: this._interpolateColor(0xffd98c, 0xc86e5a, progress),
          sunGlowAlpha: this._lerp(0.38, 0.08, progress),
          sunDiscColor: this._interpolateColor(0xffe3a3, 0xff8a55, progress),
          sunDiscAlpha: this._lerp(0.42, 0.06, progress),
        };
      }
      case TimeOfDay.Night:
        return {
          baseColor: 0x0b1733,
          baseAlpha: 0.58,
          skyTintColor: 0x24375d,
          skyTintAlpha: 0.16,
          sunGlowColor: 0x425889,
          sunGlowAlpha: 0.02,
          sunDiscColor: 0xaec4ff,
          sunDiscAlpha: 0,
        };
      case TimeOfDay.Day:
      default:
        return {
          baseColor: 0xffffff,
          baseAlpha: 0,
          skyTintColor: 0xfff0c2,
          skyTintAlpha: 0.02,
          sunGlowColor: 0xfff4cf,
          sunGlowAlpha: 0.12,
          sunDiscColor: 0xfff6d6,
          sunDiscAlpha: 0.08,
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

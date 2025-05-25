// 캐릭터의 상태(Status)와 감정(Emotion) 관리를 담당하는 매니저 클래스
import type { Character } from "../entities/Character";
import { AssetLoader } from "../utils/AssetLoader";
import * as PIXI from "pixi.js";

export type StatusType = "sick" | "urgent" | null;
export type EmotionType = "discover" | "happy" | "unhappy" | null;

const STATUS_PRIORITY: StatusType[] = ["sick", "urgent"];

export class CharacterStatusViewManager {
  private character: Character;
  private currentStatuses: StatusType[] = [];
  private currentEmotion: EmotionType = null;
  private statusIconSprites: PIXI.Sprite[] = [];
  private emotionIconSprite?: PIXI.Sprite;
  private emotionTimeout?: number;

  constructor(character: Character) {
    this.character = character;
  }

  /**
   * 상태(Status) 아이콘을 추가합니다. (중복 없이, 우선순위 고정)
   */
  addStatus(status: StatusType) {
    if (!status) return;
    if (this.currentStatuses.includes(status)) return;
    this.currentStatuses.push(status);
    this._refreshStatusIcons();
  }

  /**
   * 상태(Status) 아이콘을 제거합니다. (status 없으면 전체 제거)
   */
  removeStatus(status?: StatusType) {
    if (status) {
      const idx = this.currentStatuses.indexOf(status);
      if (idx !== -1) {
        this.currentStatuses.splice(idx, 1);
      }
    } else {
      this.currentStatuses = [];
    }
    this._refreshStatusIcons();
  }

  /**
   * 상태 아이콘들을 우선순위에 따라 중앙정렬로 다시 그림
   */
  private _refreshStatusIcons() {
    // 기존 스프라이트 제거
    for (const sprite of this.statusIconSprites) {
      this.character.removeChild(sprite);
      sprite.destroy();
    }
    this.statusIconSprites = [];
    if (this.currentStatuses.length === 0) return;
    const assets = AssetLoader.getAssets();
    const commonSheet = assets.common16x16Sprites;
    // 우선순위에 따라 정렬
    const sortedStatuses = STATUS_PRIORITY.filter((s) =>
      this.currentStatuses.includes(s)
    );
    const iconCount = sortedStatuses.length;
    const scale = 1.4;
    const gap = 4;
    const iconWidth = 16 * scale;
    const totalWidth = iconCount * iconWidth + (iconCount - 1) * gap;
    // layouting
    for (let i = 0; i < iconCount; i++) {
      const status = sortedStatuses[i];
      if (!status) continue;
      if (commonSheet?.textures[status]) {
        const sprite = new PIXI.Sprite(commonSheet.textures[status]);
        sprite.anchor.set(0.5, 1);
        sprite.scale.set(scale);
        sprite.x = -totalWidth / 2 + iconWidth / 2 + i * (iconWidth + gap);
        sprite.y = -this.character.height / 3 + 4;
        this.statusIconSprites.push(sprite);
        this.character.addChild(sprite);
      }
    }
  }

  /**
   * 감정(Emotion) 아이콘을 2초간 표시합니다. (캐릭터 우측 상단)
   */
  setEmotion(emotion: EmotionType) {
    if (!emotion) return;
    // 기존 감정 아이콘과 타임아웃 즉시 제거
    if (this.emotionIconSprite) {
      this.character.removeChild(this.emotionIconSprite);
      this.emotionIconSprite.destroy();
      this.emotionIconSprite = undefined;
    }
    if (this.emotionTimeout) {
      clearTimeout(this.emotionTimeout);
      this.emotionTimeout = undefined;
    }
    this.currentEmotion = emotion;
    // 감정 아이콘 생성
    const assets = AssetLoader.getAssets();
    const commonSheet = assets.common16x16Sprites;
    if (commonSheet?.textures[emotion]) {
      const sprite = new PIXI.Sprite(commonSheet.textures[emotion]);
      sprite.anchor.set(0.5, 0.5);
      sprite.scale.set(1.6);
      // 캐릭터 우측 상단에 위치
      sprite.x = this.character.width / 4 + 6;
      sprite.y = -this.character.height / 6 - 6;
      this.emotionIconSprite = sprite;
      this.character.addChild(sprite);
    }
    // 2초 후 자동 해제
    this.emotionTimeout = window.setTimeout(() => {
      if (this.emotionIconSprite) {
        this.character.removeChild(this.emotionIconSprite);
        this.emotionIconSprite.destroy();
        this.emotionIconSprite = undefined;
      }
      this.currentEmotion = null;
    }, 2000);
  }
}

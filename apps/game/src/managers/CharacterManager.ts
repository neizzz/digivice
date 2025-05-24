import type { CharacterStatusData, GameData } from "../types/GameData";
import type { Game } from "../Game";
import { Character } from "../entities/Character";
import { Egg } from "../entities/Egg";
import { type CharacterKey, CharacterState } from "../types/Character";
import { EventBus, EventTypes } from "../utils/EventBus";
import type { Scene } from "src/interfaces/Scene";

/**
 * 게임 내 캐릭터를 관리하는 매니저 클래스
 */
export class CharacterManager {
  private static instance: CharacterManager;
  private game: Game;
  private character?: Character;
  private egg?: Egg;

  constructor(game: Game) {
    this.game = game;
  }

  /**
   * 싱글톤 인스턴스 반환
   */
  public static getInstance(): CharacterManager {
    if (!CharacterManager.instance) {
      throw new Error("CharacterManager는 초기화되지 않았습니다.");
    }
    return CharacterManager.instance;
  }

  public async hatch(
    characterInfo: GameData["character"],
    scene: Scene
  ): Promise<Character> {
    if (!this.egg) {
      throw new Error(
        "[CharacterManager] CharacterManager에 Egg가 설정되지 않았습니다."
      );
    }
    const character = new Character({
      characterKey: characterInfo.key as CharacterKey,
      app: this.game.app,
      status: characterInfo.status,
    });
    await character.initialize(characterInfo, scene);
    this.setEntity(character);

    EventBus.publish(EventTypes.Character.CHARACTER_EVOLUTION, {
      fromCharacterKey: "egg",
      toCharacterKey: characterInfo.key as CharacterKey,
    });

    return character;
  }

  public setEntity(entity: Character | Egg): void {
    if (entity instanceof Egg) {
      this._setEgg(entity);
    } else {
      this._setCharacter(entity);
    }
  }
  private _setCharacter(character: Character): void {
    this.character = character;
    this.egg = undefined; // Character가 설정되면 Egg는 제거
  }
  private _setEgg(egg: Egg): void {
    this.egg = egg;
    this.character = undefined; // Egg가 설정되면 Character는 제거
  }

  /**
   * 현재 캐릭터 반환
   */
  public getCharacter(): Character | undefined {
    return this.character;
  }

  /**
   * 현재 Egg 반환
   */
  public getEgg(): Egg | undefined {
    return this.egg;
  }

  /**
   * 현재 엔티티가 Character인지 확인
   */
  public hasCharacter(): boolean {
    return this.character !== undefined;
  }

  /**
   * 현재 엔티티가 Egg인지 확인
   */
  public hasEgg(): boolean {
    return this.egg !== undefined;
  }

  /**
   * 두 캐릭터 상태를 비교하여 이벤트 발행 및 상태 반영
   * @param before 이전 캐릭터 상태
   * @param after 현재 캐릭터 상태
   */
  public updateCharacter(params: {
    before: GameData["character"];
    after: GameData["character"];
  }): void {
    const { before, after } = params;
    const character = this.character as Character;

    if (before.key !== after.key) {
      console.log(
        `[CharacterManager] 캐릭터 변경/진화: ${before.key} -> ${after.key}`
      );

      EventBus.publish(EventTypes.Character.CHARACTER_EVOLUTION, {
        fromCharacterKey: before.key as CharacterKey,
        toCharacterKey: after.key as CharacterKey,
      });

      character.setCharacterKey(after.key as CharacterKey);
      character.reflectCharacterStatus(after.status);
    }

    const beforeStatus = before.status;
    const afterStatus = after.status;
    const changedStatus: Partial<CharacterStatusData> = {};

    // 상태(idle, walking 등) 비교
    if (beforeStatus.state !== afterStatus.state) {
      console.log(
        `[CharacterManager] 상태 변경: ${beforeStatus.state} -> ${afterStatus.state}`
      );
      changedStatus.state = afterStatus.state;
      character.setState(afterStatus.state);
    }
    // 스태미나 비교
    if (beforeStatus.stamina !== afterStatus.stamina) {
      console.log(
        `[CharacterManager] 스태미나 변경: ${beforeStatus.stamina} -> ${afterStatus.stamina}`
      );
      changedStatus.stamina = afterStatus.stamina;
      // TODO: after가 max가 되면 기쁜 감정
      // TODO: after가 0이 되면 위험 상태
    }
    // 질병 상태 비교
    if (beforeStatus.sickness !== afterStatus.sickness) {
      console.log(
        `[CharacterManager] 질병 상태 변경: ${beforeStatus.sickness} -> ${afterStatus.sickness}`
      );
      changedStatus.sickness = afterStatus.sickness;
      // TODO: 질병 상태 표시
    }
    // 진화 게이지 비교
    if (beforeStatus.evolutionGauge !== afterStatus.evolutionGauge) {
      console.log(
        `[CharacterManager] 진화 게이지 변경: ${beforeStatus.evolutionGauge} -> ${afterStatus.evolutionGauge}`
      );
      changedStatus.evolutionGauge = afterStatus.evolutionGauge;
    }
    // 스태미나 0 시간 비교
    if (beforeStatus.timeOfZeroStamina !== afterStatus.timeOfZeroStamina) {
      console.log(
        `[CharacterManager] 스태미나 0 시간 변경: ${beforeStatus.timeOfZeroStamina} -> ${afterStatus.timeOfZeroStamina}`
      );
      changedStatus.timeOfZeroStamina = afterStatus.timeOfZeroStamina;
    }

    if (Object.keys(changedStatus).length > 0) {
      EventBus.publish(EventTypes.Character.CHARACTER_STATUS_UPDATED, {
        status: changedStatus,
      });
    }

    this.character?.updateTransform();
  }
}

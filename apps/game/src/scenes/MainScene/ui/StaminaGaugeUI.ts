import { MainSceneWorld } from "../world";
import { defineQuery, hasComponent } from "bitecs";
import {
  ObjectComp,
  CharacterStatusComp,
  DigestiveSystemComp,
} from "../raw-components";
import { ObjectType } from "../types";

const characterQuery = defineQuery([ObjectComp, CharacterStatusComp]);

export class StaminaGaugeUI {
  private _container: HTMLDivElement;
  private _world: MainSceneWorld;
  private _staminaText!: HTMLSpanElement;
  private _evolutionText!: HTMLSpanElement;
  private _digestiveText!: HTMLSpanElement;
  private _currentCharacterEid: number = -1;

  constructor(world: MainSceneWorld, parentElement: HTMLElement) {
    this._world = world;
    this._container = this._createContainer();
    this._setupUI();
    this._findFirstCharacter();

    parentElement.appendChild(this._container);
  }

  private _createContainer(): HTMLDivElement {
    const container = document.createElement("div");
    container.style.cssText = `
      position: fixed;
      top: 4px;
      left: 100px;
      background: rgba(0, 0, 0, 0.4);
      border-radius: 5px;
      padding: 10px;
      z-index: 998;
      font-family: 'Arial', sans-serif;
      color: white;
      font-size: 12px;
      min-width: 120px;
    `;

    // blink 애니메이션을 위한 스타일 추가 (이미 있으면 중복 추가되지 않도록)
    if (!document.querySelector("#stamina-gauge-blink-style")) {
      const style = document.createElement("style");
      style.id = "stamina-gauge-blink-style";
      style.textContent = `
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0.3; }
        }
      `;
      document.head.appendChild(style);
    }

    return container;
  }

  private _setupUI(): void {
    // 스테미나 표시
    const staminaDiv = document.createElement("div");

    const staminaLabel = document.createElement("span");
    staminaLabel.textContent = "Stamina: ";
    staminaLabel.style.cssText = `
      color: #66ccff;
    `;

    this._staminaText = document.createElement("span");
    this._staminaText.style.cssText = `
      color: white;
      font-weight: bold;
    `;

    staminaDiv.appendChild(staminaLabel);
    staminaDiv.appendChild(this._staminaText);

    // 진화 게이지 표시
    const evolutionDiv = document.createElement("div");

    const evolutionLabel = document.createElement("span");
    evolutionLabel.textContent = "Evolution: ";
    evolutionLabel.style.cssText = `
      color: #ffcc66;
    `;

    this._evolutionText = document.createElement("span");
    this._evolutionText.style.cssText = `
      color: white;
      font-weight: bold;
    `;

    evolutionDiv.appendChild(evolutionLabel);
    evolutionDiv.appendChild(this._evolutionText);

    // 소화기관 표시
    const digestiveDiv = document.createElement("div");

    const digestiveLabel = document.createElement("span");
    digestiveLabel.textContent = "Digestive: ";
    digestiveLabel.style.cssText = `
      color: #66ff66;
    `;

    this._digestiveText = document.createElement("span");
    this._digestiveText.style.cssText = `
      color: white;
      font-weight: bold;
    `;

    digestiveDiv.appendChild(digestiveLabel);
    digestiveDiv.appendChild(this._digestiveText);

    this._container.appendChild(staminaDiv);
    this._container.appendChild(evolutionDiv);
    this._container.appendChild(digestiveDiv);
  }

  private _findFirstCharacter(): void {
    const characters = characterQuery(this._world);

    for (let i = 0; i < characters.length; i++) {
      const eid = characters[i];
      if (ObjectComp.type[eid] === ObjectType.CHARACTER) {
        this._currentCharacterEid = eid;
        console.log(`[StaminaGaugeUI] Found character entity: ${eid}`);
        return;
      }
    }

    console.warn("[StaminaGaugeUI] No character entity found");
    this._currentCharacterEid = -1;
  }

  public update(): void {
    if (this._currentCharacterEid < 0) {
      this._findFirstCharacter();
      if (this._currentCharacterEid < 0) {
        this._staminaText.textContent = "N/A";
        this._evolutionText.textContent = "N/A";
        this._digestiveText.textContent = "N/A";
        return;
      }
    }

    const stamina = CharacterStatusComp.stamina[this._currentCharacterEid] || 0;
    const evolutionGauge =
      CharacterStatusComp.evolutionGage[this._currentCharacterEid] || 0;

    // 소화기관 정보
    let digestiveText = "N/A";
    if (
      hasComponent(this._world, DigestiveSystemComp, this._currentCharacterEid)
    ) {
      const currentLoad =
        DigestiveSystemComp.currentLoad[this._currentCharacterEid];
      const capacity = DigestiveSystemComp.capacity[this._currentCharacterEid];
      const nextPoopTime =
        DigestiveSystemComp.nextPoopTime[this._currentCharacterEid] || 0;

      digestiveText = `${currentLoad.toFixed(1)}/${capacity}`;

      // poob 생성 카운트다운 추가
      if (nextPoopTime > 0) {
        const currentTime = Date.now();
        const remainingTime = Math.max(0, nextPoopTime - currentTime);
        const seconds = Math.ceil(remainingTime / 1000);

        if (remainingTime > 0) {
          digestiveText += ` (💩${seconds}s)`;
        } else {
          digestiveText += ` (💩NOW!)`;
        }
      }
    }

    // 간단한 숫자 표시
    this._staminaText.textContent = `${stamina}/10`;
    this._evolutionText.textContent = `${evolutionGauge.toFixed(1)}/100.0`;
    this._digestiveText.textContent = digestiveText;

    // poob 생성 임박 시 색상 변경
    if (
      hasComponent(this._world, DigestiveSystemComp, this._currentCharacterEid)
    ) {
      const nextPoopTime =
        DigestiveSystemComp.nextPoopTime[this._currentCharacterEid] || 0;

      if (nextPoopTime > 0) {
        const currentTime = Date.now();
        const remainingTime = Math.max(0, nextPoopTime - currentTime);

        if (remainingTime <= 0) {
          // 생성 시점이 되면 빨간색으로 깜빡임
          this._digestiveText.style.color = "#ff0000";
          this._digestiveText.style.animation = "blink 1s infinite";
        } else if (remainingTime <= 3000) {
          // 3초 이하 남으면 주황색
          this._digestiveText.style.color = "#ff8800";
          this._digestiveText.style.animation = "none";
        } else {
          // 평상시 흰색
          this._digestiveText.style.color = "white";
          this._digestiveText.style.animation = "none";
        }
      } else {
        // poob 생성 타이머가 없으면 평상시 색상
        this._digestiveText.style.color = "white";
        this._digestiveText.style.animation = "none";
      }
    }
  }

  public show(): void {
    this._container.style.display = "block";
  }

  public hide(): void {
    this._container.style.display = "none";
  }

  public destroy(): void {
    if (this._container.parentElement) {
      this._container.parentElement.removeChild(this._container);
    }
  }
}

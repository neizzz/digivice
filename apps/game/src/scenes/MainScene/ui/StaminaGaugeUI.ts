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
      digestiveText = `${currentLoad.toFixed(1)}/${capacity}`;
    }

    // 간단한 숫자 표시
    this._staminaText.textContent = `${stamina}/10`;
    this._evolutionText.textContent = `${evolutionGauge.toFixed(1)}/100.0`;
    this._digestiveText.textContent = digestiveText;
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

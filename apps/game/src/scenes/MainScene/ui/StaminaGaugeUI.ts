import { MainSceneWorld } from "../world";
import { defineQuery } from "bitecs";
import { ObjectComp, CharacterStatusComp } from "../raw-components";
import { ObjectType } from "../types";

const characterQuery = defineQuery([ObjectComp, CharacterStatusComp]);

export class StaminaGaugeUI {
  private _container: HTMLDivElement;
  private _world: MainSceneWorld;
  private _staminaText!: HTMLSpanElement;
  private _evolutionText!: HTMLSpanElement;
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
      top: 45px;
      left: 10px;
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
    staminaDiv.style.cssText = `
      margin-bottom: 8px;
    `;

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

    this._container.appendChild(staminaDiv);
    this._container.appendChild(evolutionDiv);
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
        return;
      }
    }

    const stamina = CharacterStatusComp.stamina[this._currentCharacterEid] || 0;
    const evolutionGauge =
      CharacterStatusComp.evolutionGage[this._currentCharacterEid] || 0;

    // 간단한 숫자 표시
    this._staminaText.textContent = `${stamina}/10`;
    this._evolutionText.textContent = `${evolutionGauge.toFixed(1)}/100.0`;
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

import { CharacterStatus } from "../types";
import {
  addCharacterStatus,
  removeCharacterStatus,
} from "..//systems/CharacterManageSystem";
import { MainSceneWorld } from "..//world";
import { defineQuery } from "bitecs";
import { ObjectComp, CharacterStatusComp } from "../raw-components";
import { ObjectType } from "../types";

const characterQuery = defineQuery([ObjectComp, CharacterStatusComp]);
const objectQuery = defineQuery([ObjectComp]); // ObjectComp만 가진 엔티티들도 찾기

function hasCharacterStatus(eid: number, status: CharacterStatus): boolean {
  const currentStatuses = CharacterStatusComp.statuses[eid];
  if (!currentStatuses) {
    console.warn(
      `[HTMLDebugStatusUI] Entity ${eid} has no CharacterStatusComp`
    );
    return false;
  }
  return currentStatuses.includes(status);
}

export class HTMLDebugStatusUI {
  private _container: HTMLDivElement;
  private _world: MainSceneWorld;
  private _buttons: Map<CharacterStatus, HTMLButtonElement> = new Map();
  private _indicators: Map<CharacterStatus, HTMLSpanElement> = new Map();
  private _isVisible: boolean = false;
  private _currentCharacterEid: number = -1; // -1을 "캐릭터 없음"으로 사용
  private _charIdElement: HTMLParagraphElement;

  constructor(world: MainSceneWorld, parentElement: HTMLElement) {
    this._world = world;
    this._container = this._createContainer();
    this._charIdElement = document.createElement("p"); // 캐릭터 ID 요소 미리 생성
    this._setupUI();
    this._findFirstCharacter();

    parentElement.appendChild(this._container);
  }

  private _findFirstCharacter(): void {
    // 먼저 완전한 캐릭터 엔티티 찾기 (ObjectComp + CharacterStatusComp)
    const fullCharacterEntities = characterQuery(this._world);
    console.log(
      `[HTMLDebugStatusUI] Found ${fullCharacterEntities.length} complete character entities`
    );

    for (let i = 0; i < fullCharacterEntities.length; i++) {
      const eid = fullCharacterEntities[i];
      const objectType = ObjectComp.type[eid];
      console.log(
        `[HTMLDebugStatusUI] Complete character entity ${eid}: type=${objectType}`
      );

      if (objectType === ObjectType.CHARACTER) {
        this._currentCharacterEid = eid;
        console.log(
          `[HTMLDebugStatusUI] Found complete character entity: ${eid}`
        );
        return;
      }
    }

    // 완전한 캐릭터를 찾지 못했다면 ObjectComp만 가진 캐릭터 엔티티 찾기
    const objectEntities = objectQuery(this._world);
    console.log(
      `[HTMLDebugStatusUI] Found ${objectEntities.length} object entities`
    );

    for (let i = 0; i < objectEntities.length; i++) {
      const eid = objectEntities[i];
      const objectType = ObjectComp.type[eid];

      if (objectType === ObjectType.CHARACTER) {
        this._currentCharacterEid = eid;
        console.log(
          `[HTMLDebugStatusUI] Found basic character entity: ${eid} (missing CharacterStatusComp)`
        );

        // CharacterStatusComp가 없다면 경고 메시지 출력
        if (!CharacterStatusComp.statuses[eid]) {
          console.warn(
            `[HTMLDebugStatusUI] Character entity ${eid} is missing CharacterStatusComp`
          );
        }
        return;
      }
    }

    // 추가 디버깅: 모든 엔티티 검사
    console.group("[HTMLDebugStatusUI] All entities in world:");
    for (let eid = 0; eid < 100; eid++) {
      // 최대 100개 엔티티 검사
      try {
        if (ObjectComp.type[eid] !== undefined) {
          const objectType = ObjectComp.type[eid];
          const hasCharacterStatus =
            CharacterStatusComp.statuses[eid] !== undefined;
          console.log(
            `Entity ${eid}: type=${objectType}, hasCharacterStatus=${hasCharacterStatus}`
          );
        }
      } catch (e) {
        // 엔티티가 존재하지 않으면 무시
      }
    }
    console.groupEnd();

    console.warn(
      `[HTMLDebugStatusUI] No character entity found! Complete: ${fullCharacterEntities.length}, Objects: ${objectEntities.length}`
    );
    this._currentCharacterEid = -1;
  }

  private _updateCharacterIdDisplay(): void {
    if (this._currentCharacterEid >= 0) {
      // 0 이상이면 유효한 캐릭터
      const hasCharacterStatus =
        CharacterStatusComp.statuses[this._currentCharacterEid] !== undefined;
      const objectType = ObjectComp.type[this._currentCharacterEid];

      this._charIdElement.innerHTML = `
        Character ID: ${this._currentCharacterEid}<br>
        <small>Type: ${objectType}, Status: ${
        hasCharacterStatus ? "✓" : "✗"
      }</small>
      `;
      this._charIdElement.style.color = hasCharacterStatus
        ? "#90EE90"
        : "#FFD700"; // 연한 녹색 또는 골드
    } else {
      this._charIdElement.innerHTML = `
        No character found
      `;
      this._charIdElement.style.color = "#ff6666";
    }
  }

  private _setupUI(): void {
    // 캐릭터 ID 표시
    this._charIdElement.style.cssText = `
      margin: 0 0 15px 0;
      font-size: 12px;
      color: #ccc;
    `;
    this._updateCharacterIdDisplay();
    this._container.appendChild(this._charIdElement);

    // 스테미나 조절 버튼들
    const staminaButtonsDiv = document.createElement("div");
    // staminaButtonsDiv.style.cssText = `
    //   margin: 10px 0;
    //   text-align: center;
    // `;

    const staminaLabel = document.createElement("span");
    staminaLabel.textContent = "Stam: ";
    staminaLabel.style.cssText = `
      color: #66ccff;
      font-size: 12px;
      margin-right: 5px;
    `;

    const staminaMinusBtn = this._createAdjustButton("-1", () =>
      this._adjustStamina(-1)
    );
    const staminaPlusBtn = this._createAdjustButton("+1", () =>
      this._adjustStamina(1)
    );

    staminaButtonsDiv.appendChild(staminaLabel);
    staminaButtonsDiv.appendChild(staminaMinusBtn);
    staminaButtonsDiv.appendChild(staminaPlusBtn);
    this._container.appendChild(staminaButtonsDiv);

    // 진화 게이지 조절 버튼들
    const evolutionButtonsDiv = document.createElement("div");
    // evolutionButtonsDiv.style.cssText = `
    //   text-align: left;
    // `;

    const evolutionLabel = document.createElement("span");
    evolutionLabel.textContent = "Evo: ";
    evolutionLabel.style.cssText = `
      color: #ffcc66;
      font-size: 12px;
      margin-right: 5px;
    `;

    const evolutionPlus3Btn = this._createAdjustButton("+3", () =>
      this._adjustEvolutionGauge(3)
    );
    const evolutionPlus10Btn = this._createAdjustButton("+10", () =>
      this._adjustEvolutionGauge(10)
    );

    evolutionButtonsDiv.appendChild(evolutionLabel);
    evolutionButtonsDiv.appendChild(evolutionPlus3Btn);
    evolutionButtonsDiv.appendChild(evolutionPlus10Btn);
    this._container.appendChild(evolutionButtonsDiv);

    // 닫기 버튼
    const closeButton = this._createCloseButton();
    this._container.appendChild(closeButton);
  }

  private _createContainer(): HTMLDivElement {
    const container = document.createElement("div");
    container.style.cssText = `
      position: fixed;
      top: 0px;
      right: 0px;
      width: 150px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      padding: 8px;
      z-index: 1000;
      font-family: 'Arial', sans-serif;
      color: white;
      display: none;
    `;
    return container;
  }

  private _createCloseButton(): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = "×";
    button.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      width: 25px;
      height: 25px;
      background: rgba(100, 100, 100, 0.4);
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    button.addEventListener("click", () => {
      this.hide();
    });

    return button;
  }

  private _updateStatusIndicator(
    indicator: HTMLSpanElement,
    status: CharacterStatus
  ): void {
    const isActive =
      this._currentCharacterEid >= 0 && // 0 이상이면 유효한 캐릭터
      hasCharacterStatus(this._currentCharacterEid, status);

    if (isActive) {
      indicator.style.backgroundColor = "#00ff00"; // Green for ON
    } else {
      indicator.style.backgroundColor = "#ff0000"; // Red for OFF
    }
  }

  private _updateAllStatusIndicators(): void {
    this._indicators.forEach((indicator, status) => {
      this._updateStatusIndicator(indicator, status);
    });
  }

  private _toggleStatus(status: CharacterStatus): void {
    if (this._currentCharacterEid < 0) {
      // -1이면 캐릭터 없음
      console.warn("[HTMLDebugStatusUI] No character found");
      return;
    }

    // CharacterStatusComp가 있는지 확인
    if (!CharacterStatusComp.statuses[this._currentCharacterEid]) {
      console.error(
        `[HTMLDebugStatusUI] Character ${this._currentCharacterEid} has no CharacterStatusComp. Cannot toggle status.`
      );
      alert(
        `Character ${this._currentCharacterEid} is missing CharacterStatusComp.\nThis character was not created properly.`
      );
      return;
    }

    const hasStatus = hasCharacterStatus(this._currentCharacterEid, status);

    if (hasStatus) {
      removeCharacterStatus(this._currentCharacterEid, status);
      console.log(
        `[HTMLDebugStatusUI] Removed status ${status} from character ${this._currentCharacterEid}`
      );
    } else {
      addCharacterStatus(this._currentCharacterEid, status);
      console.log(
        `[HTMLDebugStatusUI] Added status ${status} to character ${this._currentCharacterEid}`
      );
    }
  }

  private _clearAllStatuses(): void {
    if (this._currentCharacterEid < 0) {
      // -1이면 캐릭터 없음
      console.warn("[HTMLDebugStatusUI] No character found");
      return;
    }

    const statuses = [
      CharacterStatus.SICK,
      CharacterStatus.UNHAPPY,
      CharacterStatus.URGENT,
      CharacterStatus.HAPPY,
      CharacterStatus.DISCOVER,
    ];

    statuses.forEach((status) => {
      if (hasCharacterStatus(this._currentCharacterEid, status)) {
        removeCharacterStatus(this._currentCharacterEid, status);
      }
    });

    console.log(
      `[HTMLDebugStatusUI] Cleared all statuses from character ${this._currentCharacterEid}`
    );
  }

  // 스테미나/진화 게이지 조절 버튼 생성
  private _createAdjustButton(
    text: string,
    onClick: () => void
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = text;
    button.style.cssText = `
      background: rgba(100, 150, 255, 0.6);
      color: white;
      padding: 4px 8px;
      margin: 2px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      min-width: 25px;
    `;
    button.addEventListener("click", onClick);
    return button;
  }

  // 스테미나 조절 함수
  private _adjustStamina(amount: number): void {
    if (this._currentCharacterEid < 0) {
      console.warn(
        "[HTMLDebugStatusUI] No character found for stamina adjustment"
      );
      return;
    }

    const currentStamina =
      CharacterStatusComp.stamina[this._currentCharacterEid] || 0;
    const newStamina = Math.max(0, Math.min(10, currentStamina + amount));
    CharacterStatusComp.stamina[this._currentCharacterEid] = newStamina;
    console.log(
      `[HTMLDebugStatusUI] Stamina adjusted: ${currentStamina} -> ${newStamina}`
    );
  }

  // 진화 게이지 조절 함수
  private _adjustEvolutionGauge(amount: number): void {
    if (this._currentCharacterEid < 0) {
      console.warn(
        "[HTMLDebugStatusUI] No character found for evolution gauge adjustment"
      );
      return;
    }

    const currentGauge =
      CharacterStatusComp.evolutionGage[this._currentCharacterEid] || 0;
    const newGauge = Math.max(0, Math.min(100, currentGauge + amount));
    CharacterStatusComp.evolutionGage[this._currentCharacterEid] = newGauge;
    console.log(
      `[HTMLDebugStatusUI] Evolution gauge adjusted: ${currentGauge.toFixed(
        1
      )} -> ${newGauge.toFixed(1)}`
    );
  }

  public show(): void {
    this._findFirstCharacter(); // 캐릭터 다시 찾기
    this._updateCharacterIdDisplay(); // 캐릭터 ID 표시 업데이트
    this._updateAllStatusIndicators(); // 상태 표시 업데이트
    this._container.style.display = "block";
    this._isVisible = true;
  }

  public hide(): void {
    this._container.style.display = "none";
    this._isVisible = false;
  }

  public toggle(): void {
    if (this._isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public isDebugVisible(): boolean {
    return this._isVisible;
  }

  public update(): void {
    // 매 프레임마다 상태 표시 업데이트 (상태가 외부에서 변경될 수 있음)
    if (this._isVisible) {
      this._updateAllStatusIndicators();
    }
  }

  public destroy(): void {
    if (this._container.parentElement) {
      this._container.parentElement.removeChild(this._container);
    }
  }
}

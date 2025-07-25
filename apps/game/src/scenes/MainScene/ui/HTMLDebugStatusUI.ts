import { CharacterStatus } from "..//types";
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

    // 상태별 버튼 생성
    const statuses = [
      CharacterStatus.SICK,
      CharacterStatus.UNHAPPY,
      CharacterStatus.URGENT,
      CharacterStatus.HAPPY,
      CharacterStatus.DISCOVER,
    ];

    statuses.forEach((status) => {
      const buttonContainer = this._createStatusButton(status);
      this._container.appendChild(buttonContainer);
    });

    // 전체 클리어 버튼
    const clearAllButton = this._createClearAllButton();
    this._container.appendChild(clearAllButton);

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
      padding: 15px;
      z-index: 1000;
      font-family: 'Arial', sans-serif;
      color: white;
      display: none;
    `;
    return container;
  }

  private _createStatusButton(status: CharacterStatus): HTMLDivElement {
    const container = document.createElement("div");
    container.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px;
      margin-bottom: 8px;
      background: rgba(51, 51, 51, 0.4);
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.2s;
    `;

    // 상태 이름
    const statusName = document.createElement("span");
    statusName.textContent = this._getStatusName(status);
    statusName.style.cssText = `
      font-size: 14px;
      color: white;
    `;

    // 상태 표시 (ON/OFF)
    const statusIndicator = document.createElement("span");
    statusIndicator.style.cssText = `
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: inline-block;
    `;
    this._updateStatusIndicator(statusIndicator, status);
    this._indicators.set(status, statusIndicator);

    container.appendChild(statusName);
    container.appendChild(statusIndicator);

    // 클릭 이벤트
    container.addEventListener("click", () => {
      this._toggleStatus(status);
      this._updateStatusIndicator(statusIndicator, status);
    });

    return container;
  }

  private _createClearAllButton(): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = "Clear All";
    button.style.cssText = `
      width: 100%;
      padding: 6px;
      margin-top: 4px;
      background: rgba(112, 0, 0, 0.5);
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: background-color 0.2s;
    `;

    button.addEventListener("mouseenter", () => {
      button.style.backgroundColor = "#880000";
    });

    button.addEventListener("mouseleave", () => {
      button.style.backgroundColor = "#660000";
    });

    button.addEventListener("click", () => {
      this._clearAllStatuses();
      this._updateAllStatusIndicators();
    });

    return button;
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

  private _getStatusName(status: CharacterStatus): string {
    switch (status) {
      case CharacterStatus.SICK:
        return "Sick";
      case CharacterStatus.UNHAPPY:
        return "Unhappy";
      case CharacterStatus.URGENT:
        return "Urgent";
      case CharacterStatus.HAPPY:
        return "Happy";
      case CharacterStatus.DISCOVER:
        return "Discover";
      default:
        return "Unknown";
    }
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

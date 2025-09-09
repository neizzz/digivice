import { CharacterStatus } from "../types";
import { MainSceneWorld } from "..//world";
import { defineQuery } from "bitecs";
import {
  ObjectComp,
  CharacterStatusComp,
  DigestiveSystemComp,
} from "../raw-components";
import { ObjectType } from "../types";
import { createPoop, addToDigestiveLoad } from "../systems/DigestiveSystem";
import { GAME_CONSTANTS } from "../config";

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

    // Digestive 조절 버튼들
    const digestiveButtonsDiv = document.createElement("div");

    const digestiveLabel = document.createElement("span");
    digestiveLabel.textContent = "Dig: ";
    digestiveLabel.style.cssText = `
      color: #8b4513;
      font-size: 12px;
      margin-right: 5px;
    `;

    const digestivePlus1Btn = this._createAdjustButton("+1", () =>
      this._adjustDigestiveLoad(1)
    );
    const digestivePlus3Btn = this._createAdjustButton("+3", () =>
      this._adjustDigestiveLoad(3)
    );
    const digestiveResetBtn = this._createAdjustButton("R", () =>
      this._resetDigestiveLoad()
    );

    digestiveButtonsDiv.appendChild(digestiveLabel);
    digestiveButtonsDiv.appendChild(digestivePlus1Btn);
    digestiveButtonsDiv.appendChild(digestivePlus3Btn);
    digestiveButtonsDiv.appendChild(digestiveResetBtn);
    this._container.appendChild(digestiveButtonsDiv);

    // 똥 생성 버튼
    const poopButtonsDiv = document.createElement("div");
    const poopLabel = document.createElement("span");
    poopLabel.textContent = "Poop: ";
    poopLabel.style.cssText = `
      color: #8b4513;
      font-size: 12px;
      margin-right: 5px;
    `;

    const createPoopBtn = this._createAdjustButton("💩", () =>
      this._createPoop()
    );

    poopButtonsDiv.appendChild(poopLabel);
    poopButtonsDiv.appendChild(createPoopBtn);
    this._container.appendChild(poopButtonsDiv);

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
      width: 180px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      padding: 8px;
      z-index: 1000;
      font-family: 'Arial', sans-serif;
      color: white;
      display: none;
    `;

    // blink 애니메이션을 위한 스타일 추가
    const style = document.createElement("style");
    style.textContent = `
      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0.3; }
      }
    `;
    document.head.appendChild(style);

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

  // 똥 생성 함수
  private _createPoop(): void {
    if (this._currentCharacterEid < 0) {
      console.warn("[HTMLDebugStatusUI] No character found for poop creation");
      return;
    }

    createPoop(this._world, this._currentCharacterEid);
    console.log(
      `[HTMLDebugStatusUI] Poop created for character ${this._currentCharacterEid}`
    );
  }

  // Digestive load 조절 함수
  private _adjustDigestiveLoad(staminaEquivalent: number): void {
    if (this._currentCharacterEid < 0) {
      console.warn(
        "[HTMLDebugStatusUI] No character found for digestive load adjustment"
      );
      return;
    }

    const currentTime = Date.now();

    // 현재 digestive 상태 확인 (addToDigestiveLoad가 자동으로 컴포넌트 추가해줌)
    const currentLoad =
      DigestiveSystemComp.currentLoad[this._currentCharacterEid] || 0;
    const capacity =
      DigestiveSystemComp.capacity[this._currentCharacterEid] ||
      GAME_CONSTANTS.DIGESTIVE_CAPACITY;
    const loadIncrease =
      staminaEquivalent * GAME_CONSTANTS.DIGESTIVE_MULTIPLIER;
    const newLoad = currentLoad + loadIncrease;

    // 최대치를 넘었을 때 나머지 값으로 설정
    if (newLoad > capacity) {
      // addToDigestiveLoad 먼저 호출하여 컴포넌트가 없으면 자동 추가
      addToDigestiveLoad(
        this._world,
        this._currentCharacterEid,
        0,
        currentTime
      );

      const remainder = newLoad % capacity;
      DigestiveSystemComp.currentLoad[this._currentCharacterEid] = remainder;

      // poob 생성 타이머 재설정 (나머지가 있고 용량을 넘으면)
      if (remainder > 0) {
        DigestiveSystemComp.nextPoopTime[this._currentCharacterEid] =
          currentTime + GAME_CONSTANTS.POOP_DELAY;
      } else {
        DigestiveSystemComp.nextPoopTime[this._currentCharacterEid] = 0;
      }

      console.log(
        `[HTMLDebugStatusUI] Digestive load overflow: ${newLoad.toFixed(
          1
        )} -> ${remainder.toFixed(1)} (capacity: ${capacity})`
      );
    } else {
      // 일반적인 증가 처리 (자동으로 컴포넌트 추가됨)
      addToDigestiveLoad(
        this._world,
        this._currentCharacterEid,
        staminaEquivalent,
        currentTime
      );
    }

    console.log(
      `[HTMLDebugStatusUI] Digestive load adjusted by ${staminaEquivalent} stamina equivalent`
    );
  }

  // Digestive load 초기화 함수
  private _resetDigestiveLoad(): void {
    if (this._currentCharacterEid < 0) {
      console.warn(
        "[HTMLDebugStatusUI] No character found for digestive load reset"
      );
      return;
    }

    // addToDigestiveLoad(0)으로 컴포넌트가 없으면 자동 추가
    const currentTime = Date.now();
    addToDigestiveLoad(this._world, this._currentCharacterEid, 0, currentTime);

    // 리셋
    DigestiveSystemComp.currentLoad[this._currentCharacterEid] = 0;
    DigestiveSystemComp.nextPoopTime[this._currentCharacterEid] = 0;
    console.log(
      `[HTMLDebugStatusUI] Digestive load reset for character ${this._currentCharacterEid}`
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

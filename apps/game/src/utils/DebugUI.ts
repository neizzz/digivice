import { DebugFlags } from "./DebugFlags";
import { EventBus, EventTypes } from "./EventBus";
import type { Character } from "entities/Character";

// 게임 상태를 위한 타입 정의
declare global {
  interface Window {
    gameState?: {
      stamina?: number;
      maxStamina?: number;
    };
    debug?: {
      togglePreventEating: () => boolean;
      showFlags: () => void;
      createPoob?: () => void; // createPoob 메서드 추가
    };
  }
}

/**
 * 게임 내 디버그 정보를 UI로 표시하는 클래스
 */
export class DebugUI {
  private static instance: DebugUI;
  private container: HTMLDivElement | null = null;
  private actionButtonsContainer: HTMLDivElement | null = null; // 액션 버튼 컨테이너 추가
  private debugFlags: DebugFlags;
  private eventBus: EventBus;
  private character?: Character; // 캐릭터 참조 저장
  // 스태미나 현재/최대 값 저장
  private staminaState = {
    current: 0,
    max: 10, // 초기값 설정 (실제값은 이벤트에서 받아옴)
  };

  private constructor() {
    this.debugFlags = DebugFlags.getInstance();
    this.eventBus = EventBus.getInstance();
    this.createUI();
    this.showDebugUI(); // 생성 즉시 UI 표시

    // 스태미나 변경 이벤트 구독
    this.subscribeToStaminaChanges();
  }

  /**
   * DebugUI 싱글톤 인스턴스를 반환
   */
  public static getInstance(): DebugUI {
    if (!DebugUI.instance) {
      DebugUI.instance = new DebugUI();
    }
    return DebugUI.instance;
  }

  /**
   * 캐릭터 객체 참조 설정
   * @param character 게임 내 캐릭터 객체
   */
  public setCharacter(character: Character): void {
    this.character = character;

    // 전역 디버그 함수에 createPoob 추가
    if (window.debug) {
      window.debug.createPoob = () => {
        this.createPoob();
      };
    }
  }

  /**
   * Poob 생성 함수
   */
  private createPoob(): void {
    if (!this.character) {
      console.error("캐릭터 객체가 설정되지 않았습니다.");
      return;
    }

    try {
      // 캐릭터의 createPoob 메서드 호출
      const poob = this.character.createPoob();
      if (poob) {
        console.log("Poob이 생성되었습니다:", poob);
      }
    } catch (error) {
      console.error("Poob 생성 중 오류 발생:", error);
    }
  }

  /**
   * 스태미나 변경 이벤트 구독
   */
  private subscribeToStaminaChanges(): void {
    this.eventBus.on(
      EventTypes.CHARACTER.STAMINA_CHANGED,
      (data: { current: number; max: number }) => {
        this.staminaState.current = data.current;
        this.staminaState.max = data.max;
        this.updateUI();
      }
    );
  }

  /**
   * 디버그 UI 생성
   */
  private createUI(): void {
    // 메인 컨테이너 생성
    this.container = document.createElement("div");
    this.container.className = "debug-panel";
    this.container.style.position = "fixed";
    this.container.style.top = "10px";
    this.container.style.left = "10px"; // 왼쪽에 배치하도록 수정
    this.container.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
    this.container.style.color = "white";
    this.container.style.padding = "0 10px";
    this.container.style.borderRadius = "5px";
    this.container.style.fontFamily = "monospace";
    this.container.style.fontSize = "12px";
    this.container.style.zIndex = "9999";

    // 플래그 컨테이너
    const flagsContainer = document.createElement("div");
    flagsContainer.id = "debug-flags-container";
    this.container.appendChild(flagsContainer);

    // 액션 버튼 컨테이너 생성 (오른쪽 상단)
    this.createActionButtonsContainer();

    // UI를 body에 추가
    document.body.appendChild(this.container);

    // 초기 상태 업데이트
    this.updateUI();
  }

  /**
   * 액션 버튼 컨테이너 생성 (오른쪽 상단)
   */
  private createActionButtonsContainer(): void {
    // 액션 버튼 컨테이너 생성
    this.actionButtonsContainer = document.createElement("div");
    this.actionButtonsContainer.className = "debug-action-buttons";
    this.actionButtonsContainer.style.position = "fixed";
    this.actionButtonsContainer.style.top = "10px";
    this.actionButtonsContainer.style.right = "10px"; // 오른쪽 상단에 배치
    this.actionButtonsContainer.style.display = "flex";
    this.actionButtonsContainer.style.flexDirection = "column";
    this.actionButtonsContainer.style.gap = "5px";
    this.actionButtonsContainer.style.zIndex = "9999";

    // createPoob 버튼 생성
    const createPoobButton = this.createActionButton("Poob 생성", () => {
      this.createPoob();
    });

    this.actionButtonsContainer.appendChild(createPoobButton);

    // 추가 액션 버튼은 여기에 계속 추가 가능

    // body에 액션 버튼 컨테이너 추가
    document.body.appendChild(this.actionButtonsContainer);
  }

  /**
   * 액션 버튼 생성 헬퍼 함수
   * @param label 버튼 레이블
   * @param onClick 클릭 이벤트 핸들러
   */
  private createActionButton(
    label: string,
    onClick: () => void
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = label;
    button.style.padding = "5px 10px";
    button.style.backgroundColor = "#555";
    button.style.color = "white";
    button.style.border = "1px solid #777";
    button.style.borderRadius = "4px";
    button.style.cursor = "pointer";
    button.style.fontSize = "12px";
    button.style.fontFamily = "monospace";
    button.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
    button.style.transition = "background-color 0.2s";

    // 호버 효과
    button.onmouseover = () => {
      button.style.backgroundColor = "#666";
    };
    button.onmouseout = () => {
      button.style.backgroundColor = "#555";
    };

    // 클릭 이벤트
    button.onclick = onClick;

    return button;
  }

  /**
   * 디버그 UI 표시
   */
  public showDebugUI(): void {
    if (!this.container) return;
    this.container.style.display = "block";
    if (this.actionButtonsContainer) {
      this.actionButtonsContainer.style.display = "flex";
    }
    this.updateUI();
  }

  /**
   * UI 정보 업데이트
   */
  public updateUI(): void {
    if (!this.container) return;

    const flagsContainer = this.container.querySelector(
      "#debug-flags-container"
    );
    if (!flagsContainer) return;

    // UI 초기화
    flagsContainer.innerHTML = "";

    // 스태미나 표시
    const staminaItem = document.createElement("div");
    staminaItem.style.margin = "5px 0";

    const staminaLabel = document.createElement("span");
    staminaLabel.textContent = "스태미나: ";

    const staminaValue = document.createElement("span");
    staminaValue.textContent = `${this.staminaState.current}/${this.staminaState.max}`;
    staminaValue.style.color = "#8ff";

    staminaItem.appendChild(staminaLabel);
    staminaItem.appendChild(staminaValue);
    flagsContainer.appendChild(staminaItem);

    // preventEating 플래그 표시
    const preventEatingItem = document.createElement("div");
    preventEatingItem.style.margin = "5px 0";

    const statusIndicator = document.createElement("span");

    const flagName = document.createElement("span");
    flagName.textContent = "preventEating: ";

    const flagValue = document.createElement("span");
    flagValue.textContent = this.debugFlags.isEatingPrevented().toString();
    flagValue.style.color = this.debugFlags.isEatingPrevented()
      ? "#8f8"
      : "#f88";

    const toggleButton = document.createElement("button");
    toggleButton.textContent = "토글";
    toggleButton.style.marginLeft = "10px";
    toggleButton.style.padding = "2px 5px";
    toggleButton.style.backgroundColor = "#444";
    toggleButton.style.border = "1px solid #666";
    toggleButton.style.borderRadius = "3px";
    toggleButton.style.color = "white";
    toggleButton.style.cursor = "pointer";

    toggleButton.addEventListener("click", () => {
      // 디버그 플래그 토글
      window.debug?.togglePreventEating();
      // UI 업데이트
      this.updateUI();
    });

    preventEatingItem.appendChild(statusIndicator);
    preventEatingItem.appendChild(flagName);
    preventEatingItem.appendChild(flagValue);
    preventEatingItem.appendChild(toggleButton);

    flagsContainer.appendChild(preventEatingItem);
  }
}

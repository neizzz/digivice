import type * as PIXI from "pixi.js";
import { DebugFlags } from "./DebugFlags";
import { EventBus, EventTypes } from "./EventBus";

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
    };
  }
}

/**
 * 게임 내 디버그 정보를 UI로 표시하는 클래스
 */
export class DebugUI {
  private static instance: DebugUI;
  private container: HTMLDivElement | null = null;
  private debugFlags: DebugFlags;
  private eventBus: EventBus;
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

    // UI를 body에 추가
    document.body.appendChild(this.container);

    // 초기 상태 업데이트
    this.updateUI();
  }

  /**
   * 디버그 UI 표시
   */
  public showDebugUI(): void {
    if (!this.container) return;
    this.container.style.display = "block";
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

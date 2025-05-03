import type * as PIXI from "pixi.js";
import { CHARACTER_MAX_STAMINA } from "../entities/Character";
import { EventBus, EventTypes } from "./EventBus";

/**
 * 게임 디버그용 UI를 관리하는 클래스
 * - 스태미나 표시
 * - 기타 디버그 정보 표시
 */
export class DebugUI {
  private static instance?: DebugUI;
  private container: HTMLDivElement;
  private staminaElement: HTMLDivElement | null = null;
  private eventBus: EventBus;

  /**
   * 생성자는 프라이빗으로, getInstance를 통해서만 접근 가능
   */
  private constructor() {
    this.eventBus = EventBus.getInstance();

    // DOM 요소 생성
    this.container = document.createElement("div");
    this.container.id = "debug-ui-container";
    this.container.style.position = "fixed";
    this.container.style.top = "0";
    this.container.style.left = "0";
    this.container.style.zIndex = "10000";
    this.container.style.padding = "10px";
    this.container.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    this.container.style.color = "white";
    this.container.style.fontFamily = "Arial, sans-serif";
    this.container.style.fontSize = "14px";
    this.container.style.display = "block"; // 항상 표시

    document.body.appendChild(this.container);

    // UI 초기화
    this.initUI();

    // 이벤트 구독
    this.subscribeToEvents();
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
   * 디버그 UI 초기화
   */
  private initUI(): void {
    // 스태미나 요소 생성
    this.staminaElement = document.createElement("div");
    this.staminaElement.style.marginBottom = "5px";
    this.staminaElement.style.textShadow = "1px 1px 2px black";
    this.staminaElement.innerHTML = "스태미나: 0/0";

    // 컨테이너에 추가
    this.container.appendChild(this.staminaElement);
  }

  /**
   * 이벤트 구독
   */
  private subscribeToEvents(): void {
    // 스태미나 변경 이벤트 구독
    this.eventBus.on(EventTypes.CHARACTER.STAMINA_CHANGED, (data) => {
      this.updateStamina(data.current, data.max);
    });
  }

  /**
   * 스태미나 텍스트 업데이트
   * @param current 현재 스태미나 값
   * @param max 최대 스태미나 값
   */
  public updateStamina(
    current: number,
    max: number = CHARACTER_MAX_STAMINA
  ): void {
    if (this.staminaElement) {
      this.staminaElement.innerHTML = `스태미나: ${current}/${max}`;
    }
  }

  /**
   * 디버그 텍스트 메시지 표시
   * @param message 표시할 메시지
   * @param duration 표시 지속 시간(ms), 기본값은 3초
   */
  public showMessage(message: string, duration = 3000): void {
    // 메시지 요소 생성
    const messageElement = document.createElement("div");
    messageElement.style.color = "#ffff00";
    messageElement.style.marginTop = "5px";
    messageElement.style.textShadow = "1px 1px 2px black";
    messageElement.innerHTML = message;

    // 컨테이너에 추가
    this.container.appendChild(messageElement);

    // 일정 시간 후 제거
    setTimeout(() => {
      if (messageElement.parentNode === this.container) {
        this.container.removeChild(messageElement);
      }
    }, duration);
  }

  /**
   * DebugUI 정리 (앱 종료 시 호출)
   */
  public destroy(): void {
    // 이벤트 구독 해제
    this.eventBus.off(EventTypes.CHARACTER.STAMINA_CHANGED);

    // DOM 요소 제거
    if (this.container?.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    DebugUI.instance = undefined;
  }
}

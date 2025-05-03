import type { Poob } from "entities/Poob";

/**
 * 게임 내 이벤트 타입 정의
 */
export const EventTypes = {
  // 캐릭터 관련 이벤트
  CHARACTER: {
    STAMINA_CHANGED: "character:stamina_changed" as const,
    POOB_CREATED: "character:poob_created" as const, // Poob 생성 이벤트 추가
  },

  // UI 관련 이벤트
  // UI: {
  //   REFRESH_DEBUG: "ui:refresh_debug" as const,
  // },
  // 게임 상태 관련 이벤트
  // GAME: {
  //   STATE_CHANGED: "game:state_changed" as const,
  // },
};

// 이벤트 타입의 모든 값을 유니온 타입으로 추출
type EventTypesValues =
  | typeof EventTypes.CHARACTER.STAMINA_CHANGED
  | typeof EventTypes.CHARACTER.POOB_CREATED;
// | typeof EventTypes.UI.REFRESH_DEBUG
// | typeof EventTypes.GAME.STATE_CHANGED;

/**
 * 이벤트 데이터 타입들을 정의하는 인터페이스
 * 새로운 이벤트와 데이터 구조가 필요할 때마다 여기에 추가
 */
export interface EventDataMap {
  // 캐릭터 관련 이벤트
  [EventTypes.CHARACTER.STAMINA_CHANGED]: { current: number; max: number };
  [EventTypes.CHARACTER.POOB_CREATED]: {
    position: { x: number; y: number };
  }; // poob 객체 제거하고 위치 정보만 유지

  // UI 관련 이벤트
  // [EventTypes.UI.REFRESH_DEBUG]: { timestamp: number };
  // 게임 상태 관련 이벤트
  // [EventTypes.GAME.STATE_CHANGED]: { newState: string; previousState?: string };

  // 기본 문자열 키를 가진 이벤트를 위한 인덱스 시그니처
  [key: string]: unknown;
}

/**
 * 전역 이벤트 관리를 위한 EventBus 클래스
 * 컴포넌트 간의 직접적인 의존성을 줄이기 위한 이벤트 중개자 역할
 */
export class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, Array<(data: unknown) => void>>;

  private constructor() {
    this.listeners = new Map();
  }

  /**
   * EventBus의 싱글톤 인스턴스 반환
   */
  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * 이벤트 리스너 등록
   * @param event 이벤트 이름
   * @param callback 호출될 콜백 함수
   */
  public on<K extends keyof EventDataMap>(
    event: K,
    callback: (data: EventDataMap[K]) => void
  ): void {
    const eventKey = event as string;
    if (!this.listeners.has(eventKey)) {
      this.listeners.set(eventKey, []);
    }
    // 현재 listeners Map에 해당 eventKey가 있음을 확인하고 접근
    const listeners = this.listeners.get(eventKey);
    if (listeners) {
      listeners.push(callback as (data: unknown) => void);
    }
  }

  /**
   * 이벤트 리스너 제거
   * @param event 이벤트 이름
   * @param callback 제거할 콜백 함수 (생략 시 해당 이벤트의 모든 리스너 제거)
   */
  public off<K extends keyof EventDataMap>(
    event: K,
    callback?: (data: EventDataMap[K]) => void
  ): void {
    const eventKey = event as string;
    if (!this.listeners.has(eventKey)) {
      return;
    }

    if (!callback) {
      // 해당 이벤트의 모든 리스너 제거
      this.listeners.delete(eventKey);
      return;
    }

    // 특정 콜백만 제거
    const listeners = this.listeners.get(eventKey);
    if (!listeners) {
      return;
    }

    const callbackAsUnknown = callback as (data: unknown) => void;
    const index = listeners.indexOf(callbackAsUnknown);
    if (index !== -1) {
      listeners.splice(index, 1);
    }

    // 리스너가 없으면 맵에서 이벤트 키 제거
    if (listeners.length === 0) {
      this.listeners.delete(eventKey);
    }
  }

  /**
   * 이벤트 발생 및 리스너 호출
   * @param event 이벤트 이름
   * @param data 이벤트 핸들러에 전달할 데이터
   */
  public emit<K extends keyof EventDataMap>(
    event: K,
    data: EventDataMap[K]
  ): void {
    const eventKey = event as string;
    const listeners = this.listeners.get(eventKey);

    if (!listeners || listeners.length === 0) {
      return;
    }

    // 리스너 배열을 복사하여 순회 중 리스트가 수정되어도 안전하게 처리
    const listenersCopy = [...listeners];
    for (const listener of listenersCopy) {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${String(event)}:`, error);
      }
    }
  }

  /**
   * 한 번만 실행되는 이벤트 리스너 등록
   * @param event 이벤트 이름
   * @param callback 호출될 콜백 함수
   */
  public once<K extends keyof EventDataMap>(
    event: K,
    callback: (data: EventDataMap[K]) => void
  ): void {
    const onceCallback = (data: EventDataMap[K]) => {
      this.off(event, onceCallback as (data: EventDataMap[K]) => void);
      callback(data);
    };
    this.on(event, onceCallback as (data: EventDataMap[K]) => void);
  }

  /**
   * 모든 이벤트 리스너 제거
   */
  public clear(): void {
    this.listeners.clear();
  }
}

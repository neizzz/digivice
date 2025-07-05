import type { EventDataMap } from "./EventBus";

/**
 * 범용 이벤트 큐 클래스
 */
export class EventQueue<T extends keyof EventDataMap = keyof EventDataMap> {
  private queue: Array<{ type: T; data: EventDataMap[T] }> = [];
  private handlers: Partial<Record<T, (data: EventDataMap[T]) => void>> = {};

  constructor(
    eventTypes: T[],
    handlerMap: Partial<Record<T, (data: EventDataMap[T]) => void>>
  ) {
    this.handlers = handlerMap;
    // 이벤트 타입별로 subscribe
    for (const type of eventTypes) {
      // 실제 EventBus.subscribe는 외부에서 해주거나, 필요시 여기에 추가
    }
  }

  /**
   * 큐에 이벤트 추가
   */
  public push(event: { type: T; data: EventDataMap[T] }) {
    this.queue.push(event);
  }

  /**
   * 큐에 쌓인 모든 이벤트를 핸들러로 처리
   */
  public flush(): void {
    while (this.queue.length > 0) {
      const event = this.queue.shift();
      if (event && this.handlers[event.type]) {
        this.handlers[event.type]!(event.data);
      }
    }
  }

  /**
   * 큐 비우기
   */
  public clear(): void {
    this.queue = [];
  }

  /**
   * 현재 큐 길이 반환
   */
  public size(): number {
    return this.queue.length;
  }
}

import type * as PIXI from "pixi.js";
import { Cleanable } from "../interfaces/Cleanable";
import { EventBus, EventTypes } from "../utils/EventBus";
import { Broom } from "../entities/Broom";

/**
 * 청소 상태를 나타내는 enum
 */
export enum CleaningState {
  INACTIVE = 0, // 청소 모드 비활성화
  ACTIVE = 1, // 청소 모드 활성화
  CLEANING = 2, // 현재 청소 중
  TRANSITIONING = 3, // 다음 청소 대상으로 이동 중
}

export interface CleaningManagerOptions {
  app: PIXI.Application;
  parent: PIXI.Container;
  onCleaningComplete?: () => void; // 모든 청소가 완료됐을 때 호출할 콜백
}

/**
 * 청소 관리자 클래스
 * 청소 가능한 객체들을 관리하고, 슬라이더 값을 이용해 순차적으로 청소를 진행합니다.
 */
export class CleaningManager {
  private app: PIXI.Application;
  private parent: PIXI.Container;
  private cleanableObjects: Cleanable[] = [];
  private currentCleanableIndex = -1;
  private cleaningState: CleaningState = CleaningState.INACTIVE;
  private previousSliderValue = 0; // 0으로 초기화
  private currentProgress = 0;
  private onCleaningComplete?: () => void;

  // 빗자루 객체 참조
  private broom: Broom | null = null;

  // 이벤트 버스 추가
  private eventBus: EventBus;

  /**
   * @param options 청소 관리자 옵션
   */
  constructor(options: CleaningManagerOptions) {
    this.app = options.app;
    this.parent = options.parent;
    this.onCleaningComplete = options.onCleaningComplete;

    // 이벤트 버스 초기화
    this.eventBus = EventBus.getInstance();
  }

  /**
   * 청소 모드 활성화
   */
  public activate(): void {
    if (
      this.cleaningState === CleaningState.ACTIVE ||
      this.cleaningState === CleaningState.CLEANING
    ) {
      return; // 이미 활성화된 상태
    }

    console.log("청소 모드 활성화");
    this.cleaningState = CleaningState.ACTIVE;

    // 청소 가능한 객체들 검색
    this.findCleanableObjects();

    // 청소할 객체가 있으면 첫 번째 객체로 선택
    if (this.cleanableObjects.length > 0) {
      this.currentCleanableIndex = 0;
      this.moveToCurrentCleanableObject();

      // 빗자루 객체 초기화 (반드시 moveToCurrentCleanableObject 후에 호출)
      this.initBroom();
    } else {
      console.log("청소할 객체가 없습니다.");
    }
  }

  /**
   * 빗자루 객체 초기화
   */
  private initBroom(): void {
    if (this.broom) {
      this.parent.removeChild(this.broom.getSprite());
    }
    // 새 빗자루 생성
    this.broom = new Broom(this.parent);

    // 현재 청소 대상이 있으면 빗자루 위치 설정
    const currentCleanable = this.getCurrentCleanable();
    if (currentCleanable) {
      const targetPos = currentCleanable.getPosition();

      // 현재 청소 대상 위에 빗자루 배치 (y 좌표를 약간 위쪽으로)
      // y 좌표를 약간 낮게(+-5) 설정하여 빗자루가 Cleanable보다 약간 뒤에 그려지도록 함
      const broomY = targetPos.y - 5;
      this.broom.setPosition(targetPos.x, broomY);
    } else {
      console.warn("현재 청소 대상이 없습니다. 기본 위치에 빗자루 배치합니다.");
      this.broom.setPosition(
        this.app.screen.width / 2,
        this.app.screen.height / 2
      );
    }
  }

  /**
   * 청소 모드 비활성화
   */
  public deactivate(): void {
    if (this.cleaningState === CleaningState.INACTIVE) {
      return; // 이미 비활성화된 상태
    }

    console.log("청소 모드 비활성화");
    this.cleaningState = CleaningState.INACTIVE;
    this.currentCleanableIndex = -1;
    this.currentProgress = 0;

    if (this.broom) {
      this.parent.removeChild(this.broom.getSprite());
    }
  }

  /**
   * 씬(또는 월드)에서 청소 가능한 객체들을 찾아 배열에 추가
   */
  private findCleanableObjects(): void {
    this.cleanableObjects = [];

    // 부모 컨테이너의 모든 자식 순회
    for (let i = 0; i < this.parent.children.length; i++) {
      const child = this.parent.children[i];

      try {
        // 스프라이트에 __poobRef 속성이 있는지 확인
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        if (child && (child as any).__objectRef) {
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          const objectRef = (child as any).__objectRef;
          // Cleanable의 인스턴스인지 확인
          if (objectRef instanceof Cleanable) {
            this.cleanableObjects.push(objectRef);
          }
        }
      } catch (error) {
        console.error("객체 확인 중 오류 발생:", error);
      }
    }

    console.log(
      `총 ${this.cleanableObjects.length}개의 Cleanable 객체를 찾았습니다.`
    );

    if (this.cleanableObjects.length === 0) {
      console.warn(
        "청소 가능한 객체가 없습니다. Poob 객체가 제대로 생성되었는지 확인하세요."
      );
    }
  }

  /**
   * 슬라이더 값 변경 처리
   * @param sliderValue 0-1 범위의 슬라이더 값 (0: 왼쪽 끝, 1: 오른쪽 끝)
   */
  public handleSliderValueChange(sliderValue: number): void {
    // 청소 모드가 활성화되지 않았으면 무시
    if (
      this.cleaningState === CleaningState.INACTIVE ||
      this.currentCleanableIndex < 0 ||
      this.currentCleanableIndex >= this.cleanableObjects.length
    ) {
      console.log(
        "청소 모드가 비활성화 상태이거나 청소할 오브젝트가 없음. 슬라이더 값 변경 무시."
      );
      return;
    }

    // 슬라이더 이동 방향에 따라 빗자루 방향 설정 (값 증가: 오른쪽, 값 감소: 왼쪽)
    if (this.broom) {
      if (sliderValue > this.previousSliderValue) {
        this.broom.setDirection(1);
      } else if (sliderValue < this.previousSliderValue) {
        this.broom.setDirection(-1);
      }
    }

    // 현재 청소 대상이 있으면 빗자루 위치 업데이트
    const currentCleanable = this.getCurrentCleanable();
    if (currentCleanable && this.broom) {
      const targetPos = currentCleanable.getPosition();
      const targetSprite = currentCleanable.getSprite();

      // Cleanable 객체의 폭 가져오기
      const targetWidth = targetSprite.width;

      // 슬라이더 값(0-1)에 따라 Cleanable 객체의 정확히 양 끝으로 이동하도록 설정
      // 슬라이더 0 = 왼쪽 끝, 슬라이더 1 = 오른쪽 끝
      const halfWidth = targetWidth / 2;
      const offsetX = sliderValue * targetWidth - halfWidth;

      // 빗자루 위치 업데이트 - 디버그 로그 추가
      const newX = targetPos.x + offsetX;
      this.broom.setPosition(newX);
    }

    this.previousSliderValue = sliderValue;

    // FIXME: 디버깅을 위한 청소 진행 로직 비활성화
    /*
    // 슬라이더 값의 변화량 계산 (절대값)
    const change = Math.abs(sliderValue - this.previousSliderValue);

    // 청소 상태가 CLEANING이면 현재 객체 청소 진행
    if (this.cleaningState === CleaningState.CLEANING) {
      // 변화량에 비례해 진행도 증가 (작은 변화에도 반응하도록 계수 조정)
      this.currentProgress += change;

      // 진행도가 1을 초과하지 않도록 제한
      this.currentProgress = Math.min(this.currentProgress, 1);

      // 현재 청소 가능한 객체의 청소 진행도 업데이트
      const currentCleanable =
        this.cleanableObjects[this.currentCleanableIndex];
      const isComplete = currentCleanable.updateCleanProgress(
        this.currentProgress
      );

      // 청소가 완료되면 다음 객체로 이동
      if (isComplete) {
        console.log("현재 객체 청소 완료");
        this.currentProgress = 0;
        this.moveToNextCleanable();
      }
    }
    */
  }

  /**
   * 현재 선택된 청소 가능한 객체로 이동
   */
  private moveToCurrentCleanableObject(): void {
    if (
      this.currentCleanableIndex < 0 ||
      this.currentCleanableIndex >= this.cleanableObjects.length
    ) {
      return;
    }

    // 현재 객체의 위치 가져오기
    const currentCleanable = this.cleanableObjects[this.currentCleanableIndex];
    const position = currentCleanable.getPosition();

    // 청소 상태를 CLEANING으로 변경
    this.cleaningState = CleaningState.CLEANING;
    this.currentProgress = 0;
  }

  /**
   * 다음 청소 가능한 객체로 이동
   */
  private moveToNextCleanable(): void {
    // 다음 인덱스로 이동
    this.currentCleanableIndex++;

    // 모든 객체를 다 청소했는지 확인
    if (this.currentCleanableIndex >= this.cleanableObjects.length) {
      console.log("모든 객체 청소 완료");
      this.cleaningState = CleaningState.INACTIVE;

      // 완료 콜백 호출
      if (this.onCleaningComplete) {
        this.onCleaningComplete();
      }

      return;
    }

    // 다음 객체로 이동
    this.moveToCurrentCleanableObject();
  }

  /**
   * 청소 가능한 객체 배열 반환
   */
  public getCleanableObjects(): Cleanable[] {
    return this.cleanableObjects;
  }

  /**
   * 현재 청소 중인 객체 반환
   */
  public getCurrentCleanable(): Cleanable | null {
    if (
      this.currentCleanableIndex < 0 ||
      this.currentCleanableIndex >= this.cleanableObjects.length
    ) {
      return null;
    }
    return this.cleanableObjects[this.currentCleanableIndex];
  }

  /**
   * 현재 청소 상태 반환
   */
  public getCleaningState(): CleaningState {
    return this.cleaningState;
  }

  /**
   * 청소 진행 중인지 여부 반환
   */
  public isCleaning(): boolean {
    return this.cleaningState === CleaningState.CLEANING;
  }

  /**
   * 현재 청소 중인 대상 반환
   * @returns 현재 청소 중인 Cleanable 객체 또는 null
   */
  public getCurrentTarget(): Cleanable | null {
    return this.getCurrentCleanable();
  }

  /**
   * 리소스 정리
   */
  public destroy(): void {
    // 빗자루 제거
    if (this.broom) {
      this.parent.removeChild(this.broom.getSprite());
      this.broom = null;
    }

    // 이벤트 구독 해제
    this.eventBus.off(EventTypes.CHARACTER.POOB_CREATED);
  }
}

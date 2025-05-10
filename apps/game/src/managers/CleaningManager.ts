import * as PIXI from "pixi.js";
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

  // 슬라이더 총 이동 거리 측정을 위한 변수 추가
  private totalSliderMovement = 0;
  private targetSliderMovement = 6.0; // 청소 완료를 위한 목표 이동 거리

  // 빗자루 객체 참조
  private broom: Broom | null = null;

  // 이벤트 버스 추가
  private eventBus: EventBus;

  // Cleanable 객체의 경계를 표시하기 위한 그래픽 객체들
  private cleanableBorders: Map<Cleanable, PIXI.Graphics> = new Map();

  // 모든 청소 완료 여부를 추적하는 변수
  private allCleaningComplete = false;

  /**
   * @param options 청소 관리자 옵션
   */
  constructor(options: CleaningManagerOptions) {
    this.app = options.app;
    this.parent = options.parent;
    this.onCleaningComplete = options.onCleaningComplete;

    // 이벤트 버스 초기화
    this.eventBus = EventBus.getInstance();

    // zIndex를 사용하기 위해 부모 컨테이너의 sortableChildren 속성을 true로 설정
    this.parent.sortableChildren = true;
  }

  /**
   * 현재 선택된 Cleanable 객체와 테두리를 항상 맨 앞에 표시합니다.
   * @private
   */
  private bringCurrentCleanableToFront(): void {
    if (
      this.currentCleanableIndex >= 0 &&
      this.currentCleanableIndex < this.cleanableObjects.length
    ) {
      const currentCleanable =
        this.cleanableObjects[this.currentCleanableIndex];
      const sprite = currentCleanable.getSprite();

      // 현재 객체의 스프라이트에 높은 zIndex 설정하여 맨 앞에 표시
      if (sprite) {
        // 다른 스프라이트보다 높은 zIndex 값 설정 (100)
        sprite.zIndex = 1000;
      }

      // 현재 객체의 테두리도 맨 앞으로 가져오기
      const border = this.cleanableBorders.get(currentCleanable);
      if (border) {
        // 핑크색 테두리는 현재 객체의 테두리입니다
        // 테두리의 zIndex를 스프라이트보다 높게 설정 (110)
        border.zIndex = 1100;
      }
    }
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

      // 현재 선택된 인덱스 로그 확인
      console.log(
        `현재 선택된 Cleanable 인덱스: ${this.currentCleanableIndex}`
      );

      // Cleanable 객체들 주변에 점선 테두리 그리기 (currentCleanableIndex 설정 후에 호출)
      this.createCleanableBorders();

      // 현재 Cleanable 객체를 맨 앞으로 가져오기
      this.bringCurrentCleanableToFront();

      this.moveToCurrentCleanable();

      // 빗자루 객체 초기화 (반드시 moveToCurrentCleanableObject 후에 호출)
      this.initBroom();
    } else {
      console.log("청소할 객체가 없습니다.");
    }
  }

  /**
   * Cleanable 객체들 주변에 점선 테두리를 그립니다.
   */
  private createCleanableBorders(): void {
    // 기존 테두리 제거
    this.removeCleanableBorders();

    // 일반 Cleanable 객체 테두리 먼저 그리기
    for (let i = 0; i < this.cleanableObjects.length; i++) {
      if (i !== this.currentCleanableIndex) {
        this.createBorderForCleanable(
          this.cleanableObjects[i],
          0xffffff,
          false
        );

        // 일반 Cleanable 객체의 zIndex를 낮게 설정
        const sprite = this.cleanableObjects[i].getSprite();
        if (sprite) {
          sprite.zIndex = 40; // 테두리(50)보다 낮게 설정
        }
      }
    }

    // 현재 선택된 Cleanable 객체 테두리 그리기
    if (
      this.currentCleanableIndex >= 0 &&
      this.currentCleanableIndex < this.cleanableObjects.length
    ) {
      const currentCleanable =
        this.cleanableObjects[this.currentCleanableIndex];
      // 핑크색(0xFF69B4)으로 테두리 그리기 및 앞에 표시하도록 설정
      this.createBorderForCleanable(currentCleanable, 0xff69b4, true);

      // 현재 Cleanable 스프라이트도 항상 앞에 그려지도록 zIndex 설정
      const sprite = currentCleanable.getSprite();
      if (sprite) {
        // 높은 zIndex 값 설정 (테두리는 110, 스프라이트는 100)
        sprite.zIndex = 100;
      }
    }
  }

  /**
   * 개별 Cleanable 객체에 대한 테두리를 생성합니다.
   * @param cleanable Cleanable 객체
   * @param color 테두리 색상
   * @param bringToFront 테두리를 앞으로 가져올지 여부
   */
  private createBorderForCleanable(
    cleanable: Cleanable,
    color: number,
    bringToFront: boolean
  ): void {
    const sprite = cleanable.getSprite();
    const bounds = sprite.getBounds();

    const border = new PIXI.Graphics();

    // 테두리 스타일 설정
    border.lineStyle({
      width: 4,
      color,
      alpha: bringToFront ? 1 : 0.8,
      alignment: 0,
    });

    // 점선 효과를 위한 설정
    const dashSize = 4; // 점선 한 부분의 길이
    const gapSize = 4; // 점선 사이의 간격 길이

    // 상단 가로선
    this.drawDashedLine(
      border,
      -bounds.width / 2,
      -bounds.height / 2,
      bounds.width / 2,
      -bounds.height / 2,
      dashSize,
      gapSize
    );

    // 오른쪽 세로선
    this.drawDashedLine(
      border,
      bounds.width / 2,
      -bounds.height / 2,
      bounds.width / 2,
      bounds.height / 2,
      dashSize,
      gapSize
    );

    // 하단 가로선
    this.drawDashedLine(
      border,
      bounds.width / 2,
      bounds.height / 2,
      -bounds.width / 2,
      bounds.height / 2,
      dashSize,
      gapSize
    );

    // 왼쪽 세로선
    this.drawDashedLine(
      border,
      -bounds.width / 2,
      bounds.height / 2,
      -bounds.width / 2,
      -bounds.height / 2,
      dashSize,
      gapSize
    );

    // 테두리 위치 설정
    border.position.set(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2
    );

    // 부모 컨테이너에 추가
    this.parent.addChild(border);

    // zIndex를 사용하여 테두리를 앞으로 가져오기
    if (bringToFront) {
      // 핑크색 테두리는 다른 모든 객체보다 앞에 표시 (높은 zIndex 사용)
      border.zIndex = 110;
    } else {
      // 일반 테두리의 zIndex는 낮게 설정
      border.zIndex = 50;
    }

    // Map에 저장
    this.cleanableBorders.set(cleanable, border);
  }

  /**
   * 점선 테두리를 제거합니다.
   */
  private removeCleanableBorders(): void {
    for (const border of this.cleanableBorders.values()) {
      if (border.parent) {
        border.parent.removeChild(border);
      }
      border.destroy();
    }
    this.cleanableBorders.clear();
  }

  /**
   * 특정 Cleanable 객체의 테두리만 제거합니다.
   * @param cleanable 테두리를 제거할 Cleanable 객체
   */
  private removeCleanableBorderForObject(cleanable: Cleanable): void {
    // Map에서 해당 Cleanable 객체에 대한 테두리 찾기
    const border = this.cleanableBorders.get(cleanable);
    if (border) {
      // 테두리를 화면에서 제거
      if (border.parent) {
        border.parent.removeChild(border);
      }
      // 테두리 객체 메모리 정리
      border.destroy();
      // Map에서 해당 테두리 제거
      this.cleanableBorders.delete(cleanable);

      console.log("청소 완료된 객체의 테두리 제거 완료");
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
    const currentCleanableSprite = this.getCurrentCleanable()?.getSprite();
    if (currentCleanableSprite) {
      currentCleanableSprite.zIndex = currentCleanableSprite.getBounds().y;
    }
    this.cleaningState = CleaningState.INACTIVE;
    this.currentCleanableIndex = -1;
    this.currentProgress = 0;

    // 점선 테두리 제거
    this.removeCleanableBorders();

    if (this.broom) {
      // 빗자루 제거
      this.parent.removeChild(this.broom.getSprite());
      this.broom.destroy();
      this.broom = null;
    }

    // 모든 청소 완료 플래그가 설정된 경우 완료 콜백 호출
    if (this.allCleaningComplete && this.onCleaningComplete) {
      this.onCleaningComplete();
      this.allCleaningComplete = false; // 플래그 초기화
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
        // 스프라이트에 __objectRef 속성이 있는지 확인
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        if (child && (child as any).__objectRef) {
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          const objectRef = (child as any).__objectRef;

          // Cleanable의 인스턴스인지 확인
          if (objectRef instanceof Cleanable) {
            // Food 객체인 경우 STALE 상태일 때만 청소 가능하도록
            if (objectRef.constructor.name === "Food") {
              // biome-ignore lint/suspicious/noExplicitAny: <explanation>
              const food = objectRef as any; // Food로 캐스팅하기 위한 any 타입 사용
              if (food.getFreshness && food.getFreshness() === 2) {
                // FoodFreshness.STALE = 2
                this.cleanableObjects.push(objectRef);
              }
            } else {
              // Food가 아닌 경우 바로 추가 (Poob 등)
              this.cleanableObjects.push(objectRef);
            }
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
        "청소 가능한 객체가 없습니다. Poob 객체나 상한 음식이 제대로 생성되었는지 확인하세요."
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

      // 빗자루 위치 업데이트
      const newX = targetPos.x + offsetX;
      this.broom.setPosition(newX, targetPos.y - 5);
    }

    // 슬라이더 값의 변화량 계산 (절대값)
    const change = Math.abs(sliderValue - this.previousSliderValue);

    // 슬라이더가 이동한 경우에만 처리 (아주 작은 변경은 무시)
    if (change > 0.001 && this.cleaningState === CleaningState.CLEANING) {
      // 총 슬라이더 이동 거리에 현재 변화량 추가
      this.totalSliderMovement += change;

      // 진행도를 0-1 사이로 정규화 (4.0이 100%)
      this.currentProgress = Math.min(
        this.totalSliderMovement / this.targetSliderMovement,
        1
      );

      // 현재 청소 가능한 객체의 청소 진행도 업데이트
      const currentCleanable =
        this.cleanableObjects[this.currentCleanableIndex];
      if (currentCleanable) {
        const isComplete = currentCleanable.updateCleanProgress(
          this.currentProgress
        );

        if (
          this.totalSliderMovement >= this.targetSliderMovement ||
          isComplete
        ) {
          console.log(`현재 객체(${this.currentCleanableIndex}) 청소 완료!`);

          // 청소 완료된 객체의 테두리 제거
          this.removeCleanableBorderForObject(currentCleanable);

          this.currentProgress = 0;
          this.moveToNextCleanable();
        }
      }
    }

    // 현재 슬라이더 값을 이전 값으로 저장
    this.previousSliderValue = sliderValue;
  }

  /**
   * 슬라이더 입력 종료 처리
   */
  public handleSliderEnd(): void {
    // 모든 청소가 완료된 상태라면 청소 모드 비활성화
    if (this.allCleaningComplete) {
      console.log("슬라이더 입력 종료 감지됨. 청소 모드 비활성화");
      this.deactivate();
    }
  }

  /**
   * 현재 선택된 청소 가능한 객체로 이동
   * @private
   */
  private moveToCurrentCleanable(): void {
    if (
      this.currentCleanableIndex < 0 ||
      this.currentCleanableIndex >= this.cleanableObjects.length
    ) {
      return;
    }

    // 모든 이전 테두리를 제거 (청소가 완료된 객체의 테두리가 남지 않도록)
    this.removeCleanableBorders();

    // 아직 청소가 필요한 객체들의 테두리만 생성
    for (
      let i = this.currentCleanableIndex;
      i < this.cleanableObjects.length;
      i++
    ) {
      const cleanable = this.cleanableObjects[i];

      // 현재 선택된 객체는 핑크색, 나머지는 흰색으로 테두리 생성
      const color = i === this.currentCleanableIndex ? 0xff69b4 : 0xffffff;
      const bringToFront = i === this.currentCleanableIndex;

      this.createBorderForCleanable(cleanable, color, bringToFront);

      // 현재 선택된 객체의 zIndex를 높게 설정
      if (i === this.currentCleanableIndex) {
        const sprite = cleanable.getSprite();
        if (sprite) {
          sprite.zIndex = 100;
        }
      }
    }

    // 현재 객체를 맨 앞으로 가져오기
    this.bringCurrentCleanableToFront();

    // 청소 상태를 CLEANING으로 변경
    this.cleaningState = CleaningState.CLEANING;
    this.currentProgress = 0;

    // 새 객체로 이동할 때마다 총 이동 거리 초기화
    this.totalSliderMovement = 0;
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

      // 모든 청소 완료 플래그 설정
      this.allCleaningComplete = true;

      // 빗자루는 즉시 제거 (슬라이더에서 손을 떼기 전에도)
      if (this.broom) {
        this.parent.removeChild(this.broom.getSprite());
        this.broom.destroy();
        this.broom = null;
      }

      // 완료 콜백은 deactivate 시에 호출하도록 변경
      return;
    }

    // 다음 청소 대상으로 이동
    this.moveToCurrentCleanable();
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
    // 점선 테두리 제거
    this.removeCleanableBorders();

    // 빗자루 제거
    if (this.broom) {
      this.broom.destroy(); // 빗자루 리소스 정리
      this.broom = null;
    }

    // 이벤트 구독 해제
    this.eventBus.off(EventTypes.POOB_CREATED);
  }

  /**
   * 점선을 그리는 헬퍼 함수
   * @param graphics PIXI.Graphics 객체
   * @param x1 시작 x 좌표
   * @param y1 시작 y 좌표
   * @param x2 끝 x 좌표
   * @param y2 끝 y 좌표
   * @param dash 점선 길이
   * @param gap 점선 간격
   */
  private drawDashedLine(
    graphics: PIXI.Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dash: number,
    gap: number
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const dashGap = dash + gap;
    const steps = Math.floor(len / dashGap);
    const dashDx = (dx / len) * dash;
    const dashDy = (dy / len) * dash;
    const gapDx = (dx / len) * gap;
    const gapDy = (dy / len) * gap;

    let px = x1;
    let py = y1;

    for (let i = 0; i < steps; i++) {
      graphics.moveTo(px, py);
      graphics.lineTo(px + dashDx, py + dashDy);
      px += dashDx + gapDx;
      py += dashDy + gapDy;
    }

    graphics.moveTo(px, py);
    graphics.lineTo(x2, y2);
  }
}

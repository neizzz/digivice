import * as PIXI from "pixi.js";
import type { Cleanable } from "../interfaces/Cleanable";
import { Poob } from "../entities/Poob";
import type { Character } from "../entities/Character";

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
  character?: Character; // 캐릭터 객체 추가
  charactersContainer?: PIXI.Container; // 캐릭터가 있는 컨테이너 (선택 사항)
  onCleaningComplete?: () => void; // 모든 청소가 완료됐을 때 호출할 콜백
}

/**
 * 청소 관리자 클래스
 * 청소 가능한 객체들을 관리하고, 슬라이더 값을 이용해 순차적으로 청소를 진행합니다.
 */
export class CleaningManager {
  private app: PIXI.Application;
  private parent: PIXI.Container;
  private character?: Character; // 캐릭터 참조 추가
  private charactersContainer?: PIXI.Container;
  private cleanableObjects: Cleanable[] = [];
  private currentCleanableIndex = -1;
  private cleaningState: CleaningState = CleaningState.INACTIVE;
  private previousSliderValue = 0;
  private currentProgress = 0;
  private onCleaningComplete?: () => void;

  // 빗자루 위치 표시용 스프라이트
  private broomIndicator?: PIXI.Sprite;

  /**
   * @param options 청소 관리자 옵션
   */
  constructor(options: CleaningManagerOptions) {
    this.app = options.app;
    this.parent = options.parent;
    this.character = options.character; // 캐릭터 참조 설정
    this.charactersContainer = options.charactersContainer;
    this.onCleaningComplete = options.onCleaningComplete;

    // 빗자루 위치 표시 스프라이트 초기화
    this.initBroomIndicator();
  }

  /**
   * 빗자루 위치 표시 스프라이트 초기화
   */
  private initBroomIndicator(): void {
    // 간단한 빗자루 모양의 그래픽 생성
    const graphics = new PIXI.Graphics();
    graphics.beginFill(0xffffff, 0.6);
    graphics.drawCircle(0, 0, 10);
    graphics.endFill();

    const texture = this.app.renderer.generateTexture(graphics);
    this.broomIndicator = new PIXI.Sprite(texture);
    this.broomIndicator.anchor.set(0.5);
    this.broomIndicator.visible = false;
    this.broomIndicator.zIndex = 1000; // 다른 요소들보다 위에 표시

    this.parent.addChild(this.broomIndicator);
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
    } else {
      console.log("청소할 객체가 없습니다.");
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

    // 빗자루 표시 숨기기
    if (this.broomIndicator) {
      this.broomIndicator.visible = false;
    }
  }

  /**
   * 씬(또는 월드)에서 청소 가능한 객체들을 찾아 배열에 추가
   */
  private findCleanableObjects(): void {
    this.cleanableObjects = [];

    // Food와 Poob 객체를 모두 찾아서 배열에 추가
    for (const child of this.parent.children) {
      // instanceof 대신 타입 확인을 통해 Cleanable 인터페이스 구현 여부 확인
      if (
        "updateCleanProgress" in child &&
        "finishCleaning" in child &&
        "getPosition" in child
      ) {
        this.cleanableObjects.push(child as unknown as Cleanable);
      }
    }

    // 청소 가능한 객체의 수 로그 출력
    console.log(`찾은 청소 가능한 객체: ${this.cleanableObjects.length}개`);
  }

  /**
   * 슬라이더 값 변경 처리
   * @param sliderValue 0-100 범위의 슬라이더 값
   */
  public handleSliderValueChange(sliderValue: number): void {
    // 청소 모드가 활성화되지 않았으면 무시
    if (
      this.cleaningState === CleaningState.INACTIVE ||
      this.currentCleanableIndex < 0 ||
      this.currentCleanableIndex >= this.cleanableObjects.length
    ) {
      return;
    }

    // 슬라이더 값의 변화량 계산 (절대값)
    const change = Math.abs(sliderValue - this.previousSliderValue);
    this.previousSliderValue = sliderValue;

    // 청소 상태가 CLEANING이면 현재 객체 청소 진행
    if (this.cleaningState === CleaningState.CLEANING) {
      // 변화량에 비례해 진행도 증가 (작은 변화에도 반응하도록 계수 조정)
      this.currentProgress += change * 0.01;

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

    // 빗자루 위치 업데이트 (슬라이더 값에 따라 약간의 움직임 추가)
    this.updateBroomPosition(sliderValue);
  }

  /**
   * 빗자루 위치 업데이트
   * @param sliderValue 슬라이더 값
   */
  private updateBroomPosition(sliderValue: number): void {
    if (!this.broomIndicator || this.currentCleanableIndex < 0) {
      return;
    }

    // 현재 청소 중인 객체의 위치 가져오기
    const currentCleanable = this.cleanableObjects[this.currentCleanableIndex];
    const position = currentCleanable.getPosition();

    // 슬라이더 값에 따라 약간의 움직임 추가 (원 운동)
    const angle = (sliderValue / 100) * Math.PI * 2;
    const radius = 15; // 움직임 반경
    const offsetX = Math.cos(angle) * radius;
    const offsetY = Math.sin(angle) * radius;

    // 빗자루 위치 설정
    this.broomIndicator.position.set(
      position.x + offsetX,
      position.y + offsetY
    );
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

    // 빗자루 표시를 객체 위치로 이동
    if (this.broomIndicator) {
      this.broomIndicator.visible = true;
      this.broomIndicator.position.set(position.x, position.y);
    }

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

      // 빗자루 표시 숨기기
      if (this.broomIndicator) {
        this.broomIndicator.visible = false;
      }

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
   * 랜덤 위치에 더미(Poob) 객체 생성 (테스트용)
   * @param count 생성할 객체 수
   */
  public createDummyCleanableObjects(count = 3): void {
    if (this.character) {
      // 캐릭터가 있는 경우, 캐릭터 위치 기준으로 Poob 생성
      for (let i = 0; i < count; i++) {
        const poob = new Poob(this.app, this.parent, {
          character: this.character,
          offsetDistance: 70 + i * 20, // 약간씩 간격 벌리기
        });
      }
      console.log(
        `${count}개의 Poob 객체가 캐릭터 위치 기준으로 생성되었습니다.`
      );
    } else {
      // 캐릭터가 없는 경우, 랜덤 위치에 생성
      for (let i = 0; i < count; i++) {
        const poob = new Poob(this.app, this.parent);
      }
      console.log(`${count}개의 Poob 객체가 랜덤 위치에 생성되었습니다.`);
    }
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
   * 리소스 정리
   */
  public destroy(): void {
    // 빗자루 표시 제거
    if (this.broomIndicator) {
      if (this.broomIndicator.parent) {
        this.broomIndicator.parent.removeChild(this.broomIndicator);
      }
      this.broomIndicator.destroy();
      this.broomIndicator = undefined;
    }
  }
}

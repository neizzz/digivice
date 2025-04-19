/**
 * SliderController - 요소에 슬라이더 기능을 제공하는 컨트롤러 클래스
 */
export interface SliderOptions {
  // 슬라이더 값이 변경될 때 호출될 콜백 함수
  onChange?: (value: number) => void;

  // 초기 슬라이더 값 (기본값: 0.5)
  initialValue?: number;

  // 드래그 시작 시 호출될 콜백 함수
  onDragStart?: () => void;

  // 드래그 종료 시 호출될 콜백 함수
  onDragEnd?: () => void;
}

export class SliderController {
  private element: HTMLElement;
  private options: Required<SliderOptions>;
  private isDragging = false;
  private currentValue: number;

  // 포인터 다운 위치 오프셋 저장 변수
  private pointerOffsetX = Number.NaN;
  private startValue = Number.NaN;

  // 이벤트 핸들러 참조 보관 (제거를 위해)
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundPointerDown: (e: PointerEvent) => void;

  /**
   * SliderController 생성자
   * @param element 슬라이더 기능을 적용할 DOM 요소
   * @param options 슬라이더 설정 옵션
   */
  constructor(element: HTMLElement, options: SliderOptions = {}) {
    this.element = element;

    // 기본 옵션과 사용자 옵션 병합
    this.options = {
      onChange: options.onChange || (() => {}),
      initialValue: options.initialValue ?? 0.5,
      onDragStart: options.onDragStart || (() => {}),
      onDragEnd: options.onDragEnd || (() => {}),
    };

    // 초기값 설정
    this.currentValue = this.clamp(this.options.initialValue);

    // 이벤트 핸들러 바인딩 (나중에 제거할 수 있도록 참조 저장)
    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);

    // 이벤트 리스너 연결
    this.element.addEventListener("pointerdown", this.boundPointerDown);

    // 요소에 스타일 적용
    this.element.style.touchAction = "none"; // 브라우저 기본 터치 액션 방지
    this.element.style.userSelect = "none"; // 텍스트 선택 방지
  }

  /**
   * pointerdown 이벤트 핸들러: 드래그 시작
   */
  private handlePointerDown(e: PointerEvent): void {
    // 이벤트 전파 중단
    e.preventDefault();

    // 포인터 캡처 설정 (요소 외부로 이동해도 이벤트 추적)
    this.element.setPointerCapture(e.pointerId);

    this.pointerOffsetX = e.pageX;
    this.startValue = this.currentValue;

    // 드래그 시작
    this.isDragging = true;
    // 드래그 시작 콜백 호출
    this.options.onDragStart();

    document.addEventListener("pointermove", this.boundPointerMove);
    document.addEventListener("pointerup", this.boundPointerUp);
  }

  /**
   * pointermove 이벤트 핸들러: 슬라이더 값 업데이트
   */
  private handlePointerMove(e: PointerEvent): void {
    if (!this.isDragging) return;

    // 이벤트 전파 중단
    e.preventDefault();

    // 현재 포인터 위치에 따른 값 업데이트
    this.updateValueFromPosition(e);
  }

  /**
   * pointerup 이벤트 핸들러: 드래그 종료
   */
  private handlePointerUp(e: PointerEvent): void {
    // 이벤트 전파 중단
    e.preventDefault();

    // 포인터 캡처 해제
    if (this.element.hasPointerCapture(e.pointerId)) {
      this.element.releasePointerCapture(e.pointerId);
    }

    // 드래그 종료
    this.isDragging = false;
    // 드래그 종료 콜백 호출
    this.options.onDragEnd();

    this.updateValueFromPosition(e);

    // 전역 이벤트 리스너 제거
    document.removeEventListener("pointermove", this.boundPointerMove);
    document.removeEventListener("pointerup", this.boundPointerUp);
  }

  /**
   * 포인터 위치에 따라 슬라이더 값을 업데이트 (X축만 고려)
   */
  private updateValueFromPosition(e: PointerEvent): void {
    const rect = this.element.getBoundingClientRect();

    // 수평 슬라이더: X축 위치 사용 (오프셋 반영)
    const adjustedX = e.pageX - this.pointerOffsetX;

    let percentage = this.startValue + adjustedX / rect.width;

    // 0-1 범위로 제한
    percentage = Math.max(0, Math.min(1, percentage));

    // 값 변경 시에만 콜백 호출
    if (percentage !== this.currentValue) {
      this.currentValue = percentage;
      this.options.onChange(percentage);
    }
  }

  /**
   * 현재 슬라이더 값 가져오기
   */
  public getValue(): number {
    return this.currentValue;
  }

  /**
   * 슬라이더 값 설정하기
   */
  public setValue(value: number): void {
    const newValue = this.clamp(value);
    if (newValue !== this.currentValue) {
      this.currentValue = newValue;
      this.options.onChange(newValue);
    }
  }

  /**
   * 값을 0-1 범위 내로 제한
   */
  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  /**
   * SliderController 정리: 이벤트 리스너 제거
   */
  public dispose(): void {
    // 이벤트 리스너 제거
    this.element.removeEventListener("pointerdown", this.boundPointerDown);
    document.removeEventListener("pointermove", this.boundPointerMove);
    document.removeEventListener("pointerup", this.boundPointerUp);
  }
}

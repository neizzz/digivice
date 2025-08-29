/**
 * 범용적인 객체 저장소 클래스
 * ECS 시스템에서 객체(스프라이트, 애니메이션 등)를 효율적으로 관리하기 위한 클래스
 *
 * 단순화된 버전: eid를 직접 인덱스로 사용
 */
export class ObjectStore<T> {
  private store: (T | null)[];
  private readonly name: string;

  constructor(name: string = "ObjectStore") {
    this.store = [];
    this.name = name;
  }

  /**
   * 특정 인덱스(eid)에 객체를 저장
   * @param index 저장할 인덱스 (보통 eid)
   * @param obj 저장할 객체
   */
  set(index: number, obj: T): void {
    // 배열 크기를 필요한 만큼 확장
    while (this.store.length <= index) {
      this.store.push(null);
    }

    this.store[index] = obj;
    console.log(`[${this.name}] Set object at index ${index}`);
  }

  /**
   * 인덱스로 객체 가져오기
   * @param index 객체 인덱스
   * @returns 객체 또는 undefined
   */
  get(index: number): T | undefined {
    if (index < 0 || index >= this.store.length) {
      return undefined;
    }

    const item = this.store[index];
    return item !== null ? item : undefined;
  }

  /**
   * 객체 제거
   * @param index 제거할 객체의 인덱스
   * @returns 제거된 객체 또는 undefined
   */
  remove(index: number): T | undefined {
    if (index < 0 || index >= this.store.length) {
      return undefined;
    }

    const item = this.store[index];
    if (item !== null) {
      this.store[index] = null;
      console.log(`[${this.name}] Removed object from index ${index}`);
      return item;
    }

    return undefined;
  }

  /**
   * 특정 인덱스에 객체가 존재하는지 확인
   * @param index 확인할 인덱스
   * @returns 객체 존재 여부
   */
  has(index: number): boolean {
    if (index < 0 || index >= this.store.length) {
      return false;
    }
    return this.store[index] !== null;
  }

  /**
   * 저장소의 현재 크기 (전체 슬롯 수)
   * @returns 전체 슬롯 수
   */
  get size(): number {
    return this.store.length;
  }

  /**
   * 실제 저장된 객체 수 (null이 아닌 객체들)
   * @returns 유효한 객체 수
   */
  get count(): number {
    return this.store.filter((item) => item !== null).length;
  }

  /**
   * 저장소 초기화 (모든 객체 제거)
   */
  clear(): void {
    console.log(`[${this.name}] Clearing store (${this.count} objects)`);
    this.store = [];
  }

  /**
   * 모든 유효한 객체에 대해 함수 실행
   * @param callback 각 객체에 대해 실행할 함수
   */
  forEach(callback: (obj: T, index: number) => void): void {
    for (let i = 0; i < this.store.length; i++) {
      const item = this.store[i];
      if (item !== null) {
        callback(item, i);
      }
    }
  }
}

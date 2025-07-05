import { v4 as uuidv4 } from "uuid";

/**
 * UUID v4를 기반으로 고유 ID를 생성합니다.
 * @param prefix 접두사 (기본값: 'obj')
 * @returns 고유 ID 문자열 (prefix_uuid 형식)
 */
export function generateId(prefix = "obj"): string {
  const uuid = uuidv4();
  return `${prefix}_${uuid}`;
}

/**
 * 영속적인 숫자 ID를 생성합니다.
 * 게임 세션 간에 고유성을 보장하기 위해 타임스탬프와 카운터를 결합합니다.
 * @returns 고유한 숫자 ID
 */
export const generatePersistentNumericId = (() => {
  // 영속적인 숫자 ID 생성을 위한 카운터
  let _persistentIdCounter = 1;

  return () => {
    // 현재 시간 (밀리초)의 뒤 6자리 + 카운터 3자리
    const timestamp = Date.now();
    const counter = _persistentIdCounter % 1000; // 3자리 카운터
    _persistentIdCounter++;

    // 9자리 숫자로 조합 (timestamp 6자리 + counter 3자리)
    return timestamp * 1000 + counter;
  };
})();

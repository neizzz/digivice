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

/**
 * NOTE:
 * 재진입/오프라인 시뮬레이션은 현재 systems 폴더가 아니라
 * `MainScene/ReentrySimulator.ts`와 `world.ts`의 전용 파이프라인에서 관리한다.
 *
 * 이 파일은 과거 경로 호환성을 위한 shim이다.
 */
export { ReentrySimulator } from "../ReentrySimulator";

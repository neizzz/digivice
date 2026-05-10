import { ControlButtonType } from "..";

export type SceneRenderTimingSample = {
  timestampMs: number;
  deltaTimeMs: number;
  tickerGapMs: number | null;
  sceneUpdateCostMs: number;
  updateToRenderStartMs: number;
  renderCostMs: number;
  frameEndToEndCostMs: number;
};

export interface Scene {
  // name: string;
  init: () => void;
  update: (delta: number) => void;
  destroy: () => void;
  handleControlButtonClick: (buttonType: ControlButtonType) => void;
  handleSliderValueChange: (value: number /** 0.0 ~ 1.0 */) => void;
  handleSliderEnd: () => void;
  resize?: (width: number, height: number) => void;

  // Scene 생명주기 메서드들 (선택적 구현)
  onSceneExit?: () => void | Promise<void>; // Scene 종료 시 호출
  onSceneReenter?: () => Promise<void>; // Scene 재진입 시 호출
  onFrameRenderTiming?: (sample: SceneRenderTimingSample) => void;
}

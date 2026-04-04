import { ControlButtonType } from "..";

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
  onSceneExit?: () => void; // Scene 종료 시 호출
  onSceneReenter?: () => Promise<void>; // Scene 재진입 시 호출
}

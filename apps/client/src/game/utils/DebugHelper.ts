import * as PIXI from "pixi.js";

export class DebugHelper {
  private static debugContainers: Map<PIXI.DisplayObject, PIXI.Container> =
    new Map();
  private static updateFunctions: Map<PIXI.DisplayObject, Function> = new Map();
  private static enabled: boolean = false;
  private static app: PIXI.Application | null = null;

  /**
   * 디버그 헬퍼 초기화
   * @param app PIXI 애플리케이션
   */
  public static init(app: PIXI.Application): void {
    this.app = app;
    console.log("Debug helper initialized with app:", app);
  }

  /**
   * 디버그 시각화 활성화/비활성화
   * @param enabled 활성화 여부
   */
  public static setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`Debug visualization ${enabled ? "enabled" : "disabled"}`);

    this.debugContainers.forEach((container) => {
      container.visible = enabled;
    });
  }

  /**
   * 디버그 시각화 활성화 상태 확인
   * @returns 활성화 여부
   */
  public static isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 주어진 스프라이트에 대한 디버그 시각화 추가
   * @param target 대상 디스플레이 오브젝트(스프라이트, 컨테이너 등)
   * @param app PIXI 애플리케이션 인스턴스
   * @param parent 디버그 컨테이너가 추가될 부모 컨테이너
   */
  public static addDebugger(
    target: PIXI.DisplayObject,
    app: PIXI.Application,
    parent?: PIXI.Container
  ): void {
    if (!target) {
      console.error("Cannot add debugger: target is undefined");
      return;
    }

    console.log("Adding debugger for:", target);

    // 이미 해당 타겟에 디버거가 있으면 제거
    if (this.debugContainers.has(target)) {
      this.removeDebugger(target);
    }

    // 디버그 컨테이너 생성
    const debugContainer = new PIXI.Container();
    debugContainer.name = "DebugContainer";
    debugContainer.visible = this.enabled;

    // 부모 컨테이너가 지정되지 않으면 앱의 기본 스테이지에 추가
    if (!parent) {
      parent = app.stage;
    }

    parent.addChild(debugContainer);
    this.debugContainers.set(target, debugContainer);

    // 경계 상자 그리기
    const boundingBox = new PIXI.Graphics();
    boundingBox.name = "BoundingBox";
    debugContainer.addChild(boundingBox);

    // 정보 텍스트 추가
    const infoText = new PIXI.Text("Debug Info", {
      fontSize: 10,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2,
    });
    infoText.name = "InfoText";
    debugContainer.addChild(infoText);

    // 업데이트 함수 생성 및 등록
    const update = (deltaTime: number) => {
      if (!target || !target.parent) {
        console.log("Target no longer exists, removing debugger");
        this.removeDebugger(target);
        return;
      }

      try {
        // 실제 화면 위치 및 크기 계산
        const bounds = target.getBounds();

        // 경계 상자 업데이트
        boundingBox.clear();
        boundingBox.lineStyle(1, 0xff0000);
        boundingBox.drawRect(bounds.x, bounds.y, bounds.width, bounds.height);

        // 중심점 표시 (초록색 점)
        boundingBox.beginFill(0x00ff00);
        boundingBox.drawCircle(target.position.x, target.position.y, 3);
        boundingBox.endFill();

        // 디버그 정보 업데이트
        const objectName = target.name || "unnamed object";
        const info = [
          `Object: ${objectName}`,
          `Position: (${Math.round(target.position.x)}, ${Math.round(
            target.position.y
          )})`,
          `Size: ${Math.round(bounds.width)} x ${Math.round(bounds.height)}`,
          `Scale: (${target.scale.x.toFixed(2)}, ${target.scale.y.toFixed(2)})`,
          `Visible: ${target.visible}`,
          `Alpha: ${target.alpha.toFixed(2)}`,
        ];

        if ("anchor" in target) {
          info.push(
            `Anchor: (${(target as any).anchor.x.toFixed(2)}, ${(
              target as any
            ).anchor.y.toFixed(2)})`
          );
        }

        infoText.text = info.join("\n");
        infoText.position.set(bounds.x, bounds.y - infoText.height - 5);
      } catch (e) {
        console.error("Error updating debug visualization:", e);
      }
    };

    // 매 프레임마다 업데이트
    app.ticker.add(update);
    this.updateFunctions.set(target, update);

    console.log(
      `Debug visualization added for ${target.name || "unnamed object"}`
    );
  }

  /**
   * 디버그 시각화 제거
   * @param target 디버그 시각화를 제거할 대상
   */
  public static removeDebugger(target: PIXI.DisplayObject): void {
    const debugContainer = this.debugContainers.get(target);
    if (debugContainer) {
      // 업데이트 함수 제거
      const updateFunc = this.updateFunctions.get(target);
      if (updateFunc && this.app) {
        this.app.ticker.remove(updateFunc);
        this.updateFunctions.delete(target);
      }

      // 컨테이너 제거
      if (debugContainer.parent) {
        debugContainer.parent.removeChild(debugContainer);
      }

      this.debugContainers.delete(target);
    }
  }

  /**
   * 모든 디버깅 시각화 제거
   */
  public static removeAll(): void {
    this.debugContainers.forEach((_, target) => {
      this.removeDebugger(target);
    });
    this.debugContainers.clear();
    this.updateFunctions.clear();
  }
}

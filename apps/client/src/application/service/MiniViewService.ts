import { MiniViewControlPort } from "../port/out/MiniViewControlPort";

export class MiniViewService {
  private miniViewControlPort: MiniViewControlPort;

  constructor(miniViewControlPort: MiniViewControlPort) {
    this.miniViewControlPort = miniViewControlPort;
  }

  /**
   * 미니뷰 모드로 전환
   */
  public enterMiniViewMode(): Promise<void> {
    return Promise.resolve(this.miniViewControlPort.enterMiniViewMode());
  }

  /**
   * 미니뷰 모드 종료
   */
  public exitMiniViewMode(): Promise<void> {
    return Promise.resolve(this.miniViewControlPort.exitMiniViewMode());
  }
}

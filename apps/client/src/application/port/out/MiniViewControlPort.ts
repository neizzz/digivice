export interface MiniViewControlPort {
  enterMiniViewMode(): Promise<void> | void;
  exitMiniViewMode(): Promise<void> | void;
}

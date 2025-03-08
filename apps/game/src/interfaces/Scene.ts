export interface Scene {
  update(deltaTime: number): void;
  onResize(width: number, height: number): void;
}

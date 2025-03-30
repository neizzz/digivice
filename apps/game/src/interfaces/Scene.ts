import type { ControlButtonType } from "../ui/types";

export interface Scene {
	update(deltaTime: number): void;
	onResize(width: number, height: number): void;
	handleControlButtonClick(buttonType: ControlButtonType): void;
	destroy(): void;
}

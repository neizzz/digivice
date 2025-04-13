import type * as PIXI from "pixi.js";

export interface SpriteFrame {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface SpriteAnimation {
	name: string;
	frames: SpriteFrame[];
	frameRate: number;
	loop?: boolean;
}

export interface SpriteMetadata {
	id: string;
	name: string;
	image: string;
	width: number;
	height: number;
	animations: SpriteAnimation[];
	defaultAnimation?: string;
}

// PixiJS에서 사용할 추가 타입들
export interface TextureMap {
	[animationName: string]: PIXI.Texture[];
}

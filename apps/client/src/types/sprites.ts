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
}

export interface SpriteMetadata {
  id: string;
  name: string;
  image: string;
  width: number;
  height: number;
  animations: SpriteAnimation[];
}

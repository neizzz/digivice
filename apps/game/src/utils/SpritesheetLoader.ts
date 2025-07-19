import * as PIXI from "pixi.js";

/**
 * 단일 스프라이트시트를 로드하고 파싱하는 유틸리티 함수들
 */

export interface LoadSpritesheetOptions {
  /** 스프라이트시트 JSON 파일 경로 */
  jsonPath: string;
  /** PIXI Assets에서 사용할 별칭 */
  alias?: string;
  /** 픽셀 아트 스타일인 경우 true (nearest 스케일 모드 사용) */
  pixelArt?: boolean;
  /** 로딩 타임아웃 (밀리초) */
  timeout?: number;
}

export interface SpritesheetLoadResult {
  /** 로드된 스프라이트시트 */
  spritesheet: PIXI.Spritesheet;
  /** 사용된 별칭 */
  alias: string;
  /** 사용 가능한 애니메이션 목록 */
  animations: string[];
  /** 사용 가능한 텍스처 목록 */
  textures: string[];
}

/**
 * 단일 스프라이트시트를 로드하고 파싱합니다.
 *
 * @param options - 로드 옵션
 * @returns 로드 결과 또는 null (실패시)
 */
export async function loadSpritesheet(
  options: LoadSpritesheetOptions
): Promise<SpritesheetLoadResult | null> {
  const { jsonPath, alias, pixelArt = false, timeout = 10000 } = options;

  try {
    console.log(`[SpritesheetLoader] Loading spritesheet: ${jsonPath}`);

    // 타임아웃 처리를 위한 AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // 1. JSON 파일 로드
      const response = await fetch(jsonPath, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${jsonPath}: ${response.statusText}`);
      }

      const spritesheetData = await response.json();
      const imagePath = spritesheetData.meta?.image;

      if (!imagePath) {
        throw new Error(`No image path found in spritesheet data: ${jsonPath}`);
      }

      // 2. 이미지 텍스처 로드
      const loadAlias = alias || `spritesheet_${Date.now()}`;
      const texture = await PIXI.Assets.load({
        alias: loadAlias,
        src: imagePath,
      });

      // 3. 스프라이트시트 생성
      const spritesheet = new PIXI.Spritesheet(texture, spritesheetData);

      // 픽셀 아트 설정
      if (pixelArt && spritesheet.textureSource) {
        spritesheet.textureSource.scaleMode = "nearest";
      }

      // 4. 스프라이트시트 파싱
      await spritesheet.parse();

      clearTimeout(timeoutId);

      // 5. 결과 정리
      const animations = Object.keys(spritesheet.animations || {});
      const textures = Object.keys(spritesheet.textures || {});

      console.log(`[SpritesheetLoader] Successfully loaded: ${jsonPath}`);
      console.log(`[SpritesheetLoader] - Animations: ${animations.join(", ")}`);
      console.log(`[SpritesheetLoader] - Textures: ${textures.join(", ")}`);

      return {
        spritesheet,
        alias: loadAlias,
        animations,
        textures,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error(
        `[SpritesheetLoader] Timeout loading spritesheet: ${jsonPath}`
      );
    } else {
      console.error(
        `[SpritesheetLoader] Failed to load spritesheet ${jsonPath}:`,
        error
      );
    }
    return null;
  }
}

/**
 * 여러 스프라이트시트를 병렬로 로드합니다.
 *
 * @param spritesheets - 로드할 스프라이트시트 설정 배열
 * @returns 성공적으로 로드된 스프라이트시트 결과 배열
 */
export async function loadSpritesheets(
  spritesheets: LoadSpritesheetOptions[]
): Promise<SpritesheetLoadResult[]> {
  console.log(
    `[SpritesheetLoader] Loading ${spritesheets.length} spritesheets in parallel...`
  );

  const loadPromises = spritesheets.map((options) => loadSpritesheet(options));
  const results = await Promise.all(loadPromises);

  // null 결과 필터링
  const successfulResults = results.filter(
    (result): result is SpritesheetLoadResult => result !== null
  );

  console.log(
    `[SpritesheetLoader] Successfully loaded ${successfulResults.length}/${spritesheets.length} spritesheets`
  );

  return successfulResults;
}

/**
 * 이미 로드된 스프라이트시트에서 특정 애니메이션의 텍스처를 가져옵니다.
 *
 * @param spritesheet - 스프라이트시트
 * @param animationName - 애니메이션 이름
 * @returns 애니메이션 텍스처 배열 또는 null
 */
export function getAnimationTextures(
  spritesheet: PIXI.Spritesheet,
  animationName: string
): PIXI.Texture[] | null {
  if (!spritesheet.animations || !spritesheet.animations[animationName]) {
    console.warn(
      `[SpritesheetLoader] Animation '${animationName}' not found in spritesheet`
    );
    return null;
  }

  return spritesheet.animations[animationName];
}

/**
 * 이미 로드된 스프라이트시트에서 특정 텍스처를 가져옵니다.
 *
 * @param spritesheet - 스프라이트시트
 * @param textureName - 텍스처 이름
 * @returns 텍스처 또는 null
 */
export function getTexture(
  spritesheet: PIXI.Spritesheet,
  textureName: string
): PIXI.Texture | null {
  if (!spritesheet.textures || !spritesheet.textures[textureName]) {
    console.warn(
      `[SpritesheetLoader] Texture '${textureName}' not found in spritesheet`
    );
    return null;
  }

  return spritesheet.textures[textureName];
}

/**
 * 스프라이트시트 정보를 출력합니다 (디버깅용).
 *
 * @param spritesheet - 스프라이트시트
 * @param alias - 별칭
 */
// export function debugSpritesheetInfo(
//   spritesheet: PIXI.Spritesheet,
//   alias?: string
// ): void {
//   const info = {
//     alias: alias || 'Unknown',
//     textureCount: Object.keys(spritesheet.textures || {}).length,
//     animationCount: Object.keys(spritesheet.animations || {}).length,
//     textures: Object.keys(spritesheet.textures || {}),
//     animations: Object.keys(spritesheet.animations || {}),
//     baseTexture: {
//       width: spritesheet.textureSource?.width || 0,
//       height: spritesheet.textureSource?.height || 0,
//       scaleMode: spritesheet.textureSource?.scaleMode || 'unknown'
//     }
//   };

//   console.group(`[SpritesheetLoader] Spritesheet Info: ${info.alias}`);
//   console.log('Texture Count:', info.textureCount);
//   console.log('Animation Count:', info.animationCount);
//   console.log('Base Texture Size:', `${info.baseTexture.width}x${info.baseTexture.height}`);
//   console.log('Scale Mode:', info.baseTexture.scaleMode);

//   if (info.textures.length > 0) {
//     console.log('Available Textures:', info.textures);
//   }

//   if (info.animations.length > 0) {
//     console.log('Available Animations:', info.animations);
//   }

//   console.groupEnd();
// }

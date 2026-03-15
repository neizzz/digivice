import {
  defineQuery,
  hasComponent,
  addComponent,
  removeComponent,
} from "bitecs";
import { ObjectComp, PositionComp, GifAnimationComp } from "../raw-components";
import { MainSceneWorld } from "../world";
import { ObjectType, GifType } from "../types";
import * as PIXI from "pixi.js";

const gifAnimationQuery = defineQuery([
  ObjectComp,
  PositionComp,
  GifAnimationComp,
]);

// GIF 스프라이트를 직접 참조하기 위한 Map
const gifSpriteMap = new Map<number, any>();

// GIF 타입별 에셋 매핑
const GIF_ASSETS = {
  [GifType.RECOVERY]: "recovery",
};

// GIF 타입별 기본 지속시간 (ms)
const GIF_DURATIONS = {
  [GifType.RECOVERY]: 3000,
};

// GIF 타입별 루프 설정
const GIF_LOOP_SETTINGS = {
  [GifType.RECOVERY]: false, // 1회성 실행
};

// GIF 타입별 스케일 설정 (캐릭터 스케일에 대한 배율)
const GIF_SCALE_MULTIPLIERS = {
  [GifType.RECOVERY]: 1.0, // 기본 크기 (1배)
};

// GIF 타입별 Y 오프셋 설정 (픽셀 단위, 음수는 위쪽)
const GIF_Y_OFFSETS = {
  [GifType.RECOVERY]: -10, // 10px 위쪽
};

/**
 * GIF 애니메이션 시스템 (범용)
 * - 다양한 GIF를 캐릭터 위에 표시
 * - 애니메이션 완료 후 자동 제거
 * - stage가 null이면 렌더링은 스킵하고 상태만 업데이트 (시뮬레이션 모드)
 */
export function gifAnimationSystem(params: {
  world: MainSceneWorld;
  currentTime: number;
  stage: PIXI.Container | null;
}): typeof params {
  const { world, currentTime, stage } = params;
  const entities = gifAnimationQuery(world);

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    // 캐릭터가 아니면 건너뛰기
    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) continue;

    const gifComp = GifAnimationComp;

    // 애니메이션이 비활성화되었거나 만료되었으면 제거
    if (
      !gifComp.isActive[eid] ||
      currentTime >= gifComp.startTime[eid] + gifComp.duration[eid]
    ) {
      // 스프라이트 제거 (Map에서 직접 가져오기) - 렌더링 모드에서만
      if (stage) {
        const sprite = gifSpriteMap.get(eid);
        if (sprite) {
          // 애니메이션 정지 (가능한 경우)
          if (sprite.stop && typeof sprite.stop === "function") {
            sprite.stop();
          }
          stage.removeChild(sprite);
          sprite.destroy();
          gifSpriteMap.delete(eid);
        }
      }

      // 컴포넌트 제거
      removeComponent(world, GifAnimationComp, eid);
      continue;
    }

    // 1회성 애니메이션의 경우 완료 여부 확인
    const sprite = gifSpriteMap.get(eid);
    if (sprite) {
      // GIF 타입별 루프 설정 확인
      const animGifType = gifComp.gifType[eid] as GifType;
      const shouldLoop = GIF_LOOP_SETTINGS[animGifType] ?? true;

      // 1회성 애니메이션이고 완료되었다면 제거
      if (
        !shouldLoop &&
        sprite.currentFrame !== undefined &&
        sprite.totalFrames !== undefined
      ) {
        // 마지막 프레임에 도달했고 재생이 완료되었다면
        if (sprite.currentFrame >= sprite.totalFrames - 1 && !sprite.playing) {
          // 스프라이트 제거 - 렌더링 모드에서만
          if (stage) {
            if (sprite.stop && typeof sprite.stop === "function") {
              sprite.stop();
            }
            stage.removeChild(sprite);
            sprite.destroy();
            gifSpriteMap.delete(eid);
          }

          // 컴포넌트 제거
          removeComponent(world, GifAnimationComp, eid);
          continue;
        }
      }

      // 스프라이트 위치 업데이트 (캐릭터와 동일한 위치 + Y 오프셋) - 렌더링 모드에서만
      if (stage) {
        const currentGifType = gifComp.gifType[eid] as GifType;
        const yOffset = GIF_Y_OFFSETS[currentGifType] || 0;

        sprite.x = PositionComp.x[eid];
        sprite.y = PositionComp.y[eid] + yOffset;
      }
    }
  }

  return params;
}

/**
 * 캐릭터에게 GIF 애니메이션 시작
 */
export function startGifAnimation(
  world: MainSceneWorld,
  eid: number,
  stage: PIXI.Container | null,
  currentTime: number,
  gifType: GifType,
  customDuration?: number
): void {
  // 이미 GIF 애니메이션이 있다면 제거
  if (hasComponent(world, GifAnimationComp, eid)) {
    const existingSprite = gifSpriteMap.get(eid);
    if (existingSprite) {
      if (existingSprite.stop && typeof existingSprite.stop === "function") {
        existingSprite.stop();
      }
      if (stage) {
        stage.removeChild(existingSprite);
      }
      existingSprite.destroy();
      gifSpriteMap.delete(eid);
    }
    removeComponent(world, GifAnimationComp, eid);
  }

  // 시뮬레이션 모드에서는 스프라이트 생성과 렌더링을 건너뛰고 상태만 관리
  if (stage) {
    // GIF 타입에 맞는 에셋 이름 가져오기
    const assetName = GIF_ASSETS[gifType];
    if (!assetName) {
      console.error(`[GifAnimationSystem] Unknown gif type: ${gifType}`);
      return;
    }

    // 애니메이션 GIF 로드 (@pixi/gif로 로드된 객체)
    const animatedGif = PIXI.Assets.get(assetName);
    if (!animatedGif) {
      console.error(
        `[GifAnimationSystem] Animated GIF asset '${assetName}' not loaded`
      );
      console.log(
        `[GifAnimationSystem] Trying to get asset with name:`,
        assetName
      );
      console.log(
        `[GifAnimationSystem] Available assets in cache:`,
        PIXI.Assets.cache.has(assetName) ? "Found" : "Not found"
      );
      return;
    }

    // 캐릭터 크기에 맞춰 스케일 계산
    let characterScale = 1;

    // GIF 타입별 스케일 배율 적용
    const scaleMultiplier = GIF_SCALE_MULTIPLIERS[gifType] || 1.0;
    const finalScale = characterScale * scaleMultiplier;

    // GIF 타입별 Y 오프셋 적용
    const yOffset = GIF_Y_OFFSETS[gifType] || 0;

    // @pixi/gif로 로드된 애니메이션 GIF를 복제해서 사용
    const gifSprite = animatedGif.clone ? animatedGif.clone() : animatedGif;
    gifSprite.anchor.set(0.5);
    gifSprite.scale.set(finalScale);
    gifSprite.x = PositionComp.x[eid];
    gifSprite.y = PositionComp.y[eid] + yOffset;
    gifSprite.zIndex = gifSprite.y - 1; // 캐릭터보다 1낮은 값

    // 루프 설정 적용
    const shouldLoop = GIF_LOOP_SETTINGS[gifType] ?? true;
    if (gifSprite.loop !== undefined) {
      gifSprite.loop = shouldLoop;
    }

    // 애니메이션 시작 (GIF 자동 재생)
    if (gifSprite.play && typeof gifSprite.play === "function") {
      gifSprite.play();
    }

    // 스테이지에 추가
    stage.addChild(gifSprite);

    // Map에 스프라이트 저장
    gifSpriteMap.set(eid, gifSprite);
  }

  // 지속시간 결정 (커스텀 > 기본값)
  const duration = customDuration || GIF_DURATIONS[gifType] || 3000;

  // GIF 애니메이션 컴포넌트 추가
  addComponent(world, GifAnimationComp, eid);
  GifAnimationComp.storeIndex[eid] = eid; // eid를 직접 사용
  GifAnimationComp.startTime[eid] = currentTime;
  GifAnimationComp.duration[eid] = duration;
  GifAnimationComp.gifType[eid] = gifType;
  GifAnimationComp.isActive[eid] = 1;

  console.log(
    `[GifAnimationSystem] Started ${GifType[gifType]} animation for character ${eid}:`
  );
  console.log(`  - Duration: ${duration}ms`);
  console.log(`  - Mode: ${stage ? "Rendering" : "Simulation only"}`);
}

/**
 * Recovery 애니메이션 시작 (하위 호환성)
 */
export function startRecoveryAnimation(
  world: MainSceneWorld,
  eid: number,
  stage: PIXI.Container | null,
  currentTime: number
): void {
  startGifAnimation(world, eid, stage, currentTime, GifType.RECOVERY);
}

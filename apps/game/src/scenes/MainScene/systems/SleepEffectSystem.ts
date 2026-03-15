import { defineQuery } from "bitecs";
import {
  ObjectComp,
  PositionComp,
  RenderComp,
  AnimationRenderComp,
} from "../raw-components";
import { ObjectType, CharacterState } from "../types";
import { MainSceneWorld } from "../world";
import * as PIXI from "pixi.js";
import { Text } from "pixi.js";

// 수면 효과 관련 상수
const SLEEP_TEXT_STYLE = new PIXI.TextStyle({
  // fontFamily: 'Arial',
  fontFamily: "PressStart2P",
  fontSize: 24,
  fill: 0xffffff, // 흰색
  stroke: { color: 0x000000, width: 4 }, // 검은색 테두리
  fontWeight: "bold",
});

// 애니메이션 관련 상수
const FLOAT_AMPLITUDE = 4; // 위아래 움직임 폭 (줄임)
const ANIMATION_INTERVAL = 800; // 800ms마다 애니메이션 업데이트

// 수면 효과 스프라이트들을 저장하는 Map (각 캐릭터마다 z와 Z 두 개의 텍스트)
interface SleepEffect {
  z: PIXI.Text;
  Z: PIXI.Text;
  lastAnimationTime: number;
  currentAnimationState: number; // 0: z가 위, 1: Z가 위
}

const sleepEffectMap = new Map<number, SleepEffect>();

// 캐릭터들을 쿼리
const characterQuery = defineQuery([ObjectComp, PositionComp]);

/**
 * 수면 효과 시스템
 * 몬스터가 잘 때 z와 Z 텍스트를 따로 표시하고 800ms마다 위치를 바꾸는 애니메이션 효과를 적용
 */
export function sleepEffectSystem(params: {
  world: MainSceneWorld;
  delta: number;
  stage: PIXI.Container | null;
}): typeof params {
  const { world, stage } = params;

  // 시뮬레이션 모드에서는 스킵
  if (!stage) {
    return params;
  }

  const entities = characterQuery(world);
  const currentTime = Date.now();

  for (const eid of entities) {
    // 캐릭터 타입만 처리
    if (ObjectComp.type[eid] !== ObjectType.CHARACTER) {
      continue;
    }

    const isAsleep = _isCharacterAsleep(eid);
    const hasEffect = sleepEffectMap.has(eid);

    if (isAsleep && !hasEffect) {
      // 수면 상태이지만 효과가 없으면 생성
      _createSleepEffect(eid, stage, currentTime);
    } else if (!isAsleep && hasEffect) {
      // 깨어있지만 효과가 있으면 제거
      _removeSleepEffect(eid, stage);
    } else if (isAsleep && hasEffect) {
      // 수면 상태이고 효과가 있으면 애니메이션 업데이트
      _updateSleepEffectAnimation(eid, currentTime);
    }
  }

  return params;
}

/**
 * 캐릭터가 잠자는 상태인지 확인
 */
function _isCharacterAsleep(eid: number): boolean {
  return ObjectComp.state[eid] === CharacterState.SLEEPING;
}

/**
 * 캐릭터 스케일을 가져와서 텍스트 위치 오프셋 계산
 */
function _getCharacterSizeOffset(eid: number): {
  offsetY: number;
  offsetX: number;
} {
  // RenderComp에서 스케일 확인
  let scale = 1;
  if (RenderComp.scale && RenderComp.scale[eid]) {
    scale = RenderComp.scale[eid];
  }
  // AnimationRenderComp도 확인 (애니메이션 캐릭터의 경우)
  // 기본적으로 스케일에 비례해서 오프셋 계산
  const baseOffsetY = 20; // 기본 Y 오프셋
  const baseOffsetX = 8; // 기본 X 오프셋

  return {
    offsetY: baseOffsetY * scale,
    offsetX: baseOffsetX * scale,
  };
}

/**
 * 수면 효과 생성
 */
function _createSleepEffect(
  eid: number,
  stage: PIXI.Container,
  currentTime: number
): void {
  // z 텍스트 생성
  const zText = new Text({
    text: "z",
    style: SLEEP_TEXT_STYLE,
    anchor: { x: 0.5, y: 1 }, // 하단 중앙 기준
  });
  const ZText = new Text({
    text: "Z",
    style: SLEEP_TEXT_STYLE,
    anchor: { x: 0.5, y: 1 }, // 하단 중앙 기준
  });

  // 초기 위치 설정 (캐릭터 위쪽, 사이즈에 따라 조정)
  const characterX = PositionComp.x[eid];
  const characterY = PositionComp.y[eid];
  const sizeOffset = _getCharacterSizeOffset(eid);

  // z는 왼쪽, Z는 오른쪽에 배치 (캐릭터 사이즈에 맞춰 조정)
  zText.position.set(characterX, characterY);
  ZText.position.set(characterX, characterY - 10); // Z를 조금 더 위에

  // z-index 설정 (캐릭터보다 위에)
  zText.zIndex = characterY + 100;
  ZText.zIndex = characterY + 101;

  // 애니메이션용 커스텀 속성
  (zText as any).baseY = zText.position.y;
  (ZText as any).baseY = ZText.position.y;

  // 초기 투명도 설정 (z는 보이고, Z는 반투명)
  zText.alpha = 1.0;
  ZText.alpha = 0.6;

  // 스테이지에 추가
  stage.addChild(zText);
  stage.addChild(ZText);

  // 효과 저장
  const sleepEffect: SleepEffect = {
    z: zText,
    Z: ZText,
    lastAnimationTime: currentTime,
    currentAnimationState: 0, // 처음에는 z가 활성
  };

  sleepEffectMap.set(eid, sleepEffect);

  console.log(`[SleepEffectSystem] Created sleep effect for character ${eid}`);
}

/**
 * 수면 효과 제거
 */
function _removeSleepEffect(eid: number, stage: PIXI.Container): void {
  const sleepEffect = sleepEffectMap.get(eid);

  if (sleepEffect) {
    stage.removeChild(sleepEffect.z);
    stage.removeChild(sleepEffect.Z);
    sleepEffect.z.destroy();
    sleepEffect.Z.destroy();
    sleepEffectMap.delete(eid);

    console.log(
      `[SleepEffectSystem] Removed sleep effect for character ${eid}`
    );
  }
}

/**
 * 수면 효과 애니메이션 업데이트
 */
function _updateSleepEffectAnimation(eid: number, currentTime: number): void {
  const sleepEffect = sleepEffectMap.get(eid);

  if (!sleepEffect) {
    return;
  }

  // 800ms마다 애니메이션 상태 변경
  if (currentTime - sleepEffect.lastAnimationTime >= ANIMATION_INTERVAL) {
    sleepEffect.currentAnimationState = 1 - sleepEffect.currentAnimationState; // 0과 1 사이 토글
    sleepEffect.lastAnimationTime = currentTime;

    // 애니메이션 상태에 따라 위치와 투명도 변경
    if (sleepEffect.currentAnimationState === 0) {
      // z가 활성: z는 위로, Z는 아래로
      _moveTextUp(sleepEffect.z);
      _moveTextDown(sleepEffect.Z);
      sleepEffect.z.alpha = 1.0;
      sleepEffect.Z.alpha = 0.6;
    } else {
      // Z가 활성: Z는 위로, z는 아래로
      _moveTextUp(sleepEffect.Z);
      _moveTextDown(sleepEffect.z);
      sleepEffect.Z.alpha = 1.0;
      sleepEffect.z.alpha = 0.6;
    }
  }

  // 캐릭터 위치 동기화
  const characterX = PositionComp.x[eid];
  const characterY = PositionComp.y[eid];
  const sizeOffset = _getCharacterSizeOffset(eid);

  // z-index 업데이트 (캐릭터 이동에 따라)
  sleepEffect.z.zIndex = characterY + sizeOffset.offsetY;
  sleepEffect.Z.zIndex = characterY + sizeOffset.offsetY - 10;

  // 캐릭터 위치가 변경되었으면 텍스트 위치도 업데이트
  const newBaseYForZ = characterY;
  const newBaseYForZ2 = characterY - 10;

  if (Math.abs((sleepEffect.z as any).baseY - newBaseYForZ) > 1) {
    (sleepEffect.z as any).baseY = newBaseYForZ;
    (sleepEffect.Z as any).baseY = newBaseYForZ2;

    // 현재 위치 재계산
    sleepEffect.z.position.x = characterX - 10;
    sleepEffect.Z.position.x = characterX + 10;

    if (sleepEffect.currentAnimationState === 0) {
      sleepEffect.z.position.y = newBaseYForZ - FLOAT_AMPLITUDE;
      sleepEffect.Z.position.y = newBaseYForZ2;
    } else {
      sleepEffect.z.position.y = newBaseYForZ;
      sleepEffect.Z.position.y = newBaseYForZ2 - FLOAT_AMPLITUDE;
    }
  }
}

/**
 * 텍스트를 위로 이동
 */
function _moveTextUp(text: PIXI.Text): void {
  text.position.y = (text as any).baseY - FLOAT_AMPLITUDE;
}

/**
 * 텍스트를 아래로 이동 (원래 위치)
 */
function _moveTextDown(text: PIXI.Text): void {
  text.position.y = (text as any).baseY;
}

/**
 * 모든 수면 효과 정리 (시스템 종료 시 호출)
 */
export function cleanupSleepEffects(stage: PIXI.Container): void {
  for (const [, sleepEffect] of sleepEffectMap.entries()) {
    stage.removeChild(sleepEffect.z);
    stage.removeChild(sleepEffect.Z);
    sleepEffect.z.destroy();
    sleepEffect.Z.destroy();
  }
  sleepEffectMap.clear();

  console.log("[SleepEffectSystem] Cleaned up all sleep effects");
}

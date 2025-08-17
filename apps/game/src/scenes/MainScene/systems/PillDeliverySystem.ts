import {
  defineQuery,
  hasComponent,
  addComponent,
  removeEntity,
  addEntity,
} from "bitecs";
import {
  ObjectComp,
  PositionComp,
  SpeedComp,
  AngleComp,
  DestinationComp,
  RenderComp,
  CharacterStatusComp,
} from "../raw-components";
import {
  ObjectType,
  PillState,
  DestinationType,
  CharacterStatus,
  TextureKey,
} from "../types";
import { MainSceneWorld } from "../world";

const birdQuery = defineQuery([ObjectComp, PositionComp]);
const characterQuery = defineQuery([
  ObjectComp,
  CharacterStatusComp,
  PositionComp,
]);

// 배달 요청을 저장하는 큐
const deliveryQueue: Array<{
  targetCharacterEid: number;
  requestTime: number;
}> = [];

/**
 * 약 배달 시스템
 * - 약 메뉴 발동 시 bird가 화면 밖에서 나타나서 약을 배달
 * - 원근감 연출로 위에서 아래로 내려옴
 * - 약을 떨구고 다시 위로 날아감
 */
export function pillDeliverySystem(params: {
  world: MainSceneWorld;
  delta: number;
}): typeof params {
  const { world, delta } = params;

  // 배달 요청 처리
  processDeliveryQueue(world);

  // 배달 중인 bird들 업데이트
  updateDeliveringBirds(world, delta);

  return params;
}

/**
 * 약 배달 요청
 */
export function requestPillDelivery(targetCharacterEid: number): void {
  console.log(
    `[PillDeliverySystem] Pill delivery requested for character ${targetCharacterEid}`
  );

  deliveryQueue.push({
    targetCharacterEid,
    requestTime: Date.now(),
  });
}

/**
 * 배달 요청 큐 처리
 */
function processDeliveryQueue(world: MainSceneWorld): void {
  if (deliveryQueue.length === 0) return;

  // 현재 배달 중인 bird가 있는지 확인
  const birds = birdQuery(world);
  const isDelivering = birds.some(
    (eid) =>
      ObjectComp.type[eid] === ObjectType.BIRD &&
      hasComponent(world, DestinationComp, eid)
  );

  // 이미 배달 중이면 대기
  if (isDelivering) return;

  // 첫 번째 요청 처리
  const request = deliveryQueue.shift();
  if (!request) return;

  const { targetCharacterEid } = request;

  // 대상 캐릭터가 여전히 존재하고 아픈지 확인
  const characters = characterQuery(world);
  const targetExists = characters.some((eid) => eid === targetCharacterEid);

  if (!targetExists) {
    console.warn(
      `[PillDeliverySystem] Target character ${targetCharacterEid} no longer exists`
    );
    return;
  }

  // SICK 상태인지 확인
  const statuses = CharacterStatusComp.statuses[targetCharacterEid];
  let isSick = false;
  for (let i = 0; i < statuses.length; i++) {
    if (statuses[i] === CharacterStatus.SICK) {
      isSick = true;
      break;
    }
  }

  if (!isSick) {
    console.log(
      `[PillDeliverySystem] Character ${targetCharacterEid} is no longer sick, skipping delivery`
    );
    return;
  }

  // Bird 생성 및 배달 시작
  createDeliveryBird(world, targetCharacterEid);
}

/**
 * 배달용 Bird 생성
 */
function createDeliveryBird(
  world: MainSceneWorld,
  targetCharacterEid: number
): void {
  const targetX = PositionComp.x[targetCharacterEid];
  const targetY = PositionComp.y[targetCharacterEid];

  // 화면 경계 (임시로 800x600 가정)
  const screenWidth = 800;

  // 랜덤한 화면 밖 시작 위치 (위쪽에서)
  const startX = Math.random() * screenWidth;
  const startY = -100; // 화면 위쪽 밖에서 시작

  // Bird 엔티티 생성 (addEntity 사용)
  const birdEid = addEntity(world);

  // 기본 컴포넌트들
  addComponent(world, ObjectComp, birdEid);
  addComponent(world, PositionComp, birdEid);
  addComponent(world, SpeedComp, birdEid);
  addComponent(world, AngleComp, birdEid);
  addComponent(world, DestinationComp, birdEid);
  addComponent(world, RenderComp, birdEid);

  // 초기 설정
  ObjectComp.type[birdEid] = ObjectType.BIRD;
  ObjectComp.state[birdEid] = PillState.BEING_DELIVERED;

  PositionComp.x[birdEid] = startX;
  PositionComp.y[birdEid] = startY;

  SpeedComp.value[birdEid] = 0.15; // 배달 속도

  // 목표 지점 설정 (캐릭터 앞)
  DestinationComp.type[birdEid] = DestinationType.TARGETED;
  DestinationComp.target[birdEid] = targetCharacterEid;
  DestinationComp.x[birdEid] = targetX;
  DestinationComp.y[birdEid] = targetY - 30; // 캐릭터 약간 앞쪽

  // 방향 계산
  const directionX = DestinationComp.x[birdEid] - startX;
  const directionY = DestinationComp.y[birdEid] - startY;
  const angle = Math.atan2(directionY, directionX);
  AngleComp.value[birdEid] = angle;

  // 렌더링 설정 (원근감을 위해 작은 크기로 시작)
  RenderComp.textureKey[birdEid] = TextureKey.BIRD; // Bird 텍스처
  RenderComp.zIndex[birdEid] = 20; // 높은 z-index
  RenderComp.scale[birdEid] = 0.3; // 작은 크기로 시작 (원근감)

  console.log(
    `[PillDeliverySystem] Created delivery bird ${birdEid} for character ${targetCharacterEid}`
  );
  console.log(
    `[PillDeliverySystem] Start: (${startX}, ${startY}) -> Target: (${DestinationComp.x[birdEid]}, ${DestinationComp.y[birdEid]})`
  );
}

/**
 * 배달 중인 bird들 업데이트
 */
function updateDeliveringBirds(world: MainSceneWorld, delta: number): void {
  const birds = birdQuery(world);

  for (let i = 0; i < birds.length; i++) {
    const birdEid = birds[i];

    // Bird 타입이고 배달 중인지 확인
    if (ObjectComp.type[birdEid] !== ObjectType.BIRD) continue;
    if (!hasComponent(world, DestinationComp, birdEid)) continue;

    const state = ObjectComp.state[birdEid];

    if (state === PillState.BEING_DELIVERED) {
      updateDeliveryMovement(world, birdEid, delta);
    }
  }
}

/**
 * 배달 이동 업데이트
 */
function updateDeliveryMovement(
  world: MainSceneWorld,
  birdEid: number,
  delta: number
): void {
  const currentX = PositionComp.x[birdEid];
  const currentY = PositionComp.y[birdEid];
  const targetX = DestinationComp.x[birdEid];
  const targetY = DestinationComp.y[birdEid];

  // 목표까지의 거리 계산
  const distanceX = targetX - currentX;
  const distanceY = targetY - currentY;
  const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

  // 목표 지점 도달 확인
  if (distance < 10) {
    // 약 떨구기
    dropPill(world, birdEid);
    // Bird를 복귀 모드로 변경
    startBirdReturn(world, birdEid);
    return;
  }

  // 이동 계산
  const speed = SpeedComp.value[birdEid];
  const moveDistance = speed * delta;

  if (distance > 0) {
    const normalizedX = distanceX / distance;
    const normalizedY = distanceY / distance;

    // 실제 이동
    const actualMoveDistance = Math.min(moveDistance, distance);
    PositionComp.x[birdEid] = currentX + normalizedX * actualMoveDistance;
    PositionComp.y[birdEid] = currentY + normalizedY * actualMoveDistance;

    // 각도 업데이트
    const angle = Math.atan2(normalizedY, normalizedX);
    AngleComp.value[birdEid] = angle;

    // 원근감 연출 - 아래로 내려올수록 크기 증가
    const progress = Math.max(0, (currentY + 100) / 700); // -100에서 600까지
    const scale = 0.3 + progress * 0.4; // 0.3에서 0.7까지
    RenderComp.scale[birdEid] = scale;
  }
}

/**
 * 약 떨구기
 */
function dropPill(world: MainSceneWorld, birdEid: number): void {
  const birdX = PositionComp.x[birdEid];
  const birdY = PositionComp.y[birdEid];
  const targetCharacterEid = DestinationComp.target[birdEid];

  // Pill 엔티티 생성
  const pillEid = addEntity(world);

  addComponent(world, ObjectComp, pillEid);
  addComponent(world, PositionComp, pillEid);
  addComponent(world, RenderComp, pillEid);

  ObjectComp.type[pillEid] = ObjectType.PILL;
  ObjectComp.state[pillEid] = PillState.BEING_INTAKEN; // 바로 섭취 가능 상태

  PositionComp.x[pillEid] = birdX;
  PositionComp.y[pillEid] = birdY + 20; // Bird 아래쪽에 떨구기

  RenderComp.textureKey[pillEid] = TextureKey.PILL; // Pill 텍스처
  RenderComp.zIndex[pillEid] = 5;
  RenderComp.scale[pillEid] = 1.0;

  console.log(
    `[PillDeliverySystem] Dropped pill ${pillEid} at (${birdX}, ${
      birdY + 20
    }) for character ${targetCharacterEid}`
  );

  // 3초 후 약 자동 복용 (임시)
  setTimeout(() => {
    takePill(world, targetCharacterEid, pillEid);
  }, 3000);
}

/**
 * Bird 복귀 시작
 */
function startBirdReturn(world: MainSceneWorld, birdEid: number): void {
  // 랜덤한 화면 밖 복귀 지점 설정
  const screenWidth = 800;
  const randomX = Math.random() * screenWidth;
  const returnY = -150; // 화면 위쪽 더 높이

  DestinationComp.x[birdEid] = randomX;
  DestinationComp.y[birdEid] = returnY;
  DestinationComp.target[birdEid] = 0; // 타겟 해제

  SpeedComp.value[birdEid] = 0.2; // 복귀 시 더 빠르게

  // 상태 변경을 위한 임시 상태 (복귀 중)
  ObjectComp.state[birdEid] = 0; // 복귀 상태

  console.log(
    `[PillDeliverySystem] Bird ${birdEid} starting return to (${randomX}, ${returnY})`
  );

  // 복귀 이동 처리
  const returnInterval = setInterval(() => {
    const currentX = PositionComp.x[birdEid];
    const currentY = PositionComp.y[birdEid];

    // 복귀 지점 도달 또는 화면 밖으로 나갔는지 확인
    if (currentY < -100) {
      // Bird 제거
      removeEntity(world, birdEid);
      console.log(`[PillDeliverySystem] Bird ${birdEid} returned and removed`);
      clearInterval(returnInterval);
      return;
    }

    // 복귀 이동
    const distanceX = randomX - currentX;
    const distanceY = returnY - currentY;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

    if (distance > 1) {
      const normalizedX = distanceX / distance;
      const normalizedY = distanceY / distance;
      const moveDistance = 0.2 * 16; // 대략적인 delta 값

      PositionComp.x[birdEid] = currentX + normalizedX * moveDistance;
      PositionComp.y[birdEid] = currentY + normalizedY * moveDistance;

      // 원근감 연출 - 위로 올라갈수록 크기 감소
      const progress = Math.max(0, (600 - currentY) / 700);
      const scale = 0.7 - progress * 0.4; // 0.7에서 0.3까지
      RenderComp.scale[birdEid] = Math.max(0.1, scale);
    }
  }, 16); // ~60fps
}

/**
 * 약 복용
 */
function takePill(
  world: MainSceneWorld,
  characterEid: number,
  pillEid: number
): void {
  // 캐릭터가 여전히 존재하는지 확인
  const characters = characterQuery(world);
  const characterExists = characters.some((eid) => eid === characterEid);

  if (!characterExists) {
    console.warn(
      `[PillDeliverySystem] Character ${characterEid} no longer exists, removing pill`
    );
    removeEntity(world, pillEid);
    return;
  }

  // SICK 상태 제거
  const statuses = CharacterStatusComp.statuses[characterEid];
  for (let i = 0; i < statuses.length; i++) {
    if (statuses[i] === CharacterStatus.SICK) {
      statuses[i] = 0; // ECS_NULL_VALUE 대신 0 사용
      console.log(
        `[PillDeliverySystem] Removed SICK status from character ${characterEid}`
      );
      break;
    }
  }

  // 약 제거
  removeEntity(world, pillEid);
  console.log(
    `[PillDeliverySystem] Character ${characterEid} took pill ${pillEid} and recovered from sickness`
  );
}

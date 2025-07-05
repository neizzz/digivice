import {
  createWorld,
  addComponent,
  addEntity,
  defineComponent,
  defineQuery,
  Types,
  pipe,
  hasComponent,
  removeComponent,
} from "bitecs";

// --- 상수 및 전역 상태 ---
const MAP_WIDTH = 500;
const MAP_HEIGHT = 500;
const CHARACTER_SPEED = 120;
const MIN_ACTION_TIME = 1.0;
const MAX_ACTION_TIME = 3.0;

const inputState = {
  mouseX: 0,
  mouseY: 0,
  isMouseDown: false,
  wasMouseDownLastFrame: false,
};

// --- 컴포넌트 정의 ---
const Position = defineComponent({ x: Types.f32, y: Types.f32 });
const Velocity = defineComponent({ x: Types.f32, y: Types.f32 });
const ActionTimer = defineComponent({ timeLeft: Types.f32 });
const ActorState = defineComponent({ value: Types.ui8 });
const STATE = { IDLE: 0, MOVING: 1 };

// UI 이벤트용 컴포넌트
const Draggable = defineComponent();
const IsBeingDragged = defineComponent({
  offsetX: Types.f32,
  offsetY: Types.f32,
});

// --- 월드와 쿼리 생성 ---
const world = createWorld();
const characterQuery = defineQuery([
  Position,
  Velocity,
  ActorState,
  ActionTimer,
]);
const draggableQuery = defineQuery([Draggable, Position]);
const beingDraggedQuery = defineQuery([IsBeingDragged, Position]);

// --- 시스템 구현 ---

// 1. 입력 시스템 (드래그 시작/종료 처리)
const createInputSystem = () => (world) => {
  const draggables = draggableQuery(world);
  const beingDragged = beingDraggedQuery(world);

  // 마우스가 "방금" 눌렸을 때 드래그 시작
  if (inputState.isMouseDown && !inputState.wasMouseDownLastFrame) {
    for (const eid of draggables) {
      const dx = inputState.mouseX - Position.x[eid];
      const dy = inputState.mouseY - Position.y[eid];
      if (Math.sqrt(dx * dx + dy * dy) < 15) {
        // 15px 반경 안을 클릭했으면
        addComponent(world, IsBeingDragged, eid);
        IsBeingDragged.offsetX[eid] = Position.x[eid] - inputState.mouseX;
        IsBeingDragged.offsetY[eid] = Position.y[eid] - inputState.mouseY;

        // 드래그 중에는 움직이지 않도록 IDLE 상태로 만듦
        ActorState.value[eid] = STATE.IDLE;
        Velocity.x[eid] = 0;
        Velocity.y[eid] = 0;
        break; // 하나만 드래그
      }
    }
  }

  // 마우스가 "방금" 떼졌을 때 드래그 종료
  if (!inputState.isMouseDown && inputState.wasMouseDownLastFrame) {
    for (const eid of beingDragged) {
      removeComponent(world, IsBeingDragged, eid);
    }
  }

  inputState.wasMouseDownLastFrame = inputState.isMouseDown;
  return world;
};

// 2. 드래그 업데이트 시스템
const createDragUpdateSystem = () => (world) => {
  const ents = beingDraggedQuery(world);
  for (const eid of ents) {
    Position.x[eid] = inputState.mouseX + IsBeingDragged.offsetX[eid];
    Position.y[eid] = inputState.mouseY + IsBeingDragged.offsetY[eid];
  }
  return world;
};

// 3. 기존 행동/움직임 시스템 (드래그 중이 아닐 때만 동작하도록 수정)
const createBehaviorSystem = () => (world) => {
  const ents = characterQuery(world);
  for (const eid of ents) {
    if (hasComponent(world, IsBeingDragged, eid)) continue; // 드래그 중이면 스킵
    // ... (이전과 동일한 로직)
  }
  return world;
};
const createMovementSystem = () => (world) => {
  const ents = characterQuery(world);
  for (const eid of ents) {
    if (hasComponent(world, IsBeingDragged, eid)) continue; // 드래그 중이면 스킵
    // ... (이전과 동일한 로직)
  }
  return world;
};

// ... createRenderSystem 은 이전과 동일 ...

// --- 메인 루프 ---
const tamagotchi = addEntity(world);
// ... Position, Velocity 등 기본 컴포넌트 추가 ...
addComponent(world, Position, tamagotchi);
// ...
addComponent(world, Draggable, tamagotchi); // 드래그 가능하도록 태그 추가!

const canvas = document.getElementById("gameCanvas");
// ... 이벤트 리스너 설정 (맨 위 코드 블록 참조) ...

// 시스템 파이프라인 (실행 순서가 중요!)
const pipeline = pipe(
  createInputSystem(), // 1. 입력 처리 (드래그 시작/종료)
  createDragUpdateSystem(), // 2. 드래그 위치 업데이트
  createBehaviorSystem(), // 3. AI 행동 결정
  createMovementSystem() // 4. AI 이동 처리
  //createRenderSystem(ctx, canvas) // 5. 렌더링
);

### Entities

Character: `[ActorTag, ObjectComp, PositionComp, AngleComp, RenderComp]`

Bird: `[BirdTag, ObjectComp, PositionComp, AngleComp, RenderComp]`

Food: `[ObjectComp, PositionComp, AngleComp, RenderComp, FreshnessComp]`

Pill: `[ObjectComp, PositionComp, AngleComp, RenderComp]`

Poob: `[ObjectComp, PositionComp, AngleComp, RenderComp]`

### TODO: Features

```typescript
const TimeProgressComp = {
  startTime,
  endTime,
};
const StepComp = {
  currentStep,
  endStep,
  durationBetweenStep,
};

/**
 * 1. throw
 */
// function destinationSystem(world: IWorld): IWorld {}
// function flySystem(world: IWorld): IWorld {}

/**
 * 2. target movement
 */
function destinationMovementSystem(world: IWorld): IWorld {}

/**
 * 3. bird(delivery, pick-up)
 */

/**
 * 4. pill absorb
 */

/**
 * 5. cleaning
 */
const CleanComp = {};
```

### GameData Structure

새로운 GameData는 다음과 같은 JSON 구조를 사용합니다:

```json
{
  "world_metadata": {
    "level_name": "Forest Entrance",
    "last_saved": "2025-06-27T13:00:00Z",
    "scene_name": "MainScene",
    "version": "1.0.0"
  },
  "entities": [
    {
      "id": 101,
      "components": {
        "Position": { "x": 5, "y": 10 },
        "Angle": { "value": 0 },
        "Object": { "id": 101, "type": 1, "state": 1 },
        "Render": { "spriteRefIndex": 0, "textureKey": 1, "zIndex": 10 },
        "Speed": { "value": 75 },
        "ActorTag": null
      }
    }
  ]
}
```

#### 컴포넌트 타입들:

- `Position`: { x: number, y: number }
- `Angle`: { value: number }
- `Object`: { id: number, type: ObjectType, state: number }
- `Render`: { spriteRefIndex: number, textureKey: TextureKey, zIndex: number }
- `Speed`: { value: number }
- `Freshness`: { freshness: Freshness }
- `Destination`: { type: DestinationType, destX: number, destY: number }
- `RandomMovement`: { minIdleTime, maxIdleTime, minMoveTime, maxMoveTime, nextChange }
- `ActorTag`: null (태그 컴포넌트)
- `BirdTag`: null (태그 컴포넌트)

#### 헬퍼 함수들:

- `convertECSEntityToSavedEntity()`: ECS → SavedEntity 변환
- `applySavedEntityToECS()`: SavedEntity → ECS 적용
- `createCharacterSavedEntity()`, `createBirdSavedEntity()` 등: 타입별 엔티티 생성

#### 월드 관리 함수들:

- `addEntityData()`: 엔티티 추가/업데이트
- `removeEntityData()`: 엔티티 제거
- `getEntitiesByType()`: 타입별 조회
- `getEntityById()`: ID별 조회
- `getEntitiesWithComponent()`: 컴포넌트별 조회
- `serializeGameData()` / `deserializeGameData()`: 직렬화/역직렬화

### 특정 엔티티 변환 헬퍼 함수들

#### 개별 엔티티 변환

```typescript
// 특정 ID의 ECS 엔티티를 SavedEntity로 변환
const savedEntity = convertSpecificECSEntityToSavedEntity(ecsWorld, 101);

// ECS 월드에서 특정 ID 엔티티 찾기
const ecsEntityId = findECSEntityById(ecsWorld, 101);
```

#### 타입별 변환

```typescript
// 특정 타입의 모든 ECS 엔티티들을 SavedEntity로 변환
const characters = convertECSEntitiesByType(ecsWorld, ObjectType.CHARACTER);
```

#### 동기화 함수들

```typescript
// 특정 엔티티를 ECS에서 MainSceneWorld로 동기화
const success = syncECSEntityToMainSceneWorld(ecsWorld, mainSceneWorld, 101);

// 모든 ECS 엔티티를 MainSceneWorld로 동기화
const syncedCount = syncAllECSEntitiesToMainSceneWorld(
  ecsWorld,
  mainSceneWorld
);

// 특정 컴포넌트만 업데이트
const updated = updateEntityComponentInMainSceneWorld(
  ecsWorld,
  mainSceneWorld,
  101,
  "Position"
);
```

#### MainSceneWorld 편의 메서드들

```typescript
// 클래스 메서드로 간편하게 사용
mainSceneWorld.syncEntityFromECS(ecsWorld, 101);
mainSceneWorld.syncAllEntitiesFromECS(ecsWorld);
mainSceneWorld.updateEntityComponentFromECS(ecsWorld, 101, "Position");
mainSceneWorld.syncEntitiesByTypeFromECS(ecsWorld, ObjectType.CHARACTER);
```

#### 사용 시나리오

1. **실시간 동기화**: ECS 시스템 실행 후 변경된 엔티티만 선택적으로 동기화
2. **배치 처리**: 게임 저장 시 모든 엔티티를 한 번에 변환
3. **타입별 처리**: 특정 타입의 엔티티들만 따로 관리
4. **컴포넌트별 업데이트**: 특정 컴포넌트(예: Position)만 빈번하게 업데이트

### DataSyncSystem

일정 시간마다 ECS 엔티티들의 상태를 MainSceneWorld에 자동으로 동기화하는 시스템입니다.

#### 주요 기능

- **자동 동기화**: 설정된 간격(기본 500ms)마다 자동으로 동기화
- **변경 감지**: 엔티티의 컴포넌트가 변경된 경우에만 동기화 (선택적)
- **성능 모니터링**: 동기화 성능 통계 제공
- **선택적 동기화**: 특정 타입이나 특정 엔티티만 동기화 가능
- **설정 변경**: 런타임에 동기화 간격 및 옵션 변경 가능

#### 기본 사용법

```typescript
// MainSceneWorld와 DataSyncSystem 생성
const mainSceneWorld = createMainSceneWorld(app);
const dataSyncSystem = createDataSyncSystem(mainSceneWorld);

// ECS 시스템 실행 시 DataSyncSystem 전달
runMainSceneSystems(ecsWorld, deltaTime, spriteStore, dataSyncSystem);
```

#### 커스텀 설정

```typescript
const dataSyncSystem = new DataSyncSystem(mainSceneWorld, {
  syncIntervalMs: 1000, // 1초마다 동기화
  autoStart: true, // 자동 시작
  onlyChangedEntities: true, // 변경된 엔티티만 동기화
  enableLogging: false, // 로그 비활성화
});
```

#### 수동 제어

```typescript
// 시스템 제어
dataSyncSystem.start(); // 시작
dataSyncSystem.stop(); // 중지
dataSyncSystem.syncNow(ecsWorld); // 즉시 동기화

// 선택적 동기화
dataSyncSystem.syncEntityType(ecsWorld, ObjectType.CHARACTER);
dataSyncSystem.forceFullSync(ecsWorld); // 모든 엔티티 강제 동기화

// 설정 변경
dataSyncSystem.updateConfig({ syncIntervalMs: 200 });
```

#### 모니터링

```typescript
// 시스템 상태 확인
const status = dataSyncSystem.getStatus();
const stats = dataSyncSystem.getSyncStats();

console.log("동기화 통계:", {
  totalSyncs: stats.totalSyncs,
  averageSyncDuration: stats.averageSyncDuration,
  isRunning: stats.isRunning,
});
```

#### 성능 최적화

- `onlyChangedEntities: true`: 변경된 엔티티만 동기화하여 성능 향상
- `syncIntervalMs`: 게임 요구사항에 맞게 동기화 간격 조정
- `clearHashCache()`: 메모리 사용량 최적화를 위한 캐시 정리
- 타입별 선택적 동기화로 필요한 데이터만 처리

#### 사용 시나리오

1. **실시간 게임**: 빠른 동기화(100-200ms)로 즉각적인 상태 반영
2. **턴제 게임**: 느린 동기화(1-2초)로 리소스 절약
3. **데이터 백업**: 주기적인 게임 상태 저장
4. **디버깅**: 로그 활성화로 동기화 과정 모니터링

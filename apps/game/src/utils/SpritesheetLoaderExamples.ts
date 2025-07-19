import {
  loadSpritesheet,
  loadMultipleSpritesheets,
  debugSpritesheetInfo,
} from "./SpritesheetLoader";

/**
 * SpritesheetLoader 유틸리티 사용 예시
 */

// 1. 단일 스프라이트시트 로드 예시
export async function example1_LoadSingleSpritesheet() {
  console.log("=== 단일 스프라이트시트 로드 예시 ===");

  const result = await loadSpritesheet({
    jsonPath: "/game/sprites/monsters/test-green-slime_A1.json",
    alias: "green-slime-a1",
    pixelArt: true,
    timeout: 5000,
  });

  if (result) {
    console.log("로드 성공!");
    console.log("사용 가능한 애니메이션:", result.animations);
    console.log("사용 가능한 텍스처:", result.textures);

    // 디버그 정보 출력
    debugSpritesheetInfo(result.spritesheet, result.alias);
  } else {
    console.log("로드 실패!");
  }
}

// 2. 여러 스프라이트시트 병렬 로드 예시
export async function example2_LoadMultipleSpritesheets() {
  console.log("=== 여러 스프라이트시트 병렬 로드 예시 ===");

  const spritesheetConfigs = [
    {
      jsonPath: "/game/sprites/monsters/test-green-slime_A1.json",
      alias: "slime-a1",
      pixelArt: true,
    },
    {
      jsonPath: "/game/sprites/monsters/test-green-slime_B1.json",
      alias: "slime-b1",
      pixelArt: true,
    },
    {
      jsonPath: "/game/sprites/bird.json",
      alias: "bird",
      pixelArt: true,
    },
  ];

  const results = await loadMultipleSpritesheets(spritesheetConfigs);

  console.log(`총 ${results.length}개의 스프라이트시트 로드 완료`);

  results.forEach((result, index) => {
    console.log(`\n--- 스프라이트시트 ${index + 1}: ${result.alias} ---`);
    console.log("애니메이션:", result.animations);
    console.log("텍스처:", result.textures);
  });
}

// 3. 게임에서 실제 사용하는 방식 예시
export async function example3_GameUsage() {
  console.log("=== 게임에서 실제 사용 예시 ===");

  // 캐릭터 스프라이트시트 로드
  const characterResult = await loadSpritesheet({
    jsonPath: "/game/sprites/monsters/test-green-slime_A1.json",
    alias: "player-character",
    pixelArt: true,
  });

  if (!characterResult) {
    console.error("캐릭터 스프라이트시트 로드 실패");
    return;
  }

  // 특정 애니메이션 텍스처 가져오기
  const idleTextures = characterResult.spritesheet.animations?.["idle"];
  const walkingTextures = characterResult.spritesheet.animations?.["walking"];

  console.log("idle 애니메이션 프레임 수:", idleTextures?.length || 0);
  console.log("walking 애니메이션 프레임 수:", walkingTextures?.length || 0);

  // 애니메이션 스프라이트 생성 (예시)
  if (idleTextures && idleTextures.length > 0) {
    // const animatedSprite = new PIXI.AnimatedSprite(idleTextures);
    // animatedSprite.animationSpeed = 0.1;
    // animatedSprite.play();
    console.log("PIXI.AnimatedSprite를 생성할 수 있습니다!");
  }
}

// 4. 에러 처리 및 타임아웃 예시
export async function example4_ErrorHandling() {
  console.log("=== 에러 처리 및 타임아웃 예시 ===");

  // 존재하지 않는 파일 로드 시도
  const failResult = await loadSpritesheet({
    jsonPath: "/game/sprites/nonexistent.json",
    alias: "nonexistent",
    pixelArt: true,
    timeout: 2000, // 2초 타임아웃
  });

  if (!failResult) {
    console.log("예상대로 로드에 실패했습니다.");
  }

  // 매우 짧은 타임아웃으로 로드 시도
  const timeoutResult = await loadSpritesheet({
    jsonPath: "/game/sprites/monsters/test-green-slime_A1.json",
    alias: "timeout-test",
    pixelArt: true,
    timeout: 1, // 1ms 타임아웃 (거의 확실히 실패)
  });

  if (!timeoutResult) {
    console.log("타임아웃으로 인해 로드에 실패했습니다.");
  }
}

// 모든 예시 실행
export async function runAllExamples() {
  await example1_LoadSingleSpritesheet();
  await example2_LoadMultipleSpritesheets();
  await example3_GameUsage();
  await example4_ErrorHandling();
}

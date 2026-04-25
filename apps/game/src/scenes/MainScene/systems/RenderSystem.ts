// PIXI v8 렌더링 시스템
import { defineQuery, exitQuery } from "bitecs";
import {
	PositionComp,
	AngleComp,
	RenderComp,
	FoodMaskComp,
	FreshnessComp,
} from "../raw-components";
import * as PIXI from "pixi.js";
import { MainSceneWorld } from "../world";
import { TextureKey, Freshness, EGG_TEXTURE_KEYS } from "../types";
import { getTextureFromSpritesheet } from "../../../utils/asset";
import { hasComponent } from "bitecs";
import { ObjectStore } from "../utils/ObjectStore";

/** NOTE: types.ts에 {@link TextureKey}과 싱크가 맞아야 함. */
const EGG_TEXTURE_MAP = Object.fromEntries(
	EGG_TEXTURE_KEYS.map((textureKey, index) => [
		textureKey,
		{ spritesheetAlias: "eggs", textureName: `egg-${index}` },
	]),
) as Record<number, { spritesheetAlias?: string; textureName: string }>;

const TEXTURE_MAP: Record<
	number,
	{ spritesheetAlias?: string; textureName: string }
> = {
	// TODO: animation으로 취급
	// Character sprites (monsters) (1-99)
	// 1: { spritesheetAlias: "test-green-slime_A1", textureName: "idle-1" }, // CharacterKey.TestGreenSlimeA1
	// 2: { spritesheetAlias: "test-green-slime_B1", textureName: "idle-1" }, // CharacterKey.TestGreenSlimeB1
	// 3: { spritesheetAlias: "test-green-slime_C1", textureName: "idle-1" }, // CharacterKey.TestGreenSlimeC1
	// 4: { spritesheetAlias: "test-green-slime_D1", textureName: "idle-1" }, // CharacterKey.TestGreenSlimeD1

	// Bird sprites (100-199)
	100: { spritesheetAlias: "bird", textureName: "fly_0" }, // TextureKey.BIRD

	// Common 16x16 sprites (200-299)
	200: { spritesheetAlias: "common16x16", textureName: "poob" }, // TextureKey.POOB
	201: { spritesheetAlias: "common16x16", textureName: "broom" }, // TextureKey.BROOM
	202: { spritesheetAlias: "common16x16", textureName: "sick" }, // TextureKey.SICK
	203: { spritesheetAlias: "common16x16", textureName: "happy" }, // TextureKey.HAPPY
	204: { spritesheetAlias: "common16x16", textureName: "unhappy" }, // TextureKey.UNHAPPY
	205: { spritesheetAlias: "common16x16", textureName: "urgent" }, // TextureKey.URGENT
	206: { spritesheetAlias: "common16x16", textureName: "discover" }, // TextureKey.DISCOVER
	207: { spritesheetAlias: "common16x16", textureName: "pill-1" }, // TextureKey.PILL

	// Common 32x32 sprites (300-399)
	300: { spritesheetAlias: "common32x32", textureName: "basket" }, // TextureKey.BASKET
	301: { spritesheetAlias: "common32x32", textureName: "tomb" }, // TextureKey.TOMB

	// Food sprites (400-499)
	400: { spritesheetAlias: "foods", textureName: "food-1" }, // TextureKey.FOOD1
	401: { spritesheetAlias: "foods", textureName: "food-2" }, // TextureKey.FOOD2
	402: { spritesheetAlias: "foods", textureName: "food-3" }, // TextureKey.FOOD3
	403: { spritesheetAlias: "foods", textureName: "food-4" }, // TextureKey.FOOD4
	404: { spritesheetAlias: "foods", textureName: "food-5" }, // TextureKey.FOOD5
	405: { spritesheetAlias: "foods", textureName: "food-6" }, // TextureKey.FOOD6
	406: { spritesheetAlias: "foods", textureName: "food-7" }, // TextureKey.FOOD7
	407: { spritesheetAlias: "foods", textureName: "food-8" }, // TextureKey.FOOD8
	408: { spritesheetAlias: "foods", textureName: "food-9" }, // TextureKey.FOOD9
	409: { spritesheetAlias: "foods", textureName: "food-10" }, // TextureKey.FOOD10
	410: { spritesheetAlias: "foods", textureName: "food-11" }, // TextureKey.FOOD11
	411: { spritesheetAlias: "foods", textureName: "food-12" }, // TextureKey.FOOD12
	412: { spritesheetAlias: "foods", textureName: "food-13" }, // TextureKey.FOOD13
	413: { spritesheetAlias: "foods", textureName: "food-14" }, // TextureKey.FOOD14
	414: { spritesheetAlias: "foods", textureName: "food-15" }, // TextureKey.FOOD15
	415: { spritesheetAlias: "foods", textureName: "food-16" }, // TextureKey.FOOD16
	416: { spritesheetAlias: "foods", textureName: "food-17" }, // TextureKey.FOOD17
	417: { spritesheetAlias: "foods", textureName: "food-18" }, // TextureKey.FOOD18
	418: { spritesheetAlias: "foods", textureName: "food-19" }, // TextureKey.FOOD19
	419: { spritesheetAlias: "foods", textureName: "food-20" }, // TextureKey.FOOD20
	420: { spritesheetAlias: "foods", textureName: "food-21" }, // TextureKey.FOOD21
	421: { spritesheetAlias: "foods", textureName: "food-22" }, // TextureKey.FOOD22
	422: { spritesheetAlias: "foods", textureName: "food-23" }, // TextureKey.FOOD23
	423: { spritesheetAlias: "foods", textureName: "food-24" }, // TextureKey.FOOD24
	424: { spritesheetAlias: "foods", textureName: "food-25" }, // TextureKey.FOOD25
	425: { spritesheetAlias: "foods", textureName: "food-26" }, // TextureKey.FOOD26
	426: { spritesheetAlias: "foods", textureName: "food-27" }, // TextureKey.FOOD27
	427: { spritesheetAlias: "foods", textureName: "food-28" }, // TextureKey.FOOD28
	428: { spritesheetAlias: "foods", textureName: "food-29" }, // TextureKey.FOOD29
	429: { spritesheetAlias: "foods", textureName: "food-30" }, // TextureKey.FOOD30
	430: { spritesheetAlias: "foods", textureName: "food-31" }, // TextureKey.FOOD31
	431: { spritesheetAlias: "foods", textureName: "food-32" }, // TextureKey.FOOD32
	432: { spritesheetAlias: "foods", textureName: "food-33" }, // TextureKey.FOOD33
	433: { spritesheetAlias: "foods", textureName: "food-34" }, // TextureKey.FOOD34
	434: { spritesheetAlias: "foods", textureName: "food-35" }, // TextureKey.FOOD35
	435: { spritesheetAlias: "foods", textureName: "food-36" }, // TextureKey.FOOD36
	436: { spritesheetAlias: "foods", textureName: "food-37" }, // TextureKey.FOOD37
	437: { spritesheetAlias: "foods", textureName: "food-38" }, // TextureKey.FOOD38
	438: { spritesheetAlias: "foods", textureName: "food-39" }, // TextureKey.FOOD39
	439: { spritesheetAlias: "foods", textureName: "food-40" }, // TextureKey.FOOD40
	440: { spritesheetAlias: "foods", textureName: "food-41" }, // TextureKey.FOOD41
	441: { spritesheetAlias: "foods", textureName: "food-42" }, // TextureKey.FOOD42
	442: { spritesheetAlias: "foods", textureName: "food-43" }, // TextureKey.FOOD43
	443: { spritesheetAlias: "foods", textureName: "food-44" }, // TextureKey.FOOD44
	444: { spritesheetAlias: "foods", textureName: "food-45" }, // TextureKey.FOOD45
	445: { spritesheetAlias: "foods", textureName: "food-46" }, // TextureKey.FOOD46
	446: { spritesheetAlias: "foods", textureName: "food-47" }, // TextureKey.FOOD47
	447: { spritesheetAlias: "foods", textureName: "food-48" }, // TextureKey.FOOD48
	448: { spritesheetAlias: "foods", textureName: "food-49" }, // TextureKey.FOOD49
	449: { spritesheetAlias: "foods", textureName: "food-50" }, // TextureKey.FOOD50
	450: { spritesheetAlias: "foods", textureName: "food-51" }, // TextureKey.FOOD51
	451: { spritesheetAlias: "foods", textureName: "food-52" }, // TextureKey.FOOD52
	452: { spritesheetAlias: "foods", textureName: "food-53" }, // TextureKey.FOOD53
	453: { spritesheetAlias: "foods", textureName: "food-54" }, // TextureKey.FOOD54
	454: { spritesheetAlias: "foods", textureName: "food-55" }, // TextureKey.FOOD55
	455: { spritesheetAlias: "foods", textureName: "food-56" }, // TextureKey.FOOD56
	456: { spritesheetAlias: "foods", textureName: "food-57" }, // TextureKey.FOOD57
	457: { spritesheetAlias: "foods", textureName: "food-58" }, // TextureKey.FOOD58
	458: { spritesheetAlias: "foods", textureName: "food-59" }, // TextureKey.FOOD59
	459: { spritesheetAlias: "foods", textureName: "food-60" }, // TextureKey.FOOD60
	460: { spritesheetAlias: "foods", textureName: "food-61" }, // TextureKey.FOOD61
	461: { spritesheetAlias: "foods", textureName: "food-62" }, // TextureKey.FOOD62
	462: { spritesheetAlias: "foods", textureName: "food-63" }, // TextureKey.FOOD63
	463: { spritesheetAlias: "foods", textureName: "food-64" }, // TextureKey.FOOD64

	// Egg sprites (500-599)
	...EGG_TEXTURE_MAP,

	// Pill sprites (600-699)
	600: { spritesheetAlias: "common16x16", textureName: "pill-1" }, // TextureKey.PILL1
	601: { spritesheetAlias: "common16x16", textureName: "pill-2" }, // TextureKey.PILL2
} as const;

// 스프라이트 스토어 - ObjectStore 클래스 사용
const spriteStore = new ObjectStore<PIXI.Sprite>("SpriteStore");

// 음식 마스크 스프라이트 스토어
const maskSpriteStore = new ObjectStore<PIXI.Sprite>("MaskSpriteStore");

// 스프라이트 스토어를 다른 시스템에서 접근할 수 있도록 export
export function getSpriteStore() {
	return spriteStore;
}

// 마스크 프레임 이름들
const MASK_FRAME_NAMES = [
	"vite-mask_0",
	"vite-mask_1",
	"vite-mask_2",
	"vite-mask_3",
	"vite-mask_4",
];

function getSprite(eid: number): PIXI.Sprite | undefined {
	return spriteStore.get(eid);
}

function getMaskSprite(eid: number): PIXI.Sprite | undefined {
	return maskSpriteStore.get(eid);
}

function getTextureFromKey(textureKey: number): PIXI.Texture | undefined {
	const textureInfo = TEXTURE_MAP[textureKey];
	if (!textureInfo) {
		if (import.meta.env.DEV) {
			throw new Error(
				`[RenderSystem] Texture key ${textureKey} not found in TEXTURE_MAP`,
			);
		}
		console.warn(
			`[RenderSystem] Texture key ${textureKey} not found in TEXTURE_MAP`,
		);
		return undefined;
	}

	try {
		if (!textureInfo.spritesheetAlias) {
			return PIXI.Assets.get<PIXI.Texture>(textureInfo.textureName);
		}

		// 스프라이트시트에서 텍스처 가져오기
		const spritesheet = PIXI.Assets.get<PIXI.Spritesheet>(
			textureInfo.spritesheetAlias,
		);

		if (!spritesheet) {
			console.warn(
				`[RenderSystem] Spritesheet not found: ${textureInfo.spritesheetAlias} for texture key ${textureKey}`,
			);
			return PIXI.Texture.WHITE;
		}

		const texture = getTextureFromSpritesheet(
			spritesheet,
			textureInfo.textureName,
		);

		if (!texture) {
			console.warn(
				`[RenderSystem] Texture not found: ${textureInfo.textureName} in spritesheet ${textureInfo.spritesheetAlias} (key: ${textureKey})`,
			);
			return PIXI.Texture.WHITE;
		}

		return texture;
	} catch (error) {
		console.error(
			`[RenderSystem] Error getting texture for key ${textureKey}:`,
			error,
		);
		return PIXI.Texture.WHITE;
	}
}

function createSpriteForEntity(eid: number): PIXI.Sprite | undefined {
	const textureKey = RenderComp.textureKey[eid];

	const texture = getTextureFromKey(textureKey);
	if (!texture) {
		console.warn(
			`[RenderSystem] Texture not found for entity ${eid} with key ${textureKey}`,
		);
		return new PIXI.Sprite(PIXI.Texture.WHITE);
	}

	const sprite = new PIXI.Sprite(texture);
	sprite.anchor.set(0.5);

	return sprite;
}

const renderableQuery = defineQuery([PositionComp, RenderComp]);
const exitedRenderableQuery = exitQuery(renderableQuery);
const foodMaskQuery = defineQuery([RenderComp, FoodMaskComp]);

/**
 * 음식 마스크 스프라이트 생성
 */
function createMaskSpriteForFood(eid: number): PIXI.Sprite | undefined {
	console.log(`[RenderSystem] Creating mask sprite for entity ${eid}`);

	// vite-food-mask 스프라이트시트에서 첫 번째 프레임 가져오기
	const spritesheet = PIXI.Assets.get<PIXI.Spritesheet>("vite-food-mask");
	if (!spritesheet) {
		console.warn("[RenderSystem] vite-food-mask spritesheet not found");
		return undefined;
	}

	console.log(`[RenderSystem] Found vite-food-mask spritesheet:`, spritesheet);
	console.log(
		`[RenderSystem] Available textures:`,
		Object.keys(spritesheet.textures),
	);

	const texture = getTextureFromSpritesheet(spritesheet, MASK_FRAME_NAMES[0]);
	if (!texture) {
		console.warn(
			`[RenderSystem] First mask texture not found: ${MASK_FRAME_NAMES[0]}`,
		);
		return undefined;
	}

	console.log(`[RenderSystem] Created mask texture: ${MASK_FRAME_NAMES[0]}`);

	const maskSprite = new PIXI.Sprite(texture);
	maskSprite.anchor.set(0.5);

	// 마스크 스프라이트의 크기를 음식 스프라이트와 동일하게 설정
	const foodStoreIndex = RenderComp.storeIndex[eid];
	const foodSprite = getSprite(foodStoreIndex);
	if (foodSprite) {
		maskSprite.width = foodSprite.width;
		maskSprite.height = foodSprite.height;
		console.log(
			`[RenderSystem] Set mask size to match food sprite: ${maskSprite.width}x${maskSprite.height}`,
		);
	}

	return maskSprite;
}

/**
 * 마스크 텍스처 업데이트
 */
function updateMaskTexture(maskSprite: PIXI.Sprite, progress: number): void {
	const frameIndex = Math.min(
		Math.floor(progress * MASK_FRAME_NAMES.length),
		MASK_FRAME_NAMES.length - 1,
	);

	const frameName = MASK_FRAME_NAMES[frameIndex];

	const spritesheet = PIXI.Assets.get<PIXI.Spritesheet>("vite-food-mask");
	if (!spritesheet) {
		console.warn(
			"[RenderSystem] vite-food-mask spritesheet not found during texture update",
		);
		return;
	}

	const texture = getTextureFromSpritesheet(spritesheet, frameName);
	if (texture) {
		maskSprite.texture = texture;
		// console.log(
		//   `[RenderSystem] Successfully updated mask texture to ${frameName}`
		// );
	} else {
		// console.warn(`[RenderSystem] Failed to get texture for frame ${frameName}`);
	}
}

// 개발 환경에서 텍스처 검증을 한 번만 수행하기 위한 플래그
let hasValidatedTextures = false;

export function renderSystem(params: {
	world: MainSceneWorld;
	delta: number;
}): typeof params {
	const { world } = params;

	// 첫 번째 실행 시 텍스처 맵 검증 (개발 환경에서만)
	if (process.env.NODE_ENV === "development" && !hasValidatedTextures) {
		validateTextureMap();
		hasValidatedTextures = true;
	}

	const entities = renderableQuery(world);
	const exitedEntities = exitedRenderableQuery(world);
	const stage = world.stage;

	// 제거된 엔티티들의 스프라이트를 stage에서 제거
	for (let i = 0; i < exitedEntities.length; i++) {
		const eid = exitedEntities[i];
		const sprite = getSprite(eid);

		if (sprite && sprite.parent) {
			stage.removeChild(sprite);
			sprite.destroy();
			spriteStore.remove(eid);

			console.log(`[RenderSystem] Removed sprite from stage for entity ${eid}`);
		}

		// FoodMask가 있는 엔티티인 경우 마스크도 정리
		if (hasComponent(world, FoodMaskComp, eid)) {
			const maskSprite = getMaskSprite(eid);

			if (maskSprite) {
				if (sprite && sprite.mask === maskSprite) {
					sprite.mask = null;
				}

				if (maskSprite.parent) {
					maskSprite.parent.removeChild(maskSprite);
				}

				maskSprite.destroy();
				maskSpriteStore.remove(eid);

				console.log(`[RenderSystem] Removed mask sprite for entity ${eid}`);
			}
		}
	}

	for (let i = 0; i < entities.length; i++) {
		const eid = entities[i];
		const textureKey = RenderComp.textureKey[eid];
		let sprite = spriteStore.get(eid); // eid를 직접 인덱스로 사용

		if (textureKey === TextureKey.NULL) {
			if (sprite) {
				stage.removeChild(sprite);
				sprite.destroy();
				spriteStore.remove(eid);
			}
			continue;
		}

		// 스프라이트가 없는 경우에만 새로 생성
		if (!sprite) {
			console.log(
				`[RenderSystem] Creating sprite for entity ${eid}, total sprites before: ${spriteStore.size}`,
			);

			sprite = createSpriteForEntity(eid);
			if (!sprite) {
				throw new Error(
					`[RenderSystem] Failed to create sprite for entity ${eid}`,
				);
			}

			stage.addChild(sprite);
			spriteStore.set(eid, sprite); // eid를 직접 인덱스로 사용
			RenderComp.storeIndex[eid] = eid; // storeIndex는 eid와 동일

			console.log(
				`[RenderSystem] Created and added sprite for entity ${eid}, total sprites after: ${spriteStore.size}`,
			);
		}

		renderCommonAttributes(eid, sprite, world);

		const newTexture = getTextureFromKey(textureKey);
		if (newTexture && sprite.texture !== newTexture) {
			sprite.texture = newTexture;
		}
	}

	// FoodMask 처리
	processFoodMasks(world, stage);

	return params;
}

/**
 * 음식 마스킹 처리
 */
function processFoodMasks(world: MainSceneWorld, stage: PIXI.Container): void {
	const foodsWithMask = foodMaskQuery(world);

	// if (foodsWithMask.length > 0) {
	//   console.log(
	//     `[RenderSystem] Processing ${foodsWithMask.length} foods with mask`
	//   );
	// }

	for (let i = 0; i < foodsWithMask.length; i++) {
		const eid = foodsWithMask[i];
		const progress = FoodMaskComp.progress[eid];
		const isInitialized = FoodMaskComp.isInitialized[eid];

		// 음식 스프라이트 가져오기
		const foodSprite = getSprite(eid);
		if (!foodSprite) {
			console.warn(`[RenderSystem] Food sprite not found for entity ${eid}`);
			continue;
		}

		let maskSprite = getMaskSprite(eid);

		// 마스크 스프라이트가 초기화되지 않았거나 없다면 생성
		if (!isInitialized || !maskSprite) {
			console.log(`[RenderSystem] Creating new mask sprite for entity ${eid}`);

			maskSprite = createMaskSpriteForFood(eid);
			if (!maskSprite) {
				console.warn(
					`[RenderSystem] Failed to create mask sprite for entity ${eid}`,
				);
				continue;
			}

			// 마스크를 음식 스프라이트에 적용
			foodSprite.mask = maskSprite;

			// 마스크 스프라이트를 stage에 추가 (PIXI 마스킹이 작동하려면 필요)
			stage.addChild(maskSprite);

			maskSpriteStore.set(eid, maskSprite); // eid를 직접 인덱스로 사용
			FoodMaskComp.maskStoreIndex[eid] = eid; // maskStoreIndex는 eid와 동일
			FoodMaskComp.isInitialized[eid] = 1;

			console.log(`[RenderSystem] Created food mask for entity ${eid}`);
			console.log(`[RenderSystem] Food sprite mask set:`, foodSprite.mask);
			console.log(`[RenderSystem] Mask sprite parent:`, maskSprite.parent);
		}

		// 마스크 위치 업데이트 (음식 스프라이트의 위치와 동기화)
		if (maskSprite) {
			maskSprite.position.set(foodSprite.position.x, foodSprite.position.y);

			// 진행도에 따라 마스크 텍스처 업데이트
			updateMaskTexture(maskSprite, progress);
		}
	}
}

export function renderCommonAttributes(
	eid: number,
	sprite: PIXI.Sprite | PIXI.AnimatedSprite,
	world: MainSceneWorld,
): void {
	// 스프라이트가 null이거나 destroyed된 경우 처리하지 않음
	if (!sprite || sprite.destroyed) {
		console.warn(
			`[RenderSystem] Skipping destroyed or null sprite for entity ${eid}`,
		);
		return;
	}

	const x = PositionComp.x[eid];
	const y = PositionComp.y[eid];
	sprite.position.set(x, y);

	// zIndex가 0이거나 설정되지 않았으면 y 좌표를 zIndex로 사용
	const configuredZIndex = RenderComp.zIndex[eid];
	sprite.zIndex = configuredZIndex === ECS_NULL_VALUE ? y : configuredZIndex;

	const baseScale = RenderComp.scale[eid];

	// AngleComp가 있는 엔티티만 각도에 따른 스케일 조정 적용
	if (hasComponent(world, AngleComp, eid)) {
		const angle = AngleComp.value[eid];
		// angle이 왼쪽(PI 또는 -PI 부근)을 향하면 x scale에 -1을 곱하기
		const isLeft = Math.abs(angle) > Math.PI / 2;
		sprite.scale.set(isLeft ? -baseScale : baseScale, baseScale);
	} else {
		// AngleComp가 없는 엔티티는 기본 스케일 적용
		sprite.scale.set(baseScale, baseScale);
	}

	// 음식의 신선도에 따른 색상 변경
	if (hasComponent(world, FreshnessComp, eid)) {
		const freshness = FreshnessComp.freshness[eid];

		switch (freshness) {
			case Freshness.STALE:
				sprite.tint = 0x8f63d6; // 보라색빛 (상한 음식)
				break;
			default:
				sprite.tint = 0xffffff;
				break;
		}
	} else {
		// FreshnessComp가 없는 엔티티는 기본 색상
		sprite.tint = 0xffffff;
	}
}

/**
 * 특정 텍스처가 로딩되었는지 확인
 */
export function isTextureLoaded(
	spritesheetAlias: string,
	textureName: string,
): boolean {
	const cache = PIXI.Assets.cache;
	const spritesheet = cache.get(spritesheetAlias);

	if (spritesheet instanceof PIXI.Spritesheet && spritesheet.textures) {
		return !!spritesheet.textures[textureName];
	}

	return false;
}

/**
 * TextureKey로 텍스처가 로딩되었는지 확인
 */
export function isTextureKeyLoaded(textureKey: number): boolean {
	const textureInfo = TEXTURE_MAP[textureKey];
	if (!textureInfo) {
		return false;
	}

	return isTextureLoaded(
		// FIXME: undefined 핸들
		textureInfo.spritesheetAlias ?? "",
		textureInfo.textureName,
	);
}

/**
 * 사용 가능한 TextureKey들을 반환합니다
 */
function getAvailableTextureKeys(): number[] {
	return Object.keys(TEXTURE_MAP)
		.map(Number)
		.sort((a, b) => a - b);
}

/**
 * TextureKey에 대응하는 스프라이트시트와 텍스처 정보를 반환합니다
 */
export function getTextureInfo(
	textureKey: number,
): { spritesheetAlias?: string; textureName: string } | null {
	return TEXTURE_MAP[textureKey] || null;
}

/**
 * 모든 텍스처의 로딩 상태를 확인하고 로그를 출력합니다
 */
function validateTextureMap(): void {
	console.groupCollapsed("[RenderSystem] Texture Map Validation:");

	const availableKeys = getAvailableTextureKeys();
	let validCount = 0;
	let invalidCount = 0;

	for (const textureKey of availableKeys) {
		const isLoaded = isTextureKeyLoaded(textureKey);
		const textureInfo = getTextureInfo(textureKey);

		if (isLoaded) {
			validCount++;
			console.log(
				`✓ Key ${textureKey}: ${textureInfo?.spritesheetAlias}/${textureInfo?.textureName}`,
			);
		} else {
			invalidCount++;
			console.warn(
				`✗ Key ${textureKey}: ${textureInfo?.spritesheetAlias}/${textureInfo?.textureName} - NOT LOADED`,
			);
		}
	}

	console.log(`Summary: ${validCount} valid, ${invalidCount} invalid textures`);
	console.groupEnd();
}

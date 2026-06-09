import assert from "node:assert/strict";
import test from "node:test";
import { addEntity } from "bitecs";
import {
	AnimationRenderComp,
	CharacterStatusComp,
	EggHatchComp,
	ObjectComp,
	RenderComp,
} from "../raw-components";
import { applySavedEntityToECS } from "../entityDataHelpers";
import { eggHatchSystem } from "../systems/EggHatchSystem";
import {
	AnimationKey,
	CharacterKeyECS,
	CharacterState,
	ObjectType,
	TextureKey,
} from "../types";
import {
	createTestCharacter,
	createTestWorld,
	withMockedDateNow,
} from "../../../test-utils/mainSceneTestUtils";

test("EggHatchSystem은 부화 시 Flutter authoritative update를 요청하고 반환 상태를 적용한다", () => {
	const currentTime = 5_000;
	const world = createTestWorld({ now: currentTime });
	const eggEid = withMockedDateNow(currentTime, () =>
		createTestCharacter(world, {
			state: CharacterState.EGG,
		}),
	);
	EggHatchComp.hatchTime[eggEid] = currentTime;

	const originalRandom = Math.random;
	const originalWarn = console.warn;
	let updateCallCount = 0;
	let selectionLogCount = 0;

	Math.random = () => {
		throw new Error("JS hatch selection must not call Math.random");
	};
	console.warn = (...args: unknown[]) => {
		if (args[0] === "[ImportantDiagnostics][EggHatchSelection]") {
			selectionLogCount += 1;
		}
		originalWarn(...args);
	};
	world.completeForegroundHatchWithFlutterAuthority = (eid, updateTime) => {
		updateCallCount += 1;
		assert.equal(eid, eggEid);
		assert.equal(updateTime, currentTime);
		ObjectComp.state[eid] = CharacterState.IDLE;
		CharacterStatusComp.characterKey[eid] = CharacterKeyECS.SoilSlimeA1;
		CharacterStatusComp.evolutionPhase[eid] = 1;
		EggHatchComp.hatchTime[eid] = 0;
		EggHatchComp.hatchDurationMs[eid] = 0;
		EggHatchComp.isReadyToHatch[eid] = 0;
		EggHatchComp.syringeCount[eid] = 0;
		EggHatchComp.pendingCharacterKey[eid] = CharacterKeyECS.NULL;
		RenderComp.textureKey[eid] = TextureKey.NULL;
		AnimationRenderComp.spritesheetKey[eid] = CharacterKeyECS.SoilSlimeA1;
		AnimationRenderComp.animationKey[eid] = AnimationKey.IDLE;
		return true;
	};

	try {
		eggHatchSystem({
			world: world as any,
			currentTime,
		});
	} finally {
		Math.random = originalRandom;
		console.warn = originalWarn;
	}

	assert.equal(updateCallCount, 1);
	assert.equal(selectionLogCount, 0);
	assert.equal(ObjectComp.state[eggEid], CharacterState.IDLE);
	assert.equal(
		CharacterStatusComp.characterKey[eggEid],
		CharacterKeyECS.SoilSlimeA1,
	);
	assert.equal(CharacterStatusComp.evolutionPhase[eggEid], 1);
	assert.equal(RenderComp.textureKey[eggEid], TextureKey.NULL);
});

test("EggHatchSystem은 Flutter update 실패 시 임의 부화 결과를 만들지 않고 egg ready 상태를 유지한다", () => {
	const currentTime = 5_000;
	const world = createTestWorld({ now: currentTime });
	const eggEid = withMockedDateNow(currentTime, () =>
		createTestCharacter(world, {
			state: CharacterState.EGG,
		}),
	);
	EggHatchComp.hatchTime[eggEid] = currentTime;

	const originalRandom = Math.random;
	const originalWarn = console.warn;
	let selectionLogCount = 0;

	Math.random = () => {
		throw new Error("JS hatch selection must not call Math.random");
	};
	console.warn = (...args: unknown[]) => {
		if (args[0] === "[ImportantDiagnostics][EggHatchSelection]") {
			selectionLogCount += 1;
		}
		originalWarn(...args);
	};
	world.completeForegroundHatchWithFlutterAuthority = () => false;

	try {
		eggHatchSystem({
			world: world as any,
			currentTime,
		});
	} finally {
		Math.random = originalRandom;
		console.warn = originalWarn;
	}

	assert.equal(selectionLogCount, 0);
	assert.equal(ObjectComp.state[eggEid], CharacterState.EGG);
	assert.equal(EggHatchComp.isReadyToHatch[eggEid], 1);
	assert.equal(EggHatchComp.pendingCharacterKey[eggEid], CharacterKeyECS.NULL);
	assert.equal(
		CharacterStatusComp.characterKey[eggEid],
		CharacterKeyECS.GreenSlimeA1,
	);
});

test("EggHatchSystem은 Flutter authority가 없으면 egg ready 상태만 표시한다", () => {
	const currentTime = 5_000;
	const world = createTestWorld({ now: currentTime });
	const eggEid = withMockedDateNow(currentTime, () =>
		createTestCharacter(world, {
			state: CharacterState.EGG,
		}),
	);
	EggHatchComp.hatchTime[eggEid] = currentTime;

	eggHatchSystem({
		world: world as any,
		currentTime,
	});

	assert.equal(ObjectComp.state[eggEid], CharacterState.EGG);
	assert.equal(EggHatchComp.isReadyToHatch[eggEid], 1);
	assert.equal(EggHatchComp.pendingCharacterKey[eggEid], CharacterKeyECS.NULL);
});

test("저장본 복원은 non-egg 캐릭터에 남은 egg static texture를 제거한다", () => {
	const world = createTestWorld({ now: 10_000 });
	const eid = addEntity(world);

	applySavedEntityToECS(world, eid, {
		components: {
			object: {
				id: 1001,
				type: ObjectType.CHARACTER,
				state: CharacterState.SICK,
			},
			characterStatus: {
				characterKey: CharacterKeyECS.GreenSlimeA1,
				stamina: 5,
				evolutionGage: 0,
				evolutionPhase: 1,
				statuses: [0, 0, 0, 0],
			},
			position: {
				x: 40,
				y: 40,
			},
			render: {
				storeIndex: 0,
				textureKey: TextureKey.EGG1,
				scale: 3,
				zIndex: 0,
			},
		},
	});

	assert.equal(ObjectComp.state[eid], CharacterState.SICK);
	assert.equal(RenderComp.textureKey[eid], TextureKey.NULL);
});

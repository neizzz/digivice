import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "bitecs";
import * as PIXI from "pixi.js";
import type {
	TrustedClock,
	TrustedTimeSnapshot,
} from "../../../utils/TrustedClock";
import { MainSceneWorld } from "../world";

function createMutableTrustedClock(nowRef: { value: number }): TrustedClock {
	const createSnapshot = (): TrustedTimeSnapshot => ({
		trustedUtcMs: nowRef.value,
		osUptimeMs: nowRef.value,
		source: "web-dev-fallback",
		uncertaintyMs: Number.POSITIVE_INFINITY,
		capturedWallMs: nowRef.value,
	});

	return {
		now: () => nowRef.value,
		captureAnchor: createSnapshot,
		refresh: async () => createSnapshot(),
		elapsedSince: (anchor: TrustedTimeSnapshot | null) => ({
			elapsedMs: anchor ? Math.max(0, nowRef.value - anchor.trustedUtcMs) : 0,
			trusted: false,
			reason: anchor ? "web_dev_fallback" : "missing_anchor",
			currentSnapshot: createSnapshot(),
		}),
		get lastSnapshot() {
			return createSnapshot();
		},
	} as TrustedClock;
}

test("MainSceneWorld.update는 dev timeScale을 하나의 foreground frame context로 전달한다", () => {
	const nowRef = { value: 1_000 };
	const world = new MainSceneWorld({
		stage: new PIXI.Container(),
		positionBoundary: {
			x: 0,
			y: 0,
			width: 320,
			height: 320,
		},
		trustedClock: createMutableTrustedClock(nowRef),
	});
	createWorld(world, 16);

	const testWorld = world as unknown as {
		_timeScale: number;
		_timeScaleAnchorTrustedMs: number;
		_timeScaleAnchorScaledMs: number;
		_lastStatusHeartbeatLogTime: number | null;
		_pipedSystems: (params: {
			world: MainSceneWorld;
			delta: number;
			currentTime: number;
		}) => void;
	};
	testWorld._timeScale = 20;
	testWorld._timeScaleAnchorTrustedMs = 1_000;
	testWorld._timeScaleAnchorScaledMs = 1_000;
	testWorld._lastStatusHeartbeatLogTime = 2_000;

	let capturedParams: {
		world: MainSceneWorld;
		delta: number;
		currentTime: number;
	} | null = null;
	testWorld._pipedSystems = (params) => {
		capturedParams = params;
	};

	nowRef.value = 1_020;
	world.update(20);

	assert.ok(capturedParams);
	assert.equal(capturedParams.world, world);
	assert.equal(capturedParams.delta, 400);
	assert.equal(capturedParams.currentTime, 1_400);
});

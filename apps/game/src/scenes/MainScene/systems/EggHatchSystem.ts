import { defineQuery } from "bitecs";
import {
	ObjectComp,
	EggHatchComp,
	CharacterStatusComp,
} from "../raw-components";
import { MainSceneWorld } from "../world";
import { CharacterState } from "../types";

const eggQuery = defineQuery([ObjectComp, EggHatchComp]);
const pendingRealtimeHatchAttemptsByWorld = new WeakMap<
	MainSceneWorld,
	Set<number>
>();

type FlutterAuthorityHatchWorld = MainSceneWorld & {
	completeForegroundHatchWithFlutterAuthority?: (
		eid: number,
		currentTime: number,
	) => boolean | Promise<boolean>;
};

/**
 * 알 부화 시스템
 * - EGG 상태의 캐릭터가 부화 시점에 도달하면 Flutter/Dart lifecycle update를 요청
 * - JS는 부화 결과를 선택하지 않고, Flutter가 저장/반환한 world data만 적용
 */
export function eggHatchSystem(params: {
	world: MainSceneWorld;
	currentTime: number;
}): typeof params {
	const { world, currentTime } = params;
	const entities = eggQuery(world);

	for (let i = 0; i < entities.length; i++) {
		const eid = entities[i];

		// EGG 상태가 아니면 건너뛰기
		if (ObjectComp.state[eid] !== CharacterState.EGG) continue;

		// 부화 시간이 되었는지 확인
		if (currentTime < EggHatchComp.hatchTime[eid]) {
			continue;
		}

		if (!EggHatchComp.isReadyToHatch[eid]) {
			const logContext = buildEggHatchDiagnosticsContext(
				eid,
				world,
				currentTime,
			);
			EggHatchComp.isReadyToHatch[eid] = 1;

			console.log(`[EggHatchSystem] Character ${eid} is ready to hatch!`);
			console.warn("[ImportantDiagnostics][EggHatchExecution]", {
				phase: "ready_to_hatch",
				...logContext,
			});
		}

		requestFlutterAuthoritativeHatch(eid, world, currentTime);
	}

	return params;
}

/**
 * 캐릭터 부화 처리 (비동기)
 * - foreground hatch도 Flutter/Dart lifecycle의 결과만 적용한다.
 * - 실패 시 JS는 임의 캐릭터를 선택하지 않고 EGG ready 상태를 유지한다.
 */
function requestFlutterAuthoritativeHatch(
	eid: number,
	world: MainSceneWorld,
	currentTime: number,
): void {
	const pendingAttempts = getPendingRealtimeHatchAttempts(world);
	if (pendingAttempts.has(eid)) {
		return;
	}
	pendingAttempts.add(eid);

	const hatchWorld = world as FlutterAuthorityHatchWorld;
	if (
		typeof hatchWorld.completeForegroundHatchWithFlutterAuthority !== "function"
	) {
		console.warn(
			"[EggHatchSystem] Flutter authoritative hatch update is unavailable. Keeping EGG state.",
		);
		console.warn("[ImportantDiagnostics][EggHatchExecution]", {
			phase: "flutter_authority_unavailable",
			...buildEggHatchDiagnosticsContext(eid, world, currentTime),
		});
		pendingAttempts.delete(eid);
		return;
	}

	console.warn("[ImportantDiagnostics][EggHatchExecution]", {
		phase: "flutter_authority_start",
		...buildEggHatchDiagnosticsContext(eid, world, currentTime),
	});

	const complete = (succeeded: boolean): void => {
		if (succeeded) {
			console.warn("[ImportantDiagnostics][EggHatchExecution]", {
				phase: "flutter_authority_applied",
				eid,
				objectId: ObjectComp.id[eid],
				currentTime,
			});
		} else {
			console.warn("[ImportantDiagnostics][EggHatchExecution]", {
				phase: "flutter_authority_kept_egg",
				...buildEggHatchDiagnosticsContext(eid, world, currentTime),
			});
		}
	};

	try {
		const result = hatchWorld.completeForegroundHatchWithFlutterAuthority(
			eid,
			currentTime,
		);
		if (typeof result === "boolean") {
			complete(result);
			pendingAttempts.delete(eid);
			return;
		}
		void result
			.then(complete)
			.catch((error) => {
				console.error(
					`[EggHatchSystem] Flutter authoritative hatch update failed for character ${eid}:`,
					error,
				);
				console.warn("[ImportantDiagnostics][EggHatchExecution]", {
					phase: "flutter_authority_failed",
					...buildEggHatchDiagnosticsContext(eid, world, currentTime),
					error: error instanceof Error ? error.message : String(error),
				});
			})
			.finally(() => {
				pendingAttempts.delete(eid);
			});
	} catch (error) {
		console.error(
			`[EggHatchSystem] Flutter authoritative hatch update failed for character ${eid}:`,
			error,
		);
		console.warn("[ImportantDiagnostics][EggHatchExecution]", {
			phase: "flutter_authority_failed",
			...buildEggHatchDiagnosticsContext(eid, world, currentTime),
			error: error instanceof Error ? error.message : String(error),
		});
		pendingAttempts.delete(eid);
	}
}

function getPendingRealtimeHatchAttempts(world: MainSceneWorld): Set<number> {
	let pendingAttempts = pendingRealtimeHatchAttemptsByWorld.get(world);
	if (!pendingAttempts) {
		pendingAttempts = new Set<number>();
		pendingRealtimeHatchAttemptsByWorld.set(world, pendingAttempts);
	}

	return pendingAttempts;
}

function buildEggHatchDiagnosticsContext(
	eid: number,
	world: MainSceneWorld,
	currentTime: number,
): Record<string, unknown> {
	return {
		eid,
		objectId: ObjectComp.id[eid],
		currentTime,
		hatchTime: EggHatchComp.hatchTime[eid],
		hatchDurationMs: EggHatchComp.hatchDurationMs[eid],
		isReadyToHatch: EggHatchComp.isReadyToHatch[eid] === 1,
		state: ObjectComp.state[eid],
		currentCharacterKey: CharacterStatusComp.characterKey[eid],
		syringeCount: EggHatchComp.syringeCount[eid],
		pendingCharacterKey: EggHatchComp.pendingCharacterKey[eid],
		isSimulationMode: world.isSimulationMode,
	};
}

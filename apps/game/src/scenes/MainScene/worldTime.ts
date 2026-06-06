import type { IWorld } from "bitecs";

type WorldWithCurrentTime = IWorld & {
	currentTime?: unknown;
};

export function resolveWorldCurrentTime(
	world: IWorld,
	fallback: number = Date.now(),
): number {
	try {
		const currentTime = (world as WorldWithCurrentTime).currentTime;

		if (typeof currentTime === "number" && Number.isFinite(currentTime)) {
			return currentTime;
		}
	} catch {
		// Some test doubles or partial worlds may expose a throwing getter.
	}

	return fallback;
}

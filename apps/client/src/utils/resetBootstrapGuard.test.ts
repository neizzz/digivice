import assert from "node:assert/strict";
import test from "node:test";
import {
  createResetBootstrapMarker,
  readWorldResetBootstrapMarkerId,
  shouldForceFreshWorldAfterReset,
} from "./resetBootstrapGuard.ts";
import type { StoredWorldData } from "./sanitizeStoredWorldData";

function worldData(markerId?: string | null): StoredWorldData {
  return {
    world_metadata: {
      monster_name: "MonTTo",
      app_state:
        typeof markerId === "undefined"
          ? {}
          : {
              reset_bootstrap_marker_id: markerId ?? undefined,
            },
    },
    entities: [],
  };
}

test("reset marker가 없으면 fresh world 강제를 하지 않는다", () => {
  assert.equal(shouldForceFreshWorldAfterReset(null, worldData()), false);
});

test("reset marker와 저장본 marker가 다르면 stale restore를 차단한다", () => {
  const marker = createResetBootstrapMarker("user_reset", 1234);

  assert.equal(
    shouldForceFreshWorldAfterReset(marker, worldData("another-reset")),
    true,
  );
});

test("reset marker와 저장본 marker가 같으면 fresh world로 인정한다", () => {
  const marker = createResetBootstrapMarker("sanitize_reset", 5678);

  assert.equal(
    shouldForceFreshWorldAfterReset(marker, worldData(marker.resetId)),
    false,
  );
});

test("world data에서 reset bootstrap marker id를 읽는다", () => {
  assert.equal(readWorldResetBootstrapMarkerId(worldData("reset-123")), "reset-123");
  assert.equal(readWorldResetBootstrapMarkerId(worldData(null)), null);
});

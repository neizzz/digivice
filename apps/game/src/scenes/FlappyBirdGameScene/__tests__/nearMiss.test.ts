import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveNearMissBonusTier,
  resolveNearMissThresholds,
} from "../nearMiss";
import { resolveNearMissFeedback } from "../ui";

test("near-miss threshold는 플레이어 높이 기준 2단계 band로 계산된다", () => {
  assert.deepEqual(resolveNearMissThresholds(40), {
    outerThreshold: 10,
    innerThreshold: 5,
  });
  assert.deepEqual(resolveNearMissThresholds(16), {
    outerThreshold: 6,
    innerThreshold: 3,
  });
});

test("current clearance가 바깥 threshold 밖이면 bonus가 없다", () => {
  assert.equal(
    resolveNearMissBonusTier({
      playerHeight: 40,
      trackedClearance: Number.POSITIVE_INFINITY,
      currentClearance: 11,
    }),
    0,
  );
});

test("current clearance가 바깥 threshold 안이면 2점 near-miss bonus를 준다", () => {
  assert.equal(
    resolveNearMissBonusTier({
      playerHeight: 40,
      trackedClearance: Number.POSITIVE_INFINITY,
      currentClearance: 8,
    }),
    1,
  );
});

test("current clearance가 안쪽 threshold 안이면 3점 near-miss bonus를 준다", () => {
  assert.equal(
    resolveNearMissBonusTier({
      playerHeight: 40,
      trackedClearance: Number.POSITIVE_INFINITY,
      currentClearance: 5,
    }),
    2,
  );
});

test("tracked clearance가 있으면 current clearance보다 우선해서 near-miss tier를 계산한다", () => {
  assert.equal(
    resolveNearMissBonusTier({
      playerHeight: 40,
      trackedClearance: 4,
      currentClearance: 12,
    }),
    2,
  );
});

test("near-miss bonus UI 문구는 locale별 Good/Great로 나뉜다", () => {
  assert.deepEqual(resolveNearMissFeedback(1), {
    text: "Good!",
    fill: 0x8ee3ff,
  });
  assert.deepEqual(resolveNearMissFeedback(2, "ko"), {
    text: "훌륭해요!",
    fill: 0xffc857,
  });
});

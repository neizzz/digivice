import assert from "node:assert/strict";
import test from "node:test";
import { TrustedClock, type TrustedTimeSnapshot } from "./TrustedClock";

function snapshot(params: Partial<TrustedTimeSnapshot> = {}): TrustedTimeSnapshot {
  return {
    trustedUtcMs: 1_000_000,
    osUptimeMs: 10_000,
    source: "ntp",
    uncertaintyMs: 10,
    capturedWallMs: 1_000_000,
    ...params,
  };
}

test("TrustedClock elapsedSince는 wall clock 대신 OS uptime delta를 사용한다", () => {
  const clock = new TrustedClock(
    snapshot({
      trustedUtcMs: 10_000_000,
      osUptimeMs: 15_000,
    }),
  );
  const anchor = snapshot({
    trustedUtcMs: 1_000_000,
    osUptimeMs: 10_000,
    capturedWallMs: 1_000_000,
  });
  const originalDateNow = Date.now;
  Date.now = () => 1_005_000;

  try {
    const elapsed = clock.elapsedSince(anchor);

    assert.equal(elapsed.trusted, true);
    assert.equal(elapsed.reason, "uptime_delta");
    assert.ok(elapsed.elapsedMs >= 5_000);
    assert.ok(elapsed.elapsedMs < 5_200);
  } finally {
    Date.now = originalDateNow;
  }
});

test("TrustedClock elapsedSince는 uptime이 줄어들면 reboot로 보고 진행하지 않는다", () => {
  const clock = new TrustedClock(
    snapshot({
      trustedUtcMs: 10_000_000,
      osUptimeMs: 5_000,
    }),
  );
  const anchor = snapshot({
    trustedUtcMs: 1_000_000,
    osUptimeMs: 10_000,
  });

  const elapsed = clock.elapsedSince(anchor);

  assert.equal(elapsed.trusted, false);
  assert.equal(elapsed.reason, "reboot_detected");
  assert.equal(elapsed.elapsedMs, 0);
});

test("TrustedClock은 wall clock이 5분 초과 되돌아가면 rollback abuse로 판정한다", () => {
  const clock = new TrustedClock(
    snapshot({
      trustedUtcMs: 1_600_000,
      osUptimeMs: 610_000,
    }),
  );
  const anchor = snapshot({
    trustedUtcMs: 1_000_000,
    osUptimeMs: 10_000,
    capturedWallMs: 1_000_000,
  });
  const originalDateNow = Date.now;
  Date.now = () => 600_000;

  try {
    const elapsed = clock.elapsedSince(anchor);

    assert.equal(elapsed.trusted, false);
    assert.equal(elapsed.reason, "wall_clock_rollback");
    assert.equal(elapsed.elapsedMs, 0);
  } finally {
    Date.now = originalDateNow;
  }
});

test("TrustedClock은 system clock 증가량이 trusted time보다 5분 초과 크면 fast-forward abuse로 판정한다", () => {
  const clock = new TrustedClock(
    snapshot({
      trustedUtcMs: 1_600_000,
      osUptimeMs: 610_000,
    }),
  );
  const anchor = snapshot({
    trustedUtcMs: 1_000_000,
    osUptimeMs: 10_000,
    capturedWallMs: 1_000_000,
  });
  const originalDateNow = Date.now;
  Date.now = () => 2_000_000;

  try {
    const elapsed = clock.elapsedSince(anchor);

    assert.equal(elapsed.trusted, false);
    assert.equal(elapsed.reason, "wall_clock_fast_forward");
    assert.equal(elapsed.elapsedMs, 0);
  } finally {
    Date.now = originalDateNow;
  }
});

test("TrustedClock은 cached uptime만으로는 fast-forward 패널티를 주지 않는다", () => {
  const clock = new TrustedClock(
    snapshot({
      trustedUtcMs: 1_600_000,
      osUptimeMs: 610_000,
      source: "cached-uptime",
    }),
  );
  const anchor = snapshot({
    trustedUtcMs: 1_000_000,
    osUptimeMs: 10_000,
    capturedWallMs: 1_000_000,
  });
  const originalDateNow = Date.now;
  Date.now = () => 2_000_000;

  try {
    const elapsed = clock.elapsedSince(anchor);

    assert.equal(elapsed.trusted, true);
    assert.equal(elapsed.reason, "uptime_delta");
  } finally {
    Date.now = originalDateNow;
  }
});

test("TrustedClock은 5분 이하 wall clock drift에는 패널티 reason을 만들지 않는다", () => {
  const clock = new TrustedClock(
    snapshot({
      trustedUtcMs: 1_600_000,
      osUptimeMs: 610_000,
    }),
  );
  const anchor = snapshot({
    trustedUtcMs: 1_000_000,
    osUptimeMs: 10_000,
    capturedWallMs: 1_000_000,
  });
  const originalDateNow = Date.now;
  Date.now = () => 1_899_000;

  try {
    const elapsed = clock.elapsedSince(anchor);

    assert.equal(elapsed.trusted, true);
    assert.equal(elapsed.reason, "uptime_delta");
  } finally {
    Date.now = originalDateNow;
  }
});

test("TrustedClock은 web fallback anchor에는 시간 조작 패널티를 주지 않는다", () => {
  const clock = new TrustedClock(
    snapshot({
      trustedUtcMs: 1_600_000,
      osUptimeMs: 610_000,
      source: "ntp",
    }),
  );
  const anchor = snapshot({
    trustedUtcMs: 1_000_000,
    osUptimeMs: 10_000,
    capturedWallMs: 1_000_000,
    source: "web-dev-fallback",
  });
  const originalDateNow = Date.now;
  Date.now = () => 600_000;

  try {
    const elapsed = clock.elapsedSince(anchor);

    assert.equal(elapsed.trusted, true);
    assert.equal(elapsed.reason, "uptime_delta");
  } finally {
    Date.now = originalDateNow;
  }
});

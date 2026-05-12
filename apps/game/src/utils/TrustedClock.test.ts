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

test("TrustedClock elapsedSince는 uptime이 줄어도 현재 NTP가 있으면 NTP delta를 사용한다", () => {
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

  assert.equal(elapsed.trusted, true);
  assert.equal(elapsed.reason, "ntp_after_reboot");
  assert.ok(elapsed.elapsedMs >= 9_000_000);
  assert.ok(elapsed.elapsedMs < 9_000_200);
});

test("TrustedClock elapsedSince는 uptime이 줄고 NTP가 없으면 reboot로 보고 진행하지 않는다", () => {
  const clock = new TrustedClock(
    snapshot({
      trustedUtcMs: 10_000_000,
      osUptimeMs: 5_000,
      source: "cached-uptime",
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

test("TrustedClock은 wall clock이 크게 되돌아가도 uptime delta를 사용한다", () => {
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

    assert.equal(elapsed.trusted, true);
    assert.equal(elapsed.reason, "uptime_delta");
    assert.ok(elapsed.elapsedMs >= 600_000);
    assert.ok(elapsed.elapsedMs < 600_200);
  } finally {
    Date.now = originalDateNow;
  }
});

test("TrustedClock은 system clock이 크게 빨라져도 uptime delta를 사용한다", () => {
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

    assert.equal(elapsed.trusted, true);
    assert.equal(elapsed.reason, "uptime_delta");
    assert.ok(elapsed.elapsedMs >= 600_000);
    assert.ok(elapsed.elapsedMs < 600_200);
  } finally {
    Date.now = originalDateNow;
  }
});

test("TrustedClock은 작은 wall clock drift에도 uptime delta를 유지한다", () => {
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

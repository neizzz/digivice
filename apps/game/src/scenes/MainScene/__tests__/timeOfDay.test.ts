import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAutoTimeOfDayState,
  SUN_TRANSITION_TOTAL_MINUTES,
  SUN_TRANSITION_WINDOW_MINUTES,
  TimeOfDay,
  type SunTimesPayload,
} from "../timeOfDay";

const baseSunTimes: SunTimesPayload = {
  sunriseAt: "2026-05-02T06:00:00.000Z",
  sunsetAt: "2026-05-02T18:00:00.000Z",
  date: "2026-05-02",
  timezone: "UTC",
  timezoneOffsetMinutes: 0,
  fetchedAt: "2026-05-02T00:00:00.000Z",
  locationSource: "device",
  hasLocationPermission: true,
};

test("일출 전후 1시간 동안 sunrise 전환 상태를 유지한다", () => {
  assert.equal(SUN_TRANSITION_WINDOW_MINUTES, 60);
  assert.equal(SUN_TRANSITION_TOTAL_MINUTES, 120);

  const beforeSunrise = resolveAutoTimeOfDayState(
    new Date("2026-05-02T05:30:00.000Z"),
    baseSunTimes,
  );
  const atSunrise = resolveAutoTimeOfDayState(
    new Date("2026-05-02T06:00:00.000Z"),
    baseSunTimes,
  );
  const afterSunrise = resolveAutoTimeOfDayState(
    new Date("2026-05-02T06:30:00.000Z"),
    baseSunTimes,
  );
  const afterWindow = resolveAutoTimeOfDayState(
    new Date("2026-05-02T07:01:00.000Z"),
    baseSunTimes,
  );

  assert.deepEqual(beforeSunrise, {
    timeOfDay: TimeOfDay.Sunrise,
    progress: 0.25,
    isTransition: true,
  });
  assert.deepEqual(atSunrise, {
    timeOfDay: TimeOfDay.Sunrise,
    progress: 0.5,
    isTransition: true,
  });
  assert.deepEqual(afterSunrise, {
    timeOfDay: TimeOfDay.Sunrise,
    progress: 0.75,
    isTransition: true,
  });
  assert.deepEqual(afterWindow, {
    timeOfDay: TimeOfDay.Day,
    progress: 1,
    isTransition: false,
  });
});

test("일몰 전후 1시간 동안 sunset 전환 상태를 유지한다", () => {
  const beforeSunset = resolveAutoTimeOfDayState(
    new Date("2026-05-02T17:30:00.000Z"),
    baseSunTimes,
  );
  const atSunset = resolveAutoTimeOfDayState(
    new Date("2026-05-02T18:00:00.000Z"),
    baseSunTimes,
  );
  const afterSunset = resolveAutoTimeOfDayState(
    new Date("2026-05-02T18:30:00.000Z"),
    baseSunTimes,
  );
  const afterWindow = resolveAutoTimeOfDayState(
    new Date("2026-05-02T19:01:00.000Z"),
    baseSunTimes,
  );

  assert.deepEqual(beforeSunset, {
    timeOfDay: TimeOfDay.Sunset,
    progress: 0.25,
    isTransition: true,
  });
  assert.deepEqual(atSunset, {
    timeOfDay: TimeOfDay.Sunset,
    progress: 0.5,
    isTransition: true,
  });
  assert.deepEqual(afterSunset, {
    timeOfDay: TimeOfDay.Sunset,
    progress: 0.75,
    isTransition: true,
  });
  assert.deepEqual(afterWindow, {
    timeOfDay: TimeOfDay.Night,
    progress: 1,
    isTransition: false,
  });
});
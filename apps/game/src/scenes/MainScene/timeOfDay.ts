export enum TimeOfDay {
  Day = "day",
  Sunrise = "sunrise",
  Sunset = "sunset",
  Night = "night",
}

export enum TimeOfDayMode {
  Manual = "manual",
  Auto = "auto",
}

export type SunLocationSource = "device" | "fallback";

export type SunTimesPayload = {
  sunriseAt: string;
  sunsetAt: string;
  date: string;
  timezone: string;
  timezoneOffsetMinutes: number;
  fetchedAt: string;
  locationSource: SunLocationSource;
  hasLocationPermission: boolean;
};

export type SunPermissionResult = {
  granted: boolean;
};

export type SkyVisualState = {
  timeOfDay: TimeOfDay;
  progress: number;
};

export type AutoTimeOfDayState = SkyVisualState & {
  isTransition: boolean;
};

export type TimeOfDayTone = {
  label: string;
};

export const TIME_OF_DAY_TONES: Record<TimeOfDay, TimeOfDayTone> = {
  [TimeOfDay.Day]: {
    label: "낮",
  },
  [TimeOfDay.Sunrise]: {
    label: "일출",
  },
  [TimeOfDay.Sunset]: {
    label: "일몰",
  },
  [TimeOfDay.Night]: {
    label: "밤",
  },
};

export const TIME_OF_DAY_OPTIONS = [
  TimeOfDay.Day,
  TimeOfDay.Sunrise,
  TimeOfDay.Sunset,
  TimeOfDay.Night,
] as const;

export const SUN_TRANSITION_WINDOW_MINUTES = 20;
export const SUN_TRANSITION_TOTAL_MINUTES = SUN_TRANSITION_WINDOW_MINUTES * 2;
const MINUTE_IN_MILLISECONDS = 60 * 1000;

const MANUAL_PROGRESS_PRESET: Record<TimeOfDay, number> = {
  [TimeOfDay.Day]: 1,
  [TimeOfDay.Sunrise]: 0.5,
  [TimeOfDay.Sunset]: 0.5,
  [TimeOfDay.Night]: 1,
};

export function getTimeOfDayLabel(timeOfDay: TimeOfDay): string {
  return TIME_OF_DAY_TONES[timeOfDay].label;
}

export function getManualSkyVisualState(timeOfDay: TimeOfDay): SkyVisualState {
  return {
    timeOfDay,
    progress: MANUAL_PROGRESS_PRESET[timeOfDay],
  };
}

export function resolveAutoTimeOfDayState(
  now: Date,
  sunTimes: SunTimesPayload,
): AutoTimeOfDayState {
  const { sunriseAt, sunsetAt } = projectSunTimesForDate(now, sunTimes);

  if (
    Number.isNaN(sunriseAt.getTime()) ||
    Number.isNaN(sunsetAt.getTime()) ||
    sunriseAt.getTime() >= sunsetAt.getTime()
  ) {
    return {
      timeOfDay: TimeOfDay.Day,
      progress: 1,
      isTransition: false,
    };
  }

  const sunriseWindow = createTransitionWindow(sunriseAt);
  const sunsetWindow = createTransitionWindow(sunsetAt);
  const nowTime = now.getTime();

  if (nowTime >= sunriseWindow.start && nowTime <= sunriseWindow.end) {
    return {
      timeOfDay: TimeOfDay.Sunrise,
      progress: getMinuteProgress(nowTime, sunriseWindow.start),
      isTransition: true,
    };
  }

  if (nowTime >= sunsetWindow.start && nowTime <= sunsetWindow.end) {
    return {
      timeOfDay: TimeOfDay.Sunset,
      progress: getMinuteProgress(nowTime, sunsetWindow.start),
      isTransition: true,
    };
  }

  if (nowTime > sunriseWindow.end && nowTime < sunsetWindow.start) {
    return {
      timeOfDay: TimeOfDay.Day,
      progress: 1,
      isTransition: false,
    };
  }

  return {
    timeOfDay: TimeOfDay.Night,
    progress: 1,
    isTransition: false,
  };
}

export function projectSunTimesForDate(
  now: Date,
  sunTimes: SunTimesPayload,
): {
  sunriseAt: Date;
  sunsetAt: Date;
} {
  const timezoneOffsetMinutes = sunTimes.timezoneOffsetMinutes;
  const dateString = getDateStringInTimezoneOffset(now, timezoneOffsetMinutes);
  const sunriseTemplate = new Date(sunTimes.sunriseAt);
  const sunsetTemplate = new Date(sunTimes.sunsetAt);

  return {
    sunriseAt: createProjectedDateInTimezoneOffset(
      dateString,
      sunriseTemplate,
      timezoneOffsetMinutes,
    ),
    sunsetAt: createProjectedDateInTimezoneOffset(
      dateString,
      sunsetTemplate,
      timezoneOffsetMinutes,
    ),
  };
}

export function hasSunTimesDateRolledOver(
  now: Date,
  sunTimes: SunTimesPayload,
): boolean {
  return getDateStringInTimezoneOffset(now, sunTimes.timezoneOffsetMinutes) !==
    sunTimes.date;
}

export function getDateStringInTimezoneOffset(
  date: Date,
  timezoneOffsetMinutes: number,
): string {
  const zonedDate = new Date(date.getTime() + timezoneOffsetMinutes * 60 * 1000);
  const year = zonedDate.getUTCFullYear();
  const month = `${zonedDate.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${zonedDate.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createTransitionWindow(center: Date): { start: number; end: number } {
  const halfWindow =
    SUN_TRANSITION_WINDOW_MINUTES * MINUTE_IN_MILLISECONDS;

  return {
    start: center.getTime() - halfWindow,
    end: center.getTime() + halfWindow,
  };
}

function createProjectedDateInTimezoneOffset(
  dateString: string,
  template: Date,
  timezoneOffsetMinutes: number,
): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  const zonedTemplate = new Date(
    template.getTime() + timezoneOffsetMinutes * 60 * 1000,
  );

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      zonedTemplate.getUTCHours(),
      zonedTemplate.getUTCMinutes(),
      zonedTemplate.getUTCSeconds(),
      zonedTemplate.getUTCMilliseconds(),
    ) -
      timezoneOffsetMinutes * 60 * 1000,
  );
}

function getMinuteProgress(nowTime: number, startTime: number): number {
  const elapsedMinutes = Math.floor((nowTime - startTime) / MINUTE_IN_MILLISECONDS);
  const clampedMinutes = Math.max(
    0,
    Math.min(SUN_TRANSITION_TOTAL_MINUTES, elapsedMinutes),
  );
  return clampedMinutes / SUN_TRANSITION_TOTAL_MINUTES;
}

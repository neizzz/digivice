import type {
  SunPermissionResult,
  SunTimesPayload,
} from "./timeOfDay";

function hasNativeSunController(): boolean {
  return typeof window !== "undefined" && !!window.sunController;
}

function isSunTimesPayload(value: unknown): value is SunTimesPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SunTimesPayload>;
  return (
    typeof candidate.sunriseAt === "string" &&
    typeof candidate.sunsetAt === "string" &&
    typeof candidate.date === "string" &&
    typeof candidate.timezone === "string" &&
    typeof candidate.timezoneOffsetMinutes === "number" &&
    typeof candidate.fetchedAt === "string" &&
    (candidate.locationSource === "device" ||
      candidate.locationSource === "fallback") &&
    typeof candidate.hasLocationPermission === "boolean"
  );
}

export async function getNativeSunTimes(
  promptForPermission = true,
): Promise<SunTimesPayload | null> {
  if (!hasNativeSunController()) {
    return null;
  }

  try {
    const payload = await window.sunController!.getSunTimes(promptForPermission);
    if (!isSunTimesPayload(payload)) {
      console.warn("[sunTimes] Invalid native sun times payload:", payload);
      return null;
    }
    return payload;
  } catch (error) {
    console.warn("[sunTimes] Failed to fetch native sun times:", error);
    return null;
  }
}

export async function requestNativeLocationPermission(): Promise<boolean> {
  if (!hasNativeSunController()) {
    return false;
  }

  try {
    const result = await window.sunController!.requestLocationPermission();
    return (
      !!result &&
      typeof (result as SunPermissionResult).granted === "boolean" &&
      (result as SunPermissionResult).granted
    );
  } catch (error) {
    console.warn("[sunTimes] Failed to request native location permission:", error);
    return false;
  }
}

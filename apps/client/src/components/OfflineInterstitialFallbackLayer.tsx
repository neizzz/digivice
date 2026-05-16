import type { TranslationKey, TranslationParams } from "@shared/i18n";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import PopupLayer from "./PopupLayer";

const FALLBACK_AD_DURATION_MS = 15_000;
const FALLBACK_AD_TICK_MS = 100;
const OFFLINE_AD_PIXEL_COLUMNS = 56;
const OFFLINE_AD_PIXEL_ROWS = 88;
const OFFLINE_AD_PIXEL_PALETTE = [
  "#010604",
  "#03100a",
  "#062016",
  "#0b3a24",
  "#116339",
  "#1f8f4f",
  "#34b86c",
  "#68d989",
] as const;

type OfflineInterstitialFallbackLayerProps = {
  onComplete: () => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
};

type Rgb = {
  r: number;
  g: number;
  b: number;
};

type OfflineAdPixelStyle = React.CSSProperties & {
  "--pixel-color-a": string;
  "--pixel-color-b": string;
  "--pixel-color-c": string;
  "--pixel-color-d": string;
};

function parseHexColor(hex: string): Rgb {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function mixColors(start: Rgb, end: Rgb, amount: number): string {
  const r = Math.round(start.r + (end.r - start.r) * amount);
  const g = Math.round(start.g + (end.g - start.g) * amount);
  const b = Math.round(start.b + (end.b - start.b) * amount);

  return `rgb(${r}, ${g}, ${b})`;
}

function samplePixelGradient(position: number): string {
  const normalizedPosition = ((position % 1) + 1) % 1;
  const scaledPosition =
    normalizedPosition * (OFFLINE_AD_PIXEL_PALETTE.length - 1);
  const startIndex = Math.floor(scaledPosition);
  const endIndex = Math.min(
    OFFLINE_AD_PIXEL_PALETTE.length - 1,
    startIndex + 1,
  );
  const amount = scaledPosition - startIndex;

  return mixColors(
    parseHexColor(OFFLINE_AD_PIXEL_PALETTE[startIndex]),
    parseHexColor(OFFLINE_AD_PIXEL_PALETTE[endIndex]),
    amount,
  );
}

function sampleCircularBlob(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  radius: number,
): number {
  const distance = Math.hypot(x - centerX, y - centerY);

  return Math.max(0, 1 - distance / radius);
}

const OFFLINE_AD_PIXEL_CELLS = Array.from(
  { length: OFFLINE_AD_PIXEL_COLUMNS * OFFLINE_AD_PIXEL_ROWS },
  (_, index) => {
    const x = index % OFFLINE_AD_PIXEL_COLUMNS;
    const y = Math.floor(index / OFFLINE_AD_PIXEL_COLUMNS);
    const normalizedX = x / (OFFLINE_AD_PIXEL_COLUMNS - 1);
    const normalizedY = y / (OFFLINE_AD_PIXEL_ROWS - 1);
    const diagonalDown = normalizedX * 0.24 + normalizedY * 0.26;
    const diagonalUp = normalizedX * 0.22 + (1 - normalizedY) * 0.18;
    const centerBlob = sampleCircularBlob(
      normalizedX,
      normalizedY,
      0.5,
      0.5,
      0.5,
    );
    const upperBlob = sampleCircularBlob(
      normalizedX,
      normalizedY,
      0.28,
      0.24,
      0.34,
    );
    const rightBlob = sampleCircularBlob(
      normalizedX,
      normalizedY,
      0.75,
      0.4,
      0.38,
    );
    const lowerBlob = sampleCircularBlob(
      normalizedX,
      normalizedY,
      0.36,
      0.78,
      0.36,
    );
    const waveA =
      (Math.sin((normalizedX * 1.5 + normalizedY * 1.2) * Math.PI) + 1) / 2;
    const waveB =
      (Math.cos((normalizedX * 1.2 - normalizedY * 1.4) * Math.PI) + 1) / 2;
    const gradientPosition =
      diagonalDown +
      diagonalUp +
      centerBlob * 0.22 +
      upperBlob * 0.2 +
      rightBlob * 0.18 +
      lowerBlob * 0.16 +
      waveA * 0.08 +
      waveB * 0.06;

    return {
      id: index,
      style: {
        "--pixel-color-a": samplePixelGradient(gradientPosition),
        "--pixel-color-b": samplePixelGradient(
          gradientPosition + upperBlob * 0.16 + waveB * 0.08,
        ),
        "--pixel-color-c": samplePixelGradient(
          gradientPosition + centerBlob * 0.18 + rightBlob * 0.1,
        ),
        "--pixel-color-d": samplePixelGradient(
          gradientPosition + lowerBlob * 0.16 + waveA * 0.1,
        ),
      } as OfflineAdPixelStyle,
    };
  },
);

const OfflineInterstitialFallbackLayer: React.FC<
  OfflineInterstitialFallbackLayerProps
> = ({ onComplete, t }) => {
  const remainingMsRef = useRef(FALLBACK_AD_DURATION_MS);
  const lastTickAtRef = useRef(0);
  const hasCompletedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const [remainingMs, setRemainingMs] = useState(FALLBACK_AD_DURATION_MS);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const getNow = () =>
      typeof window.performance?.now === "function"
        ? window.performance.now()
        : Date.now();

    const complete = () => {
      if (hasCompletedRef.current) {
        return;
      }

      hasCompletedRef.current = true;
      remainingMsRef.current = 0;
      setRemainingMs(0);
      onCompleteRef.current();
    };

    const tick = () => {
      const now = getNow();
      const isHidden =
        typeof document !== "undefined" && document.visibilityState !== "visible";

      if (isHidden) {
        lastTickAtRef.current = now;
        return;
      }

      if (lastTickAtRef.current <= 0) {
        lastTickAtRef.current = now;
        return;
      }

      const elapsedMs = Math.max(0, now - lastTickAtRef.current);
      lastTickAtRef.current = now;
      const nextRemainingMs = Math.max(0, remainingMsRef.current - elapsedMs);

      remainingMsRef.current = nextRemainingMs;
      setRemainingMs((previous) =>
        Math.ceil(previous / 100) === Math.ceil(nextRemainingMs / 100)
          ? previous
          : nextRemainingMs,
      );

      if (nextRemainingMs <= 0) {
        complete();
      }
    };

    const handleVisibilityChange = () => {
      lastTickAtRef.current = getNow();
    };

    lastTickAtRef.current = getNow();
    const intervalId = window.setInterval(tick, FALLBACK_AD_TICK_MS);

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const progressPercent =
    ((FALLBACK_AD_DURATION_MS - Math.max(0, remainingMs)) /
      FALLBACK_AD_DURATION_MS) *
    100;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-ad-title"
    >
      <div className="offline-ad-fallback-visualizer" aria-hidden="true">
        {OFFLINE_AD_PIXEL_CELLS.map((pixel) => (
          <span
            key={pixel.id}
            className="offline-ad-fallback-visualizer__pixel"
            style={pixel.style}
          />
        ))}
      </div>
      <div className="relative z-[1] w-full">
        <PopupLayer
          title={t("offlineAd.title")}
          content={
            <div className="space-y-4 text-center">
              <div id="offline-ad-title" className="sr-only">
                {t("offlineAd.title")}
              </div>
              <div>
                {t("offlineAd.message")}
              </div>
              <div
                className="mx-auto w-full max-w-[14rem] border-4 border-[#222] bg-[#201236] p-1 shadow-[2px_2px_0_#222]"
                aria-hidden="true"
              >
                <div className="h-4 bg-[#12091f]">
                  <div
                    className="h-full bg-[#69f0ae]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
              <div
                className="font-display text-[1.6rem] leading-[1.2] text-component-negative"
                aria-live="polite"
              >
                {t("offlineAd.returningIn", { seconds: remainingSeconds })}
              </div>
            </div>
          }
          showActions={false}
          initialFocusTarget="container"
        />
      </div>
    </div>
  );
};

export default OfflineInterstitialFallbackLayer;

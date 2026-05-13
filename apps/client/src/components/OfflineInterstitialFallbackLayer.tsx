import type React from "react";
import { useEffect, useRef, useState } from "react";
import PopupLayer from "./PopupLayer";

const FALLBACK_AD_DURATION_MS = 10_000;
const FALLBACK_AD_TICK_MS = 100;

type OfflineInterstitialFallbackLayerProps = {
  onComplete: () => void;
};

const OfflineInterstitialFallbackLayer: React.FC<
  OfflineInterstitialFallbackLayerProps
> = ({ onComplete }) => {
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
        <span className="offline-ad-fallback-visualizer__bar offline-ad-fallback-visualizer__bar--one" />
        <span className="offline-ad-fallback-visualizer__bar offline-ad-fallback-visualizer__bar--two" />
        <span className="offline-ad-fallback-visualizer__bar offline-ad-fallback-visualizer__bar--three" />
        <span className="offline-ad-fallback-visualizer__bar offline-ad-fallback-visualizer__bar--four" />
      </div>
      <div className="relative z-[1] w-full">
        <PopupLayer
          title="Connecting Ad..."
          content={
            <div className="space-y-4 text-center">
              <div id="offline-ad-title" className="sr-only">
                Connecting Ad...
              </div>
              <div>
                We're connecting to the ad network. You'll return to the game
                automatically.
              </div>
              <div className="text-[1.1rem] leading-[1.4] text-[#534741]">
                This can take up to 10 seconds.
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
                Returning in {remainingSeconds}s
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

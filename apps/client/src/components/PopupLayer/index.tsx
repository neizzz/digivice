import type React from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { logImportantDiagnostics } from "../../diagnostics/diagnosticLogger";
import { useI18n } from "../../i18n";
import { useLayerInteractionVibration } from "../../hooks/useLayerInteractionVibration";

interface PopupProps {
  title?: string;
  content: React.ReactNode;
  topLeftContent?: React.ReactNode;
  dividerBorderClassName?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmDisabled?: boolean;
  confirmVariant?: "positive" | "negative";
  cancelVariant?: "positive" | "negative";
  initialFocusTarget?: "confirm" | "cancel" | "container" | "none";
  keyboardAwareTargetRef?: React.RefObject<HTMLElement | null>;
  keyboardAwareViewportPadding?: number;
  suppressInitialActionsMs?: number;
  confirmEnableDelayMs?: number;
  showActions?: boolean;
}

type NativeViewportSyncDetail = {
  bottomInset?: number | null;
};

const KEYBOARD_VIEWPORT_HEIGHT_DELTA_THRESHOLD = 80;
const KEYBOARD_AWARE_DEBUG_LOG_LIMIT = 24;
const CONFIRM_ENABLE_DELAY_PROGRESS_MAX = 100;

function roundKeyboardAwareDebugValue(
  value: number | null | undefined,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 100) / 100;
}

const PopupLayer: React.FC<PopupProps> = ({
  title,
  content,
  topLeftContent,
  dividerBorderClassName = "border-[#222]",
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  confirmDisabled = false,
  confirmVariant = "positive",
  cancelVariant = "negative",
  initialFocusTarget = "none",
  keyboardAwareTargetRef,
  keyboardAwareViewportPadding = 16,
  suppressInitialActionsMs = 0,
  confirmEnableDelayMs = 0,
  showActions = true,
}) => {
  const { t } = useI18n();
  const resolvedTitle = title ?? t("alert.title");
  const resolvedConfirmText = confirmText ?? t("common.confirm");
  const resolvedCancelText = cancelText ?? t("common.cancel");
  const layerInteractionVibrationProps = useLayerInteractionVibration();
  const containerRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmEnableDelayRafIdRef = useRef<number | null>(null);
  const keyboardAwareRafIdRef = useRef<number | null>(null);
  const keyboardAwareOffsetYRef = useRef(0);
  const keyboardAwareMaxHeightRef = useRef<number | null>(null);
  const keyboardAwareWasVisibleRef = useRef(false);
  const keyboardAwareDebugSequenceRef = useRef(0);
  const nativeKeyboardInsetRef = useRef(0);
  const suppressInitialActionsUntilRef = useRef(0);
  const [confirmEnableDelayProgress, setConfirmEnableDelayProgress] = useState(
    confirmEnableDelayMs > 0 ? 0 : CONFIRM_ENABLE_DELAY_PROGRESS_MAX,
  );
  const [keyboardAwareOffsetY, setKeyboardAwareOffsetY] = useState(0);
  const [keyboardAwareMaxHeight, setKeyboardAwareMaxHeight] = useState<
    number | null
  >(null);
  const isConfirmEnableDelayActive =
    !confirmDisabled &&
    confirmEnableDelayMs > 0 &&
    confirmEnableDelayProgress < CONFIRM_ENABLE_DELAY_PROGRESS_MAX;
  const isConfirmButtonDisabled =
    confirmDisabled || isConfirmEnableDelayActive;
  const effectiveInitialFocusTargetRef = useRef<
    "confirm" | "cancel" | "container" | "none"
  >(
    confirmEnableDelayMs > 0 && initialFocusTarget === "confirm"
      ? "container"
      : initialFocusTarget,
  );
  const effectiveInitialFocusTarget = effectiveInitialFocusTargetRef.current;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (confirmEnableDelayRafIdRef.current !== null) {
      window.cancelAnimationFrame(confirmEnableDelayRafIdRef.current);
      confirmEnableDelayRafIdRef.current = null;
    }

    if (confirmEnableDelayMs <= 0) {
      setConfirmEnableDelayProgress(CONFIRM_ENABLE_DELAY_PROGRESS_MAX);
      return;
    }

    if (confirmDisabled) {
      setConfirmEnableDelayProgress(0);
      return;
    }

    setConfirmEnableDelayProgress(0);

    const startedAt = window.performance.now();

    const tick = (timestamp: number) => {
      const elapsed = Math.max(0, timestamp - startedAt);
      const nextProgress = Math.min(
        CONFIRM_ENABLE_DELAY_PROGRESS_MAX,
        Math.round(
          (elapsed / confirmEnableDelayMs) * CONFIRM_ENABLE_DELAY_PROGRESS_MAX,
        ),
      );

      setConfirmEnableDelayProgress((previous) =>
        previous === nextProgress ? previous : nextProgress,
      );

      if (nextProgress >= CONFIRM_ENABLE_DELAY_PROGRESS_MAX) {
        confirmEnableDelayRafIdRef.current = null;
        return;
      }

      confirmEnableDelayRafIdRef.current = window.requestAnimationFrame(tick);
    };

    confirmEnableDelayRafIdRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (confirmEnableDelayRafIdRef.current !== null) {
        window.cancelAnimationFrame(confirmEnableDelayRafIdRef.current);
        confirmEnableDelayRafIdRef.current = null;
      }
    };
  }, [confirmDisabled, confirmEnableDelayMs]);

  const emitKeyboardAwareDebug = useCallback(
    (stage: string, payload: Record<string, unknown> = {}) => {
      if (resolvedTitle !== t("settings.title")) {
        return;
      }

      if (
        keyboardAwareDebugSequenceRef.current >= KEYBOARD_AWARE_DEBUG_LOG_LIMIT
      ) {
        return;
      }

      keyboardAwareDebugSequenceRef.current += 1;

      logImportantDiagnostics(
        "warn",
        "[ImportantDiagnostics][PopupLayerKeyboardAware]",
        {
          title: resolvedTitle,
          stage,
          sequence: keyboardAwareDebugSequenceRef.current,
          ...payload,
        },
      );
    },
    [resolvedTitle, t],
  );

  const resetKeyboardAwareLayout = useCallback(
    (reason: string) => {
      emitKeyboardAwareDebug("reset", {
        reason,
        offsetY: keyboardAwareOffsetYRef.current,
        maxHeight: keyboardAwareMaxHeightRef.current,
        wasVisible: keyboardAwareWasVisibleRef.current,
      });

      keyboardAwareOffsetYRef.current = 0;
      keyboardAwareMaxHeightRef.current = null;
      keyboardAwareWasVisibleRef.current = false;
      setKeyboardAwareOffsetY((previous) => (previous === 0 ? previous : 0));
      setKeyboardAwareMaxHeight((previous) =>
        previous === null ? previous : null,
      );
    },
    [emitKeyboardAwareDebug],
  );

  const updateKeyboardAwareLayout = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const popupElement = containerRef.current;
    const targetElement = keyboardAwareTargetRef?.current;
    const visualViewport = window.visualViewport;

    if (!popupElement || !targetElement || !visualViewport) {
      emitKeyboardAwareDebug("missing_primitives", {
        hasPopupElement: !!popupElement,
        hasTargetElement: !!targetElement,
        hasVisualViewport: !!visualViewport,
      });
      resetKeyboardAwareLayout("missing_primitives");
      return;
    }

    const activeElement = document.activeElement;
    const nativeKeyboardInset = Math.max(0, nativeKeyboardInsetRef.current);
    const baseViewportHeight = Math.max(
      window.innerHeight,
      document.documentElement.clientHeight || 0,
      nativeKeyboardInset > 0 ? visualViewport.height + nativeKeyboardInset : 0,
    );
    const viewportHeightDelta = baseViewportHeight - visualViewport.height;
    const isKeyboardVisible =
      nativeKeyboardInset > 0 ||
      viewportHeightDelta >= KEYBOARD_VIEWPORT_HEIGHT_DELTA_THRESHOLD;

    if (activeElement !== targetElement) {
      emitKeyboardAwareDebug("inactive_target", {
        activeElementTag:
          activeElement instanceof HTMLElement ? activeElement.tagName : null,
        targetTag: targetElement.tagName,
      });
      resetKeyboardAwareLayout("inactive_target");
      return;
    }

    if (!isKeyboardVisible) {
      emitKeyboardAwareDebug("keyboard_hidden", {
        nativeKeyboardInset,
        viewportHeightDelta: roundKeyboardAwareDebugValue(viewportHeightDelta),
      });
      resetKeyboardAwareLayout("keyboard_hidden");
      return;
    }

    if (!keyboardAwareWasVisibleRef.current) {
      emitKeyboardAwareDebug("keyboard_visible_enter", {
        nativeKeyboardInset,
        viewportHeightDelta: roundKeyboardAwareDebugValue(viewportHeightDelta),
        scrollTop: popupElement.scrollTop,
      });
      keyboardAwareWasVisibleRef.current = true;
    }

    const visibleTop = visualViewport.offsetTop;
    const visibleBottom = visualViewport.offsetTop + visualViewport.height;
    const availableHeight = Math.max(
      0,
      visualViewport.height - keyboardAwareViewportPadding * 2,
    );

    if (keyboardAwareMaxHeightRef.current !== availableHeight) {
      keyboardAwareMaxHeightRef.current = availableHeight;
    }

    setKeyboardAwareMaxHeight((previous) =>
      previous === availableHeight ? previous : availableHeight,
    );

    const popupRect = popupElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const currentOffsetY = keyboardAwareOffsetYRef.current;
    const currentLayoutTop = popupRect.top - currentOffsetY;
    const currentLayoutBottom = popupRect.bottom - currentOffsetY;
    const currentTargetCenterY =
      targetRect.top + targetRect.height / 2 - currentOffsetY;
    const desiredCenterY = visibleTop + visualViewport.height / 2;
    const desiredShift = desiredCenterY - currentTargetCenterY;
    const minShift =
      visibleTop + keyboardAwareViewportPadding - currentLayoutTop;
    const maxShift =
      visibleBottom - keyboardAwareViewportPadding - currentLayoutBottom;

    const clampedShift =
      minShift <= maxShift
        ? Math.min(Math.max(desiredShift, minShift), maxShift)
        : Math.min(Math.max(desiredShift, maxShift), minShift);

    const roundedShift = Math.round(clampedShift);
    keyboardAwareOffsetYRef.current = roundedShift;

    emitKeyboardAwareDebug("layout_applied", {
      nativeKeyboardInset,
      viewportHeightDelta: roundKeyboardAwareDebugValue(viewportHeightDelta),
      visibleTop: roundKeyboardAwareDebugValue(visibleTop),
      visibleBottom: roundKeyboardAwareDebugValue(visibleBottom),
      availableHeight: roundKeyboardAwareDebugValue(availableHeight),
      popupTop: roundKeyboardAwareDebugValue(popupRect.top),
      popupBottom: roundKeyboardAwareDebugValue(popupRect.bottom),
      targetTop: roundKeyboardAwareDebugValue(targetRect.top),
      targetBottom: roundKeyboardAwareDebugValue(targetRect.bottom),
      scrollTop: popupElement.scrollTop,
      currentOffsetY,
      currentLayoutTop: roundKeyboardAwareDebugValue(currentLayoutTop),
      currentTargetCenterY: roundKeyboardAwareDebugValue(currentTargetCenterY),
      desiredShift: roundKeyboardAwareDebugValue(desiredShift),
      minShift: roundKeyboardAwareDebugValue(minShift),
      maxShift: roundKeyboardAwareDebugValue(maxShift),
      roundedShift,
    });

    setKeyboardAwareOffsetY((previous) =>
      previous === roundedShift ? previous : roundedShift,
    );
  }, [
    emitKeyboardAwareDebug,
    keyboardAwareTargetRef,
    keyboardAwareViewportPadding,
    resetKeyboardAwareLayout,
  ]);

  const scheduleKeyboardAwareLayoutUpdate = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (keyboardAwareRafIdRef.current !== null) {
      window.cancelAnimationFrame(keyboardAwareRafIdRef.current);
    }

    keyboardAwareRafIdRef.current = window.requestAnimationFrame(() => {
      keyboardAwareRafIdRef.current = null;
      updateKeyboardAwareLayout();
    });
  }, [updateKeyboardAwareLayout]);

  useLayoutEffect(() => {
    suppressInitialActionsUntilRef.current =
      Date.now() + Math.max(0, suppressInitialActionsMs);

    return () => {
      suppressInitialActionsUntilRef.current = 0;
    };
  }, [suppressInitialActionsMs]);

  useLayoutEffect(() => {
    const focusTarget =
      effectiveInitialFocusTarget === "confirm"
        ? confirmButtonRef.current
        : effectiveInitialFocusTarget === "cancel"
          ? cancelButtonRef.current
          : effectiveInitialFocusTarget === "container"
            ? containerRef.current
            : null;

    if (!focusTarget) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      emitKeyboardAwareDebug("initial_focus", {
        focusTargetTag: focusTarget.tagName,
        initialFocusTarget: effectiveInitialFocusTarget,
      });
      focusTarget.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [effectiveInitialFocusTarget, emitKeyboardAwareDebug]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const targetElement = keyboardAwareTargetRef?.current;
    const visualViewport = window.visualViewport;

    if (!targetElement || !visualViewport) {
      emitKeyboardAwareDebug("effect_missing_target", {
        hasTargetElement: !!targetElement,
        hasVisualViewport: !!visualViewport,
      });
      resetKeyboardAwareLayout("effect_missing_target");
      return;
    }

    emitKeyboardAwareDebug("effect_attached", {
      targetTag: targetElement.tagName,
      initialFocusTarget: effectiveInitialFocusTarget,
    });

    const handleKeyboardAwareLayoutChange = (source: string) => {
      emitKeyboardAwareDebug("schedule", {
        source,
        scrollTop: containerRef.current?.scrollTop ?? null,
        offsetY: keyboardAwareOffsetYRef.current,
        maxHeight: keyboardAwareMaxHeightRef.current,
      });
      scheduleKeyboardAwareLayoutUpdate();
    };
    const handleNativeViewportSync = (event: Event) => {
      const detail = (event as CustomEvent<NativeViewportSyncDetail>).detail;

      nativeKeyboardInsetRef.current = Math.max(0, detail?.bottomInset ?? 0);
      emitKeyboardAwareDebug("native_viewport_sync", {
        bottomInset: nativeKeyboardInsetRef.current,
        visualViewportHeight: roundKeyboardAwareDebugValue(
          visualViewport.height,
        ),
        visualViewportOffsetTop: roundKeyboardAwareDebugValue(
          visualViewport.offsetTop,
        ),
      });
      scheduleKeyboardAwareLayoutUpdate();
    };

    const handleTargetFocus = () => {
      handleKeyboardAwareLayoutChange("target_focus");
    };
    const handleTargetBlur = () => {
      handleKeyboardAwareLayoutChange("target_blur");
    };
    const handleWindowResize = () => {
      handleKeyboardAwareLayoutChange("window_resize");
    };
    const handleVisualViewportResize = () => {
      handleKeyboardAwareLayoutChange("visual_viewport_resize");
    };
    const handleVisualViewportScroll = () => {
      handleKeyboardAwareLayoutChange("visual_viewport_scroll");
    };

    targetElement.addEventListener("focus", handleTargetFocus);
    targetElement.addEventListener("blur", handleTargetBlur);
    window.addEventListener(
      "digivice:native-viewport-sync",
      handleNativeViewportSync,
    );
    window.addEventListener("resize", handleWindowResize);
    visualViewport.addEventListener("resize", handleVisualViewportResize);
    visualViewport.addEventListener("scroll", handleVisualViewportScroll);

    handleKeyboardAwareLayoutChange("effect_attached");

    return () => {
      targetElement.removeEventListener("focus", handleTargetFocus);
      targetElement.removeEventListener("blur", handleTargetBlur);
      window.removeEventListener(
        "digivice:native-viewport-sync",
        handleNativeViewportSync,
      );
      window.removeEventListener("resize", handleWindowResize);
      visualViewport.removeEventListener("resize", handleVisualViewportResize);
      visualViewport.removeEventListener("scroll", handleVisualViewportScroll);

      if (keyboardAwareRafIdRef.current !== null) {
        window.cancelAnimationFrame(keyboardAwareRafIdRef.current);
        keyboardAwareRafIdRef.current = null;
      }

      nativeKeyboardInsetRef.current = 0;
      resetKeyboardAwareLayout("effect_cleanup");
    };
  }, [
    effectiveInitialFocusTarget,
    emitKeyboardAwareDebug,
    keyboardAwareTargetRef,
    resetKeyboardAwareLayout,
    scheduleKeyboardAwareLayoutUpdate,
  ]);

  const handleConfirmClick = useCallback(() => {
    if (
      isConfirmButtonDisabled ||
      Date.now() < suppressInitialActionsUntilRef.current
    ) {
      return;
    }

    onConfirm?.();
  }, [isConfirmButtonDisabled, onConfirm]);

  const handleCancelClick = useCallback(() => {
    if (Date.now() < suppressInitialActionsUntilRef.current) {
      return;
    }

    onCancel?.();
  }, [onCancel]);

  return (
    <div
      className="flex w-full justify-center px-4 text-black"
      {...layerInteractionVibrationProps}
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        style={{
          transform:
            keyboardAwareOffsetY !== 0
              ? `translateY(${keyboardAwareOffsetY}px)`
              : undefined,
          maxHeight:
            keyboardAwareMaxHeight !== null
              ? `${keyboardAwareMaxHeight}px`
              : undefined,
        }}
        className="relative flex w-full max-w-[22rem] flex-col overflow-auto border-4 border-[#222] bg-layer-bg p-5 text-center font-dialog shadow-[0_4px_0_#222,0_-4px_0_#222,4px_0_0_#222,-4px_0_0_#222,4px_4px_0_#222,-4px_4px_0_#222,4px_-4px_0_#222,-4px_-4px_0_#222] focus:outline-none"
      >
        {topLeftContent ? (
          <div className="absolute left-2 top-2 z-[1]">{topLeftContent}</div>
        ) : null}
        <div
          className={`mb-[15px] flex-none border-b-4 pb-[10px] text-[1.8rem] leading-[1.2] font-display font-bold text-component-negative ${dividerBorderClassName}`}
        >
          {resolvedTitle}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-4 text-[1.4rem] leading-[1.6]">
          {content}
        </div>
        {showActions && (
          <div
            className={`flex flex-none justify-center gap-[15px] border-t-4 pt-4 ${dividerBorderClassName}`}
          >
            {onCancel && (
              <button
                ref={cancelButtonRef}
                type={"button"}
                onClick={handleCancelClick}
                className={`text-[1.5rem] text-white border-2 border-[#222] px-[15px] py-0.5 cursor-pointer uppercase font-display shadow-[2px_2px_0_#222] relative top-0 left-0 transition-all duration-50 ${
                  cancelVariant === "negative"
                    ? "bg-component-negative"
                    : "bg-component-positive"
                }`}
              >
                {resolvedCancelText}
              </button>
            )}
            <button
              ref={confirmButtonRef}
              type={"button"}
              disabled={isConfirmButtonDisabled}
              onClick={handleConfirmClick}
              className={`relative overflow-hidden text-[1.5rem] text-white border-2 border-[#222] px-[15px] py-0.5 uppercase font-display shadow-[2px_2px_0_#222] ${
                isConfirmButtonDisabled
                  ? "cursor-not-allowed bg-gray-400 opacity-80"
                  : confirmVariant === "negative"
                    ? "cursor-pointer bg-component-negative"
                    : "cursor-pointer bg-component-positive"
              }`}
            >
              {isConfirmEnableDelayActive && (
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 ${
                    confirmVariant === "negative"
                      ? "bg-component-negative"
                      : "bg-component-positive"
                  }`}
                  style={{ width: `${confirmEnableDelayProgress}%` }}
                />
              )}
              <span className="relative z-[1]">{resolvedConfirmText}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PopupLayer;

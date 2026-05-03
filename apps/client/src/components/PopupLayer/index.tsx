import type React from "react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { logImportantDiagnostics } from "../../diagnostics/diagnosticLogger";
import { useLayerInteractionVibration } from "../../hooks/useLayerInteractionVibration";

interface PopupProps {
  title: string;
  content: React.ReactNode;
  topLeftContent?: React.ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "positive" | "negative";
  cancelVariant?: "positive" | "negative";
  initialFocusTarget?: "confirm" | "cancel" | "container" | "none";
  keyboardAwareTargetRef?: React.RefObject<HTMLElement | null>;
  keyboardAwareViewportPadding?: number;
  suppressInitialActionsMs?: number;
}

type NativeViewportSyncDetail = {
  bottomInset?: number | null;
};

const KEYBOARD_VIEWPORT_HEIGHT_DELTA_THRESHOLD = 80;
const KEYBOARD_AWARE_DEBUG_LOG_LIMIT = 24;

function roundKeyboardAwareDebugValue(
  value: number | null | undefined,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 100) / 100;
}

const PopupLayer: React.FC<PopupProps> = ({
  title = "Alert!",
  content,
  topLeftContent,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "positive",
  cancelVariant = "negative",
  initialFocusTarget = "none",
  keyboardAwareTargetRef,
  keyboardAwareViewportPadding = 16,
  suppressInitialActionsMs = 0,
}) => {
  const layerInteractionVibrationProps = useLayerInteractionVibration();
  const containerRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const keyboardAwareRafIdRef = useRef<number | null>(null);
  const keyboardAwareOffsetYRef = useRef(0);
  const keyboardAwareMaxHeightRef = useRef<number | null>(null);
  const keyboardAwareWasVisibleRef = useRef(false);
  const keyboardAwareDebugSequenceRef = useRef(0);
  const nativeKeyboardInsetRef = useRef(0);
  const suppressInitialActionsUntilRef = useRef(0);
  const [keyboardAwareOffsetY, setKeyboardAwareOffsetY] = useState(0);
  const [keyboardAwareMaxHeight, setKeyboardAwareMaxHeight] = useState<
    number | null
  >(null);

  const emitKeyboardAwareDebug = useCallback(
    (stage: string, payload: Record<string, unknown> = {}) => {
      if (title !== "Settings") {
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
          title,
          stage,
          sequence: keyboardAwareDebugSequenceRef.current,
          ...payload,
        },
      );
    },
    [title],
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
      initialFocusTarget === "confirm"
        ? confirmButtonRef.current
        : initialFocusTarget === "cancel"
          ? cancelButtonRef.current
          : initialFocusTarget === "container"
            ? containerRef.current
            : null;

    if (!focusTarget) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      emitKeyboardAwareDebug("initial_focus", {
        focusTargetTag: focusTarget.tagName,
        initialFocusTarget,
      });
      focusTarget.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [emitKeyboardAwareDebug, initialFocusTarget]);

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
      initialFocusTarget,
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
    emitKeyboardAwareDebug,
    initialFocusTarget,
    keyboardAwareTargetRef,
    resetKeyboardAwareLayout,
    scheduleKeyboardAwareLayoutUpdate,
  ]);

  const handleConfirmClick = useCallback(() => {
    if (Date.now() < suppressInitialActionsUntilRef.current) {
      return;
    }

    onConfirm?.();
  }, [onConfirm]);

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
        className="relative w-full max-w-[22rem] overflow-y-auto border-4 border-[#222] bg-layer-bg p-5 text-center shadow-[0_4px_0_#222,0_-4px_0_#222,4px_0_0_#222,-4px_0_0_#222,4px_4px_0_#222,-4px_4px_0_#222,4px_-4px_0_#222,-4px_-4px_0_#222] focus:outline-none"
      >
        {topLeftContent ? (
          <div className="absolute left-2 top-2 z-[1]">{topLeftContent}</div>
        ) : null}
        <div className="mb-[15px] border-b-4 border-[#222] pb-[10px] text-lg font-bold text-component-negative">
          {title}
        </div>
        <div className="pb-4 leading-[1.6] text-base">{content}</div>
        <div className="flex justify-center gap-[15px] border-t-4 border-[#222] pt-4">
          {onCancel && (
            <button
              ref={cancelButtonRef}
              type={"button"}
              onClick={handleCancelClick}
              className={`text-base text-white border-2 border-[#222] p-[10px_15px] cursor-pointer uppercase shadow-[2px_2px_0_#222] relative top-0 left-0 transition-all duration-50 ${
                cancelVariant === "negative"
                  ? "bg-component-negative"
                  : "bg-component-positive"
              }`}
            >
              {cancelText}
            </button>
          )}
          <button
            ref={confirmButtonRef}
            type={"button"}
            onClick={handleConfirmClick}
            className={`text-base text-white border-2 border-[#222] p-[10px_15px] cursor-pointer uppercase shadow-[2px_2px_0_#222] ${
              confirmVariant === "negative"
                ? "bg-component-negative"
                : "bg-component-positive"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PopupLayer;

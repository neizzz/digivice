import type React from "react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useLayerInteractionVibration } from "../../hooks/useLayerInteractionVibration";

interface PopupProps {
  title: string;
  content: React.ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  initialFocusTarget?: "confirm" | "cancel" | "container" | "none";
  keyboardAwareTargetRef?: React.RefObject<HTMLElement | null>;
  keyboardAwareViewportPadding?: number;
  suppressInitialActionsMs?: number;
}

const KEYBOARD_VIEWPORT_HEIGHT_DELTA_THRESHOLD = 80;

const PopupLayer: React.FC<PopupProps> = ({
  title = "Alert!",
  content,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
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
  const suppressInitialActionsUntilRef = useRef(0);
  const [keyboardAwareOffsetY, setKeyboardAwareOffsetY] = useState(0);
  const [keyboardAwareMaxHeight, setKeyboardAwareMaxHeight] = useState<
    number | null
  >(null);

  const resetKeyboardAwareLayout = useCallback(() => {
    setKeyboardAwareOffsetY((previous) => (previous === 0 ? previous : 0));
    setKeyboardAwareMaxHeight((previous) =>
      previous === null ? previous : null,
    );
  }, []);

  const updateKeyboardAwareLayout = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const popupElement = containerRef.current;
    const targetElement = keyboardAwareTargetRef?.current;
    const visualViewport = window.visualViewport;

    if (!popupElement || !targetElement || !visualViewport) {
      resetKeyboardAwareLayout();
      return;
    }

    const activeElement = document.activeElement;
    const baseViewportHeight = Math.max(
      window.innerHeight,
      document.documentElement.clientHeight || 0,
    );
    const viewportHeightDelta = baseViewportHeight - visualViewport.height;

    if (
      activeElement !== targetElement ||
      viewportHeightDelta < KEYBOARD_VIEWPORT_HEIGHT_DELTA_THRESHOLD
    ) {
      resetKeyboardAwareLayout();
      return;
    }

    const visibleTop = visualViewport.offsetTop;
    const visibleBottom = visualViewport.offsetTop + visualViewport.height;
    const availableHeight = Math.max(
      0,
      visualViewport.height - keyboardAwareViewportPadding * 2,
    );

    setKeyboardAwareMaxHeight((previous) =>
      previous === availableHeight ? previous : availableHeight,
    );

    const popupRect = popupElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const desiredCenterY = visibleTop + visualViewport.height / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;
    const desiredShift = desiredCenterY - targetCenterY;
    const minShift =
      visibleTop + keyboardAwareViewportPadding - popupRect.top;
    const maxShift =
      visibleBottom - keyboardAwareViewportPadding - popupRect.bottom;

    const clampedShift =
      minShift <= maxShift
        ? Math.min(Math.max(desiredShift, minShift), maxShift)
        : Math.min(Math.max(desiredShift, maxShift), minShift);

    const roundedShift = Math.round(clampedShift);
    setKeyboardAwareOffsetY((previous) =>
      previous === roundedShift ? previous : roundedShift,
    );
  }, [keyboardAwareTargetRef, keyboardAwareViewportPadding, resetKeyboardAwareLayout]);

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
      focusTarget.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [initialFocusTarget]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const targetElement = keyboardAwareTargetRef?.current;
    const visualViewport = window.visualViewport;

    if (!targetElement || !visualViewport) {
      resetKeyboardAwareLayout();
      return;
    }

    const handleKeyboardAwareLayoutChange = () => {
      scheduleKeyboardAwareLayoutUpdate();
    };

    targetElement.addEventListener("focus", handleKeyboardAwareLayoutChange);
    targetElement.addEventListener("blur", handleKeyboardAwareLayoutChange);
    window.addEventListener("resize", handleKeyboardAwareLayoutChange);
    visualViewport.addEventListener("resize", handleKeyboardAwareLayoutChange);
    visualViewport.addEventListener("scroll", handleKeyboardAwareLayoutChange);

    scheduleKeyboardAwareLayoutUpdate();

    return () => {
      targetElement.removeEventListener(
        "focus",
        handleKeyboardAwareLayoutChange,
      );
      targetElement.removeEventListener("blur", handleKeyboardAwareLayoutChange);
      window.removeEventListener("resize", handleKeyboardAwareLayoutChange);
      visualViewport.removeEventListener(
        "resize",
        handleKeyboardAwareLayoutChange,
      );
      visualViewport.removeEventListener(
        "scroll",
        handleKeyboardAwareLayoutChange,
      );

      if (keyboardAwareRafIdRef.current !== null) {
        window.cancelAnimationFrame(keyboardAwareRafIdRef.current);
        keyboardAwareRafIdRef.current = null;
      }

      resetKeyboardAwareLayout();
    };
  }, [
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
        <div className="text-xl text-component-negative font-bold mb-[15px] pb-[10px] border-b-4 border-[#222]">
          {title}
        </div>
        <div className="mb-5 leading-[1.6] text-base">{content}</div>
        <div className="flex justify-center gap-[15px]">
          {onCancel && (
            <button
              ref={cancelButtonRef}
              type={"button"}
              onClick={handleCancelClick}
              className="text-base bg-component-negative text-white border-2 border-[#222] p-[10px_15px] cursor-pointer uppercase shadow-[2px_2px_0_#222] relative top-0 left-0 transition-all duration-50"
            >
              {cancelText}
            </button>
          )}
          <button
            ref={confirmButtonRef}
            type={"button"}
            onClick={handleConfirmClick}
            className="text-base bg-component-positive text-white border-2 border-[#222] p-[10px_15px]  cursor-pointer uppercase shadow-[2px_2px_0_#222]"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PopupLayer;

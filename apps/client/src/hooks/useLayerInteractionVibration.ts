import { useCallback } from "react";
import type React from "react";
import { VibrationAdapter } from "../adapter/VibrationAdapter";

const CLICK_VIBRATION_SELECTOR = [
  "button",
  "[role='button']",
  "a[href]",
  "input[type='button']",
  "input[type='submit']",
  "input[type='reset']",
  "input[type='checkbox']",
  "input[type='radio']",
].join(", ");

const FOCUS_VIBRATION_SELECTOR = [
  "input:not([type='button']):not([type='submit']):not([type='reset']):not([type='checkbox']):not([type='radio'])",
  "textarea",
  "select",
].join(", ");

const vibrationAdapter = new VibrationAdapter();

function findClosestInteractiveElement(
  target: EventTarget | null,
  selector: string,
): HTMLElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const matchedElement = target.closest(selector);

  return matchedElement instanceof HTMLElement ? matchedElement : null;
}

function isDisabledInteractiveElement(element: HTMLElement): boolean {
  if (element.matches(":disabled")) {
    return true;
  }

  if (element.getAttribute("aria-disabled") === "true") {
    return true;
  }

  return false;
}

export function useLayerInteractionVibration() {
  const handleClickCapture = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const interactiveElement = findClosestInteractiveElement(
        event.target,
        CLICK_VIBRATION_SELECTOR,
      );

      if (
        !interactiveElement ||
        isDisabledInteractiveElement(interactiveElement)
      ) {
        return;
      }

      void vibrationAdapter.vibrate();
    },
    [],
  );

  const handleFocusCapture = useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      const interactiveElement = findClosestInteractiveElement(
        event.target,
        FOCUS_VIBRATION_SELECTOR,
      );

      if (
        !interactiveElement ||
        isDisabledInteractiveElement(interactiveElement)
      ) {
        return;
      }

      if (
        interactiveElement instanceof HTMLInputElement ||
        interactiveElement instanceof HTMLTextAreaElement
      ) {
        if (interactiveElement.readOnly) {
          return;
        }
      }

      void vibrationAdapter.vibrate();
    },
    [],
  );

  return {
    onClickCapture: handleClickCapture,
    onFocusCapture: handleFocusCapture,
  };
}

export default useLayerInteractionVibration;

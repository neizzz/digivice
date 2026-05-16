import { logImportantDiagnostics } from "./diagnostics/diagnosticLogger";

export type PopupBackHandler = () => void | Promise<void>;

type PopupBackHandlerRegistration = {
  id: symbol;
  getHandler: () => PopupBackHandler | null | undefined;
};

const popupBackHandlerStack: PopupBackHandlerRegistration[] = [];
const POPUP_BACK_EVENT_NAME = "digivice:native-back-request";
let isPopupBackEventListenerInstalled = false;
let isPopupBackBridgeInstalled = false;

function reportPopupBackHandlerError(error: unknown): void {
  logImportantDiagnostics(
    "error",
    "[ImportantDiagnostics][PopupBackNavigation] Failed to handle popup back navigation.",
    error,
  );
  console.warn(
    "[PopupBackNavigation] Failed to handle popup back navigation.",
    error,
  );
}

export function registerPopupBackHandler(
  getHandler: () => PopupBackHandler | null | undefined,
): () => void {
  const registration = {
    id: Symbol("popupBackHandler"),
    getHandler,
  };

  popupBackHandlerStack.push(registration);

  return () => {
    const index = popupBackHandlerStack.findIndex(
      (candidate) => candidate.id === registration.id,
    );

    if (index >= 0) {
      popupBackHandlerStack.splice(index, 1);
    }
  };
}

export function consumeTopPopupBackHandler(): boolean {
  for (let index = popupBackHandlerStack.length - 1; index >= 0; index -= 1) {
    const handler = popupBackHandlerStack[index]?.getHandler();

    if (!handler) {
      continue;
    }

    try {
      void Promise.resolve(handler()).catch(reportPopupBackHandlerError);
    } catch (error) {
      reportPopupBackHandlerError(error);
    }

    return true;
  }

  return false;
}

export function installPopupBackEventListener(): void {
  if (typeof window === "undefined" || isPopupBackEventListenerInstalled) {
    return;
  }

  isPopupBackEventListenerInstalled = true;

  window.addEventListener(POPUP_BACK_EVENT_NAME, (event) => {
    if (consumeTopPopupBackHandler()) {
      event.preventDefault();
    }
  });
}

export function installPopupBackBridge(): void {
  if (typeof window === "undefined" || isPopupBackBridgeInstalled) {
    return;
  }

  isPopupBackBridgeInstalled = true;
  window.digivicePopupBackBridge = {
    handleBackNavigation: consumeTopPopupBackHandler,
  };
}

installPopupBackEventListener();
installPopupBackBridge();

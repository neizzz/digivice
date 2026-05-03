import { GAME_CONSTANTS } from "../config";

const STORAGE_KEY = "main-scene-debug-game-constants-visible";

function formatConstants(value: unknown, depth = 0): string {
  const indent = "  ".repeat(depth);
  const nextIndent = "  ".repeat(depth + 1);

  if (value === null) {
    return "null";
  }

  if (typeof value !== "object") {
    return typeof value === "string" ? `"${value}"` : String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    return (
      `\n${value
        .map((item) => `${nextIndent}${formatConstants(item, depth + 1)}`)
        .join(",\n")}\n${indent}`.replace(/^\n/, "[") + "]"
    );
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    return "{}";
  }

  return (
    `\n${entries
      .map(
        ([key, entryValue]) =>
          `${nextIndent}${key}: ${formatConstants(entryValue, depth + 1)}`,
      )
      .join(",\n")}\n${indent}`.replace(/^\n/, "{") + "}"
  );
}

export class HTMLDebugGameConstantsUI {
  private _container: HTMLDivElement;
  private _content: HTMLPreElement;
  private _toggleButton: HTMLButtonElement;
  private _isVisible: boolean;

  constructor(parentElement: HTMLElement) {
    this._isVisible = this._loadVisibility();
    this._container = this._createContainer();
    this._content = this._createContent();
    this._toggleButton = this._createToggleButton();

    this._setupUI();

    parentElement.appendChild(this._container);
    parentElement.appendChild(this._toggleButton);

    this._syncVisibility();
  }

  private _loadVisibility(): boolean {
    try {
      const savedValue = window.localStorage.getItem(STORAGE_KEY);
      if (savedValue === null) {
        return false;
      }

      return savedValue === "true";
    } catch {
      return false;
    }
  }

  private _saveVisibility(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(this._isVisible));
    } catch {
      // noop
    }
  }

  private _createContainer(): HTMLDivElement {
    const container = document.createElement("div");
    container.style.cssText = `
      position: absolute;
      top: 48px;
      right: 12px;
      width: min(360px, calc(100% - 24px));
      max-height: calc(100% - 60px);
      overflow: auto;
      background: rgba(0, 0, 0, 0.72);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 10px;
      padding: 12px;
      z-index: 1001;
      box-sizing: border-box;
      backdrop-filter: blur(4px);
      color: white;
      font-family: 'NeoDunggeunmo Pro', sans-serif;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
    `;

    return container;
  }

  private _createContent(): HTMLPreElement {
    const content = document.createElement("pre");
    content.style.cssText = `
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: 'NeoDunggeunmo Pro', sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #d9f7ff;
    `;
    content.textContent = formatConstants(GAME_CONSTANTS);

    return content;
  }

  private _createToggleButton(): HTMLButtonElement {
    const button = document.createElement("button");
    button.addEventListener("click", () => {
      this.toggle();
    });

    return button;
  }

  private _createCloseButton(): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = "×";
    button.style.cssText = `
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.12);
      color: white;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      flex-shrink: 0;
    `;
    button.addEventListener("click", () => {
      this.hide();
    });

    return button;
  }

  private _setupUI(): void {
    const header = document.createElement("div");
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 10px;
    `;

    const titleWrap = document.createElement("div");

    const title = document.createElement("div");
    title.textContent = "DEBUG GAME_CONSTANTS";
    title.style.cssText = `
      font-size: 12px;
      font-weight: 700;
      color: #ffffff;
    `;

    const description = document.createElement("div");
    description.textContent = "Current values applied in the dev build";
    description.style.cssText = `
      margin-top: 2px;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.7);
    `;

    titleWrap.appendChild(title);
    titleWrap.appendChild(description);

    header.appendChild(titleWrap);
    header.appendChild(this._createCloseButton());

    this._container.appendChild(header);
    this._container.appendChild(this._content);
  }

  private _syncVisibility(): void {
    this._container.style.display = this._isVisible ? "block" : "none";
    this._toggleButton.textContent = this._isVisible
      ? "DBG CONST ON"
      : "DBG CONST";
    this._toggleButton.style.cssText = `
      position: absolute;
      top: 12px;
      right: 12px;
      min-width: 88px;
      height: 28px;
      padding: 0 10px;
      background: ${
        this._isVisible ? "rgba(0, 150, 0, 0.9)" : "rgba(68, 68, 68, 0.9)"
      };
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;
      z-index: 1002;
      font-family: 'NeoDunggeunmo Pro', sans-serif;
      transition: background-color 0.2s;
    `;
  }

  public show(): void {
    this._isVisible = true;
    this._saveVisibility();
    this._syncVisibility();
  }

  public hide(): void {
    this._isVisible = false;
    this._saveVisibility();
    this._syncVisibility();
  }

  public toggle(): void {
    if (this._isVisible) {
      this.hide();
      return;
    }

    this.show();
  }

  public destroy(): void {
    if (this._container.parentElement) {
      this._container.parentElement.removeChild(this._container);
    }

    if (this._toggleButton.parentElement) {
      this._toggleButton.parentElement.removeChild(this._toggleButton);
    }
  }
}

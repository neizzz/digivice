// 모든 스토리지가 사용할 통합 비동기 인터페이스
export interface Storage {
  getData(key: string): Promise<unknown | null>;
  setData(key: string, value: unknown): Promise<void>;
  removeData(key: string): Promise<void>;
  // clear(): Promise<void>;
}

interface NativeStorageController {
  getData(key: string): Promise<string | null | undefined>;
  setData(key: string, value: string): Promise<void>;
  removeData(key: string): Promise<void>;
}

declare global {
  interface Window {
    storageController?: NativeStorageController;
    __createPromise?: unknown;
    __resolvePromise?: unknown;
  }
}

const STORAGE_PREVIEW_LIMIT = 120;

function _serialize(obj: unknown): string {
  return JSON.stringify(obj);
}

function _deserialize<T>(json: string): T {
  return JSON.parse(json) as T;
}

function _isMissingSerializedValue(value: unknown): boolean {
  if (value === null || typeof value === "undefined") {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  const normalizedValue = value.trim();
  return (
    normalizedValue === "" ||
    normalizedValue === "undefined" ||
    normalizedValue === "null"
  );
}

function _previewValue(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "undefined") {
    return "undefined";
  }

  const stringValue =
    typeof value === "string" ? value : JSON.stringify(value) ?? String(value);

  return stringValue.length > STORAGE_PREVIEW_LIMIT
    ? `${stringValue.slice(0, STORAGE_PREVIEW_LIMIT)}…`
    : stringValue;
}

export function hasNativeStorageController(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.storageController?.getData === "function" &&
    typeof window.storageController?.setData === "function" &&
    typeof window.storageController?.removeData === "function" &&
    typeof window.__createPromise === "function" &&
    typeof window.__resolvePromise === "function"
  );
}

export class WebLocalStorage implements Storage {
  // private _throttledSetItem = throttle((key: string, value: string): void => {
  //   // console.debug("[WebLocalStorage] _throttledSetItem():", key, value);
  //   localStorage.setItem(key, value);
  // }, 1000);

  async getData(key: string): Promise<unknown | null> {
    console.debug("[WebLocalStorage] getData:start", { key });
    const value = localStorage.getItem(key);
    if (value === null) {
      console.debug("[WebLocalStorage] getData:miss", { key });
      return await Promise.resolve(null);
    }

    console.debug("[WebLocalStorage] getData:raw", {
      key,
      length: value.length,
      preview: _previewValue(value),
    });

    try {
      const parsed = _deserialize(value);
      console.debug("[WebLocalStorage] getData:parsed", {
        key,
        valueType: typeof parsed,
      });
      return await Promise.resolve(parsed);
    } catch (error) {
      console.warn("[WebLocalStorage] getData:parse_failed", {
        key,
        preview: _previewValue(value),
        error,
      });
      throw error;
    }
  }

  setData(key: string, data: unknown): Promise<void> {
    const value = _serialize(data);
    console.debug("[WebLocalStorage] setData:start", {
      key,
      length: value.length,
      preview: _previewValue(value),
    });
    localStorage.setItem(key, value);
    console.debug("[WebLocalStorage] setData:success", { key });
    return Promise.resolve();
  }

  removeData(key: string): Promise<void> {
    console.debug("[WebLocalStorage] removeData:start", { key });
    localStorage.removeItem(key);
    console.debug("[WebLocalStorage] removeData:success", { key });
    return Promise.resolve();
  }
}

// Flutter의 네이티브 스토리지 구현 - 이미 비동기
export class FlutterStorage implements Storage {
  private _getStorageController(): NativeStorageController {
    if (!hasNativeStorageController()) {
      throw new Error("Native storage controller is not available");
    }

    return window.storageController as NativeStorageController;
  }

  async getData(key: string): Promise<unknown | null> {
    console.debug("[FlutterStorage] getData:start", { key });
    const value = await this._getStorageController().getData(key);

    console.debug("[FlutterStorage] getData:raw", {
      key,
      rawType: typeof value,
      isNull: value === null,
      preview: _previewValue(value),
    });

    if (_isMissingSerializedValue(value)) {
      console.debug("[FlutterStorage] getData:miss", { key });
      return null;
    }

    try {
      const serializedValue = value as string;
      console.debug("[FlutterStorage] getData:parse_attempt", {
        key,
        preview: _previewValue(serializedValue),
      });
      const parsed = _deserialize(serializedValue);
      console.debug("[FlutterStorage] getData:parsed", {
        key,
        valueType: typeof parsed,
      });
      return parsed;
    } catch (error) {
      console.warn("[FlutterStorage] getData:parse_failed", {
        key,
        preview: _previewValue(value),
        error,
      });
      throw error;
    }
  }

  async setData(key: string, value: unknown): Promise<void> {
    const serializedValue = _serialize(value);
    console.debug("[FlutterStorage] setData:start", {
      key,
      length: serializedValue.length,
      preview: _previewValue(serializedValue),
    });
    await this._getStorageController().setData(key, serializedValue);
    console.debug("[FlutterStorage] setData:success", { key });
  }

  async removeData(key: string): Promise<void> {
    console.debug("[FlutterStorage] removeData:start", { key });
    await this._getStorageController().removeData(key);
    console.debug("[FlutterStorage] removeData:success", { key });
  }
}

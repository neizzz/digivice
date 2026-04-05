// 모든 스토리지가 사용할 통합 비동기 인터페이스
export interface Storage {
  getData(key: string): Promise<unknown | null>;
  setData(key: string, value: unknown): Promise<void>;
  removeData(key: string): Promise<void>;
  // clear(): Promise<void>;
}

interface NativeStorageController {
  getData(key: string): Promise<string | null>;
  setData(key: string, value: string): Promise<void>;
  removeData(key: string): Promise<void>;
}

declare global {
  interface Window {
    storageController?: NativeStorageController;
  }
}

function _serialize(obj: unknown): string {
  return JSON.stringify(obj);
}

function _deserialize<T>(json: string): T {
  return JSON.parse(json) as T;
}

export function hasNativeStorageController(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.storageController !== "undefined"
  );
}

export class WebLocalStorage implements Storage {
  // private _throttledSetItem = throttle((key: string, value: string): void => {
  //   // console.debug("[WebLocalStorage] _throttledSetItem():", key, value);
  //   localStorage.setItem(key, value);
  // }, 1000);

  async getData(key: string): Promise<unknown | null> {
    // 동기 API를 Promise로 감싸서 비동기 API처럼 사용
    // console.debug(
    //   "[WebLocalStorage] getItem():",
    //   key,
    //   // @ts-ignore
    //   JSON.parse(localStorage.getItem(key))
    // );
    const value = localStorage.getItem(key);
    if (value === null) {
      console.debug("[WebLocalStorage] getItem():", key, "not found");
      return await Promise.resolve(null);
    }
    // console.debug("[WebLocalStorage] getItem():", key, value);
    return await Promise.resolve(_deserialize(value));
  }

  setData(key: string, data: unknown): Promise<void> {
    // this._throttledSetItem(key, value);
    const value = _serialize(data);
    console.debug("[WebLocalStorage] setItem():", key, value);
    return Promise.resolve(localStorage.setItem(key, value));
  }

  removeData(key: string): Promise<void> {
    return Promise.resolve(localStorage.removeItem(key));
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
    const value = await this._getStorageController().getData(key);

    if (value === null) {
      return null;
    }

    return _deserialize(value);
  }

  setData(key: string, value: unknown): Promise<void> {
    return this._getStorageController().setData(key, _serialize(value));
  }

  removeData(key: string): Promise<void> {
    return this._getStorageController().removeData(key);
  }
}

import throttle from "lodash.throttle";

// 모든 스토리지가 사용할 통합 비동기 인터페이스
export interface Storage {
  getData(key: string): Promise<unknown | null>;
  setData(key: string, value: unknown): void;
  removeData(key: string): void;
  // clear(): Promise<void>;
}

// Flutter 스토리지 컨트롤러 타입 정의
// interface StorageController {
//   getData(key: string): Promise<string | null>;
//   setData(key: string, value: string): Promise<void>;
//   removeData(key: string): void;
//   // clear(): void;
// }

function _serialize(obj: any): string {
  return JSON.stringify(obj);
}

function _deserialize<T>(json: string): T {
  return JSON.parse(json) as T;
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

  setData(key: string, data: unknown): void {
    // this._throttledSetItem(key, value);
    const value = _serialize(data);
    console.debug("[WebLocalStorage] setItem():", key, value);
    localStorage.setItem(key, value);
  }

  removeData(key: string): void {
    localStorage.removeItem(key);
  }
}

// Flutter의 네이티브 스토리지 구현 - 이미 비동기
export class FlutterStorage implements Storage {
  private _getStorageController(): Storage {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return window.storageController as Storage;
  }

  async getData(key: string): Promise<unknown | null> {
    return await this._getStorageController().getData(key);
  }

  setData(key: string, value: unknown): void {
    this._getStorageController().setData(key, value);
  }

  removeData(key: string): void {
    this._getStorageController().removeData(key);
  }
}

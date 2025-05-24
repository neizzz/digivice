import throttle from "lodash.throttle";

// 모든 스토리지가 사용할 통합 비동기 인터페이스
export interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): void;
  // removeItem(key: string): Promise<void>;
  // clear(): Promise<void>;
}

// Flutter 스토리지 컨트롤러 타입 정의
interface StorageController {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

const _throttledSetItem = throttle((key: string, value: string): void => {
  console.debug("[WebLocalStorage] _throttledSetItem():", key, value);
  localStorage.setItem(key, value);
}, 1000);

export class WebLocalStorage implements Storage {
  async getItem(key: string): Promise<string | null> {
    // 동기 API를 Promise로 감싸서 비동기 API처럼 사용
    console.debug(
      "[WebLocalStorage] getItem():",
      key,
      // @ts-ignore
      JSON.parse(localStorage.getItem(key))
    );
    return Promise.resolve(localStorage.getItem(key));
  }

  setItem(key: string, value: string): void {
    _throttledSetItem(key, value);
  }

  // async removeItem(key: string): Promise<void> {
  //   localStorage.removeItem(key);
  //   return Promise.resolve();
  // }

  // async clear(): Promise<void> {
  //   localStorage.clear();
  //   return Promise.resolve();
  // }
}

// Flutter의 네이티브 스토리지 구현 - 이미 비동기
export class FlutterStorage implements Storage {
  private _getStorageController(): StorageController {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return window.storageController as StorageController;
  }

  async getItem(key: string): Promise<string | null> {
    return await this._getStorageController().getItem(key);
  }

  setItem(key: string, value: string): void {
    this._getStorageController().setItem(key, value);
  }

  // async removeItem(key: string): Promise<void> {
  //   await this._getStorageController().removeItem(key);
  // }

  // async clear(): Promise<void> {
  //   await this._getStorageController().clear();
  // }
}

// 모든 스토리지가 사용할 통합 비동기 인터페이스
export interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

// Flutter 스토리지 컨트롤러 타입 정의
interface StorageController {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

export class WebLocalStorage implements Storage {
  async getItem(key: string): Promise<string | null> {
    // 동기 API를 Promise로 감싸서 비동기 API처럼 사용
    console.log(
      "WebLocalStorage::getItem:",
      key,
      // @ts-ignore
      JSON.parse(localStorage.getItem(key))
    );
    return Promise.resolve(localStorage.getItem(key));
  }

  async setItem(key: string, value: string): Promise<void> {
    console.log("WebLocalStorage::setItem:", key, JSON.parse(value));
    localStorage.setItem(key, value);
    return Promise.resolve();
  }

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
    return Promise.resolve();
  }

  async clear(): Promise<void> {
    localStorage.clear();
    return Promise.resolve();
  }
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

  async setItem(key: string, value: string): Promise<void> {
    await this._getStorageController().setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    await this._getStorageController().removeItem(key);
  }

  async clear(): Promise<void> {
    await this._getStorageController().clear();
  }
}

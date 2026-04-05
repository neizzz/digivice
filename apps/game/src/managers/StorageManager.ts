import {
  type Storage,
  FlutterStorage,
  WebLocalStorage,
  hasNativeStorageController,
} from "@shared/storage";

class _StorageManager {
  private readonly _flutterStorage = new FlutterStorage();
  private readonly _webStorage = new WebLocalStorage();

  private _getStorage(): Storage {
    return hasNativeStorageController()
      ? this._flutterStorage
      : this._webStorage;
  }

  getData<T>(key: string): Promise<T | null> {
    return this._getStorage().getData(key) as Promise<T | null>;
  }

  setData<T>(key: string, data: T): Promise<void> {
    return this._getStorage().setData(key, data);
  }

  removeData(key: string): Promise<void> {
    return this._getStorage().removeData(key);
  }
}

export const StorageManager = new _StorageManager();

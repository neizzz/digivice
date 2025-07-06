import { Storage, FlutterStorage, WebLocalStorage } from "@shared/storage";

class _StorageManager {
  private _storage: Storage;

  constructor() {
    if (typeof window !== "undefined" && "storageController" in window) {
      this._storage = new FlutterStorage();
    } else {
      this._storage = new WebLocalStorage();
    }
  }

  getData<T>(key: string): Promise<T | null> {
    return this._storage.getData(key) as Promise<T | null>;
  }

  setData<T>(key: string, data: T): Promise<void> {
    return this._storage.setData(key, data);
  }
}

export const StorageManager = new _StorageManager();

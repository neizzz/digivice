import {
  FlutterStorage,
  hasNativeStorageController,
  type Storage,
  WebLocalStorage,
} from "@shared/storage";

export function createClientStorage(): Storage {
  if (hasNativeStorageController()) {
    return new FlutterStorage();
  }

  return new WebLocalStorage();
}

export function getClientStorageKind(): "native" | "web" {
  return hasNativeStorageController() ? "native" : "web";
}

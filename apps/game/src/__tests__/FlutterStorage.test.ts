import assert from "node:assert/strict";
import test from "node:test";
import { FlutterStorage } from "@shared/storage";

test("FlutterStorage.setData는 native storage bridge가 응답하지 않으면 timeout으로 실패한다", async () => {
  const originalWindow = globalThis.window;
  const fakeWindow = {
    storageController: {
      getData: async () => null,
      setData: async () => await new Promise<void>(() => {}),
      removeData: async () => undefined,
    },
    __createPromise: () => undefined,
    __resolvePromise: () => undefined,
  } as unknown as Window & typeof globalThis;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: fakeWindow,
  });

  try {
    const storage = new FlutterStorage();
    const startedAt = Date.now();

    await assert.rejects(
      storage.setData("DigiviceTestKey", { value: "test" }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /timed out after 2000ms/i);
        return true;
      },
    );

    assert.ok(Date.now() - startedAt >= 1_900);
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: originalWindow,
    });
  }
});

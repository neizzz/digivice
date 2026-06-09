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

type FlutterStorageOperation = "getData" | "setData" | "removeData";

declare global {
	interface Window {
		storageController?: NativeStorageController;
		__createPromise?: unknown;
		__resolvePromise?: unknown;
	}
}

const STORAGE_PREVIEW_LIMIT = 120;
const FLUTTER_STORAGE_TIMEOUT_MS: Record<FlutterStorageOperation, number> = {
	getData: 3_000,
	setData: 2_000,
	removeData: 2_000,
};
const SHOULD_LOG_VERBOSE_STORAGE =
	(import.meta.env?.DEV ?? false) &&
	import.meta.env?.NATIVE_FEATURE_DEBUG_MODE === "true";
const JS_READ_ONLY_STORAGE_KEYS = new Set(["MonsterBookData"]);

function _isJsReadOnlyStorageKey(key: string): boolean {
	return JS_READ_ONLY_STORAGE_KEYS.has(key);
}

function _warnReadOnlyStorageWriteIgnored(
	storageKind: string,
	operation: "setData" | "removeData",
	key: string,
): void {
	console.warn(`[${storageKind}] ${operation} ignored for JS read-only key`, {
		key,
		monsterBookWriteOwner:
			key === "MonsterBookData" ? "flutter_lifecycle" : undefined,
	});
}

function _debugStorage(...args: Parameters<typeof console.debug>): void {
	if (!SHOULD_LOG_VERBOSE_STORAGE) {
		return;
	}

	console.debug(...args);
}

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
		typeof value === "string"
			? value
			: (JSON.stringify(value) ?? String(value));

	return stringValue.length > STORAGE_PREVIEW_LIMIT
		? `${stringValue.slice(0, STORAGE_PREVIEW_LIMIT)}…`
		: stringValue;
}

function _createFlutterStorageTimeoutError(params: {
	operation: FlutterStorageOperation;
	key: string;
	timeoutMs: number;
	payloadLength?: number;
}): Error & {
	code: "FLUTTER_STORAGE_TIMEOUT";
	operation: FlutterStorageOperation;
	key: string;
	timeoutMs: number;
	payloadLength?: number;
} {
	const message = `[FlutterStorage] ${params.operation} timed out after ${params.timeoutMs}ms for key "${params.key}"`;
	return Object.assign(new Error(message), {
		code: "FLUTTER_STORAGE_TIMEOUT" as const,
		operation: params.operation,
		key: params.key,
		timeoutMs: params.timeoutMs,
		payloadLength: params.payloadLength,
	});
}

async function _withFlutterStorageTimeout<T>(params: {
	operation: FlutterStorageOperation;
	key: string;
	payloadLength?: number;
	promiseFactory: () => Promise<T>;
}): Promise<T> {
	const timeoutMs = FLUTTER_STORAGE_TIMEOUT_MS[params.operation];
	const startedAt =
		typeof performance !== "undefined" ? performance.now() : Date.now();

	return await new Promise<T>((resolve, reject) => {
		let isSettled = false;
		const timeoutId = globalThis.setTimeout(() => {
			if (isSettled) {
				return;
			}

			isSettled = true;
			const elapsedMs = Math.round(
				(typeof performance !== "undefined" ? performance.now() : Date.now()) -
					startedAt,
			);
			const error = _createFlutterStorageTimeoutError({
				operation: params.operation,
				key: params.key,
				timeoutMs,
				payloadLength: params.payloadLength,
			});

			console.error("[ImportantDiagnostics][FlutterStorageTiming]", {
				phase: "timeout",
				operation: params.operation,
				key: params.key,
				timeoutMs,
				elapsedMs,
				payloadLength: params.payloadLength ?? null,
				error: {
					name: error.name,
					message: error.message,
					code: error.code,
				},
			});
			reject(error);
		}, timeoutMs);

		void params.promiseFactory().then(
			(value) => {
				if (isSettled) {
					return;
				}

				isSettled = true;
				globalThis.clearTimeout(timeoutId);
				resolve(value);
			},
			(error) => {
				if (isSettled) {
					return;
				}

				isSettled = true;
				globalThis.clearTimeout(timeoutId);
				reject(error);
			},
		);
	});
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
		_debugStorage("[WebLocalStorage] getData:start", { key });
		const value = localStorage.getItem(key);
		if (value === null) {
			_debugStorage("[WebLocalStorage] getData:miss", { key });
			return await Promise.resolve(null);
		}

		_debugStorage("[WebLocalStorage] getData:raw", {
			key,
			length: value.length,
			preview: _previewValue(value),
		});

		try {
			const parsed = _deserialize(value);
			_debugStorage("[WebLocalStorage] getData:parsed", {
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
		if (_isJsReadOnlyStorageKey(key)) {
			_warnReadOnlyStorageWriteIgnored("WebLocalStorage", "setData", key);
			return Promise.resolve();
		}

		const value = _serialize(data);
		_debugStorage("[WebLocalStorage] setData:start", {
			key,
			length: value.length,
			preview: _previewValue(value),
		});
		localStorage.setItem(key, value);
		_debugStorage("[WebLocalStorage] setData:success", { key });
		return Promise.resolve();
	}

	removeData(key: string): Promise<void> {
		if (_isJsReadOnlyStorageKey(key)) {
			_warnReadOnlyStorageWriteIgnored("WebLocalStorage", "removeData", key);
			return Promise.resolve();
		}

		_debugStorage("[WebLocalStorage] removeData:start", { key });
		localStorage.removeItem(key);
		_debugStorage("[WebLocalStorage] removeData:success", { key });
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
		_debugStorage("[FlutterStorage] getData:start", { key });
		const value = await _withFlutterStorageTimeout({
			operation: "getData",
			key,
			promiseFactory: () => this._getStorageController().getData(key),
		});

		_debugStorage("[FlutterStorage] getData:raw", {
			key,
			rawType: typeof value,
			isNull: value === null,
			preview: _previewValue(value),
		});

		if (_isMissingSerializedValue(value)) {
			_debugStorage("[FlutterStorage] getData:miss", { key });
			return null;
		}

		try {
			const serializedValue = value as string;
			_debugStorage("[FlutterStorage] getData:parse_attempt", {
				key,
				preview: _previewValue(serializedValue),
			});
			const parsed = _deserialize(serializedValue);
			_debugStorage("[FlutterStorage] getData:parsed", {
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
		if (_isJsReadOnlyStorageKey(key)) {
			_warnReadOnlyStorageWriteIgnored("FlutterStorage", "setData", key);
			return;
		}

		const serializedValue = _serialize(value);
		_debugStorage("[FlutterStorage] setData:start", {
			key,
			length: serializedValue.length,
			preview: _previewValue(serializedValue),
		});
		await _withFlutterStorageTimeout({
			operation: "setData",
			key,
			payloadLength: serializedValue.length,
			promiseFactory: () =>
				this._getStorageController().setData(key, serializedValue),
		});
		_debugStorage("[FlutterStorage] setData:success", { key });
	}

	async removeData(key: string): Promise<void> {
		if (_isJsReadOnlyStorageKey(key)) {
			_warnReadOnlyStorageWriteIgnored("FlutterStorage", "removeData", key);
			return;
		}

		_debugStorage("[FlutterStorage] removeData:start", { key });
		await _withFlutterStorageTimeout({
			operation: "removeData",
			key,
			promiseFactory: () => this._getStorageController().removeData(key),
		});
		_debugStorage("[FlutterStorage] removeData:success", { key });
	}
}

import { createClientStorage, getClientStorageKind } from "../utils/clientStorage";

const DIAGNOSTICS_LOGS_STORAGE_KEY = "DiagnosticsLogs";
const DIAGNOSTICS_LOGS_MAX_TOTAL_BYTES = 1024 * 1024;
const DIAGNOSTICS_LOG_ENTRY_MAX_BYTES = 8 * 1024;
const DIAGNOSTICS_LOGS_PERSIST_DEBOUNCE_MS = 2000;
const ELLIPSIS = "…";

type DiagnosticsLogLevel = "log" | "warn" | "error";

type DiagnosticsContext = {
  scene?: string;
  storageKind?: "native" | "web";
  appMode?: string;
  debugEnabled?: boolean;
};

export type DiagnosticsLogEntry = {
  id: string;
  timestamp: string;
  level: DiagnosticsLogLevel;
  message: string;
  sessionId: string;
  source: string;
  timeSinceSessionStartMs: number;
  scene?: string;
  storageKind: "native" | "web";
  appMode?: string;
  debugEnabled?: boolean;
};

type DiagnosticsLogRecord = {
  entry: DiagnosticsLogEntry;
  serialized: string;
  byteSize: number;
};

const textEncoder = new TextEncoder();
const diagnosticsSessionId =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const diagnosticsSessionStartedAt = Date.now();

let diagnosticsContextProvider: (() => DiagnosticsContext) | null = null;
let diagnosticsLogs: DiagnosticsLogRecord[] = [];
let diagnosticsLogsTotalBytes = 2;
let diagnosticsLoggerInitialized = false;
let diagnosticsConsoleInstalled = false;
let persistScheduled = false;
let persistenceInFlight: Promise<void> | null = null;
let persistTimeoutId: number | null = null;

const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function syncWindowErrorLogs(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.errorLogs = diagnosticsLogs.map(
    ({ entry }) => `[${entry.timestamp}] [${entry.level}] ${entry.message}`,
  );
}

function toByteLength(value: string): number {
  return textEncoder.encode(value).length;
}

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(
      value,
      (_, currentValue) => {
        if (currentValue instanceof Error) {
          return {
            name: currentValue.name,
            message: currentValue.message,
            stack: currentValue.stack,
          };
        }

        if (
          typeof currentValue === "object" &&
          currentValue !== null
        ) {
          if (seen.has(currentValue)) {
            return "[Circular]";
          }
          seen.add(currentValue);
        }

        return currentValue;
      },
      2,
    );
  } catch {
    return String(value);
  }
}

function stringifyConsoleArg(arg: unknown): string {
  if (typeof arg === "string") {
    return arg;
  }

  if (arg instanceof Error) {
    return [arg.name ? `${arg.name}: ${arg.message}` : arg.message, arg.stack]
      .filter(Boolean)
      .join("\n");
  }

  return safeStringify(arg);
}

function getCallerSource(): string {
  try {
    const stackLines = new Error().stack?.split("\n");
    if (!stackLines) {
      return "unknown";
    }

    const callerLine = stackLines.find(
      (line) => !line.includes("diagnosticLogger") && line.includes("at "),
    );

    if (!callerLine) {
      return "unknown";
    }

    const callSite = callerLine.trim();
    const match = callSite.match(/at\s+.*\((.*):(\d+):(\d+)\)/);
    if (match) {
      const [, filePath, line] = match;
      const fileName = filePath.split("/").pop() ?? filePath;
      return `${fileName}:${line}`;
    }

    const fallbackMatch = callSite.match(/at\s+(.*):(\d+):(\d+)/);
    if (fallbackMatch) {
      const [, filePath, line] = fallbackMatch;
      const fileName = filePath.split("/").pop() ?? filePath;
      return `${fileName}:${line}`;
    }
  } catch {
    return "unknown";
  }

  return "unknown";
}

function truncateToByteLength(value: string, maxBytes: number): string {
  if (maxBytes <= 0) {
    return "";
  }

  if (toByteLength(value) <= maxBytes) {
    return value;
  }

  const ellipsisBytes = toByteLength(ELLIPSIS);
  if (maxBytes <= ellipsisBytes) {
    return ELLIPSIS;
  }

  let low = 0;
  let high = value.length;
  let best = "";
  const allowedBytes = maxBytes - ellipsisBytes;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = value.slice(0, mid);
    if (toByteLength(candidate) <= allowedBytes) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return `${best}${ELLIPSIS}`;
}

function truncateEntryToLimit(entry: DiagnosticsLogEntry): DiagnosticsLogEntry {
  const baseEntry = {
    ...entry,
    message: "",
  } satisfies DiagnosticsLogEntry;

  const baseBytes = toByteLength(JSON.stringify(baseEntry));
  const allowedMessageBytes = Math.max(
    DIAGNOSTICS_LOG_ENTRY_MAX_BYTES - baseBytes,
    toByteLength(ELLIPSIS),
  );

  return {
    ...entry,
    message: truncateToByteLength(entry.message, allowedMessageBytes),
  };
}

function getSerializedLogsByteLength(logs: DiagnosticsLogRecord[]): number {
  if (logs.length === 0) {
    return 2;
  }

  const entriesBytes = logs.reduce((sum, log) => sum + log.byteSize, 0);
  return entriesBytes + (logs.length - 1) + 2;
}

function createLogRecord(entry: DiagnosticsLogEntry): DiagnosticsLogRecord {
  const serialized = JSON.stringify(entry);
  return {
    entry,
    serialized,
    byteSize: toByteLength(serialized),
  };
}

function trimLogsToSize(logs: DiagnosticsLogRecord[]): DiagnosticsLogRecord[] {
  const nextLogs = [...logs];
  let totalBytes = getSerializedLogsByteLength(nextLogs);

  while (nextLogs.length > 0 && totalBytes > DIAGNOSTICS_LOGS_MAX_TOTAL_BYTES) {
    const removed = nextLogs.shift();
    if (!removed) {
      break;
    }
    totalBytes -= removed.byteSize;
    totalBytes -= nextLogs.length > 0 ? 1 : 2;
  }

  diagnosticsLogsTotalBytes = getSerializedLogsByteLength(nextLogs);
  return nextLogs;
}

function normalizePersistedLogs(value: unknown): DiagnosticsLogRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const record = entry as Partial<DiagnosticsLogEntry>;
      if (
        typeof record.timestamp !== "string" ||
        typeof record.level !== "string" ||
        typeof record.message !== "string" ||
        typeof record.sessionId !== "string" ||
        typeof record.source !== "string" ||
        typeof record.timeSinceSessionStartMs !== "number" ||
        (record.storageKind !== "native" && record.storageKind !== "web")
      ) {
        return null;
      }

      return createLogRecord(
        truncateEntryToLimit({
          id: typeof record.id === "string" ? record.id : `${record.timestamp}-${record.level}`,
          timestamp: record.timestamp,
          level: record.level as DiagnosticsLogLevel,
          message: record.message,
          sessionId: record.sessionId,
          source: record.source,
          timeSinceSessionStartMs: record.timeSinceSessionStartMs,
          scene: typeof record.scene === "string" ? record.scene : undefined,
          storageKind: record.storageKind,
          appMode: typeof record.appMode === "string" ? record.appMode : undefined,
          debugEnabled:
            typeof record.debugEnabled === "boolean"
              ? record.debugEnabled
              : undefined,
        }),
      );
    })
    .filter((entry): entry is DiagnosticsLogRecord => entry !== null);
}

function getDiagnosticsContext(): DiagnosticsContext {
  return diagnosticsContextProvider?.() ?? {};
}

function queuePersist(): void {
  if (!diagnosticsLoggerInitialized) {
    return;
  }

  if (persistTimeoutId !== null) {
    window.clearTimeout(persistTimeoutId);
  }

  persistScheduled = true;
  persistTimeoutId = window.setTimeout(() => {
    persistScheduled = false;
    persistTimeoutId = null;
    void persistDiagnosticsLogs();
  }, DIAGNOSTICS_LOGS_PERSIST_DEBOUNCE_MS);
}

async function persistDiagnosticsLogs(): Promise<void> {
  if (!diagnosticsLoggerInitialized) {
    return;
  }

  if (persistenceInFlight) {
    await persistenceInFlight;
    return;
  }

  persistenceInFlight = (async () => {
    try {
      const storage = createClientStorage();
      await storage.setData(
        DIAGNOSTICS_LOGS_STORAGE_KEY,
        diagnosticsLogs.map((log) => log.entry),
      );
    } catch (error) {
      originalConsole.error("[diagnosticLogger] Failed to persist diagnostics logs", error);
    } finally {
      persistenceInFlight = null;
    }
  })();

  await persistenceInFlight;
}

function appendDiagnosticsLog(level: DiagnosticsLogLevel, args: unknown[]): void {
  const context = getDiagnosticsContext();
  const message = args.map(stringifyConsoleArg).join(" ");

  const entry = truncateEntryToLimit({
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: new Date().toISOString(),
    level,
    message,
    sessionId: diagnosticsSessionId,
    source: getCallerSource(),
    timeSinceSessionStartMs: Date.now() - diagnosticsSessionStartedAt,
    scene: context.scene,
    storageKind: context.storageKind ?? getClientStorageKind(),
    appMode: context.appMode,
    debugEnabled: context.debugEnabled,
  });
  const record = createLogRecord(entry);

  diagnosticsLogs = trimLogsToSize([...diagnosticsLogs, record]);
  syncWindowErrorLogs();
  queuePersist();
}

export function installDiagnosticsConsoleCapture(): void {
  if (diagnosticsConsoleInstalled) {
    return;
  }

  diagnosticsConsoleInstalled = true;

  console.log = (...args: unknown[]) => {
    appendDiagnosticsLog("log", args);
    originalConsole.log(...args);
  };

  console.warn = (...args: unknown[]) => {
    appendDiagnosticsLog("warn", args);
    originalConsole.warn(...args);
  };

  console.error = (...args: unknown[]) => {
    appendDiagnosticsLog("error", args);
    originalConsole.error(...args);
  };
}

export async function initializeDiagnosticsLogger(): Promise<void> {
  if (diagnosticsLoggerInitialized) {
    return;
  }

  diagnosticsLoggerInitialized = true;

  try {
    const storage = createClientStorage();
    const persistedLogs = normalizePersistedLogs(
      await storage.getData(DIAGNOSTICS_LOGS_STORAGE_KEY),
    );
    diagnosticsLogs = trimLogsToSize([...persistedLogs, ...diagnosticsLogs]);
    syncWindowErrorLogs();
  } catch (error) {
    originalConsole.error("[diagnosticLogger] Failed to initialize diagnostics logger", error);
  }
}

export function getDiagnosticsLogs(): DiagnosticsLogEntry[] {
  return diagnosticsLogs.map((log) => log.entry);
}

export function getDiagnosticsLoggerInfo(): {
  sessionId: string;
  totalBytes: number;
  entryCount: number;
  maxTotalBytes: number;
  maxEntryBytes: number;
} {
  return {
    sessionId: diagnosticsSessionId,
    totalBytes: diagnosticsLogsTotalBytes,
    entryCount: diagnosticsLogs.length,
    maxTotalBytes: DIAGNOSTICS_LOGS_MAX_TOTAL_BYTES,
    maxEntryBytes: DIAGNOSTICS_LOG_ENTRY_MAX_BYTES,
  };
}

export function setDiagnosticsContextProvider(
  provider: (() => DiagnosticsContext) | null,
): void {
  diagnosticsContextProvider = provider;
}

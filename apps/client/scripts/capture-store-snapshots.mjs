#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(clientRoot, "..", "..");
const fixturesRoot = path.join(__dirname, "store-snapshot-fixtures");

const LOCALES = [
  "en",
  "ko",
  "ja",
  "zh-TW",
  "zh-HK",
  "hi",
  "th",
  "vi",
  "pt-BR",
];
const DEFAULT_SHOTS = [
  "setup",
  "settings-menu",
  "settings-reset",
  "main-scene-egg",
  "main-scene-day",
  "main-scene-night",
  "monster-info",
  "flappy-bird",
  "monster-book",
  "main-scene-tomb",
];

const VIEWPORTS = {
  "android-19_5-9": {
    width: 360,
    height: 780,
    deviceScaleFactor: 3,
  },
};

const SNAPSHOT_LANGUAGE_TAGS = {
  en: ["en-US", "en"],
  ko: ["ko-KR", "ko"],
  ja: ["ja-JP", "ja"],
  "zh-TW": ["zh-Hant-TW", "zh-TW"],
  "zh-HK": ["zh-HK"],
  hi: ["hi-IN", "hi"],
  th: ["th-TH", "th"],
  vi: ["vi-VN", "vi"],
  "pt-BR": ["pt-BR"],
};

const SHOT_CONFIG = {
  setup: {
    kind: "static",
    localized: true,
    snapshotLayer: "setup",
    waitExpression: `Boolean(document.querySelector('input[placeholder]'))`,
    settleMs: 300,
  },
  "settings-menu": {
    kind: "static",
    localized: true,
    snapshotLayer: "settings",
    waitExpression: `document.querySelectorAll('#app-container button').length >= 4`,
    settleMs: 300,
  },
  "settings-reset": {
    kind: "static",
    localized: true,
    snapshotLayer: "settings",
    snapshotPopup: "settings-reset",
    waitExpression:
      `Boolean(document.querySelector('[data-snapshot-popup="settings-reset"]')) && document.querySelectorAll('[data-snapshot-popup="settings-reset"] input').length === 6`,
    settleMs: 300,
  },
  "main-scene-egg": {
    kind: "runtime",
    localized: false,
    fixtureFile: "main-scene-egg.json",
    settleMs: 900,
    readyTimeoutMs: 20000,
  },
  "main-scene-day": {
    kind: "runtime",
    localized: false,
    fixtureFile: "main-scene-day.json",
    settleMs: 900,
    readyTimeoutMs: 20000,
  },
  "main-scene-eating": {
    kind: "runtime",
    localized: false,
    fixtureFile: "main-scene-eating.json",
    settleMs: 1200,
    readyTimeoutMs: 20000,
  },
  "main-scene-night": {
    kind: "runtime",
    localized: false,
    fixtureFile: "main-scene-night.json",
    settleMs: 900,
    readyTimeoutMs: 20000,
  },
  "monster-info": {
    kind: "runtime",
    localized: true,
    fixtureFile: "monster-info.json",
    settleMs: 900,
    readyTimeoutMs: 20000,
  },
  "flappy-bird": {
    kind: "runtime",
    localized: false,
    fixtureFile: "flappy-bird.json",
    settleMs: 1200,
    readyTimeoutMs: 30000,
  },
  "monster-book": {
    kind: "runtime",
    localized: false,
    fixtureFile: "monster-book.json",
    settleMs: 1200,
    readyTimeoutMs: 45000,
  },
  "main-scene-tomb": {
    kind: "runtime",
    localized: false,
    fixtureFile: "main-scene-tomb.json",
    settleMs: 900,
    readyTimeoutMs: 20000,
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function waitForProcessExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    child.once("exit", resolve);
  });
}

async function removeDirWithRetry(dir) {
  const retryableCodes = new Set(["EBUSY", "ENOTEMPTY", "EPERM"]);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!retryableCodes.has(error?.code) || attempt === 4) {
        throw error;
      }
      await sleep(200 * (attempt + 1));
    }
  }
}

function parseArgs(argv) {
  const options = {
    serve: false,
    url: process.env.DIGIVICE_SNAPSHOT_URL ?? "http://127.0.0.1:5173",
    port: Number(process.env.DIGIVICE_SNAPSHOT_PORT ?? 5173),
    cdpPort: Number(process.env.DIGIVICE_SNAPSHOT_CDP_PORT ?? 9223),
    outDir: null,
    locales: LOCALES,
    shots: DEFAULT_SHOTS,
    viewport: "android-19_5-9",
    chromePath:
      process.env.CHROME_PATH ??
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--serve") {
      options.serve = true;
      continue;
    }
    if (arg === "--url" && next) {
      options.url = next;
      index += 1;
      continue;
    }
    if (arg === "--port" && next) {
      options.port = Number(next);
      options.url = `http://127.0.0.1:${next}`;
      index += 1;
      continue;
    }
    if (arg === "--cdp-port" && next) {
      options.cdpPort = Number(next);
      index += 1;
      continue;
    }
    if (arg === "--out" && next) {
      options.outDir = path.resolve(process.cwd(), next);
      index += 1;
      continue;
    }
    if (arg === "--locales" && next) {
      options.locales = next.split(",").map((value) => value.trim()).filter(Boolean);
      index += 1;
      continue;
    }
    if (arg === "--shots" && next) {
      options.shots = next.split(",").map((value) => value.trim()).filter(Boolean);
      index += 1;
      continue;
    }
    if (arg === "--viewport" && next) {
      options.viewport = next;
      index += 1;
      continue;
    }
    if (arg === "--chrome" && next) {
      options.chromePath = next;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (!VIEWPORTS[options.viewport]) {
    throw new Error(
      `Unsupported viewport: ${options.viewport}. Available: ${Object.keys(VIEWPORTS).join(", ")}`,
    );
  }

  const unknownShots = options.shots.filter((shot) => !SHOT_CONFIG[shot]);
  if (unknownShots.length > 0) {
    throw new Error(
      `Unsupported shots: ${unknownShots.join(", ")}. Available: ${Object.keys(SHOT_CONFIG).join(", ")}`,
    );
  }

  if (options.locales.length === 0) {
    throw new Error("At least one locale is required.");
  }

  if (!options.outDir) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    options.outDir = path.join(repoRoot, "tmp", "store-snapshots", stamp);
  }

  return options;
}

function printHelp() {
  console.log(`Capture Digivice Play Store screenshots.

Usage:
  pnpm --filter @digivice/client snapshot:store
  pnpm --filter @digivice/client snapshot:store:current -- --url http://127.0.0.1:5173

Options:
  --serve                 Build and start a temporary Vite preview server before capture.
  --url <url>             Existing app URL. Default: http://127.0.0.1:5173
  --port <port>           Vite port when using --serve. Default: 5173
  --cdp-port <port>       Chrome DevTools Protocol port. Default: 9223
  --out <dir>             Output directory. Default: tmp/store-snapshots/<timestamp>
  --locales <csv>         Locale list. Default: ${LOCALES.join(",")}
  --shots <csv>           Shot list. Default: ${DEFAULT_SHOTS.join(",")}
  --viewport <name>       Viewport preset. Default: android-19_5-9
  --chrome <path>         Chrome executable path.

Output:
  Localized shots:     <locale>-<shot>.png (for every requested locale)
  Non-localized shots: <shot>.png (captured once with the first requested locale)
`);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? clientRoot,
      env: options.env ?? process.env,
      stdio: options.stdio ?? "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function waitForHttp(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(250);
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? "unknown"}`);
}

async function startViteServer(options) {
  await runCommand("pnpm", ["run", "build:production"], {
    cwd: clientRoot,
    env: {
      ...process.env,
      APP_LOGO_TEXT: "",
      NATIVE_FEATURE_DEBUG_MODE: "false",
    },
  });

  const child = spawn(
    "pnpm",
    [
      "exec",
      "vite",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(options.port),
      "--strictPort",
    ],
    {
      cwd: clientRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout.on("data", (chunk) => process.stdout.write(`[vite] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[vite] ${chunk}`));
  const exitPromise = new Promise((_, reject) => {
    child.on("exit", (code) => {
      if (code !== null && code !== 0) {
        reject(new Error(`vite preview exited with ${code}`));
      }
    });
  });

  await Promise.race([waitForHttp(options.url), exitPromise]);

  return child;
}

async function startChrome(options) {
  const userDataDir = await mkdtemp(path.join(tmpdir(), "digivice-store-chrome-"));
  const child = spawn(
    options.chromePath,
    [
      "--headless=new",
      "--disable-background-networking",
      "--ignore-gpu-blocklist",
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
      "--disable-component-update",
      "--disable-dev-shm-usage",
      "--disable-sync",
      "--disable-features=MediaRouter,OptimizationHints",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--no-sandbox",
      `--remote-debugging-port=${options.cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  child.stderr.on("data", (chunk) => {
    const text = String(chunk);
    if (!text.includes("DevTools listening")) {
      process.stderr.write(`[chrome] ${text}`);
    }
  });

  await waitForHttp(`http://127.0.0.1:${options.cdpPort}/json/version`);

  return {
    child,
    async cleanup() {
      child.kill("SIGTERM");
      await Promise.race([waitForProcessExit(child), sleep(2000)]);
      await removeDirWithRetry(userDataDir);
    },
  };
}

async function createPage(cdpPort) {
  const newTargetResponse = await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, {
    method: "PUT",
  });
  if (!newTargetResponse.ok) {
    throw new Error(`Failed to create Chrome target: HTTP ${newTargetResponse.status}`);
  }

  const target = await newTargetResponse.json();
  return new CdpSession(target.webSocketDebuggerUrl);
}

class CdpSession {
  constructor(webSocketDebuggerUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.ws = new WebSocket(webSocketDebuggerUrl);
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });

    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) {
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(`${message.error.message}: ${message.error.data ?? ""}`));
        return;
      }
      pending.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    const payload = JSON.stringify({ id, method, params });

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(payload);
    });
  }

  close() {
    this.ws.close();
  }
}

async function evaluate(session, expression, awaitPromise = true) {
  const result = await session.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  });

  if (result.exceptionDetails) {
    throw new Error(`Runtime.evaluate failed: ${JSON.stringify(result.exceptionDetails)}`);
  }

  return result.result?.value;
}

async function loadFixture(shot) {
  const config = SHOT_CONFIG[shot];

  if (config.fixture) {
    return config.fixture;
  }

  if (!config.fixtureFile) {
    return null;
  }

  const fixturePath = path.join(fixturesRoot, config.fixtureFile);
  const rawFixture = await readFile(fixturePath, "utf8");
  return JSON.parse(rawFixture);
}

async function preparePage(session, locale, viewportName, fixture) {
  const languageTags = SNAPSHOT_LANGUAGE_TAGS[locale] ?? [locale];
  const viewport = VIEWPORTS[viewportName];
  const storageEntries = Object.entries(fixture?.storage ?? {});

  await session.open();
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Page.bringToFront");
  await session.send("Emulation.setLocaleOverride", {
    locale: languageTags[0].replace(/-/g, "_"),
  });
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: true,
  });
  await session.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      (() => {
        window.__DIGIVICE_CAPTURE_LOGS__ = [];
        const pushCaptureLog = (level, args) => {
          try {
            window.__DIGIVICE_CAPTURE_LOGS__.push({
              level,
              message: args
                .map((value) => {
                  if (typeof value === "string") {
                    return value;
                  }
                  try {
                    return JSON.stringify(value);
                  } catch {
                    return String(value);
                  }
                })
                .join(" "),
            });
          } catch {
            // ignore capture log failures
          }
        };
        for (const level of ["log", "warn", "error"]) {
          const original = console[level].bind(console);
          console[level] = (...args) => {
            pushCaptureLog(level, args);
            original(...args);
          };
        }
        window.addEventListener("error", (event) => {
          pushCaptureLog("error", [event.message]);
        });
        window.addEventListener("unhandledrejection", (event) => {
          pushCaptureLog("error", ["unhandledrejection", event.reason]);
        });

        try {
          Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => false,
          });
          Object.defineProperty(document, "visibilityState", {
            configurable: true,
            get: () => "visible",
          });
          document.addEventListener(
            "visibilitychange",
            (event) => {
              event.stopImmediatePropagation();
            },
            true,
          );
        } catch {
          // Best-effort: keep store snapshot captures in a foreground-like state.
        }

        const applySnapshotViewportHeight = () => {
          const snapshotHeight = "${viewport.height}px";
          document.documentElement.style.setProperty(
            "--digivice-app-shell-height",
            snapshotHeight,
          );
          document.documentElement.style.height = snapshotHeight;
          document.body.style.minHeight = snapshotHeight;
          document.body.style.height = snapshotHeight;
          const rootElement = document.getElementById("root");
          if (rootElement) {
            rootElement.style.minHeight = snapshotHeight;
            rootElement.style.height = snapshotHeight;
          }
        };

        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", applySnapshotViewportHeight, {
            once: true,
          });
        } else {
          applySnapshotViewportHeight();
        }

        localStorage.clear();
        localStorage.setItem("game.settings.vibrationEnabled", "false");
        localStorage.setItem("game.settings.sfxEnabled", "false");
        for (const [key, value] of ${JSON.stringify(storageEntries)}) {
          localStorage.setItem(key, JSON.stringify(value));
        }
        Object.defineProperty(navigator, "languages", {
          get: () => ${JSON.stringify(languageTags)},
        });
        Object.defineProperty(navigator, "language", {
          get: () => ${JSON.stringify(languageTags[0])},
        });
      })();
    `,
  });
}

async function navigate(session, url) {
  await session.send("Page.navigate", { url });
  await waitUntil(
    session,
    'document.readyState === "interactive" || document.readyState === "complete"',
  );
  await sleep(800);
}

async function waitUntil(session, expression, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await evaluate(session, expression)) {
      return;
    }
    await sleep(250);
  }

  let stateSummary = null;
  let captureLogs = null;
  try {
    stateSummary = await evaluate(
      session,
      'window.__DIGIVICE_STORE_SNAPSHOT__?.state ?? null',
    );
  } catch {
    stateSummary = null;
  }
  try {
    captureLogs = await evaluate(
      session,
      'window.__DIGIVICE_CAPTURE_LOGS__?.slice(-12) ?? null',
    );
  } catch {
    captureLogs = null;
  }

  throw new Error(
    `Timed out waiting for: ${expression}${stateSummary ? ` | bridge=${JSON.stringify(stateSummary)}` : ""}${captureLogs ? ` | logs=${JSON.stringify(captureLogs)}` : ""}`,
  );
}

async function capture(session, filePath) {
  const result = await session.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });

  await writeFile(filePath, Buffer.from(result.data, "base64"));
}

function buildShotUrl(baseUrl, shot, fixture) {
  const shotConfig = SHOT_CONFIG[shot];
  const url = new URL(baseUrl);

  if (shotConfig.kind === "static") {
    url.searchParams.set("snapshotLayer", shotConfig.snapshotLayer);
    if (shotConfig.snapshotPopup) {
      url.searchParams.set("snapshotPopup", shotConfig.snapshotPopup);
    }
    return url;
  }

  url.searchParams.set("storeSnapshot", "1");
  url.searchParams.set("storeSnapshotShot", shot);

  if (fixture?.scene) {
    url.searchParams.set("storeSnapshotScene", fixture.scene);
  }
  if (fixture?.overlay) {
    url.searchParams.set("storeSnapshotOverlay", fixture.overlay);
  }
  if (fixture?.timeOfDay) {
    url.searchParams.set("storeSnapshotTimeOfDay", fixture.timeOfDay);
  }

  return url;
}

async function waitForShot(session, shot) {
  const shotConfig = SHOT_CONFIG[shot];
  const timeoutMs = shotConfig.readyTimeoutMs ?? 15000;

  if (shotConfig.kind === "static") {
    await waitUntil(session, shotConfig.waitExpression, timeoutMs);
    await sleep(shotConfig.settleMs);
    return;
  }

  await waitUntil(
    session,
    `Boolean(window.__DIGIVICE_STORE_SNAPSHOT__?.state?.ready)`,
    timeoutMs,
  );
  await sleep(shotConfig.settleMs);
}

function getOutputFileName(locale, shot) {
  const shotConfig = SHOT_CONFIG[shot];
  return shotConfig.localized ? `${locale}-${shot}.png` : `${shot}.png`;
}

async function captureShot({ locale, shot, options }) {
  const fixture = await loadFixture(shot);
  const session = await createPage(options.cdpPort);

  try {
    await preparePage(session, locale, options.viewport, fixture);
    const shotUrl = buildShotUrl(options.url, shot, fixture);
    await navigate(session, shotUrl.toString());
    await waitForShot(session, shot);

    const filePath = path.join(options.outDir, getOutputFileName(locale, shot));
    await capture(session, filePath);
    console.log(
      `[store-snapshot] ${locale}/${shot} -> ${path.relative(repoRoot, filePath)}`,
    );
  } finally {
    try {
      await session.send("Page.close");
    } catch {
      // Ignore close failures; the WebSocket is still closed below.
    }
    session.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(options.outDir, { recursive: true });

  let viteProcess = null;
  let chrome = null;

  try {
    if (options.serve) {
      viteProcess = await startViteServer(options);
    } else {
      await waitForHttp(options.url);
    }

    chrome = await startChrome(options);

    for (const shot of options.shots) {
      const shotConfig = SHOT_CONFIG[shot];

      if (shotConfig.localized) {
        for (const locale of options.locales) {
          await captureShot({ locale, shot, options });
        }
      } else {
        await captureShot({ locale: options.locales[0], shot, options });
      }
    }

    console.log(`[store-snapshot] done: ${path.relative(repoRoot, options.outDir)}`);
  } finally {
    if (chrome) {
      await chrome.cleanup();
    }
    if (viteProcess) {
      viteProcess.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  console.error("[store-snapshot] failed", error);
  process.exit(1);
});

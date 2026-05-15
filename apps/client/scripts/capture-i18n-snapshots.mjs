#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(clientRoot, "..", "..");

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

const DEFAULT_VIEWPORT = {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv) {
  const options = {
    serve: false,
    url: process.env.DIGIVICE_SNAPSHOT_URL ?? "http://127.0.0.1:5173",
    port: Number(process.env.DIGIVICE_SNAPSHOT_PORT ?? 5173),
    cdpPort: Number(process.env.DIGIVICE_SNAPSHOT_CDP_PORT ?? 9222),
    outDir: null,
    locales: LOCALES,
    screens: ["setup", "settings"],
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
      options.locales = next.split(",").map((locale) => locale.trim()).filter(Boolean);
      index += 1;
      continue;
    }
    if (arg === "--screens" && next) {
      options.screens = next.split(",").map((screen) => screen.trim()).filter(Boolean);
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

  if (!options.outDir) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    options.outDir = path.join(repoRoot, "tmp", "i18n-snapshots", stamp);
  }

  return options;
}

function printHelp() {
  console.log(`Capture Digivice i18n UI snapshots.

Usage:
  pnpm --filter @digivice/client snapshot:i18n
  pnpm --filter @digivice/client snapshot:i18n:current -- --url http://127.0.0.1:5173

Options:
  --serve                 Build and start a temporary Vite preview server before capture.
  --url <url>             Existing app URL. Default: http://127.0.0.1:5173
  --port <port>           Vite port when using --serve. Default: 5173
  --cdp-port <port>       Chrome DevTools Protocol port. Default: 9222
  --out <dir>             Output directory. Default: tmp/i18n-snapshots/<timestamp>
  --locales <csv>         Locale list. Default: ${LOCALES.join(",")}
  --screens <csv>         Screens to capture. Default: setup,settings
  --chrome <path>         Chrome executable path.
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

async function waitForHttp(url, timeoutMs = 30_000) {
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
  await runCommand("pnpm", ["run", "build:development"], {
    cwd: clientRoot,
    env: {
      ...process.env,
      APP_LOGO_TEXT: "SNAPSHOT",
    },
  });

  const child = spawn(
    "pnpm",
    ["exec", "vite", "preview", "--host", "127.0.0.1", "--port", String(options.port), "--strictPort"],
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
  const userDataDir = await mkdtemp(path.join(tmpdir(), "digivice-i18n-chrome-"));
  const child = spawn(
    options.chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      "--disable-features=MediaRouter,OptimizationHints",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
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
      await rm(userDataDir, { recursive: true, force: true });
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

async function preparePage(session, locale) {
  await session.open();
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: DEFAULT_VIEWPORT.width,
    height: DEFAULT_VIEWPORT.height,
    deviceScaleFactor: DEFAULT_VIEWPORT.deviceScaleFactor,
    mobile: true,
  });
  await session.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      localStorage.clear();
      localStorage.setItem("game.settings.locale", ${JSON.stringify(locale)});
      localStorage.setItem("game.settings.vibrationEnabled", "false");
    `,
  });
}

async function navigate(session, url) {
  await session.send("Page.navigate", { url });
  await waitUntil(
    session,
    "document.readyState === \"interactive\" || document.readyState === \"complete\"",
  );
  await sleep(800);
}

async function waitUntil(session, expression, timeoutMs = 15_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await evaluate(session, expression)) {
      return;
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function capture(session, filePath) {
  const result = await session.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });

  await writeFile(filePath, Buffer.from(result.data, "base64"));
}

async function captureScreen({ locale, screen, options, localeDir }) {
  const session = await createPage(options.cdpPort);
  try {
    await preparePage(session, locale);
    const screenUrl = new URL(options.url);
    screenUrl.searchParams.set("snapshotLayer", screen);
    await navigate(session, screenUrl.toString());

    if (screen === "setup") {
      await waitUntil(session, "Boolean(document.querySelector('input[placeholder]'))");
      await sleep(300);
    } else if (screen === "settings") {
      await waitUntil(
        session,
        "document.querySelectorAll('#app-container button').length >= 4",
      );
      await sleep(300);
    } else {
      throw new Error(`Unsupported screen: ${screen}`);
    }

    const filePath = path.join(localeDir, `${screen}.png`);
    await capture(session, filePath);
    console.log(`[snapshot] ${locale}/${screen} -> ${path.relative(repoRoot, filePath)}`);
  } finally {
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

    for (const locale of options.locales) {
      const localeDir = path.join(options.outDir, locale);
      await mkdir(localeDir, { recursive: true });

      for (const screen of options.screens) {
        await captureScreen({ locale, screen, options, localeDir });
      }
    }

    console.log(`[snapshot] done: ${path.relative(repoRoot, options.outDir)}`);
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
  console.error("[snapshot] failed", error);
  process.exit(1);
});

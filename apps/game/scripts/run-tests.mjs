import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gameRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(gameRoot, "..", "..");
const srcRoot = path.join(gameRoot, "src");
const outDir = path.join(gameRoot, ".test-dist");

async function collectTestFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTestFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

async function loadEsbuild() {
  const pnpmDir = path.join(repoRoot, "node_modules", ".pnpm");
  const esbuildPackageDir = readdirSync(pnpmDir).find((name) =>
    name.startsWith("esbuild@"),
  );

  if (!esbuildPackageDir) {
    throw new Error("esbuild package not found in node_modules/.pnpm");
  }

  const esbuildEntry = path.join(
    pnpmDir,
    esbuildPackageDir,
    "node_modules",
    "esbuild",
    "lib",
    "main.js",
  );

  return import(pathToFileURL(esbuildEntry).href);
}

function getOutputTestFiles(testFiles) {
  return testFiles.map((filePath) => {
    const relativePath = path.relative(srcRoot, filePath);
    return path.join(outDir, relativePath.replace(/\.ts$/, ".js"));
  });
}

async function ensureDirClean(dirPath) {
  rmSync(dirPath, { recursive: true, force: true });
  mkdirSync(dirPath, { recursive: true });
}

async function buildTests(esbuild, testFiles) {
  await ensureDirClean(outDir);

  await esbuild.build({
    entryPoints: testFiles,
    outdir: outDir,
    outbase: srcRoot,
    absWorkingDir: gameRoot,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: ["node20"],
    sourcemap: "inline",
    logLevel: "silent",
    external: ["/assets/*"],
    alias: {
      "@": path.join(gameRoot, "src"),
      "@shared/storage": path.join(repoRoot, "shared", "storage", "src", "index.ts"),
    },
    define: {
      "import.meta.env.DEV": "true",
      ECS_NULL_VALUE: "0",
      ECS_CHARACTER_STATUS_LENGTH: "4",
    },
  });
}

function runNodeTest(outputFiles) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--test", ...outputFiles], {
      cwd: gameRoot,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      resolve(code ?? 1);
    });
  });
}

async function main() {
  const testFiles = await collectTestFiles(srcRoot);
  if (testFiles.length === 0) {
    console.error("[game-tests] No .test.ts files found under src/");
    process.exit(1);
  }

  const esbuild = await loadEsbuild();
  await buildTests(esbuild, testFiles);

  const outputFiles = getOutputTestFiles(testFiles).filter((filePath) =>
    existsSync(filePath),
  );

  if (outputFiles.length === 0) {
    console.error("[game-tests] No bundled test files were generated");
    process.exit(1);
  }

  const exitCode = await runNodeTest(outputFiles);
  process.exit(exitCode);
}

main().catch(async (error) => {
  console.error("[game-tests] Failed to run tests:", error);

  if (existsSync(outDir)) {
    const outDirStats = await stat(outDir).catch(() => null);
    if (outDirStats?.isDirectory()) {
      console.error(`[game-tests] Bundled output left at ${outDir}`);
    }
  }

  process.exit(1);
});

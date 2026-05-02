import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const logicalSize = 128;
const scale = 4;
const outputSize = logicalSize * scale;
const sharedLayoutSeed = 17;

const targetDirs = [
  path.join(repoRoot, "apps", "game", "assets", "tiles"),
  path.join(repoRoot, "apps", "client", "public", "game", "tiles"),
  path.join(
    repoRoot,
    "virtual_bridge",
    "assets",
    "web",
    "assets",
    "game",
    "tiles",
  ),
];

const variants = [
  {
    key: "day",
    outputName: "grass-tile.jpg",
    palette: {
      ground: ["#79a953", "#86b360"],
      tuft: ["#679d3f", "#9dcd69"],
      flowerPetal: "#f4f3d7",
      flowerPinkPetal: "#efbfd0",
      flowerCenter: "#f8ca4d",
      stone: "#6b7e57",
    },
  },
  {
    key: "sunrise",
    outputName: "grass-tile-sunrise.jpg",
    palette: {
      ground: ["#a69a64", "#b2a96f"],
      tuft: ["#849944", "#efcf86"],
      flowerPetal: "#ffe3cc",
      flowerPinkPetal: "#f0bfd1",
      flowerCenter: "#ff9d5c",
      stone: "#8c8058",
    },
  },
  {
    key: "sunset",
    outputName: "grass-tile-sunset.jpg",
    palette: {
      ground: ["#827f62", "#91866b"],
      tuft: ["#62804a", "#e99d70"],
      flowerPetal: "#ffd8ca",
      flowerPinkPetal: "#f3adc5",
      flowerCenter: "#ff8458",
      stone: "#7e6b58",
    },
  },
  {
    key: "evening",
    outputName: "grass-tile-evening.jpg",
    palette: {
      ground: ["#617260", "#70806d"],
      tuft: ["#49604b", "#98af90"],
      flowerPetal: "#dcc9d7",
      flowerPinkPetal: "#dba9c1",
      flowerCenter: "#d88d74",
      stone: "#697360",
    },
  },
];

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function hash2d(x, y, seed) {
  let state = Math.imul(x ^ (seed * 0x45d9f3b), 0x27d4eb2d);
  state ^= Math.imul(y + seed * 0x9e3779b1, 0x85ebca6b);
  state = Math.imul(state ^ (state >>> 15), 0xc2b2ae35);
  state ^= state >>> 16;
  return (state >>> 0) / 0xffffffff;
}

function samplePeriodicNoise(x, y, cellSize, seed) {
  const period = logicalSize / cellSize;
  const gridX = Math.floor(x / cellSize);
  const gridY = Math.floor(y / cellSize);
  const localX = (x % cellSize) / cellSize;
  const localY = (y % cellSize) / cellSize;
  const tx = smoothstep(localX);
  const ty = smoothstep(localY);

  const x0 = mod(gridX, period);
  const x1 = mod(gridX + 1, period);
  const y0 = mod(gridY, period);
  const y1 = mod(gridY + 1, period);

  const v00 = hash2d(x0, y0, seed);
  const v10 = hash2d(x1, y0, seed);
  const v01 = hash2d(x0, y1, seed);
  const v11 = hash2d(x1, y1, seed);

  const top = lerp(v00, v10, tx);
  const bottom = lerp(v01, v11, tx);
  return lerp(top, bottom, ty);
}

function createLogicalCanvas() {
  return new Uint8Array(logicalSize * logicalSize * 4);
}

function setLogicalPixel(canvas, x, y, color) {
  const wrappedX = mod(x, logicalSize);
  const wrappedY = mod(y, logicalSize);
  const index = (wrappedY * logicalSize + wrappedX) * 4;
  canvas[index] = color.r;
  canvas[index + 1] = color.g;
  canvas[index + 2] = color.b;
  canvas[index + 3] = 255;
}

function getLogicalPixel(canvas, x, y) {
  const wrappedX = mod(x, logicalSize);
  const wrappedY = mod(y, logicalSize);
  const index = (wrappedY * logicalSize + wrappedX) * 4;
  return {
    r: canvas[index],
    g: canvas[index + 1],
    b: canvas[index + 2],
  };
}

function mixColor(colorA, colorB, amount) {
  return {
    r: Math.round(lerp(colorA.r, colorB.r, amount)),
    g: Math.round(lerp(colorA.g, colorB.g, amount)),
    b: Math.round(lerp(colorA.b, colorB.b, amount)),
  };
}

function drawTuft(canvas, baseX, baseY, palette, orientation) {
  const tuftColors = palette.tuft.map(hexToRgb);
  const tuftColor = tuftColors[orientation % tuftColors.length];
  const shapes = [
    [
      { dx: 0, dy: 1 },
      { dx: 0, dy: 2 },
      { dx: 3, dy: 0 },
      { dx: 3, dy: 1 },
      { dx: 3, dy: 2 },
    ],
    [
      { dx: 0, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: 2 },
      { dx: 3, dy: 1 },
      { dx: 3, dy: 2 },
    ],
    [
      { dx: 0, dy: 1 },
      { dx: 0, dy: 2 },
      { dx: 2, dy: 1 },
      { dx: 2, dy: 2 },
      { dx: 4, dy: 0 },
      { dx: 4, dy: 1 },
      { dx: 4, dy: 2 },
    ],
  ];

  for (const pixel of shapes[orientation % shapes.length]) {
    setLogicalPixel(canvas, baseX + pixel.dx, baseY + pixel.dy, tuftColor);
  }
}

function drawFlower(canvas, baseX, baseY, palette, usePinkPetal) {
  const petal = hexToRgb(
    usePinkPetal ? palette.flowerPinkPetal : palette.flowerPetal,
  );
  const center = hexToRgb(palette.flowerCenter);
  const pixels = [
    { dx: 1, dy: 0, color: petal },
    { dx: 0, dy: 1, color: petal },
    { dx: 1, dy: 1, color: center },
    { dx: 2, dy: 1, color: petal },
    { dx: 1, dy: 2, color: petal },
  ];

  for (const pixel of pixels) {
    setLogicalPixel(canvas, baseX + pixel.dx, baseY + pixel.dy, pixel.color);
  }
}

function addBaseNoise(canvas, palette, seed) {
  const groundColors = palette.ground.map(hexToRgb);

  for (let y = 0; y < logicalSize; y += 1) {
    for (let x = 0; x < logicalSize; x += 1) {
      const broad = samplePeriodicNoise(x, y, 46, seed + 11);
      const medium = samplePeriodicNoise(x + 9, y + 13, 22, seed + 23);
      const edge = samplePeriodicNoise(x + 3, y + 7, 10, seed + 31);
      const contour = broad * 0.7 + medium * 0.3;
      const boundary = 0.5 + (edge - 0.5) * 0.12;
      const color = contour > boundary ? groundColors[1] : groundColors[0];

      setLogicalPixel(canvas, x, y, color);
    }
  }
}

function addDetailSprites(canvas, palette, seed) {
  for (let index = 0; index < 52; index += 1) {
    const x = Math.floor(hash2d(index, 19, seed + 13) * logicalSize);
    const y = Math.floor(hash2d(index, 23, seed + 29) * logicalSize);
    drawTuft(canvas, x, y, palette, index + seed);
  }

  for (let index = 0; index < 13; index += 1) {
    const x = Math.floor(hash2d(index, 31, seed + 41) * logicalSize);
    const y = Math.floor(hash2d(index, 37, seed + 53) * logicalSize);
    const usePinkPetal = hash2d(index, 43, seed + 61) > 0.34;
    drawFlower(canvas, x, y, palette, usePinkPetal);
  }
}

function upscaleNearest(canvas) {
  const output = Buffer.alloc(outputSize * outputSize * 4);

  for (let y = 0; y < logicalSize; y += 1) {
    for (let x = 0; x < logicalSize; x += 1) {
      const sourceIndex = (y * logicalSize + x) * 4;

      for (let offsetY = 0; offsetY < scale; offsetY += 1) {
        for (let offsetX = 0; offsetX < scale; offsetX += 1) {
          const targetX = x * scale + offsetX;
          const targetY = y * scale + offsetY;
          const targetIndex = (targetY * outputSize + targetX) * 4;
          output[targetIndex] = canvas[sourceIndex];
          output[targetIndex + 1] = canvas[sourceIndex + 1];
          output[targetIndex + 2] = canvas[sourceIndex + 2];
          output[targetIndex + 3] = 255;
        }
      }
    }
  }

  return output;
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgbaData) {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    rgbaData.copy(raw, rowStart + 1, y * stride, y * stride + stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    createChunk("IHDR", ihdr),
    createChunk("IDAT", compressed),
    createChunk("IEND", Buffer.alloc(0)),
  ]);
}

function convertPngToJpeg(pngPath, jpegPath) {
  execFileSync(
    "sips",
    [
      "-s",
      "format",
      "jpeg",
      "-s",
      "formatOptions",
      "100",
      pngPath,
      "--out",
      jpegPath,
    ],
    {
      stdio: "pipe",
    },
  );
}

function renderVariant(variant) {
  const logicalCanvas = createLogicalCanvas();

  // Reuse one tile layout for every time-of-day variant and only swap palettes.
  addBaseNoise(logicalCanvas, variant.palette, sharedLayoutSeed);
  addDetailSprites(logicalCanvas, variant.palette, sharedLayoutSeed);
  return upscaleNearest(logicalCanvas);
}

function main() {
  const tempDir = path.join(repoRoot, ".tmp-generated-tiles");
  mkdirSync(tempDir, { recursive: true });

  for (const targetDir of targetDirs) {
    mkdirSync(targetDir, { recursive: true });
  }

  for (const variant of variants) {
    const rgba = renderVariant(variant);
    const tempPngPath = path.join(tempDir, `${variant.key}.png`);
    writeFileSync(tempPngPath, encodePng(outputSize, outputSize, rgba));

    for (const targetDir of targetDirs) {
      convertPngToJpeg(tempPngPath, path.join(targetDir, variant.outputName));
    }
  }

  rmSync(tempDir, { recursive: true, force: true });

  const summary = variants
    .map((variant) => `${variant.outputName} (${outputSize}x${outputSize})`)
    .join("\n");
  process.stdout.write(`${summary}\n`);
}

main();

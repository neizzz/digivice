import { useEffect, useMemo, useRef, useState } from "react";
import "./SpritesheetFrameViewerPage.css";

type SpritesheetFrame = {
  frame: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
};

type SpritesheetData = {
  frames: Record<string, SpritesheetFrame>;
  meta?: {
    image?: string;
    size?: {
      w: number;
      h: number;
    };
  };
};

type LoadedSpritesheet = {
  data: SpritesheetData;
  jsonSourceLabel: string;
  imageSourceLabel: string;
  imageUrl: string;
};

const DEFAULT_JSON_PATH = "/assets/game/sprites/foods.json";

function getQueryValue(key: string, fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }

  return new URLSearchParams(window.location.search).get(key)?.trim() || fallback;
}

function resolveRelativePath(path: string, basePath: string): string {
  if (/^(?:https?:)?\/\//.test(path) || path.startsWith("/")) {
    return path;
  }

  const normalizedBase = basePath.includes("?")
    ? basePath.slice(0, basePath.indexOf("?"))
    : basePath;
  const baseDirectory = normalizedBase.endsWith("/")
    ? normalizedBase
    : normalizedBase.slice(0, normalizedBase.lastIndexOf("/") + 1);

  return new URL(path, window.location.origin + baseDirectory).pathname;
}

async function readJsonFile(file: File): Promise<SpritesheetData> {
  const text = await file.text();
  return JSON.parse(text) as SpritesheetData;
}

function buildFramePreviewStyle(params: {
  imageUrl: string;
  sheetWidth: number;
  sheetHeight: number;
  frame: SpritesheetFrame["frame"];
  scale: number;
}) {
  const { imageUrl, sheetWidth, sheetHeight, frame, scale } = params;

  return {
    width: `${Math.max(frame.w * scale, 48)}px`,
    height: `${Math.max(frame.h * scale, 48)}px`,
    backgroundImage: `url(${imageUrl})`,
    backgroundPosition: `${-frame.x * scale}px ${-frame.y * scale}px`,
    backgroundSize: `${sheetWidth * scale}px ${sheetHeight * scale}px`,
  };
}

export default function SpritesheetFrameViewerPage() {
  const [jsonPathInput, setJsonPathInput] = useState(() =>
    getQueryValue("json", DEFAULT_JSON_PATH),
  );
  const [imagePathInput, setImagePathInput] = useState(() =>
    getQueryValue("image", ""),
  );
  const [frameFilterInput, setFrameFilterInput] = useState(() =>
    getQueryValue("filter", ""),
  );
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loadedSheet, setLoadedSheet] = useState<LoadedSpritesheet | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const localImageUrlRef = useRef<string | null>(null);

  useEffect(() => {
    document.title = "MonTTo Spritesheet Frame Viewer";
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (jsonPathInput.trim()) {
      params.set("json", jsonPathInput.trim());
    } else {
      params.delete("json");
    }

    if (imagePathInput.trim()) {
      params.set("image", imagePathInput.trim());
    } else {
      params.delete("image");
    }

    if (frameFilterInput.trim()) {
      params.set("filter", frameFilterInput.trim());
    } else {
      params.delete("filter");
    }

    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState(null, "", nextUrl);
  }, [frameFilterInput, imagePathInput, jsonPathInput]);

  useEffect(() => {
    void loadSpritesheet();

    return () => {
      if (localImageUrlRef.current) {
        URL.revokeObjectURL(localImageUrlRef.current);
      }
    };
  }, []);

  const frameEntries = useMemo(() => {
    if (!loadedSheet) {
      return [];
    }

    return Object.entries(loadedSheet.data.frames).sort(([leftKey], [rightKey]) =>
      leftKey.localeCompare(rightKey),
    );
  }, [loadedSheet]);

  const filteredFrameEntries = useMemo(() => {
    const query = frameFilterInput.trim().toLowerCase();
    if (!query) {
      return frameEntries;
    }

    return frameEntries.filter(([key]) => key.toLowerCase().includes(query));
  }, [frameEntries, frameFilterInput]);

  const sheetWidth = loadedSheet?.data.meta?.size?.w ?? 0;
  const sheetHeight = loadedSheet?.data.meta?.size?.h ?? 0;

  async function loadSpritesheet() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const trimmedJsonPath = jsonPathInput.trim();
      const trimmedImagePath = imagePathInput.trim();

      let data: SpritesheetData;
      let resolvedJsonPath: string | undefined;
      let jsonSourceLabel: string;

      if (jsonFile) {
        data = await readJsonFile(jsonFile);
        jsonSourceLabel = jsonFile.name;
      } else {
        if (!trimmedJsonPath) {
          throw new Error("JSON path를 입력하거나 JSON 파일을 선택해주세요.");
        }

        const response = await fetch(trimmedJsonPath);
        if (!response.ok) {
          throw new Error(`JSON fetch failed with HTTP ${response.status}`);
        }

        data = (await response.json()) as SpritesheetData;
        resolvedJsonPath = trimmedJsonPath;
        jsonSourceLabel = trimmedJsonPath;
      }

      if (!data.frames || Object.keys(data.frames).length === 0) {
        throw new Error("Spritesheet JSON에 frames가 없습니다.");
      }

      if (localImageUrlRef.current) {
        URL.revokeObjectURL(localImageUrlRef.current);
        localImageUrlRef.current = null;
      }

      let imageUrl = "";
      let imageSourceLabel = "";

      if (imageFile) {
        imageUrl = URL.createObjectURL(imageFile);
        localImageUrlRef.current = imageUrl;
        imageSourceLabel = imageFile.name;
      } else if (trimmedImagePath) {
        imageUrl = trimmedImagePath;
        imageSourceLabel = trimmedImagePath;
      } else if (typeof data.meta?.image === "string" && data.meta.image.trim()) {
        if (!resolvedJsonPath) {
          throw new Error(
            "로컬 JSON 파일에서는 이미지 파일도 함께 선택하거나 이미지 경로를 직접 입력해주세요.",
          );
        }

        imageUrl = resolveRelativePath(data.meta.image, resolvedJsonPath);
        imageSourceLabel = imageUrl;
      } else {
        throw new Error(
          "이미지 경로를 찾을 수 없습니다. image path를 입력하거나 이미지 파일을 선택해주세요.",
        );
      }

      setLoadedSheet({
        data,
        imageUrl,
        jsonSourceLabel,
        imageSourceLabel,
      });
    } catch (error) {
      setLoadedSheet(null);
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="spritesheet-frame-viewer-page">
      <header className="spritesheet-frame-viewer-page__header">
        <div>
          <p className="spritesheet-frame-viewer-page__eyebrow">PC DEV TOOL</p>
          <h1>MonTTo Spritesheet Frame Viewer</h1>
          <p className="spritesheet-frame-viewer-page__description">
            Load any spritesheet JSON + image pair and render every frame in one gallery.
          </p>
        </div>

        <div className="spritesheet-frame-viewer-page__summary">
          <div className="spritesheet-frame-viewer-summary-card">
            <span className="spritesheet-frame-viewer-summary-card__label">Frames</span>
            <strong>{frameEntries.length}</strong>
            <span>loaded</span>
          </div>
          <div className="spritesheet-frame-viewer-summary-card">
            <span className="spritesheet-frame-viewer-summary-card__label">Visible</span>
            <strong>{filteredFrameEntries.length}</strong>
            <span>filtered</span>
          </div>
          <div className="spritesheet-frame-viewer-summary-card">
            <span className="spritesheet-frame-viewer-summary-card__label">Sheet</span>
            <strong>
              {sheetWidth > 0 && sheetHeight > 0 ? `${sheetWidth}×${sheetHeight}` : "-"}
            </strong>
            <span>pixels</span>
          </div>
        </div>
      </header>

      <div className="spritesheet-frame-viewer-page__layout">
        <aside className="spritesheet-frame-viewer-panel">
          <div className="spritesheet-frame-viewer-panel__section">
            <h2>Load source</h2>
            <div className="spritesheet-frame-viewer-field-grid">
              <div className="spritesheet-frame-viewer-field">
                <label htmlFor="spritesheet-json-path">Spritesheet JSON path</label>
                <input
                  id="spritesheet-json-path"
                  type="text"
                  value={jsonPathInput}
                  onChange={(event) => setJsonPathInput(event.target.value)}
                  placeholder="/assets/game/sprites/foods.json"
                />
                <span className="spritesheet-frame-viewer-field__hint">
                  public 경로나 dev server에서 접근 가능한 JSON URL
                </span>
              </div>

              <div className="spritesheet-frame-viewer-field">
                <label htmlFor="spritesheet-image-path">Image path (optional)</label>
                <input
                  id="spritesheet-image-path"
                  type="text"
                  value={imagePathInput}
                  onChange={(event) => setImagePathInput(event.target.value)}
                  placeholder="Leave blank to resolve from meta.image"
                />
                <span className="spritesheet-frame-viewer-field__hint">
                  비워두면 JSON의 `meta.image` 기준으로 자동 추론
                </span>
              </div>

              <div className="spritesheet-frame-viewer-field">
                <label htmlFor="spritesheet-json-file">Or choose local JSON file</label>
                <input
                  id="spritesheet-json-file"
                  type="file"
                  accept=".json,application/json"
                  onChange={(event) => setJsonFile(event.target.files?.[0] ?? null)}
                />
              </div>

              <div className="spritesheet-frame-viewer-field">
                <label htmlFor="spritesheet-image-file">Optional local image file</label>
                <input
                  id="spritesheet-image-file"
                  type="file"
                  accept="image/png,image/webp,image/jpeg,image/gif"
                  onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <div className="spritesheet-frame-viewer-actions">
              <button type="button" onClick={() => void loadSpritesheet()} disabled={isLoading}>
                {isLoading ? "Loading..." : "Load spritesheet"}
              </button>
              <button
                type="button"
                className="spritesheet-frame-viewer-actions__secondary"
                onClick={() => {
                  setJsonFile(null);
                  setImageFile(null);
                  setJsonPathInput(DEFAULT_JSON_PATH);
                  setImagePathInput("");
                  setFrameFilterInput("");
                }}
              >
                Reset inputs
              </button>
            </div>

            {errorMessage ? (
              <div className="spritesheet-frame-viewer-status spritesheet-frame-viewer-status--error">
                {errorMessage}
              </div>
            ) : null}
          </div>

          <div className="spritesheet-frame-viewer-panel__section">
            <h3>Filter frames</h3>
            <div className="spritesheet-frame-viewer-field">
              <label htmlFor="spritesheet-frame-filter">Frame key contains</label>
              <input
                id="spritesheet-frame-filter"
                type="search"
                value={frameFilterInput}
                onChange={(event) => setFrameFilterInput(event.target.value)}
                placeholder="food_"
              />
            </div>
            <div className="spritesheet-frame-viewer-status spritesheet-frame-viewer-status--info">
              JSON: {loadedSheet?.jsonSourceLabel ?? "-"}
              <br />
              Image: {loadedSheet?.imageSourceLabel ?? "-"}
            </div>
          </div>
        </aside>

        <section className="spritesheet-frame-viewer-panel">
          <div className="spritesheet-frame-viewer-panel__section">
            <h2>All frames</h2>

            {loadedSheet && filteredFrameEntries.length > 0 ? (
              <div className="spritesheet-frame-viewer-gallery">
                {filteredFrameEntries.map(([frameKey, frameState]) => (
                  <article key={frameKey} className="spritesheet-frame-viewer-frame-card">
                    <div
                      className="spritesheet-frame-viewer-frame-card__preview"
                      style={buildFramePreviewStyle({
                        imageUrl: loadedSheet.imageUrl,
                        sheetWidth,
                        sheetHeight,
                        frame: frameState.frame,
                        scale: 6,
                      })}
                    />
                    <div className="spritesheet-frame-viewer-frame-card__meta">
                      <strong>{frameKey}</strong>
                      <span>
                        {frameState.frame.x}, {frameState.frame.y}
                      </span>
                      <span>
                        {frameState.frame.w}×{frameState.frame.h}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="spritesheet-frame-viewer-preview-placeholder">
                {loadedSheet
                  ? "조건에 맞는 frame이 없습니다."
                  : "Spritesheet를 로드하면 모든 frame gallery가 여기에 표시됩니다."}
              </div>
            )}
          </div>

          <div className="spritesheet-frame-viewer-panel__section">
            <h3>Sheet reference</h3>
            {loadedSheet ? (
              <div className="spritesheet-frame-viewer-sheet">
                <img src={loadedSheet.imageUrl} alt="Spritesheet" />
                <div className="spritesheet-frame-viewer-sheet__caption">
                  전체 spritesheet 원본 이미지
                </div>
              </div>
            ) : (
              <div className="spritesheet-frame-viewer-preview-placeholder">
                원본 spritesheet는 로드 후 여기에 표시됩니다.
              </div>
            )}
          </div>

          <div className="spritesheet-frame-viewer-panel__section">
            <h3>Usage tips</h3>
            <div className="spritesheet-frame-viewer-status spritesheet-frame-viewer-status--info">
              Example URL:{" "}
              <code>
                /spritesheet-frame-viewer.html?json=/assets/game/sprites/foods.json&filter=food_
              </code>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

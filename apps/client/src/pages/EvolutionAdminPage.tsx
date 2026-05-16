import {
  applyEvolutionAdminExport,
  buildEvolutionAdminExport,
  getEvolutionAdminCatalog,
  simulateEvolutionAdminRolls,
  validateEvolutionAdminExport,
  type EvolutionAdminCatalogEntry,
  type EvolutionAdminSimulationResult,
} from "@digivice/game";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import "./EvolutionAdminPage.css";

const BASE_CATALOG = getEvolutionAdminCatalog();
const BASE_CATALOG_BY_CODE = new Map(
  BASE_CATALOG.map((entry) => [entry.code, entry]),
);
const SIMULATION_ROLL_COUNT = 10_000;
const CARD_PREVIEW_FRAME_SCALE = 3;
const TARGET_PREVIEW_FRAME_SCALE = 2;

type SimulationMap = Record<string, EvolutionAdminSimulationResult[]>;
type MonsterSpritesheet = {
  frames: Record<
    string,
    {
      frame: {
        x: number;
        y: number;
        w: number;
        h: number;
      };
    }
  >;
  animations: Record<string, string[]>;
  meta: {
    image: string;
    size: {
      w: number;
      h: number;
    };
  };
};
type MonsterFrameLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: MonsterSpritesheet };
type MonsterFrameStateMap = Record<string, MonsterFrameLoadState>;
type MonsterRepresentativeFrame = {
  imagePath: string;
  sheetWidth: number;
  sheetHeight: number;
  frame: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
};
type FrameViewportProps = {
  imagePath: string;
  sheetWidth: number;
  sheetHeight: number;
  frame: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  scale?: number;
};

function cloneCatalogEntry(
  entry: EvolutionAdminCatalogEntry,
): EvolutionAdminCatalogEntry {
  return {
    ...entry,
    candidates: entry.candidates.map((candidate) => ({ ...candidate })),
  };
}

function getBaselineEntry(code: EvolutionAdminCatalogEntry["code"]) {
  const entry = BASE_CATALOG_BY_CODE.get(code);

  if (!entry) {
    throw new Error(`[EvolutionAdminPage] Missing baseline entry for ${code}`);
  }

  return entry;
}

function getEntryTotalWeight(entry: EvolutionAdminCatalogEntry): number {
  return entry.candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
}

function isEntryChanged(entry: EvolutionAdminCatalogEntry): boolean {
  const baselineEntry = getBaselineEntry(entry.code);

  if (entry.candidates.length !== baselineEntry.candidates.length) {
    return true;
  }

  return entry.candidates.some((candidate, index) => {
    const baselineCandidate = baselineEntry.candidates[index];

    return (
      !baselineCandidate ||
      candidate.toCode !== baselineCandidate.toCode ||
      candidate.kind !== baselineCandidate.kind ||
      candidate.weight !== baselineCandidate.weight
    );
  });
}

function isEntryValid(entry: EvolutionAdminCatalogEntry): boolean {
  return entry.candidates.every(
    (candidate) =>
      Number.isInteger(candidate.weight) &&
      candidate.weight >= 0 &&
      candidate.weight <= 100,
  );
}

function formatKindLabel(kind: string): string {
  switch (kind) {
    case "base":
      return "Base";
    case "same_line_variant_mutation":
      return "Same Line Variant";
    case "same_class_cross_line_mutation":
      return "Cross Line";
    default:
      return kind;
  }
}

function formatPhaseLabel(phase: number): string {
  return `Phase ${phase}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getExpectedPercent(weight: number, totalWeight: number): number {
  return totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
}

function getRepresentativeFrame(
  state: MonsterFrameLoadState | undefined,
): MonsterRepresentativeFrame | null {
  if (!state || state.status !== "ready") {
    return null;
  }

  const preferredFrameNames = [
    state.data.animations.idle?.[0],
    "in-basket",
    state.data.animations.walking?.[0],
    Object.keys(state.data.frames)[0],
  ].filter((frameName): frameName is string => Boolean(frameName));

  for (const frameName of preferredFrameNames) {
    const frame = state.data.frames[frameName]?.frame;

    if (!frame) {
      continue;
    }

    return {
      imagePath: `/assets/game/sprites/monsters/${state.data.meta.image}`,
      sheetWidth: state.data.meta.size.w,
      sheetHeight: state.data.meta.size.h,
      frame,
    };
  }

  return null;
}

function FrameViewport({
  imagePath,
  sheetWidth,
  sheetHeight,
  frame,
  scale = CARD_PREVIEW_FRAME_SCALE,
}: FrameViewportProps) {
  const viewportStyle = {
    width: `${frame.w * scale}px`,
    height: `${frame.h * scale}px`,
    backgroundImage: `url(${imagePath})`,
    backgroundPosition: `${-frame.x * scale}px ${-frame.y * scale}px`,
    backgroundSize: `${sheetWidth * scale}px ${sheetHeight * scale}px`,
  };

  return <div className="evolution-admin-frame-preview__viewport" style={viewportStyle} />;
}

export default function EvolutionAdminPage() {
  const [catalog, setCatalog] = useState<EvolutionAdminCatalogEntry[]>(() =>
    getEvolutionAdminCatalog(),
  );
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [simulationResults, setSimulationResults] = useState<SimulationMap>({});
  const [frameStates, setFrameStates] = useState<MonsterFrameStateMap>(() =>
    Object.fromEntries(BASE_CATALOG.map((entry) => [entry.code, { status: "loading" }])) as MonsterFrameStateMap,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "MonTTo Evolution Admin";
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMonsterFrames() {
      const results = await Promise.all(
        BASE_CATALOG.map(async (entry) => {
          try {
            const response = await fetch(
              `/assets/game/sprites/monsters/${entry.spritesheetName}.json`,
            );

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const data = (await response.json()) as MonsterSpritesheet;

            return [
              entry.code,
              {
                status: "ready",
                data,
              } satisfies MonsterFrameLoadState,
            ] as const;
          } catch (error) {
            return [
              entry.code,
              {
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error",
              } satisfies MonsterFrameLoadState,
            ] as const;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      setFrameStates(Object.fromEntries(results));
    }

    void loadMonsterFrames();

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const editableEntries = catalog.filter((entry) => entry.candidates.length > 0);
    const invalidEditableEntries = editableEntries.filter(
      (entry) => !isEntryValid(entry),
    );
    const changedEntries = editableEntries.filter((entry) => isEntryChanged(entry));

    return {
      totalEntries: catalog.length,
      editableEntries: editableEntries.length,
      invalidEditableEntries: invalidEditableEntries.length,
      changedEntries: changedEntries.length,
    };
  }, [catalog]);

  const exportData = useMemo(
    () =>
      buildEvolutionAdminExport({
        baseCatalog: BASE_CATALOG,
        currentCatalog: catalog,
      }),
    [catalog],
  );

  const canExport = summary.invalidEditableEntries === 0;
  const exportJson = useMemo(
    () =>
      canExport
        ? JSON.stringify(exportData, null, 2)
        : "// Fix invalid weights before exporting JSON.",
    [canExport, exportData],
  );

  const entriesByPhase = useMemo(() => {
    const phaseMap = new Map<number, EvolutionAdminCatalogEntry[]>();

    for (const entry of catalog) {
      const existingEntries = phaseMap.get(entry.phase) ?? [];
      existingEntries.push(entry);
      phaseMap.set(entry.phase, existingEntries);
    }

    return Array.from(phaseMap.entries()).sort(([left], [right]) => left - right);
  }, [catalog]);

  const handleWeightChange = (
    sourceCode: EvolutionAdminCatalogEntry["code"],
    targetCode: string,
    rawValue: string,
  ) => {
    const parsedValue = rawValue.trim() === "" ? 0 : Number.parseInt(rawValue, 10);

    if (Number.isNaN(parsedValue)) {
      return;
    }

    const nextValue = Math.min(100, Math.max(0, parsedValue));

    setCatalog((currentCatalog) =>
      currentCatalog.map((entry) => {
        if (entry.code !== sourceCode) {
          return entry;
        }

        return {
          ...entry,
          candidates: entry.candidates.map((candidate) =>
            candidate.toCode === targetCode
              ? {
                  ...candidate,
                  weight: nextValue,
                }
              : candidate,
          ),
        };
      }),
    );
    setSimulationResults((currentResults) => {
      const nextResults = { ...currentResults };
      delete nextResults[sourceCode];
      return nextResults;
    });
    setImportErrors([]);
    setStatusMessage(null);
  };

  const handleResetRow = (sourceCode: EvolutionAdminCatalogEntry["code"]) => {
    setCatalog((currentCatalog) =>
      currentCatalog.map((entry) =>
        entry.code === sourceCode ? cloneCatalogEntry(getBaselineEntry(sourceCode)) : entry,
      ),
    );
    setSimulationResults((currentResults) => {
      const nextResults = { ...currentResults };
      delete nextResults[sourceCode];
      return nextResults;
    });
    setImportErrors([]);
    setStatusMessage(`Reset ${sourceCode} to baseline.`);
  };

  const handleResetAll = () => {
    setCatalog(getEvolutionAdminCatalog());
    setSimulationResults({});
    setImportErrors([]);
    setStatusMessage("Reset all evolution weights to baseline.");
  };

  const handleRunSimulation = (entry: EvolutionAdminCatalogEntry) => {
    if (!isEntryValid(entry) || entry.candidates.length === 0) {
      return;
    }

    setSimulationResults((currentResults) => ({
      ...currentResults,
      [entry.code]: simulateEvolutionAdminRolls({
        entry,
        rollCount: SIMULATION_ROLL_COUNT,
      }),
    }));
    setStatusMessage(`Ran ${SIMULATION_ROLL_COUNT.toLocaleString()} rolls for ${entry.code}.`);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText) as unknown;
      const validation = validateEvolutionAdminExport(parsed, BASE_CATALOG);

      if (!validation.ok) {
        setImportErrors(validation.errors);
        setStatusMessage("Import failed. Check validation errors.");
        return;
      }

      setCatalog(
        applyEvolutionAdminExport({
          baseCatalog: BASE_CATALOG,
          exportData: validation.data,
        }),
      );
      setSimulationResults({});
      setImportErrors([]);
      setStatusMessage(`Imported overrides from ${file.name}.`);
    } catch (error) {
      setImportErrors([
        error instanceof Error ? error.message : "Failed to read the selected file.",
      ]);
      setStatusMessage("Import failed. Check validation errors.");
    } finally {
      event.target.value = "";
    }
  };

  const handleCopyJson = async () => {
    if (!canExport) {
      return;
    }

    try {
      await navigator.clipboard.writeText(exportJson);
      setStatusMessage("Copied override JSON to clipboard.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? `Copy failed: ${error.message}`
          : "Copy failed.",
      );
    }
  };

  const handleDownloadJson = () => {
    if (!canExport) {
      return;
    }

    const blob = new Blob([exportJson], {
      type: "application/json;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = objectUrl;
    anchor.download = "evolution-overrides.v1.json";
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    setStatusMessage("Downloaded override JSON.");
  };

  return (
    <div className="evolution-admin-page">
      <header className="evolution-admin-page__header">
        <div>
          <p className="evolution-admin-page__eyebrow">PC DEV TOOL</p>
          <h1>MonTTo Evolution Probability Admin</h1>
          <p className="evolution-admin-page__description">
            Tune next-stage evolution weights, preview weighted probabilities, and export source-friendly override JSON for the current catalog.
          </p>
        </div>

        <div className="evolution-admin-page__summary-grid">
          <div className="evolution-admin-summary-card">
            <span className="evolution-admin-summary-card__label">Catalog</span>
            <strong>{summary.totalEntries}</strong>
            <span>{summary.editableEntries} editable</span>
          </div>
          <div className="evolution-admin-summary-card">
            <span className="evolution-admin-summary-card__label">Invalid</span>
            <strong>{summary.invalidEditableEntries}</strong>
            <span>invalid weights</span>
          </div>
          <div className="evolution-admin-summary-card">
            <span className="evolution-admin-summary-card__label">Changed</span>
            <strong>{summary.changedEntries}</strong>
            <span>rows differ from baseline</span>
          </div>
        </div>
      </header>

      <section className="evolution-admin-toolbar">
        <div className="evolution-admin-toolbar__buttons">
          <button type="button" onClick={handleImportClick}>
            Import JSON
          </button>
          <button type="button" onClick={handleCopyJson} disabled={!canExport}>
            Copy JSON
          </button>
          <button type="button" onClick={handleDownloadJson} disabled={!canExport}>
            Download JSON
          </button>
          <button type="button" onClick={handleResetAll}>
            Reset All
          </button>
        </div>
        <div className="evolution-admin-toolbar__meta">
          <span>Schema v1</span>
          <span>{Object.keys(exportData.overrides).length} override rows</span>
          {!canExport && (
            <span className="evolution-admin-toolbar__error">
              Export blocked until every weight is a whole number from 0 to 100.
            </span>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="evolution-admin-page__file-input"
          onChange={handleImportFile}
        />
      </section>

      {statusMessage && (
        <section className="evolution-admin-status evolution-admin-status--info">
          {statusMessage}
        </section>
      )}

      {importErrors.length > 0 && (
        <section className="evolution-admin-status evolution-admin-status--error">
          <strong>Import validation errors</strong>
          <ul>
            {importErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </section>
      )}

      <main className="evolution-admin-page__content">
        <section className="evolution-admin-page__catalog">
          {entriesByPhase.map(([phase, entries]) => (
            <section key={phase} className="evolution-admin-phase-group">
              <div className="evolution-admin-phase-group__header">
                <h2>{formatPhaseLabel(phase)}</h2>
                <span>{entries.length} rows</span>
              </div>

              <div className="evolution-admin-phase-group__grid">
                {entries.map((entry) => {
                  const totalWeight = getEntryTotalWeight(entry);
                  const entryValid = isEntryValid(entry);
                  const changed = isEntryChanged(entry);
                  const isTerminal = entry.candidates.length === 0;
                  const simulation = simulationResults[entry.code] ?? [];
                  const frameState = frameStates[entry.code];
                  const preview = getRepresentativeFrame(frameState);

                  return (
                    <article
                      key={entry.code}
                      className={[
                        "evolution-admin-card",
                        changed ? "evolution-admin-card--changed" : "",
                        !entryValid ? "evolution-admin-card--invalid" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <header className="evolution-admin-card__header">
                        <div>
                          <p className="evolution-admin-card__eyebrow">
                            {entry.geneLine} · {entry.classCode}
                          </p>
                          <h3>{entry.displayName}</h3>
                          <p>{entry.code}</p>
                        </div>

                        <div className="evolution-admin-card__badges">
                          <span>{changed ? "Changed" : "Baseline"}</span>
                          <span>{isTerminal ? "Terminal" : `Total ${totalWeight}`}</span>
                        </div>
                      </header>

                      <section className="evolution-admin-card__monster-preview">
                        <div className="evolution-admin-card__monster-preview-meta">
                          <strong>Frame</strong>
                          {frameState?.status === "ready" ? (
                            <span>
                              {frameState.data.meta.size.w}x{frameState.data.meta.size.h}
                            </span>
                          ) : null}
                        </div>

                        {!frameState || frameState.status === "loading" ? (
                          <div className="evolution-admin-card__monster-preview-placeholder">
                            Loading frame...
                          </div>
                        ) : null}

                        {frameState?.status === "error" ? (
                          <div className="evolution-admin-card__monster-preview-placeholder evolution-admin-card__monster-preview-placeholder--error">
                            Failed to load frame: {frameState.message}
                          </div>
                        ) : null}

                        {frameState?.status === "ready" ? (
                          preview ? (
                            <FrameViewport
                              imagePath={preview.imagePath}
                              sheetWidth={preview.sheetWidth}
                              sheetHeight={preview.sheetHeight}
                              frame={preview.frame}
                            />
                          ) : (
                            <div className="evolution-admin-card__monster-preview-placeholder">
                              Missing representative frame
                            </div>
                          )
                        ) : null}
                      </section>

                      {isTerminal ? (
                        <div className="evolution-admin-card__empty">
                          No further evolution candidates.
                        </div>
                      ) : (
                        <>
                          <div className="evolution-admin-candidate-table">
                            <div className="evolution-admin-candidate-table__head">
                              <span>Target</span>
                              <span>Kind</span>
                              <span>Weight</span>
                              <span>Expected</span>
                            </div>

                            {entry.candidates.map((candidate) => (
                              (() => {
                                const targetFrameState = frameStates[candidate.toCode];
                                const targetPreview =
                                  getRepresentativeFrame(targetFrameState);

                                return (
                                  <div
                                    key={`${entry.code}-${candidate.toCode}`}
                                    className="evolution-admin-candidate-table__row"
                                  >
                                    <div className="evolution-admin-candidate-table__target">
                                      <div className="evolution-admin-candidate-table__target-preview">
                                        {targetPreview ? (
                                          <FrameViewport
                                            imagePath={targetPreview.imagePath}
                                            sheetWidth={targetPreview.sheetWidth}
                                            sheetHeight={targetPreview.sheetHeight}
                                            frame={targetPreview.frame}
                                            scale={TARGET_PREVIEW_FRAME_SCALE}
                                          />
                                        ) : (
                                          <div className="evolution-admin-candidate-table__target-preview-placeholder">
                                            {targetFrameState?.status === "error"
                                              ? "Err"
                                              : "…"}
                                          </div>
                                        )}
                                      </div>
                                      <div>
                                        <strong>{candidate.toDisplayName}</strong>
                                        <span>{candidate.toCode}</span>
                                      </div>
                                    </div>
                                    <span>{formatKindLabel(candidate.kind)}</span>
                                    <label>
                                      <span className="sr-only">
                                        {entry.code} to {candidate.toCode} weight
                                      </span>
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={candidate.weight}
                                        onChange={(event) =>
                                          handleWeightChange(
                                            entry.code,
                                            candidate.toCode,
                                            event.target.value,
                                          )
                                        }
                                      />
                                    </label>
                                    <span>
                                      {formatPercent(
                                        getExpectedPercent(candidate.weight, totalWeight),
                                      )}
                                    </span>
                                  </div>
                                );
                              })()
                            ))}
                          </div>

                          <div className="evolution-admin-card__footer">
                            <div>
                              <strong>Total: {totalWeight}</strong>
                              {!entryValid && (
                                <p className="evolution-admin-card__error">
                                  Weights must be whole numbers from 0 to 100.
                                </p>
                              )}
                            </div>

                            <div className="evolution-admin-card__actions">
                              <button
                                type="button"
                                onClick={() => handleRunSimulation(entry)}
                                disabled={!entryValid}
                              >
                                Run {SIMULATION_ROLL_COUNT.toLocaleString()} Rolls
                              </button>
                              <button
                                type="button"
                                className="evolution-admin-card__ghost-button"
                                onClick={() => handleResetRow(entry.code)}
                              >
                                Reset Row
                              </button>
                            </div>
                          </div>

                          {simulation.length > 0 && (
                            <div className="evolution-admin-simulation">
                              <div className="evolution-admin-simulation__head">
                                <span>Simulation</span>
                                <span>{SIMULATION_ROLL_COUNT.toLocaleString()} rolls</span>
                              </div>

                              <div className="evolution-admin-simulation__table">
                                <div className="evolution-admin-simulation__table-head">
                                  <span>Target</span>
                                  <span>Expected</span>
                                  <span>Count</span>
                                  <span>Simulated</span>
                                </div>

                                {simulation.map((result) => {
                                  const candidate = entry.candidates.find(
                                    ({ toCode }) => toCode === result.toCode,
                                  );

                                  return (
                                    <div
                                      key={`${entry.code}-${result.toCode}-simulation`}
                                      className="evolution-admin-simulation__table-row"
                                    >
                                      <span>{candidate?.toDisplayName ?? result.toCode}</span>
                                      <span>
                                        {formatPercent(
                                          getExpectedPercent(
                                            candidate?.weight ?? 0,
                                            totalWeight,
                                          ),
                                        )}
                                      </span>
                                      <span>{result.count.toLocaleString()}</span>
                                      <span>{formatPercent(result.percent)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </section>

        <aside className="evolution-admin-export-panel">
          <div className="evolution-admin-export-panel__header">
            <div>
              <h2>Export Preview</h2>
              <p>Only changed rows are included.</p>
            </div>
            <span>schemaVersion: 1</span>
          </div>
          <pre>{exportJson}</pre>
        </aside>
      </main>
    </div>
  );
}

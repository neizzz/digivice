import { r as reactExports, j as jsxRuntimeExports, R as ReactDOM, T as TopLeftBuildLogoText } from "./index2.js";
import { g as getEvolutionAdminCatalog, b as buildEvolutionAdminExport, s as simulateEvolutionAdminRolls, v as validateEvolutionAdminExport, a as applyEvolutionAdminExport } from "./evolutionAdmin.js";
const BASE_CATALOG = getEvolutionAdminCatalog();
const BASE_CATALOG_BY_CODE = new Map(
  BASE_CATALOG.map((entry) => [entry.code, entry])
);
const SIMULATION_ROLL_COUNT = 1e4;
const CARD_PREVIEW_FRAME_SCALE = 3;
const TARGET_PREVIEW_FRAME_SCALE = 2;
function cloneCatalogEntry(entry) {
  return {
    ...entry,
    candidates: entry.candidates.map((candidate) => ({ ...candidate }))
  };
}
function getBaselineEntry(code) {
  const entry = BASE_CATALOG_BY_CODE.get(code);
  if (!entry) {
    throw new Error(`[EvolutionAdminPage] Missing baseline entry for ${code}`);
  }
  return entry;
}
function getEntryTotalWeight(entry) {
  return entry.candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
}
function isEntryChanged(entry) {
  const baselineEntry = getBaselineEntry(entry.code);
  if (entry.candidates.length !== baselineEntry.candidates.length) {
    return true;
  }
  return entry.candidates.some((candidate, index) => {
    const baselineCandidate = baselineEntry.candidates[index];
    return !baselineCandidate || candidate.toCode !== baselineCandidate.toCode || candidate.kind !== baselineCandidate.kind || candidate.weight !== baselineCandidate.weight;
  });
}
function isEntryValid(entry) {
  return entry.candidates.every(
    (candidate) => Number.isInteger(candidate.weight) && candidate.weight >= 0 && candidate.weight <= 100
  );
}
function formatKindLabel(kind) {
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
function formatPhaseLabel(phase) {
  return `Phase ${phase}`;
}
function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}
function getExpectedPercent(weight, totalWeight) {
  return totalWeight > 0 ? weight / totalWeight * 100 : 0;
}
function getRepresentativeFrame(state) {
  var _a, _b, _c;
  if (!state || state.status !== "ready") {
    return null;
  }
  const preferredFrameNames = [
    (_a = state.data.animations.idle) == null ? void 0 : _a[0],
    "in-basket",
    (_b = state.data.animations.walking) == null ? void 0 : _b[0],
    Object.keys(state.data.frames)[0]
  ].filter((frameName) => Boolean(frameName));
  for (const frameName of preferredFrameNames) {
    const frame = (_c = state.data.frames[frameName]) == null ? void 0 : _c.frame;
    if (!frame) {
      continue;
    }
    return {
      imagePath: `/assets/game/sprites/monsters/${state.data.meta.image}`,
      sheetWidth: state.data.meta.size.w,
      sheetHeight: state.data.meta.size.h,
      frame
    };
  }
  return null;
}
function FrameViewport({
  imagePath,
  sheetWidth,
  sheetHeight,
  frame,
  scale = CARD_PREVIEW_FRAME_SCALE
}) {
  const viewportStyle = {
    width: `${frame.w * scale}px`,
    height: `${frame.h * scale}px`,
    backgroundImage: `url(${imagePath})`,
    backgroundPosition: `${-frame.x * scale}px ${-frame.y * scale}px`,
    backgroundSize: `${sheetWidth * scale}px ${sheetHeight * scale}px`
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "evolution-admin-frame-preview__viewport", style: viewportStyle });
}
function EvolutionAdminPage() {
  const [catalog, setCatalog] = reactExports.useState(
    () => getEvolutionAdminCatalog()
  );
  const [importErrors, setImportErrors] = reactExports.useState([]);
  const [statusMessage, setStatusMessage] = reactExports.useState(null);
  const [simulationResults, setSimulationResults] = reactExports.useState({});
  const [frameStates, setFrameStates] = reactExports.useState(
    () => Object.fromEntries(BASE_CATALOG.map((entry) => [entry.code, { status: "loading" }]))
  );
  const fileInputRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    document.title = "MonTTo Evolution Admin";
  }, []);
  reactExports.useEffect(() => {
    let cancelled = false;
    async function loadMonsterFrames() {
      const results = await Promise.all(
        BASE_CATALOG.map(async (entry) => {
          try {
            const response = await fetch(
              `/assets/game/sprites/monsters/${entry.spritesheetName}.json`
            );
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            return [
              entry.code,
              {
                status: "ready",
                data
              }
            ];
          } catch (error) {
            return [
              entry.code,
              {
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error"
              }
            ];
          }
        })
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
  const summary = reactExports.useMemo(() => {
    const editableEntries = catalog.filter((entry) => entry.candidates.length > 0);
    const invalidEditableEntries = editableEntries.filter(
      (entry) => !isEntryValid(entry)
    );
    const changedEntries = editableEntries.filter((entry) => isEntryChanged(entry));
    return {
      totalEntries: catalog.length,
      editableEntries: editableEntries.length,
      invalidEditableEntries: invalidEditableEntries.length,
      changedEntries: changedEntries.length
    };
  }, [catalog]);
  const exportData = reactExports.useMemo(
    () => buildEvolutionAdminExport({
      baseCatalog: BASE_CATALOG,
      currentCatalog: catalog
    }),
    [catalog]
  );
  const canExport = summary.invalidEditableEntries === 0;
  const exportJson = reactExports.useMemo(
    () => canExport ? JSON.stringify(exportData, null, 2) : "// Fix invalid weights before exporting JSON.",
    [canExport, exportData]
  );
  const entriesByPhase = reactExports.useMemo(() => {
    const phaseMap = /* @__PURE__ */ new Map();
    for (const entry of catalog) {
      const existingEntries = phaseMap.get(entry.phase) ?? [];
      existingEntries.push(entry);
      phaseMap.set(entry.phase, existingEntries);
    }
    return Array.from(phaseMap.entries()).sort(([left], [right]) => left - right);
  }, [catalog]);
  const handleWeightChange = (sourceCode, targetCode, rawValue) => {
    const parsedValue = rawValue.trim() === "" ? 0 : Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsedValue)) {
      return;
    }
    const nextValue = Math.min(100, Math.max(0, parsedValue));
    setCatalog(
      (currentCatalog) => currentCatalog.map((entry) => {
        if (entry.code !== sourceCode) {
          return entry;
        }
        return {
          ...entry,
          candidates: entry.candidates.map(
            (candidate) => candidate.toCode === targetCode ? {
              ...candidate,
              weight: nextValue
            } : candidate
          )
        };
      })
    );
    setSimulationResults((currentResults) => {
      const nextResults = { ...currentResults };
      delete nextResults[sourceCode];
      return nextResults;
    });
    setImportErrors([]);
    setStatusMessage(null);
  };
  const handleResetRow = (sourceCode) => {
    setCatalog(
      (currentCatalog) => currentCatalog.map(
        (entry) => entry.code === sourceCode ? cloneCatalogEntry(getBaselineEntry(sourceCode)) : entry
      )
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
  const handleRunSimulation = (entry) => {
    if (!isEntryValid(entry) || entry.candidates.length === 0) {
      return;
    }
    setSimulationResults((currentResults) => ({
      ...currentResults,
      [entry.code]: simulateEvolutionAdminRolls({
        entry,
        rollCount: SIMULATION_ROLL_COUNT
      })
    }));
    setStatusMessage(`Ran ${SIMULATION_ROLL_COUNT.toLocaleString()} rolls for ${entry.code}.`);
  };
  const handleImportClick = () => {
    var _a;
    (_a = fileInputRef.current) == null ? void 0 : _a.click();
  };
  const handleImportFile = async (event) => {
    var _a;
    const file = (_a = event.target.files) == null ? void 0 : _a[0];
    if (!file) {
      return;
    }
    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText);
      const validation = validateEvolutionAdminExport(parsed, BASE_CATALOG);
      if (!validation.ok) {
        setImportErrors(validation.errors);
        setStatusMessage("Import failed. Check validation errors.");
        return;
      }
      setCatalog(
        applyEvolutionAdminExport({
          baseCatalog: BASE_CATALOG,
          exportData: validation.data
        })
      );
      setSimulationResults({});
      setImportErrors([]);
      setStatusMessage(`Imported overrides from ${file.name}.`);
    } catch (error) {
      setImportErrors([
        error instanceof Error ? error.message : "Failed to read the selected file."
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
        error instanceof Error ? `Copy failed: ${error.message}` : "Copy failed."
      );
    }
  };
  const handleDownloadJson = () => {
    if (!canExport) {
      return;
    }
    const blob = new Blob([exportJson], {
      type: "application/json;charset=utf-8"
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "evolution-overrides.v1.json";
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    setStatusMessage("Downloaded override JSON.");
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-page", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "evolution-admin-page__header", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "evolution-admin-page__eyebrow", children: "PC DEV TOOL" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "MonTTo Evolution Probability Admin" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "evolution-admin-page__description", children: "Tune next-stage evolution weights, preview weighted probabilities, and export source-friendly override JSON for the current catalog." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-page__summary-grid", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-summary-card", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "evolution-admin-summary-card__label", children: "Catalog" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: summary.totalEntries }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
            summary.editableEntries,
            " editable"
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-summary-card", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "evolution-admin-summary-card__label", children: "Invalid" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: summary.invalidEditableEntries }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "invalid weights" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-summary-card", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "evolution-admin-summary-card__label", children: "Changed" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: summary.changedEntries }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "rows differ from baseline" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "evolution-admin-toolbar", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-toolbar__buttons", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: handleImportClick, children: "Import JSON" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: handleCopyJson, disabled: !canExport, children: "Copy JSON" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: handleDownloadJson, disabled: !canExport, children: "Download JSON" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: handleResetAll, children: "Reset All" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-toolbar__meta", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Schema v1" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
          Object.keys(exportData.overrides).length,
          " override rows"
        ] }),
        !canExport && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "evolution-admin-toolbar__error", children: "Export blocked until every weight is a whole number from 0 to 100." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          ref: fileInputRef,
          type: "file",
          accept: "application/json",
          className: "evolution-admin-page__file-input",
          onChange: handleImportFile
        }
      )
    ] }),
    statusMessage && /* @__PURE__ */ jsxRuntimeExports.jsx("section", { className: "evolution-admin-status evolution-admin-status--info", children: statusMessage }),
    importErrors.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "evolution-admin-status evolution-admin-status--error", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Import validation errors" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { children: importErrors.map((error) => /* @__PURE__ */ jsxRuntimeExports.jsx("li", { children: error }, error)) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("main", { className: "evolution-admin-page__content", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("section", { className: "evolution-admin-page__catalog", children: entriesByPhase.map(([phase, entries]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "evolution-admin-phase-group", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-phase-group__header", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: formatPhaseLabel(phase) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
            entries.length,
            " rows"
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "evolution-admin-phase-group__grid", children: entries.map((entry) => {
          const totalWeight = getEntryTotalWeight(entry);
          const entryValid = isEntryValid(entry);
          const changed = isEntryChanged(entry);
          const isTerminal = entry.candidates.length === 0;
          const simulation = simulationResults[entry.code] ?? [];
          const frameState = frameStates[entry.code];
          const preview = getRepresentativeFrame(frameState);
          return /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "article",
            {
              className: [
                "evolution-admin-card",
                changed ? "evolution-admin-card--changed" : "",
                !entryValid ? "evolution-admin-card--invalid" : ""
              ].filter(Boolean).join(" "),
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "evolution-admin-card__header", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "evolution-admin-card__eyebrow", children: [
                      entry.geneLine,
                      " · ",
                      entry.classCode
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: entry.displayName }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: entry.code })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-card__badges", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: changed ? "Changed" : "Baseline" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: isTerminal ? "Terminal" : `Total ${totalWeight}` })
                  ] })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "evolution-admin-card__monster-preview", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-card__monster-preview-meta", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Frame" }),
                    (frameState == null ? void 0 : frameState.status) === "ready" ? /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                      frameState.data.meta.size.w,
                      "x",
                      frameState.data.meta.size.h
                    ] }) : null
                  ] }),
                  !frameState || frameState.status === "loading" ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "evolution-admin-card__monster-preview-placeholder", children: "Loading frame..." }) : null,
                  (frameState == null ? void 0 : frameState.status) === "error" ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-card__monster-preview-placeholder evolution-admin-card__monster-preview-placeholder--error", children: [
                    "Failed to load frame: ",
                    frameState.message
                  ] }) : null,
                  (frameState == null ? void 0 : frameState.status) === "ready" ? preview ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                    FrameViewport,
                    {
                      imagePath: preview.imagePath,
                      sheetWidth: preview.sheetWidth,
                      sheetHeight: preview.sheetHeight,
                      frame: preview.frame
                    }
                  ) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "evolution-admin-card__monster-preview-placeholder", children: "Missing representative frame" }) : null
                ] }),
                isTerminal ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "evolution-admin-card__empty", children: "No further evolution candidates." }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-candidate-table", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-candidate-table__head", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Target" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Kind" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Weight" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Expected" })
                    ] }),
                    entry.candidates.map((candidate) => (() => {
                      const targetFrameState = frameStates[candidate.toCode];
                      const targetPreview = getRepresentativeFrame(targetFrameState);
                      return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                        "div",
                        {
                          className: "evolution-admin-candidate-table__row",
                          children: [
                            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-candidate-table__target", children: [
                              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "evolution-admin-candidate-table__target-preview", children: targetPreview ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                                FrameViewport,
                                {
                                  imagePath: targetPreview.imagePath,
                                  sheetWidth: targetPreview.sheetWidth,
                                  sheetHeight: targetPreview.sheetHeight,
                                  frame: targetPreview.frame,
                                  scale: TARGET_PREVIEW_FRAME_SCALE
                                }
                              ) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "evolution-admin-candidate-table__target-preview-placeholder", children: (targetFrameState == null ? void 0 : targetFrameState.status) === "error" ? "Err" : "…" }) }),
                              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                                /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: candidate.toDisplayName }),
                                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: candidate.toCode })
                              ] })
                            ] }),
                            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: formatKindLabel(candidate.kind) }),
                            /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
                              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "sr-only", children: [
                                entry.code,
                                " to ",
                                candidate.toCode,
                                " weight"
                              ] }),
                              /* @__PURE__ */ jsxRuntimeExports.jsx(
                                "input",
                                {
                                  type: "number",
                                  min: 0,
                                  max: 100,
                                  step: 1,
                                  value: candidate.weight,
                                  onChange: (event) => handleWeightChange(
                                    entry.code,
                                    candidate.toCode,
                                    event.target.value
                                  )
                                }
                              )
                            ] }),
                            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: formatPercent(
                              getExpectedPercent(candidate.weight, totalWeight)
                            ) })
                          ]
                        },
                        `${entry.code}-${candidate.toCode}`
                      );
                    })())
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-card__footer", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("strong", { children: [
                        "Total: ",
                        totalWeight
                      ] }),
                      !entryValid && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "evolution-admin-card__error", children: "Weights must be whole numbers from 0 to 100." })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-card__actions", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs(
                        "button",
                        {
                          type: "button",
                          onClick: () => handleRunSimulation(entry),
                          disabled: !entryValid,
                          children: [
                            "Run ",
                            SIMULATION_ROLL_COUNT.toLocaleString(),
                            " Rolls"
                          ]
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          type: "button",
                          className: "evolution-admin-card__ghost-button",
                          onClick: () => handleResetRow(entry.code),
                          children: "Reset Row"
                        }
                      )
                    ] })
                  ] }),
                  simulation.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-simulation", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-simulation__head", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Simulation" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                        SIMULATION_ROLL_COUNT.toLocaleString(),
                        " rolls"
                      ] })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-simulation__table", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-simulation__table-head", children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Target" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Expected" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Count" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Simulated" })
                      ] }),
                      simulation.map((result) => {
                        const candidate = entry.candidates.find(
                          ({ toCode }) => toCode === result.toCode
                        );
                        return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                          "div",
                          {
                            className: "evolution-admin-simulation__table-row",
                            children: [
                              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: (candidate == null ? void 0 : candidate.toDisplayName) ?? result.toCode }),
                              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: formatPercent(
                                getExpectedPercent(
                                  (candidate == null ? void 0 : candidate.weight) ?? 0,
                                  totalWeight
                                )
                              ) }),
                              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: result.count.toLocaleString() }),
                              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: formatPercent(result.percent) })
                            ]
                          },
                          `${entry.code}-${result.toCode}-simulation`
                        );
                      })
                    ] })
                  ] })
                ] })
              ]
            },
            entry.code
          );
        }) })
      ] }, phase)) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("aside", { className: "evolution-admin-export-panel", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "evolution-admin-export-panel__header", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Export Preview" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Only changed rows are included." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "schemaVersion: 1" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("pre", { children: exportJson })
      ] })
    ] })
  ] });
}
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}
ReactDOM.createRoot(rootElement).render(
  /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(TopLeftBuildLogoText, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(EvolutionAdminPage, {})
  ] })
);
//# sourceMappingURL=evolution-admin.js.map

import { r as reactExports, j as jsxDevRuntimeExports, R as ReactDOM, T as TopLeftBuildLogoText } from "./index2.js";
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
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-frame-preview__viewport", style: viewportStyle }, void 0, false, {
    fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
    lineNumber: 195,
    columnNumber: 10
  }, this);
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
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-page", children: [
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("header", { className: "evolution-admin-page__header", children: [
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { children: [
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { className: "evolution-admin-page__eyebrow", children: "PC DEV TOOL" }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
          lineNumber: 467,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("h1", { children: "MonTTo Evolution Probability Admin" }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
          lineNumber: 468,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { className: "evolution-admin-page__description", children: "Tune next-stage evolution weights, preview weighted probabilities, and export source-friendly override JSON for the current catalog." }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
          lineNumber: 469,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
        lineNumber: 466,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-page__summary-grid", children: [
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-summary-card", children: [
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { className: "evolution-admin-summary-card__label", children: "Catalog" }, void 0, false, {
            fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
            lineNumber: 476,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("strong", { children: summary.totalEntries }, void 0, false, {
            fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
            lineNumber: 477,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: [
            summary.editableEntries,
            " editable"
          ] }, void 0, true, {
            fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
            lineNumber: 478,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
          lineNumber: 475,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-summary-card", children: [
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { className: "evolution-admin-summary-card__label", children: "Invalid" }, void 0, false, {
            fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
            lineNumber: 481,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("strong", { children: summary.invalidEditableEntries }, void 0, false, {
            fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
            lineNumber: 482,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: "invalid weights" }, void 0, false, {
            fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
            lineNumber: 483,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
          lineNumber: 480,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-summary-card", children: [
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { className: "evolution-admin-summary-card__label", children: "Changed" }, void 0, false, {
            fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
            lineNumber: 486,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("strong", { children: summary.changedEntries }, void 0, false, {
            fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
            lineNumber: 487,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: "rows differ from baseline" }, void 0, false, {
            fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
            lineNumber: 488,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
          lineNumber: 485,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
        lineNumber: 474,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
      lineNumber: 465,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("section", { className: "evolution-admin-toolbar", children: [
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-toolbar__buttons", children: [
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("button", { type: "button", onClick: handleImportClick, children: "Import JSON" }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
          lineNumber: 495,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("button", { type: "button", onClick: handleCopyJson, disabled: !canExport, children: "Copy JSON" }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
          lineNumber: 498,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("button", { type: "button", onClick: handleDownloadJson, disabled: !canExport, children: "Download JSON" }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
          lineNumber: 501,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("button", { type: "button", onClick: handleResetAll, children: "Reset All" }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
          lineNumber: 504,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
        lineNumber: 494,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-toolbar__meta", children: [
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: "Schema v1" }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
          lineNumber: 509,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: [
          Object.keys(exportData.overrides).length,
          " override rows"
        ] }, void 0, true, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
          lineNumber: 510,
          columnNumber: 11
        }, this),
        !canExport && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { className: "evolution-admin-toolbar__error", children: "Export blocked until every weight is a whole number from 0 to 100." }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
          lineNumber: 512,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
        lineNumber: 508,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
        "input",
        {
          ref: fileInputRef,
          type: "file",
          accept: "application/json",
          className: "evolution-admin-page__file-input",
          onChange: handleImportFile
        },
        void 0,
        false,
        {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
          lineNumber: 517,
          columnNumber: 9
        },
        this
      )
    ] }, void 0, true, {
      fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
      lineNumber: 493,
      columnNumber: 7
    }, this),
    statusMessage && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("section", { className: "evolution-admin-status evolution-admin-status--info", children: statusMessage }, void 0, false, {
      fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
      lineNumber: 527,
      columnNumber: 9
    }, this),
    importErrors.length > 0 && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("section", { className: "evolution-admin-status evolution-admin-status--error", children: [
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("strong", { children: "Import validation errors" }, void 0, false, {
        fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
        lineNumber: 534,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("ul", { children: importErrors.map((error) => /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("li", { children: error }, error, false, {
        fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
        lineNumber: 537,
        columnNumber: 15
      }, this)) }, void 0, false, {
        fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
        lineNumber: 535,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
      lineNumber: 533,
      columnNumber: 9
    }, this),
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("main", { className: "evolution-admin-page__content", children: [
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("section", { className: "evolution-admin-page__catalog", children: entriesByPhase.map(([phase, entries]) => /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("section", { className: "evolution-admin-phase-group", children: [
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-phase-group__header", children: [
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("h2", { children: formatPhaseLabel(phase) }, void 0, false, {
            fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
            lineNumber: 548,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: [
            entries.length,
            " rows"
          ] }, void 0, true, {
            fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
            lineNumber: 549,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
          lineNumber: 547,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-phase-group__grid", children: entries.map((entry) => {
          const totalWeight = getEntryTotalWeight(entry);
          const entryValid = isEntryValid(entry);
          const changed = isEntryChanged(entry);
          const isTerminal = entry.candidates.length === 0;
          const simulation = simulationResults[entry.code] ?? [];
          const frameState = frameStates[entry.code];
          const preview = getRepresentativeFrame(frameState);
          return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
            "article",
            {
              className: [
                "evolution-admin-card",
                changed ? "evolution-admin-card--changed" : "",
                !entryValid ? "evolution-admin-card--invalid" : ""
              ].filter(Boolean).join(" "),
              children: [
                /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("header", { className: "evolution-admin-card__header", children: [
                  /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { children: [
                    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { className: "evolution-admin-card__eyebrow", children: [
                      entry.geneLine,
                      " · ",
                      entry.classCode
                    ] }, void 0, true, {
                      fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                      lineNumber: 575,
                      columnNumber: 27
                    }, this),
                    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("h3", { children: entry.displayName }, void 0, false, {
                      fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                      lineNumber: 578,
                      columnNumber: 27
                    }, this),
                    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { children: entry.code }, void 0, false, {
                      fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                      lineNumber: 579,
                      columnNumber: 27
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                    lineNumber: 574,
                    columnNumber: 25
                  }, this),
                  /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-card__badges", children: [
                    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: changed ? "Changed" : "Baseline" }, void 0, false, {
                      fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                      lineNumber: 583,
                      columnNumber: 27
                    }, this),
                    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: isTerminal ? "Terminal" : `Total ${totalWeight}` }, void 0, false, {
                      fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                      lineNumber: 584,
                      columnNumber: 27
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                    lineNumber: 582,
                    columnNumber: 25
                  }, this)
                ] }, void 0, true, {
                  fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                  lineNumber: 573,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("section", { className: "evolution-admin-card__monster-preview", children: [
                  /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-card__monster-preview-meta", children: [
                    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("strong", { children: "Frame" }, void 0, false, {
                      fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                      lineNumber: 590,
                      columnNumber: 27
                    }, this),
                    (frameState == null ? void 0 : frameState.status) === "ready" ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: [
                      frameState.data.meta.size.w,
                      "x",
                      frameState.data.meta.size.h
                    ] }, void 0, true, {
                      fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                      lineNumber: 592,
                      columnNumber: 29
                    }, this) : null
                  ] }, void 0, true, {
                    fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                    lineNumber: 589,
                    columnNumber: 25
                  }, this),
                  !frameState || frameState.status === "loading" ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-card__monster-preview-placeholder", children: "Loading frame..." }, void 0, false, {
                    fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                    lineNumber: 599,
                    columnNumber: 27
                  }, this) : null,
                  (frameState == null ? void 0 : frameState.status) === "error" ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-card__monster-preview-placeholder evolution-admin-card__monster-preview-placeholder--error", children: [
                    "Failed to load frame: ",
                    frameState.message
                  ] }, void 0, true, {
                    fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                    lineNumber: 605,
                    columnNumber: 27
                  }, this) : null,
                  (frameState == null ? void 0 : frameState.status) === "ready" ? preview ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                    FrameViewport,
                    {
                      imagePath: preview.imagePath,
                      sheetWidth: preview.sheetWidth,
                      sheetHeight: preview.sheetHeight,
                      frame: preview.frame
                    },
                    void 0,
                    false,
                    {
                      fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                      lineNumber: 612,
                      columnNumber: 29
                    },
                    this
                  ) : /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-card__monster-preview-placeholder", children: "Missing representative frame" }, void 0, false, {
                    fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                    lineNumber: 619,
                    columnNumber: 29
                  }, this) : null
                ] }, void 0, true, {
                  fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                  lineNumber: 588,
                  columnNumber: 23
                }, this),
                isTerminal ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-card__empty", children: "No further evolution candidates." }, void 0, false, {
                  fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                  lineNumber: 627,
                  columnNumber: 25
                }, this) : /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(jsxDevRuntimeExports.Fragment, { children: [
                  /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-candidate-table", children: [
                    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-candidate-table__head", children: [
                      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: "Target" }, void 0, false, {
                        fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                        lineNumber: 634,
                        columnNumber: 31
                      }, this),
                      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: "Kind" }, void 0, false, {
                        fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                        lineNumber: 635,
                        columnNumber: 31
                      }, this),
                      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: "Weight" }, void 0, false, {
                        fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                        lineNumber: 636,
                        columnNumber: 31
                      }, this),
                      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: "Expected" }, void 0, false, {
                        fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                        lineNumber: 637,
                        columnNumber: 31
                      }, this)
                    ] }, void 0, true, {
                      fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                      lineNumber: 633,
                      columnNumber: 29
                    }, this),
                    entry.candidates.map((candidate) => (() => {
                      const targetFrameState = frameStates[candidate.toCode];
                      const targetPreview = getRepresentativeFrame(targetFrameState);
                      return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                        "div",
                        {
                          className: "evolution-admin-candidate-table__row",
                          children: [
                            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-candidate-table__target", children: [
                              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-candidate-table__target-preview", children: targetPreview ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                                FrameViewport,
                                {
                                  imagePath: targetPreview.imagePath,
                                  sheetWidth: targetPreview.sheetWidth,
                                  sheetHeight: targetPreview.sheetHeight,
                                  frame: targetPreview.frame,
                                  scale: TARGET_PREVIEW_FRAME_SCALE
                                },
                                void 0,
                                false,
                                {
                                  fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                                  lineNumber: 654,
                                  columnNumber: 43
                                },
                                this
                              ) : /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-candidate-table__target-preview-placeholder", children: (targetFrameState == null ? void 0 : targetFrameState.status) === "error" ? "Err" : "…" }, void 0, false, {
                                fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                                lineNumber: 662,
                                columnNumber: 43
                              }, this) }, void 0, false, {
                                fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                                lineNumber: 652,
                                columnNumber: 39
                              }, this),
                              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { children: [
                                /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("strong", { children: candidate.toDisplayName }, void 0, false, {
                                  fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                                  lineNumber: 670,
                                  columnNumber: 41
                                }, this),
                                /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: candidate.toCode }, void 0, false, {
                                  fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                                  lineNumber: 671,
                                  columnNumber: 41
                                }, this)
                              ] }, void 0, true, {
                                fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                                lineNumber: 669,
                                columnNumber: 39
                              }, this)
                            ] }, void 0, true, {
                              fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                              lineNumber: 651,
                              columnNumber: 37
                            }, this),
                            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: formatKindLabel(candidate.kind) }, void 0, false, {
                              fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                              lineNumber: 674,
                              columnNumber: 37
                            }, this),
                            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("label", { children: [
                              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { className: "sr-only", children: [
                                entry.code,
                                " to ",
                                candidate.toCode,
                                " weight"
                              ] }, void 0, true, {
                                fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                                lineNumber: 676,
                                columnNumber: 39
                              }, this),
                              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
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
                                },
                                void 0,
                                false,
                                {
                                  fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                                  lineNumber: 679,
                                  columnNumber: 39
                                },
                                this
                              )
                            ] }, void 0, true, {
                              fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                              lineNumber: 675,
                              columnNumber: 37
                            }, this),
                            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: formatPercent(
                              getExpectedPercent(candidate.weight, totalWeight)
                            ) }, void 0, false, {
                              fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                              lineNumber: 694,
                              columnNumber: 37
                            }, this)
                          ]
                        },
                        `${entry.code}-${candidate.toCode}`,
                        true,
                        {
                          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                          lineNumber: 647,
                          columnNumber: 35
                        },
                        this
                      );
                    })())
                  ] }, void 0, true, {
                    fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                    lineNumber: 632,
                    columnNumber: 27
                  }, this),
                  /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-card__footer", children: [
                    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { children: [
                      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("strong", { children: [
                        "Total: ",
                        totalWeight
                      ] }, void 0, true, {
                        fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                        lineNumber: 707,
                        columnNumber: 31
                      }, this),
                      !entryValid && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { className: "evolution-admin-card__error", children: "Weights must be whole numbers from 0 to 100." }, void 0, false, {
                        fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                        lineNumber: 709,
                        columnNumber: 33
                      }, this)
                    ] }, void 0, true, {
                      fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                      lineNumber: 706,
                      columnNumber: 29
                    }, this),
                    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-card__actions", children: [
                      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
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
                        },
                        void 0,
                        true,
                        {
                          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                          lineNumber: 716,
                          columnNumber: 31
                        },
                        this
                      ),
                      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                        "button",
                        {
                          type: "button",
                          className: "evolution-admin-card__ghost-button",
                          onClick: () => handleResetRow(entry.code),
                          children: "Reset Row"
                        },
                        void 0,
                        false,
                        {
                          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                          lineNumber: 723,
                          columnNumber: 31
                        },
                        this
                      )
                    ] }, void 0, true, {
                      fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                      lineNumber: 715,
                      columnNumber: 29
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                    lineNumber: 705,
                    columnNumber: 27
                  }, this),
                  simulation.length > 0 && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-simulation", children: [
                    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-simulation__head", children: [
                      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: "Simulation" }, void 0, false, {
                        fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                        lineNumber: 736,
                        columnNumber: 33
                      }, this),
                      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: [
                        SIMULATION_ROLL_COUNT.toLocaleString(),
                        " rolls"
                      ] }, void 0, true, {
                        fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                        lineNumber: 737,
                        columnNumber: 33
                      }, this)
                    ] }, void 0, true, {
                      fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                      lineNumber: 735,
                      columnNumber: 31
                    }, this),
                    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-simulation__table", children: [
                      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-simulation__table-head", children: [
                        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: "Target" }, void 0, false, {
                          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                          lineNumber: 742,
                          columnNumber: 35
                        }, this),
                        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: "Expected" }, void 0, false, {
                          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                          lineNumber: 743,
                          columnNumber: 35
                        }, this),
                        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: "Count" }, void 0, false, {
                          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                          lineNumber: 744,
                          columnNumber: 35
                        }, this),
                        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: "Simulated" }, void 0, false, {
                          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                          lineNumber: 745,
                          columnNumber: 35
                        }, this)
                      ] }, void 0, true, {
                        fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                        lineNumber: 741,
                        columnNumber: 33
                      }, this),
                      simulation.map((result) => {
                        const candidate = entry.candidates.find(
                          ({ toCode }) => toCode === result.toCode
                        );
                        return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                          "div",
                          {
                            className: "evolution-admin-simulation__table-row",
                            children: [
                              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: (candidate == null ? void 0 : candidate.toDisplayName) ?? result.toCode }, void 0, false, {
                                fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                                lineNumber: 758,
                                columnNumber: 39
                              }, this),
                              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: formatPercent(
                                getExpectedPercent(
                                  (candidate == null ? void 0 : candidate.weight) ?? 0,
                                  totalWeight
                                )
                              ) }, void 0, false, {
                                fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                                lineNumber: 759,
                                columnNumber: 39
                              }, this),
                              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: result.count.toLocaleString() }, void 0, false, {
                                fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                                lineNumber: 767,
                                columnNumber: 39
                              }, this),
                              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: formatPercent(result.percent) }, void 0, false, {
                                fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                                lineNumber: 768,
                                columnNumber: 39
                              }, this)
                            ]
                          },
                          `${entry.code}-${result.toCode}-simulation`,
                          true,
                          {
                            fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                            lineNumber: 754,
                            columnNumber: 37
                          },
                          this
                        );
                      })
                    ] }, void 0, true, {
                      fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                      lineNumber: 740,
                      columnNumber: 31
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                    lineNumber: 734,
                    columnNumber: 29
                  }, this)
                ] }, void 0, true, {
                  fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
                  lineNumber: 631,
                  columnNumber: 25
                }, this)
              ]
            },
            entry.code,
            true,
            {
              fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
              lineNumber: 563,
              columnNumber: 21
            },
            this
          );
        }) }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
          lineNumber: 552,
          columnNumber: 15
        }, this)
      ] }, phase, true, {
        fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
        lineNumber: 546,
        columnNumber: 13
      }, this)) }, void 0, false, {
        fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
        lineNumber: 544,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("aside", { className: "evolution-admin-export-panel", children: [
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "evolution-admin-export-panel__header", children: [
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("h2", { children: "Export Preview" }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
              lineNumber: 788,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { children: "Only changed rows are included." }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
              lineNumber: 789,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
            lineNumber: 787,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: "schemaVersion: 1" }, void 0, false, {
            fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
            lineNumber: 791,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
          lineNumber: 786,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("pre", { children: exportJson }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
          lineNumber: 793,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
        lineNumber: 785,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
      lineNumber: 543,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "/Users/neiz/digivice/apps/client/src/pages/EvolutionAdminPage.tsx",
    lineNumber: 464,
    columnNumber: 5
  }, this);
}
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}
ReactDOM.createRoot(rootElement).render(
  /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(jsxDevRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(TopLeftBuildLogoText, {}, void 0, false, {
      fileName: "/Users/neiz/digivice/apps/client/src/evolution-admin.tsx",
      lineNumber: 14,
      columnNumber: 5
    }, void 0),
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(EvolutionAdminPage, {}, void 0, false, {
      fileName: "/Users/neiz/digivice/apps/client/src/evolution-admin.tsx",
      lineNumber: 15,
      columnNumber: 5
    }, void 0)
  ] }, void 0, true, {
    fileName: "/Users/neiz/digivice/apps/client/src/evolution-admin.tsx",
    lineNumber: 13,
    columnNumber: 3
  }, void 0)
);
//# sourceMappingURL=evolution-admin.js.map

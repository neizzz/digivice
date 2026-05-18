import { r as reactExports, j as jsxDevRuntimeExports, R as ReactDOM, T as TopLeftBuildLogoText } from "./index2.js";
const MONSTER_VARIANTS = {
  "green-slime": {
    A: [1],
    B: [1, 2, 3],
    C: [1, 2, 3, 4],
    D: [1, 2, 3, 4]
  },
  "skull-slime": {
    A: [1],
    B: [1, 2],
    C: [1, 2],
    D: [1, 2]
  },
  "soil-slime": {
    A: [1],
    B: [1, 2],
    C: [1, 2, 3],
    D: [1, 2, 3]
  }
};
function formatMonsterLabel(family, classCode, variant) {
  const baseLabel = family.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  return `${baseLabel} ${classCode}${variant}`;
}
const MONSTER_DEFINITIONS = Object.entries(MONSTER_VARIANTS).flatMap(
  ([family, classMap]) => Object.entries(classMap).flatMap(
    ([classCode, variants]) => variants.map((variant) => {
      const key = `${family}_${classCode}${variant}`;
      return {
        key,
        label: formatMonsterLabel(family, classCode, variant),
        jsonPath: `/assets/game/sprites/monsters/${key}.json`
      };
    })
  )
);
const ANIMATION_ORDER = ["idle", "walking", "sleeping", "eating", "sick"];
const ANIMATION_LABELS = {
  idle: "Idle",
  walking: "Walking",
  sleeping: "Sleeping",
  eating: "Eating",
  sick: "Sick"
};
const STATIC_FRAME_NAMES = ["in-basket"];
const STATIC_FRAME_LABELS = {
  "in-basket": "In Basket"
};
const TICK_INTERVAL_MS = 220;
const ANIMATION_SPEED_OVERRIDES = {
  walking: 140,
  sleeping: 320,
  eating: 200
};
function FrameViewport({
  imagePath,
  sheetWidth,
  sheetHeight,
  frame,
  scale = 3
}) {
  const viewportStyle = {
    width: `${frame.w * scale}px`,
    height: `${frame.h * scale}px`,
    backgroundImage: `url(${imagePath})`,
    backgroundPosition: `${-frame.x * scale}px ${-frame.y * scale}px`,
    backgroundSize: `${sheetWidth * scale}px ${sheetHeight * scale}px`
  };
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "monster-animation-frame", style: viewportStyle }, void 0, false, {
    fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
    lineNumber: 134,
    columnNumber: 10
  }, this);
}
function MonsterAnimationTestPage() {
  const [elapsedMs, setElapsedMs] = reactExports.useState(0);
  const [monsterStates, setMonsterStates] = reactExports.useState(
    () => Object.fromEntries(
      MONSTER_DEFINITIONS.map(({ key }) => [key, { status: "loading" }])
    )
  );
  reactExports.useEffect(() => {
    document.title = "MonTTo Monster Animation Test";
  }, []);
  reactExports.useEffect(() => {
    const startTime = performance.now();
    let animationFrameId = 0;
    const updateElapsedMs = () => {
      setElapsedMs(performance.now() - startTime);
      animationFrameId = window.requestAnimationFrame(updateElapsedMs);
    };
    animationFrameId = window.requestAnimationFrame(updateElapsedMs);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, []);
  reactExports.useEffect(() => {
    let cancelled = false;
    async function loadMonsterSheets() {
      const results = await Promise.all(
        MONSTER_DEFINITIONS.map(async (monster) => {
          try {
            const response = await fetch(monster.jsonPath);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            return [monster.key, { status: "ready", data }];
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            return [monster.key, { status: "error", message }];
          }
        })
      );
      if (cancelled) {
        return;
      }
      setMonsterStates(Object.fromEntries(results));
    }
    void loadMonsterSheets();
    return () => {
      cancelled = true;
    };
  }, []);
  const summary = reactExports.useMemo(() => {
    const readyCount = Object.values(monsterStates).filter(
      (state) => state.status === "ready"
    ).length;
    const errorCount = Object.values(monsterStates).filter(
      (state) => state.status === "error"
    ).length;
    return {
      readyCount,
      errorCount,
      totalCount: MONSTER_DEFINITIONS.length
    };
  }, [monsterStates]);
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "monster-animation-test-page", children: [
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("header", { className: "monster-animation-test-page__header", children: [
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { children: [
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { className: "monster-animation-test-page__eyebrow", children: "PC TEST PAGE" }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
          lineNumber: 216,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("h1", { children: "MonTTo Monster Animation Viewer" }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
          lineNumber: 217,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { className: "monster-animation-test-page__description", children: "This PC test page lets you review the main animation states for every monster spritesheet in one place." }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
          lineNumber: 218,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
        lineNumber: 215,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "monster-animation-test-page__summary", children: [
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: [
          "Loaded ",
          summary.readyCount,
          "/",
          summary.totalCount
        ] }, void 0, true, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
          lineNumber: 223,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: [
          "Errors ",
          summary.errorCount
        ] }, void 0, true, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
          lineNumber: 224,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: [
          "Elapsed ",
          Math.floor(elapsedMs),
          "ms"
        ] }, void 0, true, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
          lineNumber: 225,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
        lineNumber: 222,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
      lineNumber: 214,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("main", { className: "monster-animation-test-page__grid", children: MONSTER_DEFINITIONS.map((monster) => {
      const state = monsterStates[monster.key];
      if (!state || state.status === "loading") {
        return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("section", { className: "monster-card monster-card--loading", children: [
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("h2", { children: monster.label }, void 0, false, {
            fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
            lineNumber: 236,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { children: "Loading spritesheet..." }, void 0, false, {
            fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
            lineNumber: 237,
            columnNumber: 17
          }, this)
        ] }, monster.key, true, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
          lineNumber: 235,
          columnNumber: 15
        }, this);
      }
      if (state.status === "error") {
        return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("section", { className: "monster-card monster-card--error", children: [
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("h2", { children: monster.label }, void 0, false, {
            fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
            lineNumber: 245,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { children: [
            "Failed to load: ",
            state.message
          ] }, void 0, true, {
            fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
            lineNumber: 246,
            columnNumber: 17
          }, this)
        ] }, monster.key, true, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
          lineNumber: 244,
          columnNumber: 15
        }, this);
      }
      const { data } = state;
      const imagePath = `/assets/game/sprites/monsters/${data.meta.image}`;
      return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("section", { className: "monster-card", children: [
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "monster-card__header", children: [
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("h2", { children: monster.label }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
              lineNumber: 258,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { children: monster.key }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
              lineNumber: 259,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
            lineNumber: 257,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: [
            data.meta.size.w,
            "x",
            data.meta.size.h
          ] }, void 0, true, {
            fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
            lineNumber: 261,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
          lineNumber: 256,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "monster-card__animations", children: [
          ANIMATION_ORDER.map((animationName) => {
            var _a;
            const frameNames = data.animations[animationName] ?? [];
            const duration = ANIMATION_SPEED_OVERRIDES[animationName] ?? TICK_INTERVAL_MS;
            const frameIndex = frameNames.length <= 1 ? 0 : Math.floor(elapsedMs / duration) % frameNames.length;
            const frameName = frameNames[frameIndex];
            const frame = frameName ? (_a = data.frames[frameName]) == null ? void 0 : _a.frame : void 0;
            return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "monster-card__animation-row", children: [
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { className: "monster-card__label", children: ANIMATION_LABELS[animationName] }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
                lineNumber: 279,
                columnNumber: 23
              }, this),
              frame ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                FrameViewport,
                {
                  imagePath,
                  sheetWidth: data.meta.size.w,
                  sheetHeight: data.meta.size.h,
                  frame
                },
                void 0,
                false,
                {
                  fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
                  lineNumber: 281,
                  columnNumber: 25
                },
                this
              ) : /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { className: "monster-card__missing", children: "Missing" }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
                lineNumber: 288,
                columnNumber: 25
              }, this)
            ] }, animationName, true, {
              fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
              lineNumber: 278,
              columnNumber: 21
            }, this);
          }),
          STATIC_FRAME_NAMES.map((frameName) => {
            var _a;
            const frame = (_a = data.frames[frameName]) == null ? void 0 : _a.frame;
            return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "monster-card__animation-row", children: [
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { className: "monster-card__label", children: STATIC_FRAME_LABELS[frameName] }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
                lineNumber: 299,
                columnNumber: 23
              }, this),
              frame ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                FrameViewport,
                {
                  imagePath,
                  sheetWidth: data.meta.size.w,
                  sheetHeight: data.meta.size.h,
                  frame
                },
                void 0,
                false,
                {
                  fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
                  lineNumber: 301,
                  columnNumber: 25
                },
                this
              ) : /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { className: "monster-card__missing", children: "Missing" }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
                lineNumber: 308,
                columnNumber: 25
              }, this)
            ] }, frameName, true, {
              fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
              lineNumber: 298,
              columnNumber: 21
            }, this);
          })
        ] }, void 0, true, {
          fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
          lineNumber: 266,
          columnNumber: 15
        }, this)
      ] }, monster.key, true, {
        fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
        lineNumber: 255,
        columnNumber: 13
      }, this);
    }) }, void 0, false, {
      fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
      lineNumber: 229,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "/Users/neiz/digivice/apps/client/src/pages/MonsterAnimationTestPage.tsx",
    lineNumber: 213,
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
      fileName: "/Users/neiz/digivice/apps/client/src/monster-animations.tsx",
      lineNumber: 14,
      columnNumber: 5
    }, void 0),
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(MonsterAnimationTestPage, {}, void 0, false, {
      fileName: "/Users/neiz/digivice/apps/client/src/monster-animations.tsx",
      lineNumber: 15,
      columnNumber: 5
    }, void 0)
  ] }, void 0, true, {
    fileName: "/Users/neiz/digivice/apps/client/src/monster-animations.tsx",
    lineNumber: 13,
    columnNumber: 3
  }, void 0)
);
//# sourceMappingURL=monster-animations.js.map

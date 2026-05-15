import { r as reactExports, j as jsxRuntimeExports, R as ReactDOM, T as TopLeftBuildLogoText } from "./index2.js";
const MONSTER_DEFINITIONS = [
  { key: "green-slime_A1", label: "Green Slime A1", jsonPath: "/assets/game/sprites/monsters/green-slime_A1.json" },
  { key: "green-slime_B1", label: "Green Slime B1", jsonPath: "/assets/game/sprites/monsters/green-slime_B1.json" },
  { key: "green-slime_B2", label: "Green Slime B2", jsonPath: "/assets/game/sprites/monsters/green-slime_B2.json" },
  { key: "green-slime_B3", label: "Green Slime B3", jsonPath: "/assets/game/sprites/monsters/green-slime_B3.json" },
  { key: "green-slime_C1", label: "Green Slime C1", jsonPath: "/assets/game/sprites/monsters/green-slime_C1.json" },
  { key: "green-slime_C2", label: "Green Slime C2", jsonPath: "/assets/game/sprites/monsters/green-slime_C2.json" },
  { key: "green-slime_C3", label: "Green Slime C3", jsonPath: "/assets/game/sprites/monsters/green-slime_C3.json" },
  { key: "green-slime_C4", label: "Green Slime C4", jsonPath: "/assets/game/sprites/monsters/green-slime_C4.json" },
  { key: "green-slime_D1", label: "Green Slime D1", jsonPath: "/assets/game/sprites/monsters/green-slime_D1.json" },
  { key: "green-slime_D2", label: "Green Slime D2", jsonPath: "/assets/game/sprites/monsters/green-slime_D2.json" },
  { key: "green-slime_D3", label: "Green Slime D3", jsonPath: "/assets/game/sprites/monsters/green-slime_D3.json" },
  { key: "green-slime_D4", label: "Green Slime D4", jsonPath: "/assets/game/sprites/monsters/green-slime_D4.json" }
];
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
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "monster-animation-frame", style: viewportStyle });
}
function MonsterAnimationTestPage() {
  const [tick, setTick] = reactExports.useState(0);
  const [monsterStates, setMonsterStates] = reactExports.useState(
    () => Object.fromEntries(
      MONSTER_DEFINITIONS.map(({ key }) => [key, { status: "loading" }])
    )
  );
  reactExports.useEffect(() => {
    document.title = "MonTTo Monster Animation Test";
  }, []);
  reactExports.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTick((current) => current + 1);
    }, TICK_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
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
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "monster-animation-test-page", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "monster-animation-test-page__header", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "monster-animation-test-page__eyebrow", children: "PC TEST PAGE" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "MonTTo Monster Animation Viewer" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "monster-animation-test-page__description", children: "This PC test page lets you review the main animation states for every monster spritesheet in one place." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "monster-animation-test-page__summary", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
          "Loaded ",
          summary.readyCount,
          "/",
          summary.totalCount
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
          "Errors ",
          summary.errorCount
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
          "Tick ",
          tick
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("main", { className: "monster-animation-test-page__grid", children: MONSTER_DEFINITIONS.map((monster) => {
      const state = monsterStates[monster.key];
      if (!state || state.status === "loading") {
        return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "monster-card monster-card--loading", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: monster.label }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Loading spritesheet..." })
        ] }, monster.key);
      }
      if (state.status === "error") {
        return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "monster-card monster-card--error", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: monster.label }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { children: [
            "Failed to load: ",
            state.message
          ] })
        ] }, monster.key);
      }
      const { data } = state;
      const imagePath = `/assets/game/sprites/monsters/${data.meta.image}`;
      return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "monster-card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "monster-card__header", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: monster.label }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: monster.key })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
            data.meta.size.w,
            "x",
            data.meta.size.h
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "monster-card__animations", children: [
          ANIMATION_ORDER.map((animationName) => {
            var _a;
            const frameNames = data.animations[animationName] ?? [];
            const duration = ANIMATION_SPEED_OVERRIDES[animationName] ?? TICK_INTERVAL_MS;
            const elapsed = tick * TICK_INTERVAL_MS;
            const frameIndex = frameNames.length <= 1 ? 0 : Math.floor(elapsed / duration) % frameNames.length;
            const frameName = frameNames[frameIndex];
            const frame = frameName ? (_a = data.frames[frameName]) == null ? void 0 : _a.frame : void 0;
            return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "monster-card__animation-row", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "monster-card__label", children: ANIMATION_LABELS[animationName] }),
              frame ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                FrameViewport,
                {
                  imagePath,
                  sheetWidth: data.meta.size.w,
                  sheetHeight: data.meta.size.h,
                  frame
                }
              ) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "monster-card__missing", children: "Missing" })
            ] }, animationName);
          }),
          STATIC_FRAME_NAMES.map((frameName) => {
            var _a;
            const frame = (_a = data.frames[frameName]) == null ? void 0 : _a.frame;
            return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "monster-card__animation-row", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "monster-card__label", children: STATIC_FRAME_LABELS[frameName] }),
              frame ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                FrameViewport,
                {
                  imagePath,
                  sheetWidth: data.meta.size.w,
                  sheetHeight: data.meta.size.h,
                  frame
                }
              ) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "monster-card__missing", children: "Missing" })
            ] }, frameName);
          })
        ] })
      ] }, monster.key);
    }) })
  ] });
}
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}
ReactDOM.createRoot(rootElement).render(
  /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(TopLeftBuildLogoText, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(MonsterAnimationTestPage, {})
  ] })
);
//# sourceMappingURL=monster-animations.js.map

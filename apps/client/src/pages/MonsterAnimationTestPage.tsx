import { useEffect, useMemo, useState } from "react";
import "./MonsterAnimationTestPage.css";

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

type MonsterDefinition = {
  key: string;
  label: string;
  jsonPath: string;
};

type MonsterLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: MonsterSpritesheet };

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

const MONSTER_DEFINITIONS: MonsterDefinition[] = [
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
  { key: "green-slime_D4", label: "Green Slime D4", jsonPath: "/assets/game/sprites/monsters/green-slime_D4.json" },
];

const ANIMATION_ORDER = ["idle", "walking", "sleeping", "eating", "sick"] as const;
const ANIMATION_LABELS: Record<(typeof ANIMATION_ORDER)[number], string> = {
  idle: "Idle",
  walking: "Walking",
  sleeping: "Sleeping",
  eating: "Eating",
  sick: "Sick",
};
const STATIC_FRAME_NAMES = ["in-basket"] as const;
const STATIC_FRAME_LABELS: Record<(typeof STATIC_FRAME_NAMES)[number], string> = {
  "in-basket": "In Basket",
};

const TICK_INTERVAL_MS = 220;
const ANIMATION_SPEED_OVERRIDES: Partial<Record<(typeof ANIMATION_ORDER)[number], number>> = {
  walking: 140,
  sleeping: 320,
  eating: 200,
};

function FrameViewport({
  imagePath,
  sheetWidth,
  sheetHeight,
  frame,
  scale = 3,
}: FrameViewportProps) {
  const viewportStyle = {
    width: `${frame.w * scale}px`,
    height: `${frame.h * scale}px`,
    backgroundImage: `url(${imagePath})`,
    backgroundPosition: `${-frame.x * scale}px ${-frame.y * scale}px`,
    backgroundSize: `${sheetWidth * scale}px ${sheetHeight * scale}px`,
  };

  return <div className="monster-animation-frame" style={viewportStyle} />;
}

export default function MonsterAnimationTestPage() {
  const [tick, setTick] = useState(0);
  const [monsterStates, setMonsterStates] = useState<Record<string, MonsterLoadState>>(() =>
    Object.fromEntries(
      MONSTER_DEFINITIONS.map(({ key }) => [key, { status: "loading" }]),
    ),
  );

  useEffect(() => {
    document.title = "MonTTo Monster Animation Test";
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTick((current) => current + 1);
    }, TICK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMonsterSheets() {
      const results = await Promise.all(
        MONSTER_DEFINITIONS.map(async (monster) => {
          try {
            const response = await fetch(monster.jsonPath);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            const data = (await response.json()) as MonsterSpritesheet;
            return [monster.key, { status: "ready", data } satisfies MonsterLoadState] as const;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            return [monster.key, { status: "error", message } satisfies MonsterLoadState] as const;
          }
        }),
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

  const summary = useMemo(() => {
    const readyCount = Object.values(monsterStates).filter(
      (state) => state.status === "ready",
    ).length;
    const errorCount = Object.values(monsterStates).filter(
      (state) => state.status === "error",
    ).length;

    return {
      readyCount,
      errorCount,
      totalCount: MONSTER_DEFINITIONS.length,
    };
  }, [monsterStates]);

  return (
    <div className="monster-animation-test-page">
      <header className="monster-animation-test-page__header">
        <div>
          <p className="monster-animation-test-page__eyebrow">PC TEST PAGE</p>
          <h1>MonTTo Monster Animation Viewer</h1>
          <p className="monster-animation-test-page__description">
            This PC test page lets you review the main animation states for every monster spritesheet in one place.
          </p>
        </div>
        <div className="monster-animation-test-page__summary">
          <span>Loaded {summary.readyCount}/{summary.totalCount}</span>
          <span>Errors {summary.errorCount}</span>
          <span>Tick {tick}</span>
        </div>
      </header>

      <main className="monster-animation-test-page__grid">
        {MONSTER_DEFINITIONS.map((monster) => {
          const state = monsterStates[monster.key];

          if (!state || state.status === "loading") {
            return (
              <section key={monster.key} className="monster-card monster-card--loading">
                <h2>{monster.label}</h2>
                <p>Loading spritesheet...</p>
              </section>
            );
          }

          if (state.status === "error") {
            return (
              <section key={monster.key} className="monster-card monster-card--error">
                <h2>{monster.label}</h2>
                <p>Failed to load: {state.message}</p>
              </section>
            );
          }

          const { data } = state;
          const imagePath = `/assets/game/sprites/monsters/${data.meta.image}`;

          return (
            <section key={monster.key} className="monster-card">
              <div className="monster-card__header">
                <div>
                  <h2>{monster.label}</h2>
                  <p>{monster.key}</p>
                </div>
                <span>
                  {data.meta.size.w}x{data.meta.size.h}
                </span>
              </div>

              <div className="monster-card__animations">
                {ANIMATION_ORDER.map((animationName) => {
                  const frameNames = data.animations[animationName] ?? [];
                  const duration = ANIMATION_SPEED_OVERRIDES[animationName] ?? TICK_INTERVAL_MS;
                  const elapsed = tick * TICK_INTERVAL_MS;
                  const frameIndex =
                    frameNames.length <= 1
                      ? 0
                      : Math.floor(elapsed / duration) % frameNames.length;
                  const frameName = frameNames[frameIndex];
                  const frame = frameName ? data.frames[frameName]?.frame : undefined;

                  return (
                    <div key={animationName} className="monster-card__animation-row">
                      <span className="monster-card__label">{ANIMATION_LABELS[animationName]}</span>
                      {frame ? (
                        <FrameViewport
                          imagePath={imagePath}
                          sheetWidth={data.meta.size.w}
                          sheetHeight={data.meta.size.h}
                          frame={frame}
                        />
                      ) : (
                        <span className="monster-card__missing">Missing</span>
                      )}
                    </div>
                  );
                })}

                {STATIC_FRAME_NAMES.map((frameName) => {
                  const frame = data.frames[frameName]?.frame;

                  return (
                    <div key={frameName} className="monster-card__animation-row">
                      <span className="monster-card__label">{STATIC_FRAME_LABELS[frameName]}</span>
                      {frame ? (
                        <FrameViewport
                          imagePath={imagePath}
                          sheetWidth={data.meta.size.w}
                          sheetHeight={data.meta.size.h}
                          frame={frame}
                        />
                      ) : (
                        <span className="monster-card__missing">Missing</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}

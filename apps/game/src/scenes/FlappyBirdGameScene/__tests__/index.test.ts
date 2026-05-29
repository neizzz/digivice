import assert from "node:assert/strict";
import test from "node:test";
import { FlappyBirdGameScene } from "../index";

const FLAPPY_BIRD_BGM_BASE_TEMPO_MULTIPLIER = 1;
const FLAPPY_BIRD_BGM_MIDGAME_TEMPO_MULTIPLIER = 1.08;
const FLAPPY_BIRD_BGM_ENDGAME_TEMPO_MULTIPLIER = 1.14;
const FLAPPY_BIRD_BGM_MAX_TEMPO_MULTIPLIER = 1.16;

function resolveTempo(score: number): number {
  const scene = Object.create(FlappyBirdGameScene.prototype) as {
    resolveBgmTempoMultiplier: (nextScore: number) => number;
  };

  return scene.resolveBgmTempoMultiplier(score);
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

test("BGM tempo multiplier가 새 난이도 구간을 따른다", () => {
  const cases: Array<[number, number]> = [
    [0, FLAPPY_BIRD_BGM_BASE_TEMPO_MULTIPLIER],
    [3, FLAPPY_BIRD_BGM_BASE_TEMPO_MULTIPLIER],
    [4, FLAPPY_BIRD_BGM_BASE_TEMPO_MULTIPLIER],
    [
      7,
      interpolate(
        FLAPPY_BIRD_BGM_BASE_TEMPO_MULTIPLIER,
        FLAPPY_BIRD_BGM_MIDGAME_TEMPO_MULTIPLIER,
        (7 - 4) / (10 - 4),
      ),
    ],
    [10, FLAPPY_BIRD_BGM_MIDGAME_TEMPO_MULTIPLIER],
    [11, FLAPPY_BIRD_BGM_MIDGAME_TEMPO_MULTIPLIER],
    [
      20,
      interpolate(
        FLAPPY_BIRD_BGM_MIDGAME_TEMPO_MULTIPLIER,
        FLAPPY_BIRD_BGM_ENDGAME_TEMPO_MULTIPLIER,
        (20 - 11) / (30 - 11),
      ),
    ],
    [30, FLAPPY_BIRD_BGM_ENDGAME_TEMPO_MULTIPLIER],
    [31, FLAPPY_BIRD_BGM_MAX_TEMPO_MULTIPLIER],
    [81, FLAPPY_BIRD_BGM_MAX_TEMPO_MULTIPLIER],
  ];

  for (const [score, expected] of cases) {
    assert.ok(
      Math.abs(resolveTempo(score) - expected) < 1e-9,
      `score=${score} expected=${expected} actual=${resolveTempo(score)}`,
    );
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { FlappyBirdBgmController } from "../bgm";

type ScheduledEffectVoice = {
  waveform: OscillatorType;
  frequency: number;
  time: number;
  duration: number;
  peakGain: number;
};

function createPipePassCueHarness() {
  const controller = new FlappyBirdBgmController() as unknown as {
    audioContext: { currentTime: number; state: string };
    effectsGain: object;
    scheduleEffectVoice: (params: ScheduledEffectVoice) => void;
    playPipePassCue: (hasNearMissBonus?: boolean) => void;
  };
  const scheduledVoices: ScheduledEffectVoice[] = [];

  controller.audioContext = {
    currentTime: 12.5,
    state: "running",
  };
  controller.effectsGain = {};
  controller.scheduleEffectVoice = (params) => {
    scheduledVoices.push(params);
  };

  return {
    controller,
    scheduledVoices,
  };
}

test("pipe pass cue는 일반 통과 시 effect voice를 1회만 예약한다", () => {
  const { controller, scheduledVoices } = createPipePassCueHarness();

  controller.playPipePassCue(false);

  assert.equal(scheduledVoices.length, 1);
  assert.equal(scheduledVoices[0]?.waveform, "square");
  assert.equal(scheduledVoices[0]?.time, 12.5);
});

test("pipe pass cue는 near-miss 통과 시에도 1회만 예약하고 일반 통과보다 강조된다", () => {
  const normalHarness = createPipePassCueHarness();
  normalHarness.controller.playPipePassCue(false);

  const nearMissHarness = createPipePassCueHarness();
  nearMissHarness.controller.playPipePassCue(true);

  assert.equal(nearMissHarness.scheduledVoices.length, 1);
  assert.equal(nearMissHarness.scheduledVoices[0]?.waveform, "square");
  assert.ok(
    (nearMissHarness.scheduledVoices[0]?.frequency ?? 0) >
      (normalHarness.scheduledVoices[0]?.frequency ?? 0),
  );
  assert.ok(
    (nearMissHarness.scheduledVoices[0]?.peakGain ?? 0) >
      (normalHarness.scheduledVoices[0]?.peakGain ?? 0),
  );
});

import { isSfxEnabled } from "../settings/gameSettings";

const CONTROL_BUTTON_DOWN_SOUND_SRC = "/ui/sounds/keydown.mp3";
const CONTROL_BUTTON_UP_SOUND_SRC = "/ui/sounds/keyup.mp3";
const UI_POP_SOUND_SRC = "/ui/sounds/ui-pop-sound.mp3";
const FOOD_THROW_SOUND_SRC = "/game/sounds/throwing.mp3";
const BROOM_SOUND_SRC = "/game/sounds/broom.mp3";
const SMALL_JUMP_SOUND_SRC = "/game/sounds/small_jump.wav";
const BIG_JUMP_SOUND_SRC = "/game/sounds/big_jump.wav";
const SYRINGE_INSERT_SOUND_SRC = "/game/sounds/syringe-insert.mp3";
const UI_SOUND_SOURCES = [
  CONTROL_BUTTON_DOWN_SOUND_SRC,
  CONTROL_BUTTON_UP_SOUND_SRC,
  UI_POP_SOUND_SRC,
  FOOD_THROW_SOUND_SRC,
  BROOM_SOUND_SRC,
  SMALL_JUMP_SOUND_SRC,
  BIG_JUMP_SOUND_SRC,
  SYRINGE_INSERT_SOUND_SRC,
] as const;
const VOLUME_REDUCED_40_PERCENT = 0.6;
const VOLUME_REDUCED_50_PERCENT = 0.5;
const VOLUME_REDUCED_20_PERCENT = 0.8;
const CONTROL_BUTTON_KEY_VOLUME = 0.36;
const SMALL_JUMP_VOLUME = 0.18;
const BIG_JUMP_VOLUME =
  VOLUME_REDUCED_50_PERCENT * 0.9 * VOLUME_REDUCED_20_PERCENT;

type AudioContextConstructor = typeof AudioContext;

const activeBufferSources = new Set<AudioBufferSourceNode>();
const preloadedAudioBuffers = new Map<string, AudioBuffer>();
let uiSfxAudioContext: AudioContext | null = null;
let uiSfxMasterGainNode: GainNode | null = null;
let preloadUiSfxPromise: Promise<void> | null = null;
let resumeUiSfxPromise: Promise<void> | null = null;
let hasWarmedUpUiSfxAudioContext = false;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const audioWindow = window as Window & {
    webkitAudioContext?: AudioContextConstructor;
  };

  return window.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

function getUiSfxAudioContext(): AudioContext | null {
  if (uiSfxAudioContext && uiSfxMasterGainNode) {
    return uiSfxAudioContext;
  }

  const AudioContextCtor = getAudioContextConstructor();

  if (!AudioContextCtor) {
    return null;
  }

  try {
    const audioContext = new AudioContextCtor();
    const masterGainNode = audioContext.createGain();
    masterGainNode.gain.value = 1;
    masterGainNode.connect(audioContext.destination);

    uiSfxAudioContext = audioContext;
    uiSfxMasterGainNode = masterGainNode;

    return audioContext;
  } catch {
    uiSfxAudioContext = null;
    uiSfxMasterGainNode = null;
    return null;
  }
}

async function decodeAudioBuffer(
  audioContext: AudioContext,
  src: string,
): Promise<void> {
  if (preloadedAudioBuffers.has(src) || typeof fetch === "undefined") {
    return;
  }

  const response = await fetch(src);

  if (!response.ok) {
    throw new Error(`Failed to fetch UI SFX: ${src}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  preloadedAudioBuffers.set(src, audioBuffer);
}

async function ensureUiSfxPreloaded(): Promise<void> {
  if (preloadUiSfxPromise) {
    await preloadUiSfxPromise;
    return;
  }

  const audioContext = getUiSfxAudioContext();

  if (!audioContext) {
    return;
  }

  const pendingSources = UI_SOUND_SOURCES.filter(
    (src) => !preloadedAudioBuffers.has(src),
  );

  if (pendingSources.length === 0) {
    return;
  }

  preloadUiSfxPromise = Promise.allSettled(
    pendingSources.map((src) => decodeAudioBuffer(audioContext, src)),
  ).then(() => undefined);

  try {
    await preloadUiSfxPromise;
  } finally {
    preloadUiSfxPromise = null;
  }
}

export function preloadUiSfx(): void {
  void ensureUiSfxPreloaded();
}

function warmUpUiSfxAudioContext(audioContext: AudioContext): void {
  if (hasWarmedUpUiSfxAudioContext || !uiSfxMasterGainNode) {
    return;
  }

  const silentBuffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
  const bufferSource = audioContext.createBufferSource();
  const gainNode = audioContext.createGain();
  gainNode.gain.value = 0;
  bufferSource.buffer = silentBuffer;
  bufferSource.connect(gainNode);
  gainNode.connect(uiSfxMasterGainNode);
  bufferSource.start(0);
  hasWarmedUpUiSfxAudioContext = true;
}

export function resumeUiSfxFromGesture(): void {
  if (resumeUiSfxPromise) {
    return;
  }

  resumeUiSfxPromise = (async () => {
    const audioContext = getUiSfxAudioContext();

    if (!audioContext) {
      return;
    }

    try {
      await ensureUiSfxPreloaded();
    } catch {
      // HTMLAudio fallback remains available even if AudioBuffer preload fails.
    }

    if (audioContext.state !== "running") {
      try {
        await audioContext.resume();
      } catch {
        return;
      }
    }

    if (audioContext.state === "running") {
      try {
        warmUpUiSfxAudioContext(audioContext);
      } catch {
        // Ignore warm-up failures and keep playback available.
      }
    }
  })().finally(() => {
    resumeUiSfxPromise = null;
  });
}

function playAudioBuffer(buffer: AudioBuffer, volume = 1): boolean {
  const audioContext = getUiSfxAudioContext();
  const masterGainNode = uiSfxMasterGainNode;

  if (!audioContext || !masterGainNode) {
    return false;
  }

  if (audioContext.state !== "running" && !resumeUiSfxPromise) {
    return false;
  }

  try {
    const bufferSource = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    gainNode.gain.value = volume;
    bufferSource.buffer = buffer;
    bufferSource.connect(gainNode);
    gainNode.connect(masterGainNode);

    const cleanup = () => {
      activeBufferSources.delete(bufferSource);
      bufferSource.disconnect();
      gainNode.disconnect();
    };

    activeBufferSources.add(bufferSource);
    bufferSource.addEventListener("ended", cleanup, { once: true });
    bufferSource.start(0);
    return true;
  } catch {
    return false;
  }
}

function playUiSound(src: string, volume = 1): void {
  if (!isSfxEnabled()) {
    return;
  }

  const audioBuffer = preloadedAudioBuffers.get(src);

  if (audioBuffer && playAudioBuffer(audioBuffer, volume)) {
    return;
  }

  void ensureUiSfxPreloaded();
}

export function playControlButtonDownSound(): void {
  playUiSound(CONTROL_BUTTON_DOWN_SOUND_SRC, CONTROL_BUTTON_KEY_VOLUME);
}

export function playControlButtonUpSound(): void {
  playUiSound(CONTROL_BUTTON_UP_SOUND_SRC, CONTROL_BUTTON_KEY_VOLUME);
}

export function playUiPopSound(): void {
  playUiSound(UI_POP_SOUND_SRC);
}

export function playFoodThrowSound(): void {
  playUiSound(FOOD_THROW_SOUND_SRC, VOLUME_REDUCED_40_PERCENT);
}

export function playBroomSound(): void {
  playUiSound(BROOM_SOUND_SRC);
}

export function playSmallJumpSound(): void {
  playUiSound(SMALL_JUMP_SOUND_SRC, SMALL_JUMP_VOLUME);
}

export function playBigJumpSound(): void {
  playUiSound(BIG_JUMP_SOUND_SRC, BIG_JUMP_VOLUME);
}

export function playSyringeInsertSound(): void {
  playUiSound(SYRINGE_INSERT_SOUND_SRC);
}

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

const activeSounds = new Set<HTMLAudioElement>();
const preloadedSounds = new Map<string, HTMLAudioElement>();

function createAudioElement(src: string): HTMLAudioElement | null {
  if (typeof Audio === "undefined") {
    return null;
  }

  try {
    return new Audio(src);
  } catch {
    return null;
  }
}

export function preloadUiSfx(): void {
  if (typeof Audio === "undefined") {
    return;
  }

  for (const src of UI_SOUND_SOURCES) {
    if (preloadedSounds.has(src)) {
      continue;
    }

    const audio = createAudioElement(src);

    if (!audio) {
      continue;
    }

    audio.preload = "auto";
    preloadedSounds.set(src, audio);

    try {
      audio.load();
    } catch {
      preloadedSounds.delete(src);
    }
  }
}

function createPlayableAudioElement(src: string): HTMLAudioElement | null {
  const preloadedAudio = preloadedSounds.get(src);

  if (preloadedAudio) {
    const audio = preloadedAudio.cloneNode(true) as HTMLAudioElement;
    audio.preload = "auto";
    return audio;
  }

  return createAudioElement(src);
}

function playUiSound(src: string, volume = 1): void {
  if (typeof Audio === "undefined" || !isSfxEnabled()) {
    return;
  }

  const audio = createPlayableAudioElement(src);

  if (!audio) {
    return;
  }

  audio.volume = volume;

  activeSounds.add(audio);

  const cleanup = () => {
    activeSounds.delete(audio);
  };

  audio.addEventListener("ended", cleanup, { once: true });
  audio.addEventListener("error", cleanup, { once: true });

  void audio.play().catch(cleanup);
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

type AudioContextConstructor = typeof AudioContext;

type Waveform = OscillatorType;

const FLAPPY_BIRD_BGM_BPM = 144;
const FLAPPY_BIRD_BGM_STEPS_PER_BEAT = 2;
const FLAPPY_BIRD_BGM_STEP_DURATION_S =
  60 / FLAPPY_BIRD_BGM_BPM / FLAPPY_BIRD_BGM_STEPS_PER_BEAT;
const FLAPPY_BIRD_BGM_SCHEDULE_AHEAD_S = 0.12;
const FLAPPY_BIRD_BGM_SCHEDULER_INTERVAL_MS = 25;
const FLAPPY_BIRD_BGM_MASTER_GAIN = 0.055;
const FLAPPY_BIRD_SFX_GAIN = 0.085;
const FLAPPY_BIRD_BGM_ATTACK_S = 0.02;
const FLAPPY_BIRD_BGM_RELEASE_S = 0.08;
const FLAPPY_BIRD_PIPE_PASS_CUE_ATTACK_S = 0.004;
const FLAPPY_BIRD_PIPE_PASS_CUE_RELEASE_S = 0.12;
const FLAPPY_BIRD_COUNTDOWN_CUE_DURATION_S = 0.09;

const FLAPPY_BIRD_BGM_LEAD_PATTERN: Array<number | null> = [
  76, 79, 81, 79, 76, 79, 83, 79, 74, 77, 81, 77, 74, 77, 79, 77,
];

const FLAPPY_BIRD_BGM_BASS_PATTERN: Array<number | null> = [
  52,
  null,
  52,
  null,
  55,
  null,
  55,
  null,
  50,
  null,
  50,
  null,
  55,
  null,
  57,
  null,
];

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const audioWindow = window as Window & {
    webkitAudioContext?: AudioContextConstructor;
  };

  return window.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class FlappyBirdBgmController {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private schedulerTimerId: number | null = null;
  private nextStepTime = 0;
  private currentStep = 0;
  private isPlaying = false;
  private isDestroyed = false;
  private enabled = true;
  private sfxEnabled = true;

  public isEnabled(): boolean {
    return this.enabled;
  }

  public isSfxEnabled(): boolean {
    return this.sfxEnabled;
  }

  public setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) {
      return;
    }

    this.enabled = enabled;

    if (!enabled) {
      this.pause();
    }
  }

  public setSfxEnabled(enabled: boolean): void {
    this.sfxEnabled = enabled;
  }

  public async startFromGesture(): Promise<void> {
    if (!this.ensureAudioGraph()) {
      return;
    }

    await this.resumeAudioContext();

    if (this.audioContext?.state !== "running" || !this.enabled) {
      return;
    }

    this.startPlayback();
  }

  public playPipePassCue(hasNearMissBonus = false): void {
    if (
      this.isDestroyed ||
      !this.sfxEnabled ||
      !this.audioContext ||
      !this.effectsGain ||
      this.audioContext.state !== "running"
    ) {
      return;
    }

    const now = this.audioContext.currentTime;
    const baseFrequency = hasNearMissBonus
      ? midiToFrequency(88)
      : midiToFrequency(83);
    const accentFrequency = hasNearMissBonus
      ? midiToFrequency(95)
      : midiToFrequency(90);

    this.scheduleEffectVoice({
      waveform: "square",
      frequency: baseFrequency,
      time: now,
      duration: 0.08,
      peakGain: hasNearMissBonus ? 0.16 : 0.12,
    });
    this.scheduleEffectVoice({
      waveform: "triangle",
      frequency: accentFrequency,
      time: now + 0.024,
      duration: 0.1,
      peakGain: hasNearMissBonus ? 0.1 : 0.075,
    });
  }

  public async playCountdownCue(displayValue: number): Promise<void> {
    if (this.isDestroyed || !this.sfxEnabled) {
      return;
    }

    if (!this.ensureAudioGraph()) {
      return;
    }

    await this.resumeAudioContext();

    if (
      !this.audioContext ||
      !this.effectsGain ||
      this.audioContext.state !== "running"
    ) {
      return;
    }

    const clampedDisplayValue = Math.min(3, Math.max(1, Math.floor(displayValue)));
    const countdownStep = 3 - clampedDisplayValue;
    const baseFrequency = midiToFrequency(69 + countdownStep * 4);
    const accentFrequency = midiToFrequency(76 + countdownStep * 4);
    const now = this.audioContext.currentTime;

    this.scheduleEffectVoice({
      waveform: "square",
      frequency: baseFrequency,
      time: now,
      duration: FLAPPY_BIRD_COUNTDOWN_CUE_DURATION_S,
      peakGain: 0.085,
    });
    this.scheduleEffectVoice({
      waveform: "triangle",
      frequency: accentFrequency,
      time: now + 0.018,
      duration: FLAPPY_BIRD_COUNTDOWN_CUE_DURATION_S,
      peakGain: 0.05,
    });
  }

  public async resumeIfAvailable(): Promise<void> {
    if (!this.enabled || this.isDestroyed || !this.audioContext) {
      return;
    }

    await this.resumeAudioContext();

    if (this.audioContext.state !== "running") {
      return;
    }

    this.startPlayback();
  }

  public pause(): void {
    if (!this.audioContext || !this.masterGain) {
      return;
    }

    this.isPlaying = false;

    if (this.schedulerTimerId !== null) {
      window.clearInterval(this.schedulerTimerId);
      this.schedulerTimerId = null;
    }

    const now = this.audioContext.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(
      0,
      now + FLAPPY_BIRD_BGM_RELEASE_S,
    );
  }

  public destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.pause();
    this.isDestroyed = true;

    const audioContext = this.audioContext;
    this.audioContext = null;
    this.masterGain = null;
    this.effectsGain = null;

    if (audioContext) {
      void audioContext.close().catch(() => undefined);
    }
  }

  private ensureAudioGraph(): boolean {
    if (this.isDestroyed) {
      return false;
    }

    if (this.audioContext && this.masterGain) {
      return true;
    }

    const AudioContextCtor = getAudioContextConstructor();

    if (!AudioContextCtor) {
      return false;
    }

    const audioContext = new AudioContextCtor();
    const masterGain = audioContext.createGain();
    const effectsGain = audioContext.createGain();
    masterGain.gain.value = 0;
    effectsGain.gain.value = FLAPPY_BIRD_SFX_GAIN;
    masterGain.connect(audioContext.destination);
    effectsGain.connect(audioContext.destination);

    this.audioContext = audioContext;
    this.masterGain = masterGain;
    this.effectsGain = effectsGain;

    return true;
  }

  private async resumeAudioContext(): Promise<void> {
    if (!this.audioContext || this.audioContext.state === "running") {
      return;
    }

    try {
      await this.audioContext.resume();
    } catch {
      // Ignore autoplay-policy or device audio failures.
    }
  }

  private startPlayback(): void {
    if (!this.audioContext || !this.masterGain || this.isPlaying) {
      return;
    }

    this.isPlaying = true;
    this.currentStep = 0;
    this.nextStepTime = this.audioContext.currentTime + 0.03;

    const now = this.audioContext.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(
      FLAPPY_BIRD_BGM_MASTER_GAIN,
      now + FLAPPY_BIRD_BGM_ATTACK_S,
    );

    this.schedulerTimerId = window.setInterval(() => {
      this.scheduleLoop();
    }, FLAPPY_BIRD_BGM_SCHEDULER_INTERVAL_MS);

    this.scheduleLoop();
  }

  private scheduleLoop(): void {
    if (!this.audioContext || !this.masterGain || !this.isPlaying) {
      return;
    }

    while (
      this.nextStepTime <
      this.audioContext.currentTime + FLAPPY_BIRD_BGM_SCHEDULE_AHEAD_S
    ) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.currentStep =
        (this.currentStep + 1) % FLAPPY_BIRD_BGM_LEAD_PATTERN.length;
      this.nextStepTime += FLAPPY_BIRD_BGM_STEP_DURATION_S;
    }
  }

  private scheduleStep(step: number, time: number): void {
    const leadMidi = FLAPPY_BIRD_BGM_LEAD_PATTERN[step];
    const bassMidi = FLAPPY_BIRD_BGM_BASS_PATTERN[step];

    if (leadMidi !== null) {
      this.scheduleVoice({
        waveform: "square",
        frequency: midiToFrequency(leadMidi),
        time,
        duration: FLAPPY_BIRD_BGM_STEP_DURATION_S * 0.9,
        peakGain: 0.14,
      });
    }

    if (bassMidi !== null) {
      this.scheduleVoice({
        waveform: "triangle",
        frequency: midiToFrequency(bassMidi),
        time,
        duration: FLAPPY_BIRD_BGM_STEP_DURATION_S * 1.8,
        peakGain: 0.12,
      });
    }
  }

  private scheduleVoice(params: {
    waveform: Waveform;
    frequency: number;
    time: number;
    duration: number;
    peakGain: number;
  }): void {
    if (!this.audioContext || !this.masterGain) {
      return;
    }

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const noteEndTime = params.time + params.duration;

    oscillator.type = params.waveform;
    oscillator.frequency.setValueAtTime(params.frequency, params.time);

    gainNode.gain.setValueAtTime(0.0001, params.time);
    gainNode.gain.exponentialRampToValueAtTime(
      params.peakGain,
      params.time + 0.01,
    );
    gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEndTime);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start(params.time);
    oscillator.stop(noteEndTime + 0.02);
  }

  private scheduleEffectVoice(params: {
    waveform: Waveform;
    frequency: number;
    time: number;
    duration: number;
    peakGain: number;
  }): void {
    if (!this.audioContext || !this.effectsGain) {
      return;
    }

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const noteEndTime = params.time + params.duration;

    oscillator.type = params.waveform;
    oscillator.frequency.setValueAtTime(params.frequency, params.time);
    oscillator.frequency.exponentialRampToValueAtTime(
      params.frequency * 1.06,
      noteEndTime,
    );

    gainNode.gain.setValueAtTime(0.0001, params.time);
    gainNode.gain.exponentialRampToValueAtTime(
      params.peakGain,
      params.time + FLAPPY_BIRD_PIPE_PASS_CUE_ATTACK_S,
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      noteEndTime + FLAPPY_BIRD_PIPE_PASS_CUE_RELEASE_S,
    );

    oscillator.connect(gainNode);
    gainNode.connect(this.effectsGain);

    oscillator.start(params.time);
    oscillator.stop(noteEndTime + FLAPPY_BIRD_PIPE_PASS_CUE_RELEASE_S + 0.02);
  }
}

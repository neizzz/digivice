var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { a as requireReactDom, r as reactExports, j as jsxDevRuntimeExports, T as TopLeftBuildLogoText, R as ReactDOM } from "./index2.js";
import { z as DEFAULT_LOCALE, F as resolveLocaleFromLanguageTags, G as ControlButtonType, H as hasNativeStorageController, I as FlutterStorage, W as WebLocalStorage, J as translate, K as countDisplayCharacters, L as measureNameLabelWidth, N as fitsNameLabelWidth, O as TIME_OF_DAY_OPTIONS, Q as getTimeOfDayLabel, V as TRANSLATIONS, X as NAME_LABEL_FONT_FAMILIES, Y as NAME_LABEL_FONT_WEIGHT, Z as NAME_LABEL_STROKE_COLOR, _ as NAME_LABEL_FILL_COLOR, $ as NAME_LABEL_STROKE_WIDTH, a0 as SUPPORTED_LOCALES, a1 as LOCALE_METADATA, a2 as SceneKey, a3 as hasLegacyMonsterBookState, a4 as migrateLegacyMonsterBookIfNeeded, a5 as getNativeSunTimes, a6 as MissingInitialGameDataError, a7 as Game } from "./evolutionAdmin.js";
var reactDomExports = requireReactDom();
class SliderController {
  /**
   * SliderController 생성자
   * @param element 슬라이더 기능을 적용할 DOM 요소
   * @param options 슬라이더 설정 옵션
   */
  constructor(element, options = {}) {
    __publicField(this, "element");
    __publicField(this, "options");
    __publicField(this, "isDragging", false);
    __publicField(this, "currentValue");
    __publicField(this, "activePointerId", null);
    // 포인터 다운 위치 오프셋 저장 변수
    __publicField(this, "pointerOffsetX", Number.NaN);
    __publicField(this, "startValue", Number.NaN);
    // 이벤트 핸들러 참조 보관 (제거를 위해)
    __publicField(this, "boundPointerMove");
    __publicField(this, "boundPointerUp");
    __publicField(this, "boundPointerDown");
    this.element = element;
    this.options = {
      onChange: options.onChange || (() => {
      }),
      initialValue: options.initialValue ?? 0.5,
      onDragStart: options.onDragStart || (() => {
      }),
      onDragEnd: options.onDragEnd || (() => {
      }),
      thumbWidth: options.thumbWidth ?? 0,
      rangeMultiplier: options.rangeMultiplier ?? 1
    };
    this.currentValue = this.clamp(this.options.initialValue);
    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.element.addEventListener("pointerdown", this.boundPointerDown);
    this.element.style.touchAction = "none";
    this.element.style.userSelect = "none";
  }
  /**
   * pointerdown 이벤트 핸들러: 드래그 시작
   */
  handlePointerDown(e) {
    e.preventDefault();
    this.element.setPointerCapture(e.pointerId);
    this.activePointerId = e.pointerId;
    this.pointerOffsetX = e.pageX;
    this.startValue = this.currentValue;
    this.isDragging = true;
    this.options.onDragStart();
    document.addEventListener("pointermove", this.boundPointerMove);
    document.addEventListener("pointerup", this.boundPointerUp);
  }
  /**
   * pointermove 이벤트 핸들러: 슬라이더 값 업데이트
   */
  handlePointerMove(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    this.updateValueFromPosition(e);
  }
  /**
   * pointerup 이벤트 핸들러: 드래그 종료
   */
  handlePointerUp(e) {
    e.preventDefault();
    this.updateValueFromPosition(e);
    if (this.element.hasPointerCapture(e.pointerId)) {
      this.element.releasePointerCapture(e.pointerId);
    }
    this.activePointerId = null;
    this.isDragging = false;
    this.options.onDragEnd();
    document.removeEventListener("pointermove", this.boundPointerMove);
    document.removeEventListener("pointerup", this.boundPointerUp);
  }
  /**
   * 포인터 위치에 따라 슬라이더 값을 업데이트 (X축만 고려)
   */
  updateValueFromPosition(e) {
    const rect = this.element.getBoundingClientRect();
    const dragWidth = Math.max(
      1,
      (rect.width - this.options.thumbWidth) * this.options.rangeMultiplier
    );
    const adjustedX = e.pageX - this.pointerOffsetX;
    let percentage = this.startValue + adjustedX / dragWidth;
    percentage = Math.max(0, Math.min(1, percentage));
    if (percentage !== this.currentValue) {
      this.currentValue = percentage;
      this.options.onChange(percentage);
    }
  }
  /**
   * 현재 슬라이더 값 가져오기
   */
  getValue() {
    return this.currentValue;
  }
  /**
   * 슬라이더 값 설정하기
   */
  setValue(value, options = {}) {
    const newValue = this.clamp(value);
    if (newValue !== this.currentValue) {
      this.currentValue = newValue;
      if (options.emitChange ?? true) {
        this.options.onChange(newValue);
      }
    }
  }
  /**
   * 값을 0-1 범위 내로 제한
   */
  clamp(value) {
    return Math.max(0, Math.min(1, value));
  }
  /**
   * SliderController 정리: 이벤트 리스너 제거
   */
  dispose() {
    if (this.activePointerId !== null && this.element.hasPointerCapture(this.activePointerId)) {
      this.element.releasePointerCapture(this.activePointerId);
    }
    this.activePointerId = null;
    this.isDragging = false;
    this.element.removeEventListener("pointerdown", this.boundPointerDown);
    document.removeEventListener("pointermove", this.boundPointerMove);
    document.removeEventListener("pointerup", this.boundPointerUp);
  }
}
class PlatformAdapter {
  constructor() {
    __publicField(this, "userAgent");
    this.userAgent = navigator.userAgent;
  }
  /**
   * 현재 플랫폼이 Android인지 확인
   */
  isAndroid() {
    return this.userAgent.includes("DigiviceApp-Android");
  }
  /**
   * 현재 플랫폼이 iOS인지 확인
   */
  isIOS() {
    return this.userAgent.includes("DigiviceApp-iOS");
  }
  /**
   * 현재 플랫폼 이름 반환
   * User Agent 문자열에서 DigiviceApp- 뒤의 플랫폼 이름을 추출합니다.
   */
  getPlatformName() {
    const matches = this.userAgent.match(/DigiviceApp-([^;]+)/);
    return matches ? matches[1] : "unknown";
  }
  /**
   * 웹앱이 Flutter 웹뷰 내에서 실행 중인지 확인
   */
  isRunningInNativeApp() {
    return this.userAgent.includes("DigiviceApp");
  }
}
const STORAGE_KEYS = {
  vibrationEnabled: "game.settings.vibrationEnabled",
  sfxEnabled: "game.settings.sfxEnabled",
  locale: "game.settings.locale"
};
const DEFAULT_SETTINGS = {
  vibrationEnabled: true,
  sfxEnabled: true,
  locale: DEFAULT_LOCALE
};
function getBooleanSetting(key, defaultValue) {
  if (typeof window === "undefined") {
    return defaultValue;
  }
  const value = window.localStorage.getItem(key);
  if (value === null) {
    return defaultValue;
  }
  return value === "true";
}
function getLocaleSetting() {
  if (typeof navigator === "undefined") {
    return DEFAULT_SETTINGS.locale;
  }
  return resolveLocaleFromLanguageTags([
    ...Array.from(navigator.languages ?? []),
    navigator.language
  ]);
}
function getGameSettings() {
  return {
    vibrationEnabled: getBooleanSetting(
      STORAGE_KEYS.vibrationEnabled,
      DEFAULT_SETTINGS.vibrationEnabled
    ),
    sfxEnabled: getBooleanSetting(
      STORAGE_KEYS.sfxEnabled,
      DEFAULT_SETTINGS.sfxEnabled
    ),
    locale: getLocaleSetting()
  };
}
function updateGameSettings(partialSettings) {
  const nextSettings = {
    ...getGameSettings(),
    ...partialSettings
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      STORAGE_KEYS.vibrationEnabled,
      String(nextSettings.vibrationEnabled)
    );
    window.localStorage.setItem(
      STORAGE_KEYS.sfxEnabled,
      String(nextSettings.sfxEnabled)
    );
    window.localStorage.setItem(STORAGE_KEYS.locale, nextSettings.locale);
  }
  return nextSettings;
}
function isVibrationEnabled() {
  return getGameSettings().vibrationEnabled;
}
function isSfxEnabled() {
  return getGameSettings().sfxEnabled;
}
const DEFAULT_VIBRATION_DURATION = 20;
const DEFAULT_VIBRATION_STRENGTH = 60;
const MIN_VIBRATION_STRENGTH = 10;
const MAX_VIBRATION_STRENGTH = 255;
function normalizeVibrationStrength(strength) {
  if (strength === void 0) {
    return void 0;
  }
  if (!Number.isFinite(strength)) {
    return void 0;
  }
  return Math.min(
    MAX_VIBRATION_STRENGTH,
    Math.max(MIN_VIBRATION_STRENGTH, Math.round(strength))
  );
}
class VibrationAdapter {
  constructor() {
    __publicField(this, "platformAdapter");
    this.platformAdapter = new PlatformAdapter();
  }
  /**
   * 진동 실행
   * @param duration 진동 지속 시간(ms). 기본값: 50ms
   * @param strength 진동 강도. 1-255 범위, 지원 기기에서만 적용
   */
  async vibrate(duration = DEFAULT_VIBRATION_DURATION, strength = DEFAULT_VIBRATION_STRENGTH) {
    if (!isVibrationEnabled()) {
      return;
    }
    if (!this.platformAdapter.isRunningInNativeApp()) {
      return;
    }
    if (!window.vibrationController) {
      return;
    }
    try {
      const normalizedStrength = normalizeVibrationStrength(strength);
      await window.vibrationController.vibrate(
        duration,
        normalizedStrength
      );
    } catch {
    }
  }
  /**
   * 네이티브 앱에서 실행 중인지 확인
   */
  isAvailable() {
    return this.platformAdapter.isRunningInNativeApp() && !!window.vibrationController;
  }
}
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
  SYRINGE_INSERT_SOUND_SRC
];
const VOLUME_REDUCED_40_PERCENT = 0.6;
const VOLUME_REDUCED_50_PERCENT = 0.5;
const VOLUME_REDUCED_20_PERCENT = 0.8;
const CONTROL_BUTTON_KEY_VOLUME = 0.36;
const SMALL_JUMP_VOLUME = 0.18;
const BIG_JUMP_VOLUME = VOLUME_REDUCED_50_PERCENT * 0.9 * VOLUME_REDUCED_20_PERCENT;
const activeBufferSources = /* @__PURE__ */ new Set();
const preloadedAudioBuffers = /* @__PURE__ */ new Map();
let uiSfxAudioContext = null;
let uiSfxMasterGainNode = null;
let preloadUiSfxPromise = null;
let resumeUiSfxPromise = null;
let hasWarmedUpUiSfxAudioContext = false;
function getAudioContextConstructor() {
  if (typeof window === "undefined") {
    return null;
  }
  const audioWindow = window;
  return window.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}
function getUiSfxAudioContext() {
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
async function decodeAudioBuffer(audioContext, src) {
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
async function ensureUiSfxPreloaded() {
  if (preloadUiSfxPromise) {
    await preloadUiSfxPromise;
    return;
  }
  const audioContext = getUiSfxAudioContext();
  if (!audioContext) {
    return;
  }
  const pendingSources = UI_SOUND_SOURCES.filter(
    (src) => !preloadedAudioBuffers.has(src)
  );
  if (pendingSources.length === 0) {
    return;
  }
  preloadUiSfxPromise = Promise.allSettled(
    pendingSources.map((src) => decodeAudioBuffer(audioContext, src))
  ).then(() => void 0);
  try {
    await preloadUiSfxPromise;
  } finally {
    preloadUiSfxPromise = null;
  }
}
function preloadUiSfx() {
  void ensureUiSfxPreloaded();
}
function warmUpUiSfxAudioContext(audioContext) {
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
function resumeUiSfxFromGesture() {
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
      }
    }
  })().finally(() => {
    resumeUiSfxPromise = null;
  });
}
function playAudioBuffer(buffer, volume = 1) {
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
function playUiSound(src, volume = 1) {
  if (!isSfxEnabled()) {
    return;
  }
  const audioBuffer = preloadedAudioBuffers.get(src);
  if (audioBuffer && playAudioBuffer(audioBuffer, volume)) {
    return;
  }
  void ensureUiSfxPreloaded();
}
function playControlButtonDownSound() {
  playUiSound(CONTROL_BUTTON_DOWN_SOUND_SRC, CONTROL_BUTTON_KEY_VOLUME);
}
function playControlButtonUpSound() {
  playUiSound(CONTROL_BUTTON_UP_SOUND_SRC, CONTROL_BUTTON_KEY_VOLUME);
}
function playUiPopSound() {
  playUiSound(UI_POP_SOUND_SRC);
}
function playFoodThrowSound() {
  playUiSound(FOOD_THROW_SOUND_SRC, VOLUME_REDUCED_40_PERCENT);
}
function playBroomSound() {
  playUiSound(BROOM_SOUND_SRC);
}
function playSmallJumpSound() {
  playUiSound(SMALL_JUMP_SOUND_SRC, SMALL_JUMP_VOLUME);
}
function playBigJumpSound() {
  playUiSound(BIG_JUMP_SOUND_SRC, BIG_JUMP_VOLUME);
}
function playSyringeInsertSound() {
  playUiSound(SYRINGE_INSERT_SOUND_SRC);
}
const SLIDER_THUMB_SIZE = 64;
const SLIDER_TRACK_RANGE_MULTIPLIER = 1.1;
const SLIDER_INPUT_RANGE_MULTIPLIER = 1.05;
const SLIDER_DRAG_VIBRATION_STEP_PX = 12;
const SLIDER_DRAG_VIBRATION_DURATION = 10;
const SLIDER_DRAG_VIBRATION_STRENGTH = 18;
const SLIDER_DIRECTION_CHANGE_VIBRATION_DURATION = 14;
const SLIDER_DIRECTION_CHANGE_VIBRATION_STRENGTH = 30;
const SLIDER_DIRECTION_CHANGE_THRESHOLD = 8e-3;
const spriteInfoMap = {
  [ControlButtonType.Clean]: {
    normal: { x: 640, y: 0 },
    pressed: { x: 704, y: 0 }
  },
  [ControlButtonType.Jump]: {
    normal: { x: 768, y: 0 },
    pressed: { x: 832, y: 0 }
  },
  [ControlButtonType.DoubleJump]: {
    normal: { x: 896, y: 0 },
    pressed: { x: 960, y: 0 }
  },
  [ControlButtonType.Attack]: {
    normal: { x: 1024, y: 0 },
    pressed: { x: 1088, y: 0 }
  },
  [ControlButtonType.Settings]: {
    normal: { x: 1152, y: 0 },
    pressed: { x: 1216, y: 0 }
  },
  [ControlButtonType.Next]: {
    normal: { x: 1280, y: 0 },
    pressed: { x: 1344, y: 0 }
  },
  [ControlButtonType.Confirm]: {
    normal: { x: 1408, y: 0 },
    pressed: { x: 1472, y: 0 }
  },
  [ControlButtonType.Cancel]: {
    normal: { x: 1536, y: 0 },
    pressed: { x: 1600, y: 0 }
  },
  [ControlButtonType.Book]: {
    normal: { x: 1664, y: 0 },
    pressed: { x: 1728, y: 0 }
  },
  [ControlButtonType.Previous]: {
    normal: { x: 1792, y: 0 },
    pressed: { x: 1856, y: 0 }
  }
};
const vibrationAdapter$2 = new VibrationAdapter();
const ControlButton = ({
  type,
  onClick,
  className,
  soundEnabled = true,
  sliderWidth,
  initialSliderValue = 0.5,
  hasCleaningTarget = false,
  onSliderChange,
  onSliderEnd
}) => {
  const [isPressed, setIsPressed] = reactExports.useState(false);
  const [currentSliderValue, setCurrentSliderValue] = reactExports.useState(initialSliderValue);
  const sliderRef = reactExports.useRef(null);
  const sliderControllerRef = reactExports.useRef(null);
  const currentSliderValueRef = reactExports.useRef(initialSliderValue);
  const lastSliderDragValueRef = reactExports.useRef(initialSliderValue);
  const accumulatedDragDistanceRef = reactExports.useRef(0);
  const lastDragDirectionRef = reactExports.useRef(0);
  const hasCleaningTargetRef = reactExports.useRef(hasCleaningTarget);
  const onSliderChangeRef = reactExports.useRef(onSliderChange);
  const onSliderEndRef = reactExports.useRef(onSliderEnd);
  const vibrationStepValueRef = reactExports.useRef(0);
  const isDraggingRef = reactExports.useRef(false);
  const isPressedRef = reactExports.useRef(false);
  const isSlider = type === ControlButtonType.Clean && !!sliderWidth;
  const sliderTrackWidth = sliderWidth ? Math.max(
    0,
    (sliderWidth - SLIDER_THUMB_SIZE) * SLIDER_TRACK_RANGE_MULTIPLIER
  ) : 0;
  const vibrationStepValue = Math.min(
    1,
    SLIDER_DRAG_VIBRATION_STEP_PX / Math.max(1, sliderTrackWidth)
  );
  reactExports.useEffect(() => {
    hasCleaningTargetRef.current = hasCleaningTarget;
    onSliderChangeRef.current = onSliderChange;
    onSliderEndRef.current = onSliderEnd;
    vibrationStepValueRef.current = vibrationStepValue;
  }, [hasCleaningTarget, onSliderChange, onSliderEnd, vibrationStepValue]);
  reactExports.useEffect(() => {
    if (isSlider && sliderRef.current) {
      const controller = new SliderController(sliderRef.current, {
        initialValue: initialSliderValue,
        thumbWidth: SLIDER_THUMB_SIZE,
        rangeMultiplier: SLIDER_INPUT_RANGE_MULTIPLIER,
        onChange: (value) => {
          var _a;
          const signedDelta = value - lastSliderDragValueRef.current;
          const delta = Math.abs(signedDelta);
          const dragDirection = signedDelta > SLIDER_DIRECTION_CHANGE_THRESHOLD ? 1 : signedDelta < -8e-3 ? -1 : 0;
          if (hasCleaningTargetRef.current && dragDirection !== 0) {
            const hasStartedMoving = lastDragDirectionRef.current === 0;
            const hasChangedDirection = lastDragDirectionRef.current !== 0 && dragDirection !== lastDragDirectionRef.current;
            if (hasStartedMoving || hasChangedDirection) {
              if (soundEnabled) {
                playBroomSound();
              }
            }
            if (hasChangedDirection) {
              void vibrationAdapter$2.vibrate(
                SLIDER_DIRECTION_CHANGE_VIBRATION_DURATION,
                SLIDER_DIRECTION_CHANGE_VIBRATION_STRENGTH
              );
            }
          }
          if (dragDirection !== 0) {
            lastDragDirectionRef.current = dragDirection;
          }
          accumulatedDragDistanceRef.current += delta;
          lastSliderDragValueRef.current = value;
          currentSliderValueRef.current = value;
          if (hasCleaningTargetRef.current && accumulatedDragDistanceRef.current >= vibrationStepValueRef.current) {
            accumulatedDragDistanceRef.current %= vibrationStepValueRef.current;
            void vibrationAdapter$2.vibrate(
              SLIDER_DRAG_VIBRATION_DURATION,
              SLIDER_DRAG_VIBRATION_STRENGTH
            );
          }
          setCurrentSliderValue(value);
          (_a = onSliderChangeRef.current) == null ? void 0 : _a.call(onSliderChangeRef, value);
        },
        onDragStart: () => {
          if (soundEnabled) {
            playControlButtonDownSound();
          }
          isDraggingRef.current = true;
          lastSliderDragValueRef.current = currentSliderValueRef.current;
          accumulatedDragDistanceRef.current = 0;
          lastDragDirectionRef.current = 0;
          setIsPressed(true);
        },
        onDragEnd: () => {
          var _a;
          if (soundEnabled) {
            playControlButtonUpSound();
          }
          isDraggingRef.current = false;
          accumulatedDragDistanceRef.current = 0;
          lastDragDirectionRef.current = 0;
          setIsPressed(false);
          (_a = onSliderEndRef.current) == null ? void 0 : _a.call(onSliderEndRef);
          vibrationAdapter$2.vibrate();
        }
      });
      sliderControllerRef.current = controller;
      return () => {
        isDraggingRef.current = false;
        controller.dispose();
        sliderControllerRef.current = null;
      };
    }
  }, [isSlider, soundEnabled]);
  reactExports.useEffect(() => {
    var _a;
    if (isDraggingRef.current) {
      return;
    }
    setCurrentSliderValue(initialSliderValue);
    currentSliderValueRef.current = initialSliderValue;
    lastSliderDragValueRef.current = initialSliderValue;
    accumulatedDragDistanceRef.current = 0;
    lastDragDirectionRef.current = 0;
    (_a = sliderControllerRef.current) == null ? void 0 : _a.setValue(initialSliderValue, {
      emitChange: false
    });
  }, [initialSliderValue]);
  const size = SLIDER_THUMB_SIZE;
  const spriteState = isPressed ? "pressed" : "normal";
  const spriteInfo = spriteInfoMap[type][spriteState];
  const shouldTriggerOnPointerDown = type === ControlButtonType.Jump || type === ControlButtonType.DoubleJump;
  const shouldPlayControlButtonKeySound = !(type === ControlButtonType.Jump || type === ControlButtonType.DoubleJump);
  const handlePointerDown = () => {
    if (!isSlider) {
      isPressedRef.current = true;
      setIsPressed(true);
      if (soundEnabled) {
        if (shouldPlayControlButtonKeySound) {
          playControlButtonDownSound();
        } else if (type === ControlButtonType.Jump) {
          playSmallJumpSound();
        } else if (type === ControlButtonType.DoubleJump) {
          playBigJumpSound();
        }
      }
      if (shouldTriggerOnPointerDown) {
        onClick == null ? void 0 : onClick();
        window.setTimeout(() => {
          void vibrationAdapter$2.vibrate();
        }, 0);
      }
    }
  };
  const handlePointerUp = () => {
    if (!isSlider) {
      const shouldTriggerClick = isPressedRef.current;
      isPressedRef.current = false;
      setIsPressed(false);
      if (soundEnabled && shouldTriggerClick && shouldPlayControlButtonKeySound) {
        playControlButtonUpSound();
      }
      if (shouldTriggerClick && !shouldTriggerOnPointerDown) {
        onClick == null ? void 0 : onClick();
        window.setTimeout(() => {
          void vibrationAdapter$2.vibrate();
        }, 0);
      }
    }
  };
  const handlePointerLeave = () => {
    if (!isSlider && isPressedRef.current) {
      isPressedRef.current = false;
      setIsPressed(false);
      if (soundEnabled && shouldPlayControlButtonKeySound) {
        playControlButtonUpSound();
      }
    }
  };
  const handlePointerCancel = () => {
    if (!isSlider && isPressedRef.current) {
      isPressedRef.current = false;
      setIsPressed(false);
      if (soundEnabled && shouldPlayControlButtonKeySound) {
        playControlButtonUpSound();
      }
    }
  };
  const buttonStyle = {
    width: `${size}px`,
    height: `${size}px`,
    backgroundImage: `url("/assets/ui/sprites/control-buttons.png")`,
    backgroundPosition: `-${spriteInfo.x}px -${spriteInfo.y}px`
  };
  if (isSlider) {
    const trackInset = size / 2;
    const baseTrackWidth = Math.max(0, sliderWidth - size);
    const trackWidth = sliderTrackWidth;
    const extraTrackOffset = (trackWidth - baseTrackWidth) / 2;
    return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
      "div",
      {
        className: "relative flex justify-center overflow-visible",
        style: { width: `${sliderWidth}px`, height: `${size}px` },
        ref: sliderRef,
        children: [
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
            "div",
            {
              className: "absolute top-1/2 -translate-y-1/2 h-4 bg-gray-700 bg-opacity-50 rounded-full",
              style: {
                left: `${trackInset - extraTrackOffset}px`,
                width: `${trackWidth}px`
              }
            },
            void 0,
            false,
            {
              fileName: "/Users/neiz/digivice/apps/client/src/components/ControlButtons/ControlButton.tsx",
              lineNumber: 343,
              columnNumber: 9
            },
            void 0
          ),
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
            "div",
            {
              className: "absolute top-0 left-0 h-full",
              style: {
                transform: `translateX(${currentSliderValue * trackWidth - extraTrackOffset}px)`
              },
              children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                "div",
                {
                  style: buttonStyle,
                  className: "bg-no-repeat border-none bg-transparent p-0 outline-none select-none [-webkit-tap-highlight-color:transparent] scale-[1.4]"
                },
                void 0,
                false,
                {
                  fileName: "/Users/neiz/digivice/apps/client/src/components/ControlButtons/ControlButton.tsx",
                  lineNumber: 356,
                  columnNumber: 11
                },
                void 0
              )
            },
            void 0,
            false,
            {
              fileName: "/Users/neiz/digivice/apps/client/src/components/ControlButtons/ControlButton.tsx",
              lineNumber: 350,
              columnNumber: 9
            },
            void 0
          )
        ]
      },
      void 0,
      true,
      {
        fileName: "/Users/neiz/digivice/apps/client/src/components/ControlButtons/ControlButton.tsx",
        lineNumber: 338,
        columnNumber: 7
      },
      void 0
    );
  }
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
    "button",
    {
      type: "button",
      style: buttonStyle,
      onPointerDown: handlePointerDown,
      onPointerUp: handlePointerUp,
      onPointerLeave: handlePointerLeave,
      onPointerCancel: handlePointerCancel,
      className: `bg-no-repeat border-none bg-transparent p-0 outline-none select-none [-webkit-tap-highlight-color:transparent] scale-[1.4] ${className || ""}`
    },
    void 0,
    false,
    {
      fileName: "/Users/neiz/digivice/apps/client/src/components/ControlButtons/ControlButton.tsx",
      lineNumber: 367,
      columnNumber: 5
    },
    void 0
  );
};
const ControlButtonsContainer = ({
  children
}) => /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "w-4/5 max-w-[300px] flex justify-between mx-auto", children }, void 0, false, {
  fileName: "/Users/neiz/digivice/apps/client/src/components/ControlButtons/index.tsx",
  lineNumber: 17,
  columnNumber: 3
}, void 0);
const CONTROL_BUTTON_SIZE_PX = 64;
const MAX_CONTROL_BUTTONS_WIDTH_PX = 300;
const DEFAULT_CLEAN_SLIDER_WIDTH_PX = (MAX_CONTROL_BUTTONS_WIDTH_PX + CONTROL_BUTTON_SIZE_PX) / 2;
let lastMeasuredCleanSliderWidth = DEFAULT_CLEAN_SLIDER_WIDTH_PX;
const ControlButtons = ({
  buttonParams,
  onButtonPress,
  soundEnabled = true,
  onSliderChange,
  onSliderEnd
}) => {
  const containerRef = reactExports.useRef(null);
  const secondButtonRef = reactExports.useRef(null);
  const thirdButtonRef = reactExports.useRef(null);
  const buttonTypes = buttonParams.map((buttonParam) => buttonParam.type);
  const shouldRenderSlider = buttonTypes.indexOf(ControlButtonType.Clean) !== -1;
  const cleanButtonParam = buttonParams.find(
    (buttonParam) => buttonParam.type === ControlButtonType.Clean
  );
  const [sliderWidth, setSliderWidth] = reactExports.useState(
    () => shouldRenderSlider ? lastMeasuredCleanSliderWidth : void 0
  );
  reactExports.useLayoutEffect(() => {
    if (shouldRenderSlider && secondButtonRef.current && thirdButtonRef.current) {
      const secondButtonLeft = secondButtonRef.current.offsetLeft;
      const thirdButtonLeft = thirdButtonRef.current.offsetLeft;
      const thirdButtonWidth = thirdButtonRef.current.offsetWidth;
      const calculatedWidth = thirdButtonWidth + thirdButtonLeft - secondButtonLeft;
      lastMeasuredCleanSliderWidth = calculatedWidth;
      setSliderWidth(calculatedWidth);
    } else {
      setSliderWidth(void 0);
    }
  }, [buttonTypes[0], buttonTypes[1], buttonTypes[2], shouldRenderSlider]);
  const effectiveSliderWidth = shouldRenderSlider ? sliderWidth ?? lastMeasuredCleanSliderWidth : void 0;
  if (shouldRenderSlider && effectiveSliderWidth) {
    return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(ControlButtonsContainer, { children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { ref: containerRef, className: "flex justify-between w-full", children: [
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "shrink-0 ", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
        ControlButton,
        {
          type: buttonParams[0].type,
          soundEnabled,
          onClick: () => onButtonPress(buttonParams[0].type)
        },
        void 0,
        false,
        {
          fileName: "/Users/neiz/digivice/apps/client/src/components/ControlButtons/index.tsx",
          lineNumber: 83,
          columnNumber: 13
        },
        void 0
      ) }, void 0, false, {
        fileName: "/Users/neiz/digivice/apps/client/src/components/ControlButtons/index.tsx",
        lineNumber: 82,
        columnNumber: 11
      }, void 0),
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { ref: secondButtonRef, children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
        ControlButton,
        {
          type: ControlButtonType.Clean,
          soundEnabled,
          sliderWidth: effectiveSliderWidth,
          initialSliderValue: (cleanButtonParam == null ? void 0 : cleanButtonParam.initialSliderValue) ?? 0.5,
          hasCleaningTarget: (cleanButtonParam == null ? void 0 : cleanButtonParam.hasCleaningTarget) ?? false,
          onSliderChange,
          onSliderEnd,
          onClick: () => onButtonPress(buttonParams[1].type)
        },
        (cleanButtonParam == null ? void 0 : cleanButtonParam.sliderSessionKey) ?? "clean-slider",
        false,
        {
          fileName: "/Users/neiz/digivice/apps/client/src/components/ControlButtons/index.tsx",
          lineNumber: 91,
          columnNumber: 13
        },
        void 0
      ) }, void 0, false, {
        fileName: "/Users/neiz/digivice/apps/client/src/components/ControlButtons/index.tsx",
        lineNumber: 90,
        columnNumber: 11
      }, void 0)
    ] }, void 0, true, {
      fileName: "/Users/neiz/digivice/apps/client/src/components/ControlButtons/index.tsx",
      lineNumber: 80,
      columnNumber: 9
    }, void 0) }, void 0, false, {
      fileName: "/Users/neiz/digivice/apps/client/src/components/ControlButtons/index.tsx",
      lineNumber: 79,
      columnNumber: 7
    }, void 0);
  }
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(ControlButtonsContainer, { children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { ref: containerRef, className: "flex justify-between w-full", children: [
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
      ControlButton,
      {
        type: buttonParams[0].type,
        soundEnabled,
        onClick: () => onButtonPress(buttonParams[0].type)
      },
      void 0,
      false,
      {
        fileName: "/Users/neiz/digivice/apps/client/src/components/ControlButtons/index.tsx",
        lineNumber: 112,
        columnNumber: 9
      },
      void 0
    ),
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { ref: secondButtonRef, children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
      ControlButton,
      {
        type: buttonParams[1].type,
        soundEnabled,
        onClick: () => onButtonPress(buttonParams[1].type)
      },
      void 0,
      false,
      {
        fileName: "/Users/neiz/digivice/apps/client/src/components/ControlButtons/index.tsx",
        lineNumber: 118,
        columnNumber: 11
      },
      void 0
    ) }, void 0, false, {
      fileName: "/Users/neiz/digivice/apps/client/src/components/ControlButtons/index.tsx",
      lineNumber: 117,
      columnNumber: 9
    }, void 0),
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { ref: thirdButtonRef, children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
      ControlButton,
      {
        type: buttonParams[2].type,
        soundEnabled,
        onClick: () => onButtonPress(buttonParams[2].type)
      },
      void 0,
      false,
      {
        fileName: "/Users/neiz/digivice/apps/client/src/components/ControlButtons/index.tsx",
        lineNumber: 125,
        columnNumber: 11
      },
      void 0
    ) }, void 0, false, {
      fileName: "/Users/neiz/digivice/apps/client/src/components/ControlButtons/index.tsx",
      lineNumber: 124,
      columnNumber: 9
    }, void 0)
  ] }, void 0, true, {
    fileName: "/Users/neiz/digivice/apps/client/src/components/ControlButtons/index.tsx",
    lineNumber: 111,
    columnNumber: 7
  }, void 0) }, void 0, false, {
    fileName: "/Users/neiz/digivice/apps/client/src/components/ControlButtons/index.tsx",
    lineNumber: 110,
    columnNumber: 5
  }, void 0);
};
function createClientStorage() {
  if (hasNativeStorageController()) {
    return new FlutterStorage();
  }
  return new WebLocalStorage();
}
function getClientStorageKind() {
  return hasNativeStorageController() ? "native" : "web";
}
const DIAGNOSTICS_LOGS_STORAGE_KEY = "DiagnosticsLogs";
const DIAGNOSTICS_IMPORTANT_LOGS_STORAGE_KEY = "DiagnosticsImportantLogs";
const DIAGNOSTICS_LOGS_MAX_TOTAL_BYTES = 100 * 1024;
const DIAGNOSTICS_IMPORTANT_LOGS_MAX_TOTAL_BYTES = 128 * 1024;
const DIAGNOSTICS_LOG_ENTRY_MAX_BYTES = 8 * 1024;
const DIAGNOSTICS_LOGS_PERSIST_DEBOUNCE_MS = 2e3;
const DIAGNOSTICS_LOGS_RECENT_WINDOW_MS = 10 * 60 * 1e3;
const ELLIPSIS = "…";
const IMPORTANT_DIAGNOSTICS_PREFIX = "[ImportantDiagnostics]";
const NATIVE_DEBUG_LOG_PREFIXES = [
  IMPORTANT_DIAGNOSTICS_PREFIX,
  "[GameTransition]",
  "[Game]",
  "[MainSceneWorld]",
  "[GameContainer]",
  "[SceneTransition",
  "[BackNavigation]",
  "[FlappyBird",
  "PixiJS Warning:"
];
const NATIVE_DEBUG_LOG_ARG_MAX_BYTES = 2 * 1024;
const textEncoder = new TextEncoder();
const diagnosticsSessionId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const diagnosticsSessionStartedAt = Date.now();
let diagnosticsContextProvider = null;
let diagnosticsLogs = [];
let diagnosticsLogsTotalBytes = 2;
let diagnosticsImportantLogs = [];
let diagnosticsImportantLogsTotalBytes = 2;
let diagnosticsLoggerInitialized = false;
let diagnosticsConsoleInstalled = false;
let persistenceInFlight = null;
let persistTimeoutId = null;
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};
function syncWindowErrorLogs() {
  if (typeof window === "undefined") {
    return;
  }
  window.errorLogs = diagnosticsLogs.map(({ entry }) => {
    const versionTag = formatDiagnosticsVersionTag(
      entry.appVersion,
      entry.buildNumber
    );
    return [
      `[${entry.timestamp}]`,
      `[${entry.level}]`,
      versionTag,
      entry.message
    ].filter(Boolean).join(" ");
  });
}
function formatDiagnosticsVersionTag(appVersion, buildNumber) {
  if (typeof appVersion !== "string" || appVersion.trim().length === 0) {
    return null;
  }
  if (typeof buildNumber === "number" && Number.isInteger(buildNumber) && buildNumber > 0) {
    return `[${appVersion}+${buildNumber}]`;
  }
  return `[${appVersion}]`;
}
function isImportantDiagnosticsMessage(level, message) {
  return level === "error" || message.includes(IMPORTANT_DIAGNOSTICS_PREFIX);
}
function shouldSkipDiagnosticsLog(level, message) {
  if (level === "error") {
    return false;
  }
  const stablePatterns = [
    "서비스 초기화 완료",
    "User Agent:",
    "Environment variables:",
    "애플리케이션 모드:",
    "애플리케이션 버전:",
    "현재 플랫폼:",
    "[bootstrap] Native storage controller is ready",
    "[App] AdManager initialized with policies:"
  ];
  return stablePatterns.some((pattern) => message.includes(pattern));
}
function shouldMirrorDiagnosticsLogToNative(level, message, forceImportant) {
  var _a;
  if (typeof window === "undefined") {
    return false;
  }
  if (typeof ((_a = window.nativeDebugLogger) == null ? void 0 : _a.log) !== "function") {
    return false;
  }
  if (forceImportant || level === "error" || level === "warn") {
    return true;
  }
  return NATIVE_DEBUG_LOG_PREFIXES.some((prefix) => message.includes(prefix));
}
function toByteLength(value) {
  return textEncoder.encode(value).length;
}
function safeStringify(value) {
  const seen = /* @__PURE__ */ new WeakSet();
  try {
    return JSON.stringify(
      value,
      (_, currentValue) => {
        if (currentValue instanceof Error) {
          return {
            name: currentValue.name,
            message: currentValue.message,
            stack: currentValue.stack
          };
        }
        if (typeof currentValue === "object" && currentValue !== null) {
          if (seen.has(currentValue)) {
            return "[Circular]";
          }
          seen.add(currentValue);
        }
        return currentValue;
      },
      2
    );
  } catch {
    return String(value);
  }
}
function stringifyConsoleArg(arg) {
  if (typeof arg === "string") {
    return arg;
  }
  if (arg instanceof Error) {
    return [arg.name ? `${arg.name}: ${arg.message}` : arg.message, arg.stack].filter(Boolean).join("\n");
  }
  return safeStringify(arg);
}
function getCallerSource() {
  var _a;
  try {
    const stackLines = (_a = new Error().stack) == null ? void 0 : _a.split("\n");
    if (!stackLines) {
      return "unknown";
    }
    const callerLine = stackLines.find(
      (line) => !line.includes("diagnosticLogger") && line.includes("at ")
    );
    if (!callerLine) {
      return "unknown";
    }
    const callSite = callerLine.trim();
    const match = callSite.match(/at\s+.*\((.*):(\d+):(\d+)\)/);
    if (match) {
      const [, filePath, line] = match;
      const fileName = filePath.split("/").pop() ?? filePath;
      return `${fileName}:${line}`;
    }
    const fallbackMatch = callSite.match(/at\s+(.*):(\d+):(\d+)/);
    if (fallbackMatch) {
      const [, filePath, line] = fallbackMatch;
      const fileName = filePath.split("/").pop() ?? filePath;
      return `${fileName}:${line}`;
    }
  } catch {
    return "unknown";
  }
  return "unknown";
}
function truncateToByteLength(value, maxBytes) {
  if (maxBytes <= 0) {
    return "";
  }
  if (toByteLength(value) <= maxBytes) {
    return value;
  }
  const ellipsisBytes = toByteLength(ELLIPSIS);
  if (maxBytes <= ellipsisBytes) {
    return ELLIPSIS;
  }
  let low = 0;
  let high = value.length;
  let best = "";
  const allowedBytes = maxBytes - ellipsisBytes;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = value.slice(0, mid);
    if (toByteLength(candidate) <= allowedBytes) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return `${best}${ELLIPSIS}`;
}
function truncateEntryToLimit(entry) {
  const baseEntry = {
    ...entry,
    message: ""
  };
  const baseBytes = toByteLength(JSON.stringify(baseEntry));
  const allowedMessageBytes = Math.max(
    DIAGNOSTICS_LOG_ENTRY_MAX_BYTES - baseBytes,
    toByteLength(ELLIPSIS)
  );
  return {
    ...entry,
    message: truncateToByteLength(entry.message, allowedMessageBytes)
  };
}
function getSerializedLogsByteLength(logs) {
  if (logs.length === 0) {
    return 2;
  }
  const entriesBytes = logs.reduce((sum, log) => sum + log.byteSize, 0);
  return entriesBytes + (logs.length - 1) + 2;
}
function createLogRecord(entry) {
  const serialized = JSON.stringify(entry);
  return {
    entry,
    serialized,
    byteSize: toByteLength(serialized)
  };
}
function trimLogsToSize(logs) {
  return trimRegularLogsToSize(logs);
}
function trimImportantLogsToSize(logs) {
  return trimLogsToSizeWithLimit(
    logs,
    DIAGNOSTICS_IMPORTANT_LOGS_MAX_TOTAL_BYTES,
    (total) => {
      diagnosticsImportantLogsTotalBytes = total;
    }
  );
}
function trimLogsToSizeWithLimit(logs, maxTotalBytes, onTotalBytes) {
  const nextLogs = [...logs];
  let totalBytes = getSerializedLogsByteLength(nextLogs);
  while (nextLogs.length > 0 && totalBytes > maxTotalBytes) {
    const removed = nextLogs.shift();
    if (!removed) {
      break;
    }
    totalBytes -= removed.byteSize;
    totalBytes -= nextLogs.length > 0 ? 1 : 2;
  }
  onTotalBytes(getSerializedLogsByteLength(nextLogs));
  return nextLogs;
}
function getDiagnosticsLogTimestampMs(log) {
  const timestampMs = Date.parse(log.entry.timestamp);
  return Number.isFinite(timestampMs) ? timestampMs : null;
}
function trimRegularLogsToSize(logs) {
  let nextLogs = [...logs];
  let totalBytes = getSerializedLogsByteLength(nextLogs);
  if (totalBytes > DIAGNOSTICS_LOGS_MAX_TOTAL_BYTES) {
    const recentThreshold = Date.now() - DIAGNOSTICS_LOGS_RECENT_WINDOW_MS;
    nextLogs = nextLogs.filter((log) => {
      const timestampMs = getDiagnosticsLogTimestampMs(log);
      return timestampMs === null || timestampMs >= recentThreshold;
    });
    totalBytes = getSerializedLogsByteLength(nextLogs);
  }
  while (nextLogs.length > 0 && totalBytes > DIAGNOSTICS_LOGS_MAX_TOTAL_BYTES) {
    const removed = nextLogs.shift();
    if (!removed) {
      break;
    }
    totalBytes -= removed.byteSize;
    totalBytes -= nextLogs.length > 0 ? 1 : 2;
  }
  diagnosticsLogsTotalBytes = getSerializedLogsByteLength(nextLogs);
  return nextLogs;
}
function mirrorDiagnosticsLogToNative(entry, args, options) {
  var _a;
  if (!shouldMirrorDiagnosticsLogToNative(
    entry.level,
    entry.message,
    (options == null ? void 0 : options.forceImportant) === true
  )) {
    return;
  }
  const payload = {
    tag: "WebConsole",
    timestamp: entry.timestamp,
    level: entry.level,
    source: entry.source,
    scene: entry.scene ?? null,
    sessionId: entry.sessionId,
    appMode: entry.appMode ?? null,
    appVersion: entry.appVersion ?? null,
    buildNumber: entry.buildNumber ?? null,
    debugEnabled: entry.debugEnabled ?? null,
    storageKind: entry.storageKind,
    timeSinceSessionStartMs: entry.timeSinceSessionStartMs,
    important: (options == null ? void 0 : options.forceImportant) === true || isImportantDiagnosticsMessage(entry.level, entry.message),
    message: entry.message,
    args: args.map(
      (arg) => truncateToByteLength(stringifyConsoleArg(arg), NATIVE_DEBUG_LOG_ARG_MAX_BYTES)
    )
  };
  try {
    (_a = window.nativeDebugLogger) == null ? void 0 : _a.log(payload);
  } catch {
  }
}
function normalizePersistedLogs(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const record = entry;
    if (typeof record.timestamp !== "string" || typeof record.level !== "string" || typeof record.message !== "string" || typeof record.sessionId !== "string" || typeof record.source !== "string" || typeof record.timeSinceSessionStartMs !== "number" || record.storageKind !== "native" && record.storageKind !== "web") {
      return null;
    }
    return createLogRecord(
      truncateEntryToLimit({
        id: typeof record.id === "string" ? record.id : `${record.timestamp}-${record.level}`,
        timestamp: record.timestamp,
        level: record.level,
        message: record.message,
        sessionId: record.sessionId,
        source: record.source,
        timeSinceSessionStartMs: record.timeSinceSessionStartMs,
        scene: typeof record.scene === "string" ? record.scene : void 0,
        storageKind: record.storageKind,
        appMode: typeof record.appMode === "string" ? record.appMode : void 0,
        appVersion: typeof record.appVersion === "string" ? record.appVersion : void 0,
        buildNumber: typeof record.buildNumber === "number" && Number.isInteger(record.buildNumber) ? record.buildNumber : void 0,
        debugEnabled: typeof record.debugEnabled === "boolean" ? record.debugEnabled : void 0
      })
    );
  }).filter((entry) => entry !== null);
}
function getDiagnosticsContext() {
  return (diagnosticsContextProvider == null ? void 0 : diagnosticsContextProvider()) ?? {};
}
function queuePersist() {
  if (!diagnosticsLoggerInitialized) {
    return;
  }
  if (persistTimeoutId !== null) {
    window.clearTimeout(persistTimeoutId);
  }
  persistTimeoutId = window.setTimeout(() => {
    persistTimeoutId = null;
    void persistDiagnosticsLogs();
  }, DIAGNOSTICS_LOGS_PERSIST_DEBOUNCE_MS);
}
async function persistDiagnosticsLogs() {
  if (!diagnosticsLoggerInitialized) {
    return;
  }
  if (persistenceInFlight) {
    await persistenceInFlight;
    return;
  }
  persistenceInFlight = (async () => {
    try {
      const storage = createClientStorage();
      await Promise.all([
        storage.setData(
          DIAGNOSTICS_LOGS_STORAGE_KEY,
          diagnosticsLogs.map((log) => log.entry)
        ),
        storage.setData(
          DIAGNOSTICS_IMPORTANT_LOGS_STORAGE_KEY,
          diagnosticsImportantLogs.map((log) => log.entry)
        )
      ]);
    } catch (error) {
      originalConsole.error(
        "[diagnosticLogger] Failed to persist diagnostics logs",
        error
      );
    } finally {
      persistenceInFlight = null;
    }
  })();
  await persistenceInFlight;
}
function appendDiagnosticsLog(level, args, options) {
  const context = getDiagnosticsContext();
  const message = args.map(stringifyConsoleArg).join(" ");
  if (!(options == null ? void 0 : options.forceImportant) && shouldSkipDiagnosticsLog(level, message)) {
    return;
  }
  const entry = truncateEntryToLimit({
    id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    level,
    message,
    sessionId: diagnosticsSessionId,
    source: getCallerSource(),
    timeSinceSessionStartMs: Date.now() - diagnosticsSessionStartedAt,
    scene: context.scene,
    storageKind: context.storageKind ?? getClientStorageKind(),
    appMode: context.appMode,
    appVersion: context.appVersion,
    buildNumber: context.buildNumber,
    debugEnabled: context.debugEnabled
  });
  const record = createLogRecord(entry);
  diagnosticsLogs = trimLogsToSize([...diagnosticsLogs, record]);
  if ((options == null ? void 0 : options.forceImportant) || isImportantDiagnosticsMessage(level, message)) {
    diagnosticsImportantLogs = trimImportantLogsToSize([
      ...diagnosticsImportantLogs,
      record
    ]);
  }
  syncWindowErrorLogs();
  mirrorDiagnosticsLogToNative(entry, args, options);
  queuePersist();
}
function installDiagnosticsConsoleCapture() {
  if (diagnosticsConsoleInstalled) {
    return;
  }
  diagnosticsConsoleInstalled = true;
  console.log = (...args) => {
    appendDiagnosticsLog("log", args);
    originalConsole.log(...args);
  };
  console.warn = (...args) => {
    appendDiagnosticsLog("warn", args);
    originalConsole.warn(...args);
  };
  console.error = (...args) => {
    appendDiagnosticsLog("error", args);
    originalConsole.error(...args);
  };
}
async function initializeDiagnosticsLogger() {
  if (diagnosticsLoggerInitialized) {
    return;
  }
  diagnosticsLoggerInitialized = true;
  try {
    const storage = createClientStorage();
    const [persistedLogsRaw, persistedImportantLogsRaw] = await Promise.all([
      storage.getData(DIAGNOSTICS_LOGS_STORAGE_KEY),
      storage.getData(DIAGNOSTICS_IMPORTANT_LOGS_STORAGE_KEY)
    ]);
    const persistedLogs = normalizePersistedLogs(persistedLogsRaw);
    const persistedImportantLogs = normalizePersistedLogs(
      persistedImportantLogsRaw
    );
    diagnosticsLogs = trimLogsToSize([...persistedLogs, ...diagnosticsLogs]);
    diagnosticsImportantLogs = trimImportantLogsToSize([
      ...persistedImportantLogs,
      ...diagnosticsImportantLogs
    ]);
    syncWindowErrorLogs();
  } catch (error) {
    originalConsole.error(
      "[diagnosticLogger] Failed to initialize diagnostics logger",
      error
    );
  }
}
function getDiagnosticsLogs() {
  return diagnosticsLogs.map((log) => log.entry);
}
function getImportantDiagnosticsLogs() {
  return diagnosticsImportantLogs.map((log) => log.entry);
}
function getDiagnosticsLoggerInfo() {
  return {
    sessionId: diagnosticsSessionId,
    totalBytes: diagnosticsLogsTotalBytes,
    entryCount: diagnosticsLogs.length,
    maxTotalBytes: DIAGNOSTICS_LOGS_MAX_TOTAL_BYTES,
    maxEntryBytes: DIAGNOSTICS_LOG_ENTRY_MAX_BYTES,
    importantTotalBytes: diagnosticsImportantLogsTotalBytes,
    importantEntryCount: diagnosticsImportantLogs.length,
    importantMaxTotalBytes: DIAGNOSTICS_IMPORTANT_LOGS_MAX_TOTAL_BYTES
  };
}
function setDiagnosticsContextProvider(provider) {
  diagnosticsContextProvider = provider;
}
function logImportantDiagnostics(level, ...args) {
  appendDiagnosticsLog(level, args, { forceImportant: true });
  switch (level) {
    case "warn":
      originalConsole.warn(...args);
      return;
    case "error":
      originalConsole.error(...args);
      return;
    default:
      originalConsole.log(...args);
  }
}
const I18nContext = reactExports.createContext(null);
const I18nProvider = ({
  children
}) => {
  const [locale, setLocaleState] = reactExports.useState(
    () => getGameSettings().locale ?? DEFAULT_LOCALE
  );
  const setLocale = reactExports.useCallback((nextLocale) => {
    updateGameSettings({ locale: nextLocale });
    setLocaleState(nextLocale);
  }, []);
  const t = reactExports.useCallback(
    (key, params) => translate(locale, key, params),
    [locale]
  );
  reactExports.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const value = reactExports.useMemo(
    () => ({
      locale,
      setLocale,
      t
    }),
    [locale, setLocale, t]
  );
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(I18nContext.Provider, { value, children }, void 0, false, {
    fileName: "/Users/neiz/digivice/apps/client/src/i18n.tsx",
    lineNumber: 58,
    columnNumber: 10
  }, void 0);
};
function useI18n() {
  const context = reactExports.useContext(I18nContext);
  if (!context) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {
      },
      t: (key, params) => translate(DEFAULT_LOCALE, key, params)
    };
  }
  return context;
}
const CLICK_VIBRATION_SELECTOR = [
  "button",
  "[role='button']",
  "a[href]",
  "input[type='button']",
  "input[type='submit']",
  "input[type='reset']",
  "input[type='checkbox']",
  "input[type='radio']"
].join(", ");
const FOCUS_VIBRATION_SELECTOR = [
  "input:not([type='button']):not([type='submit']):not([type='reset']):not([type='checkbox']):not([type='radio'])",
  "textarea",
  "select"
].join(", ");
const vibrationAdapter$1 = new VibrationAdapter();
function findClosestInteractiveElement(target, selector) {
  if (!(target instanceof Element)) {
    return null;
  }
  const matchedElement = target.closest(selector);
  return matchedElement instanceof HTMLElement ? matchedElement : null;
}
function isDisabledInteractiveElement(element) {
  if (element.matches(":disabled")) {
    return true;
  }
  if (element.getAttribute("aria-disabled") === "true") {
    return true;
  }
  return false;
}
function useLayerInteractionVibration() {
  const handleClickCapture = reactExports.useCallback(
    (event) => {
      const interactiveElement = findClosestInteractiveElement(
        event.target,
        CLICK_VIBRATION_SELECTOR
      );
      if (!interactiveElement || isDisabledInteractiveElement(interactiveElement)) {
        return;
      }
      void vibrationAdapter$1.vibrate();
    },
    []
  );
  const handleFocusCapture = reactExports.useCallback(
    (event) => {
      const interactiveElement = findClosestInteractiveElement(
        event.target,
        FOCUS_VIBRATION_SELECTOR
      );
      if (!interactiveElement || isDisabledInteractiveElement(interactiveElement)) {
        return;
      }
      if (interactiveElement instanceof HTMLInputElement || interactiveElement instanceof HTMLTextAreaElement) {
        if (interactiveElement.readOnly) {
          return;
        }
      }
      void vibrationAdapter$1.vibrate();
    },
    []
  );
  return {
    onClickCapture: handleClickCapture,
    onFocusCapture: handleFocusCapture
  };
}
const popupBackHandlerStack = [];
const POPUP_BACK_EVENT_NAME = "digivice:native-back-request";
let isPopupBackEventListenerInstalled = false;
let isPopupBackBridgeInstalled = false;
function reportPopupBackHandlerError(error) {
  logImportantDiagnostics(
    "error",
    "[ImportantDiagnostics][PopupBackNavigation] Failed to handle popup back navigation.",
    error
  );
  console.warn(
    "[PopupBackNavigation] Failed to handle popup back navigation.",
    error
  );
}
function registerPopupBackHandler(getHandler) {
  const registration = {
    id: Symbol("popupBackHandler"),
    getHandler
  };
  popupBackHandlerStack.push(registration);
  return () => {
    const index = popupBackHandlerStack.findIndex(
      (candidate) => candidate.id === registration.id
    );
    if (index >= 0) {
      popupBackHandlerStack.splice(index, 1);
    }
  };
}
function consumeTopPopupBackHandler() {
  var _a;
  for (let index = popupBackHandlerStack.length - 1; index >= 0; index -= 1) {
    const handler = (_a = popupBackHandlerStack[index]) == null ? void 0 : _a.getHandler();
    if (!handler) {
      continue;
    }
    try {
      void Promise.resolve(handler()).catch(reportPopupBackHandlerError);
    } catch (error) {
      reportPopupBackHandlerError(error);
    }
    return true;
  }
  return false;
}
function installPopupBackEventListener() {
  if (typeof window === "undefined" || isPopupBackEventListenerInstalled) {
    return;
  }
  isPopupBackEventListenerInstalled = true;
  window.addEventListener(POPUP_BACK_EVENT_NAME, (event) => {
    if (consumeTopPopupBackHandler()) {
      event.preventDefault();
    }
  });
}
function installPopupBackBridge() {
  if (typeof window === "undefined" || isPopupBackBridgeInstalled) {
    return;
  }
  isPopupBackBridgeInstalled = true;
  window.digivicePopupBackBridge = {
    handleBackNavigation: consumeTopPopupBackHandler
  };
}
installPopupBackEventListener();
installPopupBackBridge();
const KEYBOARD_VIEWPORT_HEIGHT_DELTA_THRESHOLD$1 = 80;
const KEYBOARD_AWARE_DEBUG_LOG_LIMIT = 24;
const CONFIRM_ENABLE_DELAY_PROGRESS_MAX = 100;
function roundKeyboardAwareDebugValue(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 100) / 100;
}
const PopupLayer = ({
  title,
  titleContent,
  content,
  topLeftContent,
  dividerBorderClassName = "border-[#222]",
  onConfirm,
  onCancel,
  onBack,
  confirmText,
  cancelText,
  confirmDisabled = false,
  confirmVariant = "positive",
  cancelVariant = "negative",
  initialFocusTarget = "none",
  keyboardAwareTargetRef,
  keyboardAwareViewportPadding = 16,
  suppressInitialActionsMs = 0,
  confirmEnableDelayMs = 0,
  showActions = true
}) => {
  const { t } = useI18n();
  const resolvedTitle = title ?? t("alert.title");
  const resolvedConfirmText = confirmText ?? t("common.confirm");
  const resolvedCancelText = cancelText ?? t("common.cancel");
  const layerInteractionVibrationProps = useLayerInteractionVibration();
  const containerRef = reactExports.useRef(null);
  const confirmButtonRef = reactExports.useRef(null);
  const cancelButtonRef = reactExports.useRef(null);
  const confirmEnableDelayRafIdRef = reactExports.useRef(null);
  const keyboardAwareRafIdRef = reactExports.useRef(null);
  const keyboardAwareOffsetYRef = reactExports.useRef(0);
  const keyboardAwareMaxHeightRef = reactExports.useRef(null);
  const keyboardAwareWasVisibleRef = reactExports.useRef(false);
  const keyboardAwareDebugSequenceRef = reactExports.useRef(0);
  const nativeKeyboardInsetRef = reactExports.useRef(0);
  const suppressInitialActionsUntilRef = reactExports.useRef(0);
  const backHandlerRef = reactExports.useRef(onBack ?? null);
  const [confirmEnableDelayProgress, setConfirmEnableDelayProgress] = reactExports.useState(
    confirmEnableDelayMs > 0 ? 0 : CONFIRM_ENABLE_DELAY_PROGRESS_MAX
  );
  const [keyboardAwareOffsetY, setKeyboardAwareOffsetY] = reactExports.useState(0);
  const [keyboardAwareMaxHeight, setKeyboardAwareMaxHeight] = reactExports.useState(null);
  const isConfirmEnableDelayActive = !confirmDisabled && confirmEnableDelayMs > 0 && confirmEnableDelayProgress < CONFIRM_ENABLE_DELAY_PROGRESS_MAX;
  const isConfirmButtonDisabled = confirmDisabled || isConfirmEnableDelayActive;
  const effectiveInitialFocusTargetRef = reactExports.useRef(
    confirmEnableDelayMs > 0 && initialFocusTarget === "confirm" ? "container" : initialFocusTarget
  );
  const effectiveInitialFocusTarget = effectiveInitialFocusTargetRef.current;
  const isBackHandlerEnabled = typeof onBack === "function";
  reactExports.useEffect(() => {
    playUiPopSound();
  }, []);
  reactExports.useLayoutEffect(() => {
    backHandlerRef.current = onBack ?? null;
  }, [onBack]);
  reactExports.useLayoutEffect(() => {
    if (!isBackHandlerEnabled) {
      return;
    }
    return registerPopupBackHandler(() => backHandlerRef.current);
  }, [isBackHandlerEnabled]);
  reactExports.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (confirmEnableDelayRafIdRef.current !== null) {
      window.cancelAnimationFrame(confirmEnableDelayRafIdRef.current);
      confirmEnableDelayRafIdRef.current = null;
    }
    if (confirmEnableDelayMs <= 0) {
      setConfirmEnableDelayProgress(CONFIRM_ENABLE_DELAY_PROGRESS_MAX);
      return;
    }
    if (confirmDisabled) {
      setConfirmEnableDelayProgress(0);
      return;
    }
    setConfirmEnableDelayProgress(0);
    const startedAt = window.performance.now();
    const tick = (timestamp) => {
      const elapsed = Math.max(0, timestamp - startedAt);
      const nextProgress = Math.min(
        CONFIRM_ENABLE_DELAY_PROGRESS_MAX,
        Math.round(
          elapsed / confirmEnableDelayMs * CONFIRM_ENABLE_DELAY_PROGRESS_MAX
        )
      );
      setConfirmEnableDelayProgress(
        (previous) => previous === nextProgress ? previous : nextProgress
      );
      if (nextProgress >= CONFIRM_ENABLE_DELAY_PROGRESS_MAX) {
        confirmEnableDelayRafIdRef.current = null;
        return;
      }
      confirmEnableDelayRafIdRef.current = window.requestAnimationFrame(tick);
    };
    confirmEnableDelayRafIdRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (confirmEnableDelayRafIdRef.current !== null) {
        window.cancelAnimationFrame(confirmEnableDelayRafIdRef.current);
        confirmEnableDelayRafIdRef.current = null;
      }
    };
  }, [confirmDisabled, confirmEnableDelayMs]);
  const emitKeyboardAwareDebug = reactExports.useCallback(
    (stage, payload = {}) => {
      if (resolvedTitle !== t("settings.title")) {
        return;
      }
      if (keyboardAwareDebugSequenceRef.current >= KEYBOARD_AWARE_DEBUG_LOG_LIMIT) {
        return;
      }
      keyboardAwareDebugSequenceRef.current += 1;
      logImportantDiagnostics(
        "warn",
        "[ImportantDiagnostics][PopupLayerKeyboardAware]",
        {
          title: resolvedTitle,
          stage,
          sequence: keyboardAwareDebugSequenceRef.current,
          ...payload
        }
      );
    },
    [resolvedTitle, t]
  );
  const resetKeyboardAwareLayout = reactExports.useCallback(
    (reason) => {
      emitKeyboardAwareDebug("reset", {
        reason,
        offsetY: keyboardAwareOffsetYRef.current,
        maxHeight: keyboardAwareMaxHeightRef.current,
        wasVisible: keyboardAwareWasVisibleRef.current
      });
      keyboardAwareOffsetYRef.current = 0;
      keyboardAwareMaxHeightRef.current = null;
      keyboardAwareWasVisibleRef.current = false;
      setKeyboardAwareOffsetY((previous) => previous === 0 ? previous : 0);
      setKeyboardAwareMaxHeight(
        (previous) => previous === null ? previous : null
      );
    },
    [emitKeyboardAwareDebug]
  );
  const updateKeyboardAwareLayout = reactExports.useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    const popupElement = containerRef.current;
    const targetElement = keyboardAwareTargetRef == null ? void 0 : keyboardAwareTargetRef.current;
    const visualViewport = window.visualViewport;
    if (!popupElement || !targetElement || !visualViewport) {
      emitKeyboardAwareDebug("missing_primitives", {
        hasPopupElement: !!popupElement,
        hasTargetElement: !!targetElement,
        hasVisualViewport: !!visualViewport
      });
      resetKeyboardAwareLayout("missing_primitives");
      return;
    }
    const activeElement = document.activeElement;
    const nativeKeyboardInset = Math.max(0, nativeKeyboardInsetRef.current);
    const baseViewportHeight = Math.max(
      window.innerHeight,
      document.documentElement.clientHeight || 0,
      nativeKeyboardInset > 0 ? visualViewport.height + nativeKeyboardInset : 0
    );
    const viewportHeightDelta = baseViewportHeight - visualViewport.height;
    const isKeyboardVisible = nativeKeyboardInset > 0 || viewportHeightDelta >= KEYBOARD_VIEWPORT_HEIGHT_DELTA_THRESHOLD$1;
    if (activeElement !== targetElement) {
      emitKeyboardAwareDebug("inactive_target", {
        activeElementTag: activeElement instanceof HTMLElement ? activeElement.tagName : null,
        targetTag: targetElement.tagName
      });
      resetKeyboardAwareLayout("inactive_target");
      return;
    }
    if (!isKeyboardVisible) {
      emitKeyboardAwareDebug("keyboard_hidden", {
        nativeKeyboardInset,
        viewportHeightDelta: roundKeyboardAwareDebugValue(viewportHeightDelta)
      });
      resetKeyboardAwareLayout("keyboard_hidden");
      return;
    }
    if (!keyboardAwareWasVisibleRef.current) {
      emitKeyboardAwareDebug("keyboard_visible_enter", {
        nativeKeyboardInset,
        viewportHeightDelta: roundKeyboardAwareDebugValue(viewportHeightDelta),
        scrollTop: popupElement.scrollTop
      });
      keyboardAwareWasVisibleRef.current = true;
    }
    const visibleTop = visualViewport.offsetTop;
    const visibleBottom = visualViewport.offsetTop + visualViewport.height;
    const availableHeight = Math.max(
      0,
      visualViewport.height - keyboardAwareViewportPadding * 2
    );
    if (keyboardAwareMaxHeightRef.current !== availableHeight) {
      keyboardAwareMaxHeightRef.current = availableHeight;
    }
    setKeyboardAwareMaxHeight(
      (previous) => previous === availableHeight ? previous : availableHeight
    );
    const popupRect = popupElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const currentOffsetY = keyboardAwareOffsetYRef.current;
    const currentLayoutTop = popupRect.top - currentOffsetY;
    const currentLayoutBottom = popupRect.bottom - currentOffsetY;
    const currentTargetCenterY = targetRect.top + targetRect.height / 2 - currentOffsetY;
    const desiredCenterY = visibleTop + visualViewport.height / 2;
    const desiredShift = desiredCenterY - currentTargetCenterY;
    const minShift = visibleTop + keyboardAwareViewportPadding - currentLayoutTop;
    const maxShift = visibleBottom - keyboardAwareViewportPadding - currentLayoutBottom;
    const clampedShift = minShift <= maxShift ? Math.min(Math.max(desiredShift, minShift), maxShift) : Math.min(Math.max(desiredShift, maxShift), minShift);
    const roundedShift = Math.round(clampedShift);
    keyboardAwareOffsetYRef.current = roundedShift;
    emitKeyboardAwareDebug("layout_applied", {
      nativeKeyboardInset,
      viewportHeightDelta: roundKeyboardAwareDebugValue(viewportHeightDelta),
      visibleTop: roundKeyboardAwareDebugValue(visibleTop),
      visibleBottom: roundKeyboardAwareDebugValue(visibleBottom),
      availableHeight: roundKeyboardAwareDebugValue(availableHeight),
      popupTop: roundKeyboardAwareDebugValue(popupRect.top),
      popupBottom: roundKeyboardAwareDebugValue(popupRect.bottom),
      targetTop: roundKeyboardAwareDebugValue(targetRect.top),
      targetBottom: roundKeyboardAwareDebugValue(targetRect.bottom),
      scrollTop: popupElement.scrollTop,
      currentOffsetY,
      currentLayoutTop: roundKeyboardAwareDebugValue(currentLayoutTop),
      currentTargetCenterY: roundKeyboardAwareDebugValue(currentTargetCenterY),
      desiredShift: roundKeyboardAwareDebugValue(desiredShift),
      minShift: roundKeyboardAwareDebugValue(minShift),
      maxShift: roundKeyboardAwareDebugValue(maxShift),
      roundedShift
    });
    setKeyboardAwareOffsetY(
      (previous) => previous === roundedShift ? previous : roundedShift
    );
  }, [
    emitKeyboardAwareDebug,
    keyboardAwareTargetRef,
    keyboardAwareViewportPadding,
    resetKeyboardAwareLayout
  ]);
  const scheduleKeyboardAwareLayoutUpdate = reactExports.useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (keyboardAwareRafIdRef.current !== null) {
      window.cancelAnimationFrame(keyboardAwareRafIdRef.current);
    }
    keyboardAwareRafIdRef.current = window.requestAnimationFrame(() => {
      keyboardAwareRafIdRef.current = null;
      updateKeyboardAwareLayout();
    });
  }, [updateKeyboardAwareLayout]);
  reactExports.useLayoutEffect(() => {
    suppressInitialActionsUntilRef.current = Date.now() + Math.max(0, suppressInitialActionsMs);
    return () => {
      suppressInitialActionsUntilRef.current = 0;
    };
  }, [suppressInitialActionsMs]);
  reactExports.useLayoutEffect(() => {
    const focusTarget = effectiveInitialFocusTarget === "confirm" ? confirmButtonRef.current : effectiveInitialFocusTarget === "cancel" ? cancelButtonRef.current : effectiveInitialFocusTarget === "container" ? containerRef.current : null;
    if (!focusTarget) {
      return;
    }
    const rafId = window.requestAnimationFrame(() => {
      emitKeyboardAwareDebug("initial_focus", {
        focusTargetTag: focusTarget.tagName,
        initialFocusTarget: effectiveInitialFocusTarget
      });
      focusTarget.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [effectiveInitialFocusTarget, emitKeyboardAwareDebug]);
  reactExports.useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const targetElement = keyboardAwareTargetRef == null ? void 0 : keyboardAwareTargetRef.current;
    const visualViewport = window.visualViewport;
    if (!targetElement || !visualViewport) {
      emitKeyboardAwareDebug("effect_missing_target", {
        hasTargetElement: !!targetElement,
        hasVisualViewport: !!visualViewport
      });
      resetKeyboardAwareLayout("effect_missing_target");
      return;
    }
    emitKeyboardAwareDebug("effect_attached", {
      targetTag: targetElement.tagName,
      initialFocusTarget: effectiveInitialFocusTarget
    });
    const handleKeyboardAwareLayoutChange = (source) => {
      var _a;
      emitKeyboardAwareDebug("schedule", {
        source,
        scrollTop: ((_a = containerRef.current) == null ? void 0 : _a.scrollTop) ?? null,
        offsetY: keyboardAwareOffsetYRef.current,
        maxHeight: keyboardAwareMaxHeightRef.current
      });
      scheduleKeyboardAwareLayoutUpdate();
    };
    const handleNativeViewportSync = (event) => {
      const detail = event.detail;
      nativeKeyboardInsetRef.current = Math.max(0, (detail == null ? void 0 : detail.bottomInset) ?? 0);
      emitKeyboardAwareDebug("native_viewport_sync", {
        bottomInset: nativeKeyboardInsetRef.current,
        visualViewportHeight: roundKeyboardAwareDebugValue(
          visualViewport.height
        ),
        visualViewportOffsetTop: roundKeyboardAwareDebugValue(
          visualViewport.offsetTop
        )
      });
      scheduleKeyboardAwareLayoutUpdate();
    };
    const handleTargetFocus = () => {
      handleKeyboardAwareLayoutChange("target_focus");
    };
    const handleTargetBlur = () => {
      handleKeyboardAwareLayoutChange("target_blur");
    };
    const handleWindowResize = () => {
      handleKeyboardAwareLayoutChange("window_resize");
    };
    const handleVisualViewportResize = () => {
      handleKeyboardAwareLayoutChange("visual_viewport_resize");
    };
    const handleVisualViewportScroll = () => {
      handleKeyboardAwareLayoutChange("visual_viewport_scroll");
    };
    targetElement.addEventListener("focus", handleTargetFocus);
    targetElement.addEventListener("blur", handleTargetBlur);
    window.addEventListener(
      "digivice:native-viewport-sync",
      handleNativeViewportSync
    );
    window.addEventListener("resize", handleWindowResize);
    visualViewport.addEventListener("resize", handleVisualViewportResize);
    visualViewport.addEventListener("scroll", handleVisualViewportScroll);
    handleKeyboardAwareLayoutChange("effect_attached");
    return () => {
      targetElement.removeEventListener("focus", handleTargetFocus);
      targetElement.removeEventListener("blur", handleTargetBlur);
      window.removeEventListener(
        "digivice:native-viewport-sync",
        handleNativeViewportSync
      );
      window.removeEventListener("resize", handleWindowResize);
      visualViewport.removeEventListener("resize", handleVisualViewportResize);
      visualViewport.removeEventListener("scroll", handleVisualViewportScroll);
      if (keyboardAwareRafIdRef.current !== null) {
        window.cancelAnimationFrame(keyboardAwareRafIdRef.current);
        keyboardAwareRafIdRef.current = null;
      }
      nativeKeyboardInsetRef.current = 0;
      resetKeyboardAwareLayout("effect_cleanup");
    };
  }, [
    effectiveInitialFocusTarget,
    emitKeyboardAwareDebug,
    keyboardAwareTargetRef,
    resetKeyboardAwareLayout,
    scheduleKeyboardAwareLayoutUpdate
  ]);
  const handleConfirmClick = reactExports.useCallback(() => {
    if (isConfirmButtonDisabled || Date.now() < suppressInitialActionsUntilRef.current) {
      return;
    }
    onConfirm == null ? void 0 : onConfirm();
  }, [isConfirmButtonDisabled, onConfirm]);
  const handleCancelClick = reactExports.useCallback(() => {
    if (Date.now() < suppressInitialActionsUntilRef.current) {
      return;
    }
    onCancel == null ? void 0 : onCancel();
  }, [onCancel]);
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
    "div",
    {
      className: "flex w-full justify-center px-4 text-black",
      ...layerInteractionVibrationProps,
      children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
        "div",
        {
          ref: containerRef,
          tabIndex: -1,
          style: {
            transform: keyboardAwareOffsetY !== 0 ? `translateY(${keyboardAwareOffsetY}px)` : void 0,
            maxHeight: keyboardAwareMaxHeight !== null ? `${keyboardAwareMaxHeight}px` : void 0
          },
          className: "i18n-word-wrap relative flex w-full max-w-[22rem] flex-col overflow-auto border-4 border-[#222] bg-layer-bg p-5 text-center font-dialog shadow-[0_4px_0_#222,0_-4px_0_#222,4px_0_0_#222,-4px_0_0_#222,4px_4px_0_#222,-4px_4px_0_#222,4px_-4px_0_#222,-4px_-4px_0_#222] focus:outline-none",
          children: [
            topLeftContent ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "absolute left-2 top-2 z-[1]", children: topLeftContent }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/components/PopupLayer/index.tsx",
              lineNumber: 557,
              columnNumber: 11
            }, void 0) : null,
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
              "div",
              {
                className: `mb-[15px] flex-none border-b-4 pb-[10px] text-[1.8rem] leading-[1.2] font-display font-bold text-component-negative ${dividerBorderClassName}`,
                children: titleContent ?? resolvedTitle
              },
              void 0,
              false,
              {
                fileName: "/Users/neiz/digivice/apps/client/src/components/PopupLayer/index.tsx",
                lineNumber: 559,
                columnNumber: 9
              },
              void 0
            ),
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "min-h-0 flex-1 overflow-y-auto pb-4 text-[1.4rem] leading-[1.6]", children: content }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/components/PopupLayer/index.tsx",
              lineNumber: 564,
              columnNumber: 9
            }, void 0),
            showActions && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
              "div",
              {
                className: `flex flex-none flex-wrap justify-center gap-[15px] border-t-4 pt-4 ${dividerBorderClassName}`,
                children: [
                  onCancel && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                    "button",
                    {
                      ref: cancelButtonRef,
                      type: "button",
                      onClick: handleCancelClick,
                      className: `text-[1.5rem] text-white border-2 border-[#222] px-[15px] py-0.5 cursor-pointer uppercase font-display shadow-[2px_2px_0_#222] relative top-0 left-0 transition-all duration-50 ${cancelVariant === "negative" ? "bg-component-negative" : "bg-component-positive"}`,
                      children: resolvedCancelText
                    },
                    void 0,
                    false,
                    {
                      fileName: "/Users/neiz/digivice/apps/client/src/components/PopupLayer/index.tsx",
                      lineNumber: 572,
                      columnNumber: 15
                    },
                    void 0
                  ),
                  /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                    "button",
                    {
                      ref: confirmButtonRef,
                      type: "button",
                      disabled: isConfirmButtonDisabled,
                      onClick: handleConfirmClick,
                      className: `relative overflow-hidden text-[1.5rem] text-white border-2 border-[#222] px-[15px] py-0.5 uppercase font-display shadow-[2px_2px_0_#222] ${isConfirmButtonDisabled ? "cursor-not-allowed bg-gray-400 opacity-80" : confirmVariant === "negative" ? "cursor-pointer bg-component-negative" : "cursor-pointer bg-component-positive"}`,
                      children: [
                        isConfirmEnableDelayActive && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                          "span",
                          {
                            "aria-hidden": "true",
                            className: `absolute inset-y-0 left-0 ${confirmVariant === "negative" ? "bg-component-negative" : "bg-component-positive"}`,
                            style: { width: `${confirmEnableDelayProgress}%` }
                          },
                          void 0,
                          false,
                          {
                            fileName: "/Users/neiz/digivice/apps/client/src/components/PopupLayer/index.tsx",
                            lineNumber: 599,
                            columnNumber: 17
                          },
                          void 0
                        ),
                        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { className: "relative z-[1]", children: resolvedConfirmText }, void 0, false, {
                          fileName: "/Users/neiz/digivice/apps/client/src/components/PopupLayer/index.tsx",
                          lineNumber: 609,
                          columnNumber: 15
                        }, void 0)
                      ]
                    },
                    void 0,
                    true,
                    {
                      fileName: "/Users/neiz/digivice/apps/client/src/components/PopupLayer/index.tsx",
                      lineNumber: 585,
                      columnNumber: 13
                    },
                    void 0
                  )
                ]
              },
              void 0,
              true,
              {
                fileName: "/Users/neiz/digivice/apps/client/src/components/PopupLayer/index.tsx",
                lineNumber: 568,
                columnNumber: 11
              },
              void 0
            )
          ]
        },
        void 0,
        true,
        {
          fileName: "/Users/neiz/digivice/apps/client/src/components/PopupLayer/index.tsx",
          lineNumber: 541,
          columnNumber: 7
        },
        void 0
      )
    },
    void 0,
    false,
    {
      fileName: "/Users/neiz/digivice/apps/client/src/components/PopupLayer/index.tsx",
      lineNumber: 537,
      columnNumber: 5
    },
    void 0
  );
};
const MIN_NAME_LENGTH = 2;
const SETUP_NAME_MAX_WIDTH = 55;
const SetupLayer = ({ onComplete }) => {
  const { t } = useI18n();
  const [name, setName] = reactExports.useState("");
  const [error, setError] = reactExports.useState(null);
  const nameInputRef = reactExports.useRef(null);
  const trimmedName = name.trim();
  const nameLength = countDisplayCharacters(trimmedName);
  const nameWidth = measureNameLabelWidth(trimmedName);
  const isWithinVisibleWidth = fitsNameLabelWidth(
    trimmedName,
    SETUP_NAME_MAX_WIDTH
  );
  const handleConfirm = () => {
    if (!trimmedName) {
      setError(t("setup.error.emptyName"));
      return;
    }
    if (nameLength < MIN_NAME_LENGTH) {
      setError(t("setup.error.minLength", { minLength: MIN_NAME_LENGTH }));
      return;
    }
    if (!isWithinVisibleWidth) {
      setError(
        t("setup.error.maxWidth", { maxWidth: SETUP_NAME_MAX_WIDTH })
      );
      return;
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onComplete({
      name: trimmedName,
      useLocalTime: true,
      cachedSunTimes: null
    });
  };
  const overlay = /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "fixed inset-0 z-[999] overflow-y-auto bg-black/50", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex min-h-dvh items-center justify-center p-4", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
    PopupLayer,
    {
      title: t("setup.title"),
      keyboardAwareTargetRef: nameInputRef,
      dividerBorderClassName: "border-[#555]",
      content: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex flex-col items-center gap-4", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "w-full", children: [
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
          "input",
          {
            ref: nameInputRef,
            type: "text",
            value: name,
            onChange: (e) => {
              setName(e.target.value);
              setError(null);
            },
            placeholder: t("setup.placeholder.name"),
            className: "w-full border-2 border-[#222] px-3 py-0.5 text-center text-[1.4rem] focus:outline-none focus:ring-2 focus:ring-[#d95763]"
          },
          void 0,
          false,
          {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/SetupLayer.tsx",
            lineNumber: 78,
            columnNumber: 17
          },
          void 0
        ),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
          "div",
          {
            className: `mt-2 text-[1.2rem] ${isWithinVisibleWidth ? "text-gray-600" : "text-red-600"}`,
            children: t("setup.nameWidth", {
              width: Math.round(nameWidth),
              maxWidth: SETUP_NAME_MAX_WIDTH
            })
          },
          void 0,
          false,
          {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/SetupLayer.tsx",
            lineNumber: 89,
            columnNumber: 17
          },
          void 0
        ),
        error && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { className: "mt-4 text-component-negative text-[0.7em]", children: error }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/layers/SetupLayer.tsx",
          lineNumber: 100,
          columnNumber: 19
        }, void 0)
      ] }, void 0, true, {
        fileName: "/Users/neiz/digivice/apps/client/src/layers/SetupLayer.tsx",
        lineNumber: 77,
        columnNumber: 15
      }, void 0) }, void 0, false, {
        fileName: "/Users/neiz/digivice/apps/client/src/layers/SetupLayer.tsx",
        lineNumber: 76,
        columnNumber: 13
      }, void 0),
      onConfirm: handleConfirm,
      confirmText: t("setup.start")
    },
    void 0,
    false,
    {
      fileName: "/Users/neiz/digivice/apps/client/src/layers/SetupLayer.tsx",
      lineNumber: 71,
      columnNumber: 9
    },
    void 0
  ) }, void 0, false, {
    fileName: "/Users/neiz/digivice/apps/client/src/layers/SetupLayer.tsx",
    lineNumber: 70,
    columnNumber: 7
  }, void 0) }, void 0, false, {
    fileName: "/Users/neiz/digivice/apps/client/src/layers/SetupLayer.tsx",
    lineNumber: 69,
    columnNumber: 5
  }, void 0);
  if (typeof document === "undefined") {
    return overlay;
  }
  return reactDomExports.createPortal(overlay, document.body);
};
const AlertLayer = ({
  title,
  message,
  onClose,
  onCancel,
  onBack,
  confirmText,
  cancelText
}) => {
  const { t } = useI18n();
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
    PopupLayer,
    {
      title: title ?? t("alert.title"),
      content: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex flex-col items-center gap-4", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("p", { className: "leading-[1.6]", children: message }, void 0, false, {
        fileName: "/Users/neiz/digivice/apps/client/src/layers/AlertLayer.tsx",
        lineNumber: 32,
        columnNumber: 13
      }, void 0) }, void 0, false, {
        fileName: "/Users/neiz/digivice/apps/client/src/layers/AlertLayer.tsx",
        lineNumber: 31,
        columnNumber: 11
      }, void 0),
      onConfirm: onClose,
      onCancel,
      onBack,
      confirmText: confirmText ?? t("common.confirm"),
      cancelText: cancelText ?? t("common.cancel")
    },
    void 0,
    false,
    {
      fileName: "/Users/neiz/digivice/apps/client/src/layers/AlertLayer.tsx",
      lineNumber: 28,
      columnNumber: 7
    },
    void 0
  ) }, void 0, false, {
    fileName: "/Users/neiz/digivice/apps/client/src/layers/AlertLayer.tsx",
    lineNumber: 27,
    columnNumber: 5
  }, void 0);
};
const FLAPPY_BIRD_GAME_OVER_FONT_FAMILY = '"NeoDunggeunmo Pro", "Droid Sans Mono", "SF Mono", monospace, sans-serif';
const vibrationAdapter = new VibrationAdapter();
const FlappyBirdGameOverLayer = ({
  onRestart,
  onExit
}) => {
  const { t } = useI18n();
  const handleExitClick = () => {
    void vibrationAdapter.vibrate();
    onExit();
  };
  const handleRestartClick = () => {
    void vibrationAdapter.vibrate();
    onRestart();
  };
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "absolute inset-0 z-[50] flex items-center justify-center bg-black/50", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex w-full max-w-[22rem] flex-col items-center gap-5 px-4 text-center text-white", children: [
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
      "div",
      {
        className: "text-[2.25rem] font-bold tracking-[0.12em] uppercase drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]",
        style: { fontFamily: FLAPPY_BIRD_GAME_OVER_FONT_FAMILY },
        children: t("flappy.gameOver")
      },
      void 0,
      false,
      {
        fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdGameOverLayer.tsx",
        lineNumber: 34,
        columnNumber: 9
      },
      void 0
    ),
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex justify-center gap-[15px]", children: [
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
        "button",
        {
          type: "button",
          onClick: handleExitClick,
          className: "text-[1.5rem] bg-component-negative text-white border-2 border-[#222] px-[15px] py-0.5 cursor-pointer uppercase shadow-[2px_2px_0_#222] relative top-0 left-0 transition-all duration-50",
          children: t("flappy.exit")
        },
        void 0,
        false,
        {
          fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdGameOverLayer.tsx",
          lineNumber: 41,
          columnNumber: 11
        },
        void 0
      ),
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
        "button",
        {
          type: "button",
          onClick: handleRestartClick,
          className: "text-[1.5rem] bg-component-positive text-white border-2 border-[#222] px-[15px] py-0.5 cursor-pointer uppercase shadow-[2px_2px_0_#222]",
          children: t("flappy.retry")
        },
        void 0,
        false,
        {
          fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdGameOverLayer.tsx",
          lineNumber: 48,
          columnNumber: 11
        },
        void 0
      )
    ] }, void 0, true, {
      fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdGameOverLayer.tsx",
      lineNumber: 40,
      columnNumber: 9
    }, void 0)
  ] }, void 0, true, {
    fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdGameOverLayer.tsx",
    lineNumber: 33,
    columnNumber: 7
  }, void 0) }, void 0, false, {
    fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdGameOverLayer.tsx",
    lineNumber: 32,
    columnNumber: 5
  }, void 0);
};
const FLAPPY_BIRD_OPEN_SOURCE_NOTICE = {
  name: "Neo둥근모 Pro",
  lines: [
    "Copyright © 2017-2024, Eunbin Jeong (Dalgona.) <project-neodgm@dalgona.dev>",
    'with reserved font name "Neo둥근모 Pro" and "NeoDunggeunmo Pro".'
  ]
};
const ToggleButton$1 = ({ enabled, onClick }) => {
  const { t } = useI18n();
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
    "button",
    {
      type: "button",
      onClick,
      className: `ml-auto min-w-20 shrink-0 border-2 border-[#222] px-4 py-0.5 font-bold text-white ${enabled ? "bg-component-positive" : "bg-gray-400"}`,
      children: enabled ? t("common.on") : t("common.off")
    },
    void 0,
    false,
    {
      fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
      lineNumber: 42,
      columnNumber: 5
    },
    void 0
  );
};
const ActionButton$1 = ({ text, onClick, disabled = false, variant = "positive" }) => {
  const backgroundClass = disabled ? "cursor-wait bg-gray-400 opacity-60" : variant === "warning" ? "bg-yellow-500" : variant === "negative" ? "bg-component-negative" : "bg-component-positive";
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
    "button",
    {
      type: "button",
      disabled,
      onClick,
      className: `ml-auto flex min-w-20 shrink-0 items-center justify-center border-2 border-[#222] px-4 py-0.5 text-center font-bold text-white ${backgroundClass}`,
      children: text
    },
    void 0,
    false,
    {
      fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
      lineNumber: 69,
      columnNumber: 5
    },
    void 0
  );
};
const SelectButton = ({ active, label, onClick }) => {
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
    "button",
    {
      type: "button",
      onClick,
      className: `border-2 border-[#222] px-3 py-0.5 font-bold ${active ? "bg-component-positive text-white" : "bg-white text-[#222]"}`,
      children: label
    },
    void 0,
    false,
    {
      fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
      lineNumber: 86,
      columnNumber: 5
    },
    void 0
  );
};
const DevModeBadge$1 = () => /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { className: "border-2 border-[#222] bg-yellow-300 px-2 py-0.5 text-[0.85rem] uppercase leading-none text-[#222]", children: "Dev Mode" }, void 0, false, {
  fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
  lineNumber: 99,
  columnNumber: 3
}, void 0);
const FlappyBirdSettingsLayer = ({
  isBgmEnabled,
  isSfxEnabled: isSfxEnabled2,
  onChangeBgm,
  onChangeSfx,
  selectedTimeOfDay,
  onSelectTimeOfDay,
  onResume,
  onExit
}) => {
  const { locale, t } = useI18n();
  const [showOpenSourceNotice, setShowOpenSourceNotice] = reactExports.useState(false);
  const shouldShowSkySelector = selectedTimeOfDay !== void 0 && onSelectTimeOfDay !== void 0;
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "fixed inset-0 z-[50] flex items-center justify-center bg-black/50", children: [
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
      PopupLayer,
      {
        title: t("settings.title"),
        suppressInitialActionsMs: 180,
        content: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex flex-col gap-5 text-left text-[1.5rem]", children: [
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex flex-col gap-4", children: [
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "min-w-0 flex-1", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "font-bold", children: t("flappy.bgm") }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
                lineNumber: 132,
                columnNumber: 19
              }, void 0) }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
                lineNumber: 131,
                columnNumber: 17
              }, void 0),
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                ToggleButton$1,
                {
                  enabled: isBgmEnabled,
                  onClick: () => onChangeBgm(!isBgmEnabled)
                },
                void 0,
                false,
                {
                  fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
                  lineNumber: 136,
                  columnNumber: 17
                },
                void 0
              )
            ] }, void 0, true, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
              lineNumber: 130,
              columnNumber: 15
            }, void 0),
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "min-w-0 flex-1", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "font-bold", children: t("flappy.sfx") }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
                lineNumber: 143,
                columnNumber: 19
              }, void 0) }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
                lineNumber: 142,
                columnNumber: 17
              }, void 0),
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                ToggleButton$1,
                {
                  enabled: isSfxEnabled2,
                  onClick: () => onChangeSfx(!isSfxEnabled2)
                },
                void 0,
                false,
                {
                  fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
                  lineNumber: 147,
                  columnNumber: 17
                },
                void 0
              )
            ] }, void 0, true, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
              lineNumber: 141,
              columnNumber: 15
            }, void 0)
          ] }, void 0, true, {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
            lineNumber: 129,
            columnNumber: 13
          }, void 0),
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "border-t-2 border-[#222] pt-4", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "min-w-0 flex-1 font-bold", children: t("flappy.openSource") }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
              lineNumber: 156,
              columnNumber: 17
            }, void 0),
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
              ActionButton$1,
              {
                text: t("common.view"),
                onClick: () => setShowOpenSourceNotice(true)
              },
              void 0,
              false,
              {
                fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
                lineNumber: 159,
                columnNumber: 17
              },
              void 0
            )
          ] }, void 0, true, {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
            lineNumber: 155,
            columnNumber: 15
          }, void 0) }, void 0, false, {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
            lineNumber: 154,
            columnNumber: 13
          }, void 0),
          shouldShowSkySelector ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "border-t-2 border-[#222] pt-4", children: [
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "mb-3 flex flex-wrap items-center gap-2 font-bold", children: [
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: t("flappy.skyDev") }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
                lineNumber: 169,
                columnNumber: 19
              }, void 0),
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(DevModeBadge$1, {}, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
                lineNumber: 170,
                columnNumber: 19
              }, void 0)
            ] }, void 0, true, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
              lineNumber: 168,
              columnNumber: 17
            }, void 0),
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "grid grid-cols-2 gap-2", children: TIME_OF_DAY_OPTIONS.map((timeOfDay) => /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
              SelectButton,
              {
                active: selectedTimeOfDay === timeOfDay,
                label: getTimeOfDayLabel(timeOfDay, locale),
                onClick: () => onSelectTimeOfDay(timeOfDay)
              },
              timeOfDay,
              false,
              {
                fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
                lineNumber: 174,
                columnNumber: 21
              },
              void 0
            )) }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
              lineNumber: 172,
              columnNumber: 17
            }, void 0)
          ] }, void 0, true, {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
            lineNumber: 167,
            columnNumber: 15
          }, void 0) : null
        ] }, void 0, true, {
          fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
          lineNumber: 128,
          columnNumber: 11
        }, void 0),
        onConfirm: onResume,
        onCancel: onExit,
        onBack: onResume,
        confirmText: t("flappy.resume"),
        cancelText: t("flappy.exit"),
        initialFocusTarget: "confirm"
      },
      void 0,
      false,
      {
        fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
        lineNumber: 124,
        columnNumber: 7
      },
      void 0
    ),
    showOpenSourceNotice && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "fixed inset-0 z-[60] flex items-center justify-center bg-black/50", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
      PopupLayer,
      {
        title: t("flappy.openSource"),
        content: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "text-left text-[1rem] leading-[1.4]", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "space-y-1 leading-[1.35]", children: [
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "break-all font-bold", children: FLAPPY_BIRD_OPEN_SOURCE_NOTICE.name }, void 0, false, {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
            lineNumber: 200,
            columnNumber: 19
          }, void 0),
          FLAPPY_BIRD_OPEN_SOURCE_NOTICE.lines.map((line) => /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
            "div",
            {
              className: "break-all text-[0.95rem] text-gray-600",
              children: line
            },
            line,
            false,
            {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
              lineNumber: 204,
              columnNumber: 21
            },
            void 0
          ))
        ] }, void 0, true, {
          fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
          lineNumber: 199,
          columnNumber: 17
        }, void 0) }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
          lineNumber: 198,
          columnNumber: 15
        }, void 0),
        onConfirm: () => setShowOpenSourceNotice(false),
        onBack: () => setShowOpenSourceNotice(false),
        confirmText: t("common.close")
      },
      void 0,
      false,
      {
        fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
        lineNumber: 195,
        columnNumber: 11
      },
      void 0
    ) }, void 0, false, {
      fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
      lineNumber: 194,
      columnNumber: 9
    }, void 0)
  ] }, void 0, true, {
    fileName: "/Users/neiz/digivice/apps/client/src/layers/FlappyBirdSettingsLayer.tsx",
    lineNumber: 123,
    columnNumber: 5
  }, void 0);
};
const STAMINA_LOW_COLOR = "#E2554B";
const STAMINA_MID_COLOR = "#F2A33A";
const STAMINA_HIGH_COLOR = "#49A95D";
const EVOLUTION_FILL_COLOR = "#59B8FF";
const MONSTER_INFO_TITLE_KEY = "monsterInfo.title";
const DOM_NAME_LABEL_STROKE_WIDTH = Math.max(1, NAME_LABEL_STROKE_WIDTH / 2);
function colorNumberToCssHex(color) {
  return `#${color.toString(16).padStart(6, "0")}`;
}
function createNameLabelTextShadow(strokeColor, strokeWidth) {
  const shadowOffsets = /* @__PURE__ */ new Set();
  for (let offset = 1; offset <= strokeWidth; offset += 1) {
    shadowOffsets.add(`${offset}px 0 ${strokeColor}`);
    shadowOffsets.add(`-${offset}px 0 ${strokeColor}`);
    shadowOffsets.add(`0 ${offset}px ${strokeColor}`);
    shadowOffsets.add(`0 -${offset}px ${strokeColor}`);
    shadowOffsets.add(`${offset}px ${offset}px ${strokeColor}`);
    shadowOffsets.add(`-${offset}px ${offset}px ${strokeColor}`);
    shadowOffsets.add(`${offset}px -${offset}px ${strokeColor}`);
    shadowOffsets.add(`-${offset}px -${offset}px ${strokeColor}`);
  }
  return Array.from(shadowOffsets).join(", ");
}
function splitMonsterInfoTitleTemplate(locale) {
  var _a;
  const template = ((_a = TRANSLATIONS[locale]) == null ? void 0 : _a[MONSTER_INFO_TITLE_KEY]) ?? TRANSLATIONS[DEFAULT_LOCALE][MONSTER_INFO_TITLE_KEY];
  const placeholderIndex = template.indexOf("{name}");
  if (placeholderIndex < 0) {
    return {
      hasNamePlaceholder: false,
      before: template,
      after: ""
    };
  }
  return {
    hasNamePlaceholder: true,
    before: template.slice(0, placeholderIndex),
    after: template.slice(placeholderIndex + "{name}".length)
  };
}
function clampUnitInterval(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}
function getStaminaFillColor(snapshot) {
  if (snapshot.stamina < snapshot.unhappyThreshold) {
    return STAMINA_LOW_COLOR;
  }
  if (snapshot.stamina < snapshot.boostedThreshold) {
    return STAMINA_MID_COLOR;
  }
  return STAMINA_HIGH_COLOR;
}
const StatusBar = ({ label, currentValue, maxValue, fillColor }) => {
  const percent = clampUnitInterval(
    maxValue > 0 ? currentValue / maxValue : 0
  );
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex flex-col gap-2 text-left", children: [
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "text-[1.2rem] leading-[1.2] text-[#222]", children: label }, void 0, false, {
      fileName: "/Users/neiz/digivice/apps/client/src/layers/MonsterInfoLayer.tsx",
      lineNumber: 99,
      columnNumber: 7
    }, void 0),
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
      "div",
      {
        role: "meter",
        "aria-label": label,
        "aria-valuemin": 0,
        "aria-valuemax": maxValue,
        "aria-valuenow": Math.max(0, currentValue),
        className: "h-5 overflow-hidden border-2 border-[#222] bg-[#6f6f6f] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)]",
        children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
          "div",
          {
            className: "h-full border-r-2 border-[#222]/25 transition-[width] duration-150 ease-linear",
            style: {
              width: `${percent * 100}%`,
              backgroundColor: fillColor
            }
          },
          void 0,
          false,
          {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/MonsterInfoLayer.tsx",
            lineNumber: 108,
            columnNumber: 9
          },
          void 0
        )
      },
      void 0,
      false,
      {
        fileName: "/Users/neiz/digivice/apps/client/src/layers/MonsterInfoLayer.tsx",
        lineNumber: 100,
        columnNumber: 7
      },
      void 0
    )
  ] }, void 0, true, {
    fileName: "/Users/neiz/digivice/apps/client/src/layers/MonsterInfoLayer.tsx",
    lineNumber: 98,
    columnNumber: 5
  }, void 0);
};
const NameTitleText = ({ text, fillColor, strokeColor }) => {
  const nameTitleTextStyle = {
    fontFamily: NAME_LABEL_FONT_FAMILIES.map(
      (fontFamily) => fontFamily.includes(" ") ? `"${fontFamily}"` : fontFamily
    ).join(", "),
    fontWeight: NAME_LABEL_FONT_WEIGHT
  };
  const nameTitleOutlineStyle = {
    ...nameTitleTextStyle,
    color: "transparent",
    textShadow: createNameLabelTextShadow(
      strokeColor,
      DOM_NAME_LABEL_STROKE_WIDTH
    )
  };
  const nameTitleFillStyle = {
    ...nameTitleTextStyle,
    color: fillColor
  };
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { className: "relative inline-block align-baseline", children: [
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { "aria-hidden": "true", className: "opacity-0", style: nameTitleFillStyle, children: text }, void 0, false, {
      fileName: "/Users/neiz/digivice/apps/client/src/layers/MonsterInfoLayer.tsx",
      lineNumber: 148,
      columnNumber: 7
    }, void 0),
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
      "span",
      {
        "aria-hidden": "true",
        className: "pointer-events-none absolute inset-0",
        style: nameTitleOutlineStyle,
        children: text
      },
      void 0,
      false,
      {
        fileName: "/Users/neiz/digivice/apps/client/src/layers/MonsterInfoLayer.tsx",
        lineNumber: 151,
        columnNumber: 7
      },
      void 0
    ),
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
      "span",
      {
        className: "pointer-events-none absolute inset-0",
        style: nameTitleFillStyle,
        children: text
      },
      void 0,
      false,
      {
        fileName: "/Users/neiz/digivice/apps/client/src/layers/MonsterInfoLayer.tsx",
        lineNumber: 158,
        columnNumber: 7
      },
      void 0
    )
  ] }, void 0, true, {
    fileName: "/Users/neiz/digivice/apps/client/src/layers/MonsterInfoLayer.tsx",
    lineNumber: 147,
    columnNumber: 5
  }, void 0);
};
const MonsterInfoLayer = ({
  snapshot,
  onClose,
  onBack
}) => {
  const { locale, t } = useI18n();
  const levelText = snapshot.isEgg ? t("monsterInfo.levelEgg") : t("monsterInfo.levelPhase", { phase: snapshot.evolutionPhase });
  const titleText = t(MONSTER_INFO_TITLE_KEY, { name: snapshot.monsterName });
  const titleTemplate = splitMonsterInfoTitleTemplate(locale);
  const nameLabelFillColor = colorNumberToCssHex(NAME_LABEL_FILL_COLOR);
  const nameLabelStrokeColor = colorNumberToCssHex(NAME_LABEL_STROKE_COLOR);
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "fixed inset-0 z-[60] flex items-center justify-center bg-black/50", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
    PopupLayer,
    {
      title: titleText,
      titleContent: titleTemplate.hasNamePlaceholder ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(jsxDevRuntimeExports.Fragment, { children: [
        titleTemplate.before,
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
          NameTitleText,
          {
            text: snapshot.monsterName,
            fillColor: nameLabelFillColor,
            strokeColor: nameLabelStrokeColor
          },
          void 0,
          false,
          {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/MonsterInfoLayer.tsx",
            lineNumber: 196,
            columnNumber: 15
          },
          void 0
        ),
        titleTemplate.after
      ] }, void 0, true, {
        fileName: "/Users/neiz/digivice/apps/client/src/layers/MonsterInfoLayer.tsx",
        lineNumber: 194,
        columnNumber: 13
      }, void 0) : titleText,
      content: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex flex-col gap-5 px-5 text-left", children: [
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex items-end justify-between gap-3", children: [
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "text-[1.2rem] leading-[1.2] text-[#222]", children: t("monsterInfo.level") }, void 0, false, {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/MonsterInfoLayer.tsx",
            lineNumber: 210,
            columnNumber: 15
          }, void 0),
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "text-[1.3rem] leading-none font-bold text-component-positive", children: levelText }, void 0, false, {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/MonsterInfoLayer.tsx",
            lineNumber: 213,
            columnNumber: 15
          }, void 0)
        ] }, void 0, true, {
          fileName: "/Users/neiz/digivice/apps/client/src/layers/MonsterInfoLayer.tsx",
          lineNumber: 209,
          columnNumber: 13
        }, void 0),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
          StatusBar,
          {
            label: t("monsterInfo.stamina"),
            currentValue: snapshot.stamina,
            maxValue: snapshot.maxStamina,
            fillColor: getStaminaFillColor(snapshot)
          },
          void 0,
          false,
          {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/MonsterInfoLayer.tsx",
            lineNumber: 217,
            columnNumber: 13
          },
          void 0
        ),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
          StatusBar,
          {
            label: t("monsterInfo.evolution"),
            currentValue: snapshot.evolutionGauge,
            maxValue: snapshot.maxEvolutionGauge,
            fillColor: EVOLUTION_FILL_COLOR
          },
          void 0,
          false,
          {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/MonsterInfoLayer.tsx",
            lineNumber: 223,
            columnNumber: 13
          },
          void 0
        )
      ] }, void 0, true, {
        fileName: "/Users/neiz/digivice/apps/client/src/layers/MonsterInfoLayer.tsx",
        lineNumber: 208,
        columnNumber: 11
      }, void 0),
      onConfirm: onClose,
      onBack: onBack ?? onClose,
      confirmText: t("common.close")
    },
    void 0,
    false,
    {
      fileName: "/Users/neiz/digivice/apps/client/src/layers/MonsterInfoLayer.tsx",
      lineNumber: 190,
      columnNumber: 7
    },
    void 0
  ) }, void 0, false, {
    fileName: "/Users/neiz/digivice/apps/client/src/layers/MonsterInfoLayer.tsx",
    lineNumber: 189,
    columnNumber: 5
  }, void 0);
};
const RESET_CONFIRM_CODE_LENGTH = 6;
const RESET_CONFIRM_CODE_INDEXES = Array.from(
  { length: RESET_CONFIRM_CODE_LENGTH },
  (_, index) => index
);
const ToggleButton = ({ enabled, onClick }) => {
  const { t } = useI18n();
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
    "button",
    {
      type: "button",
      onClick,
      className: `ml-auto min-w-20 shrink-0 border-2 border-[#222] px-4 py-0.5 font-bold text-white ${enabled ? "bg-component-positive" : "bg-gray-400"}`,
      children: enabled ? t("common.on") : t("common.off")
    },
    void 0,
    false,
    {
      fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
      lineNumber: 55,
      columnNumber: 5
    },
    void 0
  );
};
const ActionButton = ({
  text,
  onClick,
  disabled = false,
  variant = "positive",
  snapshotAction
}) => {
  const backgroundClass = disabled ? "cursor-wait bg-gray-400 opacity-60" : variant === "warning" ? "bg-yellow-500" : variant === "negative" ? "bg-component-negative" : "bg-component-positive";
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
    "button",
    {
      type: "button",
      disabled,
      onClick,
      "data-snapshot-action": snapshotAction,
      className: `ml-auto flex min-w-20 shrink-0 items-center justify-center border-2 border-[#222] px-4 py-0.5 text-center font-bold text-white ${backgroundClass}`,
      children: text
    },
    void 0,
    false,
    {
      fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
      lineNumber: 89,
      columnNumber: 5
    },
    void 0
  );
};
const DevModeBadge = () => /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { className: "border-2 border-[#222] bg-yellow-300 px-2 py-0.5 text-[0.85rem] uppercase leading-none text-[#222]", children: "Dev Mode" }, void 0, false, {
  fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
  lineNumber: 102,
  columnNumber: 3
}, void 0);
const LanguageButton = ({ locale, active, onClick }) => {
  const meta = LOCALE_METADATA[locale];
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
    "button",
    {
      type: "button",
      onClick,
      className: `border-2 border-[#222] px-2 py-0.5 text-[1rem] font-bold ${active ? "bg-component-positive text-white" : "bg-white text-[#222]"}`,
      "aria-pressed": active,
      children: meta.nativeName
    },
    void 0,
    false,
    {
      fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
      lineNumber: 115,
      columnNumber: 5
    },
    void 0
  );
};
function createResetConfirmCode() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const values = crypto.getRandomValues(
      new Uint8Array(RESET_CONFIRM_CODE_LENGTH)
    );
    return Array.from(values, (value) => String(value % 10)).join("");
  }
  return Array.from(
    { length: RESET_CONFIRM_CODE_LENGTH },
    () => String(Math.floor(Math.random() * 10))
  ).join("");
}
function sanitizeResetConfirmCodeInput(value) {
  return value.replace(/\D/g, "").slice(0, RESET_CONFIRM_CODE_LENGTH);
}
const SettingMenuLayer = ({
  releaseLabel,
  vibrationEnabled,
  sfxEnabled,
  locale,
  onChangeVibration,
  onChangeSfx,
  onChangeLocale,
  onSendDiagnostics,
  isSendingDiagnostics: _isSendingDiagnostics,
  showFinalResetConfirm,
  onOpenResetConfirm,
  onCloseResetConfirm,
  onResetGameData,
  onClose,
  onBack,
  onShowOfflineAdFallback,
  onRequestPinHomeWidget,
  onResetConfirmBack,
  resetConfirmCodeFactory = createResetConfirmCode
}) => {
  const { t } = useI18n();
  const [requestingHomeWidgetSize, setRequestingHomeWidgetSize] = reactExports.useState(null);
  const [resetConfirmCode, setResetConfirmCode] = reactExports.useState(resetConfirmCodeFactory);
  const [resetConfirmDigits, setResetConfirmDigits] = reactExports.useState(
    () => Array.from({ length: RESET_CONFIRM_CODE_LENGTH }, () => "")
  );
  const resetCodeInputRefs = reactExports.useRef([]);
  reactExports.useEffect(() => {
    if (!showFinalResetConfirm) {
      return;
    }
    setResetConfirmCode(resetConfirmCodeFactory());
    setResetConfirmDigits(
      Array.from({ length: RESET_CONFIRM_CODE_LENGTH }, () => "")
    );
    window.requestAnimationFrame(() => {
      const firstInput = resetCodeInputRefs.current[0];
      firstInput == null ? void 0 : firstInput.focus();
      firstInput == null ? void 0 : firstInput.select();
    });
  }, [resetConfirmCodeFactory, showFinalResetConfirm]);
  const resetConfirmText = reactExports.useMemo(
    () => resetConfirmDigits.join(""),
    [resetConfirmDigits]
  );
  const isResetComplete = reactExports.useMemo(
    () => resetConfirmDigits.every((digit) => digit.length === 1),
    [resetConfirmDigits]
  );
  const isResetEnabled = reactExports.useMemo(
    () => isResetComplete && resetConfirmText === resetConfirmCode,
    [isResetComplete, resetConfirmCode, resetConfirmText]
  );
  const focusResetCodeInput = (index) => {
    const nextIndex = Math.max(0, Math.min(index, RESET_CONFIRM_CODE_LENGTH - 1));
    window.requestAnimationFrame(() => {
      const input = resetCodeInputRefs.current[nextIndex];
      input == null ? void 0 : input.focus();
      input == null ? void 0 : input.select();
    });
  };
  const fillResetConfirmDigits = (startIndex, value) => {
    const digits = sanitizeResetConfirmCodeInput(value);
    if (!digits) {
      return;
    }
    setResetConfirmDigits((currentDigits) => {
      const nextDigits = [...currentDigits];
      for (let offset = 0; offset < digits.length && startIndex + offset < RESET_CONFIRM_CODE_LENGTH; offset += 1) {
        nextDigits[startIndex + offset] = digits[offset];
      }
      return nextDigits;
    });
    focusResetCodeInput(startIndex + digits.length);
  };
  const clearResetConfirmDigit = (index, direction) => {
    const previousIndex = Math.max(0, index - 1);
    setResetConfirmDigits((currentDigits) => {
      const nextDigits = [...currentDigits];
      if (direction === "current") {
        nextDigits[index] = "";
      } else {
        nextDigits[previousIndex] = "";
      }
      return nextDigits;
    });
    focusResetCodeInput(direction === "current" ? index : previousIndex);
  };
  const handleRequestPinHomeWidget = async (size) => {
    if (!onRequestPinHomeWidget || requestingHomeWidgetSize) {
      return;
    }
    setRequestingHomeWidgetSize(size);
    try {
      await onRequestPinHomeWidget(size);
    } finally {
      setRequestingHomeWidgetSize(null);
    }
  };
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50", children: [
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex min-h-dvh items-center justify-center p-4", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
      PopupLayer,
      {
        title: t("settings.title"),
        suppressInitialActionsMs: 180,
        topLeftContent: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "text-[10px] leading-none text-gray-500", children: releaseLabel }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
          lineNumber: 285,
          columnNumber: 13
        }, void 0),
        content: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex flex-col gap-4 text-left text-[1.5rem] leading-[1.4]", children: [
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "min-w-0 flex-1", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "font-bold", children: t("settings.vibration") }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
              lineNumber: 293,
              columnNumber: 19
            }, void 0) }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
              lineNumber: 292,
              columnNumber: 17
            }, void 0),
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
              ToggleButton,
              {
                enabled: vibrationEnabled,
                onClick: () => onChangeVibration(!vibrationEnabled)
              },
              void 0,
              false,
              {
                fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
                lineNumber: 297,
                columnNumber: 17
              },
              void 0
            )
          ] }, void 0, true, {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
            lineNumber: 291,
            columnNumber: 15
          }, void 0),
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "min-w-0 flex-1", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "font-bold", children: t("settings.sfx") }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
              lineNumber: 305,
              columnNumber: 19
            }, void 0) }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
              lineNumber: 304,
              columnNumber: 17
            }, void 0),
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
              ToggleButton,
              {
                enabled: sfxEnabled,
                onClick: () => onChangeSfx(!sfxEnabled)
              },
              void 0,
              false,
              {
                fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
                lineNumber: 309,
                columnNumber: 17
              },
              void 0
            )
          ] }, void 0, true, {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
            lineNumber: 303,
            columnNumber: 15
          }, void 0),
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "border-t-2 border-[#222] pt-4", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "min-w-0 flex-1 font-bold", children: t("settings.reportBug") }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
              lineNumber: 317,
              columnNumber: 19
            }, void 0),
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
              ActionButton,
              {
                text: t("settings.send"),
                onClick: onSendDiagnostics,
                variant: "warning"
              },
              void 0,
              false,
              {
                fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
                lineNumber: 320,
                columnNumber: 19
              },
              void 0
            )
          ] }, void 0, true, {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
            lineNumber: 316,
            columnNumber: 17
          }, void 0) }, void 0, false, {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
            lineNumber: 315,
            columnNumber: 15
          }, void 0),
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "border-t-2 border-[#222] pt-4", children: [
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "min-w-0", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "font-bold", children: t("settings.homeWidget") }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
              lineNumber: 330,
              columnNumber: 19
            }, void 0) }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
              lineNumber: 329,
              columnNumber: 17
            }, void 0),
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "mt-3 flex justify-end gap-2", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
              ActionButton,
              {
                text: t("settings.homeWidgetAdd"),
                onClick: () => {
                  void handleRequestPinHomeWidget("1x1");
                },
                disabled: !onRequestPinHomeWidget,
                variant: "positive"
              },
              void 0,
              false,
              {
                fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
                lineNumber: 333,
                columnNumber: 19
              },
              void 0
            ) }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
              lineNumber: 332,
              columnNumber: 17
            }, void 0)
          ] }, void 0, true, {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
            lineNumber: 328,
            columnNumber: 15
          }, void 0),
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "border-t-2 border-[#222] pt-4", children: [
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "min-w-0", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "font-bold text-red-600", children: t("settings.raiseNewMonster") }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
              lineNumber: 346,
              columnNumber: 19
            }, void 0) }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
              lineNumber: 345,
              columnNumber: 17
            }, void 0),
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "mt-3 flex justify-end", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
              ActionButton,
              {
                text: t("common.reset"),
                onClick: onOpenResetConfirm,
                variant: "negative",
                snapshotAction: "open-settings-reset-popup"
              },
              void 0,
              false,
              {
                fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
                lineNumber: 351,
                columnNumber: 19
              },
              void 0
            ) }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
              lineNumber: 350,
              columnNumber: 17
            }, void 0)
          ] }, void 0, true, {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
            lineNumber: 344,
            columnNumber: 15
          }, void 0),
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "border-t-2 border-[#222] pt-4", children: [
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "mb-3 flex flex-wrap items-center gap-2 font-bold", children: [
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: "Language" }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
                lineNumber: 363,
                columnNumber: 21
              }, void 0),
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(DevModeBadge, {}, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
                lineNumber: 364,
                columnNumber: 21
              }, void 0)
            ] }, void 0, true, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
              lineNumber: 362,
              columnNumber: 19
            }, void 0),
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "grid grid-cols-2 gap-2", children: SUPPORTED_LOCALES.map((localeOption) => /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
              LanguageButton,
              {
                locale: localeOption,
                active: locale === localeOption,
                onClick: () => onChangeLocale(localeOption)
              },
              localeOption,
              false,
              {
                fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
                lineNumber: 368,
                columnNumber: 23
              },
              void 0
            )) }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
              lineNumber: 366,
              columnNumber: 19
            }, void 0),
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "mt-4 border-t-2 border-[#222] pt-4", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "min-w-0 flex-1", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex flex-wrap items-center gap-2 font-bold", children: [
                /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("span", { children: "Offline Ad" }, void 0, false, {
                  fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
                  lineNumber: 380,
                  columnNumber: 27
                }, void 0),
                /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(DevModeBadge, {}, void 0, false, {
                  fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
                  lineNumber: 381,
                  columnNumber: 27
                }, void 0)
              ] }, void 0, true, {
                fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
                lineNumber: 379,
                columnNumber: 25
              }, void 0) }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
                lineNumber: 378,
                columnNumber: 23
              }, void 0),
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                ActionButton,
                {
                  text: "Show",
                  onClick: () => onShowOfflineAdFallback == null ? void 0 : onShowOfflineAdFallback(),
                  disabled: !onShowOfflineAdFallback,
                  variant: "warning"
                },
                void 0,
                false,
                {
                  fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
                  lineNumber: 384,
                  columnNumber: 23
                },
                void 0
              )
            ] }, void 0, true, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
              lineNumber: 377,
              columnNumber: 21
            }, void 0) }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
              lineNumber: 376,
              columnNumber: 19
            }, void 0)
          ] }, void 0, true, {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
            lineNumber: 361,
            columnNumber: 17
          }, void 0)
        ] }, void 0, true, {
          fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
          lineNumber: 290,
          columnNumber: 13
        }, void 0),
        onConfirm: onClose,
        onBack: onBack ?? onClose,
        confirmText: t("common.close")
      },
      void 0,
      false,
      {
        fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
        lineNumber: 281,
        columnNumber: 9
      },
      void 0
    ) }, void 0, false, {
      fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
      lineNumber: 280,
      columnNumber: 7
    }, void 0),
    showFinalResetConfirm && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
      "div",
      {
        className: "fixed inset-0 z-[60] overflow-y-auto bg-black/50",
        "data-snapshot-popup": "settings-reset",
        children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex min-h-dvh items-center justify-center p-4", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
          PopupLayer,
          {
            title: t("settings.resetTitle"),
            content: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex flex-col gap-4 leading-[1.4]", children: [
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { children: t("settings.resetMessage") }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
                lineNumber: 411,
                columnNumber: 19
              }, void 0),
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                "div",
                {
                  className: "grid grid-cols-6 gap-1 self-center",
                  "aria-label": t("settings.resetConfirmCodeLabel"),
                  children: RESET_CONFIRM_CODE_INDEXES.map((index) => {
                    const digit = resetConfirmDigits[index];
                    const isDigitFilled = digit.length === 1;
                    const isDigitCorrect = isDigitFilled && digit === resetConfirmCode[index];
                    const isDigitMismatch = isDigitFilled && !isDigitCorrect;
                    return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                      "input",
                      {
                        ref: (element) => {
                          resetCodeInputRefs.current[index] = element;
                        },
                        type: "text",
                        inputMode: "numeric",
                        pattern: "[0-9]*",
                        maxLength: 1,
                        autoComplete: "off",
                        value: digit,
                        placeholder: resetConfirmCode[index],
                        onChange: (event) => fillResetConfirmDigits(index, event.target.value),
                        onFocus: (event) => event.target.select(),
                        onKeyDown: (event) => {
                          if (event.key !== "Backspace") {
                            if (event.key === "Delete") {
                              event.preventDefault();
                              clearResetConfirmDigit(index, "current");
                            }
                            return;
                          }
                          event.preventDefault();
                          clearResetConfirmDigit(
                            index,
                            digit ? "current" : "previous"
                          );
                        },
                        onPaste: (event) => {
                          event.preventDefault();
                          fillResetConfirmDigits(
                            index,
                            event.clipboardData.getData("text")
                          );
                        },
                        "aria-label": `${t("settings.resetConfirmCodeLabel")} ${index + 1}`,
                        "aria-invalid": isDigitMismatch,
                        className: `h-11 w-9 border-2 px-0 text-center text-[1.2rem] font-bold focus:outline-none focus:ring-2 ${isDigitCorrect ? "border-component-positive bg-[#f0fff4] text-component-positive placeholder:text-component-positive/60 focus:ring-component-positive" : isDigitMismatch ? "border-component-negative bg-[#fff0f2] text-component-negative placeholder:text-component-negative/50 focus:ring-[#d95763]" : "border-[#222] bg-white text-[#222] placeholder:text-gray-400 focus:ring-[#d95763]"}`
                      },
                      index,
                      false,
                      {
                        fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
                        lineNumber: 424,
                        columnNumber: 25
                      },
                      void 0
                    );
                  })
                },
                void 0,
                false,
                {
                  fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
                  lineNumber: 412,
                  columnNumber: 19
                },
                void 0
              )
            ] }, void 0, true, {
              fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
              lineNumber: 410,
              columnNumber: 17
            }, void 0),
            onConfirm: onResetGameData,
            onCancel: onCloseResetConfirm,
            onBack: onResetConfirmBack ?? onCloseResetConfirm,
            confirmText: t("common.reset"),
            cancelText: t("common.cancel"),
            confirmDisabled: !isResetEnabled,
            confirmVariant: "negative",
            cancelVariant: "positive",
            confirmEnableDelayMs: 2e3
          },
          void 0,
          false,
          {
            fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
            lineNumber: 407,
            columnNumber: 13
          },
          void 0
        ) }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
          lineNumber: 406,
          columnNumber: 11
        }, void 0)
      },
      void 0,
      false,
      {
        fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
        lineNumber: 402,
        columnNumber: 9
      },
      void 0
    )
  ] }, void 0, true, {
    fileName: "/Users/neiz/digivice/apps/client/src/layers/SettingMenuLayer.tsx",
    lineNumber: 279,
    columnNumber: 5
  }, void 0);
};
const useAlert = () => {
  const [alertState, setAlertState] = reactExports.useState(null);
  const showAlert = reactExports.useCallback((message, title) => {
    setAlertState({ message, title });
  }, []);
  const hideAlert = reactExports.useCallback(() => {
    setAlertState(null);
  }, []);
  return {
    alertState,
    showAlert,
    hideAlert
  };
};
const ECS_NULL_VALUE = 0;
const CHARACTER_OBJECT_TYPE = 1;
const FOOD_OBJECT_TYPE = 3;
const POOB_OBJECT_TYPE = 4;
const PILL_OBJECT_TYPE = 5;
const CHARACTER_STATE = {
  EGG: 0,
  IDLE: 1,
  MOVING: 2,
  SLEEPING: 3,
  DEAD: 6
};
const DEFAULTS = {
  VERSION: "1.0.0",
  CHARACTER_KEY: 1,
  SPRITESHEET_KEY: 1,
  ANIMATION_KEY_IDLE: 1,
  TEXTURE_KEY_EGG0: 500,
  STATUS_SLOT_COUNT: 4,
  DIGESTIVE_CAPACITY: 5,
  DISEASE_CHECK_INTERVAL: 1e4,
  EGG_HATCH_MIN_TIME: 20 * 60 * 1e3,
  EGG_HATCH_MODE_TIME: 30 * 60 * 1e3,
  EGG_HATCH_MAX_TIME: 40 * 60 * 1e3,
  DAY_NAP_CHECK_INTERVAL: 20 * 60 * 1e3,
  FATIGUE_DEFAULT: 35,
  RANDOM_MOVEMENT: {
    minIdleTime: 2e3,
    maxIdleTime: 8e3,
    minMoveTime: 1e3,
    maxMoveTime: 8e3
  }
};
function approximateInverseNormalCdf(probability) {
  const a = [
    -39.69683028665376,
    220.9460984245205,
    -275.9285104469687,
    138.357751867269,
    -30.66479806614716,
    2.506628277459239
  ];
  const b = [
    -54.47609879822406,
    161.5858368580409,
    -155.6989798598866,
    66.80131188771972,
    -13.28068155288572
  ];
  const c = [
    -0.007784894002430293,
    -0.3223964580411365,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783
  ];
  const d = [
    0.007784695709041462,
    0.3224671290700398,
    2.445134137142996,
    3.754408661907416
  ];
  const low = 0.02425;
  const high = 1 - low;
  if (probability < low) {
    const q2 = Math.sqrt(-2 * Math.log(probability));
    return (((((c[0] * q2 + c[1]) * q2 + c[2]) * q2 + c[3]) * q2 + c[4]) * q2 + c[5]) / ((((d[0] * q2 + d[1]) * q2 + d[2]) * q2 + d[3]) * q2 + 1);
  }
  if (probability <= high) {
    const q2 = probability - 0.5;
    const r = q2 * q2;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q2 / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - probability));
  return -((((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1));
}
function getEggHatchDelayMs(randomValue = Math.random()) {
  const min = DEFAULTS.EGG_HATCH_MIN_TIME;
  const mode = DEFAULTS.EGG_HATCH_MODE_TIME;
  const max = DEFAULTS.EGG_HATCH_MAX_TIME;
  const radius = Math.min(mode - min, max - mode);
  if (radius <= 0) {
    return mode;
  }
  const sigma = radius / 3;
  const lowerCdf = 0.0013498980316301035;
  const upperCdf = 0.9986501019683699;
  const clampedRandom = Math.max(0, Math.min(1, randomValue));
  const probability = lowerCdf + clampedRandom * (upperCdf - lowerCdf);
  const zScore = approximateInverseNormalCdf(probability);
  const boundedZ = Math.max(-3, Math.min(3, zScore));
  return Math.round(
    Math.max(min, Math.min(max, mode + boundedZ * sigma))
  );
}
function createEggHatchSchedule(now, randomValue = Math.random()) {
  const hatchDurationMs = getEggHatchDelayMs(randomValue);
  return {
    hatchTime: now + hatchDurationMs,
    hatchDurationMs
  };
}
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function toFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function toBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}
function toNonNegativeInteger(value, fallback = 0) {
  const numericValue = toFiniteNumber(value);
  if (numericValue === null || numericValue < 0) {
    return fallback;
  }
  return Math.floor(numericValue);
}
function sanitizeStatuses(statuses) {
  if (!Array.isArray(statuses)) {
    return new Array(DEFAULTS.STATUS_SLOT_COUNT).fill(ECS_NULL_VALUE);
  }
  const sanitized = statuses.map((status) => toFiniteNumber(status) ?? ECS_NULL_VALUE).slice(0, DEFAULTS.STATUS_SLOT_COUNT);
  while (sanitized.length < DEFAULTS.STATUS_SLOT_COUNT) {
    sanitized.push(ECS_NULL_VALUE);
  }
  return sanitized;
}
function needsAnimationRender(state) {
  return state !== CHARACTER_STATE.EGG && state !== CHARACTER_STATE.DEAD;
}
function needsRandomMovement(state) {
  return state === CHARACTER_STATE.IDLE || state === CHARACTER_STATE.MOVING;
}
function sanitizeWorldMetadata(metadata, now) {
  var _a, _b, _c, _d, _e;
  const cachedSunTimes = sanitizeCachedSunTimes(
    (_a = metadata == null ? void 0 : metadata.app_state) == null ? void 0 : _a.cached_sun_times
  );
  const mainSceneAd = sanitizeMainSceneAdState(
    (_b = metadata == null ? void 0 : metadata.app_state) == null ? void 0 : _b.main_scene_ad
  );
  const miniGameScores = sanitizeMiniGameScores(
    (_c = metadata == null ? void 0 : metadata.app_state) == null ? void 0 : _c.mini_game_scores
  );
  return {
    name: typeof (metadata == null ? void 0 : metadata.name) === "string" && metadata.name.trim() ? metadata.name.trim() : "MainScene",
    monster_name: typeof (metadata == null ? void 0 : metadata.monster_name) === "string" && metadata.monster_name.trim() ? metadata.monster_name.trim() : void 0,
    last_ecs_saved: toFiniteNumber(metadata == null ? void 0 : metadata.last_ecs_saved) ?? now,
    version: typeof (metadata == null ? void 0 : metadata.version) === "string" && metadata.version.trim() ? metadata.version : DEFAULTS.VERSION,
    app_state: {
      last_active_time: toFiniteNumber((_d = metadata == null ? void 0 : metadata.app_state) == null ? void 0 : _d.last_active_time) ?? now,
      is_first_load: typeof ((_e = metadata == null ? void 0 : metadata.app_state) == null ? void 0 : _e.is_first_load) === "boolean" ? metadata.app_state.is_first_load : false,
      use_local_time: true,
      cached_sun_times: cachedSunTimes,
      main_scene_ad: mainSceneAd,
      mini_game_scores: miniGameScores
    }
  };
}
function sanitizeMiniGameScores(miniGameScores) {
  var _a;
  return {
    flappy_bird: {
      best_score: toNonNegativeInteger((_a = miniGameScores == null ? void 0 : miniGameScores.flappy_bird) == null ? void 0 : _a.best_score)
    }
  };
}
function sanitizeMainSceneAdState(adState) {
  const sanitized = {
    menu_use_count: toNonNegativeInteger(adState == null ? void 0 : adState.menu_use_count)
  };
  const pending = sanitizeMainSceneAdPendingReservation(adState == null ? void 0 : adState.pending);
  if (pending) {
    sanitized.pending = pending;
  }
  return sanitized;
}
function sanitizeMainSceneAdPendingReservation(pending) {
  if (!pending || !isMainSceneAdMenu(pending.menu)) {
    return void 0;
  }
  const queuedAt = toFiniteNumber(pending.queued_at);
  const cooldownMs = toFiniteNumber(pending.cooldown_ms);
  const threshold = toFiniteNumber(pending.threshold);
  if (queuedAt === null || queuedAt <= 0 || cooldownMs === null || cooldownMs <= 0 || threshold === null || threshold <= 0 || typeof pending.deep_night !== "boolean" || pending.online_retry !== void 0 && typeof pending.online_retry !== "boolean") {
    return void 0;
  }
  const sanitizedPending = {
    menu: pending.menu,
    queued_at: queuedAt,
    cooldown_ms: cooldownMs,
    threshold: Math.floor(threshold),
    deep_night: pending.deep_night
  };
  if (pending.online_retry === true) {
    sanitizedPending.online_retry = true;
  }
  return sanitizedPending;
}
function isMainSceneAdMenu(value) {
  return value === "feed" || value === "clean" || value === "hospital" || value === "mini_game";
}
function sanitizeCachedSunTimes(sunTimes) {
  if (typeof (sunTimes == null ? void 0 : sunTimes.sunriseAt) !== "string" || typeof sunTimes.sunsetAt !== "string" || typeof sunTimes.date !== "string" || typeof sunTimes.timezone !== "string" || typeof sunTimes.timezoneOffsetMinutes !== "number" || typeof sunTimes.fetchedAt !== "string" || sunTimes.locationSource !== "device" && sunTimes.locationSource !== "fallback" || typeof sunTimes.hasLocationPermission !== "boolean") {
    return void 0;
  }
  return {
    sunriseAt: sunTimes.sunriseAt,
    sunsetAt: sunTimes.sunsetAt,
    date: sunTimes.date,
    timezone: sunTimes.timezone,
    timezoneOffsetMinutes: sunTimes.timezoneOffsetMinutes,
    fetchedAt: sunTimes.fetchedAt,
    locationSource: sunTimes.locationSource,
    hasLocationPermission: sunTimes.hasLocationPermission
  };
}
function sanitizeCharacterEntity(components, now) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N, _O, _P, _Q, _R, _S, _T, _U, _V, _W, _X, _Y, _Z;
  const objectId = toFiniteNumber((_a = components.object) == null ? void 0 : _a.id);
  if (!objectId || objectId <= 0) {
    return null;
  }
  const state = toFiniteNumber((_b = components.object) == null ? void 0 : _b.state) ?? CHARACTER_STATE.EGG;
  const characterKey = toFiniteNumber((_c = components.characterStatus) == null ? void 0 : _c.characterKey) ?? DEFAULTS.CHARACTER_KEY;
  const fallbackEggHatchSchedule = state === CHARACTER_STATE.EGG ? createEggHatchSchedule(now) : null;
  const sanitized = {
    object: {
      id: objectId,
      type: CHARACTER_OBJECT_TYPE,
      state
    },
    characterStatus: {
      characterKey,
      stamina: toFiniteNumber((_d = components.characterStatus) == null ? void 0 : _d.stamina) ?? 5,
      evolutionGage: toFiniteNumber((_e = components.characterStatus) == null ? void 0 : _e.evolutionGage) ?? 0,
      evolutionPhase: toFiniteNumber((_f = components.characterStatus) == null ? void 0 : _f.evolutionPhase) ?? 1,
      statuses: sanitizeStatuses((_g = components.characterStatus) == null ? void 0 : _g.statuses)
    },
    position: {
      x: toFiniteNumber((_h = components.position) == null ? void 0 : _h.x) ?? 0,
      y: toFiniteNumber((_i = components.position) == null ? void 0 : _i.y) ?? 0
    },
    angle: {
      value: toFiniteNumber((_j = components.angle) == null ? void 0 : _j.value) ?? 0
    },
    speed: {
      value: toFiniteNumber((_k = components.speed) == null ? void 0 : _k.value) ?? 0
    },
    render: {
      storeIndex: ECS_NULL_VALUE,
      textureKey: toFiniteNumber((_l = components.render) == null ? void 0 : _l.textureKey) ?? (state === CHARACTER_STATE.EGG ? DEFAULTS.TEXTURE_KEY_EGG0 : ECS_NULL_VALUE),
      scale: toFiniteNumber((_m = components.render) == null ? void 0 : _m.scale) ?? 3,
      zIndex: toFiniteNumber((_n = components.render) == null ? void 0 : _n.zIndex) ?? ECS_NULL_VALUE
    },
    statusIconRender: {
      storeIndexes: Array.isArray((_o = components.statusIconRender) == null ? void 0 : _o.storeIndexes) ? components.statusIconRender.storeIndexes.map((value) => toFiniteNumber(value) ?? ECS_NULL_VALUE).slice(0, DEFAULTS.STATUS_SLOT_COUNT) : new Array(DEFAULTS.STATUS_SLOT_COUNT).fill(ECS_NULL_VALUE),
      visibleCount: toFiniteNumber((_p = components.statusIconRender) == null ? void 0 : _p.visibleCount) ?? ECS_NULL_VALUE
    },
    digestiveSystem: {
      capacity: toFiniteNumber((_q = components.digestiveSystem) == null ? void 0 : _q.capacity) ?? DEFAULTS.DIGESTIVE_CAPACITY,
      currentLoad: toFiniteNumber((_r = components.digestiveSystem) == null ? void 0 : _r.currentLoad) ?? 0,
      nextPoopTime: toFiniteNumber((_s = components.digestiveSystem) == null ? void 0 : _s.nextPoopTime) ?? 0,
      nextSmallPoopTime: toFiniteNumber((_t = components.digestiveSystem) == null ? void 0 : _t.nextSmallPoopTime) ?? 0
    },
    diseaseSystem: {
      nextCheckTime: toFiniteNumber((_u = components.diseaseSystem) == null ? void 0 : _u.nextCheckTime) ?? now + DEFAULTS.DISEASE_CHECK_INTERVAL,
      sickStartTime: toFiniteNumber((_v = components.diseaseSystem) == null ? void 0 : _v.sickStartTime) ?? 0
    },
    sleepSystem: {
      fatigue: toFiniteNumber((_w = components.sleepSystem) == null ? void 0 : _w.fatigue) ?? DEFAULTS.FATIGUE_DEFAULT,
      nextSleepTime: toFiniteNumber((_x = components.sleepSystem) == null ? void 0 : _x.nextSleepTime) ?? 0,
      nextWakeTime: toFiniteNumber((_y = components.sleepSystem) == null ? void 0 : _y.nextWakeTime) ?? 0,
      nextNapCheckTime: toFiniteNumber((_z = components.sleepSystem) == null ? void 0 : _z.nextNapCheckTime) ?? now + DEFAULTS.DAY_NAP_CHECK_INTERVAL,
      nextNightWakeCheckTime: toFiniteNumber((_A = components.sleepSystem) == null ? void 0 : _A.nextNightWakeCheckTime) ?? 0,
      sleepMode: toFiniteNumber((_B = components.sleepSystem) == null ? void 0 : _B.sleepMode) ?? (state === CHARACTER_STATE.SLEEPING ? 1 : 0),
      pendingSleepReason: toFiniteNumber((_C = components.sleepSystem) == null ? void 0 : _C.pendingSleepReason) ?? 0,
      pendingWakeReason: toFiniteNumber((_D = components.sleepSystem) == null ? void 0 : _D.pendingWakeReason) ?? 0,
      sleepSessionStartedAt: toFiniteNumber((_E = components.sleepSystem) == null ? void 0 : _E.sleepSessionStartedAt) ?? 0
    },
    vitality: {
      urgentStartTime: toFiniteNumber((_F = components.vitality) == null ? void 0 : _F.urgentStartTime) ?? 0,
      deathTime: toFiniteNumber((_G = components.vitality) == null ? void 0 : _G.deathTime) ?? 0,
      isDead: toBoolean(
        (_H = components.vitality) == null ? void 0 : _H.isDead,
        state === CHARACTER_STATE.DEAD
      )
    },
    temporaryStatus: {
      statusType: toFiniteNumber((_I = components.temporaryStatus) == null ? void 0 : _I.statusType) ?? ECS_NULL_VALUE,
      startTime: toFiniteNumber((_J = components.temporaryStatus) == null ? void 0 : _J.startTime) ?? 0,
      lastHappyStatusTime: toFiniteNumber((_K = components.temporaryStatus) == null ? void 0 : _K.lastHappyStatusTime) ?? 0
    },
    eggHatch: {
      hatchTime: toFiniteNumber((_L = components.eggHatch) == null ? void 0 : _L.hatchTime) ?? (fallbackEggHatchSchedule == null ? void 0 : fallbackEggHatchSchedule.hatchTime) ?? 0,
      hatchDurationMs: toFiniteNumber((_M = components.eggHatch) == null ? void 0 : _M.hatchDurationMs) ?? (fallbackEggHatchSchedule == null ? void 0 : fallbackEggHatchSchedule.hatchDurationMs) ?? 0,
      isReadyToHatch: toBoolean((_N = components.eggHatch) == null ? void 0 : _N.isReadyToHatch, false),
      syringeCount: Math.min(
        10,
        toNonNegativeInteger((_O = components.eggHatch) == null ? void 0 : _O.syringeCount, 0)
      )
    }
  };
  const statusIconSlots = (_P = sanitized.statusIconRender) == null ? void 0 : _P.storeIndexes;
  if (statusIconSlots && statusIconSlots.length < DEFAULTS.STATUS_SLOT_COUNT) {
    while (statusIconSlots.length < DEFAULTS.STATUS_SLOT_COUNT) {
      statusIconSlots.push(ECS_NULL_VALUE);
    }
  }
  if (needsAnimationRender(state)) {
    sanitized.animationRender = {
      storeIndex: ECS_NULL_VALUE,
      spritesheetKey: toFiniteNumber((_Q = components.animationRender) == null ? void 0 : _Q.spritesheetKey) ?? characterKey ?? DEFAULTS.SPRITESHEET_KEY,
      animationKey: toFiniteNumber((_R = components.animationRender) == null ? void 0 : _R.animationKey) ?? DEFAULTS.ANIMATION_KEY_IDLE,
      isPlaying: toBoolean((_S = components.animationRender) == null ? void 0 : _S.isPlaying, true),
      loop: toBoolean((_T = components.animationRender) == null ? void 0 : _T.loop, true),
      speed: toFiniteNumber((_U = components.animationRender) == null ? void 0 : _U.speed) ?? 0.04
    };
  }
  if (needsRandomMovement(state)) {
    const minIdle = toFiniteNumber((_V = components.randomMovement) == null ? void 0 : _V.minIdleTime) ?? DEFAULTS.RANDOM_MOVEMENT.minIdleTime;
    const maxIdle = Math.max(
      minIdle,
      toFiniteNumber((_W = components.randomMovement) == null ? void 0 : _W.maxIdleTime) ?? DEFAULTS.RANDOM_MOVEMENT.maxIdleTime
    );
    const minMove = toFiniteNumber((_X = components.randomMovement) == null ? void 0 : _X.minMoveTime) ?? DEFAULTS.RANDOM_MOVEMENT.minMoveTime;
    const maxMove = Math.max(
      minMove,
      toFiniteNumber((_Y = components.randomMovement) == null ? void 0 : _Y.maxMoveTime) ?? DEFAULTS.RANDOM_MOVEMENT.maxMoveTime
    );
    sanitized.randomMovement = {
      minIdleTime: minIdle,
      maxIdleTime: maxIdle,
      minMoveTime: minMove,
      maxMoveTime: maxMove,
      nextChange: toFiniteNumber((_Z = components.randomMovement) == null ? void 0 : _Z.nextChange) ?? now + 1e3
    };
  }
  return sanitized;
}
function sanitizeNonCharacterEntity(components) {
  var _a, _b, _c, _d;
  const objectId = toFiniteNumber((_a = components.object) == null ? void 0 : _a.id);
  const objectType = toFiniteNumber((_b = components.object) == null ? void 0 : _b.type);
  const objectState = toFiniteNumber((_c = components.object) == null ? void 0 : _c.state) ?? ECS_NULL_VALUE;
  if (!objectId || objectId <= 0) {
    return null;
  }
  if (objectType !== FOOD_OBJECT_TYPE && objectType !== POOB_OBJECT_TYPE && objectType !== PILL_OBJECT_TYPE) {
    return null;
  }
  if (!isRecord(components.position) || !isRecord(components.render)) {
    return null;
  }
  const positionX = toFiniteNumber(components.position.x);
  const positionY = toFiniteNumber(components.position.y);
  const textureKey = toFiniteNumber(components.render.textureKey);
  const scale = toFiniteNumber(components.render.scale);
  if (positionX === null || positionY === null || textureKey === null || scale === null) {
    return null;
  }
  return {
    ...components,
    object: {
      id: objectId,
      type: objectType,
      state: objectState
    },
    position: {
      x: positionX,
      y: positionY
    },
    render: {
      storeIndex: ECS_NULL_VALUE,
      textureKey,
      scale,
      zIndex: toFiniteNumber((_d = components.render) == null ? void 0 : _d.zIndex) ?? ECS_NULL_VALUE
    }
  };
}
function sanitizeStoredWorldData(savedData) {
  var _a, _b, _c, _d, _e;
  if (!savedData) {
    return {
      action: "setup_required",
      sanitizedData: null,
      changed: false,
      diagnostics: {
        summary: "No saved game data was found.",
        issues: ["savedData was nullish, so setup is required."],
        rawEntityCount: 0,
        sanitizedEntityCount: 0,
        playableCharacterCount: 0,
        skippedEntityCount: 0,
        duplicateObjectIdCount: 0,
        repairedCharacterEntityCount: 0,
        repairedNonCharacterEntityCount: 0,
        sawCharacterCandidate: false,
        hasMonsterName: false,
        hadAnySavedShape: false
      }
    };
  }
  if (!isRecord(savedData)) {
    return {
      action: "reset_required",
      sanitizedData: null,
      changed: false,
      resetReason: "The existing game data format is invalid and must be reset.",
      diagnostics: {
        summary: "Saved game data root shape is invalid.",
        issues: [`savedData root is not an object (type=${typeof savedData}).`],
        rawEntityCount: 0,
        sanitizedEntityCount: 0,
        playableCharacterCount: 0,
        skippedEntityCount: 0,
        duplicateObjectIdCount: 0,
        repairedCharacterEntityCount: 0,
        repairedNonCharacterEntityCount: 0,
        sawCharacterCandidate: false,
        hasMonsterName: false,
        hadAnySavedShape: false
      }
    };
  }
  const now = Date.now();
  const worldData = savedData;
  const sanitizedMetadata = sanitizeWorldMetadata(
    worldData.world_metadata,
    now
  );
  const rawEntities = Array.isArray(worldData.entities) ? worldData.entities : [];
  const sanitizedEntities = [];
  const seenObjectIds = /* @__PURE__ */ new Set();
  const issues = [];
  let sawCharacterCandidate = false;
  let skippedEntityCount = 0;
  let duplicateObjectIdCount = 0;
  let repairedCharacterEntityCount = 0;
  let repairedNonCharacterEntityCount = 0;
  if (!Array.isArray(worldData.entities) && worldData.entities !== void 0) {
    issues.push(
      "worldData.entities was not an array and was treated as empty."
    );
  }
  if (sanitizedMetadata.name !== ((_a = worldData.world_metadata) == null ? void 0 : _a.name)) {
    issues.push(
      `world_metadata.name was normalized to "${sanitizedMetadata.name}".`
    );
  }
  if (!sanitizedMetadata.monster_name) {
    issues.push("world_metadata.monster_name is missing after sanitization.");
  }
  if (sanitizedMetadata.version !== ((_b = worldData.world_metadata) == null ? void 0 : _b.version)) {
    issues.push(
      `world_metadata.version was normalized to "${sanitizedMetadata.version}".`
    );
  }
  rawEntities.forEach((entity, index) => {
    var _a2, _b2;
    if (!isRecord(entity) || !isRecord(entity.components)) {
      skippedEntityCount += 1;
      issues.push(
        `entity[${index}] was skipped because it was missing a valid components object.`
      );
      return;
    }
    const components = entity.components;
    const rawObjectType = toFiniteNumber((_a2 = components.object) == null ? void 0 : _a2.type);
    const looksLikeCharacter = rawObjectType === CHARACTER_OBJECT_TYPE || !!components.characterStatus;
    if (looksLikeCharacter) {
      sawCharacterCandidate = true;
    }
    const sanitizedComponents = looksLikeCharacter ? sanitizeCharacterEntity(components, now) : sanitizeNonCharacterEntity(components);
    if (!((_b2 = sanitizedComponents == null ? void 0 : sanitizedComponents.object) == null ? void 0 : _b2.id)) {
      skippedEntityCount += 1;
      if (looksLikeCharacter) {
        issues.push(
          `entity[${index}] looked like a character but could not be recovered (missing valid object.id or required fields).`
        );
      } else {
        issues.push(
          `entity[${index}] was skipped because its non-character payload was invalid or unsupported.`
        );
      }
      return;
    }
    if (seenObjectIds.has(sanitizedComponents.object.id)) {
      duplicateObjectIdCount += 1;
      issues.push(
        `entity[${index}] was dropped because object.id=${sanitizedComponents.object.id} was duplicated.`
      );
      return;
    }
    seenObjectIds.add(sanitizedComponents.object.id);
    if (looksLikeCharacter) {
      if (JSON.stringify(components) !== JSON.stringify(sanitizedComponents)) {
        repairedCharacterEntityCount += 1;
      }
    } else if (JSON.stringify(components) !== JSON.stringify(sanitizedComponents)) {
      repairedNonCharacterEntityCount += 1;
    }
    sanitizedEntities.push({ components: sanitizedComponents });
  });
  const sanitizedData = {
    world_metadata: sanitizedMetadata,
    entities: sanitizedEntities
  };
  const changed = JSON.stringify(worldData) !== JSON.stringify(sanitizedData);
  const playableCharacterCount = sanitizedEntities.filter((entity) => {
    var _a2, _b2;
    return ((_b2 = (_a2 = entity.components) == null ? void 0 : _a2.object) == null ? void 0 : _b2.type) === CHARACTER_OBJECT_TYPE;
  }).length;
  const hasMonsterName = !!((_c = sanitizedMetadata.monster_name) == null ? void 0 : _c.trim());
  const hadAnySavedShape = rawEntities.length > 0 || !!((_d = worldData.world_metadata) == null ? void 0 : _d.monster_name) || !!((_e = worldData.world_metadata) == null ? void 0 : _e.name);
  const diagnosticsBase = {
    issues,
    rawEntityCount: rawEntities.length,
    sanitizedEntityCount: sanitizedEntities.length,
    playableCharacterCount,
    skippedEntityCount,
    duplicateObjectIdCount,
    repairedCharacterEntityCount,
    repairedNonCharacterEntityCount,
    sawCharacterCandidate,
    hasMonsterName,
    hadAnySavedShape
  };
  if (playableCharacterCount === 0) {
    if (hadAnySavedShape) {
      const resetReason = [
        "Character recovery failed during saved game validation.",
        `rawEntities=${rawEntities.length}`,
        `sanitizedEntities=${sanitizedEntities.length}`,
        `skippedEntities=${skippedEntityCount}`,
        `duplicateObjectIds=${duplicateObjectIdCount}`,
        `sawCharacterCandidate=${sawCharacterCandidate}`,
        issues.length > 0 ? `issues=${issues.slice(0, 5).join(" | ")}` : ""
      ].filter(Boolean).join(" ");
      return {
        action: "reset_required",
        sanitizedData,
        changed,
        resetReason,
        diagnostics: {
          ...diagnosticsBase,
          summary: "Saved game data had shape, but no playable character could be recovered."
        }
      };
    }
    return {
      action: "setup_required",
      sanitizedData,
      changed,
      diagnostics: {
        ...diagnosticsBase,
        summary: "No playable character data exists, so setup is required."
      }
    };
  }
  if (!hasMonsterName) {
    const resetReason = sawCharacterCandidate ? [
      "Saved game data contained a character candidate but no valid monster name.",
      `rawEntities=${rawEntities.length}`,
      `sanitizedEntities=${sanitizedEntities.length}`,
      `issues=${issues.slice(0, 5).join(" | ")}`
    ].filter(Boolean).join(" ") : void 0;
    return {
      action: sawCharacterCandidate ? "reset_required" : "setup_required",
      sanitizedData,
      changed,
      resetReason,
      diagnostics: {
        ...diagnosticsBase,
        summary: sawCharacterCandidate ? "Character data exists but the required monster name is missing." : "Monster name is missing, so setup is required."
      }
    };
  }
  return {
    action: "playable",
    sanitizedData,
    changed,
    diagnostics: {
      ...diagnosticsBase,
      summary: changed ? "Saved game data was repaired and is playable." : "Saved game data is playable without repair."
    }
  };
}
function getTimingNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
function toDurationMs(startedAt) {
  return Math.max(0, Math.round(getTimingNow() - startedAt));
}
function createTraceId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function summarizeTimingError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    };
  }
  return {
    message: String(error)
  };
}
function summarizeSetupFormData(formData) {
  return {
    nameLength: formData.name.length,
    useLocalTime: formData.useLocalTime,
    hadCachedSunTimes: !!formData.cachedSunTimes
  };
}
class EntryFlowDiagnostics {
  constructor() {
    __publicField(this, "_activeSetupFlowTrace", null);
    __publicField(this, "_lastBootstrapState", null);
  }
  resetActiveSetupFlow() {
    this._activeSetupFlowTrace = null;
  }
  beginBootstrap(gameContainerSize) {
    this._logBootstrap("bootstrap", {
      status: "start",
      gameContainerSize
    });
  }
  beginPrepareSavedGameData(storageKind) {
    this.resetActiveSetupFlow();
    this._logBootstrap("prepare_saved_game_data", {
      status: "start",
      storageKind
    });
    return getTimingNow();
  }
  completePrepareSavedGameData(params) {
    this._lastBootstrapState = params.resultAction;
    this._logBootstrap("prepare_saved_game_data", {
      status: "end",
      durationMs: toDurationMs(params.startedAt),
      storageKind: params.storageKind,
      resultAction: params.resultAction,
      savedDataSummary: params.savedDataSummary
    });
  }
  failPrepareSavedGameData(params) {
    this._lastBootstrapState = "reset_required";
    this._logBootstrap("prepare_saved_game_data", {
      status: "error",
      durationMs: toDurationMs(params.startedAt),
      storageKind: params.storageKind,
      error: summarizeTimingError(params.error)
    });
  }
  markWaitingForSetupInput() {
    this._logBootstrap("request_initial_game_data", {
      status: "waiting_for_input"
    });
  }
  startSetupFlow(source) {
    const trace = {
      setupFlowId: createTraceId("setup"),
      source,
      createdAt: getTimingNow()
    };
    this._activeSetupFlowTrace = trace;
    return trace;
  }
  logSetupConfirmed(formData) {
    this._logSetup("setup_confirmed", summarizeSetupFormData(formData));
  }
  logSetupDataReady(formData) {
    this._logSetup("setup_data_ready", {
      durationMs: this._activeSetupFlowTrace ? toDurationMs(this._activeSetupFlowTrace.createdAt) : null,
      ...summarizeSetupFormData(formData)
    });
  }
  beginHydrateInitialSetupData(formData) {
    const startedAt = getTimingNow();
    this._logSetup("hydrate_initial_setup_data", {
      status: "start",
      ...summarizeSetupFormData(formData)
    });
    return startedAt;
  }
  skipHydrateInitialSetupData(params) {
    this._logSetup("hydrate_initial_setup_data", {
      status: "skip",
      durationMs: toDurationMs(params.startedAt),
      reason: params.reason,
      ...summarizeSetupFormData(params.formData)
    });
  }
  beginNativeSunTimesRequest(promptForPermission) {
    const startedAt = getTimingNow();
    this._logSetup("native_sun_times_request", {
      status: "start",
      promptForPermission
    });
    return startedAt;
  }
  completeNativeSunTimesRequest(startedAt, sunTimes, promptForPermission) {
    this._logSetup("native_sun_times_request", {
      status: "end",
      durationMs: toDurationMs(startedAt),
      promptForPermission,
      receivedSunTimes: !!sunTimes,
      locationSource: (sunTimes == null ? void 0 : sunTimes.locationSource) ?? null,
      hasLocationPermission: (sunTimes == null ? void 0 : sunTimes.hasLocationPermission) ?? null
    });
  }
  failNativeSunTimesRequest(startedAt, error, promptForPermission) {
    this._logSetup("native_sun_times_request", {
      status: "error",
      durationMs: toDurationMs(startedAt),
      promptForPermission,
      error: summarizeTimingError(error)
    });
  }
  completeHydrateInitialSetupData(params) {
    var _a, _b;
    this._logSetup("hydrate_initial_setup_data", {
      status: "end",
      durationMs: toDurationMs(params.startedAt),
      resolvedWithCachedSunTimes: !!params.sunTimes,
      locationSource: ((_a = params.sunTimes) == null ? void 0 : _a.locationSource) ?? null,
      hasLocationPermission: ((_b = params.sunTimes) == null ? void 0 : _b.hasLocationPermission) ?? null
    });
  }
  failHydrateInitialSetupData(startedAt, error) {
    this._logSetup("hydrate_initial_setup_data", {
      status: "error",
      durationMs: toDurationMs(startedAt),
      error: summarizeTimingError(error)
    });
  }
  beginInitializeGame(initializationAttemptId, gameContainerSize) {
    this._logBootstrap("initialize_game", {
      status: "start",
      initializationAttemptId,
      gameContainerSize
    });
  }
  completeInitializeGame(initializationAttemptId) {
    this._logBootstrap("initialize_game", {
      status: "end",
      initializationAttemptId
    });
  }
  failInitializeGame(initializationAttemptId, error) {
    this._logBootstrap("initialize_game", {
      status: "error",
      initializationAttemptId,
      error: summarizeTimingError(error)
    });
  }
  beginRequestInitialGameData() {
    this._logBootstrap("request_initial_game_data", {
      status: "start"
    });
    return getTimingNow();
  }
  completeRequestInitialGameData(startedAt, hasInitialSetupData) {
    this._logBootstrap("request_initial_game_data", {
      status: "end",
      durationMs: toDurationMs(startedAt),
      hasInitialSetupData
    });
  }
  beginLayoutStabilization() {
    this._logBootstrap("wait_for_layout_stabilization", {
      status: "start"
    });
    return getTimingNow();
  }
  completeLayoutStabilization(startedAt, viewportHeight) {
    this._logBootstrap("wait_for_layout_stabilization", {
      status: "end",
      durationMs: toDurationMs(startedAt),
      viewportHeight
    });
  }
  createNativeSunTimesTraceContext(params) {
    var _a;
    return {
      source: params.source,
      phase: params.phase,
      setupFlowId: ((_a = this._activeSetupFlowTrace) == null ? void 0 : _a.setupFlowId) ?? null,
      initializationAttemptId: params.initializationAttemptId ?? null
    };
  }
  createGameLoadingTraceContext(initializationAttemptId) {
    var _a;
    return {
      initializationAttemptId,
      setupFlowId: ((_a = this._activeSetupFlowTrace) == null ? void 0 : _a.setupFlowId) ?? null,
      bootstrapState: this._lastBootstrapState
    };
  }
  _logSetup(phase, payload = {}) {
    const trace = this._activeSetupFlowTrace;
    logImportantDiagnostics("log", "[ImportantDiagnostics][SetupFlowTiming]", {
      phase,
      setupFlowId: (trace == null ? void 0 : trace.setupFlowId) ?? null,
      setupSource: (trace == null ? void 0 : trace.source) ?? null,
      flowAgeMs: trace ? toDurationMs(trace.createdAt) : null,
      ...payload
    });
  }
  _logBootstrap(phase, payload = {}) {
    var _a;
    logImportantDiagnostics("log", "[ImportantDiagnostics][BootstrapTiming]", {
      phase,
      setupFlowId: ((_a = this._activeSetupFlowTrace) == null ? void 0 : _a.setupFlowId) ?? null,
      bootstrapState: this._lastBootstrapState,
      ...payload
    });
  }
}
const WORLD_DATA_STORAGE_KEY = "MainSceneWorldData";
const FLAPPY_BIRD_GAME_OVER_AD_COUNTER_STORAGE_KEY = "FlappyBirdGameOverAdCounter";
const FLAPPY_BIRD_GAME_OVER_AD_THRESHOLD = 15;
const FLAPPY_BIRD_GAME_OVER_AD_DELAY_MS = 500;
const FLAPPY_BIRD_GAME_OVER_AD_COOLDOWN_MS = 1;
const biteVibrationAdapter = new VibrationAdapter();
const RECOVERY_VIBRATION_INTERVAL_MS = 180;
const RECOVERY_VIBRATION_DURATION_MS = 14;
const RECOVERY_VIBRATION_STRENGTH = 28;
const LOADING_TIMEOUT_MS = 3e4;
const isNativeFeatureDebugMode$1 = true;
const isAndroidUserAgent = typeof navigator !== "undefined" && /DigiviceApp-Android|Android/i.test(navigator.userAgent);
const KEYBOARD_VIEWPORT_HEIGHT_DELTA_THRESHOLD = 80;
const UNSUPPORTED_VIEWPORT_OVERLAY_SHOW_DEBOUNCE_MS = 180;
const UNSUPPORTED_SQUARE_VIEWPORT_RATIO = 0.8;
function getConfiguredInitialSceneKey() {
  if (void 0 === SceneKey.FLAPPY_BIRD_GAME) {
    return SceneKey.FLAPPY_BIRD_GAME;
  }
  if (void 0 === SceneKey.MONSTER_BOOK) {
    return SceneKey.MONSTER_BOOK;
  }
  return SceneKey.MAIN;
}
const CONFIGURED_INITIAL_SCENE_KEY = getConfiguredInitialSceneKey();
function isMissingInitialGameDataError(error) {
  return error instanceof MissingInitialGameDataError || error instanceof Error && error.name === MissingInitialGameDataError.name;
}
const BACK_NAVIGATION_ALERT_ENTRY = "layer:alert";
const BACK_NAVIGATION_LOADING_FAILURE_ENTRY = "layer:loading-failure";
const BACK_NAVIGATION_DIAGNOSTICS_ENTRY = "layer:diagnostics-draft";
const BACK_NAVIGATION_MONSTER_INFO_ENTRY = "layer:monster-info";
const BACK_NAVIGATION_SETTING_MENU_ENTRY = "layer:setting-menu";
const BACK_NAVIGATION_SETTING_RESET_CONFIRM_ENTRY = "layer:setting-reset-confirm";
const BACK_NAVIGATION_SCENE_ENTRY_PREFIX = "scene:";
const ROOT_SCENE_HISTORY_STACK = [SceneKey.MAIN];
function createSceneBackNavigationEntry(sceneKey) {
  return `${BACK_NAVIGATION_SCENE_ENTRY_PREFIX}${sceneKey}`;
}
function parseSceneBackNavigationEntry(entry) {
  if (!entry.startsWith(BACK_NAVIGATION_SCENE_ENTRY_PREFIX)) {
    return null;
  }
  return entry.slice(BACK_NAVIGATION_SCENE_ENTRY_PREFIX.length);
}
function getTargetSceneKeyFromBackNavigationEntries(entries) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const sceneKey = parseSceneBackNavigationEntry(entries[index]);
    if (sceneKey) {
      return sceneKey;
    }
  }
  return SceneKey.MAIN;
}
function readBackNavigationEntriesFromHistoryState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return [];
  }
  const entries = state.__digiviceBackEntries;
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries.filter(
    (entry) => typeof entry === "string"
  );
}
function createBackNavigationHistoryState(state, entries) {
  const nextState = state && typeof state === "object" && !Array.isArray(state) ? { ...state } : {};
  nextState.__digiviceBackEntries = [...entries];
  return nextState;
}
function areBackNavigationEntriesEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}
function getStoredFlappyBirdBestScore(data) {
  var _a, _b, _c, _d;
  const bestScore = (_d = (_c = (_b = (_a = data == null ? void 0 : data.world_metadata) == null ? void 0 : _a.app_state) == null ? void 0 : _b.mini_game_scores) == null ? void 0 : _c.flappy_bird) == null ? void 0 : _d.best_score;
  return typeof bestScore === "number" && Number.isFinite(bestScore) ? Math.max(0, Math.floor(bestScore)) : 0;
}
function withStoredFlappyBirdBestScore(data, bestScore) {
  var _a, _b, _c, _d, _e, _f;
  const nextBestScore = Math.max(0, Math.floor(bestScore));
  return {
    ...data,
    world_metadata: {
      ...data.world_metadata,
      app_state: {
        ...(_a = data.world_metadata) == null ? void 0 : _a.app_state,
        mini_game_scores: {
          ...(_c = (_b = data.world_metadata) == null ? void 0 : _b.app_state) == null ? void 0 : _c.mini_game_scores,
          flappy_bird: {
            ...(_f = (_e = (_d = data.world_metadata) == null ? void 0 : _d.app_state) == null ? void 0 : _e.mini_game_scores) == null ? void 0 : _f.flappy_bird,
            best_score: nextBestScore
          }
        }
      }
    }
  };
}
function getStoredFlappyBirdGameOverAdCount(data) {
  if (typeof data === "number" && Number.isFinite(data)) {
    return Math.max(0, Math.floor(data));
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const count = data.count;
    if (typeof count === "number" && Number.isFinite(count)) {
      return Math.max(0, Math.floor(count));
    }
  }
  return 0;
}
function getSharedBackNavigationPrefixLength(left, right) {
  const maxLength = Math.min(left.length, right.length);
  let prefixLength = 0;
  while (prefixLength < maxLength && left[prefixLength] === right[prefixLength]) {
    prefixLength += 1;
  }
  return prefixLength;
}
function waitForAnimationFrame() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}
function areMainCharacterInfoSnapshotsEqual(left, right) {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return left.monsterName === right.monsterName && left.isEgg === right.isEgg && left.evolutionPhase === right.evolutionPhase && left.stamina === right.stamina && left.maxStamina === right.maxStamina && left.unhappyThreshold === right.unhappyThreshold && left.boostedThreshold === right.boostedThreshold && left.evolutionGauge === right.evolutionGauge && left.maxEvolutionGauge === right.maxEvolutionGauge;
}
async function waitForLayoutStabilization() {
  await waitForAnimationFrame();
  await waitForAnimationFrame();
  await new Promise((resolve) => window.setTimeout(resolve, 250));
  await waitForAnimationFrame();
}
function getCurrentViewportHeight() {
  var _a;
  if (typeof window === "undefined") {
    return 0;
  }
  return Math.max(
    0,
    Math.round(((_a = window.visualViewport) == null ? void 0 : _a.height) ?? window.innerHeight)
  );
}
function setFrozenAppShellHeight(height) {
  if (typeof document === "undefined") {
    return;
  }
  if (height && height > 0) {
    document.documentElement.style.setProperty(
      "--digivice-app-shell-height",
      `${height}px`
    );
    return;
  }
  document.documentElement.style.removeProperty("--digivice-app-shell-height");
}
function isTextInputElement(element) {
  return element instanceof HTMLElement && (element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable);
}
function isKeyboardOpenForUnsupportedViewportCheck(options = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  const { nativeKeyboardInset = 0 } = options;
  if (nativeKeyboardInset > 0) {
    return true;
  }
  const visualViewport = window.visualViewport;
  if (!visualViewport) {
    return false;
  }
  const baseViewportHeight = Math.max(
    window.innerHeight,
    document.documentElement.clientHeight || 0
  );
  const viewportHeightDelta = baseViewportHeight - visualViewport.height;
  return viewportHeightDelta >= KEYBOARD_VIEWPORT_HEIGHT_DELTA_THRESHOLD;
}
function getUnsupportedViewportReason(options = {}) {
  var _a, _b;
  if (typeof window === "undefined") {
    return null;
  }
  const viewportWidth = ((_a = window.visualViewport) == null ? void 0 : _a.width) ?? window.innerWidth;
  const viewportHeight = ((_b = window.visualViewport) == null ? void 0 : _b.height) ?? window.innerHeight;
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return null;
  }
  if (isKeyboardOpenForUnsupportedViewportCheck(options)) {
    return null;
  }
  if (viewportWidth > viewportHeight) {
    return "landscape";
  }
  if (viewportWidth / viewportHeight >= UNSUPPORTED_SQUARE_VIEWPORT_RATIO) {
    return "square";
  }
  return null;
}
function summarizeSavedData(savedData) {
  var _a;
  if (!savedData || typeof savedData !== "object") {
    return {
      hasData: Boolean(savedData),
      valueType: typeof savedData,
      isNull: savedData === null
    };
  }
  const savedDataRecord = savedData;
  return {
    hasData: true,
    valueType: typeof savedData,
    monsterName: (_a = savedDataRecord.world_metadata) == null ? void 0 : _a.monster_name,
    entityCount: Array.isArray(savedDataRecord.entities) ? savedDataRecord.entities.length : "n/a"
  };
}
function summarizeBrowserLocalStorageEntry(key) {
  if (typeof window === "undefined") {
    return {
      available: false,
      reason: "window_unavailable"
    };
  }
  try {
    const rawValue = window.localStorage.getItem(key);
    if (rawValue === null) {
      return {
        available: true,
        hasKey: false
      };
    }
    try {
      return {
        available: true,
        hasKey: true,
        rawLength: rawValue.length,
        parsedSummary: summarizeSavedData(JSON.parse(rawValue))
      };
    } catch (error) {
      return {
        available: true,
        hasKey: true,
        rawLength: rawValue.length,
        parseError: error instanceof Error ? error.message : String(error)
      };
    }
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}
function summarizeGameData(data) {
  var _a, _b, _c, _d;
  if (!data || typeof data !== "object") {
    return {
      entityCount: "n/a"
    };
  }
  const record = data;
  return {
    monsterName: (_a = record.world_metadata) == null ? void 0 : _a.monster_name,
    entityCount: Array.isArray(record.entities) ? record.entities.length : "n/a",
    worldVersion: (_b = record.world_metadata) == null ? void 0 : _b.version,
    useLocalTime: (_d = (_c = record.world_metadata) == null ? void 0 : _c.app_state) == null ? void 0 : _d.use_local_time
  };
}
function createDiagnosticsSubject(timestamp) {
  return `[MonTTo][${getClientReleaseLabel()}] Diagnostics Report ${timestamp}`;
}
function createDiagnosticsBody() {
  return [
    `App version: ${getClientReleaseLabel()}`,
    "",
    "Please describe the issue or symptoms you observed.",
    "",
    "- What happened?",
    "- When did it happen?",
    "- What did you expect to happen?",
    "- How can it be reproduced?"
  ].join("\n");
}
function createFlappyBirdLogsSubject(timestamp) {
  return `[MonTTo][${getClientReleaseLabel()}] FlappyBird Logs ${timestamp}`;
}
function createFlappyBirdLogsBody() {
  return [
    `App version: ${getClientReleaseLabel()}`,
    "",
    "FlappyBird log files are attached.",
    "",
    "Please describe the minigame issue or symptoms you observed.",
    "",
    "- What happened during the game?",
    "- When did it happen?",
    "- What did you expect to happen?",
    "- How can it be reproduced?"
  ].join("\n");
}
function getClientReleaseLabel() {
  return `${"1.0.4-debug"}+${18}`;
}
function getClientReleaseFileLabel() {
  const sanitizedVersion = "1.0.4-debug".replace(/[^a-zA-Z0-9.-]+/g, "_");
  return `${sanitizedVersion}-build-${18}`;
}
function buildDiagnosticsTimestampSuffix(timestamp) {
  return timestamp.replace(/\.\d{3}Z$/, "Z").replace(/[:]/g, "-");
}
function buildGmailComposeHref(subject, body) {
  const gmailComposeUrl = new URL("https://mail.google.com/mail/");
  gmailComposeUrl.searchParams.set("view", "cm");
  gmailComposeUrl.searchParams.set("fs", "1");
  gmailComposeUrl.searchParams.set("to", "dev.chchh@gmail.com");
  gmailComposeUrl.searchParams.set("su", subject);
  gmailComposeUrl.searchParams.set("body", body);
  return gmailComposeUrl.toString();
}
async function openMailDraft(subject, body, attachments) {
  const composeUrl = buildGmailComposeHref(subject, body);
  const recipient = "dev.chchh@gmail.com";
  if (typeof window !== "undefined" && window.browserController && typeof window.browserController.openGmailDraft === "function") {
    try {
      await window.browserController.openGmailDraft(
        recipient,
        subject,
        body,
        attachments
      );
      return "gmail_app";
    } catch (gmailError) {
      console.warn(
        "[GameContainer] Falling back to browser compose because Gmail app launch failed",
        gmailError
      );
    }
  }
  if (typeof window !== "undefined" && window.browserController && typeof window.browserController.openExternalUrl === "function") {
    await window.browserController.openExternalUrl(composeUrl);
    return "external_browser";
  }
  const openedWindow = window.open(composeUrl, "_blank", "noopener,noreferrer");
  if (openedWindow) {
    return "browser_window";
  }
  window.location.assign(composeUrl);
  return "same_window";
}
const GameContainer = () => {
  const gameViewportRef = reactExports.useRef(null);
  const gameContainerRef = reactExports.useRef(null);
  const controlButtonsWrapperRef = reactExports.useRef(null);
  const [gameInstance, setGameInstance] = reactExports.useState(null);
  const [gameContainerSize, setGameContainerSize] = reactExports.useState(
    null
  );
  const [unsupportedViewportReason, setUnsupportedViewportReason] = reactExports.useState(null);
  const [showSetupLayer, setShowSetupLayer] = reactExports.useState(false);
  const [isBootstrapping, setIsBootstrapping] = reactExports.useState(true);
  const { locale, setLocale, t } = useI18n();
  const { alertState, showAlert, hideAlert } = useAlert();
  const [loadingFailureAlert, setLoadingFailureAlert] = reactExports.useState(null);
  const [sanitizeResetAlert, setSanitizeResetAlert] = reactExports.useState(null);
  const isInitializedRef = reactExports.useRef(false);
  const isInitializingGameRef = reactExports.useRef(false);
  const initialSetupDataRef = reactExports.useRef(null);
  const pendingInitialSetupPromiseRef = reactExports.useRef(
    null
  );
  const pendingSetupResolverRef = reactExports.useRef(null);
  const entryFlowDiagnostics = reactExports.useMemo(() => new EntryFlowDiagnostics(), []);
  const shouldRestartFromSetupRef = reactExports.useRef(false);
  const [sceneHistoryStack, setSceneHistoryStack] = reactExports.useState(() => [
    ...ROOT_SCENE_HISTORY_STACK
  ]);
  const [monsterInfoState, setMonsterInfoState] = reactExports.useState(null);
  const [showSettingMenu, setShowSettingMenu] = reactExports.useState(false);
  const [showFinalResetConfirm, setShowFinalResetConfirm] = reactExports.useState(false);
  const [gameSettings, setGameSettings] = reactExports.useState(getGameSettings);
  const [gameSessionKey, setGameSessionKey] = reactExports.useState(0);
  const [isSendingDiagnostics, setIsSendingDiagnostics] = reactExports.useState(false);
  const [pendingDiagnosticsDraft, setPendingDiagnosticsDraft] = reactExports.useState(null);
  const [flappyBirdGameOverState, setFlappyBirdGameOverState] = reactExports.useState(null);
  const [flappyBirdSettingsMenuState, setFlappyBirdSettingsMenuState] = reactExports.useState(null);
  const [buttonParams, setButtonParams] = reactExports.useState(null);
  const [controlButtonSoundEnabled, setControlButtonSoundEnabled] = reactExports.useState(true);
  const [sceneTransitionLoadState, setSceneTransitionLoadState] = reactExports.useState({
    requestId: 0,
    phase: "idle"
  });
  const [isResumeGuardVisible, setIsResumeGuardVisible] = reactExports.useState(false);
  const pendingSettingMenuOpenTimeoutRef = reactExports.useRef(null);
  const sceneTransitionRequestIdRef = reactExports.useRef(0);
  const resumeGuardReleaseRequestIdRef = reactExports.useRef(0);
  const gameInitializationAttemptIdRef = reactExports.useRef(0);
  const pendingGameInitializationRef = reactExports.useRef(null);
  const initializeGameStartTimeoutRef = reactExports.useRef(null);
  const loadingTimeoutIdRef = reactExports.useRef(null);
  const loadingTimeoutContextRef = reactExports.useRef(null);
  const flappyBirdGameOverAdTimeoutRef = reactExports.useRef(null);
  const recoveryVibrationIntervalRef = reactExports.useRef(null);
  const nativeKeyboardInsetRef = reactExports.useRef(0);
  const unsupportedViewportOverlayShowTimeoutRef = reactExports.useRef(null);
  const lastValidationResultRef = reactExports.useRef(
    null
  );
  const isFullscreenAdLayoutFrozenRef = reactExports.useRef(false);
  const isResumeGuardVisibleRef = reactExports.useRef(false);
  const isResumeReentrySimulationRunningRef = reactExports.useRef(false);
  const fullscreenAdLayoutReleaseTimeoutRef = reactExports.useRef(null);
  const fullscreenAdLayoutReleaseRafRef = reactExports.useRef(null);
  const activeBackNavigationEntriesRef = reactExports.useRef([]);
  const currentBackNavigationEntriesRef = reactExports.useRef([]);
  const pendingPopstateTargetEntriesRef = reactExports.useRef(
    null
  );
  const pendingBrowserHistoryTargetEntriesRef = reactExports.useRef(null);
  const hasInitializedBackNavigationHistoryRef = reactExports.useRef(false);
  const logSetupLayerVisibility = reactExports.useCallback(
    (reason, payload = {}, level = "warn") => {
      logImportantDiagnostics(
        level,
        "[ImportantDiagnostics][SetupLayerVisibility]",
        {
          reason,
          hasGameInstance: !!gameInstance,
          isInitialized: isInitializedRef.current,
          isInitializingGame: isInitializingGameRef.current,
          currentSceneKey: (gameInstance == null ? void 0 : gameInstance.getCurrentSceneKey()) ?? null,
          sceneTransitionPhase: sceneTransitionLoadState.phase,
          sceneTransitionRequestId: sceneTransitionLoadState.requestId,
          sceneTransitionFrom: sceneTransitionLoadState.from ?? null,
          sceneTransitionTo: sceneTransitionLoadState.to ?? null,
          documentHidden: typeof document !== "undefined" ? document.hidden : null,
          ...payload
        }
      );
    },
    [gameInstance, sceneTransitionLoadState]
  );
  const presentSetupLayer = reactExports.useCallback(
    (reason, payload = {}) => {
      logSetupLayerVisibility(reason, payload);
      setShowSetupLayer(true);
    },
    [logSetupLayerVisibility]
  );
  const clearPendingSettingMenuOpen = reactExports.useCallback(() => {
    if (pendingSettingMenuOpenTimeoutRef.current === null) {
      return;
    }
    window.clearTimeout(pendingSettingMenuOpenTimeoutRef.current);
    pendingSettingMenuOpenTimeoutRef.current = null;
  }, []);
  const clearInitializeGameStartTimeout = reactExports.useCallback(() => {
    if (initializeGameStartTimeoutRef.current === null) {
      return;
    }
    window.clearTimeout(initializeGameStartTimeoutRef.current);
    initializeGameStartTimeoutRef.current = null;
  }, []);
  const clearLoadingTimeout = reactExports.useCallback(() => {
    if (loadingTimeoutIdRef.current !== null) {
      window.clearTimeout(loadingTimeoutIdRef.current);
      loadingTimeoutIdRef.current = null;
    }
    loadingTimeoutContextRef.current = null;
  }, []);
  const showResumeGuard = reactExports.useCallback(
    (reason, options = {}) => {
      if (isFullscreenAdLayoutFrozenRef.current) {
        return;
      }
      resumeGuardReleaseRequestIdRef.current += 1;
      isResumeGuardVisibleRef.current = true;
      const applyVisibleState = () => {
        setIsResumeGuardVisible(true);
      };
      if (options.sync) {
        reactDomExports.flushSync(applyVisibleState);
      } else {
        applyVisibleState();
      }
      logImportantDiagnostics(
        "log",
        "[ImportantDiagnostics][ResumeGuard]",
        {
          state: "shown",
          reason,
          currentSceneKey: (gameInstance == null ? void 0 : gameInstance.getCurrentSceneKey()) ?? null
        }
      );
    },
    [gameInstance]
  );
  const hideResumeGuardAfterLayout = reactExports.useCallback((reason) => {
    if (!isResumeGuardVisibleRef.current) {
      return;
    }
    if (isResumeReentrySimulationRunningRef.current) {
      return;
    }
    const requestId = resumeGuardReleaseRequestIdRef.current + 1;
    resumeGuardReleaseRequestIdRef.current = requestId;
    void (async () => {
      await waitForLayoutStabilization();
      if (resumeGuardReleaseRequestIdRef.current !== requestId || isResumeReentrySimulationRunningRef.current) {
        return;
      }
      isResumeGuardVisibleRef.current = false;
      setIsResumeGuardVisible(false);
      logImportantDiagnostics(
        "log",
        "[ImportantDiagnostics][ResumeGuard]",
        {
          state: "hidden",
          reason
        }
      );
    })();
  }, []);
  const clearPendingFlappyBirdGameOverAd = reactExports.useCallback(() => {
    if (flappyBirdGameOverAdTimeoutRef.current === null) {
      return;
    }
    window.clearTimeout(flappyBirdGameOverAdTimeoutRef.current);
    flappyBirdGameOverAdTimeoutRef.current = null;
  }, []);
  const cancelPendingGameInitialization = reactExports.useCallback(
    (reason) => {
      clearInitializeGameStartTimeout();
      const pendingInitialization = pendingGameInitializationRef.current;
      pendingGameInitializationRef.current = null;
      isInitializingGameRef.current = false;
      if (!pendingInitialization) {
        return;
      }
      try {
        pendingInitialization.game.destroy();
      } catch (error) {
        console.warn(
          "[GameContainer] Failed to cancel a pending game initialization.",
          {
            reason,
            error
          }
        );
      }
    },
    [clearInitializeGameStartTimeout]
  );
  const openSettingMenu = reactExports.useCallback(() => {
    if (showSettingMenu || pendingSettingMenuOpenTimeoutRef.current !== null) {
      return;
    }
    pendingSettingMenuOpenTimeoutRef.current = window.setTimeout(() => {
      pendingSettingMenuOpenTimeoutRef.current = null;
      setShowSettingMenu(true);
    }, 0);
  }, [showSettingMenu]);
  const openMonsterInfo = reactExports.useCallback(
    (snapshot) => {
      if (!snapshot) {
        return;
      }
      setMonsterInfoState(
        (previous) => areMainCharacterInfoSnapshotsEqual(previous, snapshot) ? previous : snapshot
      );
    },
    []
  );
  const closeMonsterInfo = reactExports.useCallback(() => {
    setMonsterInfoState(null);
  }, []);
  const closeSettingMenu = reactExports.useCallback(() => {
    clearPendingSettingMenuOpen();
    setShowFinalResetConfirm(false);
    setShowSettingMenu(false);
  }, [clearPendingSettingMenuOpen]);
  const closeResetConfirm = reactExports.useCallback(() => {
    if (typeof document !== "undefined") {
      const activeElement = document.activeElement;
      if (isTextInputElement(activeElement)) {
        activeElement.blur();
      }
    }
    setShowFinalResetConfirm(false);
  }, []);
  const backNavigationEntries = reactExports.useMemo(() => {
    const entries = sceneHistoryStack.slice(1).map((sceneKey) => createSceneBackNavigationEntry(sceneKey));
    if (monsterInfoState) {
      entries.push(BACK_NAVIGATION_MONSTER_INFO_ENTRY);
    }
    if (showSettingMenu) {
      entries.push(BACK_NAVIGATION_SETTING_MENU_ENTRY);
    }
    if (showFinalResetConfirm) {
      entries.push(BACK_NAVIGATION_SETTING_RESET_CONFIRM_ENTRY);
    }
    if (alertState) {
      entries.push(BACK_NAVIGATION_ALERT_ENTRY);
    }
    if (loadingFailureAlert) {
      entries.push(BACK_NAVIGATION_LOADING_FAILURE_ENTRY);
    }
    if (pendingDiagnosticsDraft) {
      entries.push(BACK_NAVIGATION_DIAGNOSTICS_ENTRY);
    }
    return entries;
  }, [
    alertState,
    loadingFailureAlert,
    monsterInfoState,
    pendingDiagnosticsDraft,
    sceneHistoryStack,
    showFinalResetConfirm,
    showSettingMenu
  ]);
  const requestHistoryBackForEntry = reactExports.useCallback(
    (entry, fallback) => {
      if (typeof window === "undefined") {
        fallback();
        return;
      }
      const currentEntries = activeBackNavigationEntriesRef.current;
      if (currentEntries[currentEntries.length - 1] !== entry) {
        fallback();
        return;
      }
      window.history.back();
    },
    []
  );
  const dismissAlert = reactExports.useCallback(() => {
    requestHistoryBackForEntry(BACK_NAVIGATION_ALERT_ENTRY, hideAlert);
  }, [hideAlert, requestHistoryBackForEntry]);
  const dismissLoadingFailureAlert = reactExports.useCallback(() => {
    requestHistoryBackForEntry(BACK_NAVIGATION_LOADING_FAILURE_ENTRY, () => {
      setLoadingFailureAlert(null);
    });
  }, [requestHistoryBackForEntry]);
  const dismissDiagnosticsDraft = reactExports.useCallback(() => {
    requestHistoryBackForEntry(BACK_NAVIGATION_DIAGNOSTICS_ENTRY, () => {
      setPendingDiagnosticsDraft(null);
    });
  }, [requestHistoryBackForEntry]);
  const dismissMonsterInfo = reactExports.useCallback(() => {
    requestHistoryBackForEntry(BACK_NAVIGATION_MONSTER_INFO_ENTRY, () => {
      setMonsterInfoState(null);
    });
  }, [requestHistoryBackForEntry]);
  const dismissResetConfirm = reactExports.useCallback(() => {
    requestHistoryBackForEntry(
      BACK_NAVIGATION_SETTING_RESET_CONFIRM_ENTRY,
      closeResetConfirm
    );
  }, [closeResetConfirm, requestHistoryBackForEntry]);
  const dismissSettingMenu = reactExports.useCallback(() => {
    requestHistoryBackForEntry(
      BACK_NAVIGATION_SETTING_MENU_ENTRY,
      closeSettingMenu
    );
  }, [closeSettingMenu, requestHistoryBackForEntry]);
  const interruptLoadingFlow = reactExports.useCallback(
    (reason) => {
      if (sceneTransitionLoadState.phase === "loading" && gameInstance && sceneTransitionLoadState.from) {
        const interrupted = gameInstance.requestSceneTransitionInterruption({
          requestId: sceneTransitionLoadState.requestId,
          fallbackScene: sceneTransitionLoadState.from,
          reason
        });
        if (interrupted) {
          logImportantDiagnostics(
            "warn",
            "[ImportantDiagnostics][LoadingInterruption]",
            {
              reason,
              loadingKind: "scene_transition_loading",
              requestId: sceneTransitionLoadState.requestId,
              from: sceneTransitionLoadState.from,
              to: sceneTransitionLoadState.to
            }
          );
          return true;
        }
      }
      if (sceneTransitionLoadState.phase === "core_ready" && gameInstance && sceneTransitionLoadState.from) {
        logImportantDiagnostics(
          "warn",
          "[ImportantDiagnostics][LoadingInterruption]",
          {
            reason,
            loadingKind: "scene_transition_core_ready",
            requestId: sceneTransitionLoadState.requestId,
            from: sceneTransitionLoadState.from,
            to: sceneTransitionLoadState.to
          }
        );
        clearLoadingTimeout();
        sceneTransitionRequestIdRef.current = 0;
        setSceneTransitionLoadState({ requestId: 0, phase: "idle" });
        setIsBootstrapping(false);
        void gameInstance.changeScene(sceneTransitionLoadState.from);
        return true;
      }
      if (isBootstrapping && !showSetupLayer) {
        logImportantDiagnostics(
          "warn",
          "[ImportantDiagnostics][LoadingInterruption]",
          {
            reason,
            loadingKind: "bootstrap_to_main",
            requestId: sceneTransitionLoadState.requestId,
            from: "setup_layer",
            to: SceneKey.MAIN
          }
        );
        clearLoadingTimeout();
        cancelPendingGameInitialization(`loading_interrupted:${reason}`);
        sceneTransitionRequestIdRef.current = 0;
        setSceneTransitionLoadState({ requestId: 0, phase: "idle" });
        setLoadingFailureAlert(null);
        setButtonParams(null);
        isInitializedRef.current = false;
        if (gameInstance) {
          try {
            gameInstance.destroy();
          } catch (error) {
            console.warn(
              "[GameContainer] Failed to destroy the active game while interrupting bootstrap loading.",
              {
                reason,
                error
              }
            );
          }
        }
        if (gameContainerRef.current) {
          gameContainerRef.current.innerHTML = "";
        }
        setGameInstance(null);
        setIsBootstrapping(false);
        if (reason === "back_navigation") {
          logImportantDiagnostics(
            "warn",
            "[ImportantDiagnostics][LoadingInterruption] Bootstrap interruption from back navigation will fall through to native exit handling.",
            {
              reason,
              loadingKind: "bootstrap_to_main_back_navigation_exit",
              requestId: sceneTransitionLoadState.requestId,
              sceneHistoryTop: sceneHistoryStack[sceneHistoryStack.length - 1] ?? null
            }
          );
          return false;
        }
        presentSetupLayer("bootstrap_loading_interrupted", {
          triggerReason: reason
        });
        return true;
      }
      return false;
    },
    [
      cancelPendingGameInitialization,
      clearLoadingTimeout,
      gameInstance,
      isBootstrapping,
      sceneHistoryStack,
      presentSetupLayer,
      sceneTransitionLoadState,
      showSetupLayer
    ]
  );
  const handleNativeBackNavigation = reactExports.useCallback(() => {
    var _a;
    if (typeof window === "undefined") {
      return "consumed";
    }
    if (pendingBrowserHistoryTargetEntriesRef.current || pendingPopstateTargetEntriesRef.current) {
      return "consumed";
    }
    if (consumeTopPopupBackHandler()) {
      return "consumed";
    }
    if (interruptLoadingFlow("back_navigation")) {
      return "consumed";
    }
    if ((_a = window.digiviceAdFallbackBridge) == null ? void 0 : _a.isActive()) {
      return "consumed";
    }
    if (unsupportedViewportReason || showSetupLayer || sanitizeResetAlert) {
      return "consumed";
    }
    if (pendingDiagnosticsDraft) {
      setPendingDiagnosticsDraft(null);
      return "consumed";
    }
    if (flappyBirdSettingsMenuState) {
      const { onResume } = flappyBirdSettingsMenuState;
      setFlappyBirdSettingsMenuState(null);
      void Promise.resolve(onResume());
      return "consumed";
    }
    const currentSceneKey = (gameInstance == null ? void 0 : gameInstance.getCurrentSceneKey()) ?? sceneHistoryStack[sceneHistoryStack.length - 1] ?? SceneKey.MAIN;
    if (currentSceneKey === SceneKey.FLAPPY_BIRD_GAME && activeBackNavigationEntriesRef.current.length === 0) {
      gameInstance == null ? void 0 : gameInstance.prepareCurrentSceneForNativeBackExit();
      return "exit";
    }
    if (flappyBirdGameOverState && currentSceneKey !== SceneKey.FLAPPY_BIRD_GAME) {
      const { onExit } = flappyBirdGameOverState;
      setFlappyBirdGameOverState(null);
      void Promise.resolve(onExit());
      return "consumed";
    }
    if (activeBackNavigationEntriesRef.current.length === 0) {
      if (currentSceneKey !== SceneKey.MAIN) {
        if (gameInstance) {
          void gameInstance.changeScene(SceneKey.MAIN);
        }
        return "consumed";
      }
      return "exit";
    }
    window.history.back();
    return "consumed";
  }, [
    flappyBirdGameOverState,
    flappyBirdSettingsMenuState,
    gameInstance,
    isBootstrapping,
    pendingDiagnosticsDraft,
    sanitizeResetAlert,
    sceneHistoryStack,
    sceneTransitionLoadState.phase,
    setFlappyBirdGameOverState,
    setFlappyBirdSettingsMenuState,
    setPendingDiagnosticsDraft,
    showSetupLayer,
    unsupportedViewportReason,
    interruptLoadingFlow
  ]);
  const applyBackNavigationTarget = reactExports.useCallback(
    async (targetEntries) => {
      const targetEntrySet = new Set(targetEntries);
      if (!targetEntrySet.has(BACK_NAVIGATION_DIAGNOSTICS_ENTRY)) {
        setPendingDiagnosticsDraft(null);
      }
      if (!targetEntrySet.has(BACK_NAVIGATION_ALERT_ENTRY)) {
        hideAlert();
      }
      if (!targetEntrySet.has(BACK_NAVIGATION_LOADING_FAILURE_ENTRY)) {
        setLoadingFailureAlert(null);
      }
      if (!targetEntrySet.has(BACK_NAVIGATION_MONSTER_INFO_ENTRY)) {
        closeMonsterInfo();
      }
      if (!targetEntrySet.has(BACK_NAVIGATION_SETTING_MENU_ENTRY)) {
        closeSettingMenu();
      } else if (!targetEntrySet.has(BACK_NAVIGATION_SETTING_RESET_CONFIRM_ENTRY)) {
        closeResetConfirm();
      }
      if (!gameInstance || sceneTransitionLoadState.phase !== "idle") {
        return;
      }
      const targetSceneKey = getTargetSceneKeyFromBackNavigationEntries(targetEntries);
      if (gameInstance.getCurrentSceneKey() === targetSceneKey) {
        return;
      }
      await gameInstance.changeScene(targetSceneKey);
    },
    [
      closeMonsterInfo,
      closeResetConfirm,
      closeSettingMenu,
      gameInstance,
      hideAlert,
      sceneTransitionLoadState.phase
    ]
  );
  const stopLoadingWithFailure = reactExports.useCallback(
    ({
      message,
      title = t("loading.errorTitle"),
      error,
      context
    }) => {
      clearLoadingTimeout();
      cancelPendingGameInitialization("loading_failure");
      sceneTransitionRequestIdRef.current = 0;
      setSceneTransitionLoadState({ requestId: 0, phase: "idle" });
      setIsBootstrapping(false);
      const diagnosticsContext = {
        release: getClientReleaseLabel(),
        storageKind: getClientStorageKind(),
        sceneTransitionPhase: sceneTransitionLoadState.phase,
        currentSceneKey: (gameInstance == null ? void 0 : gameInstance.getCurrentSceneKey()) ?? null,
        ...context,
        error: error ?? null
      };
      logImportantDiagnostics(
        "error",
        "[ImportantDiagnostics][GameContainer] Loading flow failed.",
        diagnosticsContext
      );
      console.error("[GameContainer] Loading flow failed.", {
        message,
        ...diagnosticsContext
      });
      setLoadingFailureAlert({ title, message });
    },
    [
      cancelPendingGameInitialization,
      clearLoadingTimeout,
      gameInstance,
      sceneTransitionLoadState.phase,
      t
    ]
  );
  const armLoadingTimeout = reactExports.useCallback(
    (context, options = {}) => {
      const startedAt = !options.resetStart && loadingTimeoutContextRef.current ? loadingTimeoutContextRef.current.startedAt : Date.now();
      loadingTimeoutContextRef.current = {
        ...context,
        startedAt
      };
      if (loadingTimeoutIdRef.current !== null) {
        window.clearTimeout(loadingTimeoutIdRef.current);
      }
      const elapsedMs = Date.now() - startedAt;
      const remainingMs = Math.max(0, LOADING_TIMEOUT_MS - elapsedMs);
      loadingTimeoutIdRef.current = window.setTimeout(() => {
        loadingTimeoutIdRef.current = null;
        const timeoutContext = loadingTimeoutContextRef.current;
        loadingTimeoutContextRef.current = null;
        if (!timeoutContext) {
          return;
        }
        stopLoadingWithFailure({
          title: t("loading.timeoutTitle"),
          message: t("loading.timeoutMessage"),
          context: {
            phase: "loading_timeout",
            loadingPhase: timeoutContext.phase,
            initializationAttemptId: timeoutContext.initializationAttemptId ?? null,
            requestId: timeoutContext.requestId ?? null,
            from: timeoutContext.from ?? null,
            to: timeoutContext.to ?? null,
            elapsedMs: Date.now() - timeoutContext.startedAt,
            timeoutMs: LOADING_TIMEOUT_MS
          }
        });
      }, remainingMs);
    },
    [stopLoadingWithFailure, t]
  );
  reactExports.useEffect(() => {
    preloadUiSfx();
  }, []);
  reactExports.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    let hasResumedUiSfx = false;
    const cleanupListeners = () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("touchstart", handleTouchStart, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
    const handleFirstGesture = () => {
      if (hasResumedUiSfx) {
        return;
      }
      hasResumedUiSfx = true;
      resumeUiSfxFromGesture();
      cleanupListeners();
    };
    const handlePointerDown = () => {
      handleFirstGesture();
    };
    const handleTouchStart = () => {
      handleFirstGesture();
    };
    const handleKeyDown = () => {
      handleFirstGesture();
    };
    window.addEventListener("pointerdown", handlePointerDown, {
      capture: true,
      passive: true
    });
    window.addEventListener("touchstart", handleTouchStart, {
      capture: true,
      passive: true
    });
    window.addEventListener("keydown", handleKeyDown, true);
    return cleanupListeners;
  }, []);
  reactExports.useEffect(() => {
    return () => {
      clearPendingSettingMenuOpen();
    };
  }, [clearPendingSettingMenuOpen]);
  reactExports.useLayoutEffect(() => {
    activeBackNavigationEntriesRef.current = backNavigationEntries;
  }, [backNavigationEntries]);
  reactExports.useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const backBridge = {
      handleBackNavigation: handleNativeBackNavigation
    };
    window.digiviceBackBridge = backBridge;
    return () => {
      if (window.digiviceBackBridge === backBridge) {
        window.digiviceBackBridge = void 0;
      }
    };
  }, [handleNativeBackNavigation]);
  reactExports.useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!hasInitializedBackNavigationHistoryRef.current) {
      window.history.replaceState(
        createBackNavigationHistoryState(
          window.history.state,
          backNavigationEntries
        ),
        document.title
      );
      currentBackNavigationEntriesRef.current = backNavigationEntries;
      hasInitializedBackNavigationHistoryRef.current = true;
      return;
    }
    if (pendingBrowserHistoryTargetEntriesRef.current) {
      return;
    }
    if (pendingPopstateTargetEntriesRef.current) {
      if (areBackNavigationEntriesEqual(
        pendingPopstateTargetEntriesRef.current,
        backNavigationEntries
      )) {
        currentBackNavigationEntriesRef.current = backNavigationEntries;
        pendingPopstateTargetEntriesRef.current = null;
      }
      return;
    }
    const currentEntries = currentBackNavigationEntriesRef.current;
    if (areBackNavigationEntriesEqual(currentEntries, backNavigationEntries)) {
      const browserEntries = readBackNavigationEntriesFromHistoryState(
        window.history.state
      );
      if (!areBackNavigationEntriesEqual(browserEntries, backNavigationEntries)) {
        window.history.replaceState(
          createBackNavigationHistoryState(
            window.history.state,
            backNavigationEntries
          ),
          document.title
        );
      }
      return;
    }
    const sharedPrefixLength = getSharedBackNavigationPrefixLength(
      currentEntries,
      backNavigationEntries
    );
    if (sharedPrefixLength === currentEntries.length && backNavigationEntries.length > currentEntries.length) {
      for (let index = currentEntries.length + 1; index <= backNavigationEntries.length; index += 1) {
        window.history.pushState(
          createBackNavigationHistoryState(
            window.history.state,
            backNavigationEntries.slice(0, index)
          ),
          document.title
        );
      }
      currentBackNavigationEntriesRef.current = backNavigationEntries;
      return;
    }
    if (sharedPrefixLength === backNavigationEntries.length && backNavigationEntries.length < currentEntries.length) {
      pendingBrowserHistoryTargetEntriesRef.current = backNavigationEntries;
      window.history.go(backNavigationEntries.length - currentEntries.length);
      return;
    }
    window.history.replaceState(
      createBackNavigationHistoryState(
        window.history.state,
        backNavigationEntries
      ),
      document.title
    );
    currentBackNavigationEntriesRef.current = backNavigationEntries;
  }, [backNavigationEntries]);
  reactExports.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handlePopState = (event) => {
      const targetEntries = readBackNavigationEntriesFromHistoryState(
        event.state
      );
      if (pendingBrowserHistoryTargetEntriesRef.current && areBackNavigationEntriesEqual(
        pendingBrowserHistoryTargetEntriesRef.current,
        targetEntries
      )) {
        pendingBrowserHistoryTargetEntriesRef.current = null;
        currentBackNavigationEntriesRef.current = targetEntries;
        return;
      }
      pendingPopstateTargetEntriesRef.current = targetEntries;
      if (sceneTransitionLoadState.phase !== "idle") {
        return;
      }
      void applyBackNavigationTarget(targetEntries);
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [applyBackNavigationTarget, sceneTransitionLoadState.phase]);
  reactExports.useEffect(() => {
    if (sceneTransitionLoadState.phase !== "idle") {
      return;
    }
    const targetEntries = pendingPopstateTargetEntriesRef.current;
    if (!targetEntries) {
      return;
    }
    void applyBackNavigationTarget(targetEntries);
  }, [applyBackNavigationTarget, sceneTransitionLoadState.phase]);
  const handleVibrationSettingChange = reactExports.useCallback((enabled) => {
    setGameSettings(updateGameSettings({ vibrationEnabled: enabled }));
  }, []);
  const handleSfxSettingChange = reactExports.useCallback((enabled) => {
    setGameSettings(updateGameSettings({ sfxEnabled: enabled }));
  }, []);
  reactExports.useEffect(() => {
    setGameSettings(getGameSettings());
    gameInstance == null ? void 0 : gameInstance.setLocale(locale);
  }, [gameInstance, locale]);
  reactExports.useEffect(() => {
    setDiagnosticsContextProvider(() => ({
      scene: (gameInstance == null ? void 0 : gameInstance.getCurrentSceneKey()) !== void 0 ? String(gameInstance.getCurrentSceneKey()) : void 0,
      storageKind: getClientStorageKind(),
      appMode: "development",
      appVersion: "1.0.4-debug",
      buildNumber: 18,
      debugEnabled: isNativeFeatureDebugMode$1
    }));
    return () => {
      setDiagnosticsContextProvider(null);
    };
  }, [gameInstance]);
  const handleSceneTransitionStateChange = reactExports.useCallback(
    (params) => {
      var _a;
      if (params.state === "loading") {
        sceneTransitionRequestIdRef.current = params.requestId;
        armLoadingTimeout(
          {
            phase: "scene_transition",
            initializationAttemptId: (_a = pendingGameInitializationRef.current) == null ? void 0 : _a.attemptId,
            requestId: params.requestId,
            from: params.from ?? null,
            to: params.to
          },
          { resetStart: false }
        );
        setSceneTransitionLoadState({
          requestId: params.requestId,
          phase: "loading",
          from: params.from,
          to: params.to
        });
        setFlappyBirdSettingsMenuState(null);
        setFlappyBirdGameOverState(null);
        setButtonParams(null);
        return;
      }
      if (sceneTransitionRequestIdRef.current !== params.requestId) {
        return;
      }
      if (params.state === "failed") {
        stopLoadingWithFailure({
          message: "A scene failed to load. Tap Okay to dismiss this popup or Send Log to share diagnostics.",
          context: {
            phase: "scene_transition",
            requestId: params.requestId,
            from: params.from ?? null,
            to: params.to
          }
        });
        return;
      }
      if (params.state === "interrupted") {
        clearLoadingTimeout();
        sceneTransitionRequestIdRef.current = 0;
        setSceneTransitionLoadState({ requestId: 0, phase: "idle" });
        setIsBootstrapping(false);
        return;
      }
      setSceneTransitionLoadState(
        (previous) => previous.requestId === params.requestId ? { ...previous, phase: "core_ready" } : previous
      );
      clearLoadingTimeout();
      setSceneHistoryStack((previous) => {
        if (params.to === SceneKey.FLAPPY_BIRD_GAME) {
          return previous;
        }
        if (previous[previous.length - 1] === params.to) {
          return previous;
        }
        const existingSceneIndex = previous.lastIndexOf(params.to);
        if (existingSceneIndex >= 0) {
          return previous.slice(0, existingSceneIndex + 1);
        }
        return [...previous, params.to];
      });
    },
    [armLoadingTimeout, clearLoadingTimeout, stopLoadingWithFailure]
  );
  const completeSceneTransitionLoading = reactExports.useCallback(
    (requestId) => {
      if (sceneTransitionRequestIdRef.current !== requestId) {
        return;
      }
      clearLoadingTimeout();
      sceneTransitionRequestIdRef.current = 0;
      setSceneTransitionLoadState({ requestId: 0, phase: "idle" });
      setIsBootstrapping(false);
    },
    [clearLoadingTimeout]
  );
  const handleMainSceneReentrySimulationStateChange = reactExports.useCallback(
    (params) => {
      if (params.source !== "app_resume") {
        return;
      }
      if (params.phase === "started") {
        isResumeReentrySimulationRunningRef.current = true;
        showResumeGuard("main_scene_reentry");
        return;
      }
      isResumeReentrySimulationRunningRef.current = false;
      hideResumeGuardAfterLayout(
        params.result === "failed" ? "main_scene_reentry_failed" : "main_scene_reentry_finished"
      );
    },
    [hideResumeGuardAfterLayout, showResumeGuard]
  );
  const updateGameContainerSize = reactExports.useCallback((force = false) => {
    var _a;
    const viewportElement = gameViewportRef.current;
    if (!viewportElement) {
      return;
    }
    if (!force && isFullscreenAdLayoutFrozenRef.current) {
      return;
    }
    const controlButtonsHeight = ((_a = controlButtonsWrapperRef.current) == null ? void 0 : _a.getBoundingClientRect().height) ?? 0;
    const availableHeight = Math.max(
      0,
      viewportElement.clientHeight - controlButtonsHeight
    );
    const nextSize = Math.max(
      0,
      Math.floor(Math.min(viewportElement.clientWidth, availableHeight))
    );
    setGameContainerSize(
      (previous) => previous === nextSize ? previous : nextSize
    );
  }, []);
  const clearFullscreenAdLayoutRelease = reactExports.useCallback(() => {
    if (fullscreenAdLayoutReleaseTimeoutRef.current !== null) {
      window.clearTimeout(fullscreenAdLayoutReleaseTimeoutRef.current);
      fullscreenAdLayoutReleaseTimeoutRef.current = null;
    }
    if (fullscreenAdLayoutReleaseRafRef.current !== null) {
      window.cancelAnimationFrame(fullscreenAdLayoutReleaseRafRef.current);
      fullscreenAdLayoutReleaseRafRef.current = null;
    }
  }, []);
  const clearPendingUnsupportedViewportOverlayShow = reactExports.useCallback(() => {
    if (unsupportedViewportOverlayShowTimeoutRef.current !== null) {
      window.clearTimeout(unsupportedViewportOverlayShowTimeoutRef.current);
      unsupportedViewportOverlayShowTimeoutRef.current = null;
    }
  }, []);
  const updateUnsupportedViewportOverlay = reactExports.useCallback(() => {
    const nextReason = getUnsupportedViewportReason({
      nativeKeyboardInset: nativeKeyboardInsetRef.current
    });
    clearPendingUnsupportedViewportOverlayShow();
    if (nextReason === null) {
      setUnsupportedViewportReason(null);
      return;
    }
    unsupportedViewportOverlayShowTimeoutRef.current = window.setTimeout(() => {
      unsupportedViewportOverlayShowTimeoutRef.current = null;
      setUnsupportedViewportReason(
        getUnsupportedViewportReason({
          nativeKeyboardInset: nativeKeyboardInsetRef.current
        })
      );
    }, UNSUPPORTED_VIEWPORT_OVERLAY_SHOW_DEBOUNCE_MS);
  }, [clearPendingUnsupportedViewportOverlayShow]);
  const freezeLayoutForFullscreenAd = reactExports.useCallback(() => {
    clearFullscreenAdLayoutRelease();
    isFullscreenAdLayoutFrozenRef.current = true;
    setFrozenAppShellHeight(getCurrentViewportHeight());
  }, [clearFullscreenAdLayoutRelease]);
  const releaseLayoutAfterFullscreenAd = reactExports.useCallback(() => {
    clearFullscreenAdLayoutRelease();
    fullscreenAdLayoutReleaseTimeoutRef.current = window.setTimeout(() => {
      fullscreenAdLayoutReleaseRafRef.current = window.requestAnimationFrame(
        () => {
          fullscreenAdLayoutReleaseRafRef.current = window.requestAnimationFrame(() => {
            isFullscreenAdLayoutFrozenRef.current = false;
            setFrozenAppShellHeight(null);
            updateGameContainerSize(true);
          });
        }
      );
    }, 260);
  }, [clearFullscreenAdLayoutRelease, updateGameContainerSize]);
  const stopRecoveryVibration = reactExports.useCallback(() => {
    if (recoveryVibrationIntervalRef.current !== null) {
      window.clearInterval(recoveryVibrationIntervalRef.current);
      recoveryVibrationIntervalRef.current = null;
    }
  }, []);
  const triggerTransientVibration = reactExports.useCallback(
    (params) => {
      void biteVibrationAdapter.vibrate(params.durationMs, params.strength);
    },
    []
  );
  const triggerMainSceneSfx = reactExports.useCallback((kind) => {
    switch (kind) {
      case "food-throw":
        playFoodThrowSound();
        return;
      case "syringe-insert":
        playSyringeInsertSound();
        return;
    }
  }, []);
  const getFlappyBirdBestScore = reactExports.useCallback(async () => {
    try {
      const storage = createClientStorage();
      const storedData = await storage.getData(WORLD_DATA_STORAGE_KEY);
      return getStoredFlappyBirdBestScore(storedData);
    } catch (error) {
      console.warn(
        "[GameContainer] Failed to read FlappyBird best score from storage",
        error
      );
      return 0;
    }
  }, []);
  const persistFlappyBirdBestScore = reactExports.useCallback(async (score) => {
    const nextBestScore = Math.max(0, Math.floor(score));
    try {
      const storage = createClientStorage();
      const storedData = await storage.getData(WORLD_DATA_STORAGE_KEY);
      const sanitizedResult = sanitizeStoredWorldData(storedData);
      if (sanitizedResult.action === "reset_required" || !sanitizedResult.sanitizedData) {
        return;
      }
      const currentBestScore = getStoredFlappyBirdBestScore(
        sanitizedResult.sanitizedData
      );
      if (nextBestScore <= currentBestScore) {
        return;
      }
      await storage.setData(
        WORLD_DATA_STORAGE_KEY,
        withStoredFlappyBirdBestScore(
          sanitizedResult.sanitizedData,
          nextBestScore
        )
      );
    } catch (error) {
      console.warn(
        "[GameContainer] Failed to persist FlappyBird best score",
        error
      );
    }
  }, []);
  const incrementFlappyBirdGameOverAdCount = reactExports.useCallback(async () => {
    try {
      const storage = createClientStorage();
      const storedData = await storage.getData(
        FLAPPY_BIRD_GAME_OVER_AD_COUNTER_STORAGE_KEY
      );
      const nextCount = getStoredFlappyBirdGameOverAdCount(storedData) + 1;
      await storage.setData(
        FLAPPY_BIRD_GAME_OVER_AD_COUNTER_STORAGE_KEY,
        nextCount
      );
      return nextCount;
    } catch (error) {
      console.warn(
        "[GameContainer] Failed to persist FlappyBird game-over ad count",
        error
      );
      return null;
    }
  }, []);
  const scheduleFlappyBirdGameOverAd = reactExports.useCallback(async () => {
    const nextCount = await incrementFlappyBirdGameOverAdCount();
    if (nextCount === null || nextCount % FLAPPY_BIRD_GAME_OVER_AD_THRESHOLD !== 0) {
      return;
    }
    clearPendingFlappyBirdGameOverAd();
    flappyBirdGameOverAdTimeoutRef.current = window.setTimeout(() => {
      var _a;
      flappyBirdGameOverAdTimeoutRef.current = null;
      void (((_a = window.adManager) == null ? void 0 : _a.requestAd("flappy_bird_game_over", {
        isCharacterUrgent: false,
        metadata: {
          trigger: "flappy_bird_game_over",
          gameOverCount: nextCount,
          threshold: FLAPPY_BIRD_GAME_OVER_AD_THRESHOLD,
          timestamp: Date.now(),
          cooldownMs: FLAPPY_BIRD_GAME_OVER_AD_COOLDOWN_MS
        }
      })) ?? Promise.resolve(false));
    }, FLAPPY_BIRD_GAME_OVER_AD_DELAY_MS);
  }, [clearPendingFlappyBirdGameOverAd, incrementFlappyBirdGameOverAdCount]);
  const handleFlappyBirdGameOverRestart = reactExports.useCallback(() => {
    if (!flappyBirdGameOverState) {
      return;
    }
    setFlappyBirdGameOverState(null);
    flappyBirdGameOverState.onRestart();
  }, [flappyBirdGameOverState]);
  const handleFlappyBirdGameOverExit = reactExports.useCallback(() => {
    if (!flappyBirdGameOverState) {
      return;
    }
    const { onExit } = flappyBirdGameOverState;
    setFlappyBirdGameOverState(null);
    void Promise.resolve(onExit());
  }, [flappyBirdGameOverState]);
  reactExports.useEffect(() => {
    return () => {
      clearPendingFlappyBirdGameOverAd();
    };
  }, [clearPendingFlappyBirdGameOverAd]);
  const handleFlappyBirdSettingsMenuResume = reactExports.useCallback(() => {
    if (!flappyBirdSettingsMenuState) {
      return;
    }
    const { onResume } = flappyBirdSettingsMenuState;
    setFlappyBirdSettingsMenuState(null);
    void Promise.resolve(onResume());
  }, [flappyBirdSettingsMenuState]);
  const handleFlappyBirdSettingsMenuChangeBgm = reactExports.useCallback(
    (enabled) => {
      if (!flappyBirdSettingsMenuState) {
        return;
      }
      void Promise.resolve(flappyBirdSettingsMenuState.onChangeBgm(enabled));
    },
    [flappyBirdSettingsMenuState]
  );
  const handleFlappyBirdSettingsMenuChangeSfx = reactExports.useCallback(
    (enabled) => {
      if (!flappyBirdSettingsMenuState) {
        return;
      }
      setControlButtonSoundEnabled(enabled);
      void Promise.resolve(flappyBirdSettingsMenuState.onChangeSfx(enabled));
    },
    [flappyBirdSettingsMenuState]
  );
  const handleFlappyBirdSettingsMenuSelectTimeOfDay = reactExports.useCallback(
    (timeOfDay) => {
      if (!(flappyBirdSettingsMenuState == null ? void 0 : flappyBirdSettingsMenuState.onSelectTimeOfDay)) {
        return;
      }
      void Promise.resolve(
        flappyBirdSettingsMenuState.onSelectTimeOfDay(timeOfDay)
      );
    },
    [flappyBirdSettingsMenuState]
  );
  const handleFlappyBirdSettingsMenuExit = reactExports.useCallback(() => {
    if (!flappyBirdSettingsMenuState) {
      return;
    }
    const { onExit } = flappyBirdSettingsMenuState;
    setFlappyBirdSettingsMenuState(null);
    void Promise.resolve(onExit());
  }, [flappyBirdSettingsMenuState]);
  const startRecoveryVibration = reactExports.useCallback(() => {
    if (recoveryVibrationIntervalRef.current !== null) {
      return;
    }
    void biteVibrationAdapter.vibrate(
      RECOVERY_VIBRATION_DURATION_MS,
      RECOVERY_VIBRATION_STRENGTH
    );
    recoveryVibrationIntervalRef.current = window.setInterval(() => {
      void biteVibrationAdapter.vibrate(
        RECOVERY_VIBRATION_DURATION_MS,
        RECOVERY_VIBRATION_STRENGTH
      );
    }, RECOVERY_VIBRATION_INTERVAL_MS);
  }, []);
  reactExports.useEffect(() => {
    if (sceneTransitionLoadState.phase !== "core_ready" || !gameInstance) {
      return;
    }
    const requestId = sceneTransitionLoadState.requestId;
    let cancelled = false;
    const finalizeSceneTransitionLoading = async () => {
      await waitForLayoutStabilization();
      if (cancelled) {
        return;
      }
      completeSceneTransitionLoading(requestId);
    };
    void finalizeSceneTransitionLoading();
    return () => {
      cancelled = true;
    };
  }, [completeSceneTransitionLoading, gameInstance, sceneTransitionLoadState]);
  reactExports.useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        return;
      }
      interruptLoadingFlow("app_hidden");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [interruptLoadingFlow]);
  const prepareDiagnosticsDraft = reactExports.useCallback(
    async (scope) => {
      var _a, _b, _c;
      const storage = createClientStorage();
      const storedGameData = await storage.getData(WORLD_DATA_STORAGE_KEY);
      const snapshot = gameInstance == null ? void 0 : gameInstance.getDiagnosticsSnapshot();
      const currentGameData = (snapshot == null ? void 0 : snapshot.mainSceneData) ?? null;
      const nativeBridgeDiagnostics = Array.isArray(
        window.__digiviceNativeBridgeDiagnostics
      ) ? window.__digiviceNativeBridgeDiagnostics : [];
      const latestGameData = currentGameData ?? storedGameData ?? null;
      const latestGameDataSource = currentGameData ? "current_game" : storedGameData ? "stored_game" : "none";
      const currentSceneKey = String((snapshot == null ? void 0 : snapshot.currentSceneKey) ?? "unknown");
      const payload = {
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        appInfo: {
          project: "MonTTo",
          clientAppVersion: "1.0.4-debug",
          clientBuildNumber: 18,
          appMode: "development",
          debugEnabled: isNativeFeatureDebugMode$1,
          storageKind: getClientStorageKind(),
          userAgent: navigator.userAgent,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          currentSceneKey,
          logger: getDiagnosticsLoggerInfo(),
          gameSettings
        },
        summary: summarizeGameData(currentGameData ?? storedGameData),
        logs: getDiagnosticsLogs(),
        importantLogs: getImportantDiagnosticsLogs(),
        currentGameData,
        storedGameData,
        nativeBridgeDiagnostics,
        latestGameData,
        latestGameDataSource,
        lastValidation: ((_a = lastValidationResultRef.current) == null ? void 0 : _a.diagnostics) ?? null,
        lastValidationAction: ((_b = lastValidationResultRef.current) == null ? void 0 : _b.action) ?? null,
        lastValidationResetReason: ((_c = lastValidationResultRef.current) == null ? void 0 : _c.resetReason) ?? null
      };
      const releaseFileLabel = getClientReleaseFileLabel();
      const timestampSuffix = buildDiagnosticsTimestampSuffix(payload.generatedAt);
      if (scope === "flappy_bird") {
        return {
          subject: createFlappyBirdLogsSubject(payload.generatedAt),
          body: createFlappyBirdLogsBody(),
          attachments: [
            {
              fileName: `montto-native-bridge-diagnostics-${releaseFileLabel}-${timestampSuffix}.json`,
              text: JSON.stringify(payload.nativeBridgeDiagnostics, null, 2),
              mimeType: "application/json"
            }
          ]
        };
      }
      const payloadText = JSON.stringify(payload, null, 2);
      return {
        subject: createDiagnosticsSubject(payload.generatedAt),
        body: createDiagnosticsBody(),
        attachments: [
          {
            fileName: `montto-diagnostics-${releaseFileLabel}-${timestampSuffix}.json`,
            text: payloadText,
            mimeType: "application/json"
          },
          {
            fileName: `montto-latest-game-data-${releaseFileLabel}-${timestampSuffix}.json`,
            text: JSON.stringify(latestGameData, null, 2),
            mimeType: "application/json"
          },
          {
            fileName: `montto-important-logs-${releaseFileLabel}-${timestampSuffix}.json`,
            text: JSON.stringify(payload.importantLogs, null, 2),
            mimeType: "application/json"
          },
          {
            fileName: `montto-native-bridge-diagnostics-${releaseFileLabel}-${timestampSuffix}.json`,
            text: JSON.stringify(payload.nativeBridgeDiagnostics, null, 2),
            mimeType: "application/json"
          }
        ]
      };
    },
    [gameInstance, gameSettings]
  );
  const handleSendDiagnostics = reactExports.useCallback(async () => {
    if (isSendingDiagnostics || pendingDiagnosticsDraft) {
      return;
    }
    setIsSendingDiagnostics(true);
    try {
      setPendingDiagnosticsDraft(await prepareDiagnosticsDraft("full"));
    } catch (error) {
      logImportantDiagnostics(
        "error",
        "[ImportantDiagnostics][GameContainer] Failed to prepare diagnostics payload",
        error
      );
      console.error(
        "[GameContainer] Failed to prepare diagnostics payload",
        error
      );
      showAlert(t("diagnostics.prepareFailed"), t("common.error"));
    } finally {
      setIsSendingDiagnostics(false);
    }
  }, [
    isSendingDiagnostics,
    pendingDiagnosticsDraft,
    prepareDiagnosticsDraft,
    showAlert,
    t
  ]);
  const handleSendFlappyBirdLogs = reactExports.useCallback(async () => {
    if (isSendingDiagnostics || pendingDiagnosticsDraft) {
      return;
    }
    setIsSendingDiagnostics(true);
    try {
      setPendingDiagnosticsDraft(await prepareDiagnosticsDraft("flappy_bird"));
    } catch (error) {
      logImportantDiagnostics(
        "error",
        "[ImportantDiagnostics][GameContainer] Failed to prepare flappybird log payload",
        error
      );
      console.error(
        "[GameContainer] Failed to prepare flappybird log payload",
        error
      );
      showAlert(t("diagnostics.flappyPrepareFailed"), t("common.error"));
    } finally {
      setIsSendingDiagnostics(false);
    }
  }, [
    isSendingDiagnostics,
    pendingDiagnosticsDraft,
    prepareDiagnosticsDraft,
    showAlert,
    t
  ]);
  const handleShowOfflineAdFallback = reactExports.useCallback(() => {
    const fallbackBridge = typeof window !== "undefined" ? window.digiviceAdFallbackBridge : void 0;
    if (!(fallbackBridge == null ? void 0 : fallbackBridge.showOfflineInterstitialFallback)) {
      console.warn("[GameContainer] Offline ad fallback bridge is unavailable");
      return;
    }
    void fallbackBridge.showOfflineInterstitialFallback({
      trigger: "debug_settings",
      cooldownMs: 0,
      timestamp: Date.now()
    }).catch((error) => {
      console.warn("[GameContainer] Failed to show offline ad fallback", {
        error
      });
    });
  }, []);
  const handleCancelDiagnosticsDraft = reactExports.useCallback(() => {
    dismissDiagnosticsDraft();
  }, [dismissDiagnosticsDraft]);
  const handleConfirmDiagnosticsDraft = reactExports.useCallback(async () => {
    if (!pendingDiagnosticsDraft) {
      return;
    }
    let followUpAlert = null;
    try {
      const openRoute = await openMailDraft(
        pendingDiagnosticsDraft.subject,
        pendingDiagnosticsDraft.body,
        pendingDiagnosticsDraft.attachments
      );
      if (openRoute !== "gmail_app") {
        followUpAlert = {
          title: t("common.notice"),
          message: t("diagnostics.gmailNotice")
        };
      }
    } catch (error) {
      console.error("[GameContainer] Failed to open diagnostics draft", error);
      followUpAlert = {
        title: t("common.error"),
        message: t("diagnostics.gmailOpenFailed")
      };
    } finally {
      setPendingDiagnosticsDraft(null);
      if (followUpAlert) {
        const alertToShow = followUpAlert;
        window.setTimeout(() => {
          showAlert(alertToShow.message, alertToShow.title);
        }, 0);
      }
    }
  }, [pendingDiagnosticsDraft, showAlert, t]);
  const resetGameData = reactExports.useCallback(
    async (reason) => {
      console.warn("[GameContainer] resetGameData:start", {
        reason,
        hasGameInstance: !!gameInstance,
        storageKind: getClientStorageKind()
      });
      try {
        if (gameInstance) {
          await gameInstance.destroyForReset();
        } else {
          const storage = createClientStorage();
          await storage.removeData(WORLD_DATA_STORAGE_KEY);
        }
        if (gameContainerRef.current) {
          gameContainerRef.current.innerHTML = "";
        }
        clearLoadingTimeout();
        cancelPendingGameInitialization("reset_game_data");
        initialSetupDataRef.current = null;
        pendingInitialSetupPromiseRef.current = null;
        pendingSetupResolverRef.current = null;
        shouldRestartFromSetupRef.current = true;
        isInitializedRef.current = false;
        setSceneHistoryStack([...ROOT_SCENE_HISTORY_STACK]);
        setLoadingFailureAlert(null);
        setMonsterInfoState(null);
        setShowSettingMenu(false);
        setShowFinalResetConfirm(false);
        setButtonParams(null);
        presentSetupLayer(reason, {
          storageKind: getClientStorageKind()
        });
        setIsBootstrapping(false);
        sceneTransitionRequestIdRef.current = 0;
        setSceneTransitionLoadState({ requestId: 0, phase: "idle" });
        setGameInstance(null);
        setSanitizeResetAlert(null);
        setFlappyBirdSettingsMenuState(null);
        setFlappyBirdGameOverState(null);
        console.warn("[GameContainer] resetGameData:success", {
          reason,
          storageKind: getClientStorageKind()
        });
      } catch (error) {
        console.error("[GameContainer] Failed to reset game data:", error);
        showAlert(t("diagnostics.resetFailed"), t("common.error"));
      }
    },
    [
      cancelPendingGameInitialization,
      clearLoadingTimeout,
      gameInstance,
      presentSetupLayer,
      showAlert,
      t
    ]
  );
  const handleResetGameData = reactExports.useCallback(async () => {
    await resetGameData("user_reset");
  }, [resetGameData]);
  const handleSanitizeResetConfirm = reactExports.useCallback(async () => {
    await resetGameData("sanitize_reset");
  }, [resetGameData]);
  const prepareSavedGameData = reactExports.useCallback(async () => {
    const startedAt = entryFlowDiagnostics.beginPrepareSavedGameData(
      getClientStorageKind()
    );
    try {
      const storage = createClientStorage();
      const storageKind = getClientStorageKind();
      const savedData = await storage.getData(WORLD_DATA_STORAGE_KEY);
      const legacyMonsterBookDetected = hasLegacyMonsterBookState(savedData);
      const monsterBookMigrationResult = await migrateLegacyMonsterBookIfNeeded(storage, savedData);
      const savedDataSummary = summarizeSavedData(savedData);
      logImportantDiagnostics(
        "log",
        "[ImportantDiagnostics][GameDataBootstrap]",
        {
          key: WORLD_DATA_STORAGE_KEY,
          storageKind,
          activeStorageSummary: savedDataSummary,
          browserLocalStorageSummary: summarizeBrowserLocalStorageEntry(
            WORLD_DATA_STORAGE_KEY
          )
        }
      );
      const result = sanitizeStoredWorldData(savedData);
      lastValidationResultRef.current = result;
      if (monsterBookMigrationResult.didMigrate) {
        logImportantDiagnostics(
          "warn",
          "[ImportantDiagnostics][MonsterBookMigration] Legacy monster book data was migrated to dedicated storage.",
          {
            key: WORLD_DATA_STORAGE_KEY,
            monsterBookStorageKey: "MonsterBookData",
            savedDataSummary
          }
        );
      }
      if (result.changed || result.action !== "playable") {
        logImportantDiagnostics(
          result.action === "reset_required" ? "error" : "warn",
          "[ImportantDiagnostics][GameDataValidation]",
          {
            key: WORLD_DATA_STORAGE_KEY,
            storageKind,
            action: result.action,
            changed: result.changed,
            resetReason: result.resetReason ?? null,
            diagnostics: result.diagnostics,
            savedDataSummary
          }
        );
      }
      if ((result.changed || legacyMonsterBookDetected) && result.sanitizedData && result.action !== "reset_required") {
        await storage.setData(WORLD_DATA_STORAGE_KEY, result.sanitizedData);
        logImportantDiagnostics(
          "warn",
          "[ImportantDiagnostics][GameDataRepair] Saved data was repaired and written back.",
          {
            action: result.action,
            diagnostics: result.diagnostics
          }
        );
      }
      if (result.action === "reset_required") {
        logImportantDiagnostics(
          "error",
          "[ImportantDiagnostics][GameDataRepair] Saved data is corrupted and requires reset.",
          {
            resetReason: result.resetReason ?? null,
            diagnostics: result.diagnostics
          }
        );
        setSanitizeResetAlert({
          title: t("dataRecovery.title"),
          message: result.resetReason ?? t("dataRecovery.corruptedReset")
        });
        setIsBootstrapping(false);
      }
      entryFlowDiagnostics.completePrepareSavedGameData({
        startedAt,
        storageKind,
        resultAction: result.action,
        savedDataSummary
      });
      return result.action;
    } catch (error) {
      entryFlowDiagnostics.failPrepareSavedGameData({
        startedAt,
        storageKind: getClientStorageKind(),
        error
      });
      logImportantDiagnostics(
        "error",
        "[ImportantDiagnostics][GameDataValidation] Failed to inspect saved game data.",
        {
          key: WORLD_DATA_STORAGE_KEY,
          storageKind: getClientStorageKind(),
          error
        }
      );
      console.error("[GameContainer] Failed to inspect saved game data:", {
        key: WORLD_DATA_STORAGE_KEY,
        storageKind: getClientStorageKind(),
        error
      });
      setSanitizeResetAlert({
        title: t("dataRecovery.title"),
        message: t("dataRecovery.readFailedReset")
      });
      setIsBootstrapping(false);
      return "reset_required";
    }
  }, [entryFlowDiagnostics, t]);
  const hydrateInitialSetupData = reactExports.useCallback(
    async (formData) => {
      const startedAt = entryFlowDiagnostics.beginHydrateInitialSetupData(formData);
      if (!formData.useLocalTime || formData.cachedSunTimes) {
        entryFlowDiagnostics.skipHydrateInitialSetupData({
          startedAt,
          formData,
          reason: !formData.useLocalTime ? "local_time_disabled" : "cached_sun_times_already_present"
        });
        return formData;
      }
      const promptForPermission = false;
      const nativeSunTimesStartedAt = entryFlowDiagnostics.beginNativeSunTimesRequest(promptForPermission);
      try {
        const sunTimes = await getNativeSunTimes(promptForPermission, {
          ...entryFlowDiagnostics.createNativeSunTimesTraceContext({
            source: "setup_loading",
            phase: "hydrate_initial_setup_data"
          })
        });
        entryFlowDiagnostics.completeNativeSunTimesRequest(
          nativeSunTimesStartedAt,
          sunTimes,
          promptForPermission
        );
        if (!sunTimes) {
          console.warn(
            "[GameContainer] Initial sun times were unavailable during setup loading. Continuing without cached sun times."
          );
          entryFlowDiagnostics.completeHydrateInitialSetupData({
            startedAt,
            sunTimes: null
          });
          return {
            ...formData,
            cachedSunTimes: null
          };
        }
        console.log(
          "[GameContainer] Initial sun times prepared during setup loading.",
          {
            date: sunTimes.date,
            locationSource: sunTimes.locationSource,
            hasLocationPermission: sunTimes.hasLocationPermission,
            sunriseAt: sunTimes.sunriseAt,
            sunsetAt: sunTimes.sunsetAt
          }
        );
        entryFlowDiagnostics.completeHydrateInitialSetupData({
          startedAt,
          sunTimes
        });
        return {
          ...formData,
          cachedSunTimes: sunTimes
        };
      } catch (error) {
        entryFlowDiagnostics.failNativeSunTimesRequest(
          nativeSunTimesStartedAt,
          error,
          promptForPermission
        );
        console.warn(
          "[GameContainer] Failed to prepare initial sun times during setup loading. Continuing without cached sun times.",
          error
        );
        entryFlowDiagnostics.failHydrateInitialSetupData(startedAt, error);
        return {
          ...formData,
          cachedSunTimes: null
        };
      }
    },
    [entryFlowDiagnostics]
  );
  const requestInitialGameData = reactExports.useCallback(
    async (options) => {
      const { allowSetupLayer, source } = options;
      if (initialSetupDataRef.current) {
        return initialSetupDataRef.current;
      }
      if (pendingInitialSetupPromiseRef.current) {
        return pendingInitialSetupPromiseRef.current;
      }
      if (!allowSetupLayer) {
        logSetupLayerVisibility(
          "runtime_missing_initial_data_blocked",
          {
            source
          },
          "error"
        );
        throw new MissingInitialGameDataError();
      }
      setLoadingFailureAlert(null);
      setIsBootstrapping(false);
      presentSetupLayer("bootstrap_setup_required", {
        source
      });
      entryFlowDiagnostics.markWaitingForSetupInput();
      const setupPromise = new Promise((resolve) => {
        pendingSetupResolverRef.current = (formData) => {
          entryFlowDiagnostics.startSetupFlow(
            "request_initial_game_data"
          );
          setShowSetupLayer(false);
          setIsBootstrapping(true);
          pendingSetupResolverRef.current = null;
          entryFlowDiagnostics.logSetupConfirmed(formData);
          void (async () => {
            const hydratedFormData = await hydrateInitialSetupData(formData);
            initialSetupDataRef.current = hydratedFormData;
            pendingInitialSetupPromiseRef.current = null;
            entryFlowDiagnostics.logSetupDataReady(hydratedFormData);
            resolve(hydratedFormData);
          })();
        };
      });
      pendingInitialSetupPromiseRef.current = setupPromise;
      return setupPromise;
    },
    [
      entryFlowDiagnostics,
      hydrateInitialSetupData,
      logSetupLayerVisibility,
      presentSetupLayer
    ]
  );
  const initializeGame = reactExports.useCallback(() => {
    if (!gameContainerRef.current) return;
    if (!gameContainerSize || gameContainerSize <= 0) return;
    if (isInitializedRef.current) return;
    if (isInitializingGameRef.current) return;
    setLoadingFailureAlert(null);
    setIsBootstrapping(true);
    const attemptId = gameInitializationAttemptIdRef.current + 1;
    gameInitializationAttemptIdRef.current = attemptId;
    isInitializingGameRef.current = true;
    entryFlowDiagnostics.beginInitializeGame(attemptId, gameContainerSize);
    const debugParentElement = gameContainerRef.current.closest("#app-container") ?? gameContainerRef.current;
    const game = new Game({
      parentElement: gameContainerRef.current,
      debugParentElement,
      debugMode: isNativeFeatureDebugMode$1,
      locale,
      initialSceneKey: CONFIGURED_INITIAL_SCENE_KEY,
      onCreateInitialGameData: async () => {
        return initialSetupDataRef.current ?? await requestInitialGameData({
          allowSetupLayer: false,
          source: "game_runtime"
        });
      },
      showAlert: (message, title) => {
        showAlert(message, title);
      },
      showSettings: () => {
        openSettingMenu();
      },
      showMonsterInfo: () => {
        openMonsterInfo(game.getMainCharacterInfoSnapshot());
      },
      triggerBiteVibration: () => {
        void biteVibrationAdapter.vibrate();
      },
      triggerMainSceneSfx,
      triggerTransientVibration,
      startRecoveryVibration,
      stopRecoveryVibration,
      getFlappyBirdBestScore,
      persistFlappyBirdBestScore,
      showFlappyBirdGameOver: (params) => {
        setFlappyBirdGameOverState(params);
        void scheduleFlappyBirdGameOverAd();
      },
      hideFlappyBirdGameOver: () => {
        setFlappyBirdGameOverState(null);
      },
      showFlappyBirdSettingsMenu: (params) => {
        setControlButtonSoundEnabled(params.isSfxEnabled);
        setFlappyBirdSettingsMenuState(params);
      },
      hideFlappyBirdSettingsMenu: () => {
        setFlappyBirdSettingsMenuState(null);
      },
      onSceneTransitionStateChange: handleSceneTransitionStateChange,
      onMainSceneReentrySimulationStateChange: handleMainSceneReentrySimulationStateChange,
      loadingTraceContext: entryFlowDiagnostics.createGameLoadingTraceContext(attemptId),
      changeControlButtons: (controlButtonParams) => {
        if (!controlButtonParams) {
          setButtonParams(null);
          setControlButtonSoundEnabled(true);
          return;
        }
        const hasMiniGameJumpButton = controlButtonParams.some(
          (buttonParam) => buttonParam.type === ControlButtonType.Jump || buttonParam.type === ControlButtonType.DoubleJump
        );
        if (!hasMiniGameJumpButton) {
          setControlButtonSoundEnabled(true);
        }
        setButtonParams((previous) => {
          if (previous && previous.every(
            (buttonParam, index) => buttonParam.type === controlButtonParams[index].type && buttonParam.initialSliderValue === controlButtonParams[index].initialSliderValue && buttonParam.sliderSessionKey === controlButtonParams[index].sliderSessionKey && buttonParam.hasCleaningTarget === controlButtonParams[index].hasCleaningTarget
          )) {
            return previous;
          }
          return controlButtonParams;
        });
      }
    });
    pendingGameInitializationRef.current = { attemptId, game };
    armLoadingTimeout(
      {
        phase: "game_initialize",
        initializationAttemptId: attemptId
      },
      { resetStart: true }
    );
    clearInitializeGameStartTimeout();
    initializeGameStartTimeoutRef.current = window.setTimeout(() => {
      var _a;
      initializeGameStartTimeoutRef.current = null;
      if (((_a = pendingGameInitializationRef.current) == null ? void 0 : _a.attemptId) !== attemptId) {
        return;
      }
      void game.initialize().then(() => {
        var _a2;
        if (((_a2 = pendingGameInitializationRef.current) == null ? void 0 : _a2.attemptId) !== attemptId) {
          return;
        }
        entryFlowDiagnostics.completeInitializeGame(attemptId);
        pendingGameInitializationRef.current = null;
        isInitializingGameRef.current = false;
        isInitializedRef.current = true;
        setGameInstance(game);
      }).catch((error) => {
        var _a2;
        if (((_a2 = pendingGameInitializationRef.current) == null ? void 0 : _a2.attemptId) !== attemptId) {
          return;
        }
        entryFlowDiagnostics.failInitializeGame(attemptId, error);
        pendingGameInitializationRef.current = null;
        isInitializingGameRef.current = false;
        setGameInstance(null);
        try {
          game.destroy();
        } catch (destroyError) {
          console.warn(
            "[GameContainer] Failed to clean up a partially initialized game instance.",
            destroyError
          );
        }
        if (isMissingInitialGameDataError(error)) {
          console.warn(
            "[GameContainer] Initial setup data is missing. Returning to setup flow.",
            {
              error,
              storageKind: getClientStorageKind()
            }
          );
          clearLoadingTimeout();
          sceneTransitionRequestIdRef.current = 0;
          setSceneTransitionLoadState({ requestId: 0, phase: "idle" });
          initialSetupDataRef.current = null;
          pendingInitialSetupPromiseRef.current = null;
          pendingSetupResolverRef.current = null;
          shouldRestartFromSetupRef.current = true;
          setLoadingFailureAlert(null);
          presentSetupLayer("game_initialize_missing_initial_data", {
            storageKind: getClientStorageKind()
          });
          setIsBootstrapping(false);
          return;
        }
        stopLoadingWithFailure({
          message: t("loading.finishFailed"),
          error,
          context: {
            phase: "game_initialize"
          }
        });
      });
    });
  }, [
    armLoadingTimeout,
    clearLoadingTimeout,
    clearInitializeGameStartTimeout,
    gameContainerSize,
    locale,
    getFlappyBirdBestScore,
    handleMainSceneReentrySimulationStateChange,
    handleSceneTransitionStateChange,
    openMonsterInfo,
    openSettingMenu,
    persistFlappyBirdBestScore,
    requestInitialGameData,
    startRecoveryVibration,
    presentSetupLayer,
    stopLoadingWithFailure,
    stopRecoveryVibration,
    showAlert,
    entryFlowDiagnostics,
    triggerMainSceneSfx,
    triggerTransientVibration,
    t
  ]);
  reactExports.useEffect(() => {
    const viewportElement = gameViewportRef.current;
    if (!viewportElement) {
      return;
    }
    updateGameContainerSize();
    if (typeof ResizeObserver === "undefined") {
      const handleWindowResize = () => {
        updateGameContainerSize();
      };
      window.addEventListener("resize", handleWindowResize);
      return () => {
        window.removeEventListener("resize", handleWindowResize);
      };
    }
    const resizeObserver = new ResizeObserver(() => {
      updateGameContainerSize();
    });
    resizeObserver.observe(viewportElement);
    if (controlButtonsWrapperRef.current) {
      resizeObserver.observe(controlButtonsWrapperRef.current);
    }
    return () => {
      resizeObserver.disconnect();
    };
  }, [buttonParams, updateGameContainerSize]);
  reactExports.useEffect(() => {
    var _a;
    if (!isAndroidUserAgent) {
      return;
    }
    const handleNativeViewportSync = (event) => {
      const detail = event.detail;
      nativeKeyboardInsetRef.current = Math.max(0, (detail == null ? void 0 : detail.bottomInset) ?? 0);
      updateUnsupportedViewportOverlay();
    };
    updateUnsupportedViewportOverlay();
    window.addEventListener("resize", updateUnsupportedViewportOverlay);
    window.addEventListener(
      "orientationchange",
      updateUnsupportedViewportOverlay
    );
    (_a = window.visualViewport) == null ? void 0 : _a.addEventListener(
      "resize",
      updateUnsupportedViewportOverlay
    );
    window.addEventListener(
      "digivice:native-viewport-sync",
      handleNativeViewportSync
    );
    return () => {
      var _a2;
      clearPendingUnsupportedViewportOverlayShow();
      window.removeEventListener("resize", updateUnsupportedViewportOverlay);
      window.removeEventListener(
        "orientationchange",
        updateUnsupportedViewportOverlay
      );
      (_a2 = window.visualViewport) == null ? void 0 : _a2.removeEventListener(
        "resize",
        updateUnsupportedViewportOverlay
      );
      window.removeEventListener(
        "digivice:native-viewport-sync",
        handleNativeViewportSync
      );
    };
  }, [
    clearPendingUnsupportedViewportOverlayShow,
    updateUnsupportedViewportOverlay
  ]);
  reactExports.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleFullscreenAdState = (event) => {
      const detail = event.detail;
      const state = detail == null ? void 0 : detail.state;
      if (state === "showing") {
        freezeLayoutForFullscreenAd();
        return;
      }
      if (state === "dismissed" || state === "failed") {
        releaseLayoutAfterFullscreenAd();
      }
    };
    window.addEventListener(
      "digivice:fullscreen-ad",
      handleFullscreenAdState
    );
    return () => {
      window.removeEventListener(
        "digivice:fullscreen-ad",
        handleFullscreenAdState
      );
      clearFullscreenAdLayoutRelease();
      isFullscreenAdLayoutFrozenRef.current = false;
      setFrozenAppShellHeight(null);
    };
  }, [
    clearFullscreenAdLayoutRelease,
    freezeLayoutForFullscreenAd,
    releaseLayoutAfterFullscreenAd
  ]);
  reactExports.useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const handleBackgroundEntry = (reason) => {
      showResumeGuard(reason, { sync: true });
    };
    const handleForegroundEntry = (reason) => {
      hideResumeGuardAfterLayout(reason);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleBackgroundEntry("document_hidden");
        return;
      }
      if (document.visibilityState === "visible") {
        handleForegroundEntry("document_visible");
      }
    };
    const handlePageHide = () => {
      handleBackgroundEntry("pagehide");
    };
    const handlePageShow = () => {
      handleForegroundEntry("pageshow");
    };
    const handleFocus = () => {
      handleForegroundEntry("window_focus");
    };
    const handleNativeAppLifecycle = (event) => {
      const detail = event.detail;
      const state = detail == null ? void 0 : detail.state;
      if (state === "inactive" || state === "hidden" || state === "paused") {
        handleBackgroundEntry(`native_${state}`);
        return;
      }
      if (state === "resumed") {
        handleForegroundEntry("native_resumed");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handleFocus);
    window.addEventListener(
      "digivice:native-app-lifecycle",
      handleNativeAppLifecycle
    );
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(
        "digivice:native-app-lifecycle",
        handleNativeAppLifecycle
      );
    };
  }, [hideResumeGuardAfterLayout, showResumeGuard]);
  reactExports.useEffect(() => {
    let isMounted = true;
    const bootstrap2 = async () => {
      if (!gameContainerRef.current) return;
      if (!gameContainerSize || gameContainerSize <= 0) return;
      if (isInitializedRef.current) return;
      if (CONFIGURED_INITIAL_SCENE_KEY !== SceneKey.MAIN) {
        initializeGame();
        return;
      }
      entryFlowDiagnostics.beginBootstrap(gameContainerSize);
      const savedGameDataState = await prepareSavedGameData();
      if (!isMounted) return;
      if (savedGameDataState === "reset_required") {
        return;
      }
      if (savedGameDataState === "setup_required") {
        const initialGameDataStartedAt = entryFlowDiagnostics.beginRequestInitialGameData();
        await requestInitialGameData({
          allowSetupLayer: true,
          source: "bootstrap"
        });
        if (!isMounted) return;
        entryFlowDiagnostics.completeRequestInitialGameData(
          initialGameDataStartedAt,
          !!initialSetupDataRef.current
        );
        const layoutStabilizationStartedAt = entryFlowDiagnostics.beginLayoutStabilization();
        await waitForLayoutStabilization();
        if (!isMounted) return;
        entryFlowDiagnostics.completeLayoutStabilization(
          layoutStabilizationStartedAt,
          getCurrentViewportHeight()
        );
      }
      initializeGame();
    };
    void bootstrap2();
    return () => {
      isMounted = false;
      stopRecoveryVibration();
    };
  }, [
    gameContainerSize,
    gameSessionKey,
    initializeGame,
    entryFlowDiagnostics,
    prepareSavedGameData,
    requestInitialGameData,
    stopRecoveryVibration
  ]);
  reactExports.useEffect(() => {
    return () => {
      resumeGuardReleaseRequestIdRef.current += 1;
      isResumeGuardVisibleRef.current = false;
      isResumeReentrySimulationRunningRef.current = false;
      clearLoadingTimeout();
      cancelPendingGameInitialization("component_unmount");
      pendingInitialSetupPromiseRef.current = null;
      pendingSetupResolverRef.current = null;
      stopRecoveryVibration();
    };
  }, [
    cancelPendingGameInitialization,
    clearLoadingTimeout,
    stopRecoveryVibration
  ]);
  reactExports.useEffect(() => {
    if (!gameInstance) {
      return;
    }
    if (sceneTransitionLoadState.phase !== "idle") {
      return;
    }
    if (gameInstance.getCurrentSceneKey() !== SceneKey.MAIN) {
      return;
    }
    let cancelled = false;
    const preloadMiniGameAssets = async () => {
      try {
        await gameInstance.preloadSceneAssets(SceneKey.FLAPPY_BIRD_GAME);
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.warn(
          "[GameContainer] Failed to preload mini game assets",
          error
        );
      }
    };
    void preloadMiniGameAssets();
    return () => {
      cancelled = true;
    };
  }, [gameInstance, sceneTransitionLoadState.phase]);
  const handleButtonPress = reactExports.useCallback(
    (buttonType) => {
      if (buttonType === ControlButtonType.Settings && (gameInstance == null ? void 0 : gameInstance.getCurrentSceneKey()) !== SceneKey.FLAPPY_BIRD_GAME) {
        openSettingMenu();
        return;
      }
      if (gameInstance) {
        gameInstance.handleControlButtonClick(buttonType);
      }
    },
    [gameInstance, openSettingMenu]
  );
  const handleSliderChange = reactExports.useCallback(
    (value) => {
      if (gameInstance == null ? void 0 : gameInstance.handleSliderValueChange) {
        gameInstance.handleSliderValueChange(value);
      }
    },
    [gameInstance]
  );
  const handleSliderEnd = reactExports.useCallback(() => {
    if (gameInstance == null ? void 0 : gameInstance.handleSliderEnd) {
      gameInstance.handleSliderEnd();
    }
  }, [gameInstance]);
  const handleSetupComplete = reactExports.useCallback(
    (formData) => {
      const pendingResolver = pendingSetupResolverRef.current;
      if (pendingResolver) {
        pendingResolver(formData);
        return;
      }
      entryFlowDiagnostics.startSetupFlow("handle_setup_complete");
      setShowSetupLayer(false);
      setLoadingFailureAlert(null);
      setIsBootstrapping(true);
      entryFlowDiagnostics.logSetupConfirmed(formData);
      void (async () => {
        const hydratedFormData = await hydrateInitialSetupData(formData);
        initialSetupDataRef.current = hydratedFormData;
        entryFlowDiagnostics.logSetupDataReady(hydratedFormData);
        if (shouldRestartFromSetupRef.current) {
          shouldRestartFromSetupRef.current = false;
          setGameSessionKey((previous) => previous + 1);
          return;
        }
        setIsBootstrapping(false);
      })();
    },
    [entryFlowDiagnostics, hydrateInitialSetupData]
  );
  reactExports.useEffect(() => {
    if (!monsterInfoState) {
      return;
    }
    if (!gameInstance) {
      setMonsterInfoState(null);
      return;
    }
    let rafId = 0;
    let cancelled = false;
    const pollSnapshot = () => {
      if (cancelled) {
        return;
      }
      const nextSnapshot = gameInstance.getMainCharacterInfoSnapshot();
      if (!nextSnapshot) {
        setMonsterInfoState(null);
        return;
      }
      setMonsterInfoState(
        (previous) => areMainCharacterInfoSnapshotsEqual(previous, nextSnapshot) ? previous : nextSnapshot
      );
      rafId = window.requestAnimationFrame(pollSnapshot);
    };
    rafId = window.requestAnimationFrame(pollSnapshot);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, [gameInstance, monsterInfoState]);
  const handleSendLoadingFailureLogs = reactExports.useCallback(() => {
    setLoadingFailureAlert(null);
    window.setTimeout(() => {
      void handleSendDiagnostics();
    }, 0);
  }, [handleSendDiagnostics]);
  const isLoading = isBootstrapping || isResumeGuardVisible || sceneTransitionLoadState.phase === "loading" || sceneTransitionLoadState.phase === "core_ready";
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
    "div",
    {
      className: "relative flex h-full min-h-0 w-full flex-col overflow-hidden",
      children: [
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
          "div",
          {
            ref: gameViewportRef,
            className: "grid min-h-0 min-w-0 flex-1 overflow-hidden",
            style: {
              gridTemplateRows: buttonParams ? "minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr)" : "minmax(0, 1fr) auto minmax(0, 1fr)"
            },
            children: [
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { "aria-hidden": "true", className: "min-h-0" }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
                lineNumber: 3502,
                columnNumber: 9
              }, void 0),
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "flex min-h-0 min-w-0 justify-center overflow-hidden", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                "div",
                {
                  className: "relative m-0 shrink-0 p-0",
                  style: gameContainerSize ? {
                    width: `${gameContainerSize}px`,
                    height: `${gameContainerSize}px`
                  } : void 0,
                  children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                    "div",
                    {
                      id: "game-container",
                      ref: gameContainerRef,
                      className: "absolute inset-0 m-0 p-0"
                    },
                    void 0,
                    false,
                    {
                      fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
                      lineNumber: 3515,
                      columnNumber: 13
                    },
                    void 0
                  )
                },
                void 0,
                false,
                {
                  fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
                  lineNumber: 3504,
                  columnNumber: 11
                },
                void 0
              ) }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
                lineNumber: 3503,
                columnNumber: 9
              }, void 0),
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { "aria-hidden": "true", className: "min-h-0" }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
                lineNumber: 3524,
                columnNumber: 9
              }, void 0),
              buttonParams && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { ref: controlButtonsWrapperRef, className: "z-10 w-full", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                ControlButtons,
                {
                  buttonParams,
                  soundEnabled: controlButtonSoundEnabled,
                  onButtonPress: handleButtonPress,
                  onSliderChange: handleSliderChange,
                  onSliderEnd: handleSliderEnd
                },
                void 0,
                false,
                {
                  fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
                  lineNumber: 3528,
                  columnNumber: 13
                },
                void 0
              ) }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
                lineNumber: 3527,
                columnNumber: 11
              }, void 0),
              buttonParams && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { "aria-hidden": "true", className: "min-h-0" }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
                lineNumber: 3537,
                columnNumber: 26
              }, void 0)
            ]
          },
          void 0,
          true,
          {
            fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
            lineNumber: 3493,
            columnNumber: 7
          },
          void 0
        ),
        isLoading && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "absolute inset-0 z-50 flex items-center justify-center bg-black text-white", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "text-center text-[2.25rem] tracking-[0.12em]", children: t("loading.label") }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
          lineNumber: 3541,
          columnNumber: 11
        }, void 0) }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
          lineNumber: 3540,
          columnNumber: 9
        }, void 0),
        unsupportedViewportReason && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "absolute inset-0 z-[1000] flex items-center justify-center bg-black text-white", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "px-6 text-center", children: [
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "text-lg tracking-[0.12em]", children: t("viewport.portraitOnly") }, void 0, false, {
            fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
            lineNumber: 3549,
            columnNumber: 13
          }, void 0),
          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "mt-6 text-[10px] leading-6 tracking-[0.12em]", children: unsupportedViewportReason === "landscape" ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(jsxDevRuntimeExports.Fragment, { children: [
            t("viewport.rotateDevice"),
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("br", {}, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
              lineNumber: 3554,
              columnNumber: 19
            }, void 0),
            t("viewport.backToPortrait")
          ] }, void 0, true, {
            fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
            lineNumber: 3552,
            columnNumber: 17
          }, void 0) : /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(jsxDevRuntimeExports.Fragment, { children: [
            t("viewport.unsupportedRatio"),
            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("br", {}, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
              lineNumber: 3560,
              columnNumber: 19
            }, void 0),
            t("viewport.useTallerPortrait")
          ] }, void 0, true, {
            fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
            lineNumber: 3558,
            columnNumber: 17
          }, void 0) }, void 0, false, {
            fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
            lineNumber: 3550,
            columnNumber: 13
          }, void 0)
        ] }, void 0, true, {
          fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
          lineNumber: 3548,
          columnNumber: 11
        }, void 0) }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
          lineNumber: 3547,
          columnNumber: 9
        }, void 0),
        showSetupLayer && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(SetupLayer, { onComplete: handleSetupComplete }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
          lineNumber: 3568,
          columnNumber: 26
        }, void 0),
        monsterInfoState && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
          MonsterInfoLayer,
          {
            snapshot: monsterInfoState,
            onClose: dismissMonsterInfo,
            onBack: closeMonsterInfo
          },
          void 0,
          false,
          {
            fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
            lineNumber: 3570,
            columnNumber: 9
          },
          void 0
        ),
        showSettingMenu && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
          SettingMenuLayer,
          {
            releaseLabel: getClientReleaseLabel(),
            vibrationEnabled: gameSettings.vibrationEnabled,
            sfxEnabled: gameSettings.sfxEnabled,
            locale,
            onChangeVibration: handleVibrationSettingChange,
            onChangeSfx: handleSfxSettingChange,
            onChangeLocale: setLocale,
            onSendDiagnostics: handleSendDiagnostics,
            isSendingDiagnostics,
            showFinalResetConfirm,
            onOpenResetConfirm: () => setShowFinalResetConfirm(true),
            onCloseResetConfirm: dismissResetConfirm,
            onResetConfirmBack: closeResetConfirm,
            onResetGameData: handleResetGameData,
            onClose: dismissSettingMenu,
            onBack: closeSettingMenu,
            onShowOfflineAdFallback: handleShowOfflineAdFallback,
            onRequestPinHomeWidget: async (size) => {
              const controller = window.homeWidgetController ?? window.homeWidgetRefreshController;
              const requestPinWidget = size === "1x1" ? controller == null ? void 0 : controller.requestPinWidget1x1 : (controller == null ? void 0 : controller.requestPinWidget2x1) ?? (controller == null ? void 0 : controller.requestPinWidget);
              if (!requestPinWidget) {
                return { status: "unavailable" };
              }
              try {
                const rawResult = await requestPinWidget();
                const parsedResult = typeof rawResult === "string" ? JSON.parse(rawResult) : rawResult;
                const status = typeof (parsedResult == null ? void 0 : parsedResult.status) === "string" ? parsedResult.status : "failed";
                if (status === "requested" || status === "unavailable" || status === "unsupported_api" || status === "unsupported_launcher") {
                  return { status };
                }
                return { status: "failed" };
              } catch {
                return { status: "failed" };
              }
            }
          },
          void 0,
          false,
          {
            fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
            lineNumber: 3577,
            columnNumber: 9
          },
          void 0
        ),
        alertState && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
          AlertLayer,
          {
            title: alertState.title,
            message: alertState.message,
            onClose: dismissAlert,
            onBack: hideAlert
          },
          void 0,
          false,
          {
            fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
            lineNumber: 3635,
            columnNumber: 9
          },
          void 0
        ),
        loadingFailureAlert && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "fixed inset-0 z-[60] flex items-center justify-center bg-black/50", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
          PopupLayer,
          {
            title: loadingFailureAlert.title,
            content: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "text-left leading-[1.6]", children: loadingFailureAlert.message }, void 0, false, {
              fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
              lineNumber: 3647,
              columnNumber: 15
            }, void 0),
            onConfirm: dismissLoadingFailureAlert,
            onCancel: handleSendLoadingFailureLogs,
            onBack: () => {
              setLoadingFailureAlert(null);
            },
            confirmText: t("common.okay"),
            cancelText: t("diagnostics.sendLog")
          },
          void 0,
          false,
          {
            fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
            lineNumber: 3644,
            columnNumber: 11
          },
          void 0
        ) }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
          lineNumber: 3643,
          columnNumber: 9
        }, void 0),
        sanitizeResetAlert && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
          AlertLayer,
          {
            title: sanitizeResetAlert.title,
            message: sanitizeResetAlert.message,
            onClose: handleSanitizeResetConfirm,
            onCancel: () => {
              void handleSendDiagnostics();
            },
            cancelText: isSendingDiagnostics ? t("settings.sending") : t("diagnostics.sendLogs")
          },
          void 0,
          false,
          {
            fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
            lineNumber: 3662,
            columnNumber: 9
          },
          void 0
        ),
        pendingDiagnosticsDraft && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "fixed inset-0 z-[60] flex items-center justify-center bg-black/50", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
          PopupLayer,
          {
            title: t("diagnostics.openGmail"),
            content: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "text-left leading-[1.6]", children: [
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { children: t("diagnostics.gmailWillOpen") }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
                lineNumber: 3678,
                columnNumber: 17
              }, void 0),
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "mt-2", children: t("diagnostics.gmailAttachments") }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
                lineNumber: 3679,
                columnNumber: 17
              }, void 0)
            ] }, void 0, true, {
              fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
              lineNumber: 3677,
              columnNumber: 15
            }, void 0),
            onConfirm: handleConfirmDiagnosticsDraft,
            onCancel: handleCancelDiagnosticsDraft,
            onBack: () => {
              setPendingDiagnosticsDraft(null);
            },
            confirmText: t("common.confirmUpper"),
            cancelText: t("common.cancel")
          },
          void 0,
          false,
          {
            fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
            lineNumber: 3674,
            columnNumber: 11
          },
          void 0
        ) }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
          lineNumber: 3673,
          columnNumber: 9
        }, void 0),
        flappyBirdGameOverState && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
          FlappyBirdGameOverLayer,
          {
            onRestart: handleFlappyBirdGameOverRestart,
            onExit: handleFlappyBirdGameOverExit
          },
          void 0,
          false,
          {
            fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
            lineNumber: 3695,
            columnNumber: 9
          },
          void 0
        ),
        flappyBirdSettingsMenuState && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
          FlappyBirdSettingsLayer,
          {
            isBgmEnabled: flappyBirdSettingsMenuState.isBgmEnabled,
            isSfxEnabled: flappyBirdSettingsMenuState.isSfxEnabled,
            onChangeBgm: handleFlappyBirdSettingsMenuChangeBgm,
            onChangeSfx: handleFlappyBirdSettingsMenuChangeSfx,
            selectedTimeOfDay: flappyBirdSettingsMenuState.selectedTimeOfDay,
            onSelectTimeOfDay: handleFlappyBirdSettingsMenuSelectTimeOfDay,
            onSendLogs: handleSendFlappyBirdLogs,
            isSendingLogs: isSendingDiagnostics || pendingDiagnosticsDraft !== null,
            onResume: handleFlappyBirdSettingsMenuResume,
            onExit: handleFlappyBirdSettingsMenuExit
          },
          void 0,
          false,
          {
            fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
            lineNumber: 3701,
            columnNumber: 9
          },
          void 0
        )
      ]
    },
    void 0,
    true,
    {
      fileName: "/Users/neiz/digivice/apps/client/src/GameContainer.tsx",
      lineNumber: 3490,
      columnNumber: 5
    },
    void 0
  );
};
const SNAPSHOT_RESET_CONFIRM_CODE = "123456";
const createSnapshotResetConfirmCode = () => SNAPSHOT_RESET_CONFIRM_CODE;
function getSnapshotLayer() {
  if (typeof window === "undefined") {
    return null;
  }
  const value = new URLSearchParams(window.location.search).get(
    "snapshotLayer"
  );
  return value === "setup" || value === "settings" ? value : null;
}
function getSnapshotPopup() {
  if (typeof window === "undefined") {
    return null;
  }
  const value = new URLSearchParams(window.location.search).get(
    "snapshotPopup"
  );
  return value === "settings-reset" ? value : null;
}
const SnapshotScreen = ({ layer }) => {
  const { locale, setLocale } = useI18n();
  const [gameSettings, setGameSettings] = reactExports.useState(getGameSettings);
  const snapshotPopup = getSnapshotPopup();
  const [showFinalResetConfirm, setShowFinalResetConfirm] = reactExports.useState(
    snapshotPopup === "settings-reset"
  );
  if (layer === "setup") {
    return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(SetupLayer, { onComplete: () => void 0 }, void 0, false, {
      fileName: "/Users/neiz/digivice/apps/client/src/SnapshotScreen.tsx",
      lineNumber: 47,
      columnNumber: 12
    }, void 0);
  }
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
    SettingMenuLayer,
    {
      releaseLabel: "snapshot",
      vibrationEnabled: gameSettings.vibrationEnabled,
      sfxEnabled: gameSettings.sfxEnabled,
      locale,
      onChangeVibration: (enabled) => {
        setGameSettings(updateGameSettings({ vibrationEnabled: enabled }));
      },
      onChangeSfx: (enabled) => {
        setGameSettings(updateGameSettings({ sfxEnabled: enabled }));
      },
      onChangeLocale: setLocale,
      onSendDiagnostics: () => void 0,
      isSendingDiagnostics: false,
      showFinalResetConfirm,
      onOpenResetConfirm: () => setShowFinalResetConfirm(true),
      onCloseResetConfirm: () => setShowFinalResetConfirm(false),
      onResetGameData: () => void 0,
      onRequestPinHomeWidget: async (_size) => ({ status: "unavailable" }),
      onClose: () => void 0,
      resetConfirmCodeFactory: createSnapshotResetConfirmCode
    },
    void 0,
    false,
    {
      fileName: "/Users/neiz/digivice/apps/client/src/SnapshotScreen.tsx",
      lineNumber: 51,
      columnNumber: 5
    },
    void 0
  );
};
const FALLBACK_AD_DURATION_MS = 15e3;
const FALLBACK_AD_TICK_MS = 100;
const OFFLINE_AD_PIXEL_COLUMNS = 56;
const OFFLINE_AD_PIXEL_ROWS = 88;
const OFFLINE_AD_PIXEL_PALETTE = [
  "#010604",
  "#03100a",
  "#062016",
  "#0b3a24",
  "#116339",
  "#1f8f4f",
  "#34b86c",
  "#68d989"
];
function parseHexColor(hex) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16)
  };
}
function mixColors(start, end, amount) {
  const r = Math.round(start.r + (end.r - start.r) * amount);
  const g = Math.round(start.g + (end.g - start.g) * amount);
  const b = Math.round(start.b + (end.b - start.b) * amount);
  return `rgb(${r}, ${g}, ${b})`;
}
function samplePixelGradient(position) {
  const normalizedPosition = (position % 1 + 1) % 1;
  const scaledPosition = normalizedPosition * (OFFLINE_AD_PIXEL_PALETTE.length - 1);
  const startIndex = Math.floor(scaledPosition);
  const endIndex = Math.min(
    OFFLINE_AD_PIXEL_PALETTE.length - 1,
    startIndex + 1
  );
  const amount = scaledPosition - startIndex;
  return mixColors(
    parseHexColor(OFFLINE_AD_PIXEL_PALETTE[startIndex]),
    parseHexColor(OFFLINE_AD_PIXEL_PALETTE[endIndex]),
    amount
  );
}
function sampleCircularBlob(x, y, centerX, centerY, radius) {
  const distance = Math.hypot(x - centerX, y - centerY);
  return Math.max(0, 1 - distance / radius);
}
const OFFLINE_AD_PIXEL_CELLS = Array.from(
  { length: OFFLINE_AD_PIXEL_COLUMNS * OFFLINE_AD_PIXEL_ROWS },
  (_, index) => {
    const x = index % OFFLINE_AD_PIXEL_COLUMNS;
    const y = Math.floor(index / OFFLINE_AD_PIXEL_COLUMNS);
    const normalizedX = x / (OFFLINE_AD_PIXEL_COLUMNS - 1);
    const normalizedY = y / (OFFLINE_AD_PIXEL_ROWS - 1);
    const diagonalDown = normalizedX * 0.24 + normalizedY * 0.26;
    const diagonalUp = normalizedX * 0.22 + (1 - normalizedY) * 0.18;
    const centerBlob = sampleCircularBlob(
      normalizedX,
      normalizedY,
      0.5,
      0.5,
      0.5
    );
    const upperBlob = sampleCircularBlob(
      normalizedX,
      normalizedY,
      0.28,
      0.24,
      0.34
    );
    const rightBlob = sampleCircularBlob(
      normalizedX,
      normalizedY,
      0.75,
      0.4,
      0.38
    );
    const lowerBlob = sampleCircularBlob(
      normalizedX,
      normalizedY,
      0.36,
      0.78,
      0.36
    );
    const waveA = (Math.sin((normalizedX * 1.5 + normalizedY * 1.2) * Math.PI) + 1) / 2;
    const waveB = (Math.cos((normalizedX * 1.2 - normalizedY * 1.4) * Math.PI) + 1) / 2;
    const gradientPosition = diagonalDown + diagonalUp + centerBlob * 0.22 + upperBlob * 0.2 + rightBlob * 0.18 + lowerBlob * 0.16 + waveA * 0.08 + waveB * 0.06;
    return {
      id: index,
      style: {
        "--pixel-color-a": samplePixelGradient(gradientPosition),
        "--pixel-color-b": samplePixelGradient(
          gradientPosition + upperBlob * 0.16 + waveB * 0.08
        ),
        "--pixel-color-c": samplePixelGradient(
          gradientPosition + centerBlob * 0.18 + rightBlob * 0.1
        ),
        "--pixel-color-d": samplePixelGradient(
          gradientPosition + lowerBlob * 0.16 + waveA * 0.1
        )
      }
    };
  }
);
const OfflineInterstitialFallbackLayer = ({ onComplete, t }) => {
  const remainingMsRef = reactExports.useRef(FALLBACK_AD_DURATION_MS);
  const lastTickAtRef = reactExports.useRef(0);
  const hasCompletedRef = reactExports.useRef(false);
  const onCompleteRef = reactExports.useRef(onComplete);
  const [remainingMs, setRemainingMs] = reactExports.useState(FALLBACK_AD_DURATION_MS);
  reactExports.useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  reactExports.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const getNow = () => {
      var _a;
      return typeof ((_a = window.performance) == null ? void 0 : _a.now) === "function" ? window.performance.now() : Date.now();
    };
    const complete = () => {
      if (hasCompletedRef.current) {
        return;
      }
      hasCompletedRef.current = true;
      remainingMsRef.current = 0;
      setRemainingMs(0);
      onCompleteRef.current();
    };
    const tick = () => {
      const now = getNow();
      const isHidden = typeof document !== "undefined" && document.visibilityState !== "visible";
      if (isHidden) {
        lastTickAtRef.current = now;
        return;
      }
      if (lastTickAtRef.current <= 0) {
        lastTickAtRef.current = now;
        return;
      }
      const elapsedMs = Math.max(0, now - lastTickAtRef.current);
      lastTickAtRef.current = now;
      const nextRemainingMs = Math.max(0, remainingMsRef.current - elapsedMs);
      remainingMsRef.current = nextRemainingMs;
      setRemainingMs(
        (previous) => Math.ceil(previous / 100) === Math.ceil(nextRemainingMs / 100) ? previous : nextRemainingMs
      );
      if (nextRemainingMs <= 0) {
        complete();
      }
    };
    const handleVisibilityChange = () => {
      lastTickAtRef.current = getNow();
    };
    lastTickAtRef.current = getNow();
    const intervalId = window.setInterval(tick, FALLBACK_AD_TICK_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1e3));
  const progressPercent = (FALLBACK_AD_DURATION_MS - Math.max(0, remainingMs)) / FALLBACK_AD_DURATION_MS * 100;
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
    "div",
    {
      className: "fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-black text-white",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "offline-ad-title",
      children: [
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "offline-ad-fallback-visualizer", "aria-hidden": "true", children: OFFLINE_AD_PIXEL_CELLS.map((pixel) => /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
          "span",
          {
            className: "offline-ad-fallback-visualizer__pixel",
            style: pixel.style
          },
          pixel.id,
          false,
          {
            fileName: "/Users/neiz/digivice/apps/client/src/components/OfflineInterstitialFallbackLayer.tsx",
            lineNumber: 249,
            columnNumber: 11
          },
          void 0
        )) }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/components/OfflineInterstitialFallbackLayer.tsx",
          lineNumber: 247,
          columnNumber: 7
        }, void 0),
        /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "relative z-[1] w-full", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
          PopupLayer,
          {
            title: t("offlineAd.title"),
            content: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "space-y-4 text-center", children: [
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { id: "offline-ad-title", className: "sr-only", children: t("offlineAd.title") }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/components/OfflineInterstitialFallbackLayer.tsx",
                lineNumber: 261,
                columnNumber: 15
              }, void 0),
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { children: t("offlineAd.message") }, void 0, false, {
                fileName: "/Users/neiz/digivice/apps/client/src/components/OfflineInterstitialFallbackLayer.tsx",
                lineNumber: 264,
                columnNumber: 15
              }, void 0),
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                "div",
                {
                  className: "mx-auto w-full max-w-[14rem] border-4 border-[#222] bg-[#201236] p-1 shadow-[2px_2px_0_#222]",
                  "aria-hidden": "true",
                  children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "h-4 bg-[#12091f]", children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                    "div",
                    {
                      className: "h-full bg-[#69f0ae]",
                      style: { width: `${progressPercent}%` }
                    },
                    void 0,
                    false,
                    {
                      fileName: "/Users/neiz/digivice/apps/client/src/components/OfflineInterstitialFallbackLayer.tsx",
                      lineNumber: 272,
                      columnNumber: 19
                    },
                    void 0
                  ) }, void 0, false, {
                    fileName: "/Users/neiz/digivice/apps/client/src/components/OfflineInterstitialFallbackLayer.tsx",
                    lineNumber: 271,
                    columnNumber: 17
                  }, void 0)
                },
                void 0,
                false,
                {
                  fileName: "/Users/neiz/digivice/apps/client/src/components/OfflineInterstitialFallbackLayer.tsx",
                  lineNumber: 267,
                  columnNumber: 15
                },
                void 0
              ),
              /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
                "div",
                {
                  className: "font-display text-[1.6rem] leading-[1.2] text-component-negative",
                  "aria-live": "polite",
                  children: t("offlineAd.returningIn", { seconds: remainingSeconds })
                },
                void 0,
                false,
                {
                  fileName: "/Users/neiz/digivice/apps/client/src/components/OfflineInterstitialFallbackLayer.tsx",
                  lineNumber: 278,
                  columnNumber: 15
                },
                void 0
              )
            ] }, void 0, true, {
              fileName: "/Users/neiz/digivice/apps/client/src/components/OfflineInterstitialFallbackLayer.tsx",
              lineNumber: 260,
              columnNumber: 13
            }, void 0),
            showActions: false,
            initialFocusTarget: "container"
          },
          void 0,
          false,
          {
            fileName: "/Users/neiz/digivice/apps/client/src/components/OfflineInterstitialFallbackLayer.tsx",
            lineNumber: 257,
            columnNumber: 9
          },
          void 0
        ) }, void 0, false, {
          fileName: "/Users/neiz/digivice/apps/client/src/components/OfflineInterstitialFallbackLayer.tsx",
          lineNumber: 256,
          columnNumber: 7
        }, void 0)
      ]
    },
    void 0,
    true,
    {
      fileName: "/Users/neiz/digivice/apps/client/src/components/OfflineInterstitialFallbackLayer.tsx",
      lineNumber: 241,
      columnNumber: 5
    },
    void 0
  );
};
const COOLDOWN_KEY = "ad_last_shown_timestamp";
class CooldownCondition {
  /**
   * @param cooldownMs 쿨다운 시간 (밀리초)
   */
  constructor(cooldownMs) {
    __publicField(this, "name", "cooldown");
    __publicField(this, "cooldownMs");
    this.cooldownMs = cooldownMs;
  }
  async check(_context) {
    const lastShownStr = localStorage.getItem(COOLDOWN_KEY);
    if (!lastShownStr) {
      return true;
    }
    try {
      const lastShown = Number.parseInt(lastShownStr, 10);
      const now = Date.now();
      const elapsed = now - lastShown;
      return elapsed >= this.cooldownMs;
    } catch {
      return true;
    }
  }
  /**
   * 쿨다운 업데이트 (광고 표시 후 호출)
   */
  static updateCooldown() {
    const now = Date.now();
    localStorage.setItem(COOLDOWN_KEY, now.toString());
    console.log("[CooldownCondition] Cooldown updated:", now);
  }
  /**
   * 쿨다운 리셋 (디버그용)
   */
  static resetCooldown() {
    localStorage.removeItem(COOLDOWN_KEY);
    console.log("[CooldownCondition] Cooldown reset");
  }
  /**
   * 마지막 광고 표시 시간 가져오기
   */
  static getLastShownTime() {
    const lastShownStr = localStorage.getItem(COOLDOWN_KEY);
    if (!lastShownStr) return null;
    try {
      return Number.parseInt(lastShownStr, 10);
    } catch {
      return null;
    }
  }
}
const DEFAULT_NATIVE_AD_COOLDOWN_MS = 4 * 60 * 60 * 1e3;
const ONLINE_AD_RETRY_STORAGE_KEY = "digivice_pending_online_ad_retry";
const OFFLINE_FALLBACK_AD_RETRY_INTERVAL_MS = 1e3;
function resolveCooldownMs$1(metadata) {
  const cooldownMs = metadata == null ? void 0 : metadata.cooldownMs;
  if (typeof cooldownMs === "number" && Number.isFinite(cooldownMs) && cooldownMs > 0) {
    return cooldownMs;
  }
  return DEFAULT_NATIVE_AD_COOLDOWN_MS;
}
class AdManager {
  constructor() {
    __publicField(this, "policies", []);
    __publicField(this, "platformAdapter");
    this.platformAdapter = new PlatformAdapter();
  }
  /**
   * 정책 추가
   */
  addPolicy(policy) {
    this.policies.push(policy);
    this.policies.sort((a, b) => b.getPriority() - a.getPriority());
    console.log(`[AdManager] Policy added: ${policy.name}`);
  }
  /**
   * 광고 요청
   * @param trigger 트리거 이벤트
   * @param context 광고 컨텍스트
   */
  async requestAd(trigger, context = {}) {
    var _a;
    const fullContext = {
      trigger,
      isCharacterUrgent: false,
      ...context
    };
    console.log("[AdManager] Ad requested:", fullContext);
    if (!this.platformAdapter.isRunningInNativeApp()) {
      console.log("[AdManager] Not running in native app - ad request ignored");
      return false;
    }
    if (!window.adController) {
      console.warn("[AdManager] window.adController not available");
      return false;
    }
    const policy = await this.findMatchingPolicy(fullContext);
    if (!policy) {
      console.log("[AdManager] No matching policy found");
      return false;
    }
    console.log(`[AdManager] Policy matched: ${policy.name}`);
    const cooldownMs = resolveCooldownMs$1(fullContext.metadata);
    const isOnlineRetry = ((_a = fullContext.metadata) == null ? void 0 : _a.onlineRetry) === true;
    try {
      const canShowStr = await window.adController.canShowAd({ cooldownMs });
      const canShow = canShowStr === "true";
      if (!canShow) {
        console.log("[AdManager] Blocked by native cooldown");
        return false;
      }
    } catch (error) {
      console.error("[AdManager] Error checking native cooldown:", error);
      return false;
    }
    try {
      await window.adController.showInterstitial({ cooldownMs });
      console.log("[AdManager] Ad shown successfully");
      CooldownCondition.updateCooldown();
      if (isOnlineRetry) {
        this.clearPendingOnlineAdRetry();
      }
      return true;
    } catch (error) {
      console.error("[AdManager] Error showing ad:", error);
      if (isOnlineRetry) {
        return false;
      }
      const fallbackResult = await this.showOfflineInterstitialFallback(
        trigger,
        cooldownMs
      );
      if (fallbackResult === "ad_shown") {
        return true;
      }
      if (fallbackResult === "fallback_completed") {
        this.markPendingOnlineAdRetry();
        return true;
      }
      return false;
    }
  }
  /**
   * 매칭되는 정책 찾기
   */
  async findMatchingPolicy(context) {
    for (const policy of this.policies) {
      try {
        const shouldShow = await policy.shouldShow(context);
        if (shouldShow) {
          return policy;
        }
      } catch (error) {
        console.error(`[AdManager] Error in policy ${policy.name}:`, error);
      }
    }
    return null;
  }
  /**
   * 등록된 정책 목록
   */
  getPolicies() {
    return [...this.policies];
  }
  /**
   * 쿨다운 리셋 (디버그용)
   */
  resetCooldown() {
    CooldownCondition.resetCooldown();
    this.clearPendingOnlineAdRetry();
  }
  /**
   * 강제로 광고 표시 (디버그용)
   */
  async forceShowAd() {
    if (!window.adController) {
      console.warn("[AdManager] window.adController not available");
      return false;
    }
    try {
      await window.adController.showInterstitial({
        cooldownMs: DEFAULT_NATIVE_AD_COOLDOWN_MS
      });
      CooldownCondition.updateCooldown();
      this.clearPendingOnlineAdRetry();
      return true;
    } catch (error) {
      console.error("[AdManager] Error forcing ad:", error);
      return false;
    }
  }
  hasPendingOnlineAdRetry() {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      return localStorage.getItem(ONLINE_AD_RETRY_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }
  markPendingOnlineAdRetry() {
    if (typeof window === "undefined") {
      return;
    }
    try {
      localStorage.setItem(ONLINE_AD_RETRY_STORAGE_KEY, "true");
      console.log("[AdManager] Pending online ad retry marked");
    } catch (error) {
      console.warn("[AdManager] Failed to mark pending online ad retry", error);
    }
  }
  clearPendingOnlineAdRetry() {
    if (typeof window === "undefined") {
      return;
    }
    try {
      localStorage.removeItem(ONLINE_AD_RETRY_STORAGE_KEY);
      console.log("[AdManager] Pending online ad retry cleared");
    } catch (error) {
      console.warn("[AdManager] Failed to clear pending online ad retry", error);
    }
  }
  async showOfflineInterstitialFallback(trigger, cooldownMs) {
    const fallbackBridge = typeof window !== "undefined" ? window.digiviceAdFallbackBridge : void 0;
    if (!(fallbackBridge == null ? void 0 : fallbackBridge.showOfflineInterstitialFallback)) {
      console.warn("[AdManager] Offline interstitial fallback unavailable");
      return false;
    }
    return new Promise((resolve) => {
      let settled = false;
      let retryTimerId = null;
      const finish = (result) => {
        if (settled) {
          return;
        }
        settled = true;
        if (retryTimerId !== null) {
          window.clearTimeout(retryTimerId);
          retryTimerId = null;
        }
        resolve(result);
      };
      const scheduleRetry = () => {
        if (settled) {
          return;
        }
        retryTimerId = window.setTimeout(() => {
          retryTimerId = null;
          void retryAdConnection();
        }, OFFLINE_FALLBACK_AD_RETRY_INTERVAL_MS);
      };
      const retryAdConnection = async () => {
        var _a;
        if (settled) {
          return;
        }
        const didShow = await this.tryShowRecoveredInterstitial(cooldownMs);
        if (settled) {
          return;
        }
        if (didShow) {
          try {
            (_a = fallbackBridge.completeOfflineInterstitialFallback) == null ? void 0 : _a.call(fallbackBridge, true);
          } finally {
            finish("ad_shown");
          }
          return;
        }
        scheduleRetry();
      };
      fallbackBridge.showOfflineInterstitialFallback({
        trigger,
        cooldownMs,
        timestamp: Date.now()
      }).then((completed) => {
        finish(completed === true ? "fallback_completed" : false);
      }).catch((fallbackError) => {
        console.error(
          "[AdManager] Error showing offline interstitial fallback:",
          fallbackError
        );
        finish(false);
      });
      scheduleRetry();
    });
  }
  async tryShowRecoveredInterstitial(cooldownMs) {
    if (!window.adController) {
      return false;
    }
    try {
      const canShowStr = await window.adController.canShowAd({ cooldownMs });
      if (canShowStr !== "true") {
        return false;
      }
      await window.adController.showInterstitial({ cooldownMs });
      console.log("[AdManager] Recovered ad shown during offline fallback");
      CooldownCondition.updateCooldown();
      this.clearPendingOnlineAdRetry();
      return true;
    } catch (error) {
      console.warn(
        "[AdManager] Recovered ad attempt failed during offline fallback",
        error
      );
      return false;
    }
  }
}
class FlappyBirdGameOverPolicy {
  constructor() {
    __publicField(this, "name", "flappy_bird_game_over");
  }
  async shouldShow(context) {
    return context.trigger === "flappy_bird_game_over";
  }
  getPriority() {
    return 9;
  }
}
const DEFAULT_MAIN_SCENE_MENU_COOLDOWN_MS = 2 * 60 * 1e3;
function resolveCooldownMs(metadata) {
  const cooldownMs = metadata == null ? void 0 : metadata.cooldownMs;
  if (typeof cooldownMs === "number" && Number.isFinite(cooldownMs) && cooldownMs > 0) {
    return cooldownMs;
  }
  return DEFAULT_MAIN_SCENE_MENU_COOLDOWN_MS;
}
class MainSceneMenuPolicy {
  constructor() {
    __publicField(this, "name", "main_scene_menu");
  }
  async shouldShow(context) {
    if (context.trigger !== "main_scene_menu") {
      return false;
    }
    const cooldownMs = resolveCooldownMs(context.metadata);
    const isCooldownSatisfied = await new CooldownCondition(cooldownMs).check(
      context
    );
    if (!isCooldownSatisfied) {
      console.log("[MainSceneMenuPolicy] Ad blocked by cooldown", {
        cooldownMs,
        metadata: context.metadata
      });
    }
    return isCooldownSatisfied;
  }
  getPriority() {
    return 8;
  }
}
const SimpleLogViewer = (props) => {
  return null;
};
let adManager = null;
const LAST_ACTIVE_KEY = "app_last_active_timestamp";
const FULLSCREEN_AD_REENTER_SUPPRESS_MS = 1200;
const App = () => {
  const { t } = useI18n();
  const snapshotLayer = getSnapshotLayer();
  const isInitialized = reactExports.useRef(false);
  const isFullscreenAdActiveRef = reactExports.useRef(false);
  const suppressAppReenterUntilRef = reactExports.useRef(0);
  const offlineAdFallbackPromiseRef = reactExports.useRef(null);
  const offlineAdFallbackResolverRef = reactExports.useRef(null);
  const isOfflineAdFallbackActiveRef = reactExports.useRef(false);
  const [offlineAdFallbackKey, setOfflineAdFallbackKey] = reactExports.useState(null);
  const clearOfflineAdFallback = reactExports.useCallback((completed) => {
    const resolver = offlineAdFallbackResolverRef.current;
    offlineAdFallbackPromiseRef.current = null;
    offlineAdFallbackResolverRef.current = null;
    isOfflineAdFallbackActiveRef.current = false;
    setOfflineAdFallbackKey(null);
    resolver == null ? void 0 : resolver(completed);
  }, []);
  const showOfflineInterstitialFallback = reactExports.useCallback(
    () => {
      if (offlineAdFallbackPromiseRef.current) {
        return offlineAdFallbackPromiseRef.current;
      }
      const promise = new Promise((resolve) => {
        offlineAdFallbackResolverRef.current = resolve;
      });
      offlineAdFallbackPromiseRef.current = promise;
      isOfflineAdFallbackActiveRef.current = true;
      setOfflineAdFallbackKey(Date.now());
      return promise;
    },
    []
  );
  reactExports.useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;
    adManager = new AdManager();
    adManager.addPolicy(new FlappyBirdGameOverPolicy());
    adManager.addPolicy(new MainSceneMenuPolicy());
    window.adManager = adManager;
    window.digiviceAdBridge = {
      requestMainSceneMenuAd: (request) => {
        console.log("[App] MainScene menu ad requested", request);
        return (adManager == null ? void 0 : adManager.requestAd("main_scene_menu", {
          isCharacterUrgent: false,
          metadata: {
            ...request,
            trigger: "main_scene_menu",
            timestamp: Date.now(),
            onlineRetry: request.onlineRetry === true
          }
        })) ?? Promise.resolve(false);
      },
      hasPendingOnlineAdRetry: () => (adManager == null ? void 0 : adManager.hasPendingOnlineAdRetry()) ?? false
    };
    window.digiviceAdFallbackBridge = {
      showOfflineInterstitialFallback: () => showOfflineInterstitialFallback(),
      completeOfflineInterstitialFallback: (completed = true) => clearOfflineAdFallback(completed),
      isActive: () => isOfflineAdFallbackActiveRef.current
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (isFullscreenAdActiveRef.current || Date.now() < suppressAppReenterUntilRef.current) {
          updateLastActiveTime();
          return;
        }
        updateLastActiveTime();
      } else if (document.visibilityState === "hidden") {
        updateLastActiveTime();
      }
    };
    const handleFullscreenAdState = (event) => {
      const detail = event.detail;
      const state = detail == null ? void 0 : detail.state;
      if (state === "showing") {
        isFullscreenAdActiveRef.current = true;
        return;
      }
      if (state === "dismissed" || state === "failed") {
        isFullscreenAdActiveRef.current = false;
        suppressAppReenterUntilRef.current = Date.now() + FULLSCREEN_AD_REENTER_SUPPRESS_MS;
        updateLastActiveTime();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener(
      "digivice:fullscreen-ad",
      handleFullscreenAdState
    );
    updateLastActiveTime();
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener(
        "digivice:fullscreen-ad",
        handleFullscreenAdState
      );
      window.digiviceAdBridge = void 0;
      window.digiviceAdFallbackBridge = void 0;
      clearOfflineAdFallback(false);
    };
  }, [clearOfflineAdFallback, showOfflineInterstitialFallback]);
  const updateLastActiveTime = () => {
    const now = Date.now();
    localStorage.setItem(LAST_ACTIVE_KEY, now.toString());
  };
  return /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { id: "app-shell", children: [
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(TopLeftBuildLogoText, {}, void 0, false, {
      fileName: "/Users/neiz/digivice/apps/client/src/App.tsx",
      lineNumber: 171,
      columnNumber: 7
    }, void 0),
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { id: "app-container", children: [
      snapshotLayer ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(SnapshotScreen, { layer: snapshotLayer }, void 0, false, {
        fileName: "/Users/neiz/digivice/apps/client/src/App.tsx",
        lineNumber: 174,
        columnNumber: 11
      }, void 0) : /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(GameContainer, {}, void 0, false, {
        fileName: "/Users/neiz/digivice/apps/client/src/App.tsx",
        lineNumber: 176,
        columnNumber: 11
      }, void 0),
      offlineAdFallbackKey !== null && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(
        OfflineInterstitialFallbackLayer,
        {
          onComplete: () => clearOfflineAdFallback(true),
          t
        },
        offlineAdFallbackKey,
        false,
        {
          fileName: "/Users/neiz/digivice/apps/client/src/App.tsx",
          lineNumber: 179,
          columnNumber: 11
        },
        void 0
      ),
      /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(SimpleLogViewer, { position: "top-right", initialOpen: false }, void 0, false, {
        fileName: "/Users/neiz/digivice/apps/client/src/App.tsx",
        lineNumber: 185,
        columnNumber: 9
      }, void 0)
    ] }, void 0, true, {
      fileName: "/Users/neiz/digivice/apps/client/src/App.tsx",
      lineNumber: 172,
      columnNumber: 7
    }, void 0)
  ] }, void 0, true, {
    fileName: "/Users/neiz/digivice/apps/client/src/App.tsx",
    lineNumber: 170,
    columnNumber: 5
  }, void 0);
};
const platformAdapter = new PlatformAdapter();
const isNativeFeatureDebugMode = true;
installDiagnosticsConsoleCapture();
setDiagnosticsContextProvider(() => ({
  appMode: "development",
  appVersion: "1.0.4-debug",
  buildNumber: 18,
  debugEnabled: isNativeFeatureDebugMode
}));
document.addEventListener("DOMContentLoaded", () => {
});
function sleep(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
async function waitForNativeStorageController(timeoutMilliseconds = 4e3) {
  if (!platformAdapter.isRunningInNativeApp()) {
    return;
  }
  const startedAt = Date.now();
  while (!hasNativeStorageController()) {
    if (Date.now() - startedAt >= timeoutMilliseconds) {
      console.warn(
        "[bootstrap] Native storage bridge did not become ready before timeout"
      );
      return;
    }
    await sleep(50);
  }
  console.log("[bootstrap] Native storage bridge is ready");
  return;
}
async function bootstrap() {
  await waitForNativeStorageController();
  await initializeDiagnosticsLogger();
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(jsxDevRuntimeExports.Fragment, { children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(I18nProvider, { children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(App, {}, void 0, false, {
      fileName: "/Users/neiz/digivice/apps/client/src/main.tsx",
      lineNumber: 87,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "/Users/neiz/digivice/apps/client/src/main.tsx",
      lineNumber: 86,
      columnNumber: 7
    }, this) }, void 0, false, {
      fileName: "/Users/neiz/digivice/apps/client/src/main.tsx",
      lineNumber: 85,
      columnNumber: 5
    }, this)
  );
}
void bootstrap();
//# sourceMappingURL=index.js.map

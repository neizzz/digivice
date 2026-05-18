import {
  LOCALE_METADATA,
  SUPPORTED_LOCALES,
  type LocaleCode,
} from "@shared/i18n";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import PopupLayer from "../components/PopupLayer";
import { useI18n } from "../i18n";

const isNativeFeatureDebugMode =
  import.meta.env.NATIVE_FEATURE_DEBUG_MODE === "true";
const RESET_CONFIRM_CODE_LENGTH = 6;
const RESET_CONFIRM_CODE_INDEXES = Array.from(
  { length: RESET_CONFIRM_CODE_LENGTH },
  (_, index) => index,
);

interface SettingMenuLayerProps {
  releaseLabel: string;
  vibrationEnabled: boolean;
  sfxEnabled: boolean;
  locale: LocaleCode;
  onChangeVibration: (enabled: boolean) => void;
  onChangeSfx: (enabled: boolean) => void;
  onChangeLocale: (locale: LocaleCode) => void;
  onSendDiagnostics: () => void;
  isSendingDiagnostics: boolean;
  showFinalResetConfirm: boolean;
  onOpenResetConfirm: () => void;
  onCloseResetConfirm: () => void;
  onResetGameData: () => void;
  onClose: () => void;
  onBack?: () => void;
  onShowOfflineAdFallback?: () => void;
  onResetConfirmBack?: () => void;
  resetConfirmCodeFactory?: () => string;
}

const ToggleButton: React.FC<{
  enabled: boolean;
  onClick: () => void;
}> = ({ enabled, onClick }) => {
  const { t } = useI18n();

  return (
    <button
      type={"button"}
      onClick={onClick}
      className={`ml-auto min-w-20 shrink-0 border-2 border-[#222] px-4 py-0.5 font-bold text-white ${
        enabled ? "bg-component-positive" : "bg-gray-400"
      }`}
    >
      {enabled ? t("common.on") : t("common.off")}
    </button>
  );
};

const ActionButton: React.FC<{
  text: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "positive" | "warning" | "negative";
  snapshotAction?: string;
}> = ({
  text,
  onClick,
  disabled = false,
  variant = "positive",
  snapshotAction,
}) => {
  const backgroundClass = disabled
    ? "cursor-wait bg-gray-400 opacity-60"
    : variant === "warning"
      ? "bg-yellow-500"
      : variant === "negative"
        ? "bg-component-negative"
        : "bg-component-positive";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-snapshot-action={snapshotAction}
      className={`ml-auto flex min-w-20 shrink-0 items-center justify-center border-2 border-[#222] px-4 py-0.5 text-center font-bold text-white ${backgroundClass}`}
    >
      {text}
    </button>
  );
};

const DevModeBadge: React.FC = () => (
  <span className="border-2 border-[#222] bg-yellow-300 px-2 py-0.5 text-[0.85rem] uppercase leading-none text-[#222]">
    Dev Mode
  </span>
);

const LanguageButton: React.FC<{
  locale: LocaleCode;
  active: boolean;
  onClick: () => void;
}> = ({ locale, active, onClick }) => {
  const meta = LOCALE_METADATA[locale];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-2 border-[#222] px-2 py-0.5 text-[1rem] font-bold ${
        active ? "bg-component-positive text-white" : "bg-white text-[#222]"
      }`}
      aria-pressed={active}
    >
      {meta.nativeName}
    </button>
  );
};

function createResetConfirmCode(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const values = crypto.getRandomValues(
      new Uint8Array(RESET_CONFIRM_CODE_LENGTH),
    );

    return Array.from(values, (value) => String(value % 10)).join("");
  }

  return Array.from({ length: RESET_CONFIRM_CODE_LENGTH }, () =>
    String(Math.floor(Math.random() * 10)),
  ).join("");
}

function sanitizeResetConfirmCodeInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, RESET_CONFIRM_CODE_LENGTH);
}

const SettingMenuLayer: React.FC<SettingMenuLayerProps> = ({
  releaseLabel,
  vibrationEnabled,
  sfxEnabled,
  locale,
  onChangeVibration,
  onChangeSfx,
  onChangeLocale,
  onSendDiagnostics,
  isSendingDiagnostics,
  showFinalResetConfirm,
  onOpenResetConfirm,
  onCloseResetConfirm,
  onResetGameData,
  onClose,
  onBack,
  onShowOfflineAdFallback,
  onResetConfirmBack,
  resetConfirmCodeFactory = createResetConfirmCode,
}) => {
  const { t } = useI18n();
  const [resetConfirmCode, setResetConfirmCode] =
    useState(resetConfirmCodeFactory);
  const [resetConfirmDigits, setResetConfirmDigits] = useState<string[]>(() =>
    Array.from({ length: RESET_CONFIRM_CODE_LENGTH }, () => ""),
  );
  const resetCodeInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!showFinalResetConfirm) {
      return;
    }

    setResetConfirmCode(resetConfirmCodeFactory());
    setResetConfirmDigits(
      Array.from({ length: RESET_CONFIRM_CODE_LENGTH }, () => ""),
    );

    window.requestAnimationFrame(() => {
      const firstInput = resetCodeInputRefs.current[0];
      firstInput?.focus();
      firstInput?.select();
    });
  }, [resetConfirmCodeFactory, showFinalResetConfirm]);

  const resetConfirmText = useMemo(
    () => resetConfirmDigits.join(""),
    [resetConfirmDigits],
  );
  const isResetComplete = useMemo(
    () => resetConfirmDigits.every((digit) => digit.length === 1),
    [resetConfirmDigits],
  );

  const isResetEnabled = useMemo(
    () => isResetComplete && resetConfirmText === resetConfirmCode,
    [isResetComplete, resetConfirmCode, resetConfirmText],
  );
  const focusResetCodeInput = (index: number) => {
    const nextIndex = Math.max(0, Math.min(index, RESET_CONFIRM_CODE_LENGTH - 1));

    window.requestAnimationFrame(() => {
      const input = resetCodeInputRefs.current[nextIndex];
      input?.focus();
      input?.select();
    });
  };

  const fillResetConfirmDigits = (startIndex: number, value: string) => {
    const digits = sanitizeResetConfirmCodeInput(value);

    if (!digits) {
      return;
    }

    setResetConfirmDigits((currentDigits) => {
      const nextDigits = [...currentDigits];

      for (
        let offset = 0;
        offset < digits.length &&
        startIndex + offset < RESET_CONFIRM_CODE_LENGTH;
        offset += 1
      ) {
        nextDigits[startIndex + offset] = digits[offset];
      }

      return nextDigits;
    });

    focusResetCodeInput(startIndex + digits.length);
  };

  const clearResetConfirmDigit = (
    index: number,
    direction: "current" | "previous",
  ) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <PopupLayer
        title={t("settings.title")}
        suppressInitialActionsMs={180}
        topLeftContent={
          <div className="text-[10px] leading-none text-gray-500">
            {releaseLabel}
          </div>
        }
        content={
          <div className="flex flex-col gap-4 text-left text-[1.5rem] leading-[1.4]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold">
                  {t("settings.vibration")}
                </div>
              </div>
              <ToggleButton
                enabled={vibrationEnabled}
                onClick={() => onChangeVibration(!vibrationEnabled)}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold">
                  {t("settings.sfx")}
                </div>
              </div>
              <ToggleButton
                enabled={sfxEnabled}
                onClick={() => onChangeSfx(!sfxEnabled)}
              />
            </div>

            <div className="border-t-2 border-[#222] pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1 font-bold">
                  {t("settings.reportBug")}
                </div>
                <ActionButton
                  text={t("settings.send")}
                  onClick={onSendDiagnostics}
                  disabled={isSendingDiagnostics}
                  variant="warning"
                />
              </div>
            </div>

            <div className="border-t-2 border-[#222] pt-4">
              <div className="min-w-0">
                <div className="font-bold text-red-600">
                  {t("settings.raiseNewMonster")}
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <ActionButton
                  text={t("common.reset")}
                  onClick={onOpenResetConfirm}
                  variant="negative"
                  snapshotAction="open-settings-reset-popup"
                />
              </div>
            </div>

            {isNativeFeatureDebugMode && (
              <div className="border-t-2 border-[#222] pt-4">
                <div className="mb-3 flex flex-wrap items-center gap-2 font-bold">
                  <span>Language</span>
                  <DevModeBadge />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SUPPORTED_LOCALES.map((localeOption) => (
                    <LanguageButton
                      key={localeOption}
                      locale={localeOption}
                      active={locale === localeOption}
                      onClick={() => onChangeLocale(localeOption)}
                    />
                  ))}
                </div>
                <div className="mt-4 border-t-2 border-[#222] pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 font-bold">
                        <span>Offline Ad</span>
                        <DevModeBadge />
                      </div>
                    </div>
                    <ActionButton
                      text="Show"
                      onClick={() => onShowOfflineAdFallback?.()}
                      disabled={!onShowOfflineAdFallback}
                      variant="warning"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        }
        onConfirm={onClose}
        onBack={onBack ?? onClose}
        confirmText={t("common.close")}
      />
      {showFinalResetConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
          data-snapshot-popup="settings-reset"
        >
          <PopupLayer
            title={t("settings.resetTitle")}
            content={
              <div className="flex flex-col gap-4 leading-[1.4]">
                <div>{t("settings.resetMessage")}</div>
                <div
                  className="grid grid-cols-6 gap-1 self-center"
                  aria-label={t("settings.resetConfirmCodeLabel")}
                >
                  {RESET_CONFIRM_CODE_INDEXES.map((index) => {
                    const digit = resetConfirmDigits[index];
                    const isDigitFilled = digit.length === 1;
                    const isDigitCorrect =
                      isDigitFilled && digit === resetConfirmCode[index];
                    const isDigitMismatch = isDigitFilled && !isDigitCorrect;

                    return (
                      <input
                        key={index}
                        ref={(element) => {
                          resetCodeInputRefs.current[index] = element;
                        }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        autoComplete="off"
                        value={digit}
                        placeholder={resetConfirmCode[index]}
                        onChange={(event) =>
                          fillResetConfirmDigits(index, event.target.value)
                        }
                        onFocus={(event) => event.target.select()}
                        onKeyDown={(event) => {
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
                            digit ? "current" : "previous",
                          );
                        }}
                        onPaste={(event) => {
                          event.preventDefault();
                          fillResetConfirmDigits(
                            index,
                            event.clipboardData.getData("text"),
                          );
                        }}
                        aria-label={`${t("settings.resetConfirmCodeLabel")} ${
                          index + 1
                        }`}
                        aria-invalid={isDigitMismatch}
                        className={`h-11 w-9 border-2 px-0 text-center text-[1.2rem] font-bold focus:outline-none focus:ring-2 ${
                          isDigitCorrect
                            ? "border-component-positive bg-[#f0fff4] text-component-positive placeholder:text-component-positive/60 focus:ring-component-positive"
                            : isDigitMismatch
                              ? "border-component-negative bg-[#fff0f2] text-component-negative placeholder:text-component-negative/50 focus:ring-[#d95763]"
                              : "border-[#222] bg-white text-[#222] placeholder:text-gray-400 focus:ring-[#d95763]"
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            }
            onConfirm={onResetGameData}
            onCancel={onCloseResetConfirm}
            onBack={onResetConfirmBack ?? onCloseResetConfirm}
            confirmText={t("common.reset")}
            cancelText={t("common.cancel")}
            confirmDisabled={!isResetEnabled}
            confirmVariant="negative"
            cancelVariant="positive"
            confirmEnableDelayMs={2000}
          />
        </div>
      )}
    </div>
  );
};

export default SettingMenuLayer;

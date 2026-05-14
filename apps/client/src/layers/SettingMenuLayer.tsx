import {
  LOCALE_METADATA,
  SUPPORTED_LOCALES,
  type LocaleCode,
} from "@shared/i18n";
import type React from "react";
import { useMemo, useState } from "react";
import PopupLayer from "../components/PopupLayer";
import { useI18n } from "../i18n";

interface SettingMenuLayerProps {
  releaseLabel: string;
  vibrationEnabled: boolean;
  locale: LocaleCode;
  onChangeVibration: (enabled: boolean) => void;
  onChangeLocale: (locale: LocaleCode) => void;
  onSendDiagnostics: () => void;
  isSendingDiagnostics: boolean;
  showFinalResetConfirm: boolean;
  onOpenResetConfirm: () => void;
  onCloseResetConfirm: () => void;
  onResetGameData: () => void;
  onClose: () => void;
}

const FONT_NOTICE = {
  name: "Neo둥근모 Pro",
  lines: [
    "Copyright © 2017-2024, Eunbin Jeong (Dalgona.) <project-neodgm@dalgona.dev>",
    'with reserved font name "Neo둥근모 Pro" and "NeoDunggeunmo Pro".',
  ] as const,
};

const ToggleButton: React.FC<{
  enabled: boolean;
  onClick: () => void;
}> = ({ enabled, onClick }) => {
  const { t } = useI18n();

  return (
    <button
      type={"button"}
      onClick={onClick}
      className={`min-w-20 border-2 border-[#222] px-4 py-0.5 font-bold text-white ${
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
}> = ({ text, onClick, disabled = false, variant = "positive" }) => {
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
      className={`flex min-w-20 items-center justify-center border-2 border-[#222] px-4 py-0.5 text-center font-bold text-white ${backgroundClass}`}
    >
      {text}
    </button>
  );
};

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

const SettingMenuLayer: React.FC<SettingMenuLayerProps> = ({
  releaseLabel,
  vibrationEnabled,
  locale,
  onChangeVibration,
  onChangeLocale,
  onSendDiagnostics,
  isSendingDiagnostics,
  showFinalResetConfirm,
  onOpenResetConfirm,
  onCloseResetConfirm,
  onResetGameData,
  onClose,
}) => {
  const { t } = useI18n();
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [showFontNotice, setShowFontNotice] = useState(false);

  const isResetEnabled = useMemo(
    () => resetConfirmText.trim() === "confirm",
    [resetConfirmText],
  );

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
          <div className="flex flex-col gap-5 text-left text-[1.5rem]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-bold">{t("settings.vibration")}</div>
              </div>
              <ToggleButton
                enabled={vibrationEnabled}
                onClick={() => onChangeVibration(!vibrationEnabled)}
              />
            </div>

            <div className="border-t-2 border-[#222] pt-4">
              <div className="mb-3 font-bold">{t("settings.language")}</div>
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
            </div>

            <div className="border-t-2 border-[#222] pt-4">
              <div className="flex items-center justify-between gap-4">
                <div className="font-bold">{t("settings.reportBug")}</div>
                <ActionButton
                  text={
                    isSendingDiagnostics
                      ? t("settings.sending")
                      : t("settings.send")
                  }
                  onClick={onSendDiagnostics}
                  disabled={isSendingDiagnostics}
                  variant="warning"
                />
              </div>
            </div>

            <div className="border-t-2 border-[#222] pt-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold">{t("settings.license")}</div>
                </div>
                <ActionButton
                  text={t("settings.view")}
                  onClick={() => setShowFontNotice(true)}
                />
              </div>
            </div>

            <div className="border-t-2 border-[#222] pt-4">
              <div>
                <div className="font-bold text-red-600">
                  {t("settings.raiseNewMonster")}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(event) => setResetConfirmText(event.target.value)}
                  placeholder={t("settings.resetConfirmPlaceholder")}
                  className="w-40 border-2 border-[#222] px-3 py-0.5 text-center placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d95763]"
                />
                <button
                  type={"button"}
                  disabled={!isResetEnabled}
                  onClick={onOpenResetConfirm}
                  className={`border-2 border-[#222] px-4 py-0.5 font-bold text-white ${
                    isResetEnabled
                      ? "bg-component-negative"
                      : "cursor-not-allowed bg-gray-400 opacity-60"
                  }`}
                >
                  {t("common.reset")}
                </button>
              </div>
            </div>
          </div>
        }
        onConfirm={onClose}
        confirmText={t("common.close")}
      />
      {showFontNotice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <PopupLayer
            title={t("settings.license")}
            content={
              <div className="text-left text-[1rem] leading-[1.4]">
                <div className="space-y-1 leading-[1.35]">
                  <div className="break-all font-bold">{FONT_NOTICE.name}</div>
                  {FONT_NOTICE.lines.map((line) => (
                    <div
                      key={line}
                      className="break-all text-[0.95rem] text-gray-600"
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            }
            onConfirm={() => setShowFontNotice(false)}
            confirmText={t("common.close")}
          />
        </div>
      )}
      {showFinalResetConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <PopupLayer
            title={t("settings.resetTitle")}
            content={
              <div className="leading-[1.6]">{t("settings.resetMessage")}</div>
            }
            onConfirm={onResetGameData}
            onCancel={onCloseResetConfirm}
            confirmText={t("common.reset")}
            cancelText={t("common.cancel")}
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

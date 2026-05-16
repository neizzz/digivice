import type React from "react";
import { useState } from "react";
import { useI18n } from "./i18n";
import { SetupLayer } from "./layers/SetupLayer";
import SettingMenuLayer from "./layers/SettingMenuLayer";
import { getGameSettings, updateGameSettings } from "./settings/gameSettings";

export type SnapshotLayer = "setup" | "settings";
type SnapshotPopup = "settings-reset";

const SNAPSHOT_RESET_CONFIRM_CODE = "123456";
const createSnapshotResetConfirmCode = () => SNAPSHOT_RESET_CONFIRM_CODE;

export function getSnapshotLayer(): SnapshotLayer | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = new URLSearchParams(window.location.search).get(
    "snapshotLayer",
  );

  return value === "setup" || value === "settings" ? value : null;
}

function getSnapshotPopup(): SnapshotPopup | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = new URLSearchParams(window.location.search).get(
    "snapshotPopup",
  );

  return value === "settings-reset" ? value : null;
}

const SnapshotScreen: React.FC<{ layer: SnapshotLayer }> = ({ layer }) => {
  const { locale, setLocale } = useI18n();
  const [gameSettings, setGameSettings] = useState(getGameSettings);
  const snapshotPopup = getSnapshotPopup();
  const [showFinalResetConfirm, setShowFinalResetConfirm] = useState(
    snapshotPopup === "settings-reset",
  );

  if (layer === "setup") {
    return <SetupLayer onComplete={() => undefined} />;
  }

  return (
    <SettingMenuLayer
      releaseLabel="snapshot"
      vibrationEnabled={gameSettings.vibrationEnabled}
      locale={locale}
      onChangeVibration={(enabled) => {
        setGameSettings(updateGameSettings({ vibrationEnabled: enabled }));
      }}
      onChangeLocale={setLocale}
      onSendDiagnostics={() => undefined}
      isSendingDiagnostics={false}
      showFinalResetConfirm={showFinalResetConfirm}
      onOpenResetConfirm={() => setShowFinalResetConfirm(true)}
      onCloseResetConfirm={() => setShowFinalResetConfirm(false)}
      onResetGameData={() => undefined}
      onClose={() => undefined}
      resetConfirmCodeFactory={createSnapshotResetConfirmCode}
    />
  );
};

export default SnapshotScreen;

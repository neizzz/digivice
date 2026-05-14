import type React from "react";
import { useState } from "react";
import { useI18n } from "./i18n";
import { SetupLayer } from "./layers/SetupLayer";
import SettingMenuLayer from "./layers/SettingMenuLayer";
import { getGameSettings, updateGameSettings } from "./settings/gameSettings";

export type SnapshotLayer = "setup" | "settings";

export function getSnapshotLayer(): SnapshotLayer | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = new URLSearchParams(window.location.search).get(
    "snapshotLayer",
  );

  return value === "setup" || value === "settings" ? value : null;
}

const SnapshotScreen: React.FC<{ layer: SnapshotLayer }> = ({ layer }) => {
  const { locale, setLocale } = useI18n();
  const [gameSettings, setGameSettings] = useState(getGameSettings);

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
      showFinalResetConfirm={false}
      onOpenResetConfirm={() => undefined}
      onCloseResetConfirm={() => undefined}
      onResetGameData={() => undefined}
      onClose={() => undefined}
    />
  );
};

export default SnapshotScreen;

import type React from "react";
import PopupLayer from "../components/PopupLayer";
import { useI18n } from "../i18n";

export interface AlertLayerProps {
  title?: string;
  message: string;
  onClose: () => void;
  onCancel?: () => void;
  onBack?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export const AlertLayer: React.FC<AlertLayerProps> = ({
  title,
  message,
  onClose,
  onCancel,
  onBack,
  confirmText,
  cancelText,
}) => {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <PopupLayer
        title={title ?? t("alert.title")}
        content={
          <div className="flex flex-col items-center gap-4">
            <p className="leading-[1.6]">{message}</p>
          </div>
        }
        onConfirm={onClose}
        onCancel={onCancel}
        onBack={onBack}
        confirmText={confirmText ?? t("common.confirm")}
        cancelText={cancelText ?? t("common.cancel")}
      />
    </div>
  );
};

export default AlertLayer;

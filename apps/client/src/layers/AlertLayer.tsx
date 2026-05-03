import type React from "react";
import PopupLayer from "../components/PopupLayer";

export interface AlertLayerProps {
  title?: string;
  message: string;
  onClose: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export const AlertLayer: React.FC<AlertLayerProps> = ({
  title = "Alert",
  message,
  onClose,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
}) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <PopupLayer
        title={title}
        content={
          <div className="flex flex-col items-center gap-4">
            <p className="leading-[1.6]">{message}</p>
          </div>
        }
        onConfirm={onClose}
        onCancel={onCancel}
        confirmText={confirmText}
        cancelText={cancelText}
      />
    </div>
  );
};

export default AlertLayer;

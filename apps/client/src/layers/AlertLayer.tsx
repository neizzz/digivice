import type React from "react";
import PopupLayer from "../components/PopupLayer";

export interface AlertLayerProps {
  title?: string;
  message: string;
  onClose: () => void;
}

export const AlertLayer: React.FC<AlertLayerProps> = ({
  title = "알림",
  message,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <PopupLayer
        title={title}
        content={
          <div className="flex flex-col items-center gap-4">
            <p className="text-base">{message}</p>
          </div>
        }
        onConfirm={onClose}
        confirmText="Confirm"
      />
    </div>
  );
};

export default AlertLayer;

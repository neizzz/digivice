import { useState, useCallback } from "react";

interface AlertOptions {
  title?: string;
  message: string;
}

export const useAlert = () => {
  const [alertState, setAlertState] = useState<AlertOptions | null>(null);

  const showAlert = useCallback((message: string, title?: string) => {
    setAlertState({ message, title });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertState(null);
  }, []);

  return {
    alertState,
    showAlert,
    hideAlert,
  };
};

export default useAlert;

import { createContext, useContext, type ReactNode } from "react";
import { useMLAlertEngine, type AnalysisSnapshot } from "@/hooks/useMLAlertEngine";
import type { Alert } from "@/types/monitoring";

interface MLAlertContextValue {
  mlAlerts:           Alert[];
  snapshot:           AnalysisSnapshot | null;
  updateMLAlertStatus: (id: string, status: Alert["status"]) => void;
}

const MLAlertContext = createContext<MLAlertContextValue>({
  mlAlerts:            [],
  snapshot:            null,
  updateMLAlertStatus: () => {},
});

export function MLAlertProvider({ children }: { children: ReactNode }) {
  const { mlAlerts, snapshot, updateAlertStatus } = useMLAlertEngine();
  return (
    <MLAlertContext.Provider value={{ mlAlerts, snapshot, updateMLAlertStatus: updateAlertStatus }}>
      {children}
    </MLAlertContext.Provider>
  );
}

export function useMLAlerts() {
  return useContext(MLAlertContext);
}

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAllWorkersMLAlerts } from "@/hooks/useAllWorkersMLAlerts";
import { useThresholdAlerts } from "@/hooks/useThresholdAlerts";
import { useNotificationService } from "@/hooks/useNotificationService";
import { DEFAULT_EMPLOYEE_ID, useNotificationSettings } from "@/hooks/useMonitoringData";
import type { Alert } from "@/types/monitoring";
import type { AnalysisSnapshot } from "@/hooks/useMLAlertEngine";

interface MLAlertContextValue {
  mlAlerts:                   Alert[];
  thresholdAlerts:            Alert[];
  allAlerts:                  Alert[];
  workerSnapshots:            Map<string, AnalysisSnapshot>;
  updateMLAlertStatus:        (id: string, status: Alert["status"]) => void;
  updateThresholdAlertStatus: (id: string, status: Alert["status"]) => void;
}

const MLAlertContext = createContext<MLAlertContextValue>({
  mlAlerts:                   [],
  thresholdAlerts:            [],
  allAlerts:                  [],
  workerSnapshots:            new Map(),
  updateMLAlertStatus:        () => {},
  updateThresholdAlertStatus: () => {},
});

export function MLAlertProvider({ children }: { children: ReactNode }) {
  const { mlAlerts, workerSnapshots, updateAlertStatus }        = useAllWorkersMLAlerts();
  const { thresholdAlerts, updateThresholdAlertStatus }         = useThresholdAlerts();
  const { data: notifData }                                     = useNotificationSettings(DEFAULT_EMPLOYEE_ID);

  const allAlerts = useMemo(() =>
    [...mlAlerts, ...thresholdAlerts].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    ),
    [mlAlerts, thresholdAlerts],
  );

  useNotificationService(allAlerts, notifData?.notifications ?? null);

  return (
    <MLAlertContext.Provider value={{
      mlAlerts,
      thresholdAlerts,
      allAlerts,
      workerSnapshots,
      updateMLAlertStatus:        updateAlertStatus,
      updateThresholdAlertStatus,
    }}>
      {children}
    </MLAlertContext.Provider>
  );
}

export function useMLAlerts() {
  return useContext(MLAlertContext);
}

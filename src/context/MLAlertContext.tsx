import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAllWorkersMLAlerts } from "@/hooks/useAllWorkersMLAlerts";
import { useThresholdAlerts } from "@/hooks/useThresholdAlerts";
import { useWorkerZoneMonitor, type WorkerPosition } from "@/hooks/useWorkerZoneMonitor";
import { useNotificationService } from "@/hooks/useNotificationService";
import { DEFAULT_EMPLOYEE_ID, useNotificationSettings } from "@/hooks/useMonitoringData";
import type { Alert } from "@/types/monitoring";
import type { AnalysisSnapshot } from "@/hooks/useMLAlertEngine";

interface MLAlertContextValue {
  mlAlerts:                Alert[];
  thresholdAlerts:         Alert[];
  zoneAlerts:              Alert[];
  allAlerts:               Alert[];
  workerSnapshots:         Map<string, AnalysisSnapshot>;
  workerPositions:         Map<string, WorkerPosition>;
  updateMLAlertStatus:        (id: string, status: Alert["status"]) => void;
  updateThresholdAlertStatus: (id: string, status: Alert["status"]) => void;
  updateZoneAlertStatus:      (id: string, status: Alert["status"]) => void;
}

const MLAlertContext = createContext<MLAlertContextValue>({
  mlAlerts:                [],
  thresholdAlerts:         [],
  zoneAlerts:              [],
  allAlerts:               [],
  workerSnapshots:         new Map(),
  workerPositions:         new Map(),
  updateMLAlertStatus:        () => {},
  updateThresholdAlertStatus: () => {},
  updateZoneAlertStatus:      () => {},
});

export function MLAlertProvider({ children }: { children: ReactNode }) {
  const { mlAlerts, workerSnapshots, updateAlertStatus }        = useAllWorkersMLAlerts();
  const { thresholdAlerts, updateThresholdAlertStatus }         = useThresholdAlerts();
  const { zoneAlerts, workerPositions, updateZoneAlertStatus }  = useWorkerZoneMonitor();
  const { data: notifData }                                     = useNotificationSettings(DEFAULT_EMPLOYEE_ID);

  const allAlerts = useMemo(() =>
    [...mlAlerts, ...thresholdAlerts, ...zoneAlerts].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    ),
    [mlAlerts, thresholdAlerts, zoneAlerts],
  );

  useNotificationService(allAlerts, notifData?.notifications ?? null);

  return (
    <MLAlertContext.Provider value={{
      mlAlerts, thresholdAlerts, zoneAlerts, allAlerts,
      workerSnapshots, workerPositions,
      updateMLAlertStatus:        updateAlertStatus,
      updateThresholdAlertStatus,
      updateZoneAlertStatus,
    }}>
      {children}
    </MLAlertContext.Provider>
  );
}

export function useMLAlerts() {
  return useContext(MLAlertContext);
}

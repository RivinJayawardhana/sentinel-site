import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchBootstrap, fetchIoTData, fetchAllIoTReadings, fetchSettings, ingestTelemetry, updateSettings, updateEmployeeDevice, updateAlertStatus, fetchNotificationSettings, updateNotificationSettings, fetchZones, createOrUpdateZone, deleteZone, fetchEmployeeHistory } from "@/lib/api";
import type { NotificationSettings, TelemetryPoint, Thresholds, ZoneDefinition } from "@/types/monitoring";

export const DEFAULT_EMPLOYEE_ID = import.meta.env.VITE_EMPLOYEE_ID ?? "EMP001";

export function useIoTData() {
  return useQuery({
    queryKey: ["iot-live"],
    queryFn: fetchIoTData,
    refetchInterval: 5000,
    staleTime: 4000,
  });
}

export function useAllIoTData() {
  return useQuery({
    queryKey: ["iot-all"],
    queryFn: fetchAllIoTReadings,
    refetchInterval: 30000,
    staleTime: 25000,
  });
}

export function useMonitoringData(employeeId = DEFAULT_EMPLOYEE_ID) {
  return useQuery({
    queryKey: ["monitoring-bootstrap", employeeId],
    queryFn: () => fetchBootstrap(employeeId),
    refetchInterval: 10000,
    staleTime: 5000,
  });
}

export function useEmployeeHistory(employeeId: string, limit = 120) {
  return useQuery({
    queryKey: ["employee-history", employeeId, limit],
    queryFn: () => fetchEmployeeHistory(employeeId, limit),
    enabled: Boolean(employeeId),
    refetchInterval: 5000,
    staleTime: 4000,
  });
}

export function useIngestTelemetry(employeeId = DEFAULT_EMPLOYEE_ID) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => ingestTelemetry(employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring-bootstrap", employeeId] });
    },
  });
}

export function useUpdateThresholds(employeeId = DEFAULT_EMPLOYEE_ID) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (thresholds: Thresholds) => updateSettings(employeeId, thresholds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threshold-settings", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["monitoring-bootstrap", employeeId] });
    },
  });
}

export function useThresholdSettings(employeeId = DEFAULT_EMPLOYEE_ID) {
  return useQuery({
    queryKey: ["threshold-settings", employeeId],
    queryFn: () => fetchSettings(employeeId),
    staleTime: 10000,
  });
}

export function useNotificationSettings(employeeId = DEFAULT_EMPLOYEE_ID) {
  return useQuery({
    queryKey: ["notification-settings", employeeId],
    queryFn: () => fetchNotificationSettings(employeeId),
    staleTime: 10000,
  });
}

export function useUpdateNotifications(employeeId = DEFAULT_EMPLOYEE_ID) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notifications: NotificationSettings) => updateNotificationSettings(employeeId, notifications),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-settings", employeeId] });
    },
  });
}

export function useUpdateDevice(employeeId = DEFAULT_EMPLOYEE_ID) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceId: string) => updateEmployeeDevice(employeeId, deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring-bootstrap", employeeId] });
    },
  });
}

export function useUpdateAlertStatus(employeeId = DEFAULT_EMPLOYEE_ID) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ alertId, status }: { alertId: string; status: "active" | "acknowledged" | "resolved" }) =>
      updateAlertStatus(alertId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring-bootstrap", employeeId] });
    },
  });
}

export function useZoneDefinitions() {
  return useQuery({
    queryKey: ["zone-definitions"],
    queryFn: fetchZones,
    staleTime: 10000,
  });
}

export function useUpsertZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (zone: ZoneDefinition) => createOrUpdateZone(zone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zone-definitions"] });
      queryClient.invalidateQueries({ queryKey: ["monitoring-bootstrap", DEFAULT_EMPLOYEE_ID] });
    },
  });
}

export function useDeleteZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (zoneName: string) => deleteZone(zoneName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zone-definitions"] });
      queryClient.invalidateQueries({ queryKey: ["monitoring-bootstrap", DEFAULT_EMPLOYEE_ID] });
    },
  });
}

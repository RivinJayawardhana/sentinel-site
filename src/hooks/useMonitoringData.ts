import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchBootstrap, ingestTelemetry, updateSettings, updateEmployeeDevice } from "@/lib/api";
import type { Thresholds } from "@/types/monitoring";

export const DEFAULT_EMPLOYEE_ID = import.meta.env.VITE_EMPLOYEE_ID ?? "EMP001";

export function useMonitoringData(employeeId = DEFAULT_EMPLOYEE_ID) {
  return useQuery({
    queryKey: ["monitoring-bootstrap", employeeId],
    queryFn: () => fetchBootstrap(employeeId),
    refetchInterval: 10000,
    staleTime: 5000,
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
      queryClient.invalidateQueries({ queryKey: ["monitoring-bootstrap", employeeId] });
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDangerZone, deleteDangerZone, fetchDangerZones, updateAlertStatus } from "@/lib/api";
import type { DangerZone } from "@/types/monitoring";
import { useMonitoringData } from "@/hooks/useMonitoringData";

export function useDangerZones() {
  const queryClient = useQueryClient();
  const { data } = useMonitoringData();
  const breachAlerts = (data?.alerts ?? []).filter((a) => a.type === "zone_breach");

  const zonesQuery = useQuery({
    queryKey: ["danger-zones"],
    queryFn: fetchDangerZones,
    staleTime: 10000,
  });

  const addZone = useMutation({
    mutationFn: (draft: Omit<DangerZone, "id" | "createdAt">) => createDangerZone(draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["danger-zones"] });
      queryClient.invalidateQueries({ queryKey: ["monitoring-bootstrap"], exact: false });
    },
  });

  const removeZone = useMutation({
    mutationFn: (id: string) => deleteDangerZone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["danger-zones"] });
      queryClient.invalidateQueries({ queryKey: ["monitoring-bootstrap"], exact: false });
    },
  });

  const dismissAlert = useMutation({
    mutationFn: (alertId: string) => updateAlertStatus(alertId, "resolved"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring-bootstrap"], exact: false });
    },
  });

  const clearAllAlerts = useMutation({
    mutationFn: async (alertIds: string[]) => {
      for (const id of alertIds) {
        await updateAlertStatus(id, "resolved");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitoring-bootstrap"], exact: false });
    },
  });

  return {
    zones: zonesQuery.data?.zones ?? [],
    breachAlerts,
    addZone: (draft: Omit<DangerZone, "id" | "createdAt">) => addZone.mutate(draft),
    removeZone: (id: string) => removeZone.mutate(id),
    dismissAlert: (id: string) => dismissAlert.mutate(id),
    clearAllAlerts: () => clearAllAlerts.mutate(breachAlerts.map((a) => a.id)),
  };
}

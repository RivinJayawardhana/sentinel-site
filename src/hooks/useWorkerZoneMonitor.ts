import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMonitoringData, useZoneDefinitions } from "./useMonitoringData";
import { fetchEmployeeLatest, fetchDangerZones } from "@/lib/api";
import { isInsideZone, haversineDistance } from "@/lib/geo";
import type { Alert, DangerZone, ZoneDefinition } from "@/types/monitoring";

const COOLDOWN_MS = 10 * 60 * 1000; // 10 min per worker-zone pair
const MAX_ALERTS  = 300;

function uid() {
  return `zone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface WorkerPosition {
  lat:                  number;
  lng:                  number;
  ts:                   number;
  hasGps:               boolean;
  inDangerZones:        string[];   // danger zone names the worker is currently inside
  outsideAssignedZone:  boolean;    // true when assigned zone has GPS and worker is outside it
  distanceToDangerZones: Array<{ name: string; distanceM: number; inside: boolean }>;
}

export function useWorkerZoneMonitor() {
  const { data: bootstrap }      = useMonitoringData();
  const { data: zdData }         = useZoneDefinitions();
  const { data: dzData }         = useQuery({
    queryKey:  ["danger-zones"],
    queryFn:   fetchDangerZones,
    staleTime: 30_000,
  });

  const workers     = bootstrap?.workers ?? [];
  const dangerZones = (dzData?.zones ?? []) as DangerZone[];
  const zoneDefs    = (zdData?.zones ?? []) as ZoneDefinition[];

  // Fetch latest telemetry (GPS) for every worker in parallel
  const latestResults = useQueries({
    queries: workers.map(w => ({
      queryKey:        ["worker-latest", w.id] as const,
      queryFn:         () => fetchEmployeeLatest(w.id),
      enabled:         Boolean(w.id),
      refetchInterval: 30_000,
      staleTime:       25_000,
    })),
  });

  const [zoneAlerts, setZoneAlerts] = useState<Alert[]>([]);
  const cooldowns                   = useRef<Map<string, number>>(new Map());
  const zoneAlertsRef               = useRef<Alert[]>([]);

  useEffect(() => { zoneAlertsRef.current = zoneAlerts; }, [zoneAlerts]);

  const dataKey = latestResults.map(r => r.dataUpdatedAt ?? 0).join(",");

  useEffect(() => {
    if (!workers.length || (!dangerZones.length && !zoneDefs.some(z => z.centerLat))) return;

    const now      = Date.now();
    const newAlerts: Alert[] = [];

    workers.forEach((w, i) => {
      const latest = latestResults[i]?.data;
      if (!latest) return;

      const { latitude: lat, longitude: lng } = latest;
      const hasGps = lat !== 0 || lng !== 0;
      if (!hasGps) return;

      // ── Danger zone breach ──────────────────────────────────────────────
      for (const dz of dangerZones) {
        const inside = isInsideZone(lat, lng, dz.centerLat, dz.centerLng, dz.radiusMeters);
        const key    = `${w.id}_dz_${dz.id}`;

        if (inside) {
          if (now - (cooldowns.current.get(key) ?? 0) > COOLDOWN_MS) {
            cooldowns.current.set(key, now);
            newAlerts.push({
              id: uid(), workerId: w.id, workerName: w.name,
              type: "zone_breach", severity: "critical",
              message: `${w.name} entered danger zone: "${dz.name}"`,
              timestamp: new Date().toISOString(),
              status: "active", zone: w.zone,
              source: "zone",
            });
          }
        } else {
          // Reset cooldown when worker leaves so next entry re-triggers
          cooldowns.current.delete(key);
        }
      }

      // ── Worker outside assigned GPS zone ───────────────────────────────
      const assignedDef = zoneDefs.find(zd => zd.name === w.zone && zd.centerLat && zd.centerLng && zd.radiusMeters);
      if (assignedDef) {
        const inside = isInsideZone(lat, lng, assignedDef.centerLat!, assignedDef.centerLng!, assignedDef.radiusMeters!);
        const key    = `${w.id}_assigned_${assignedDef.name}`;

        if (!inside) {
          if (now - (cooldowns.current.get(key) ?? 0) > COOLDOWN_MS) {
            cooldowns.current.set(key, now);
            newAlerts.push({
              id: uid(), workerId: w.id, workerName: w.name,
              type: "zone_breach", severity: "medium",
              message: `${w.name} is outside assigned zone "${assignedDef.name}"`,
              timestamp: new Date().toISOString(),
              status: "active", zone: w.zone,
              source: "zone",
            });
          }
        } else {
          cooldowns.current.delete(key);
        }
      }
    });

    if (newAlerts.length > 0) {
      setZoneAlerts(prev => [...newAlerts, ...prev].slice(0, MAX_ALERTS));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, dangerZones, zoneDefs]);

  // ── Worker position map for the UI ──────────────────────────────────────────
  const workerPositions = useMemo<Map<string, WorkerPosition>>(() => {
    const map = new Map<string, WorkerPosition>();

    workers.forEach((w, i) => {
      const latest = latestResults[i]?.data;
      const lat    = latest?.latitude  ?? 0;
      const lng    = latest?.longitude ?? 0;
      const hasGps = lat !== 0 || lng !== 0;

      const distanceToDangerZones = dangerZones.map(dz => ({
        name:      dz.name,
        distanceM: haversineDistance(lat, lng, dz.centerLat, dz.centerLng),
        inside:    hasGps && isInsideZone(lat, lng, dz.centerLat, dz.centerLng, dz.radiusMeters),
      }));

      const inDangerZones = distanceToDangerZones.filter(d => d.inside).map(d => d.name);

      const assignedDef = zoneDefs.find(zd => zd.name === w.zone && zd.centerLat && zd.centerLng && zd.radiusMeters);
      const outsideAssignedZone = hasGps && !!assignedDef
        && !isInsideZone(lat, lng, assignedDef.centerLat!, assignedDef.centerLng!, assignedDef.radiusMeters!);

      map.set(w.id, {
        lat, lng, ts: latest?.ts ?? 0,
        hasGps, inDangerZones, outsideAssignedZone,
        distanceToDangerZones,
      });
    });

    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, dangerZones, zoneDefs, workers]);

  const updateStatus = useCallback((id: string, status: Alert["status"]) => {
    setZoneAlerts(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  }, []);

  return { zoneAlerts, workerPositions, updateZoneAlertStatus: updateStatus };
}

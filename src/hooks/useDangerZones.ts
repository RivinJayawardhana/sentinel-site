import { useState, useCallback } from "react";

export interface DangerZone {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  createdAt: string;
  createdBy: string;
}

export interface BreachAlert {
  id: string;
  zoneId: string;
  zoneName: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  timestamp: string;
  status: "active" | "dismissed";
}

const ZONES_KEY = "sentinel_danger_zones";
const ALERTS_KEY = "sentinel_breach_alerts";

function loadJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function useDangerZones() {
  const [zones, setZones] = useState<DangerZone[]>(() => loadJson<DangerZone[]>(ZONES_KEY, []));
  const [breachAlerts, setBreachAlerts] = useState<BreachAlert[]>(() =>
    loadJson<BreachAlert[]>(ALERTS_KEY, [])
  );

  const addZone = useCallback(
    (draft: Omit<DangerZone, "id" | "createdAt">) => {
      const zone: DangerZone = {
        ...draft,
        id: `dz_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setZones((prev) => {
        const next = [...prev, zone];
        saveJson(ZONES_KEY, next);
        return next;
      });
    },
    []
  );

  const removeZone = useCallback((id: string) => {
    setZones((prev) => {
      const next = prev.filter((z) => z.id !== id);
      saveJson(ZONES_KEY, next);
      return next;
    });
  }, []);

  const addBreachAlert = useCallback(
    (alert: Omit<BreachAlert, "id" | "status">) => {
      const next: BreachAlert = { ...alert, id: `breach_${Date.now()}`, status: "active" };
      setBreachAlerts((prev) => {
        const updated = [next, ...prev].slice(0, 100); // keep latest 100
        saveJson(ALERTS_KEY, updated);
        return updated;
      });
    },
    []
  );

  const dismissAlert = useCallback((id: string) => {
    setBreachAlerts((prev) => {
      const updated = prev.map((a) => (a.id === id ? { ...a, status: "dismissed" as const } : a));
      saveJson(ALERTS_KEY, updated);
      return updated;
    });
  }, []);

  const clearAllAlerts = useCallback(() => {
    setBreachAlerts([]);
    localStorage.removeItem(ALERTS_KEY);
  }, []);

  return { zones, breachAlerts, addZone, removeZone, addBreachAlert, dismissAlert, clearAllAlerts };
}

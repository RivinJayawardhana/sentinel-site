import { useState, useEffect, useRef, useCallback } from "react";
import { useMonitoringData } from "./useMonitoringData";
import type { Alert } from "@/types/monitoring";

const COOLDOWN_MS = 5 * 60 * 1000;
const MAX_ALERTS  = 300;

function uid() {
  return `thr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useThresholdAlerts() {
  const { data }    = useMonitoringData();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const cooldowns   = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!data?.workers?.length || !data?.thresholds) return;

    const t   = data.thresholds;
    const now = Date.now();
    const can  = (key: string) => now - (cooldowns.current.get(key) ?? 0) > COOLDOWN_MS;
    const fire = (key: string) => cooldowns.current.set(key, now);

    const newAlerts: Alert[] = [];

    for (const w of data.workers) {
      const { id, name, heartRate: hr, temperature: temp, airQuality: aq, zone } = w;

      const add = (
        suffix: string,
        type: Alert["type"],
        severity: Alert["severity"],
        message: string,
      ) => {
        const key = `${id}_${suffix}`;
        if (!can(key)) return;
        fire(key);
        newAlerts.push({
          id: uid(), workerId: id, workerName: name,
          type, severity, message,
          timestamp: new Date().toISOString(),
          status: "active", zone,
          source: "threshold",
        });
      };

      // Heart rate checks
      if (hr > 0) {
        if (hr >= t.heartRate.criticalMax)
          add("hr_crit", "heart_rate", "critical",
            `${name}: Heart rate ${hr} BPM meets or exceeds critical threshold (≥${t.heartRate.criticalMax} BPM)`);
        else if (hr > t.heartRate.max)
          add("hr_warn", "heart_rate", "high",
            `${name}: Heart rate ${hr} BPM exceeds warning threshold (>${t.heartRate.max} BPM)`);
        else if (hr < t.heartRate.min)
          add("hr_low", "heart_rate", "medium",
            `${name}: Heart rate ${hr} BPM below minimum threshold (${t.heartRate.min} BPM)`);
      }

      // Temperature checks
      if (temp > 0) {
        if (temp >= t.temperature.criticalMax)
          add("tmp_crit", "temperature", "critical",
            `${name}: Temperature ${temp}°C meets or exceeds critical threshold (≥${t.temperature.criticalMax}°C)`);
        else if (temp > t.temperature.max)
          add("tmp_warn", "temperature", "high",
            `${name}: Temperature ${temp}°C exceeds warning threshold (>${t.temperature.max}°C)`);
        else if (temp < t.temperature.min)
          add("tmp_low", "temperature", "low",
            `${name}: Temperature ${temp}°C below minimum threshold (${t.temperature.min}°C)`);
      }

      // Air quality checks (lower AQI = worse air)
      if (aq > 0) {
        if (aq <= t.airQuality.criticalMin)
          add("aq_crit", "air_quality", "critical",
            `${name}: Air quality ${aq} AQI at or below critical threshold (≤${t.airQuality.criticalMin} AQI)`);
        else if (aq < t.airQuality.min)
          add("aq_warn", "air_quality", "high",
            `${name}: Air quality ${aq} AQI below warning threshold (<${t.airQuality.min} AQI)`);
      }
    }

    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev].slice(0, MAX_ALERTS));
    }
  }, [data]);

  const updateStatus = useCallback((id: string, status: Alert["status"]) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  }, []);

  return { thresholdAlerts: alerts, updateThresholdAlertStatus: updateStatus };
}

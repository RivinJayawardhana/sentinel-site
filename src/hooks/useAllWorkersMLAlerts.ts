import { useState, useEffect, useRef, useCallback } from "react";
import { useQueries } from "@tanstack/react-query";
import { useMonitoringData } from "./useMonitoringData";
import { usePretrainedModels, classifyWithKMeans, type TrainedModels } from "./usePretrainedModels";
import { loadIsolationForest, pearsonCorrelation, trainLinearRegression } from "@/lib/ml";
import { isSensorStuck } from "@/lib/preprocess";
import { fetchEmployeeHistory } from "@/lib/api";
import type { Alert, TelemetryPoint } from "@/types/monitoring";
import type { AnalysisSnapshot, TrendDirection } from "./useMLAlertEngine";

const COOLDOWN_MS  = 5 * 60 * 1000;
const TREND_WINDOW = 30;
const SLOPE_HR     = 0.3;
const SLOPE_TEMP   = 0.05;
const SLOPE_AQ     = 0.5;
const CORR_DRIFT   = 0.3;
const MAX_ALERTS   = 500;

function uid() {
  return `ml-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function trendDir(slope: number, threshold: number): TrendDirection {
  if (slope >  threshold) return "rising";
  if (slope < -threshold) return "falling";
  return "stable";
}

function isValidPoint(r: TelemetryPoint): boolean {
  return (
    Number.isFinite(r.heartRate)   && r.heartRate   >= 30  && r.heartRate   <= 220 &&
    Number.isFinite(r.temperature) && r.temperature >= 10  && r.temperature <= 50  &&
    Number.isFinite(r.airQuality)  && r.airQuality  >= 0   && r.airQuality  <= 1000
  );
}

// Pure function — runs all ML checks for one worker, returns alerts + snapshot
function analyzeWorker(
  workerId:   string,
  workerName: string,
  workerZone: string,
  history:    TelemetryPoint[],
  models:     TrainedModels,
  cooldowns:  Map<string, number>,
  prevAlerts: Alert[],
  lastClusters: Map<string, number>,
  now:        number,
): { alerts: Alert[]; snapshot: AnalysisSnapshot } {
  const can  = (key: string) => now - (cooldowns.get(key) ?? 0) > COOLDOWN_MS;
  const fire = (key: string) => cooldowns.set(key, now);

  const make = (fields: Partial<Alert> & Pick<Alert, "type" | "severity" | "message">): Alert => ({
    id: uid(), workerId, workerName,
    timestamp: new Date().toISOString(),
    status: "active", zone: workerZone,
    source: "ml",
    ...fields,
  });

  const sorted = [...history].sort((a, b) => a.ts - b.ts);
  const valid  = sorted.filter(isValidPoint);

  const emptySnapshot: AnalysisSnapshot = {
    activityCluster:       "Insufficient data",
    anomalyScore:          0,
    isAnomaly:             false,
    trends: {
      hr:   { direction: "stable", slope: 0 },
      temp: { direction: "stable", slope: 0 },
      aq:   { direction: "stable", slope: 0 },
    },
    liveCorrelations: {
      hr_temp: models.correlations.hr_temp,
      hr_aq:   models.correlations.hr_aq,
      temp_aq: models.correlations.temp_aq,
    },
    anomalyCountLast30Min: 0,
    lastUpdated: new Date(),
  };

  if (valid.length < 3) return { alerts: [], snapshot: emptySnapshot };

  const latest = valid[valid.length - 1];
  const hr     = latest.heartRate;
  const temp   = latest.temperature;
  const aq     = latest.airQuality;
  const point  = [hr, temp, aq];

  const newAlerts: Alert[] = [];

  // ── 1. Isolation Forest ──────────────────────────────────────────────────
  const isoModel              = loadIsolationForest(models.isolationForest);
  const { scores, isAnomaly } = isoModel.predict([point]);
  const score   = scores[0];
  const anomaly = isAnomaly[0];

  if (anomaly && can(`${workerId}_anomaly`)) {
    fire(`${workerId}_anomaly`);
    newAlerts.push(make({
      type:         "anomaly",
      severity:     score > 0.75 ? "critical" : "high",
      message:      `${workerName}: Multi-sensor anomaly detected (score ${score.toFixed(3)}). HR=${hr} BPM, Temp=${temp}°C, AQ=${aq}`,
      anomalyScore: score,
    }));
  }

  // ── 2. ML-learned IQR bounds ─────────────────────────────────────────────
  const t = models.thresholds;
  type BoundCheck = { key: string; cond: boolean; type: Alert["type"]; sev: Alert["severity"]; msg: string };
  const bounds: BoundCheck[] = [
    {
      key: "iqr_hr_hi", cond: hr > t.heart_rate.upperBound,
      type: "heart_rate", sev: hr > t.heart_rate.upperBound + 20 ? "critical" : "high",
      msg: `${workerName}: Heart rate ${hr} BPM exceeds ML-learned bound (${t.heart_rate.upperBound.toFixed(1)} BPM)`,
    },
    {
      key: "iqr_hr_lo", cond: hr < t.heart_rate.lowerBound,
      type: "heart_rate", sev: "medium",
      msg: `${workerName}: Heart rate ${hr} BPM below ML-learned bound (${t.heart_rate.lowerBound.toFixed(1)} BPM)`,
    },
    {
      key: "iqr_tmp_hi", cond: temp > t.temperature.upperBound,
      type: "temperature", sev: temp > t.temperature.upperBound + 2 ? "critical" : "high",
      msg: `${workerName}: Temperature ${temp}°C exceeds ML-learned bound (${t.temperature.upperBound.toFixed(1)}°C)`,
    },
    {
      key: "iqr_tmp_lo", cond: temp < t.temperature.lowerBound,
      type: "temperature", sev: "low",
      msg: `${workerName}: Temperature ${temp}°C below ML-learned bound (${t.temperature.lowerBound.toFixed(1)}°C)`,
    },
    {
      key: "iqr_aq_hi", cond: aq > t.air_quality.upperBound,
      type: "air_quality", sev: aq > t.air_quality.upperBound * 1.4 ? "critical" : "high",
      msg: `${workerName}: Air quality ${aq} AQI exceeds ML-learned bound (${t.air_quality.upperBound.toFixed(0)} AQI)`,
    },
  ];

  for (const b of bounds) {
    const fkey = `${workerId}_${b.key}`;
    if (b.cond && can(fkey)) {
      fire(fkey);
      newAlerts.push(make({ type: b.type, severity: b.sev, message: b.msg }));
    }
  }

  // ── 3. Stuck sensor ──────────────────────────────────────────────────────
  const recentHrs = valid.slice(-10).map(r => r.heartRate);
  if (isSensorStuck(recentHrs, 10) && can(`${workerId}_stuck`)) {
    fire(`${workerId}_stuck`);
    newAlerts.push(make({
      type: "device_offline", severity: "medium",
      message: `${workerName}: Heart rate sensor may be stuck — unchanged at ${hr} BPM for last 10 readings`,
    }));
  }

  // ── 4. K-Means activity cluster + jump detection ─────────────────────────
  const ctx          = valid.slice(-50).map(r => [r.heartRate, r.temperature, r.airQuality]);
  const cluster      = classifyWithKMeans(point, models.kmeans, ctx);
  const labels       = models.kmeans.clusterLabels;
  const clusterLabel = labels[cluster] ?? "Unknown";

  const prev = lastClusters.get(workerId);
  if (prev !== undefined && Math.abs(cluster - prev) >= 2 && can(`${workerId}_cluster_jump`)) {
    fire(`${workerId}_cluster_jump`);
    newAlerts.push(make({
      type: "anomaly", severity: "medium",
      message: `${workerName}: Sudden activity change — ${labels[prev] ?? prev} → ${clusterLabel}`,
    }));
  }
  lastClusters.set(workerId, cluster);

  // ── 5. Trend analysis (linear regression) ────────────────────────────────
  const win   = valid.slice(-TREND_WINDOW);
  const hrs   = win.map(r => r.heartRate);
  const temps = win.map(r => r.temperature);
  const aqs   = win.map(r => r.airQuality);

  const regHR   = trainLinearRegression(hrs);
  const regTemp = trainLinearRegression(temps);
  const regAQ   = trainLinearRegression(aqs);

  const hrDir   = trendDir(regHR.slope,   SLOPE_HR);
  const tempDir = trendDir(regTemp.slope, SLOPE_TEMP);
  const aqDir   = trendDir(regAQ.slope,   SLOPE_AQ);

  if (hrDir === "rising" && can(`${workerId}_trend_hr`)) {
    fire(`${workerId}_trend_hr`);
    newAlerts.push(make({
      type: "trend", severity: "medium",
      message: `${workerName}: Rising heart rate trend over last ${win.length} readings (slope: +${regHR.slope.toFixed(3)} BPM/reading)`,
    }));
  }
  if (tempDir === "rising" && can(`${workerId}_trend_temp`)) {
    fire(`${workerId}_trend_temp`);
    newAlerts.push(make({
      type: "trend", severity: "medium",
      message: `${workerName}: Rising temperature trend over last ${win.length} readings (slope: +${regTemp.slope.toFixed(3)}°C/reading)`,
    }));
  }
  if (aqDir === "rising" && can(`${workerId}_trend_aq`)) {
    fire(`${workerId}_trend_aq`);
    newAlerts.push(make({
      type: "trend", severity: "medium",
      message: `${workerName}: Degrading air quality trend over last ${win.length} readings (slope: +${regAQ.slope.toFixed(3)} AQI/reading)`,
    }));
  }

  // ── 6. Correlation drift vs trained baseline ─────────────────────────────
  const liveHrTemp = pearsonCorrelation(hrs, temps);
  const liveHrAq   = pearsonCorrelation(hrs, aqs);
  const liveTempAq = pearsonCorrelation(temps, aqs);

  if (Math.abs(liveHrTemp - models.correlations.hr_temp) > CORR_DRIFT && can(`${workerId}_corr_drift`)) {
    fire(`${workerId}_corr_drift`);
    newAlerts.push(make({
      type: "trend", severity: "low",
      message: `${workerName}: Sensor correlation drift — HR↔Temp baseline ${models.correlations.hr_temp.toFixed(2)} → live ${liveHrTemp.toFixed(2)}`,
    }));
  }

  // ── Anomaly count in last 30 min (from accumulated alerts for this worker) ──
  const cutoff = now - 30 * 60 * 1000;
  const anomalyCount = [...prevAlerts, ...newAlerts].filter(
    a => a.workerId === workerId &&
         a.type === "anomaly" &&
         new Date(a.timestamp).getTime() >= cutoff,
  ).length;

  const snapshot: AnalysisSnapshot = {
    activityCluster:       clusterLabel,
    anomalyScore:          score,
    isAnomaly:             anomaly,
    trends: {
      hr:   { direction: hrDir,   slope: regHR.slope   },
      temp: { direction: tempDir, slope: regTemp.slope },
      aq:   { direction: aqDir,   slope: regAQ.slope   },
    },
    liveCorrelations: { hr_temp: liveHrTemp, hr_aq: liveHrAq, temp_aq: liveTempAq },
    anomalyCountLast30Min: anomalyCount,
    lastUpdated: new Date(),
  };

  return { alerts: newAlerts, snapshot };
}

export function useAllWorkersMLAlerts() {
  const { data: bootstrap } = useMonitoringData();
  const { data: models }    = usePretrainedModels();
  const workers = bootstrap?.workers ?? [];

  // Fetch every worker's telemetry history in parallel
  const historyResults = useQueries({
    queries: workers.map(w => ({
      queryKey:        ["employee-history", w.id, 120] as const,
      queryFn:         () => fetchEmployeeHistory(w.id, 120),
      enabled:         Boolean(w.id),
      refetchInterval: 30_000,
      staleTime:       25_000,
    })),
  });

  const [mlAlerts,  setMlAlerts]  = useState<Alert[]>([]);
  const [snapshots, setSnapshots] = useState<Map<string, AnalysisSnapshot>>(new Map());

  const cooldowns    = useRef<Map<string, number>>(new Map());
  const lastClusters = useRef<Map<string, number>>(new Map());
  const mlAlertsRef  = useRef<Alert[]>([]);

  useEffect(() => { mlAlertsRef.current = mlAlerts; }, [mlAlerts]);

  // Stable key: changes only when a worker's data is actually refreshed
  const dataKey = historyResults.map(r => r.dataUpdatedAt ?? 0).join(",");

  useEffect(() => {
    if (!models || !workers.length) return;

    const now          = Date.now();
    const allNew: Alert[] = [];
    const newSnapshots = new Map<string, AnalysisSnapshot>();

    workers.forEach((w, i) => {
      const history = historyResults[i]?.data;
      if (!history) return; // skip workers whose history hasn't loaded yet

      const { alerts, snapshot } = analyzeWorker(
        w.id, w.name, w.zone,
        history, models,
        cooldowns.current,
        mlAlertsRef.current,
        lastClusters.current,
        now,
      );

      allNew.push(...alerts);
      newSnapshots.set(w.id, snapshot);
    });

    if (allNew.length > 0) {
      setMlAlerts(prev => [...allNew, ...prev].slice(0, MAX_ALERTS));
    }
    setSnapshots(newSnapshots);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, models]);

  const updateStatus = useCallback((id: string, status: Alert["status"]) => {
    setMlAlerts(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  }, []);

  return { mlAlerts, workerSnapshots: snapshots, updateAlertStatus: updateStatus };
}

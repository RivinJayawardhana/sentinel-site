import { useState, useEffect, useRef, useCallback } from "react";
import { useIoTData } from "./useMonitoringData";
import { useIoTDataLogger } from "./useIoTDataLogger";
import { usePretrainedModels, classifyWithKMeans, type TrainedModels } from "./usePretrainedModels";
import { loadIsolationForest, pearsonCorrelation, trainLinearRegression } from "@/lib/ml";
import { cleanReadings, isValidReading, isSensorStuck } from "@/lib/preprocess";
import type { Alert, IoTReading } from "@/types/monitoring";

const COOLDOWN_MS   = 5 * 60 * 1000;  // 5 min per alert type — prevents spam
const PERIODIC_MS   = 5 * 60 * 1000;  // periodic analysis interval
const TREND_WINDOW  = 30;              // readings used for regression
const CORR_DRIFT    = 0.3;             // Pearson drift threshold vs trained baseline
const SLOPE_HR      = 0.3;             // BPM/reading to count as "rising"
const SLOPE_TEMP    = 0.05;            // °C/reading
const SLOPE_AQ      = 0.5;             // AQI/reading
const MAX_ALERTS    = 300;

export type TrendDirection = "rising" | "falling" | "stable";

export interface AnalysisSnapshot {
  activityCluster:      string;
  anomalyScore:         number;
  isAnomaly:            boolean;
  trends: {
    hr:   { direction: TrendDirection; slope: number };
    temp: { direction: TrendDirection; slope: number };
    aq:   { direction: TrendDirection; slope: number };
  };
  liveCorrelations: { hr_temp: number; hr_aq: number; temp_aq: number };
  anomalyCountLast30Min: number;
  lastUpdated: Date;
}

function uid() {
  return `ml-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function trendDir(slope: number, threshold: number): TrendDirection {
  if (slope >  threshold) return "rising";
  if (slope < -threshold) return "falling";
  return "stable";
}

function makeAlert(fields: Partial<Alert> & Pick<Alert, "type" | "severity" | "message">): Alert {
  return {
    id: uid(),
    workerId:   "iot-sensor",
    workerName: "IoT Sensor",
    timestamp:  new Date().toISOString(),
    status:     "active",
    zone:       "Sensor Zone",
    source:     "ml",
    ...fields,
  };
}

export function useMLAlertEngine() {
  const { data: latestReading } = useIoTData();
  const { allData }             = useIoTDataLogger();
  const { data: models }        = usePretrainedModels();

  const [mlAlerts, setMlAlerts] = useState<Alert[]>([]);
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null);

  // Refs keep the periodic effect free from stale closures
  const modelsRef    = useRef<TrainedModels | undefined>(undefined);
  const allDataRef   = useRef<IoTReading[]>([]);
  const mlAlertsRef  = useRef<Alert[]>([]);
  const cooldowns    = useRef<Map<string, number>>(new Map());
  const lastCluster  = useRef<number | null>(null);

  useEffect(() => { modelsRef.current  = models;   }, [models]);
  useEffect(() => { allDataRef.current = allData;  }, [allData]);
  useEffect(() => { mlAlertsRef.current = mlAlerts; }, [mlAlerts]);

  const push = useCallback((a: Alert) => {
    setMlAlerts(prev => [a, ...prev].slice(0, MAX_ALERTS));
  }, []);

  const updateAlertStatus = useCallback((id: string, status: Alert["status"]) => {
    setMlAlerts(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  }, []);

  // ── Real-time: fires on every new IoT reading (every ~5 s) ─────────────────
  useEffect(() => {
    if (!latestReading) return;

    const m = modelsRef.current;
    if (!m) return;
    if (!isValidReading(latestReading)) return;

    // Local helpers that always read the latest cooldown state via ref
    const can   = (key: string) => Date.now() - (cooldowns.current.get(key) ?? 0) > COOLDOWN_MS;
    const fired = (key: string) => cooldowns.current.set(key, Date.now());

    const { heart_rate: hr, temperature: temp, air_quality: aq } = latestReading;
    const point    = [hr, temp, aq];
    const isoModel = loadIsolationForest(m.isolationForest);

    // ── 1. Isolation Forest anomaly detection ─────────────────────────────────
    const { scores, isAnomaly } = isoModel.predict([point]);
    const score   = scores[0];
    const anomaly = isAnomaly[0];

    if (anomaly && can("anomaly")) {
      fired("anomaly");
      push(makeAlert({
        type:         "anomaly",
        severity:     score > 0.75 ? "critical" : "high",
        message:      `Multi-sensor anomaly detected (score ${score.toFixed(3)}, threshold ${m.isolationForest.threshold.toFixed(3)}). HR=${hr} BPM, Temp=${temp}°C, AQ=${aq}`,
        anomalyScore: score,
      }));
    }

    // ── 2. ML-learned IQR bounds checks ──────────────────────────────────────
    const t = m.thresholds;
    const boundChecks: Array<{ key: string; cond: boolean; type: Alert["type"]; sev: Alert["severity"]; msg: string }> = [
      { key: "iqr_hr_hi",   cond: hr   > t.heart_rate.upperBound,    type: "heart_rate",  sev: hr   > t.heart_rate.upperBound   + 20 ? "critical" : "high",   msg: `Heart rate ${hr} BPM exceeds ML-learned bound (${t.heart_rate.upperBound.toFixed(1)} BPM)` },
      { key: "iqr_hr_lo",   cond: hr   < t.heart_rate.lowerBound,    type: "heart_rate",  sev: "medium", msg: `Heart rate ${hr} BPM below ML-learned bound (${t.heart_rate.lowerBound.toFixed(1)} BPM)` },
      { key: "iqr_temp_hi", cond: temp > t.temperature.upperBound,   type: "temperature", sev: temp > t.temperature.upperBound + 2 ? "critical" : "high",   msg: `Temperature ${temp}°C exceeds ML-learned bound (${t.temperature.upperBound.toFixed(1)}°C)` },
      { key: "iqr_temp_lo", cond: temp < t.temperature.lowerBound,   type: "temperature", sev: "low",    msg: `Temperature ${temp}°C below ML-learned bound (${t.temperature.lowerBound.toFixed(1)}°C)` },
      { key: "iqr_aq_hi",   cond: aq   > t.air_quality.upperBound,   type: "air_quality", sev: aq   > t.air_quality.upperBound  * 1.4 ? "critical" : "high", msg: `Air quality ${aq} AQI exceeds ML-learned bound (${t.air_quality.upperBound.toFixed(0)} AQI)` },
    ];

    for (const c of boundChecks) {
      if (c.cond && can(c.key)) {
        fired(c.key);
        push(makeAlert({ type: c.type, severity: c.sev, message: c.msg }));
      }
    }

    // ── 3. Stuck-sensor detection (data quality check) ────────────────────────
    const recentHrs = allDataRef.current.slice(-10).map(r => r.heart_rate);
    if (isSensorStuck(recentHrs, 10) && can("stuck_hr")) {
      fired("stuck_hr");
      push(makeAlert({ type: "device_offline", severity: "medium", message: `Heart rate sensor may be stuck — value unchanged at ${hr} BPM for last 10 readings` }));
    }

    // ── 4. K-Means cluster jump (sudden activity change) ──────────────────────
    const ctx = allDataRef.current.filter(isValidReading).slice(-50).map(r => [r.heart_rate, r.temperature, r.air_quality]);
    if (ctx.length >= 3) {
      const cluster = classifyWithKMeans(point, m.kmeans, ctx);
      const labels  = m.kmeans.clusterLabels;

      if (lastCluster.current !== null && Math.abs(cluster - lastCluster.current) >= 2 && can("cluster_jump")) {
        fired("cluster_jump");
        push(makeAlert({ type: "anomaly", severity: "medium", message: `Sudden activity change: ${labels[lastCluster.current]} → ${labels[cluster]}` }));
      }
      lastCluster.current = cluster;

      const anomalyCount30m = mlAlertsRef.current.filter(
        a => a.type === "anomaly" && Date.now() - new Date(a.timestamp).getTime() < 30 * 60 * 1000
      ).length;

      setSnapshot(prev => ({
        activityCluster:       labels[cluster] ?? "Unknown",
        anomalyScore:          score,
        isAnomaly:             anomaly,
        trends:                prev?.trends ?? { hr: { direction: "stable", slope: 0 }, temp: { direction: "stable", slope: 0 }, aq: { direction: "stable", slope: 0 } },
        liveCorrelations:      prev?.liveCorrelations ?? { hr_temp: m.correlations.hr_temp, hr_aq: m.correlations.hr_aq, temp_aq: m.correlations.temp_aq },
        anomalyCountLast30Min: anomalyCount30m,
        lastUpdated:           new Date(),
      }));
    }
  }, [latestReading?.id, push]);

  // ── Periodic: trend + correlation analysis every 5 minutes ────────────────
  useEffect(() => {
    function run() {
      const m    = modelsRef.current;
      const data = allDataRef.current;
      if (!m || data.length < TREND_WINDOW) return;

      const clean = cleanReadings(data).slice(-TREND_WINDOW);
      if (clean.length < 10) return;

      const can   = (key: string) => Date.now() - (cooldowns.current.get(key) ?? 0) > COOLDOWN_MS;
      const fired = (key: string) => cooldowns.current.set(key, Date.now());

      const hrs   = clean.map(r => r.hr);
      const temps = clean.map(r => r.temp);
      const aqs   = clean.map(r => r.aq);

      // ── Trend analysis via linear regression ─────────────────────────────
      const regHR   = trainLinearRegression(hrs);
      const regTemp = trainLinearRegression(temps);
      const regAQ   = trainLinearRegression(aqs);

      const hrDir   = trendDir(regHR.slope,   SLOPE_HR);
      const tempDir = trendDir(regTemp.slope,  SLOPE_TEMP);
      const aqDir   = trendDir(regAQ.slope,    SLOPE_AQ);

      if (hrDir === "rising" && can("trend_hr")) {
        fired("trend_hr");
        push(makeAlert({ type: "trend", severity: "medium", message: `Rising heart rate trend over last ${clean.length} readings (slope: +${regHR.slope.toFixed(3)} BPM/reading)` }));
      }
      if (tempDir === "rising" && can("trend_temp")) {
        fired("trend_temp");
        push(makeAlert({ type: "trend", severity: "medium", message: `Rising temperature trend over last ${clean.length} readings (slope: +${regTemp.slope.toFixed(3)}°C/reading)` }));
      }
      if (aqDir === "rising" && can("trend_aq")) {
        fired("trend_aq");
        push(makeAlert({ type: "trend", severity: "medium", message: `Degrading air quality trend over last ${clean.length} readings (slope: +${regAQ.slope.toFixed(3)} AQI/reading)` }));
      }

      // ── Correlation drift vs trained baseline ─────────────────────────────
      const liveHrTemp = pearsonCorrelation(hrs, temps);
      const liveHrAq   = pearsonCorrelation(hrs, aqs);
      const liveTempAq = pearsonCorrelation(temps, aqs);

      if (Math.abs(liveHrTemp - m.correlations.hr_temp) > CORR_DRIFT && can("corr_drift")) {
        fired("corr_drift");
        push(makeAlert({ type: "trend", severity: "low", message: `Sensor correlation drift detected: HR↔Temp changed from ${m.correlations.hr_temp.toFixed(2)} (trained baseline) to ${liveHrTemp.toFixed(2)} (live)` }));
      }

      setSnapshot(prev => prev ? {
        ...prev,
        trends: {
          hr:   { direction: hrDir,   slope: regHR.slope   },
          temp: { direction: tempDir, slope: regTemp.slope },
          aq:   { direction: aqDir,   slope: regAQ.slope   },
        },
        liveCorrelations: { hr_temp: liveHrTemp, hr_aq: liveHrAq, temp_aq: liveTempAq },
        lastUpdated: new Date(),
      } : null);
    }

    run();
    const id = setInterval(run, PERIODIC_MS);
    return () => clearInterval(id);
  }, [push]); // runs once on mount; uses refs for live data access

  return { mlAlerts, snapshot, updateAlertStatus };
}

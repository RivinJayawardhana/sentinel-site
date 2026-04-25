import { useState, useEffect } from "react";
import { usePretrainedModels, classifyWithKMeans } from "./usePretrainedModels";
import { loadIsolationForest, pearsonCorrelation, trainLinearRegression } from "@/lib/ml";
import type { TelemetryPoint } from "@/types/monitoring";
import type { AnalysisSnapshot, TrendDirection } from "./useMLAlertEngine";

const SLOPE_HR    = 0.3;
const SLOPE_TEMP  = 0.05;
const SLOPE_AQ    = 0.5;
const TREND_WINDOW = 30;

function trendDir(slope: number, threshold: number): TrendDirection {
  if (slope >  threshold) return "rising";
  if (slope < -threshold) return "falling";
  return "stable";
}

export function useWorkerMLAnalysis(history: TelemetryPoint[] | undefined) {
  const { data: models }        = usePretrainedModels();
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null);

  useEffect(() => {
    if (!models || !history || history.length < 3) return;

    const sorted = [...history].sort((a, b) => a.ts - b.ts);
    const latest = sorted[sorted.length - 1];
    const point  = [latest.heartRate, latest.temperature, latest.airQuality];

    const isoModel              = loadIsolationForest(models.isolationForest);
    const { scores, isAnomaly } = isoModel.predict([point]);

    const ctx          = sorted.slice(-50).map(r => [r.heartRate, r.temperature, r.airQuality]);
    const cluster      = classifyWithKMeans(point, models.kmeans, ctx);
    const clusterLabel = models.kmeans.clusterLabels[cluster] ?? "Unknown";

    const win   = sorted.slice(-TREND_WINDOW);
    const hrs   = win.map(r => r.heartRate);
    const temps = win.map(r => r.temperature);
    const aqs   = win.map(r => r.airQuality);

    const regHR   = trainLinearRegression(hrs);
    const regTemp = trainLinearRegression(temps);
    const regAQ   = trainLinearRegression(aqs);

    const liveHrTemp = pearsonCorrelation(hrs, temps);
    const liveHrAq   = pearsonCorrelation(hrs, aqs);
    const liveTempAq = pearsonCorrelation(temps, aqs);

    setSnapshot({
      activityCluster:       clusterLabel,
      anomalyScore:          scores[0],
      isAnomaly:             isAnomaly[0],
      trends: {
        hr:   { direction: trendDir(regHR.slope,   SLOPE_HR),   slope: regHR.slope   },
        temp: { direction: trendDir(regTemp.slope, SLOPE_TEMP), slope: regTemp.slope },
        aq:   { direction: trendDir(regAQ.slope,   SLOPE_AQ),   slope: regAQ.slope   },
      },
      liveCorrelations: { hr_temp: liveHrTemp, hr_aq: liveHrAq, temp_aq: liveTempAq },
      anomalyCountLast30Min: 0,
      lastUpdated: new Date(),
    });
  }, [history, models]);

  return { snapshot };
}

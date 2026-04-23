import { useQuery } from "@tanstack/react-query";
import { loadIsolationForest, type IsolationForestWeights } from "@/lib/ml";

// ─── Types matching train.cjs output ─────────────────────────────────────────

export interface RegressionParams {
  slope: number;
  intercept: number;
  trainR2: number;
  trainRmse: number;
  testRmse: number;
  testR2: number;
  trainSamples: number;
  testSamples: number;
  trainedAt: string;
}

export interface ThresholdParams {
  min: number; max: number; mean: number; std: number;
  q1: number; q3: number; iqr: number;
  lowerBound: number; upperBound: number;
  anomalyRate: number;
  p95: number; p5: number;
  trainSamples: number;
}

export interface KMeansParams {
  centroids: number[][];
  clusterLabels: string[];
  clusterSizes: number[];
  silhouette: number;
  trainSamples: number;
  trainedAt: string;
  featureNames: string[];
}

export interface CorrelationParams {
  hr_temp: number;
  hr_aq: number;
  temp_aq: number;
  matrix: Record<string, Record<string, number>>;
}

export interface TrainedModels {
  trainedAt: string;
  datasetInfo: { totalRows: number; dateRange: { start: string; end: string }; sensor: string };
  regression: { heart_rate: RegressionParams; temperature: RegressionParams; air_quality: RegressionParams };
  thresholds: { heart_rate: ThresholdParams; temperature: ThresholdParams; air_quality: ThresholdParams };
  correlations: CorrelationParams;
  isolationForest: IsolationForestWeights & { fullNTrees?: number; anomalyRate?: number; scoreStats?: { mean: number; p50: number; p95: number } };
  kmeans: KMeansParams;
}

async function fetchTrainedModels(): Promise<TrainedModels> {
  const res = await fetch("/trained_models.json");
  if (!res.ok) throw new Error("Could not load trained_models.json");
  return res.json();
}

export function usePretrainedModels() {
  return useQuery<TrainedModels>({
    queryKey: ["pretrained-models"],
    queryFn: fetchTrainedModels,
    staleTime: Infinity,   // never re-fetch — file is static
    gcTime: Infinity,
  });
}

// Reconstruct the predict function from stored IF weights
export function useIsolationForestModel(models: TrainedModels | undefined) {
  if (!models) return null;
  return loadIsolationForest(models.isolationForest);
}

// Apply pre-trained K-Means centroids to classify a point [hr, temp, aq]
export function classifyWithKMeans(
  point: number[],
  kmeans: KMeansParams,
  data: number[][]
): number {
  if (!data.length) return 0;
  const cols = point.length;
  const normPoint = point.map((v, d) => {
    const col = data.map(r => r[d]);
    const lo = Math.min(...col), hi = Math.max(...col), r = hi - lo || 1;
    return (v - lo) / r;
  });
  const normCentroids = kmeans.centroids.map(c => c.map((v, d) => {
    const col = data.map(r => r[d]);
    const lo = Math.min(...col), hi = Math.max(...col), r = hi - lo || 1;
    return (v - lo) / r;
  }));
  let best = 0;
  let bestDist = Infinity;
  normCentroids.forEach((c, i) => {
    const dist = Math.sqrt(normPoint.reduce((s, v, j) => s + (v - c[j]) ** 2, 0));
    if (dist < bestDist) { bestDist = dist; best = i; }
  });
  return best;
}

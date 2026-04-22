// ─── Linear Regression ────────────────────────────────────────────────────────

export interface RegressionModel {
  slope: number;
  intercept: number;
  r2: number;
  rmse: number;
  predict: (x: number) => number;
}

export function trainLinearRegression(y: number[]): RegressionModel {
  const n = y.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((s, xi, i) => s + xi * y[i], 0);
  const sumX2 = x.reduce((s, xi) => s + xi * xi, 0);
  const denom = n * sumX2 - sumX * sumX || 1;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const meanY = sumY / n;
  const ssTot = y.reduce((s, yi) => s + (yi - meanY) ** 2, 0) || 1;
  const ssRes = y.reduce((s, yi, i) => s + (yi - (slope * i + intercept)) ** 2, 0);
  const r2 = Math.max(0, 1 - ssRes / ssTot);
  const rmse = Math.sqrt(ssRes / n);
  return { slope, intercept, r2, rmse, predict: (xi: number) => slope * xi + intercept };
}

// ─── Z-score Anomaly Detector ─────────────────────────────────────────────────

export interface AnomalyModel {
  mean: number;
  std: number;
  zThreshold: number;
  dynamicHigh: number;
  dynamicLow: number;
  scores: number[];
  isAnomaly: boolean[];
  anomalyCount: number;
}

export function trainAnomalyDetector(values: number[], zThreshold = 2.0): AnomalyModel {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance) || 1;
  const scores = values.map(v => Math.abs(v - mean) / std);
  const isAnomaly = scores.map(s => s > zThreshold);
  return {
    mean,
    std,
    zThreshold,
    dynamicHigh: mean + zThreshold * std,
    dynamicLow: Math.max(0, mean - zThreshold * std),
    scores,
    isAnomaly,
    anomalyCount: isAnomaly.filter(Boolean).length,
  };
}

// ─── Pearson Correlation ───────────────────────────────────────────────────────

export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  const num = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0);
  const dx = Math.sqrt(x.reduce((s, xi) => s + (xi - mx) ** 2, 0));
  const dy = Math.sqrt(y.reduce((s, yi) => s + (yi - my) ** 2, 0));
  return num / (dx * dy || 1);
}

// ─── K-Means Clustering (k-means++ init) ──────────────────────────────────────

export interface KMeansModel {
  assignments: number[];
  centroids: number[][];
  clusterLabels: string[];
  clusterSizes: number[];
}

function euclidean(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((s, ai, i) => s + (ai - b[i]) ** 2, 0));
}

function minMaxNormalize(col: number[]): number[] {
  const min = Math.min(...col);
  const max = Math.max(...col);
  const r = max - min || 1;
  return col.map(v => (v - min) / r);
}

export function trainKMeans(
  data: number[][],
  k = 3,
  maxIter = 150,
): KMeansModel {
  if (data.length < k) {
    return {
      assignments: data.map((_, i) => i % k),
      centroids: data.slice(0, k).map(p => [...p]),
      clusterLabels: ["Low Activity", "Moderate Activity", "High Activity"].slice(0, k),
      clusterSizes: Array(k).fill(1),
    };
  }

  // Normalize columns for distance-based clustering
  const cols = data[0].length;
  const normData = Array.from({ length: data.length }, (_, i) =>
    Array.from({ length: cols }, (__, d) => minMaxNormalize(data.map(r => r[d]))[i])
  );

  // k-means++ initialization
  const centroids: number[][] = [normData[Math.floor(Math.random() * normData.length)]];
  while (centroids.length < k) {
    const dists = normData.map(p => Math.min(...centroids.map(c => euclidean(p, c))));
    const total = dists.reduce((a, b) => a + b, 0) || 1;
    let r = Math.random() * total;
    let chosen = normData[normData.length - 1];
    for (let i = 0; i < normData.length; i++) {
      r -= dists[i];
      if (r <= 0) { chosen = normData[i]; break; }
    }
    centroids.push([...chosen]);
  }

  let assignments = new Array(normData.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    const next = normData.map(p =>
      centroids.reduce((best, c, i) =>
        euclidean(p, c) < euclidean(p, centroids[best]) ? i : best, 0)
    );
    const converged = next.every((a, i) => a === assignments[i]);
    assignments = next;
    if (converged) break;
    for (let ki = 0; ki < k; ki++) {
      const pts = normData.filter((_, i) => assignments[i] === ki);
      if (pts.length) {
        centroids[ki] = Array.from({ length: cols }, (_, d) =>
          pts.reduce((s, p) => s + p[d], 0) / pts.length);
      }
    }
  }

  // Map cluster indices by ascending first feature (heart_rate)
  const origCentroids = Array.from({ length: k }, (_, ki) => {
    const pts = data.filter((_, i) => assignments[i] === ki);
    if (!pts.length) return data[0];
    return Array.from({ length: cols }, (_, d) => pts.reduce((s, p) => s + p[d], 0) / pts.length);
  });
  const order = origCentroids.map((c, i) => ({ i, val: c[0] })).sort((a, b) => a.val - b.val);
  const remap = new Map(order.map(({ i }, rank) => [i, rank]));
  const sortedAssignments = assignments.map(a => remap.get(a) ?? a);
  const sortedCentroids = order.map(({ i }) => origCentroids[i]);
  const labels = ["Low Activity", "Moderate Activity", "High Activity"];
  const sizes = labels.map((_, li) => sortedAssignments.filter(a => a === li).length);

  return {
    assignments: sortedAssignments,
    centroids: sortedCentroids,
    clusterLabels: labels,
    clusterSizes: sizes,
  };
}

// ─── Dynamic Threshold Learner (IQR method) ───────────────────────────────────

export interface DynamicThresholds {
  q1: number;
  q3: number;
  iqr: number;
  warningHigh: number;
  criticalHigh: number;
  warningLow: number;
}

export function learnDynamicThresholds(values: number[]): DynamicThresholds {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  return {
    q1,
    q3,
    iqr,
    warningHigh: q3 + 1.0 * iqr,
    criticalHigh: q3 + 1.5 * iqr,
    warningLow: q1 - 1.0 * iqr,
  };
}

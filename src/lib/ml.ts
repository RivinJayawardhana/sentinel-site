// ─── Utilities ────────────────────────────────────────────────────────────────

export function trainTestSplit<T>(data: T[], testRatio = 0.2): { train: T[]; test: T[] } {
  const cut = Math.floor(data.length * (1 - testRatio));
  return { train: data.slice(0, cut), test: data.slice(cut) };
}

function mean(a: number[]): number { return a.reduce((s, v) => s + v, 0) / a.length; }
function std(a: number[], m = mean(a)): number { return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) || 1; }
function rmse(actual: number[], predicted: number[]): number {
  return Math.sqrt(actual.reduce((s, v, i) => s + (v - predicted[i]) ** 2, 0) / actual.length);
}

// ─── Model Persistence ─────────────────────────────────────────────────────────

export function saveWeights(key: string, weights: unknown): void {
  try { localStorage.setItem(`sentinel_model_${key}`, JSON.stringify(weights)); } catch { /* quota */ }
}

export function loadWeights<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(`sentinel_model_${key}`);
    return v ? (JSON.parse(v) as T) : null;
  } catch { return null; }
}

export function clearWeights(key: string): void {
  localStorage.removeItem(`sentinel_model_${key}`);
}

// ─── Linear Regression (with train/test evaluation) ───────────────────────────

export interface RegressionWeights {
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

export interface RegressionModel extends RegressionWeights {
  predict: (x: number) => number;
}

export function trainLinearRegression(y: number[], testRatio = 0.2): RegressionModel {
  const { train, test } = trainTestSplit(y, testRatio);
  const n = train.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const sx = x.reduce((a, b) => a + b, 0);
  const sy = train.reduce((a, b) => a + b, 0);
  const sxy = x.reduce((s, xi, i) => s + xi * train[i], 0);
  const sx2 = x.reduce((s, xi) => s + xi * xi, 0);
  const d = n * sx2 - sx * sx || 1;
  const slope = (n * sxy - sx * sy) / d;
  const intercept = (sy - slope * sx) / n;

  const predicted = x.map(xi => slope * xi + intercept);
  const my = sy / n;
  const ssTot = train.reduce((s, yi) => s + (yi - my) ** 2, 0) || 1;
  const ssRes = train.reduce((s, yi, i) => s + (yi - predicted[i]) ** 2, 0);
  const trainR2 = Math.max(0, 1 - ssRes / ssTot);
  const trainRmse = rmse(train, predicted);

  const testPredicted = test.map((_, j) => slope * (n + j) + intercept);
  const testRmseVal = test.length > 0 ? rmse(test, testPredicted) : trainRmse;
  const testMy = test.length > 0 ? mean(test) : my;
  const testSsTot = test.reduce((s, yi) => s + (yi - testMy) ** 2, 0) || 1;
  const testSsRes = test.reduce((s, yi, i) => s + (yi - testPredicted[i]) ** 2, 0);
  const testR2 = test.length > 0 ? Math.max(0, 1 - testSsRes / testSsTot) : trainR2;

  const weights: RegressionWeights = {
    slope, intercept, trainR2, trainRmse,
    testRmse: testRmseVal, testR2,
    trainSamples: n, testSamples: test.length,
    trainedAt: new Date().toISOString(),
  };
  return { ...weights, predict: (xi: number) => slope * xi + intercept };
}

// ─── Isolation Forest (trained, fully serialisable) ───────────────────────────
//
// Each isolation tree recursively partitions the feature space with random
// splits. Anomalous points require fewer splits to isolate (shorter path),
// yielding a high anomaly score.  The forest is trained once and its node
// structure is saved to localStorage — no hardcoded thresholds.

type IsoNode =
  | { leaf: true; size: number }
  | { leaf: false; feature: number; split: number; left: IsoNode; right: IsoNode; size: number };

function buildIsoTree(data: number[][], depth: number, maxDepth: number): IsoNode {
  if (depth >= maxDepth || data.length <= 1) return { leaf: true, size: data.length };
  const features = data[0].length;
  const f = Math.floor(Math.random() * features);
  const col = data.map(d => d[f]);
  const lo = Math.min(...col);
  const hi = Math.max(...col);
  if (lo === hi) return { leaf: true, size: data.length };
  const split = lo + Math.random() * (hi - lo);
  const left = data.filter(d => d[f] < split);
  const right = data.filter(d => d[f] >= split);
  if (!left.length || !right.length) return { leaf: true, size: data.length };
  return {
    leaf: false, feature: f, split,
    left: buildIsoTree(left, depth + 1, maxDepth),
    right: buildIsoTree(right, depth + 1, maxDepth),
    size: data.length,
  };
}

function avgPathLength(n: number): number {
  if (n <= 1) return 0;
  return 2 * (Math.log(n - 1) + 0.5772156649) - 2 * (n - 1) / n;
}

function isoPathLength(node: IsoNode, point: number[], depth: number): number {
  if (node.leaf) return depth + avgPathLength(node.size);
  if (point[node.feature] < node.split) return isoPathLength(node.left, point, depth + 1);
  return isoPathLength(node.right, point, depth + 1);
}

function isoScore(trees: IsoNode[], point: number[], subsampleSize: number): number {
  const avgPath = trees.reduce((s, t) => s + isoPathLength(t, point, 0), 0) / trees.length;
  return 2 ** (-avgPath / (avgPathLength(subsampleSize) || 1));
}

export interface IsolationForestWeights {
  trees: IsoNode[];
  subsampleSize: number;
  threshold: number;   // learned from 95th percentile of training scores
  trainSamples: number;
  nTrees: number;
  trainedAt: string;
  trainScores: number[];
}

export interface IsolationForestModel extends IsolationForestWeights {
  predict: (points: number[][]) => { scores: number[]; isAnomaly: boolean[] };
}

export function trainIsolationForest(
  data: number[][],
  nTrees = 50,
  maxSamples = 128,
): IsolationForestModel {
  const subsampleSize = Math.min(data.length, maxSamples);
  const maxDepth = Math.ceil(Math.log2(subsampleSize));

  const trees: IsoNode[] = Array.from({ length: nTrees }, () => {
    const sample = [...data].sort(() => Math.random() - 0.5).slice(0, subsampleSize);
    return buildIsoTree(sample, 0, maxDepth);
  });

  const trainScores = data.map(p => isoScore(trees, p, subsampleSize));
  const sorted = [...trainScores].sort((a, b) => a - b);
  const threshold = sorted[Math.floor(data.length * 0.95)] ?? 0.6;

  const weights: IsolationForestWeights = {
    trees, subsampleSize, threshold, trainSamples: data.length,
    nTrees, trainedAt: new Date().toISOString(), trainScores,
  };

  const predict = (points: number[][]) => {
    const scores = points.map(p => isoScore(trees, p, subsampleSize));
    return { scores, isAnomaly: scores.map(s => s >= threshold) };
  };

  return { ...weights, predict };
}

// Reload a persisted forest (recreate predict from stored trees/threshold)
export function loadIsolationForest(w: IsolationForestWeights): IsolationForestModel {
  const predict = (points: number[][]) => {
    const scores = points.map(p => isoScore(w.trees, p, w.subsampleSize));
    return { scores, isAnomaly: scores.map(s => s >= w.threshold) };
  };
  return { ...w, predict };
}

// ─── Pearson Correlation ───────────────────────────────────────────────────────

export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;
  const mx = mean(x), my = mean(y);
  const num = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0);
  const dx = Math.sqrt(x.reduce((s, xi) => s + (xi - mx) ** 2, 0));
  const dy = Math.sqrt(y.reduce((s, yi) => s + (yi - my) ** 2, 0));
  return num / (dx * dy || 1);
}

// ─── K-Means Clustering (k-means++ init, with silhouette score) ───────────────

export interface KMeansWeights {
  centroids: number[][];
  clusterLabels: string[];
  trainSamples: number;
  silhouette: number;
  trainedAt: string;
}

export interface KMeansModel extends KMeansWeights {
  assignments: number[];
  clusterSizes: number[];
  predict: (points: number[][]) => number[];
}

function euclidean(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((s, ai, i) => s + (ai - b[i]) ** 2, 0));
}

function minMaxNormalize(col: number[]): number[] {
  const lo = Math.min(...col), hi = Math.max(...col), r = hi - lo || 1;
  return col.map(v => (v - lo) / r);
}

function silhouetteScore(data: number[][], assignments: number[], k: number): number {
  if (data.length < 3) return 0;
  const scores = data.map((p, i) => {
    const own = assignments[i];
    const clusterPts = data.filter((_, j) => assignments[j] === own && j !== i);
    if (!clusterPts.length) return 0;
    const a = clusterPts.reduce((s, q) => s + euclidean(p, q), 0) / clusterPts.length;
    let b = Infinity;
    for (let ki = 0; ki < k; ki++) {
      if (ki === own) continue;
      const otherPts = data.filter((_, j) => assignments[j] === ki);
      if (!otherPts.length) continue;
      const d = otherPts.reduce((s, q) => s + euclidean(p, q), 0) / otherPts.length;
      if (d < b) b = d;
    }
    if (b === Infinity) return 0;
    return (b - a) / Math.max(a, b);
  });
  return mean(scores);
}

export function trainKMeans(data: number[][], k = 3, maxIter = 150): KMeansModel {
  if (data.length < k) {
    const labels = ["Low Activity", "Moderate Activity", "High Activity"].slice(0, k);
    return {
      centroids: data.slice(0, k).map(p => [...p]),
      clusterLabels: labels, trainSamples: data.length,
      silhouette: 0, trainedAt: new Date().toISOString(),
      assignments: data.map((_, i) => i % k),
      clusterSizes: Array(k).fill(1),
      predict: (pts) => pts.map(() => 0),
    };
  }

  const cols = data[0].length;
  const normData = Array.from({ length: data.length }, (_, i) =>
    Array.from({ length: cols }, (__, d) => minMaxNormalize(data.map(r => r[d]))[i])
  );

  // k-means++ init
  const centroids: number[][] = [normData[Math.floor(Math.random() * normData.length)]];
  while (centroids.length < k) {
    const dists = normData.map(p => Math.min(...centroids.map(c => euclidean(p, c))));
    const total = dists.reduce((a, b) => a + b, 0) || 1;
    let r = Math.random() * total;
    let chosen = normData[normData.length - 1];
    for (let i = 0; i < normData.length; i++) { r -= dists[i]; if (r <= 0) { chosen = normData[i]; break; } }
    centroids.push([...chosen]);
  }

  let assignments = new Array(normData.length).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    const next = normData.map(p => centroids.reduce((best, c, i) =>
      euclidean(p, c) < euclidean(p, centroids[best]) ? i : best, 0));
    const converged = next.every((a, i) => a === assignments[i]);
    assignments = next;
    if (converged) break;
    for (let ki = 0; ki < k; ki++) {
      const pts = normData.filter((_, i) => assignments[i] === ki);
      if (pts.length) centroids[ki] = Array.from({ length: cols }, (_, d) =>
        pts.reduce((s, p) => s + p[d], 0) / pts.length);
    }
  }

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
  const sil = silhouetteScore(normData, sortedAssignments, k);

  const predict = (pts: number[][]) => {
    const normPts = pts.map(p => p.map((v, d) => {
      const col = data.map(r => r[d]);
      const lo = Math.min(...col), hi = Math.max(...col), r2 = hi - lo || 1;
      return (v - lo) / r2;
    }));
    const rawAssign = normPts.map(p => {
      const rawKi = centroids.reduce((best, c, i) =>
        euclidean(p, c) < euclidean(p, centroids[best]) ? i : best, 0);
      return remap.get(rawKi) ?? rawKi;
    });
    return rawAssign;
  };

  const weights: KMeansWeights = {
    centroids: sortedCentroids, clusterLabels: labels,
    trainSamples: data.length, silhouette: sil,
    trainedAt: new Date().toISOString(),
  };
  return { ...weights, assignments: sortedAssignments, clusterSizes: sizes, predict };
}

export function loadKMeans(w: KMeansWeights, assignments: number[], clusterSizes: number[], data: number[][]): KMeansModel {
  const cols = data[0]?.length ?? 2;
  const predict = (pts: number[][]) => {
    return pts.map(p => {
      const normP = p.map((v, d) => {
        const col = data.map(r => r[d]);
        const lo = Math.min(...col), hi = Math.max(...col), r = hi - lo || 1;
        return (v - lo) / r;
      });
      const normCentroids = w.centroids.map(c => c.map((v, d) => {
        const col = data.map(r => r[d]);
        const lo = Math.min(...col), hi = Math.max(...col), r = hi - lo || 1;
        return (v - lo) / r;
      }));
      return normCentroids.reduce((best, c, i) =>
        euclidean(normP, c) < euclidean(normP, normCentroids[best]) ? i : best, 0);
    });
  };
  return { ...w, assignments, clusterSizes, predict };
}

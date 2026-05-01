// Node.js ML training script — no external dependencies
// Usage: node ml-models/train.js
// Output: public/trained_models.json

const fs = require("fs");
const path = require("path");

// ─── Parse CSV ────────────────────────────────────────────────────────────────
const csvPath = path.join(__dirname, "iot_dataset.csv");
const lines = fs.readFileSync(csvPath, "utf8").trim().split("\n");
const headers = lines[0].split(",");

const rows = lines.slice(1).map((line) => {
  const vals = line.split(",");
  return {
    timestamp: vals[0],
    sensor_id: vals[1],
    temperature: parseFloat(vals[2]),
    air_quality: parseFloat(vals[3]),
    heart_rate: parseFloat(vals[4]),
    latitude: parseFloat(vals[5]),
    longitude: parseFloat(vals[6]),
  };
});

console.log(`Loaded ${rows.length} rows`);

// ─── Utilities ────────────────────────────────────────────────────────────────
function mean(a) { return a.reduce((s, v) => s + v, 0) / a.length; }
function std(a, m = mean(a)) {
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) || 1;
}
function rmse(actual, predicted) {
  return Math.sqrt(actual.reduce((s, v, i) => s + (v - predicted[i]) ** 2, 0) / actual.length);
}
function mae(actual, predicted) {
  return actual.reduce((s, v, i) => s + Math.abs(v - predicted[i]), 0) / actual.length;
}
function confusionMetrics(tp, tn, fp, fn) {
  const total = tp + tn + fp + fn || 1;
  const accuracy = (tp + tn) / total;
  const precision = tp / (tp + fp || 1);
  const recall = tp / (tp + fn || 1);
  const f1 = (2 * precision * recall) / (precision + recall || 1);
  return {
    accuracy: parseFloat(accuracy.toFixed(4)),
    precision: parseFloat(precision.toFixed(4)),
    recall: parseFloat(recall.toFixed(4)),
    f1: parseFloat(f1.toFixed(4)),
  };
}
function percentile(sorted, p) {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
function euclidean(a, b) {
  return Math.sqrt(a.reduce((s, ai, i) => s + (ai - b[i]) ** 2, 0));
}

// ─── Train/Test Split (chronological 80/20) ───────────────────────────────────
function trainTestSplit(data, testRatio = 0.2) {
  const cut = Math.floor(data.length * (1 - testRatio));
  return { train: data.slice(0, cut), test: data.slice(cut) };
}

// ─── Linear Regression ────────────────────────────────────────────────────────
function trainLinearRegression(y) {
  const { train, test } = trainTestSplit(y);
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
  const trainMae = mae(train, predicted);

  const testPredicted = test.map((_, j) => slope * (n + j) + intercept);
  const testRmseVal = test.length > 0 ? rmse(test, testPredicted) : trainRmse;
  const testMaeVal = test.length > 0 ? mae(test, testPredicted) : trainMae;
  const testMy = test.length > 0 ? mean(test) : my;
  const testSsTot = test.reduce((s, yi) => s + (yi - testMy) ** 2, 0) || 1;
  const testSsRes = test.reduce((s, yi, i) => s + (yi - testPredicted[i]) ** 2, 0);
  const testR2 = test.length > 0 ? Math.max(0, 1 - testSsRes / testSsTot) : trainR2;

  return {
    slope, intercept, trainR2, trainRmse, trainMae,
    testRmse: testRmseVal, testR2, testMae: testMaeVal,
    trainSamples: n, testSamples: test.length,
    trainedAt: new Date().toISOString(),
  };
}

// ─── IQR Threshold Learning ────────────────────────────────────────────────────
function learnThresholds(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const anomalyRate = values.filter(v => v < lo || v > hi).length / values.length;
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: mean(values),
    std: std(values),
    q1, q3, iqr,
    lowerBound: lo,
    upperBound: hi,
    anomalyRate: parseFloat(anomalyRate.toFixed(4)),
    p95: percentile(sorted, 95),
    p5: percentile(sorted, 5),
    trainSamples: values.length,
  };
}

// ─── Pearson Correlation ───────────────────────────────────────────────────────
function pearsonCorrelation(x, y) {
  const n = x.length;
  if (n < 2) return 0;
  const mx = mean(x), my = mean(y);
  const num = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0);
  const dx = Math.sqrt(x.reduce((s, xi) => s + (xi - mx) ** 2, 0));
  const dy = Math.sqrt(y.reduce((s, yi) => s + (yi - my) ** 2, 0));
  return num / (dx * dy || 1);
}

// ─── Isolation Forest ─────────────────────────────────────────────────────────
function buildIsoTree(data, depth, maxDepth) {
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

function avgPathLength(n) {
  if (n <= 1) return 0;
  return 2 * (Math.log(n - 1) + 0.5772156649) - 2 * (n - 1) / n;
}

function isoPathLength(node, point, depth) {
  if (node.leaf) return depth + avgPathLength(node.size);
  if (point[node.feature] < node.split) return isoPathLength(node.left, point, depth + 1);
  return isoPathLength(node.right, point, depth + 1);
}

function isoScore(trees, point, subsampleSize) {
  const avgPath = trees.reduce((s, t) => s + isoPathLength(t, point, 0), 0) / trees.length;
  return 2 ** (-avgPath / (avgPathLength(subsampleSize) || 1));
}

function trainIsolationForest(data, nTrees = 100, maxSamples = 256, exportTrees = 20, exportSamples = 64) {
  const subsampleSize = Math.min(data.length, maxSamples);
  const maxDepth = Math.ceil(Math.log2(subsampleSize));

  // Train full forest for accurate threshold learning
  const allTrees = Array.from({ length: nTrees }, () => {
    const sample = [...data].sort(() => Math.random() - 0.5).slice(0, subsampleSize);
    return buildIsoTree(sample, 0, maxDepth);
  });

  const trainScores = data.map(p => isoScore(allTrees, p, subsampleSize));
  const sortedScores = [...trainScores].sort((a, b) => a - b);
  const threshold = sortedScores[Math.floor(data.length * 0.95)] ?? 0.6;
  const anomalyCount = trainScores.filter(s => s >= threshold).length;

  // Build a compact export forest (fewer trees, smaller subsample) for React use
  const expSubsample = Math.min(data.length, exportSamples);
  const expDepth = Math.ceil(Math.log2(expSubsample));
  const exportForest = Array.from({ length: exportTrees }, () => {
    const sample = [...data].sort(() => Math.random() - 0.5).slice(0, expSubsample);
    return buildIsoTree(sample, 0, expDepth);
  });

  return {
    trees: exportForest,         // compact for React consumption
    subsampleSize: expSubsample,
    threshold,                   // learned from full 100-tree forest
    trainSamples: data.length,
    nTrees: exportTrees,
    fullNTrees: nTrees,
    trainedAt: new Date().toISOString(),
    anomalyRate: parseFloat((anomalyCount / data.length).toFixed(4)),
    scoreStats: {
      mean: parseFloat(mean(trainScores).toFixed(4)),
      p50: parseFloat(percentile(sortedScores, 50).toFixed(4)),
      p95: parseFloat(percentile(sortedScores, 95).toFixed(4)),
    },
  };
}

// ─── K-Means++ ────────────────────────────────────────────────────────────────
function minMaxNormalize(col) {
  const lo = Math.min(...col), hi = Math.max(...col), r = hi - lo || 1;
  return col.map(v => (v - lo) / r);
}

function silhouetteScore(data, assignments, k) {
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

function trainKMeans(data, k = 3, maxIter = 150) {
  const cols = data[0].length;
  const normData = Array.from({ length: data.length }, (_, i) =>
    Array.from({ length: cols }, (__, d) => minMaxNormalize(data.map(r => r[d]))[i])
  );

  // k-means++ init
  const centroids = [normData[Math.floor(Math.random() * normData.length)]];
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

  // Original-space centroids
  const origCentroids = Array.from({ length: k }, (_, ki) => {
    const pts = data.filter((_, i) => assignments[i] === ki);
    if (!pts.length) return data[0];
    return Array.from({ length: cols }, (_, d) => pts.reduce((s, p) => s + p[d], 0) / pts.length);
  });

  // Sort clusters by heart_rate (first col = HR in our feature vector [hr, temp, aq])
  const order = origCentroids.map((c, i) => ({ i, val: c[0] })).sort((a, b) => a.val - b.val);
  const remap = new Map(order.map(({ i }, rank) => [i, rank]));
  const sortedAssignments = assignments.map(a => remap.get(a) ?? a);
  const sortedCentroids = order.map(({ i }) => origCentroids[i]);

  const labels = ["Low Activity", "Moderate Activity", "High Activity"];
  const sizes = labels.map((_, li) => sortedAssignments.filter(a => a === li).length);
  const sil = silhouetteScore(normData.slice(0, Math.min(500, normData.length)), sortedAssignments.slice(0, Math.min(500, normData.length)), k);

  return {
    centroids: sortedCentroids.map(c => c.map(v => parseFloat(v.toFixed(4)))),
    clusterLabels: labels,
    clusterSizes: sizes,
    silhouette: parseFloat(sil.toFixed(4)),
    trainSamples: data.length,
    trainedAt: new Date().toISOString(),
    featureNames: ["heart_rate", "temperature", "air_quality"],
  };
}

// ─── Main Training ─────────────────────────────────────────────────────────────
console.log("Training models...");

const temps = rows.map(r => r.temperature);
const aqs   = rows.map(r => r.air_quality);
const hrs   = rows.map(r => r.heart_rate);

// 1. Linear Regression (temporal trend per sensor)
console.log("  [1/4] Training Linear Regression...");
const regHR   = trainLinearRegression(hrs);
const regTemp = trainLinearRegression(temps);
const regAQ   = trainLinearRegression(aqs);
console.log(`    HR  → slope=${regHR.slope.toFixed(6)}, trainR²=${regHR.trainR2.toFixed(3)}, testR²=${regHR.testR2.toFixed(3)}`);
console.log(`    Temp→ slope=${regTemp.slope.toFixed(6)}, trainR²=${regTemp.trainR2.toFixed(3)}, testR²=${regTemp.testR2.toFixed(3)}`);
console.log(`    AQ  → slope=${regAQ.slope.toFixed(6)}, trainR²=${regAQ.trainR2.toFixed(3)}, testR²=${regAQ.testR2.toFixed(3)}`);

// 2. IQR Threshold Learning
console.log("  [2/4] Learning IQR thresholds...");
const threshHR   = learnThresholds(hrs);
const threshTemp = learnThresholds(temps);
const threshAQ   = learnThresholds(aqs);
console.log(`    HR   → [${threshHR.lowerBound.toFixed(1)}, ${threshHR.upperBound.toFixed(1)}] BPM`);
console.log(`    Temp → [${threshTemp.lowerBound.toFixed(1)}, ${threshTemp.upperBound.toFixed(1)}] °C`);
console.log(`    AQ   → [${threshAQ.lowerBound.toFixed(1)}, ${threshAQ.upperBound.toFixed(1)}] AQI`);

// 3. Pearson Correlation
console.log("  [3/4] Computing correlations...");
const corrHrTemp = pearsonCorrelation(hrs, temps);
const corrHrAQ   = pearsonCorrelation(hrs, aqs);
const corrTempAQ = pearsonCorrelation(temps, aqs);
console.log(`    HR↔Temp=${corrHrTemp.toFixed(4)}, HR↔AQ=${corrHrAQ.toFixed(4)}, Temp↔AQ=${corrTempAQ.toFixed(4)}`);

// 4. Isolation Forest (subsample 2000 for speed)
console.log("  [4a/4] Training Isolation Forest (this may take ~30s)...");
const isoSubsample = rows.slice(0, 2000).map(r => [r.heart_rate, r.temperature, r.air_quality]);
const isoForest = trainIsolationForest(isoSubsample, 100, 256);
console.log(`    Threshold=${isoForest.threshold.toFixed(4)}, anomalyRate=${isoForest.anomalyRate}`);

// 4b. K-Means Clustering
console.log("  [4b/4] Training K-Means (k=3)...");
// Use a representative sample for speed
const kSample = rows.filter((_, i) => i % 5 === 0).map(r => [r.heart_rate, r.temperature, r.air_quality]);
const kmeans = trainKMeans(kSample, 3);
console.log(`    Silhouette=${kmeans.silhouette}, sizes=${kmeans.clusterSizes}`);
console.log(`    Centroids:`, kmeans.centroids.map((c, i) => `${kmeans.clusterLabels[i]}: HR=${c[0].toFixed(1)}, T=${c[1].toFixed(1)}, AQ=${c[2].toFixed(0)}`).join(" | "));

// Threshold alert metrics: learned IQR bounds vs baseline mean +/- 2*std
const baselineBounds = (stats) => ({
  lower: stats.mean - 2 * stats.std,
  upper: stats.mean + 2 * stats.std,
});

const learnedBounds = {
  heart_rate: { lower: threshHR.lowerBound, upper: threshHR.upperBound },
  temperature: { lower: threshTemp.lowerBound, upper: threshTemp.upperBound },
  air_quality: { lower: threshAQ.lowerBound, upper: threshAQ.upperBound },
};

const baseline = {
  heart_rate: baselineBounds(threshHR),
  temperature: baselineBounds(threshTemp),
  air_quality: baselineBounds(threshAQ),
};

const isOutOfRange = (row, bounds) => (
  row.heart_rate < bounds.heart_rate.lower || row.heart_rate > bounds.heart_rate.upper ||
  row.temperature < bounds.temperature.lower || row.temperature > bounds.temperature.upper ||
  row.air_quality < bounds.air_quality.lower || row.air_quality > bounds.air_quality.upper
);

let tTp = 0, tTn = 0, tFp = 0, tFn = 0;
rows.forEach((row) => {
  const truth = isOutOfRange(row, baseline);
  const pred = isOutOfRange(row, learnedBounds);
  if (truth && pred) tTp += 1;
  if (!truth && !pred) tTn += 1;
  if (!truth && pred) tFp += 1;
  if (truth && !pred) tFn += 1;
});
const thresholdMetrics = confusionMetrics(tTp, tTn, tFp, tFn);

// Isolation Forest metrics: thresholded scores vs baseline bounds (same truth as above)
const isoFeatures = rows.map(r => [r.heart_rate, r.temperature, r.air_quality]);
const isoScores = isoFeatures.map(p => isoScore(isoForest.trees, p, isoForest.subsampleSize));
let iTp = 0, iTn = 0, iFp = 0, iFn = 0;
rows.forEach((row, i) => {
  const truth = isOutOfRange(row, baseline);
  const pred = isoScores[i] >= isoForest.threshold;
  if (truth && pred) iTp += 1;
  if (!truth && !pred) iTn += 1;
  if (!truth && pred) iFp += 1;
  if (truth && !pred) iFn += 1;
});
const isolationMetrics = confusionMetrics(iTp, iTn, iFp, iFn);

// ─── Assemble Output ──────────────────────────────────────────────────────────
const output = {
  trainedAt: new Date().toISOString(),
  datasetInfo: {
    totalRows: rows.length,
    dateRange: { start: rows[0].timestamp, end: rows[rows.length - 1].timestamp },
    sensor: rows[0].sensor_id,
  },
  regression: {
    heart_rate: regHR,
    temperature: regTemp,
    air_quality: regAQ,
  },
  regressionMetrics: {
    heart_rate: { rmse: regHR.testRmse, mae: regHR.testMae, r2: regHR.testR2 },
    temperature: { rmse: regTemp.testRmse, mae: regTemp.testMae, r2: regTemp.testR2 },
    air_quality: { rmse: regAQ.testRmse, mae: regAQ.testMae, r2: regAQ.testR2 },
  },
  thresholds: {
    heart_rate: threshHR,
    temperature: threshTemp,
    air_quality: threshAQ,
  },
  thresholdMetrics,
  correlations: {
    hr_temp: parseFloat(corrHrTemp.toFixed(4)),
    hr_aq: parseFloat(corrHrAQ.toFixed(4)),
    temp_aq: parseFloat(corrTempAQ.toFixed(4)),
    matrix: {
      heart_rate:   { heart_rate: 1, temperature: parseFloat(corrHrTemp.toFixed(4)),  air_quality: parseFloat(corrHrAQ.toFixed(4)) },
      temperature:  { heart_rate: parseFloat(corrHrTemp.toFixed(4)),  temperature: 1, air_quality: parseFloat(corrTempAQ.toFixed(4)) },
      air_quality:  { heart_rate: parseFloat(corrHrAQ.toFixed(4)),  temperature: parseFloat(corrTempAQ.toFixed(4)),  air_quality: 1 },
    },
  },
  isolationForest: isoForest,
  isolationMetrics,
  kmeans,
};

// Save to public/
const outPath = path.join(__dirname, "..", "public", "trained_models.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nSaved → ${outPath}`);
console.log("Done.");

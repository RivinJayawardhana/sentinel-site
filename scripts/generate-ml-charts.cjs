const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'ml-models', 'iot_dataset.csv');
const modelsPath = path.join(__dirname, '..', 'public', 'trained_models.json');
const outDir = path.join(__dirname, '..', 'images');

if (!fs.existsSync(dataPath)) {
  throw new Error(`Dataset not found at ${dataPath}`);
}
if (!fs.existsSync(modelsPath)) {
  throw new Error(`trained_models.json not found at ${modelsPath}. Run node ml-models\\train.cjs first.`);
}

const raw = fs.readFileSync(dataPath, 'utf8').trim();
const lines = raw.split(/\r?\n/);
const headers = lines[0].split(',');
const rows = lines.slice(1).map((line) => {
  const parts = line.split(',');
  const record = {};
  headers.forEach((h, i) => {
    record[h] = parts[i];
  });
  return {
    timestamp: record.timestamp,
    sensor_id: record.sensor_id,
    temperature: parseFloat(record.temperature),
    air_quality: parseFloat(record.air_quality),
    heart_rate: parseFloat(record.heart_rate),
    latitude: parseFloat(record.latitude),
    longitude: parseFloat(record.longitude),
  };
});

const trained = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));

const sampleEvery = Math.max(1, Math.floor(rows.length / 500));
const sample = rows.filter((_, i) => i % sampleEvery === 0);

const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;

const trainTestSplit = (data, testRatio = 0.2) => {
  const cut = Math.floor(data.length * (1 - testRatio));
  return { train: data.slice(0, cut), test: data.slice(cut) };
};

const baselineBounds = (stats) => ({
  lower: stats.mean - 2 * stats.std,
  upper: stats.mean + 2 * stats.std,
});

const classifyOutOfRange = (record, bounds) => {
  return (
    record.heart_rate < bounds.heart_rate.lower ||
    record.heart_rate > bounds.heart_rate.upper ||
    record.temperature < bounds.temperature.lower ||
    record.temperature > bounds.temperature.upper ||
    record.air_quality < bounds.air_quality.lower ||
    record.air_quality > bounds.air_quality.upper
  );
};

let tp = 0;
let tn = 0;
let fp = 0;
let fn = 0;

const learnedBounds = {
  heart_rate: { lower: trained.thresholds.heart_rate.lowerBound, upper: trained.thresholds.heart_rate.upperBound },
  temperature: { lower: trained.thresholds.temperature.lowerBound, upper: trained.thresholds.temperature.upperBound },
  air_quality: { lower: trained.thresholds.air_quality.lowerBound, upper: trained.thresholds.air_quality.upperBound },
};

const baseline = {
  heart_rate: baselineBounds(trained.thresholds.heart_rate),
  temperature: baselineBounds(trained.thresholds.temperature),
  air_quality: baselineBounds(trained.thresholds.air_quality),
};

rows.forEach((record) => {
  const truth = classifyOutOfRange(record, baseline);
  const predicted = classifyOutOfRange(record, learnedBounds);
  if (truth && predicted) tp += 1;
  if (!truth && !predicted) tn += 1;
  if (!truth && predicted) fp += 1;
  if (truth && !predicted) fn += 1;
});

const isoAvgPathLength = (n) => {
  if (n <= 1) return 0;
  return 2 * (Math.log(n - 1) + 0.5772156649) - 2 * (n - 1) / n;
};

const isoPathLength = (node, point, depth) => {
  if (node.leaf) return depth + isoAvgPathLength(node.size);
  if (point[node.feature] < node.split) return isoPathLength(node.left, point, depth + 1);
  return isoPathLength(node.right, point, depth + 1);
};

const isoScore = (trees, point, subsampleSize) => {
  const avgPath = trees.reduce((s, t) => s + isoPathLength(t, point, 0), 0) / trees.length;
  return 2 ** (-avgPath / (isoAvgPathLength(subsampleSize) || 1));
};

const isoTrees = trained.isolationForest.trees;
const isoSubsample = trained.isolationForest.subsampleSize;
const isoThreshold = trained.isolationForest.threshold;

const isoSample = sample.map((r) => [r.heart_rate, r.temperature, r.air_quality]);
const isoScores = isoSample.map((p) => isoScore(isoTrees, p, isoSubsample));
const anomalies = isoScores
  .map((score, idx) => ({ idx, score }))
  .filter((entry) => entry.score >= isoThreshold);

const centroids = trained.kmeans.centroids;
const assignCluster = (point) => {
  let best = 0;
  let bestDist = Infinity;
  centroids.forEach((c, i) => {
    const d0 = point[0] - c[0];
    const d1 = point[1] - c[1];
    const d2 = point[2] - c[2];
    const dist = d0 * d0 + d1 * d1 + d2 * d2;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best;
};

const clusterAssignments = sample.map((r) => assignCluster([r.heart_rate, r.temperature, r.air_quality]));

const svgHeader = (width, height) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

const svgFooter = '</svg>\n';

const ensureOutDir = () => {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
};

const saveSvg = (filename, content) => {
  ensureOutDir();
  fs.writeFileSync(path.join(outDir, filename), content, 'utf8');
};

const createLinePanel = (series, labels, options) => {
  const {
    x,
    y,
    width,
    height,
    title,
    color,
    minValue,
    maxValue,
  } = options;

  const padding = 40;
  const plotX = x + padding;
  const plotY = y + padding;
  const plotW = width - padding * 2;
  const plotH = height - padding * 2;

  const minVal = minValue ?? Math.min(...series);
  const maxVal = maxValue ?? Math.max(...series);
  const scaleX = (i) => plotX + (i / (series.length - 1)) * plotW;
  const scaleY = (v) => plotY + plotH - ((v - minVal) / (maxVal - minVal || 1)) * plotH;

  const path = series
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(2)} ${scaleY(v).toFixed(2)}`)
    .join(' ');

  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#0f172a" rx="16" />
    <text x="${x + 24}" y="${y + 32}" fill="#e2e8f0" font-size="16" font-family="Arial">${title}</text>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2" />
    <text x="${plotX}" y="${y + height - 10}" fill="#94a3b8" font-size="12" font-family="Arial">${labels[0]}</text>
    <text x="${plotX + plotW - 40}" y="${y + height - 10}" fill="#94a3b8" font-size="12" font-family="Arial">${labels[labels.length - 1]}</text>
  `;
};

const createTemporalTrendSvg = () => {
  const width = 1200;
  const height = 900;
  const panelHeight = 250;

  const hrSeries = rows.map((r) => r.heart_rate);
  const tempSeries = rows.map((r) => r.temperature);
  const airSeries = rows.map((r) => r.air_quality);

  const hrSplit = trainTestSplit(hrSeries);
  const tempSplit = trainTestSplit(tempSeries);
  const airSplit = trainTestSplit(airSeries);

  const testLen = Math.min(hrSplit.test.length, 320);
  const startIndex = hrSplit.train.length;
  const indices = Array.from({ length: testLen }, (_, i) => (startIndex + i).toString());

  const predict = (reg, offset, len) =>
    Array.from({ length: len }, (_, j) => reg.slope * (offset + j) + reg.intercept);

  const hrActual = hrSplit.test.slice(0, testLen);
  const hrPred = predict(trained.regression.heart_rate, hrSplit.train.length, testLen);
  const tempActual = tempSplit.test.slice(0, testLen);
  const tempPred = predict(trained.regression.temperature, tempSplit.train.length, testLen);
  const airActual = airSplit.test.slice(0, testLen);
  const airPred = predict(trained.regression.air_quality, airSplit.train.length, testLen);

  const panel = (actual, predicted, title, color, y) => {
    const combined = actual.concat(predicted);
    const minValue = Math.min(...combined);
    const maxValue = Math.max(...combined);
    const actualPanel = createLinePanel(actual, indices, {
      x: 40,
      y,
      width: width - 80,
      height: panelHeight,
      title: `${title} (Actual)`,
      color,
      minValue,
      maxValue,
    });
    const predictedPanel = createLinePanel(predicted, indices, {
      x: 40,
      y,
      width: width - 80,
      height: panelHeight,
      title: `${title} (Predicted)`,
      color: '#facc15',
      minValue,
      maxValue,
    });
    return actualPanel + predictedPanel;
  };

  const content = `
${svgHeader(width, height)}
<rect width="${width}" height="${height}" fill="#0b1120" />
<text x="40" y="50" fill="#f8fafc" font-size="22" font-family="Arial">Temporal Trend Analysis (Linear Regression)</text>
${panel(tempActual, tempPred, 'Temperature (C)', '#38bdf8', 80)}
${panel(hrActual, hrPred, 'Heart Rate (BPM)', '#f97316', 80 + panelHeight + 20)}
${panel(airActual, airPred, 'Air Quality', '#34d399', 80 + (panelHeight + 20) * 2)}
${svgFooter}`;

  saveSvg('temporal_trend.svg', content.trim());
};

const createConfusionMatrixSvg = () => {
  const width = 700;
  const height = 520;
  const cellSize = 180;
  const startX = 160;
  const startY = 140;
  const maxVal = Math.max(tp, tn, fp, fn) || 1;

  const cell = (x, y, value, label) => {
    const intensity = Math.floor((value / maxVal) * 180) + 50;
    const fill = `rgb(${intensity}, ${60}, ${60})`;
    return `
      <rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${fill}" rx="12" />
      <text x="${x + cellSize / 2}" y="${y + cellSize / 2}" fill="#f8fafc" font-size="26" font-family="Arial" text-anchor="middle" dominant-baseline="middle">${value}</text>
      <text x="${x + cellSize / 2}" y="${y + cellSize - 16}" fill="#e2e8f0" font-size="12" font-family="Arial" text-anchor="middle">${label}</text>
    `;
  };

  const content = `
${svgHeader(width, height)}
<rect width="${width}" height="${height}" fill="#0b1120" />
<text x="40" y="50" fill="#f8fafc" font-size="22" font-family="Arial">Threshold Alerts (IQR vs Baseline)</text>
<text x="${startX}" y="${startY - 20}" fill="#94a3b8" font-size="14" font-family="Arial">Predicted</text>
<text x="${startX - 100}" y="${startY + 20}" fill="#94a3b8" font-size="14" font-family="Arial" transform="rotate(-90 ${startX - 100},${startY + 20})">Actual</text>
<text x="${startX + 40}" y="${startY - 20}" fill="#94a3b8" font-size="12" font-family="Arial">Alert</text>
<text x="${startX + 220}" y="${startY - 20}" fill="#94a3b8" font-size="12" font-family="Arial">Normal</text>
<text x="${startX - 40}" y="${startY + 80}" fill="#94a3b8" font-size="12" font-family="Arial">Alert</text>
<text x="${startX - 40}" y="${startY + 260}" fill="#94a3b8" font-size="12" font-family="Arial">Normal</text>
${cell(startX, startY, tp, 'TP')}
${cell(startX + cellSize + 20, startY, fn, 'FN')}
${cell(startX, startY + cellSize + 20, fp, 'FP')}
${cell(startX + cellSize + 20, startY + cellSize + 20, tn, 'TN')}
${svgFooter}`;

  saveSvg('threshold_confusion.svg', content.trim());
};

const createCorrelationHeatmapSvg = () => {
  const width = 700;
  const height = 520;
  const cellSize = 120;
  const startX = 170;
  const startY = 160;
  const labels = ['Temp', 'HR', 'Air'];

  const cell = (x, y, value) => {
    const intensity = Math.floor(((value + 1) / 2) * 200) + 30;
    const fill = `rgb(${40}, ${intensity}, ${120})`;
    return `
      <rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${fill}" rx="12" />
      <text x="${x + cellSize / 2}" y="${y + cellSize / 2}" fill="#f8fafc" font-size="20" font-family="Arial" text-anchor="middle" dominant-baseline="middle">${value.toFixed(2)}</text>
    `;
  };

  const content = `
${svgHeader(width, height)}
<rect width="${width}" height="${height}" fill="#0b1120" />
<text x="40" y="50" fill="#f8fafc" font-size="22" font-family="Arial">Sensor Correlation Heatmap (Pearson)</text>
${labels
  .map((label, i) =>
    `<text x="${startX + i * (cellSize + 12) + cellSize / 2}" y="${startY - 14}" fill="#94a3b8" font-size="12" font-family="Arial" text-anchor="middle">${label}</text>`
  )
  .join('')}
${labels
  .map((label, i) =>
    `<text x="${startX - 12}" y="${startY + i * (cellSize + 12) + cellSize / 2}" fill="#94a3b8" font-size="12" font-family="Arial" text-anchor="end" dominant-baseline="middle">${label}</text>`
  )
  .join('')}
${[
  [1, trained.correlations.hr_temp, trained.correlations.hr_aq],
  [trained.correlations.hr_temp, 1, trained.correlations.temp_aq],
  [trained.correlations.hr_aq, trained.correlations.temp_aq, 1],
]
  .map((row, i) =>
    row
      .map((value, j) =>
        cell(startX + j * (cellSize + 12), startY + i * (cellSize + 12), value)
      )
      .join('')
  )
  .join('')}
${svgFooter}`;

  saveSvg('correlation_heatmap.svg', content.trim());
};

const createAnomalySvg = () => {
  const width = 1000;
  const height = 520;
  const padding = 60;
  const plotW = width - padding * 2;
  const plotH = height - padding * 2;
  const tempSeries = sample.map((r) => r.temperature);
  const minVal = Math.min(...tempSeries);
  const maxVal = Math.max(...tempSeries);

  const scaleX = (i) => padding + (i / (tempSeries.length - 1)) * plotW;
  const scaleY = (v) => padding + plotH - ((v - minVal) / (maxVal - minVal || 1)) * plotH;

  const path = tempSeries
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(2)} ${scaleY(v).toFixed(2)}`)
    .join(' ');

  const anomalyDots = anomalies
    .map((entry) => {
      const x = scaleX(entry.idx).toFixed(2);
      const y = scaleY(tempSeries[entry.idx]).toFixed(2);
      return `<circle cx="${x}" cy="${y}" r="5" fill="#f87171" />`;
    })
    .join('');

  const content = `
${svgHeader(width, height)}
<rect width="${width}" height="${height}" fill="#0b1120" />
<text x="40" y="40" fill="#f8fafc" font-size="22" font-family="Arial">Anomaly Detection (Isolation Forest)</text>
<path d="${path}" fill="none" stroke="#60a5fa" stroke-width="2" />
${anomalyDots}
<text x="${padding}" y="${height - 20}" fill="#94a3b8" font-size="12" font-family="Arial">Time Index</text>
<text x="20" y="${padding - 10}" fill="#94a3b8" font-size="12" font-family="Arial">Temp</text>
${svgFooter}`;

  saveSvg('anomaly_detection.svg', content.trim());
};

const createClusterSvg = () => {
  const width = 800;
  const height = 600;
  const padding = 60;
  const plotW = width - padding * 2;
  const plotH = height - padding * 2;

  const tempValues = sample.map((r) => r.temperature);
  const hrValues = sample.map((r) => r.heart_rate);
  const minX = Math.min(...tempValues);
  const maxX = Math.max(...tempValues);
  const minY = Math.min(...hrValues);
  const maxY = Math.max(...hrValues);

  const scaleX = (v) => padding + ((v - minX) / (maxX - minX || 1)) * plotW;
  const scaleY = (v) => padding + plotH - ((v - minY) / (maxY - minY || 1)) * plotH;

  const colors = ['#38bdf8', '#f97316', '#34d399'];

  const points = clusterAssignments
    .map((cluster, i) => {
      const x = scaleX(tempValues[i]).toFixed(2);
      const y = scaleY(hrValues[i]).toFixed(2);
      const color = colors[cluster % colors.length];
      return `<circle cx="${x}" cy="${y}" r="4" fill="${color}" opacity="0.75" />`;
    })
    .join('');

  const content = `
${svgHeader(width, height)}
<rect width="${width}" height="${height}" fill="#0b1120" />
<text x="40" y="40" fill="#f8fafc" font-size="22" font-family="Arial">Usage Pattern Clusters (K-Means)</text>
${points}
<text x="${padding}" y="${height - 20}" fill="#94a3b8" font-size="12" font-family="Arial">Temperature</text>
<text x="20" y="${padding - 10}" fill="#94a3b8" font-size="12" font-family="Arial">Heart Rate</text>
${svgFooter}`;

  saveSvg('usage_clusters.svg', content.trim());
};

const run = () => {
  createTemporalTrendSvg();
  createConfusionMatrixSvg();
  createCorrelationHeatmapSvg();
  createAnomalySvg();
  createClusterSvg();
  console.log('Charts generated in images/');
};

run();

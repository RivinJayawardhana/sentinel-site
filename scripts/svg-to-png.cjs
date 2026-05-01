const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const imagesDir = path.join(__dirname, '..', 'images');
const svgFiles = [
  'temporal_trend.svg',
  'threshold_confusion.svg',
  'correlation_heatmap.svg',
  'anomaly_detection.svg',
  'usage_clusters.svg',
];

const convertOne = async (filename) => {
  const svgPath = path.join(imagesDir, filename);
  if (!fs.existsSync(svgPath)) {
    throw new Error(`Missing SVG: ${svgPath}`);
  }
  const pngPath = path.join(imagesDir, filename.replace(/\.svg$/i, '.png'));
  await sharp(svgPath)
    .png({ quality: 100 })
    .toFile(pngPath);
  return pngPath;
};

const run = async () => {
  for (const file of svgFiles) {
    // Convert sequentially to keep memory usage predictable.
    await convertOne(file);
  }
  console.log('PNG charts generated in images/.');
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

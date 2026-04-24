import type { IoTReading } from "@/types/monitoring";

const VALID_HR   = { min: 30,  max: 220  };
const VALID_TEMP = { min: 10,  max: 50   };
const VALID_AQ   = { min: 0,   max: 1000 };

export interface CleanReading {
  hr:   number;
  temp: number;
  aq:   number;
  id:   string;
}

export function isValidReading(r: IoTReading): boolean {
  return (
    Number.isFinite(r.heart_rate)  && r.heart_rate  >= VALID_HR.min   && r.heart_rate  <= VALID_HR.max   &&
    Number.isFinite(r.temperature) && r.temperature >= VALID_TEMP.min  && r.temperature <= VALID_TEMP.max &&
    Number.isFinite(r.air_quality) && r.air_quality >= VALID_AQ.min    && r.air_quality <= VALID_AQ.max
  );
}

export function cleanReadings(readings: IoTReading[]): CleanReading[] {
  return readings.filter(isValidReading).map(r => ({
    hr:   r.heart_rate,
    temp: r.temperature,
    aq:   r.air_quality,
    id:   r.id,
  }));
}

export function movingAverage(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

export function rollingStats(values: number[]): { mean: number; std: number; min: number; max: number } {
  if (!values.length) return { mean: 0, std: 0, min: 0, max: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std  = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length) || 0;
  return { mean, std, min: Math.min(...values), max: Math.max(...values) };
}

// Returns true when the last `window` readings share the same value (stuck sensor)
export function isSensorStuck(values: number[], window = 5): boolean {
  if (values.length < window) return false;
  const recent = values.slice(-window);
  return recent.every(v => v === recent[0]);
}

// Drops values more than `threshold` standard deviations from the mean
export function removeOutliers(values: number[], threshold = 3): number[] {
  if (values.length < 3) return values;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std  = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length) || 1;
  return values.filter(v => Math.abs((v - mean) / std) <= threshold);
}

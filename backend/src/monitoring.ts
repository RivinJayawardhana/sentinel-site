import { z } from "zod";
import type {
  Alert,
  BootstrapResponse,
  Employee,
  TelemetryPoint,
  Thresholds,
  TimeSeriesPoint,
  Worker,
  WorkerStatus,
} from "./types";

// Flat format: {id, temperature, air_quality, humidity, latitude, longitude}
const flatRecordSchema = z.object({
  id: z.string(),
  temperature: z.number(),
  humidity: z.number(),
  air_quality: z.number(),
  latitude: z.number(),
  longitude: z.number(),
});

// Nested format: {id, payload: {temperature, ...}}
const nestedRecordSchema = z.object({
  id: z.string(),
  payload: z.object({
    temperature: z.number(),
    humidity: z.number(),
    air_quality: z.number(),
    latitude: z.number(),
    longitude: z.number(),
  }).passthrough(),
});

type FlatRecord = z.infer<typeof flatRecordSchema>;
type NestedRecord = z.infer<typeof nestedRecordSchema>;
type SourceRecord = { id: string; fields: { temperature: number; humidity: number; air_quality: number; latitude: number; longitude: number } };

function parseRecord(row: unknown): SourceRecord | null {
  const flat = flatRecordSchema.safeParse(row);
  if (flat.success) {
    const { id, ...fields } = flat.data;
    return { id, fields };
  }
  const nested = nestedRecordSchema.safeParse(row);
  if (nested.success) {
    return { id: nested.data.id, fields: nested.data.payload as FlatRecord };
  }
  return null;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function deriveStatus(airQuality: number, temperature: number, thresholds: Thresholds): WorkerStatus {
  if (airQuality <= thresholds.airQuality.criticalMin || temperature >= thresholds.temperature.criticalMax) {
    return "critical";
  }
  if (airQuality <= thresholds.airQuality.min || temperature >= thresholds.temperature.max) {
    return "warning";
  }
  return "normal";
}

function estimateHeartRate(temperature: number, humidity: number): number {
  const baseline = 72;
  const tempEffect = (temperature - 30) * 3.2;
  const humidityEffect = (humidity - 65) * 0.7;
  return Math.round(clamp(baseline + tempEffect + humidityEffect, 55, 145));
}

export function normalizeSourceRecords(payload: unknown, employeeId: string): TelemetryPoint[] {
  // Accept both a single object and an array
  const rows = Array.isArray(payload) ? payload : [payload];
  const points: TelemetryPoint[] = [];

  for (const row of rows) {
    const source = parseRecord(row);
    if (!source) continue;

    const tsFromId = Number(source.id);
    const ts = Number.isFinite(tsFromId) ? tsFromId : Date.now();
    points.push({
      employeeId,
      telemetryId: source.id,
      ts,
      temperature: source.fields.temperature,
      humidity: source.fields.humidity,
      airQuality: source.fields.air_quality,
      latitude: source.fields.latitude,
      longitude: source.fields.longitude,
    });
  }

  return points;
}

function makeAlertFromPoint(point: TelemetryPoint, worker: Worker, thresholds: Thresholds): Alert[] {
  const alerts: Alert[] = [];
  const alertPrefix = `${worker.id}-${point.telemetryId}`;

  if (point.airQuality <= thresholds.airQuality.criticalMin) {
    alerts.push({
      id: `ALT-AQ-CRIT-${alertPrefix}`,
      workerId: worker.id,
      workerName: worker.name,
      type: "air_quality",
      severity: "critical",
      message: `Critical air quality detected (${point.airQuality})`,
      timestamp: new Date(point.ts).toISOString(),
      status: "active",
      zone: worker.zone,
    });
  } else if (point.airQuality <= thresholds.airQuality.min) {
    alerts.push({
      id: `ALT-AQ-WARN-${alertPrefix}`,
      workerId: worker.id,
      workerName: worker.name,
      type: "air_quality",
      severity: "high",
      message: `Air quality below threshold (${point.airQuality})`,
      timestamp: new Date(point.ts).toISOString(),
      status: "active",
      zone: worker.zone,
    });
  }

  if (point.temperature >= thresholds.temperature.criticalMax) {
    alerts.push({
      id: `ALT-TEMP-CRIT-${alertPrefix}`,
      workerId: worker.id,
      workerName: worker.name,
      type: "temperature",
      severity: "critical",
      message: `Body/environment temperature critical (${point.temperature}°C)`,
      timestamp: new Date(point.ts).toISOString(),
      status: "active",
      zone: worker.zone,
    });
  } else if (point.temperature >= thresholds.temperature.max) {
    alerts.push({
      id: `ALT-TEMP-WARN-${alertPrefix}`,
      workerId: worker.id,
      workerName: worker.name,
      type: "temperature",
      severity: "medium",
      message: `Temperature above warning (${point.temperature}°C)`,
      timestamp: new Date(point.ts).toISOString(),
      status: "active",
      zone: worker.zone,
    });
  }

  return alerts;
}

function buildTimeSeries(history: TelemetryPoint[]): TimeSeriesPoint[] {
  const sorted = [...history].sort((a, b) => a.ts - b.ts).slice(-30);
  return sorted.map((p) => ({
    timestamp: new Date(p.ts).toISOString(),
    date: new Date(p.ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: new Date(p.ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    heartRate: estimateHeartRate(p.temperature, p.humidity),
    temperature: Number(p.temperature.toFixed(1)),
    airQuality: Number(p.airQuality.toFixed(0)),
  }));
}

export function buildBootstrapResponse(input: {
  employee: Employee;
  thresholds: Thresholds;
  history: TelemetryPoint[];
}): BootstrapResponse {
  const { employee, thresholds, history } = input;

  const latest = history[0];
  const latestTemp = latest?.temperature ?? 30;
  const latestHumidity = latest?.humidity ?? 68;
  const latestAQ = latest?.airQuality ?? 180;

  const worker: Worker = {
    id: employee.id,
    name: employee.name,
    role: employee.role,
    shift: employee.shift,
    zone: employee.zone,
    deviceId: employee.deviceId,
    status: deriveStatus(latestAQ, latestTemp, thresholds),
    heartRate: estimateHeartRate(latestTemp, latestHumidity),
    temperature: Number(latestTemp.toFixed(1)),
    airQuality: Number(latestAQ.toFixed(0)),
    location: {
      x: clamp((latest?.longitude ?? 79.97) - 79.8, 0, 0.8) * 120,
      y: clamp((latest?.latitude ?? 6.92) - 6.8, 0, 0.8) * 120,
    },
    lastUpdated: latest ? new Date(latest.ts).toISOString() : new Date().toISOString(),
  };

  const recent = history.slice(0, 24);
  const alerts = recent.flatMap((p) => makeAlertFromPoint(p, worker, thresholds)).slice(0, 25);

  const dayBuckets = new Map<string, number>();
  for (const alert of alerts) {
    const day = new Date(alert.timestamp).toLocaleDateString("en-US", { weekday: "short" });
    dayBuckets.set(day, (dayBuckets.get(day) ?? 0) + 1);
  }

  const orderedDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dailyAlertData = orderedDays.map((day) => ({ day, alerts: dayBuckets.get(day) ?? 0 }));

  const riskDistribution = [
    {
      name: "Normal",
      value: worker.status === "normal" ? 100 : worker.status === "warning" ? 30 : 10,
      fill: "hsl(122, 47%, 33%)",
    },
    {
      name: "Warning",
      value: worker.status === "warning" ? 60 : worker.status === "critical" ? 30 : 0,
      fill: "hsl(45, 96%, 56%)",
    },
    {
      name: "Critical",
      value: worker.status === "critical" ? 60 : 0,
      fill: "hsl(0, 76%, 47%)",
    },
  ];

  return {
    workers: [worker],
    alerts,
    zones: [
      { name: "Zone A", type: "safe", workers: worker.zone === "Zone A" ? 1 : 0, description: "Main Assembly Area" },
      { name: "Zone B", type: "safe", workers: worker.zone === "Zone B" ? 1 : 0, description: "Electrical Bay" },
      { name: "Zone C", type: "restricted", workers: worker.zone === "Zone C" ? 1 : 0, description: "Heavy Machinery" },
      { name: "Zone D", type: "safe", workers: worker.zone === "Zone D" ? 1 : 0, description: "Pipe Works" },
      { name: "Zone E", type: "emergency", workers: worker.zone === "Zone E" ? 1 : 0, description: "Chemical Storage" },
    ],
    dailyAlertData,
    riskDistribution,
    thresholds,
    timeSeries: buildTimeSeries(history),
  };
}

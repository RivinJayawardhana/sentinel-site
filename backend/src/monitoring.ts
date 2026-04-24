import { z } from "zod";
import type {
  Alert,
  BootstrapResponse,
  DangerZone,
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
  humidity: z.number().optional(),
  heart_rate: z.number().optional(),
  air_quality: z.number(),
  latitude: z.number(),
  longitude: z.number(),
});

// Nested format: {id, payload: {temperature, ...}}
const nestedRecordSchema = z.object({
  id: z.string(),
  payload: z.object({
    temperature: z.number(),
    humidity: z.number().optional(),
    heart_rate: z.number().optional(),
    air_quality: z.number(),
    latitude: z.number(),
    longitude: z.number(),
  }).passthrough(),
});

type FlatRecord = z.infer<typeof flatRecordSchema>;
type NestedRecord = z.infer<typeof nestedRecordSchema>;
type SourceRecord = {
  id: string;
  fields: {
    temperature: number;
    humidity?: number;
    heart_rate?: number;
    air_quality: number;
    latitude: number;
    longitude: number;
  };
  deviceId?: string;
};

const normalizeDeviceId = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

function pickDeviceId(row: unknown): string | undefined {
  if (!row || typeof row !== "object") return undefined;
  const record = row as Record<string, unknown>;
  const payload = typeof record.payload === "object" && record.payload !== null ? (record.payload as Record<string, unknown>) : null;

  return (
    normalizeDeviceId(record.deviceId) ??
    normalizeDeviceId(record.device_id) ??
    normalizeDeviceId(record.sensorId) ??
    normalizeDeviceId(record.sensor_id) ??
    normalizeDeviceId(record.Sensor_ID) ??
    (payload
      ? (normalizeDeviceId(payload.deviceId) ??
          normalizeDeviceId(payload.device_id) ??
          normalizeDeviceId(payload.sensorId) ??
          normalizeDeviceId(payload.sensor_id) ??
          normalizeDeviceId(payload.Sensor_ID))
      : undefined)
  );
}

function parseRecord(row: unknown): SourceRecord | null {
  const flat = flatRecordSchema.safeParse(row);
  if (flat.success) {
    const { id, ...fields } = flat.data;
    return { id, fields, deviceId: pickDeviceId(row) };
  }
  const nested = nestedRecordSchema.safeParse(row);
  if (nested.success) {
    return { id: nested.data.id, fields: nested.data.payload as FlatRecord, deviceId: pickDeviceId(row) };
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

export function normalizeSourceRecords(payload: unknown, employeeId: string, deviceId?: string): TelemetryPoint[] {
  // Accept both a single object and an array
  const rows = Array.isArray(payload) ? payload : [payload];
  const points: TelemetryPoint[] = [];
  const normalizedDeviceId = normalizeDeviceId(deviceId);

  if (deviceId !== undefined && !normalizedDeviceId) {
    return points;
  }

  for (const row of rows) {
    const source = parseRecord(row);
    if (!source) continue;
    if (normalizedDeviceId && source.deviceId && source.deviceId !== normalizedDeviceId) continue;
    if (normalizedDeviceId && !source.deviceId) continue;

    const tsFromId = Number(source.id);
    const ts = Number.isFinite(tsFromId) ? tsFromId : Date.now();
    points.push({
      employeeId,
      telemetryId: source.id,
      ts,
      temperature: source.fields.temperature,
      humidity: source.fields.humidity ?? 65,
      heartRate: source.fields.heart_rate ?? 0,
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

  if (point.heartRate >= thresholds.heartRate.criticalMax) {
    alerts.push({
      id: `ALT-HR-CRIT-${alertPrefix}`,
      workerId: worker.id,
      workerName: worker.name,
      type: "heart_rate",
      severity: "critical",
      message: `Heart rate critical (${point.heartRate} BPM)`,
      timestamp: new Date(point.ts).toISOString(),
      status: "active",
      zone: worker.zone,
    });
  } else if (point.heartRate >= thresholds.heartRate.max) {
    alerts.push({
      id: `ALT-HR-WARN-${alertPrefix}`,
      workerId: worker.id,
      workerName: worker.name,
      type: "heart_rate",
      severity: "high",
      message: `Heart rate above warning (${point.heartRate} BPM)`,
      timestamp: new Date(point.ts).toISOString(),
      status: "active",
      zone: worker.zone,
    });
  } else if (point.heartRate > 0 && point.heartRate <= thresholds.heartRate.min) {
    alerts.push({
      id: `ALT-HR-LOW-${alertPrefix}`,
      workerId: worker.id,
      workerName: worker.name,
      type: "heart_rate",
      severity: "medium",
      message: `Heart rate below minimum (${point.heartRate} BPM)`,
      timestamp: new Date(point.ts).toISOString(),
      status: "active",
      zone: worker.zone,
    });
  }

  return alerts;
}

const RADIUS_M = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;
const distanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

function buildTimeSeries(history: TelemetryPoint[]): TimeSeriesPoint[] {
  const sorted = [...history].sort((a, b) => a.ts - b.ts).slice(-30);
  return sorted.map((p) => ({
    timestamp: new Date(p.ts).toISOString(),
    date: new Date(p.ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: new Date(p.ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    heartRate: p.heartRate ?? 0,
    temperature: p.temperature,
    airQuality: p.airQuality,
  }));
}

export function buildBootstrapResponse(input: {
  employee: Employee;
  thresholds: Thresholds;
  history: TelemetryPoint[];
  dangerZones?: DangerZone[];
}): BootstrapResponse {
  const { employee, thresholds, history, dangerZones = [] } = input;

  const latest = history[0];
  const latestTemp = latest?.temperature ?? 30;
  const latestAQ = latest?.airQuality ?? 180;
  const now = Date.now();
  const offlineAfterMs = 2 * 60 * 1000;
  const isOffline = !latest || now - latest.ts > offlineAfterMs;

  const worker: Worker = {
    id: employee.id,
    name: employee.name,
    role: employee.role,
    shift: employee.shift,
    zone: employee.zone,
    deviceId: employee.deviceId,
    status: deriveStatus(latestAQ, latestTemp, thresholds),
    heartRate: latest?.heartRate ?? 0,
    temperature: latestTemp,
    airQuality: latestAQ,
    location: {
      x: clamp((latest?.longitude ?? 79.97) - 79.8, 0, 0.8) * 120,
      y: clamp((latest?.latitude ?? 6.92) - 6.8, 0, 0.8) * 120,
    },
    lastUpdated: latest ? new Date(latest.ts).toISOString() : new Date().toISOString(),
  };

  const recent = history.slice(0, 24);
  let alerts = recent.flatMap((p) => makeAlertFromPoint(p, worker, thresholds));

  if (dangerZones.length > 0) {
    for (const point of recent) {
      if (point.latitude === 0 && point.longitude === 0) continue;
      for (const zone of dangerZones) {
        const dist = distanceMeters(point.latitude, point.longitude, zone.centerLat, zone.centerLng);
        if (dist <= zone.radiusMeters) {
          alerts.push({
            id: `ALT-ZONE-${zone.id}-${worker.id}-${point.telemetryId}`,
            workerId: worker.id,
            workerName: worker.name,
            type: "zone_breach",
            severity: "high",
            message: `Entered danger zone ${zone.name} (${Math.round(dist)}m from center)`,
            timestamp: new Date(point.ts).toISOString(),
            status: "active",
            zone: worker.zone,
          });
        }
      }
    }
  }

  alerts = alerts.slice(0, 25);

  if (isOffline) {
    alerts.unshift({
      id: `ALT-DEVICE-OFFLINE-${worker.id}`,
      workerId: worker.id,
      workerName: worker.name,
      type: "device_offline",
      severity: "low",
      message: "Device not connected (no recent telemetry)",
      timestamp: new Date(now).toISOString(),
      status: "active",
      zone: worker.zone,
    });
  }

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

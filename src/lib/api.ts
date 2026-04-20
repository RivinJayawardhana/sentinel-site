import type { BootstrapResponse, IoTReading, Thresholds } from "@/types/monitoring";

const IOT_API_URL = "https://76ezf3ssob.execute-api.eu-north-1.amazonaws.com/apistage/data";

type RawIoTRecord = {
  id: string;
  payload: { temperature: number; humidity: number; air_quality: number; latitude: number; longitude: number };
};

function normalizeRecord(r: RawIoTRecord): IoTReading {
  return {
    id: r.id,
    temperature: r.payload.temperature,
    air_quality: r.payload.air_quality,
    humidity: r.payload.humidity,
    latitude: r.payload.latitude,
    longitude: r.payload.longitude,
  };
}

async function fetchAllIoTReadings(): Promise<IoTReading[]> {
  const res = await fetch(IOT_API_URL);
  if (!res.ok) throw new Error(`IoT fetch failed (${res.status})`);
  const raw = (await res.json()) as RawIoTRecord[];
  return raw
    .filter((r) => r?.payload?.temperature != null)
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map(normalizeRecord);
}

export async function fetchIoTData(): Promise<IoTReading> {
  const all = await fetchAllIoTReadings();
  if (!all.length) throw new Error("No IoT readings available");
  return all[all.length - 1]; // latest reading
}

// ─── Fallback bootstrap builder (no backend required) ────────────────────────

const defaultThresholds: Thresholds = {
  heartRate: { min: 60, max: 100, criticalMax: 120 },
  temperature: { min: 35.5, max: 37.5, criticalMax: 38.0 },
  airQuality: { min: 70, criticalMin: 50 },
};

// Accumulated in-memory history so charts build up over the session
const iotHistory: Array<{ ts: number; temperature: number; air_quality: number; humidity: number }> = [];

function estimateHeartRate(temp: number, humidity: number): number {
  return Math.round(Math.max(55, Math.min(145, 72 + (temp - 30) * 3.2 + (humidity - 65) * 0.7)));
}

function buildBootstrapFromIoT(reading: IoTReading, allReadings?: IoTReading[]): BootstrapResponse {
  const { temperature, air_quality, humidity, id } = reading;

  // Use live API history if available, otherwise fall back to in-memory accumulator
  if (allReadings && allReadings.length > 0) {
    iotHistory.length = 0;
    for (const r of allReadings.slice(-60)) {
      iotHistory.push({ ts: Number(r.id), temperature: r.temperature, air_quality: r.air_quality, humidity: r.humidity });
    }
  } else {
    iotHistory.push({ ts: Date.now(), temperature, air_quality, humidity });
    if (iotHistory.length > 60) iotHistory.splice(0, iotHistory.length - 60);
  }

  let status: "normal" | "warning" | "critical" = "normal";
  if (air_quality <= defaultThresholds.airQuality.criticalMin || temperature >= defaultThresholds.temperature.criticalMax) {
    status = "critical";
  } else if (air_quality <= defaultThresholds.airQuality.min || temperature >= defaultThresholds.temperature.max) {
    status = "warning";
  }

  const heartRate = estimateHeartRate(temperature, humidity);

  const worker = {
    id: "SENSOR-001",
    name: `Live Sensor (${id.slice(-6)})`,
    role: "IoT Device",
    shift: "Morning" as const,
    zone: "Zone A" as const,
    deviceId: id,
    status,
    heartRate,
    temperature: Number(temperature.toFixed(1)),
    airQuality: Number(air_quality.toFixed(0)),
    location: { x: 50, y: 50 },
    lastUpdated: new Date().toISOString(),
  };

  const alerts = [];
  const now = new Date().toISOString();
  if (air_quality <= defaultThresholds.airQuality.criticalMin) {
    alerts.push({ id: `AQ-CRIT-${id}`, workerId: "SENSOR-001", workerName: worker.name, type: "air_quality" as const, severity: "critical" as const, message: `Critical air quality: ${air_quality.toFixed(0)} AQI`, timestamp: now, status: "active" as const, zone: "Zone A" as const });
  } else if (air_quality <= defaultThresholds.airQuality.min) {
    alerts.push({ id: `AQ-WARN-${id}`, workerId: "SENSOR-001", workerName: worker.name, type: "air_quality" as const, severity: "high" as const, message: `Low air quality: ${air_quality.toFixed(0)} AQI`, timestamp: now, status: "active" as const, zone: "Zone A" as const });
  }
  if (temperature >= defaultThresholds.temperature.criticalMax) {
    alerts.push({ id: `TEMP-CRIT-${id}`, workerId: "SENSOR-001", workerName: worker.name, type: "temperature" as const, severity: "critical" as const, message: `Critical temperature: ${temperature.toFixed(1)}°C`, timestamp: now, status: "active" as const, zone: "Zone A" as const });
  } else if (temperature >= defaultThresholds.temperature.max) {
    alerts.push({ id: `TEMP-WARN-${id}`, workerId: "SENSOR-001", workerName: worker.name, type: "temperature" as const, severity: "medium" as const, message: `High temperature: ${temperature.toFixed(1)}°C`, timestamp: now, status: "active" as const, zone: "Zone A" as const });
  }

  const timeSeries = iotHistory.map((p) => ({
    time: new Date(p.ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    heartRate: estimateHeartRate(p.temperature, p.humidity),
    temperature: Number(p.temperature.toFixed(1)),
    airQuality: Number(p.air_quality.toFixed(0)),
  }));

  const dayBuckets = new Map<string, number>();
  for (const a of alerts) {
    const day = new Date(a.timestamp).toLocaleDateString("en-US", { weekday: "short" });
    dayBuckets.set(day, (dayBuckets.get(day) ?? 0) + 1);
  }

  return {
    workers: [worker],
    alerts,
    zones: [
      { name: "Zone A", type: "safe", workers: 1, description: "Main Assembly Area" },
      { name: "Zone B", type: "safe", workers: 0, description: "Electrical Bay" },
      { name: "Zone C", type: "restricted", workers: 0, description: "Heavy Machinery" },
      { name: "Zone D", type: "safe", workers: 0, description: "Pipe Works" },
      { name: "Zone E", type: "emergency", workers: 0, description: "Chemical Storage" },
    ],
    dailyAlertData: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({ day, alerts: dayBuckets.get(day) ?? 0 })),
    riskDistribution: [
      { name: "Normal", value: status === "normal" ? 100 : status === "warning" ? 30 : 10, fill: "hsl(122, 47%, 33%)" },
      { name: "Warning", value: status === "warning" ? 60 : status === "critical" ? 30 : 0, fill: "hsl(45, 96%, 56%)" },
      { name: "Critical", value: status === "critical" ? 60 : 0, fill: "hsl(0, 76%, 47%)" },
    ],
    thresholds: defaultThresholds,
    timeSeries,
  };
}

// ─── Backend API ──────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_BACKEND_API_URL ?? (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8080" : "http://localhost:4000");

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) throw new Error(`Request failed (${res.status}) for ${path}`);
  return (await res.json()) as T;
}

export async function fetchBootstrap(employeeId: string): Promise<BootstrapResponse> {
  try {
    return await requestJson<BootstrapResponse>(`/api/bootstrap?employeeId=${encodeURIComponent(employeeId)}&sync=true`);
  } catch {
    // Backend offline — serve real IoT data directly from the AWS endpoint
    const all = await fetchAllIoTReadings();
    const latest = all[all.length - 1];
    return buildBootstrapFromIoT(latest, all);
  }
}

export function fetchSettings(employeeId: string) {
  return requestJson<{ employeeId: string; thresholds: Thresholds }>(`/api/settings?employeeId=${encodeURIComponent(employeeId)}`);
}

export function updateSettings(employeeId: string, thresholds: Thresholds) {
  return requestJson<{ employeeId: string; thresholds: Thresholds }>(`/api/settings?employeeId=${encodeURIComponent(employeeId)}`, {
    method: "PUT",
    body: JSON.stringify(thresholds),
  });
}

export function ingestTelemetry(employeeId: string) {
  return requestJson<{ inserted: number; scanned: number; employeeId: string }>(`/api/ingest?employeeId=${encodeURIComponent(employeeId)}`, {
    method: "POST",
  });
}

export function updateEmployeeDevice(employeeId: string, deviceId: string) {
  return requestJson<{ message: string; employee: any }>(`/api/employee/${encodeURIComponent(employeeId)}/device`, {
    method: "PUT",
    body: JSON.stringify({ deviceId }),
  });
}

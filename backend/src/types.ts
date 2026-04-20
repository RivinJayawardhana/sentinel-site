export type WorkerStatus = "normal" | "warning" | "critical";
export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertStatus = "active" | "acknowledged" | "resolved";
export type AlertType = "heart_rate" | "temperature" | "air_quality" | "zone_breach" | "device_offline";

export interface Employee {
  id: string;
  name: string;
  role: string;
  shift: "Morning" | "Afternoon" | "Night";
  zone: "Zone A" | "Zone B" | "Zone C" | "Zone D" | "Zone E";
  deviceId: string;
}

export interface Thresholds {
  heartRate: { min: number; max: number; criticalMax: number };
  temperature: { min: number; max: number; criticalMax: number };
  airQuality: { min: number; criticalMin: number };
}

export interface TelemetryPoint {
  employeeId: string;
  telemetryId: string;
  ts: number;
  temperature: number;
  humidity: number;
  airQuality: number;
  latitude: number;
  longitude: number;
}

export interface Worker {
  id: string;
  name: string;
  role: string;
  shift: "Morning" | "Afternoon" | "Night";
  zone: "Zone A" | "Zone B" | "Zone C" | "Zone D" | "Zone E";
  deviceId: string;
  status: WorkerStatus;
  heartRate: number;
  temperature: number;
  airQuality: number;
  location: { x: number; y: number };
  lastUpdated: string;
}

export interface Alert {
  id: string;
  workerId: string;
  workerName: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
  status: AlertStatus;
  zone: Worker["zone"];
}

export interface TimeSeriesPoint {
  time: string;
  heartRate: number;
  temperature: number;
  airQuality: number;
}

export interface BootstrapResponse {
  workers: Worker[];
  alerts: Alert[];
  zones: Array<{ name: Worker["zone"]; type: "safe" | "restricted" | "emergency"; workers: number; description: string }>;
  dailyAlertData: Array<{ day: string; alerts: number }>;
  riskDistribution: Array<{ name: string; value: number; fill: string }>;
  thresholds: Thresholds;
  timeSeries: TimeSeriesPoint[];
}

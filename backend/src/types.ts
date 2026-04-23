export type WorkerStatus = "normal" | "warning" | "critical";
export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertStatus = "active" | "acknowledged" | "resolved";
export type AlertType = "heart_rate" | "temperature" | "air_quality" | "zone_breach" | "device_offline";
export type ZoneType = "safe" | "restricted" | "emergency";

export interface Employee {
  id: string;
  name: string;
  role: string;
  shift: "Morning" | "Afternoon" | "Night";
  zone: string;
  deviceId: string;
}

export interface ZoneDefinition {
  name: string;
  type: ZoneType;
  description: string;
}

export interface Thresholds {
  heartRate: { min: number; max: number; criticalMax: number };
  temperature: { min: number; max: number; criticalMax: number };
  airQuality: { min: number; criticalMin: number };
}

export interface NotificationSettings {
  email: boolean;
  sms: boolean;
  push: boolean;
  criticalOnly: boolean;
}

export interface TelemetryPoint {
  employeeId: string;
  telemetryId: string;
  ts: number;
  sourceTs?: number;
  ingestedAt: string;
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
  zone: string;
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
  timestamp: string;
  date: string;
  time: string;
  heartRate: number;
  temperature: number;
  airQuality: number;
}

export interface BootstrapResponse {
  workers: Worker[];
  alerts: Alert[];
  zones: Array<{ name: Worker["zone"]; type: ZoneType; workers: number; description: string }>;
  dailyAlertData: Array<{ day: string; alerts: number }>;
  riskDistribution: Array<{ name: string; value: number; fill: string }>;
  thresholds: Thresholds;
  timeSeries: TimeSeriesPoint[];
}

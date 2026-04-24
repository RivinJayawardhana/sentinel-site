export type WorkerStatus = "normal" | "warning" | "critical";
export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertStatus = "active" | "acknowledged" | "resolved";
export type AlertType = "heart_rate" | "temperature" | "air_quality" | "zone_breach" | "device_offline";
export type Zone = string;
export type ZoneType = "safe" | "restricted" | "emergency";

export interface ZoneDefinition {
  name: string;
  type: ZoneType;
  description: string;
}

export interface Worker {
  id: string;
  name: string;
  role: string;
  shift: "Morning" | "Afternoon" | "Night";
  zone: Zone;
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
  zone: Zone;
}

export interface TimeSeriesPoint {
  timestamp: string;
  date: string;
  time: string;
  heartRate: number;
  temperature: number;
  airQuality: number;
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

export interface IoTReading {
  id: string;
  temperature: number;
  air_quality: number;
  heart_rate: number;
  humidity?: number;
  latitude: number;
  longitude: number;
}

export interface DangerZone {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  createdAt: string;
  createdBy: string;
}

export interface TelemetryPoint {
  employeeId: string;
  telemetryId: string;
  ts: number;
  temperature: number;
  humidity: number;
  heartRate: number;
  airQuality: number;
  latitude: number;
  longitude: number;
}

export interface BootstrapResponse {
  workers: Worker[];
  alerts: Alert[];
  zones: Array<{ name: Zone; type: ZoneType; workers: number; description: string }>;
  dailyAlertData: Array<{ day: string; alerts: number }>;
  riskDistribution: Array<{ name: string; value: number; fill: string }>;
  thresholds: Thresholds;
  timeSeries: TimeSeriesPoint[];
}

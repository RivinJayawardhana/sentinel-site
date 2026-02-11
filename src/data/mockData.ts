export type WorkerStatus = "normal" | "warning" | "critical";
export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertStatus = "active" | "acknowledged" | "resolved";
export type AlertType = "heart_rate" | "temperature" | "air_quality" | "zone_breach" | "device_offline";
export type Zone = "Zone A" | "Zone B" | "Zone C" | "Zone D" | "Zone E";
export type Shift = "Morning" | "Afternoon" | "Night";

export interface Worker {
  id: string;
  name: string;
  role: string;
  shift: Shift;
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
  time: string;
  heartRate: number;
  temperature: number;
  airQuality: number;
}

export const workers: Worker[] = [
  { id: "W001", name: "James Rodriguez", role: "Welder", shift: "Morning", zone: "Zone A", deviceId: "DEV-1001", status: "normal", heartRate: 78, temperature: 36.6, airQuality: 92, location: { x: 25, y: 35 }, lastUpdated: "2026-02-11T08:42:00" },
  { id: "W002", name: "Sarah Chen", role: "Electrician", shift: "Morning", zone: "Zone B", deviceId: "DEV-1002", status: "warning", heartRate: 105, temperature: 37.2, airQuality: 78, location: { x: 55, y: 20 }, lastUpdated: "2026-02-11T08:41:30" },
  { id: "W003", name: "Mike Johnson", role: "Crane Operator", shift: "Morning", zone: "Zone C", deviceId: "DEV-1003", status: "critical", heartRate: 132, temperature: 38.1, airQuality: 45, location: { x: 70, y: 60 }, lastUpdated: "2026-02-11T08:42:15" },
  { id: "W004", name: "Emily Watson", role: "Safety Inspector", shift: "Morning", zone: "Zone A", deviceId: "DEV-1004", status: "normal", heartRate: 72, temperature: 36.5, airQuality: 95, location: { x: 30, y: 45 }, lastUpdated: "2026-02-11T08:40:00" },
  { id: "W005", name: "Carlos Mendez", role: "Pipefitter", shift: "Afternoon", zone: "Zone D", deviceId: "DEV-1005", status: "normal", heartRate: 82, temperature: 36.7, airQuality: 88, location: { x: 40, y: 75 }, lastUpdated: "2026-02-11T08:42:10" },
  { id: "W006", name: "Aisha Patel", role: "Scaffolder", shift: "Afternoon", zone: "Zone B", deviceId: "DEV-1006", status: "warning", heartRate: 98, temperature: 37.4, airQuality: 72, location: { x: 60, y: 30 }, lastUpdated: "2026-02-11T08:41:45" },
  { id: "W007", name: "Tom Nguyen", role: "Rigger", shift: "Morning", zone: "Zone E", deviceId: "DEV-1007", status: "normal", heartRate: 75, temperature: 36.4, airQuality: 90, location: { x: 85, y: 45 }, lastUpdated: "2026-02-11T08:42:05" },
  { id: "W008", name: "Lisa Kowalski", role: "Heavy Equipment Op", shift: "Night", zone: "Zone C", deviceId: "DEV-1008", status: "normal", heartRate: 80, temperature: 36.6, airQuality: 85, location: { x: 65, y: 55 }, lastUpdated: "2026-02-11T08:39:50" },
  { id: "W009", name: "David Kim", role: "Welder", shift: "Afternoon", zone: "Zone A", deviceId: "DEV-1009", status: "critical", heartRate: 128, temperature: 38.3, airQuality: 40, location: { x: 20, y: 50 }, lastUpdated: "2026-02-11T08:42:20" },
  { id: "W010", name: "Rachel Green", role: "Electrician", shift: "Morning", zone: "Zone D", deviceId: "DEV-1010", status: "normal", heartRate: 70, temperature: 36.3, airQuality: 94, location: { x: 45, y: 70 }, lastUpdated: "2026-02-11T08:41:00" },
  { id: "W011", name: "Omar Hassan", role: "Crane Operator", shift: "Night", zone: "Zone E", deviceId: "DEV-1011", status: "warning", heartRate: 110, temperature: 37.0, airQuality: 68, location: { x: 80, y: 55 }, lastUpdated: "2026-02-11T08:40:30" },
  { id: "W012", name: "Anna Petrova", role: "Safety Inspector", shift: "Morning", zone: "Zone B", deviceId: "DEV-1012", status: "normal", heartRate: 68, temperature: 36.5, airQuality: 96, location: { x: 50, y: 25 }, lastUpdated: "2026-02-11T08:42:00" },
];

export const alerts: Alert[] = [
  { id: "ALT001", workerId: "W003", workerName: "Mike Johnson", type: "heart_rate", severity: "critical", message: "Heart rate critically elevated at 132 BPM", timestamp: "2026-02-11T08:42:15", status: "active", zone: "Zone C" },
  { id: "ALT002", workerId: "W009", workerName: "David Kim", type: "air_quality", severity: "critical", message: "Dangerous air quality level detected (AQI: 40)", timestamp: "2026-02-11T08:42:20", status: "active", zone: "Zone A" },
  { id: "ALT003", workerId: "W002", workerName: "Sarah Chen", type: "heart_rate", severity: "high", message: "Elevated heart rate at 105 BPM", timestamp: "2026-02-11T08:41:30", status: "active", zone: "Zone B" },
  { id: "ALT004", workerId: "W006", workerName: "Aisha Patel", type: "temperature", severity: "medium", message: "Body temperature above normal at 37.4°C", timestamp: "2026-02-11T08:41:45", status: "acknowledged", zone: "Zone B" },
  { id: "ALT005", workerId: "W011", workerName: "Omar Hassan", type: "air_quality", severity: "high", message: "Poor air quality detected (AQI: 68)", timestamp: "2026-02-11T08:40:30", status: "active", zone: "Zone E" },
  { id: "ALT006", workerId: "W003", workerName: "Mike Johnson", type: "zone_breach", severity: "high", message: "Worker entered restricted zone without clearance", timestamp: "2026-02-11T08:35:00", status: "acknowledged", zone: "Zone C" },
  { id: "ALT007", workerId: "W009", workerName: "David Kim", type: "heart_rate", severity: "critical", message: "Heart rate critically elevated at 128 BPM", timestamp: "2026-02-11T08:42:00", status: "active", zone: "Zone A" },
  { id: "ALT008", workerId: "W005", workerName: "Carlos Mendez", type: "device_offline", severity: "low", message: "Device briefly went offline", timestamp: "2026-02-11T07:30:00", status: "resolved", zone: "Zone D" },
  { id: "ALT009", workerId: "W001", workerName: "James Rodriguez", type: "temperature", severity: "medium", message: "Ambient temperature spike in work area", timestamp: "2026-02-11T07:15:00", status: "resolved", zone: "Zone A" },
  { id: "ALT010", workerId: "W008", workerName: "Lisa Kowalski", type: "zone_breach", severity: "medium", message: "Worker near restricted boundary", timestamp: "2026-02-11T06:50:00", status: "resolved", zone: "Zone C" },
];

export function generateTimeSeries(baseHR: number, baseTemp: number, baseAQ: number): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = [];
  for (let i = 10; i >= 0; i--) {
    const time = new Date(Date.now() - i * 60000);
    points.push({
      time: time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      heartRate: baseHR + Math.round((Math.random() - 0.5) * 10),
      temperature: +(baseTemp + (Math.random() - 0.5) * 0.4).toFixed(1),
      airQuality: Math.max(20, Math.min(100, baseAQ + Math.round((Math.random() - 0.5) * 8))),
    });
  }
  return points;
}

export const zones = [
  { name: "Zone A", type: "safe" as const, workers: 3, description: "Main Assembly Area" },
  { name: "Zone B", type: "safe" as const, workers: 3, description: "Electrical Bay" },
  { name: "Zone C", type: "restricted" as const, workers: 2, description: "Heavy Machinery" },
  { name: "Zone D", type: "safe" as const, workers: 2, description: "Pipe Works" },
  { name: "Zone E", type: "emergency" as const, workers: 2, description: "Chemical Storage" },
];

export const dailyAlertData = [
  { day: "Mon", alerts: 12 },
  { day: "Tue", alerts: 8 },
  { day: "Wed", alerts: 15 },
  { day: "Thu", alerts: 6 },
  { day: "Fri", alerts: 18 },
  { day: "Sat", alerts: 4 },
  { day: "Sun", alerts: 2 },
];

export const riskDistribution = [
  { name: "Normal", value: 65, fill: "hsl(122, 47%, 33%)" },
  { name: "Warning", value: 25, fill: "hsl(45, 96%, 56%)" },
  { name: "Critical", value: 10, fill: "hsl(0, 76%, 47%)" },
];

export const thresholds = {
  heartRate: { min: 60, max: 100, criticalMax: 120 },
  temperature: { min: 35.5, max: 37.5, criticalMax: 38.0 },
  airQuality: { min: 70, criticalMin: 50 },
};

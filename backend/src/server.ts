import express from "express";
import cors from "cors";
import { z } from "zod";
import { config } from "./config";
import {
  getOrCreateEmployee,
  getOrCreateNotifications,
  getOrCreateThresholds,
  getOrCreateZoneDefinitions,
  listTelemetry,
  pingTables,
  deleteZoneDefinition,
  updateEmployeeAssignment,
  updateEmployeeDevice,
  updateNotifications,
  updateThresholds,
  upsertZoneDefinition,
  upsertTelemetry,
} from "./repository";
import { buildBootstrapResponse, normalizeSourceRecords } from "./monitoring";
import { listAllEmployees } from "./listAllEmployees";

const app = express();
app.use(cors());
app.use(express.json());

const assignmentSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1),
    role: z.string().optional(),
    shift: z.enum(["Morning", "Afternoon", "Night"]).optional(),
    zone: z.string().optional(),
    deviceId: z.string().optional().nullable(),
  })
  .transform((value) => ({
    ...value,
    role: value.role?.trim() || "worker",
    shift: value.shift ?? "Morning",
    zone: value.zone?.trim() || "Zone A",
    deviceId: value.deviceId?.trim() ?? "",
  }));

const thresholdsSchema = z.object({
  heartRate: z.object({ min: z.number(), max: z.number(), criticalMax: z.number() }),
  temperature: z.object({ min: z.number(), max: z.number(), criticalMax: z.number() }),
  airQuality: z.object({ min: z.number(), criticalMin: z.number() }),
});

const notificationsSchema = z.object({
  email: z.boolean(),
  sms: z.boolean(),
  push: z.boolean(),
  criticalOnly: z.boolean(),
});

const zoneSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["safe", "restricted", "emergency"]),
  description: z.string().min(1),
});

const alertStatusSchema = z.object({
  status: z.enum(["active", "acknowledged", "resolved"]),
});

const alertStatusOverrides = new Map<string, "active" | "acknowledged" | "resolved">();

function applyAlertStatuses<T extends { id: string; status: "active" | "acknowledged" | "resolved" }>(alerts: T[]): T[] {
  return alerts.map((alert) => ({
    ...alert,
    status: alertStatusOverrides.get(alert.id) ?? alert.status,
  }));
}

app.get("/health", async (_req, res) => {
  try {
    await pingTables();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: (error as Error).message });
  }
});

app.post("/api/ingest", async (req, res) => {
  try {
    const employeeId = String(req.query.employeeId ?? config.defaultEmployeeId);
    const employee = await getOrCreateEmployee(employeeId);

    const upstream = await fetch(config.telemetryApiUrl);
    if (!upstream.ok) {
      return res.status(502).json({ message: `Upstream API failed with status ${upstream.status}` });
    }

    const raw = await upstream.json();
    const points = normalizeSourceRecords(raw, employeeId, employee.deviceId);

    let inserted = 0;
    for (const point of points) {
      try {
        await upsertTelemetry(point);
        inserted += 1;
      } catch {
        // Duplicate telemetry rows are expected during repeated sync.
      }
    }

    res.json({ inserted, scanned: points.length, employeeId });
  } catch (error) {
    res.status(500).json({ message: "Failed to ingest telemetry", error: (error as Error).message });
  }
});

app.put("/api/employee", async (req, res) => {
  const parsed = assignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid employee assignment", errors: parsed.error.issues });
  }

  const result = await updateEmployeeAssignment(parsed.data);
  res.json(result);
});

app.get("/api/employee/:id/latest", async (req, res) => {
  const employeeId = req.params.id;
  const history = await listTelemetry(employeeId, 1);
  res.json(history[0] ?? null);
});

app.get("/api/employee/:id/history", async (req, res) => {
  const employeeId = req.params.id;
  const limit = Number(req.query.limit ?? 120);
  const history = await listTelemetry(employeeId, Number.isFinite(limit) ? limit : 120);
  res.json(history);
});

app.get("/api/employee/:id/alerts", async (req, res) => {
  const employeeId = req.params.id;
  const employee = await getOrCreateEmployee(employeeId);
  const thresholds = await getOrCreateThresholds(employeeId);
  const history = await listTelemetry(employeeId, 120);
  const bootstrap = buildBootstrapResponse({ employee, thresholds, history });
  res.json(applyAlertStatuses(bootstrap.alerts));
});

app.put("/api/alerts/:id/status", async (req, res) => {
  const alertId = req.params.id;
  const parsed = alertStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid alert status", errors: parsed.error.issues });
  }

  alertStatusOverrides.set(alertId, parsed.data.status);
  res.json({ id: alertId, status: parsed.data.status });
});

app.get("/api/settings", async (req, res) => {
  const employeeId = String(req.query.employeeId ?? config.defaultEmployeeId);
  const thresholds = await getOrCreateThresholds(employeeId);
  res.json({ employeeId, thresholds });
});

app.put("/api/settings", async (req, res) => {
  const employeeId = String(req.query.employeeId ?? config.defaultEmployeeId);
  const parsed = thresholdsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid thresholds", errors: parsed.error.issues });
  }

  const updated = await updateThresholds(employeeId, parsed.data);
  res.json({ employeeId, thresholds: updated });
});

app.get("/api/notifications", async (req, res) => {
  const employeeId = String(req.query.employeeId ?? config.defaultEmployeeId);
  const notifications = await getOrCreateNotifications(employeeId);
  res.json({ employeeId, notifications });
});

app.put("/api/notifications", async (req, res) => {
  const employeeId = String(req.query.employeeId ?? config.defaultEmployeeId);
  const parsed = notificationsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid notification settings", errors: parsed.error.issues });
  }

  const updated = await updateNotifications(employeeId, parsed.data);
  res.json({ employeeId, notifications: updated });
});

app.put("/api/employee/:employeeId/device", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { deviceId } = req.body;

    if (!deviceId || typeof deviceId !== "string") {
      return res.status(400).json({ message: "deviceId is required and must be a string" });
    }

    if (!deviceId.trim()) {
      return res.status(400).json({ message: "deviceId cannot be empty" });
    }

    const updatedEmployee = await updateEmployeeDevice(employeeId, deviceId.trim());
    res.json({
      message: `Device changed from ${updatedEmployee.deviceId} to ${deviceId}`,
      employee: updatedEmployee,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update device", error: (error as Error).message });
  }
});

app.get("/api/zones", async (_req, res) => {
  const zones = await getOrCreateZoneDefinitions();
  res.json({ zones });
});

app.post("/api/zones", async (req, res) => {
  const parsed = zoneSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid zone payload", errors: parsed.error.issues });
  }

  const zones = await upsertZoneDefinition(parsed.data);
  res.json({ zones });
});

app.delete("/api/zones/:name", async (req, res) => {
  const zoneName = String(req.params.name ?? "").trim();
  if (!zoneName) {
    return res.status(400).json({ message: "Zone name is required" });
  }

  const zones = await deleteZoneDefinition(zoneName);
  res.json({ zones });
});

app.get("/api/bootstrap", async (req, res) => {
  try {
    const requestedEmployeeId = String(req.query.employeeId ?? config.defaultEmployeeId);
    const shouldSync = String(req.query.sync ?? "true") === "true";
    let allEmployees = await listAllEmployees();
    if (allEmployees.length === 0) {
      const employee = await getOrCreateEmployee(requestedEmployeeId);
      allEmployees = [employee];
    }

    const zoneDefinitions = await getOrCreateZoneDefinitions();
    const zoneCatalog = new Map(zoneDefinitions.map((z) => [z.name, { type: z.type, description: z.description }]));

    const zoneWorkerCounts = new Map<string, number>();
    for (const employee of allEmployees) {
      zoneWorkerCounts.set(employee.zone, (zoneWorkerCounts.get(employee.zone) ?? 0) + 1);
    }

    const dynamicZones = zoneDefinitions.map((z) => ({
      name: z.name,
      type: z.type,
      workers: zoneWorkerCounts.get(z.name) ?? 0,
      description: z.description,
    }));

    for (const [name, workers] of zoneWorkerCounts.entries()) {
      if (!zoneCatalog.has(name)) {
        dynamicZones.push({
          name,
          type: "restricted",
          workers,
          description: "Custom Zone",
        });
      }
    }

    const workers = [];
    let allAlerts = [];
    let allTimeSeries = [];
    let allDailyAlertData = [];
    let allRiskDistribution = [];
    const thresholds = await getOrCreateThresholds(requestedEmployeeId);

    for (const employee of allEmployees) {
      if (shouldSync) {
        const upstream = await fetch(config.telemetryApiUrl);
        if (upstream.ok) {
          const raw = await upstream.json();
          const points = normalizeSourceRecords(raw, employee.id, employee.deviceId);
          for (const point of points) {
            try {
              await upsertTelemetry(point);
            } catch {
              // Ignore duplicates.
            }
          }
        }
      }
      const t = await getOrCreateThresholds(employee.id);
      const history = await listTelemetry(employee.id, 180);
      const response = buildBootstrapResponse({ employee, thresholds: t, history });
      workers.push(response.workers[0]);
      allAlerts = allAlerts.concat(response.alerts);
      allTimeSeries = allTimeSeries.concat(response.timeSeries);
      allDailyAlertData = allDailyAlertData.concat(response.dailyAlertData);
      allRiskDistribution = allRiskDistribution.concat(response.riskDistribution);
    }

    res.json({
      workers,
      alerts: applyAlertStatuses(allAlerts),
      zones: dynamicZones,
      dailyAlertData: allDailyAlertData,
      riskDistribution: allRiskDistribution,
      thresholds,
      timeSeries: allTimeSeries,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to build monitoring snapshot", error: (error as Error).message });
  }
});

app.listen(config.port, () => {
  console.log(`Sentinel backend listening on http://localhost:${config.port}`);
});

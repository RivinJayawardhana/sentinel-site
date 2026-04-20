import express from "express";
import cors from "cors";
import { z } from "zod";
import { config } from "./config";
import {
  getOrCreateEmployee,
  getOrCreateThresholds,
  listTelemetry,
  pingTables,
  updateEmployeeAssignment,
  updateEmployeeDevice,
  updateThresholds,
  upsertTelemetry,
} from "./repository";
import { buildBootstrapResponse, normalizeSourceRecords } from "./monitoring";
import { listAllEmployees } from "./listAllEmployees";

const app = express();
app.use(cors());
app.use(express.json());

const assignmentSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  role: z.string().min(1),
  shift: z.enum(["Morning", "Afternoon", "Night"]),
  zone: z.enum(["Zone A", "Zone B", "Zone C", "Zone D", "Zone E"]),
  deviceId: z.string().min(1),
});

const thresholdsSchema = z.object({
  heartRate: z.object({ min: z.number(), max: z.number(), criticalMax: z.number() }),
  temperature: z.object({ min: z.number(), max: z.number(), criticalMax: z.number() }),
  airQuality: z.object({ min: z.number(), criticalMin: z.number() }),
});

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

    const upstream = await fetch(config.telemetryApiUrl);
    if (!upstream.ok) {
      return res.status(502).json({ message: `Upstream API failed with status ${upstream.status}` });
    }

    const raw = await upstream.json();
    const points = normalizeSourceRecords(raw, employeeId);

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
  res.json(bootstrap.alerts);
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

app.get("/api/bootstrap", async (req, res) => {
  try {
    const shouldSync = String(req.query.sync ?? "true") === "true";
    const allEmployees = await listAllEmployees();
    const workers = [];
    let allAlerts = [];
    let allZones = [
      { name: "Zone A", type: "safe", workers: 0, description: "Main Assembly Area" },
      { name: "Zone B", type: "safe", workers: 0, description: "Electrical Bay" },
      { name: "Zone C", type: "restricted", workers: 0, description: "Heavy Machinery" },
      { name: "Zone D", type: "safe", workers: 0, description: "Pipe Works" },
      { name: "Zone E", type: "emergency", workers: 0, description: "Chemical Storage" },
    ];
    let allTimeSeries = [];
    let allDailyAlertData = [];
    let allRiskDistribution = [];
    let thresholds = null;

    for (const employee of allEmployees) {
      if (shouldSync) {
        const upstream = await fetch(config.telemetryApiUrl);
        if (upstream.ok) {
          const raw = await upstream.json();
          const points = normalizeSourceRecords(raw, employee.id);
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
      allZones.forEach(z => {
        if (z.name === employee.zone) z.workers += 1;
      });
      allDailyAlertData = allDailyAlertData.concat(response.dailyAlertData);
      allRiskDistribution = allRiskDistribution.concat(response.riskDistribution);
      if (!thresholds) thresholds = t;
    }

    res.json({
      workers,
      alerts: allAlerts,
      zones: allZones,
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

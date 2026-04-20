import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { db } from "./dynamo";
import { config } from "./config";
import type { Employee, TelemetryPoint, Thresholds } from "./types";

const defaultThresholds: Thresholds = {
  heartRate: { min: 60, max: 100, criticalMax: 120 },
  temperature: { min: 35.5, max: 37.5, criticalMax: 38.0 },
  airQuality: { min: 70, criticalMin: 50 },
};

const defaultEmployee = (id: string): Employee => ({
  id,
  name: "Assigned Employee",
  role: "Worker",
  shift: "Morning",
  zone: "Zone A",
  deviceId: "DEV-EMP001",
});

export async function getOrCreateEmployee(employeeId: string): Promise<Employee> {
  const existing = await db.send(
    new GetCommand({
      TableName: config.employeeTable,
      Key: { id: employeeId },
    })
  );

  if (existing.Item) {
    return existing.Item as Employee;
  }

  const employee = defaultEmployee(employeeId);
  await db.send(
    new PutCommand({
      TableName: config.employeeTable,
      Item: employee,
      ConditionExpression: "attribute_not_exists(id)",
    })
  );

  return employee;
}

export async function updateEmployeeAssignment(input: Employee) {
  await db.send(
    new PutCommand({
      TableName: config.employeeTable,
      Item: input,
    })
  );

  return input;
}

export async function updateEmployeeDevice(employeeId: string, deviceId: string): Promise<Employee> {
  // Get existing employee first
  const existing = await db.send(
    new GetCommand({
      TableName: config.employeeTable,
      Key: { id: employeeId },
    })
  );

  if (!existing.Item) {
    throw new Error(`Employee ${employeeId} not found`);
  }

  const employee = existing.Item as Employee;
  const oldDeviceId = employee.deviceId;
  employee.deviceId = deviceId;
  employee.updatedAt = Date.now();

  // Update with new device ID
  await db.send(
    new PutCommand({
      TableName: config.employeeTable,
      Item: employee,
    })
  );

  console.log(`Device reassigned: ${employeeId} from ${oldDeviceId} to ${deviceId}`);
  return employee;
}

export async function getOrCreateThresholds(employeeId: string): Promise<Thresholds> {
  const existing = await db.send(
    new GetCommand({
      TableName: config.settingsTable,
      Key: { employeeId },
    })
  );

  if (existing.Item?.thresholds) {
    return existing.Item.thresholds as Thresholds;
  }

  await db.send(
    new PutCommand({
      TableName: config.settingsTable,
      Item: {
        employeeId,
        thresholds: defaultThresholds,
        notifications: {
          email: true,
          sms: false,
          push: true,
          criticalOnly: false,
        },
      },
    })
  );

  return defaultThresholds;
}

export async function updateThresholds(employeeId: string, thresholds: Thresholds) {
  await db.send(
    new UpdateCommand({
      TableName: config.settingsTable,
      Key: { employeeId },
      UpdateExpression: "SET #thresholds = :thresholds",
      ExpressionAttributeNames: { "#thresholds": "thresholds" },
      ExpressionAttributeValues: { ":thresholds": thresholds },
    })
  );

  return thresholds;
}

export async function upsertTelemetry(point: TelemetryPoint) {
  const sk = `${point.ts}_${point.telemetryId}`;

  await db.send(
    new PutCommand({
      TableName: config.telemetryTable,
      Item: {
        employeeId: point.employeeId,
        sk,
        ...point,
      },
      ConditionExpression: "attribute_not_exists(sk)",
    })
  );
}

export async function listTelemetry(employeeId: string, limit = 200): Promise<TelemetryPoint[]> {
  const result = await db.send(
    new QueryCommand({
      TableName: config.telemetryTable,
      KeyConditionExpression: "employeeId = :employeeId",
      ExpressionAttributeValues: { ":employeeId": employeeId },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  const items = (result.Items ?? []) as Array<TelemetryPoint & { sk: string }>;
  return items.sort((a, b) => b.ts - a.ts);
}

export async function pingTables() {
  await db.send(
    new ScanCommand({
      TableName: config.employeeTable,
      Limit: 1,
    })
  );
}

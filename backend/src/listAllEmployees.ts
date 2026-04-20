import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "./dynamo";
import { config } from "./config";
import type { Employee } from "./types";

export async function listAllEmployees(): Promise<Employee[]> {
  const result = await db.send(
    new ScanCommand({
      TableName: config.employeeTable,
    })
  );
  return (result.Items ?? []) as Employee[];
}

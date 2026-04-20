const num = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: num(process.env.BACKEND_PORT, 4000),
  awsRegion: process.env.AWS_REGION ?? "eu-north-1",
  telemetryApiUrl:
    process.env.TELEMETRY_API_URL ??
    "https://76ezf3ssob.execute-api.eu-north-1.amazonaws.com/apistage/data",
  employeeTable: process.env.DDB_EMPLOYEE_TABLE ?? "sentinel-employees",
  telemetryTable: process.env.DDB_TELEMETRY_TABLE ?? "sentinel-telemetry",
  settingsTable: process.env.DDB_SETTINGS_TABLE ?? "sentinel-settings",
  defaultEmployeeId: process.env.DEFAULT_EMPLOYEE_ID ?? "EMP001",
};

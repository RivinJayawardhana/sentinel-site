import type { BootstrapResponse, Thresholds } from "@/types/monitoring";

const BASE_URL = import.meta.env.VITE_BACKEND_API_URL ?? (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8080" : "http://localhost:4000");

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${path}`);
  }

  return (await res.json()) as T;
}

export function fetchBootstrap(employeeId: string) {
  return requestJson<BootstrapResponse>(`/api/bootstrap?employeeId=${encodeURIComponent(employeeId)}&sync=true`);
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
